import path from 'node:path'; import { pathToFileURL } from 'node:url';
const out = process.argv[2];
const puppeteer = (await import(pathToFileURL(path.join(process.env.PUPPETEER_CORE, 'lib/puppeteer/puppeteer-core.js')).href)).default;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--mute-audio'] });
const sl = (ms) => new Promise((r) => setTimeout(r, ms));
const proj = (page, sub) => page.evaluate((sub) => { const a = window.__versus; const c = a._screenAnchor(sub); const r = a.el.world.getBoundingClientRect(); return c && { x: r.left + c.x, y: r.top + c.y }; }, sub);
const tile = (page, id) => page.evaluate((id) => { const a = window.__versus; const t = [...a.view.cardTiles.values()].find((x) => x.userData.cardId === id); const p = t.position.clone().project(a.engine.camera), r = a.engine.renderer.domElement.getBoundingClientRect(); return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height }; }, id);
for (const [w, h] of [[1280, 720], [1600, 1000]]) {
  const page = await browser.newPage(); await page.setViewport({ width: w, height: h });
  await page.goto('http://127.0.0.1:5199/versus.html?autostart=1&a=human&b=human&seed=1', { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.__versus?.session); await sl(1500);
  const shot = async (n, move = true) => { if (move) { await page.mouse.move(2, 2); await sl(600); } await page.screenshot({ path: path.join(out, `after-${n}-${w}x${h}.png`) }); };
  await shot('1-quiet');
  const opp = await page.evaluate(() => window.__versus.state.players.B.bank.minor['9']);
  const t = await tile(page, opp); await page.mouse.move(t.x, t.y, { steps: 3 }); await sl(600); await shot('2-card-opponent-hover', false);
  await page.mouse.move(2, 2); await sl(700);
  const p = await proj(page, { kind: 'party', id: 'A.mount.C1' }); await page.mouse.move(p.x, p.y, { steps: 3 }); await sl(600); await shot('3-party-hover', false);
  await page.mouse.move(2, 2); await sl(700);
  await page.evaluate(() => { const a = window.__versus; const c = a.state.players.A.bank.minor['1']; a._addCommand('A', { type: 'load_supply', cardId: c, partyId: 'A.mount.C1' }); a._addCommand('A', { type: 'set_destination', partyId: 'A.mount.C1', target: { column: 1, row: 3 } }); a._addCommand('A', { type: 'burn', cardId: a.state.players.A.bank.minor['9'] }); a._renderAll(); });
  await shot('4-destination-and-burn-planned');
  await page.close();
}
// Fire Pit sequence (cards fixture): planned offering → mid-burn → basin after
const page = await browser.newPage(); await page.setViewport({ width: 1600, height: 1000 });
await page.goto('http://127.0.0.1:5199/versus.html?autostart=1&fixture=cards&a=human&b=human', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__versus?.session); await sl(1500);
await page.evaluate(() => { const a = window.__versus; a._addCommand('A', { type: 'burn', cardId: 'A.five' }); a.cam.focusOn(a.view.sites.anchor('A', 'pit').setY(0)); a.cam.goal.distance = a.view.size * 0.6; a._renderAll(); });
await sl(1500); await page.screenshot({ path: path.join(out, 'firepit-1-planned-offering.png') });
const b = await proj(page, { kind: 'basin', id: 'A' }); await page.mouse.move(b.x, b.y); await sl(600); await page.screenshot({ path: path.join(out, 'firepit-2-basin-projection.png') });
await page.mouse.move(2, 2);
await page.evaluate(() => { const a = window.__versus; a.speed = 0.25; a._pressReady(); setTimeout(() => a._pressReady(), 100); });
await page.waitForFunction(() => window.__versus.view.sites.effects.length >= 5, { timeout: 8000 }); await sl(330);
await page.screenshot({ path: path.join(out, 'firepit-3-accepted-burn-streams.png') });
await page.waitForFunction(() => !window.__versus.playback, { timeout: 15000 });
await page.evaluate(() => { const a = window.__versus; a.cam.focusOn(a.view.sites.anchor('A', 'pit').setY(0)); });
await sl(900); await page.screenshot({ path: path.join(out, 'firepit-4-next-tick-expired.png') });
await browser.close();
