#!/usr/bin/env node
/**
 * Response 08 continuous journeys (assignment 08 "Fit, then tighten"): real pointer and keyboard
 * input where the UI offers it, recorded from Chrome's screencast and encoded with ffmpeg. Dev
 * server 127.0.0.1:5199, default profile hapa_open_10x9_v3_03, 1280×720 @1, default text size.
 *
 *   PUPPETEER_CORE=… node docs/reviews/evidence/2026-11-23/response-08/scripts/journey-08.mjs <outDir>
 *
 * Clip 1 — the ordinary development match (A human, B bot, seed 1): Ready through the prologue;
 * Tick 6 click the Queen, Supply ▾ loads C6, C5, C4, Move ▾ shows R4C9 crossed "blocked by your
 * Pawn R2C6", Move to R4C9, one Ready; it stops halfway with 5.5 Supply; H shows the named
 * obstruction in Tick 6's history; Ready to Tick 13; the command bar names the blocker; Move to
 * R1C6 (0.5); one Ready; it returns. F inspects the Pawn, a shield symbol is hovered, then the
 * keyboard opens an Archer's symbols; H opens history beside the inspection, Q orbits, H closes;
 * the original Queen is still selected.
 * Clip 2 — labelled Mana diagnostic (existing response fixture, A human / B bot): burn A.red in
 * the Card view → the basin reads Available 2 Red at once; Ember Strike is queued (validated
 * command; the Card tool's pointer path is c2) → 0 available; one Ready; the bot answers.
 * Clip 3 — both bots: running, Pause, Step, Stop.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const out = path.resolve(process.argv[2] ?? 'journey-08');
fs.mkdirSync(out, { recursive: true });
const puppeteer = (await import(pathToFileURL(path.join(process.env.PUPPETEER_CORE, 'lib/puppeteer/puppeteer-core.js')).href)).default;
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--mute-audio'] });
const sl = (ms) => new Promise((r) => setTimeout(r, ms));
const log = [];

async function record(name, query, steps) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:5199/versus.html?${query}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.__versus?.session); await sl(1500);
  const dir = path.join(out, `${name}-frames`); fs.mkdirSync(dir, { recursive: true });
  const cdp = await page.createCDPSession();
  let n = 0; const t0 = Date.now(); const stamps = [];
  cdp.on('Page.screencastFrame', async (f) => { const file = path.join(dir, `f${String(n).padStart(5, '0')}.jpg`); fs.writeFileSync(file, Buffer.from(f.data, 'base64')); stamps.push(Date.now() - t0); n++; cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, everyNthFrame: 1 });
  const step = async (label, fn) => { const s = Date.now() - t0; await fn(page); log.push({ clip: name, at: s, step: label, state: await page.evaluate(() => { const a = window.__versus; return { tick: a.state.tick, selected: a.selected?.id ?? null, inspect: a.inspectParty?.partyId ?? null, open: a.expandedMember ?? a.expandedPin ?? null, level: a.labels.level, bearing: Math.round(a.cam.bearing), plans: a.plans.A.map((c) => c.type), labels: document.querySelectorAll('.mlabel:not([hidden])').length, reading: document.querySelector('.mreading:not([hidden])')?.innerText.replace(/\s+/g, ' ').slice(0, 160) ?? null, party: document.querySelector('.inspect-bar:not([hidden]) .ib-head')?.innerText.replace(/\s+/g, ' ') ?? null }; }) }); };
  await steps(step);
  await sl(600);
  await cdp.send('Page.stopScreencast');
  await page.close();
  const list = path.join(dir, 'list.txt');
  fs.writeFileSync(list, stamps.map((s, i) => `file 'f${String(i).padStart(5, '0')}.jpg'\nduration ${((stamps[i + 1] ?? s + 66) - s) / 1000}`).join('\n'));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', 'fps=15,format=yuv420p', '-c:v', 'libx264', '-crf', '28', path.join(out, `${name}.mp4`)]);
  fs.rmSync(dir, { recursive: true, force: true });
  return { frames: n, seconds: (stamps.at(-1) ?? 0) / 1000 };
}

const at = (page, sub) => page.evaluate((sub) => { const a = window.__versus, c = a._screenAnchor(sub), r = a.el.world.getBoundingClientRect(); return { x: r.left + c.x, y: r.top + c.y }; }, sub);
const named = async (page, sel, re) => { const h = await page.evaluateHandle((sel, src) => [...document.querySelectorAll(sel)].find((e) => new RegExp(src).test((e.getAttribute('aria-label') || e.innerText || '').trim())), sel, re.source); const el = h.asElement(); if (!el) throw new Error(`no control ${sel} ${re}: ${await page.evaluate((sel) => [...document.querySelectorAll(sel)].map((e) => (e.getAttribute('aria-label') || e.innerText).slice(0, 60)).join(' | '), sel)}`); await el.click(); await sl(500); };
const move = async (page, p, steps = 12) => { await page.mouse.move(p.x, p.y, { steps }); };
const body = (page, id) => page.evaluate((id) => { const a = window.__versus, v = a.view.sprites.get(id).position.clone(); v.y += 0.5; const q = v.project(a.engine.camera), r = a.engine.renderer.domElement.getBoundingClientRect(); return { x: r.left + (q.x + 1) / 2 * r.width, y: r.top + (1 - q.y) / 2 * r.height }; }, id);
const tabTo = async (page, re) => { for (let i = 0; i < 120; i++) { const name = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? ''); if (re.test(name)) return true; await page.keyboard.press('Tab'); await sl(30); } return false; };

const ready = async (page) => { await named(page, '#matchbar .ready-big', /^Ready/); };
const until = (page, t) => page.waitForFunction((t) => { const a = window.__versus; return a.state.tick >= t && !a.playback && !a.resolving && !a.pendingChoice; }, { timeout: 60000 }, t);
const toTick = async (page, t) => { while ((await page.evaluate(() => window.__versus.state.tick)) < t) { const n = await page.evaluate(() => window.__versus.state.tick); await ready(page); await until(page, n + 1); } };
const openMove = async (page) => { if (!(await page.evaluate(() => !!document.querySelector('.cmdbar details.cmd-menu[open] .movelist')))) await named(page, '.cmdbar summary', /^Move to ▾/); await sl(400); };
const clickParty = async (page, id) => { const p = await at(page, { kind: 'party', id }); await move(page, { x: p.x, y: p.y + 30 }); await page.mouse.down(); await page.mouse.up(); await sl(700); };

const c1 = await record('journey-loop', 'autostart=1&a=human&b=bot&seed=1', async (step) => {
  await step('overview: A human, B bot (dev preset default)', async (page) => { await page.evaluate(() => { window.__versus.speed = 2; }); await sl(800); });
  await step('Ready through the prologue (one press per Tick)', async (page) => toTick(page, 6));
  await step('Tick 6: click the Queen; Supply ▾ loads C6, C5, C4', async (page) => { await clickParty(page, 'A.mount.C6'); for (const c of ['6', '5', '4']) { await named(page, '.cmdbar summary', /^Supply ▾/); await named(page, '.cmdbar button', new RegExp(`\\(C${c}\\)`)); } });
  await step('Move ▾: R4C9 is crossed — blocked by your Pawn R2C6', async (page) => { await openMove(page); await sl(1400); });
  await step('Move to R4C9 anyway; one Ready', async (page) => { await named(page, '.cmdbar .movelist button', /to R4C9/); await sl(800); await ready(page); await until(page, 7); await sl(800); });
  await step('H: Tick 6 history names the obstruction', async (page) => { await page.mouse.move(640, 60); await page.keyboard.press('h'); await sl(2200); await page.keyboard.press('h'); await sl(400); });
  await step('Ready to Tick 13 (C6 active again)', async (page) => toTick(page, 13));
  await step('the command bar names the blocker; Move ▾ → R1C6 (0.5 Supply)', async (page) => { await clickParty(page, 'A.mount.C6'); await sl(1200); await openMove(page); await sl(600); await named(page, '.cmdbar .movelist button', /to R1C6:/); await sl(600); });
  await step('one Ready: the Queen returns to R1C6', async (page) => { await ready(page); await until(page, 14); await sl(1000); });
  await step('F on the five-member Pawn: symbols with exact values', async (page) => { await page.evaluate(() => window.__versus._focusInspect('A.pawn.C3')); await sl(1600); for (let i = 0; i < 8 && (await page.evaluate(() => window.__versus.labels.level)) !== 'combat'; i++) { await page.mouse.move(640, 360); await page.mouse.wheel({ deltaY: -160 }); await sl(350); } await sl(800); });
  await step('hover a shield symbol: front-only Physical 1', async (page) => { const c = await page.evaluate(() => { const el = [...document.querySelectorAll('.mfact.sh')].find((x) => x.querySelector('.mface')); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); await move(page, c); await sl(1800); });
  await step('keyboard: an Archer, → → to its attack (2 × 1)', async (page) => { await page.keyboard.press('Escape'); await named(page, '.inspect-bar .ib-member', /^Archer/); await sl(600); await page.keyboard.press('ArrowRight'); await sl(500); await page.keyboard.press('ArrowRight'); await sl(1800); });
  await step('H: history opens beside the inspection; Q orbits; H closes', async (page) => { await page.keyboard.press('Escape'); await page.mouse.move(640, 60); await page.keyboard.press('h'); await sl(1500); await page.keyboard.press('q'); await sl(1500); await page.keyboard.press('h'); await sl(800); });
  await step('R: the Queen is still the command selection', async (page) => { await page.keyboard.press('r'); await sl(1500); });
});

const c2 = await record('journey-mana', 'autostart=1&fixture=response&a=human&b=bot', async (step) => {
  await step('labelled Mana diagnostic: basin reads Available 0', async () => sl(900));
  await step('Card view → Burn A.red: Available 2 Red at once, streams into the basin', async (page) => { await page.evaluate(() => { window.__versus.pinned = { kind: 'card', id: 'A.red' }; window.__versus._renderAll(); }); await sl(500); await named(page, '.peek.pinned button.burn', /^Burn .+ for /); await sl(1800); });
  await step('Ember Strike queued this Tick (validated command): Available 0', async (page) => { await page.evaluate(() => window.__versus._addCommand('A', { type: 'play_ability', cardId: 'A.ember', actorPartyId: 'A.c', target: { memberId: 'B.c.s2' }, burns: [] })); await page.keyboard.press('Escape'); await sl(1500); });
  await step('one Ready: the bot counters, A chooses to Pass in the genuine response window, the Tick resolves', async (page) => { await page.evaluate(() => { window.__versus.speed = 0.7; }); await ready(page); for (let i = 0; i < 200; i++) { const st = await page.evaluate(() => { const a = window.__versus; return { choice: !!a.pendingChoice, done: a.state.tick >= 10 && !a.playback && !a.resolving }; }); if (st.done) break; if (st.choice) { await sl(1500); await named(page, '#decision button', /^Pass$/); } await sl(150); } await sl(1200); });
});

const c3 = await record('journey-bots', 'autostart=1&a=bot&b=bot&seed=1', async (step) => {
  await step('both bots run without a human Ready', async (page) => { await page.waitForFunction(() => window.__versus.state.tick >= 3, { timeout: 60000 }); });
  await step('Pause: the current Tick finishes, then holds', async (page) => { await named(page, '.auto-ctl button', /Pause/); await sl(3500); });
  await step('Step: exactly one Tick', async (page) => { await named(page, '.auto-ctl button', /^Step/); await sl(3500); });
  await step('Stop', async (page) => { await named(page, '.auto-ctl button', /Stop/); await sl(1500); });
});

fs.writeFileSync(path.join(out, 'journey-log.json'), JSON.stringify({ server: 'http://127.0.0.1:5199', viewport: '1280x720@1', clips: { 'journey-loop': c1, 'journey-mana': c2, 'journey-bots': c3 }, log }, null, 2));
await browser.close();
console.log(JSON.stringify({ c1, c2, c3 }));
