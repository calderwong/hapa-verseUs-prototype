#!/usr/bin/env node
// Response 07: long animation frames (> 20 ms) in the 2.5 s after each of three successive Inspects
// (F) of the same party, then Return (R). PUPPETEER_CORE=… node inspect-frames-07.mjs [base url]
import path from 'node:path'; import { pathToFileURL } from 'node:url';
const puppeteer = (await import(pathToFileURL(path.join(process.env.PUPPETEER_CORE, 'lib/puppeteer/puppeteer-core.js')).href)).default;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--mute-audio'] });
const sl = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720 });
await page.goto(`${process.argv[2] ?? 'http://127.0.0.1:5199'}/versus.html?autostart=1&a=human&b=bot&seed=1`, { waitUntil: 'networkidle0' }); await page.waitForFunction(() => window.__versus?.session); await sl(2000);
await page.evaluate(() => { const a = window.__versus; a.selected = { kind: 'party', id: 'A.mount.C1' }; a._renderAll(); });
const watch = () => page.evaluate(() => new Promise((res) => { const t = []; let last = performance.now(); const t0 = last; const tick = (x) => { t.push([Math.round(x - t0), +(x - last).toFixed(1)]); last = x; if (x - t0 < 2500) requestAnimationFrame(tick); else res(t.filter(([, d]) => d > 20)); }; requestAnimationFrame(tick); }));
for (let i = 0; i < 3; i++) { const w = watch(); await page.keyboard.press('f'); console.log('F', i, JSON.stringify(await w)); await page.keyboard.press('r'); await sl(1500); }
await browser.close();
