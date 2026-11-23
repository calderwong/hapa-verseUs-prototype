#!/usr/bin/env node
/**
 * Response 06 continuous journey (assignment 06, R5-06): one uninterrupted real-input run, recorded
 * from Chrome's screencast and encoded with ffmpeg. Reproducible from: dev server 127.0.0.1:5199,
 * profile hapa_open_10x9_v3_02 (default), seed 1, seat A human vs B bot, 1280×720 @1, Home camera.
 *
 *   PUPPETEER_CORE=… node docs/reviews/evidence/2026-11-23/response-06/scripts/journey-06.mjs <outDir>
 *
 * Clip 1 (opening): select C1 Castle → Supply ▾ → Load 2♣ (C1) → Move to R2C1 (funded) → Ready →
 * playback (merge) → Inspect (F) → read nine members → hover an Archer → orbit 360° (Q ×8) →
 * Return (R) → Supply ▾ again (another command on the same party).
 * Clip 2 (terrain fixture, labelled diagnostic): select A.hill on raised ground → F → orbit →
 * B.tunnel (roofed) → open layer −2 → back to All → Home.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const out = path.resolve(process.argv[2] ?? 'journey-06');
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
  const step = async (label, fn) => { const s = Date.now() - t0; await fn(page); log.push({ clip: name, at: s, step: label, state: await page.evaluate(() => { const a = window.__versus; return { tick: a.state.tick, selected: a.selected?.id ?? null, inspect: a.inspectParty?.partyId ?? null, level: a.labels.level, bearing: Math.round(a.cam.bearing), plans: a.plans.A.map((c) => c.type), labels: document.querySelectorAll('.mlabel:not([hidden])').length }; }) }); };
  await steps(step);
  await sl(600);
  await cdp.send('Page.stopScreencast');
  await page.close();
  // constant 15 fps video from the variable-rate screencast (frames repeat while nothing changes)
  const list = path.join(dir, 'list.txt');
  fs.writeFileSync(list, stamps.map((s, i) => `file 'f${String(i).padStart(5, '0')}.jpg'\nduration ${((stamps[i + 1] ?? s + 66) - s) / 1000}`).join('\n'));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', 'fps=15,format=yuv420p', '-c:v', 'libx264', '-crf', '28', path.join(out, `${name}.mp4`)]);
  fs.rmSync(dir, { recursive: true, force: true });
  return { frames: n, seconds: (stamps.at(-1) ?? 0) / 1000 };
}

const at = (page, sub) => page.evaluate((sub) => { const a = window.__versus, c = a._screenAnchor(sub), r = a.el.world.getBoundingClientRect(); return { x: r.left + c.x, y: r.top + c.y }; }, sub);
const named = async (page, sel, re) => { const h = await page.evaluateHandle((sel, src) => [...document.querySelectorAll(sel)].find((e) => new RegExp(src).test((e.getAttribute('aria-label') || e.innerText || '').trim())), sel, re.source); await h.asElement().click(); await sl(500); };
const move = async (page, p, steps = 12) => { await page.mouse.move(p.x, p.y, { steps }); };

const c1 = await record('journey-opening', 'autostart=1&a=human&b=bot&seed=1', async (step) => {
  await step('home view', async () => sl(800));
  await step('click the C1 Castle (command selection)', async (page) => { const p = await at(page, { kind: 'party', id: 'A.mount.C1' }); await move(page, { x: p.x, y: p.y + 30 }); await page.mouse.down(); await page.mouse.up(); await sl(900); });
  await step('Supply ▾', async (page) => named(page, '.cmdbar summary', /^Supply ▾/));
  await step('Load 2♣ (C1)', async (page) => named(page, '.cmdbar button', /^Load 2 Supply from 2♣ \(C1\)/));
  await step('Move to R2C1 (funded, joins your Pawn)', async (page) => { await sl(600); await named(page, '.cmdbar .movelist button', /to R2C1: needs 1/); await sl(800); });
  await step('Ready', async (page) => { await named(page, '#matchbar .ready-big', /^Ready/); await page.waitForFunction(() => { const a = window.__versus; return a.state.tick >= 2 && !a.playback && !a.resolving; }, { timeout: 30000 }); await sl(600); });
  await step('Inspect (F) the merged party', async (page) => { await page.keyboard.press('f'); await sl(2200); });
  await step('hover an Archer: its breakdown expands', async (page) => { const id = await page.evaluate(() => Object.values(window.__versus.state.parties['A.mount.C1'].slots).find((x) => x && window.__versus.state.members[x].archetype === 'archer')); const p = await page.evaluate((id) => { const a = window.__versus, v = a.view.sprites.get(id).position.clone(); v.y += 0.5; const q = v.project(a.engine.camera), r = a.engine.renderer.domElement.getBoundingClientRect(); return { x: r.left + (q.x + 1) / 2 * r.width, y: r.top + (1 - q.y) / 2 * r.height }; }, id); await move(page, p); await sl(1800); });
  await step('orbit 360° (Q ×8)', async (page) => { await page.mouse.move(640, 60); for (let i = 0; i < 8; i++) { await page.keyboard.press('q'); await sl(800); } });
  await step('Return (R)', async (page) => { await page.keyboard.press('r'); await sl(1500); });
  await step('another command: Supply ▾ on the same party', async (page) => { await named(page, '.cmdbar summary', /^Supply ▾/); await sl(1200); });
});
const c2 = await record('journey-terrain', 'autostart=1&fixture=terrain&a=human&b=human', async (step) => {
  await step('select A.hill (raised ground) and Inspect', async (page) => { const p = await at(page, { kind: 'party', id: 'A.hill' }); await move(page, { x: p.x, y: p.y + 30 }); await page.mouse.down(); await page.mouse.up(); await sl(500); await page.keyboard.press('f'); await sl(2200); });
  await step('orbit half a turn', async (page) => { await page.mouse.move(640, 60); for (let i = 0; i < 4; i++) { await page.keyboard.press('q'); await sl(900); } });
  await step('Home, then the roofed tunnel party: no x-ray', async (page) => { await page.keyboard.press('Home'); await sl(1000); await page.evaluate(() => { const a = window.__versus; a.selected = { kind: 'party', id: 'B.tunnel' }; a._renderAll(); }); await page.keyboard.press('f'); await sl(2200); });
  await step('open layer −2: the members can be read; the surface dressing steps aside', async (page) => { await named(page, '.layer-rail button', /^[−-]2/); await sl(2000); });
  await step('All layers, Return', async (page) => { await named(page, '.layer-rail button', /^All$/); await sl(800); await page.keyboard.press('r'); await sl(1400); });
});
await browser.close();
fs.writeFileSync(path.join(out, 'journey-log.json'), JSON.stringify({ clips: { opening: c1, terrain: c2 }, steps: log }, null, 1));
console.log(JSON.stringify({ opening: c1, terrain: c2 }));
