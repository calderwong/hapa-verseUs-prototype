#!/usr/bin/env node
/**
 * Response 07 before/after measurement on one bounded route (assignment 07 §5): the response 06
 * route (select, F, orbit) plus an open member explanation through a full orbit, which exercises the
 * label signature/cache and the measured placement. Headless Chrome on this machine; frame intervals
 * are vsync-capped (60 Hz), not a capacity measure; CPU comes from Performance.getMetrics deltas; no
 * GPU timer or full-scene draw-call count is available (post-processing resets renderer.info).
 *   PUPPETEER_CORE=… node perf-07.mjs <base url> <label> <out.json>
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
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
const scene = () => page.evaluate(() => { const r = window.__versus.engine.renderer; return { geometries: r.info.memory.geometries, textures: r.info.memory.textures, dom: document.getElementsByTagName('*').length }; });
const cpu = async (fn) => { const m0 = await metrics(); await fn(); const m1 = await metrics(); const d = (k) => +((m1[k] - m0[k]) * 1000).toFixed(1); return { script: d('ScriptDuration'), layout: d('LayoutDuration'), style: d('RecalcStyleDuration'), task: d('TaskDuration'), layoutCount: m1.LayoutCount - m0.LayoutCount, styleCount: m1.RecalcStyleCount - m0.RecalcStyleCount }; };
const orbit = async () => { for (let i = 0; i < 8; i++) { await page.keyboard.press('q'); await sl(500); } };
const out = { label, base, chrome: await browser.version(), os: `${os.type()} ${os.release()} ${os.arch()}`, viewport: '1280x720@1', textScale: '100% (browser default 16 px)', camera: 'Home, then F on A.mount.C1', drawCalls: 'unavailable (post-processing resets renderer.info to its last pass)' };
out.home = { frames: await frames(), scene: await scene() };
const p = await page.evaluate(() => { const a = window.__versus, c = a._screenAnchor({ kind: 'party', id: 'A.mount.C1' }), r = a.el.world.getBoundingClientRect(); return { x: r.left + c.x, y: r.top + c.y + 30 }; });
await page.mouse.move(p.x, p.y); await sl(300);
const t0 = Date.now(); await page.mouse.down(); await page.mouse.up();
await page.waitForFunction(() => document.querySelector('.cmdbar:not([hidden])') || document.querySelector('.peek.pinned'), { timeout: 5000 });
out.selectFeedbackMs = Date.now() - t0;
await sl(400);
const z = page.evaluate(() => new Promise((res) => { const t = []; let last = performance.now(), first = null; const t0 = performance.now(); const tick = (x) => { t.push(x - last); last = x; if (first === null && document.querySelector('.mlabel:not([hidden])')) first = x - t0; if (x - t0 < 2500) requestAnimationFrame(tick); else res({ maxFrame: +Math.max(...t.slice(1)).toFixed(1), firstLabelMs: first === null ? null : Math.round(first) }); }; requestAnimationFrame(tick); }));
await page.keyboard.press('f');
out.zoomEntry = await z;
out.close = { frames: await frames(), scene: await scene() };
out.orbitCpuMs = await cpu(orbit);
// one member open (hover its body), then a full orbit with the explanation open
const id = await page.evaluate(() => Object.values(window.__versus.state.parties['A.mount.C1'].slots).find((x) => x && window.__versus.state.members[x].isCenter));
const sp = await page.evaluate((id) => { const a = window.__versus, v = a.view.sprites.get(id).position.clone(); v.y += 0.5; const q = v.project(a.engine.camera), r = a.engine.renderer.domElement.getBoundingClientRect(); return { x: r.left + (q.x + 1) / 2 * r.width, y: r.top + (1 - q.y) / 2 * r.height }; }, id);
await page.mouse.move(sp.x, sp.y, { steps: 4 }); await sl(800);
out.memberOpen = await page.evaluate(() => ({ panel: !!document.querySelector('.mreading:not([hidden])'), expandedLabel: !!document.querySelector('.mlabel.expanded:not([hidden])') }));
out.openIdleCpuMs = await cpu(() => sl(3000));
out.openOrbitCpuMs = await cpu(orbit);
out.afterOrbit = { scene: await scene() };
await browser.close();
fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out));
