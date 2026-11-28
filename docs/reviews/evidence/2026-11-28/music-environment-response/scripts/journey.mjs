import fs from 'node:fs';
import { open, choose, start, sleep, URL0 } from './lib.mjs';
const out = process.argv[2];
const { browser, page, errors } = await open({ w: 1280, hgt: 800 });
const R = { url: URL0, at: new Date().toISOString(), steps: [] };
const step = (name, o) => { R.steps.push({ step: name, ...o }); console.log(name, JSON.stringify(o)); };
const snap = () => page.evaluate(() => { const v = window.__versus, m = v.table?.music, f = m?.signal.frame, st = v.scenery.stats(), c = v.engine.camera;
  return { table: !!v.table, plate: document.querySelector('.opp-name')?.textContent ?? null, figure: !!v.table?.opponent?.avatarId, status: m?.status, mode: m?.settings.response, still: m?.still, state: f?.state, analysis: f?.analysis, songT: f ? +f.sourceTimeSeconds.toFixed(2) : null, gen: f?.generation, onsets: f?.onsetCount, energy: f ? +f.energy01.toFixed(3) : null, low: f ? +f.low01.toFixed(3) : null, high: f ? +f.high01.toFixed(3) : null, pulses: st.pulses, rings: st.rings, rail: +st.rail.toFixed(3), lampPhase: +st.lampPhase.toFixed(3), glow: +st.glow.toFixed(3), muted: m?.settings.muted, gain: m?.signal.gain?.gain.value ?? null, audios: [...document.querySelectorAll('audio')].length, cam: [c.position.x, c.position.y, c.position.z].map((x) => +x.toFixed(3)), tick: v.state.tick, scene: document.querySelector('.np-scene-state')?.textContent ?? null }; });
const music = (fn, arg) => page.evaluate(fn, arg);

// 1) local No figure: music and response, one player
await choose(page, null); await start(page); await sleep(2500);
step('No figure started', await snap());
await page.evaluate(() => document.querySelector('.opp-sound').click()); await sleep(3500);
await music(() => window.__versus.table.music.setResponse('expressive')); await sleep(2500);
const camHome = (await snap()).cam;
step('No figure · Music on · Expressive', await snap());
// drawer: state line and meters
await page.evaluate(() => { const t = window.__versus.table; t.deck.toggle(true); t.deck.signalEl.open = true; }); await sleep(800);
step('drawer open', await page.evaluate(() => ({ scene: document.querySelector('.np-scene-state').textContent, meters: [...document.querySelectorAll('.np-meter-bar')].map((b) => b.style.width), help: document.querySelector('.np-help').textContent })));
// 2) pause → released, no new onsets; resume
await music(() => window.__versus.table.music.pause()); await sleep(1500);
const p1 = await snap(); await sleep(1500); const p2 = await snap();
step('paused 1.5 s and 3 s', { a: p1, b: p2, onsetsWhilePaused: p2.onsets - p1.onsets });
await music(() => window.__versus.table.music.play()); await sleep(2500);
step('resumed', await snap());
// 3) seek: envelopes reset, onsets follow again
const s0 = await snap();
await music(() => { const m = window.__versus.table.music; m.audio.currentTime = m.audio.currentTime + 40; }); await sleep(120);
const s1 = await snap(); await sleep(2500);
step('seek +40 s', { before: s0, right_after: s1, later: await snap() });
// 4) Next: a new generation clears the old song's pulses
const n0 = await snap();
await music(() => window.__versus.table.music.next()); await sleep(150);
const n1 = await snap(); await sleep(4000);
step('Next', { before: n0, right_after: n1, later: await snap() });
// 5) mute: listening volume only; the analysis keeps following
await music(() => window.__versus.table.music.toggleMute()); await sleep(2500);
step('muted', await snap());
await music(() => window.__versus.table.music.toggleMute()); await sleep(500);
// 6) Off and Still (music keeps playing; scene calm; camera unchanged)
await music(() => window.__versus.table.music.setResponse('off')); await sleep(2000);
step('Off', await snap());
await music(() => { const m = window.__versus.table.music; m.setResponse('expressive'); m.setStill(true); }); await sleep(800);
const st1 = await snap(); await sleep(1500);
step('Still (2 samples)', { a: st1, b: await snap() });
await music(() => window.__versus.table.music.setStill(false)); await sleep(1500);
step('Still released', await snap());
// 7) an ordinary turn with music playing (Expressive)
const t0 = await snap();
const ready = await page.evaluate(async () => { const v = window.__versus, k = v.state.tick; [...document.querySelectorAll('button')].find((b) => /^READY/i.test(b.textContent.trim()))?.click(); for (let i = 0; i < 80 && v.state.tick === k; i++) await new Promise((r) => setTimeout(r, 500)); return { from: k, to: v.state.tick }; });
await sleep(1500);
const t1 = await snap();
step('ordinary turn with music', { ready, before: t0, after: t1, camHomeBefore: camHome, sameCamera: JSON.stringify(t0.cam) === JSON.stringify(camHome) });
// 8) saved settings survive a reload; a replacement match disposes the old player
await page.goto(URL0, { waitUntil: 'networkidle2' }); await sleep(800);
step('reload: saved settings', await page.evaluate(() => JSON.parse(localStorage.getItem('hapa-versus.music-settings.v1'))));
// 9) the existing Avatar path still owns the same single music (Falka; Mesh owner live)
await choose(page, 'avatar-8'); await start(page); await sleep(4000);
const fa = await snap();
await page.evaluate(() => { const b = document.querySelector('.opp-sound'); b?.click(); }); await sleep(3500);
step('Falka (Avatar) with music', { atStart: fa, playing: await snap() });
const oldMusic = await page.evaluate(() => { window.__oldM = window.__versus.table.music; return true; });
await page.evaluate(() => window.__versus.startMatch({ table: { ...window.__versus._tableChoice, avatarId: null } })); await sleep(2500);
step('replacement match (No figure) after Falka', { new: await snap(), oldDisposed: await page.evaluate(() => ({ disposed: window.__oldM.disposed, paused: window.__oldM.audio.paused, ctx: window.__oldM.signal.ctx })) });
// 10) reduced motion: Still follows it until the player chooses
const ctx2 = await browser.createBrowserContext(); const p2_ = await ctx2.newPage(); await p2_.setViewport({ width: 1280, height: 800 });
await p2_.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await p2_.goto(URL0, { waitUntil: 'networkidle2' });
await p2_.evaluate(() => document.querySelector('input[name=roster-choice][value=""]').click()); await sleep(600);
await p2_.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Start match').click()); await sleep(2500);
await p2_.evaluate(() => document.querySelector('.opp-sound').click()); await sleep(3000);
await p2_.evaluate(() => window.__versus.table.music.setResponse('expressive')); await sleep(1500);
step('reduced motion (fresh profile)', await p2_.evaluate(() => { const v = window.__versus, m = v.table.music, st = v.scenery.stats(); return { still: m.still, savedStill: m.settings.still, state: m.signal.frame.state, pulses: st.pulses, rings: st.rings, rail: st.rail, glow: st.glow }; }));
await ctx2.close();
R.pageErrors = errors.filter((e) => !/status of 404/.test(e));
R.notFound404 = errors.filter((e) => /status of 404/.test(e)).length;
fs.writeFileSync(out, JSON.stringify(R, null, 1));
await browser.close();
