// usage: node capture.mjs <outdir> <json plan>
// plan: { avatar: null|id, track: index, segments: [{ mode, at, secs }], hud: true }
import fs from 'node:fs';
import path from 'node:path';
import { open, choose, start, sleep } from './lib.mjs';
const [out, planJson] = process.argv.slice(2);
const plan = JSON.parse(planJson);
fs.mkdirSync(out, { recursive: true });
const { browser, page, errors } = await open({ w: plan.w ?? 1280, hgt: plan.h ?? 800 });
await choose(page, plan.avatar ?? null); await start(page); await sleep(2500);
// evidence-only overlay: hides the song identity, draws the measured signal bottom-left
await page.addStyleTag({ content: '.np-text, .np-id .np-mark { visibility: hidden !important; } #ev-hud { position: fixed; left: 230px; bottom: 60px; z-index: 99; font: 12px/1.3 ui-monospace, monospace; color: #f4e6c8; background: rgba(8,12,16,.78); padding: 8px 10px; border-radius: 6px; width: 250px; } #ev-hud .r { display: flex; align-items: center; gap: 6px; margin: 2px 0 } #ev-hud .b { flex: 1; height: 8px; background: #26313b; border-radius: 3px; overflow: hidden } #ev-hud .b i { display: block; height: 100%; background: #e9b46a } #ev-hud .on i { background: #ffe1a0 }' });
await page.evaluate((hud) => {
  if (!hud) return;
  const d = document.createElement('div'); d.id = 'ev-hud';
  d.innerHTML = '<div id="ev-h">—</div>' + ['onset', 'low', 'swell', 'high'].map((k) => `<div class="r ${k === 'onset' ? 'on' : ''}"><span style="width:44px">${k}</span><span class="b"><i id="ev-${k}"></i></span></div>`).join('') + '<div id="ev-n" style="opacity:.75">measured live · onsets are not beats</div>';
  document.body.append(d);
  const loop = () => { const v = window.__versus, m = v.table?.music, f = m?.signal.frame; if (f) {
    const mode = m.still ? 'Still' : m.settings.response;
    document.getElementById('ev-h').textContent = `${mode.toUpperCase()} · song ${f.sourceTimeSeconds.toFixed(1)} s · ${f.state}`;
    const live = f.state === 'following' || f.state === 'silence';
    for (const [k, x] of [['onset', f.onset01], ['low', f.low01], ['swell', f.energy01], ['high', f.high01]]) document.getElementById(`ev-${k}`).style.width = `${Math.round(100 * (live ? x : 0))}%`;
    document.getElementById('ev-n').textContent = `onsets ${f.onsetCount} · measured live · not beats`; }
    requestAnimationFrame(loop); };
  loop();
}, plan.hud !== false);
await page.evaluate(() => document.querySelector('.opp-sound')?.click());
await sleep(1500);
// pick the track
if (plan.track != null && !plan.perSegTrack) await page.evaluate(async (i) => { const m = window.__versus.table.music; for (let k = 0; k < 40 && !m.queue.entries.length; k++) await new Promise((r) => setTimeout(r, 250)); if (m.queue.index !== i) m._select(i, 'start'); for (let k = 0; k < 40 && m.status !== 'playing'; k++) await new Promise((r) => setTimeout(r, 250)); }, plan.track);
const cdp = await page.createCDPSession();
const frames = [];
cdp.on('Page.screencastFrame', async (e) => { frames.push({ t: e.metadata.timestamp, data: e.data, seg: cur }); cdp.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {}); });
let cur = -1;
const log = [];
for (let i = 0; i < plan.segments.length; i++) {
  const sg = plan.segments[i];
  await page.evaluate(async (s) => { const m = window.__versus.table.music; if (s.track != null && m.queue.index !== s.track) { m._select(s.track, 'start'); for (let k = 0; k < 40 && m.status !== 'playing'; k++) await new Promise((r) => setTimeout(r, 250)); } m.setStill(!!s.still); if (s.mode) m.setResponse(s.mode); if (s.at != null) { m.audio.currentTime = s.at; } if (m.audio.paused) await m.audio.play().catch(() => {}); }, sg);
  await sleep(sg.settle ?? 1200); // let the seek reset and the envelopes warm (the signal resets on seek)
  cur = i;
  if (i === 0) await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 72, everyNthFrame: plan.nth ?? 1 });
  const t0 = Date.now();
  while (Date.now() - t0 < sg.secs * 1000) { log.push(await page.evaluate((seg) => { const v = window.__versus, f = v.table.music.signal.frame, st = v.scenery.stats(); return { seg, wall: Date.now(), t: f.sourceTimeSeconds, state: f.state, onset: f.onset01, on: f.onsetCount, low: f.low01, swell: f.energy01, mid: f.mid01, high: f.high01, pulses: st.pulses, rings: st.rings, rail: st.rail }; }, i)); await sleep(100); }
  cur = -1;
}
await cdp.send('Page.stopScreencast');
await page.evaluate(() => window.__versus.table.music.audio.pause());
// write frames per segment with durations from timestamps
for (let i = 0; i < plan.segments.length; i++) {
  const fs_ = frames.filter((f) => f.seg === i);
  const dir = path.join(out, `seg${i}`); fs.mkdirSync(dir, { recursive: true });
  let list = '';
  fs_.forEach((f, k) => { const name = `f${String(k).padStart(5, '0')}.jpg`; fs.writeFileSync(path.join(dir, name), Buffer.from(f.data, 'base64')); const dur = k + 1 < fs_.length ? fs_[k + 1].t - f.t : 0.05; list += `file '${name}'\nduration ${dur.toFixed(4)}\n`; });
  fs.writeFileSync(path.join(dir, 'list.txt'), list);
  console.log(`seg${i}: ${fs_.length} frames over ${(fs_.at(-1)?.t - fs_[0]?.t).toFixed(2)} s`);
}
fs.writeFileSync(path.join(out, 'signal-log.json'), JSON.stringify({ plan, log }, null, 1));
console.log(errors.filter((e) => !/404/.test(e)).join('\n'));
await browser.close();
