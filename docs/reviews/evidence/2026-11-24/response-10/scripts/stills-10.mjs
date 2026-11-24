#!/usr/bin/env node
// Response 10 stills (R8-06), headless Chrome at 1280×720 @1, home camera, dev server 127.0.0.1:5199.
//   PUPPETEER_CORE=… node docs/reviews/evidence/2026-11-24/response-10/scripts/stills-10.mjs <outDir>
// 1. A Knight order with a chosen arrival facing: the toast against B's basin counter (rect overlap and stacking measured).
// 2. The labelled response fixture after a positive planned burn: the navigator's Fire Pit row beside the basin counter.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const out = path.resolve(process.argv[2] ?? 'stills-10'); fs.mkdirSync(out, { recursive: true });
const puppeteer = (await import(pathToFileURL(path.join(process.env.PUPPETEER_CORE, 'lib/puppeteer/puppeteer-core.js')).href)).default;
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--mute-audio'] });
const sl = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
const log = {};
await page.goto('http://127.0.0.1:5199/versus.html?autostart=1&a=human&b=bot&seed=1', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__versus?.session); await sl(1200);
await page.evaluate(async () => { const a = window.__versus; a.speed = 4; a._pressReady(); });
await page.waitForFunction(() => window.__versus.state.tick >= 2 && !window.__versus.playback && !window.__versus.resolving, { timeout: 30000 });
const p = await page.evaluate(() => { const a = window.__versus; for (const id of Object.values(a.state.players.A.bank.minor).filter(Boolean).slice(0, 2)) a._addCommand('A', { type: 'load_supply', cardId: id, partyId: 'A.mount.C2' }); a.selected = { kind: 'party', id: 'A.mount.C2' }; a._renderAll(); const c = a.ctx.geo.center(3, 3), v = a.view.toWorld(c.x, c.y).project(a.engine.camera), r = a.engine.renderer.domElement.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height, profile: a.ctx.profile.id }; });
await page.mouse.move(p.x, p.y); await page.mouse.down({ button: 'right' }); await page.mouse.up({ button: 'right' }); await sl(300);
await page.keyboard.down('Shift'); await page.mouse.down({ button: 'right' }); await page.mouse.up({ button: 'right' }); await page.keyboard.up('Shift'); await sl(250);
await page.mouse.move(640, 300);
log.toast = await page.evaluate(() => { const t = document.querySelector('.toast'), rects = [...document.querySelectorAll('.basin-counter')].map((b) => b.getBoundingClientRect()), tr = t.getBoundingClientRect(); return { profile: window.__versus.ctx.profile.id, text: t.textContent, zToast: getComputedStyle(t).zIndex, zCounter: getComputedStyle(document.querySelector('.basin-counter')).zIndex, overlapsCounter: rects.some((br) => tr.right > br.left && tr.left < br.right && tr.bottom > br.top && tr.top < br.bottom), toastRect: [tr.left, tr.top, tr.width, tr.height].map(Math.round) }; });
await page.screenshot({ path: path.join(out, '01-knight-arrival-toast.jpg'), type: 'jpeg', quality: 80 });
await page.goto('http://127.0.0.1:5199/versus.html?autostart=1&fixture=response&a=human&b=bot', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__versus?.session); await sl(1200);
log.mana = await page.evaluate(async () => { const a = window.__versus; a._toggleRoster(true); a._addCommand('A', { type: 'burn', cardId: 'A.red' }); await new Promise((r) => setTimeout(r, 400)); const row = [...document.querySelectorAll('#roster *')].map((b) => b.getAttribute?.('aria-label') ?? '').find((t) => /^A's Fire Pit/.test(t)); return { navigator: row, basin: a.el.basins.A.getAttribute('aria-label'), authoritativePool: a.state.players.A.pool }; });
await sl(600);
await page.screenshot({ path: path.join(out, '02-navigator-fire-pit-after-burn.jpg'), type: 'jpeg', quality: 80 });
fs.writeFileSync(path.join(out, 'stills-log.json'), JSON.stringify(log, null, 2));
console.log(JSON.stringify(log));
await browser.close();
