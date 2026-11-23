#!/usr/bin/env node
/**
 * Response 07 same-state captures (assignment 07 §4): one build, identical camera settings per
 * subject, without and with one member's detail open (pointer hover on the same body), plus 45° and
 * 135° bearings. Subjects: the opening's four-member Bishop (A.mount.C3) and the terrain fixture's
 * hill party (A.hill, labelled fixture). 1280×720 @1, browser default text size.
 *   PUPPETEER_CORE=… node states-07.mjs <base url> <label> <outDir>
 */
import path from 'node:path'; import fs from 'node:fs'; import { pathToFileURL } from 'node:url';
const [base, label, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const puppeteer = (await import(pathToFileURL(path.join(process.env.PUPPETEER_CORE, 'lib/puppeteer/puppeteer-core.js')).href)).default;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--mute-audio'] });
const sl = (ms) => new Promise((r) => setTimeout(r, ms));
for (const [q, party, role] of [['autostart=1&a=human&b=bot&seed=1', 'A.mount.C3', 'mage'], ['autostart=1&fixture=terrain&a=human&b=human', 'A.hill', 'archer']]) {
  const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${base}/versus.html?${q}`, { waitUntil: 'networkidle0' }); await page.waitForFunction(() => window.__versus?.session); await sl(1800);
  const tag = party.replace('.', '-');
  // identical camera on both builds: home yaw, pitch 50°, focus at the party's real height, 0.30 × board size
  const pose = async (yawDeg) => { await page.evaluate((id, yawDeg) => { const a = window.__versus, P = a.state.parties[id]; a.selected = { kind: 'party', id }; a._renderAll(); a.cam.goal.yaw = (a.cam.homeYaw ?? 0) + yawDeg * Math.PI / 180; a.cam.goal.pitch = 50 * Math.PI / 180; a.cam.goal.focus.copy(a.view.toWorld(P.x, P.y).setY(a.view.partyY(P) + 0.8)); a.cam.goal.distance = a.view.size * 0.30; a.cam.atHome = false; a.inspectParty = { partyId: id, via: 'focus', since: performance.now() }; }, party, yawDeg); await sl(2400); };
  const hoverMember = async () => { const p = await page.evaluate((id, role) => { const a = window.__versus, m = Object.values(a.state.parties[id].slots).find((x) => x && a.state.members[x].archetype === role); const v = a.view.sprites.get(m).position.clone(); v.y += 0.5; const q = v.project(a.engine.camera), r = a.engine.renderer.domElement.getBoundingClientRect(); return { x: r.left + (q.x + 1) / 2 * r.width, y: r.top + (1 - q.y) / 2 * r.height }; }, party, role); await page.mouse.move(p.x, p.y, { steps: 4 }); await sl(900); };
  await pose(0); await page.mouse.move(4, 4); await sl(500);
  await page.screenshot({ path: path.join(out, `${label}-${tag}-1-close.png`) });
  await hoverMember();
  await page.screenshot({ path: path.join(out, `${label}-${tag}-2-close-member-open.png`) });
  await page.mouse.move(4, 4); await pose(45); await page.mouse.move(4, 4); await sl(400);
  await page.screenshot({ path: path.join(out, `${label}-${tag}-3-bearing45.png`) });
  await pose(135); await page.mouse.move(4, 4); await sl(400);
  await page.screenshot({ path: path.join(out, `${label}-${tag}-4-bearing135.png`) });
  await page.close();
}
await browser.close();
