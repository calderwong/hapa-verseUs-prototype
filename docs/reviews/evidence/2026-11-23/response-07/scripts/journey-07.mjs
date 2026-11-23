#!/usr/bin/env node
/**
 * Response 07 continuous journeys (assignment 07 §4–§6): uninterrupted real pointer and keyboard
 * input, recorded from Chrome's screencast and encoded with ffmpeg. Dev server 127.0.0.1:5199,
 * profile hapa_open_10x9_v3_02, 1280×720 @1, browser default text size, Home camera at start.
 *
 *   PUPPETEER_CORE=… node docs/reviews/evidence/2026-11-23/response-07/scripts/journey-07.mjs <outDir>
 *
 * Clip 1 (seed 1, A human vs B bot): overview → select the C1 Castle → Supply ▾ → Load 2♣ →
 * Move to R2C1 (funded) → Ready → merge playback → N (Parties & Cards) → keyboard to "Inspect B's
 * Bishop" → Enter (enemy inspected; A's Castle stays selected) → Esc (navigator) → → / Enter (a
 * member's explanation, keyboard) → Esc → Esc → R (Return) → F (inspect the merged Castle) → hover
 * an Archer (explanation beside the formation) → orbit 360° → R → Supply ▾ (same party, no reselect).
 * Clip 2 (labelled ward fixture): inspect B's Castle, open its Archer through the inspection bar,
 * Ready both seats at 0.3× speed: the Mage dies at contact; ward, headcount and labels change at
 * the displayed death; the open explanation refreshes (engaged, named target) without re-hovering.
 * Clip 3 (labelled terrain fixture, the benchmark territory): A.hill → F → orbit in 45° steps →
 * layer +1 (hill dressing steps aside) → All → member open → R.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const out = path.resolve(process.argv[2] ?? 'journey-07');
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
const named = async (page, sel, re) => { const h = await page.evaluateHandle((sel, src) => [...document.querySelectorAll(sel)].find((e) => new RegExp(src).test((e.getAttribute('aria-label') || e.innerText || '').trim())), sel, re.source); await h.asElement().click(); await sl(500); };
const move = async (page, p, steps = 12) => { await page.mouse.move(p.x, p.y, { steps }); };
const body = (page, id) => page.evaluate((id) => { const a = window.__versus, v = a.view.sprites.get(id).position.clone(); v.y += 0.5; const q = v.project(a.engine.camera), r = a.engine.renderer.domElement.getBoundingClientRect(); return { x: r.left + (q.x + 1) / 2 * r.width, y: r.top + (1 - q.y) / 2 * r.height }; }, id);
const tabTo = async (page, re) => { for (let i = 0; i < 120; i++) { const name = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? ''); if (re.test(name)) return true; await page.keyboard.press('Tab'); await sl(30); } return false; };

const c1 = await record('journey-command-inspect', 'autostart=1&a=human&b=bot&seed=1', async (step) => {
  await step('overview (home)', async () => sl(800));
  await step('click the C1 Castle: command selection, no camera move', async (page) => { const p = await at(page, { kind: 'party', id: 'A.mount.C1' }); await move(page, { x: p.x, y: p.y + 30 }); await page.mouse.down(); await page.mouse.up(); await sl(900); });
  await step('Supply ▾ → Load 2♣ (C1)', async (page) => { await named(page, '.cmdbar summary', /^Supply ▾/); await named(page, '.cmdbar button', /^Load 2 Supply from 2♣ \(C1\)/); });
  await step('Move to R2C1 (funded)', async (page) => { await sl(500); await named(page, '.cmdbar .movelist button', /to R2C1: needs 1/); await sl(700); });
  await step('Ready: the merge plays', async (page) => { await named(page, '#matchbar .ready-big', /^Ready/); await page.waitForFunction(() => { const a = window.__versus; return a.state.tick >= 2 && !a.playback && !a.resolving; }, { timeout: 30000 }); await sl(600); });
  await step('N, then the keyboard to "Inspect B\'s Bishop", Enter', async (page) => { await page.mouse.move(640, 60); await page.keyboard.press('n'); await sl(400); await tabTo(page, /^Inspect B's Bishop/); await sl(400); await page.keyboard.press('Enter'); await sl(2000); });
  await step('Esc closes the navigator; → and Enter open a member (keyboard)', async (page) => { await page.keyboard.press('Escape'); await sl(300); await page.keyboard.press('ArrowRight'); await sl(250); await page.keyboard.press('Enter'); await sl(1600); });
  await step('Esc, Esc, R: back to the overview; A\'s Castle still selected', async (page) => { await page.keyboard.press('Escape'); await sl(300); await page.keyboard.press('Escape'); await sl(300); await page.keyboard.press('r'); await sl(1500); });
  await step('F: inspect the merged Castle', async (page) => { await page.keyboard.press('f'); await sl(2200); });
  await step('hover an Archer: its explanation opens beside the formation', async (page) => { const id = await page.evaluate(() => Object.values(window.__versus.state.parties['A.mount.C1'].slots).find((x) => x && window.__versus.state.members[x].archetype === 'archer')); await move(page, await body(page, id)); await sl(1800); });
  await step('orbit 360° (Q ×8)', async (page) => { await page.mouse.move(640, 60); for (let i = 0; i < 8; i++) { await page.keyboard.press('q'); await sl(800); } });
  await step('R: Return', async (page) => { await page.keyboard.press('r'); await sl(1500); });
  await step('Supply ▾ again on the same party (no reselection)', async (page) => { await named(page, '.cmdbar summary', /^Supply ▾/); await sl(1200); });
});
const c2 = await record('journey-playback-moment', 'autostart=1&fixture=ward&a=human&b=human', async (step) => {
  await step('N → keyboard "Inspect B\'s Castle" → Enter', async (page) => { await page.keyboard.press('n'); await sl(300); await tabTo(page, /^Inspect B's Castle/); await page.keyboard.press('Enter'); await sl(1800); await page.keyboard.press('Escape'); await sl(300); });
  await step('open B\'s Archer from the inspection bar', async (page) => { await named(page, '.inspect-bar .ib-member', /^Archer/); await page.mouse.move(640, 60); await sl(1200); });
  await step('Ready (A), Ready (B) at 0.3×: contact, the Mage falls, the ward ends', async (page) => { await page.evaluate(() => { window.__versus.speed = 0.3; }); await named(page, '#matchbar .ready-big', /^Ready/); await named(page, '#matchbar .ready-big', /^Ready/); await page.waitForFunction(() => { const a = window.__versus; return a.state.tick >= 6 && !a.playback && !a.resolving; }, { timeout: 40000 }); await sl(1200); });
});
const c3 = await record('journey-territory', 'autostart=1&fixture=terrain&a=human&b=human', async (step) => {
  await step('select A.hill (raised ground) and Inspect', async (page) => { const p = await at(page, { kind: 'party', id: 'A.hill' }); await move(page, { x: p.x, y: p.y + 30 }); await page.mouse.down(); await page.mouse.up(); await sl(500); await page.keyboard.press('f'); await sl(2400); });
  await step('orbit in 45° steps (Q ×8)', async (page) => { await page.mouse.move(640, 60); for (let i = 0; i < 8; i++) { await page.keyboard.press('q'); await sl(1000); } });
  await step('layer +1: the +3 hill turns see-through and its dressing steps aside', async (page) => { await named(page, '.layer-rail button', /^\+1/); await sl(1600); });
  await step('All layers; open an Archer', async (page) => { await named(page, '.layer-rail button', /^All$/); await sl(800); const id = await page.evaluate(() => Object.values(window.__versus.state.parties['A.hill'].slots).find((x) => x && window.__versus.state.members[x].archetype === 'archer')); await move(page, await body(page, id)); await sl(1800); });
  await step('R: Return', async (page) => { await page.mouse.move(640, 60); await page.keyboard.press('r'); await sl(1500); });
});
await browser.close();
fs.writeFileSync(path.join(out, 'journey-log.json'), JSON.stringify({ clips: { commandInspect: c1, playbackMoment: c2, territory: c3 }, steps: log }, null, 1));
console.log(JSON.stringify({ c1, c2, c3 }));
