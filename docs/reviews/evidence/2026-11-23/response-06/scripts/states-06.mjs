#!/usr/bin/env node
/** Same-state captures on one build: default-zoom selection, close zoom on that party, terrain hill. */
import path from 'node:path'; import { pathToFileURL } from 'node:url';
const [base, label, out] = process.argv.slice(2);
const puppeteer = (await import(pathToFileURL(path.join(process.env.PUPPETEER_CORE, 'lib/puppeteer/puppeteer-core.js')).href)).default;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--mute-audio'] });
const sl = (ms) => new Promise((r) => setTimeout(r, ms));
for (const [q, party] of [['autostart=1&a=human&b=bot&seed=1', 'A.mount.C3'], ['autostart=1&fixture=terrain&a=human&b=human', 'A.hill']]) {
  const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${base}/versus.html?${q}`, { waitUntil: 'networkidle0' }); await page.waitForFunction(() => window.__versus?.session); await sl(1800);
  const tag = party.replace('.', '-');
  const p = await page.evaluate((id) => { const a = window.__versus, c = a._screenAnchor({ kind: 'party', id }), r = a.el.world.getBoundingClientRect(); return { x: r.left + c.x, y: r.top + c.y + 30 }; }, party);
  await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.up(); await sl(900);
  await page.mouse.move(4, 4); await sl(500);
  await page.screenshot({ path: path.join(out, `${label}-${tag}-1-selected-default-zoom.png`) });
  // the same close camera on both builds: focus the party at its height, 0.32 × board size
  await page.evaluate((id) => { const a = window.__versus, P = a.state.parties[id]; a.cam.goal.yaw = a.cam.homeYaw ?? a.cam.goal.yaw; a.cam.focusOn(a.view.toWorld(P.x, P.y).setY(a.view.partyY(P) + 0.8)); a.cam.goal.distance = a.view.size * 0.32; if (a.inspectParty !== undefined) a.inspectParty = { partyId: id, via: 'focus', since: performance.now() }; }, party);
  await sl(2400);
  await page.screenshot({ path: path.join(out, `${label}-${tag}-2-close.png`) });
  await page.evaluate(() => window.__versus.cam.rotate(135)); await sl(1600);
  await page.screenshot({ path: path.join(out, `${label}-${tag}-3-close-orbit135.png`) });
  await page.close();
}
await browser.close();
