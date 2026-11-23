#!/usr/bin/env node
/**
 * Response 06 before/after measurement on one route (assignment 06 §5). Headless Chrome on this
 * machine; frame intervals are vsync-capped (60 Hz) and are not a capacity measurement; CPU time
 * comes from Chrome's Performance.getMetrics deltas. No GPU timer is available headless.
 *   PUPPETEER_CORE=… node perf-06.mjs <base url> <label> <out.json>
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [base = 'http://127.0.0.1:5199', label = 'after', outFile = 'perf.json'] = process.argv.slice(2);
const puppeteer = (await import(pathToFileURL(path.join(process.env.PUPPETEER_CORE, 'lib/puppeteer/puppeteer-core.js')).href)).default;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--mute-audio'] });
const sl = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
await page.goto(`${base}/versus.html?autostart=1&a=human&b=bot&seed=1`, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__versus?.session); await sl(2000);
const cdp = await page.createCDPSession(); await cdp.send('Performance.enable');
const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
const frames = (n = 150) => page.evaluate((n) => new Promise((res) => { const t = []; let last = performance.now(); const tick = (x) => { t.push(x - last); last = x; if (t.length < n) requestAnimationFrame(tick); else { const s = t.slice(5).sort((a, b) => a - b); res({ median: +s[Math.floor(s.length / 2)].toFixed(1), p95: +s[Math.floor(s.length * 0.95)].toFixed(1), max: +s.at(-1).toFixed(1) }); } }; requestAnimationFrame(tick); }), n);
const scene = () => page.evaluate(() => { const r = window.__versus.engine.renderer; return { calls: r.info.render.calls, triangles: r.info.render.triangles, geometries: r.info.memory.geometries, textures: r.info.memory.textures, dom: document.getElementsByTagName('*').length }; });
const out = { label, base, chrome: await browser.version(), viewport: '1280x720@1' };
out.home = { frames: await frames(), scene: await scene() };
// input → feedback: click the C1 Castle
const p = await page.evaluate(() => { const a = window.__versus, c = a._screenAnchor({ kind: 'party', id: 'A.mount.C1' }), r = a.el.world.getBoundingClientRect(); return { x: r.left + c.x, y: r.top + c.y + 30 }; });
await page.mouse.move(p.x, p.y); await sl(300);
const t0 = Date.now(); await page.mouse.down(); await page.mouse.up();
await page.waitForFunction(() => document.querySelector('.cmdbar:not([hidden])') || document.querySelector('.peek.pinned'), { timeout: 5000 });
out.selectFeedbackMs = Date.now() - t0;
out.selectFeedback = await page.evaluate(() => (document.querySelector('.cmdbar:not([hidden])') ? 'command bar' : 'pinned party view'));
// zoom entry: F, stall while the camera moves, time to the first member label (after only)
await sl(400);
const z = page.evaluate(() => new Promise((res) => { const t = []; let last = performance.now(), first = null; const t0 = performance.now(); const tick = (x) => { t.push(x - last); last = x; if (first === null && document.querySelector('.mlabel:not([hidden])')) first = x - t0; if (x - t0 < 2500) requestAnimationFrame(tick); else res({ maxFrame: +Math.max(...t.slice(1)).toFixed(1), firstLabelMs: first === null ? null : Math.round(first) }); }; requestAnimationFrame(tick); }));
await page.keyboard.press('f');
out.zoomEntry = await z;
out.close = { frames: await frames(), scene: await scene() };
// CPU over a full orbit at the close view
const m0 = await metrics();
for (let i = 0; i < 8; i++) { await page.keyboard.press('q'); await sl(500); }
const m1 = await metrics();
const d = (k) => +((m1[k] - m0[k]) * 1000).toFixed(1);
out.orbitCpuMs = { script: d('ScriptDuration'), layout: d('LayoutDuration'), style: d('RecalcStyleDuration'), task: d('TaskDuration') };
out.afterOrbit = { scene: await scene() };
await browser.close();
fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out));
