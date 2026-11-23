import path from 'node:path'; import { pathToFileURL } from 'node:url';
const out = process.argv[2], base = process.argv[3] ?? 'http://127.0.0.1:5199';
const puppeteer = (await import(pathToFileURL(path.join(process.env.PUPPETEER_CORE, 'lib/puppeteer/puppeteer-core.js')).href)).default;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--mute-audio'] });
const page = await browser.newPage(); await page.setViewport({ width: 1600, height: 1000 });
await page.goto(`${base}/versus.html?autostart=1&fixture=terrain&a=human&b=bot`, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__versus?.session); await new Promise((r) => setTimeout(r, 1000));
const sl = (ms) => new Promise((r) => setTimeout(r, ms));
// pass until C3 is active, then order the descent through the labeled Move list
for (let i = 0; i < 6 && !(await page.evaluate(() => window.__versus.state.activeColumns.includes(3))); i++) { await page.evaluate(() => window.__versus._pressReady()); await page.waitForFunction(() => !window.__versus.playback && !window.__versus.resolving, { timeout: 20000 }); await sl(300); }
await page.evaluate(() => { const a = window.__versus; a.selected = { kind: 'party', id: 'A.hill' }; a._renderAll(); });
await page.evaluate(() => { const d = document.querySelector('#inspector details.movelist'); d.open = true; const b = [...d.querySelectorAll('button')].find((b) => /to R4C3/.test(b.getAttribute('aria-label') ?? '')); if (b) b.click(); else window.__versus._addCommand('A', { type: 'set_destination', partyId: 'A.hill', target: { column: 3, row: 4 } }); });
const res = [];
for (let t = 0; t < 3; t++) {
  const tick = await page.evaluate(() => window.__versus.state.tick);
  await page.evaluate(() => { const a = window.__versus; a.selected = null; a.speed = 0.5; a._renderAll(); a._pressReady(); });
  const samples = []; let shot = false;
  for (let i = 0; i < 400; i++) {
    const s = await page.evaluate(() => { const a = window.__versus, pb = a.playback; const mk = a.view.markers.get('A.hill'); return pb ? { k: +(pb.t / pb.duration).toFixed(3), y: +mk.position.y.toFixed(3) } : null; });
    if (s) { samples.push(s); if (!shot && s.k > 0.93 && s.y < 0.9 && s.y > 0.05) { await page.screenshot({ path: path.join(out, 'ramp-descent-mid.png') }); shot = true; } } else if (samples.length) break;
    await sl(15);
  }
  const ev = await page.evaluate((tk) => window.__versus.session.events.filter((e) => e.tick === tk && e.partyId === 'A.hill' && ['elevation_changed', 'region_entered', 'destination_reached'].includes(e.type)).map((e) => ({ type: e.type, quantum: e.quantum })), tick);
  res.push({ tick, events: ev, samples: samples.filter((_, i) => i % 6 === 0 || i === samples.length - 1) });
  await page.waitForFunction(() => !window.__versus.playback && !window.__versus.resolving, { timeout: 20000 });
  if (ev.some((e) => e.type === 'elevation_changed')) break;
}
console.log(JSON.stringify(res, null, 0));
await browser.close();
