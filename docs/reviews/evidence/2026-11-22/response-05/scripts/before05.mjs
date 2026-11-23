import path from 'node:path'; import { pathToFileURL } from 'node:url';
const out = process.argv[2];
const puppeteer = (await import(pathToFileURL(path.join(process.env.PUPPETEER_CORE, 'lib/puppeteer/puppeteer-core.js')).href)).default;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--mute-audio'] });
const sl = (ms) => new Promise((r) => setTimeout(r, ms));
for (const [w, h] of [[1280, 720], [1600, 1000]]) {
  const page = await browser.newPage(); await page.setViewport({ width: w, height: h });
  await page.goto('http://127.0.0.1:5199/versus.html?autostart=1&a=human&b=human&seed=1&profile=hapa_open_10x9_v3_01', { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.__versus?.session); await sl(1200);
  const shot = async (n) => { await page.mouse.move(2, 2); await sl(500); await page.screenshot({ path: path.join(out, `before-${n}-${w}x${h}.png`) }); };
  await shot('1-quiet');
  await page.evaluate(() => { const a = window.__versus; a.selected = { kind: 'card', id: a.state.players.B.bank.minor['9'] }; a._renderAll(); });
  await shot('2-card-opponent');
  await page.evaluate(() => { const a = window.__versus; a.selected = { kind: 'party', id: 'A.mount.C1' }; a._renderAll(); });
  await shot('3-party');
  await page.evaluate(() => { const a = window.__versus; const c = a.state.players.A.bank.minor['1']; a._addCommand('A', { type: 'load_supply', cardId: c, partyId: 'A.mount.C1' }); a._addCommand('A', { type: 'set_destination', partyId: 'A.mount.C1', target: { column: 1, row: 3 } }); a._addCommand('A', { type: 'burn', cardId: a.state.players.A.bank.minor['9'] }); a.selected = null; a._renderAll(); });
  await shot('4-destination-and-burn-planned');
  await page.close();
}
await browser.close();
