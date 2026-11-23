#!/usr/bin/env node
/**
 * Scripted browser journeys for design-review evidence (docs/reviews). Drives the running dev
 * server (`npm run dev`, 127.0.0.1 only) in headless Chrome with real pointer and keyboard input,
 * records the plan / Ready / selection state the interface exposes on `window.__versus`, and saves
 * screenshots. It reads the app; it never edits rules state.
 *
 *   node tools/hapa/ui-journeys.mjs --out docs/reviews/evidence/2026-11-22/run [--journeys ux01,ux02,ux03] [--label before]
 *
 * Needs puppeteer-core (not a dependency of this repo): set PUPPETEER_CORE to its package folder,
 * or install it locally. CHROME_PATH overrides the Chrome location. Viewport 1600×1000 at DPR 1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? [...a, [v.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]]] : a), []));
const out = path.resolve(String(args.out ?? 'ui-journeys-out'));
const label = String(args.label ?? 'run');
const base = String(args.base ?? 'http://127.0.0.1:5199');
const want = new Set(String(args.journeys ?? 'ux01,ux02,ux03,ux04').split(','));
const W = 1600, H = 1000;

const pcPath = process.env.PUPPETEER_CORE;
const puppeteer = (await import(pcPath ? pathToFileURL(path.join(pcPath, 'lib/puppeteer/puppeteer-core.js')).href : 'puppeteer-core')).default;
const executablePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
fs.mkdirSync(out, { recursive: true });

const browser = await puppeteer.launch({ executablePath, headless: 'new', args: [`--window-size=${W},${H}`, '--ignore-gpu-blocklist', '--enable-webgl', '--use-angle=metal', '--no-first-run', '--mute-audio'], defaultViewport: { width: W, height: H, deviceScaleFactor: 1 } });
const report = { label, base, viewport: { width: W, height: H, dpr: 1 }, chrome: await browser.version(), journeys: {} };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(query) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e?.message ?? e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}/versus.html?${query}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.__versus?.session && window.__versus.view, { timeout: 30000 });
  await sleep(1200);
  page.errors = errors;
  return page;
}
const shot = async (page, name) => { const f = `${label}-${name}.png`; await page.mouse.move(W - 4, H / 2); await sleep(700); await page.screenshot({ path: path.join(out, f) }); return f; };
/** What the interface currently holds about agreement (plans, revisions, Ready pairs, phase). */
const agreement = (page) => page.evaluate(() => {
  const a = window.__versus;
  return { tick: a.state.tick, phase: a.state.phase, viewSeat: a.viewSeat, rev: { ...a.rev }, ready: JSON.parse(JSON.stringify(a.ready)), plans: { A: a.plans.A.map((c) => `${c.type}:${c.cardId ?? c.partyId}`), B: a.plans.B.map((c) => `${c.type}:${c.cardId ?? c.partyId}`) }, playback: !!a.playback, pendingChoice: a.pendingChoice ? { seat: a.pendingChoice.req.seat, choiceId: a.pendingChoice.req.choiceId } : null, replayTicks: a.session.replay.ticks.length, events: a.session.events.length, readyBig: document.querySelector('.ready-big')?.innerText.replace(/\s+/g, ' ').trim() ?? null, planHead: [...document.querySelectorAll('.planbox .phead')].map((e) => e.innerText.replace(/\s+/g, ' ').trim()) };
});
const key = async (page, k) => { await page.keyboard.press(k); await sleep(120); };
const clickSel = async (page, sel) => { const el = await page.$(sel); if (!el) return false; await el.click(); await sleep(250); return true; };
/** Screen position of a member's body or a world point. */
const screenOf = (page, memberId, lift = 0.45) => page.evaluate((id, lift) => {
  const a = window.__versus, spr = a.view.sprites.get(id);
  const v = spr.position.clone(); v.y += lift;
  const p = v.project(a.engine.camera), r = a.engine.renderer.domElement.getBoundingClientRect();
  return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
}, memberId, lift);
/** Screen position of a territory's center on the ground plane (y = 0). */
const screenOfTerritory = (page, column, row) => page.evaluate((column, row) => {
  const a = window.__versus, c = a.ctx.geo.center(column, row), v = a.view.toWorld(c.x, c.y);
  const p = v.project(a.engine.camera), r = a.engine.renderer.domElement.getBoundingClientRect();
  return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
}, column, row);
const clickAt = async (page, p, button = 'left') => { await page.mouse.move(p.x, p.y); await page.mouse.down({ button }); await page.mouse.up({ button }); await sleep(300); };
const selection = (page) => page.evaluate(() => { const a = window.__versus, s = a.selected; if (!s) return null; const p = s.kind === 'party' ? a.state.parties[s.id] : null; return { ...s, event: undefined, band: p?.band ?? null, mode: p?.movementMode ?? null, layer: a.view.terrain.cutaway, selectRingY: a.view.selectRing.visible ? +a.view.selectRing.position.y.toFixed(2) : null, membersY: p ? +a.view.sprites.get(Object.values(p.slots).find(Boolean)).position.y.toFixed(2) : null, candidates: document.querySelector('.pick-list') ? [...document.querySelectorAll('.pick-list button')].map((b) => b.innerText.replace(/\s+/g, ' ').trim()) : null }; });

// --- UX-01: a frozen own plan stays frozen after the opponent revises (hotseat) -----------------
if (want.has('ux01')) {
  const page = await open('autostart=1&a=human&b=human&seed=1');
  const j = { steps: [] };
  const step = async (name, extra = {}) => j.steps.push({ name, ...(await agreement(page)), ...extra });
  await step('opening');
  await key(page, '1'); await key(page, 'b');
  await step('A planned a Burn (C1)');
  j.shots = [await shot(page, 'ux01-1-A-planned')];
  await clickSel(page, '.ready-big');
  await step('A pressed Ready');
  await key(page, '1'); await key(page, 'b');
  await step('B planned a Burn (C1)');
  await clickSel(page, '.ready-big');
  await step('B pressed Ready; the view returns to A (stale acknowledgment)');
  j.shots.push(await shot(page, 'ux01-2-A-stale'));
  // attempts to change A's frozen plan through every affordance
  const x = await page.$('.planbox.a button.x');
  j.deleteControlVisible = !!x;
  if (x) { await x.click(); await sleep(250); }
  await step('A tried the × delete control on its own order');
  await key(page, '9'); await key(page, 'b');
  await step('A tried to add a Burn (9, B keys)');
  const tile = await page.$('#ownhand .tile:not(.empty):not(.planned)');
  const pool = await page.$('#resources');
  if (tile && pool) {
    const t = await tile.boundingBox(), p = await pool.boundingBox();
    await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2); await page.mouse.down();
    for (let i = 1; i <= 12; i++) { await page.mouse.move(t.x + t.width / 2 + ((p.x + p.width / 2) - (t.x + t.width / 2)) * i / 12, t.y + t.height / 2 + ((p.y + p.height / 2) - (t.y + t.height / 2)) * i / 12); await sleep(16); }
    await page.mouse.up(); await sleep(600);
  }
  await step('A tried to drag a hand card onto the Mana pool (Burn)');
  j.shots.push(await shot(page, 'ux01-3-A-after-attempts'));
  await clickSel(page, '.ready-big');
  await sleep(2500);
  await step('A acknowledged the updated pair; the Tick resolved');
  j.errors = page.errors;
  report.journeys.ux01 = j;
  await page.close();
}

// --- UX-02: the Ready shortcut during a human response window -----------------------------------
if (want.has('ux02')) {
  const page = await open('autostart=1&fixture=response&a=human&b=human');
  const j = { steps: [] };
  const step = async (name, extra = {}) => j.steps.push({ name, ...(await agreement(page)), ...extra });
  await step('opening (fixture response, Tick 9)');
  await key(page, '2'); await key(page, 'c');
  await clickAt(page, await screenOf(page, 'A.c.s5'));
  await clickAt(page, await screenOf(page, 'B.c.s2'));
  await step('A planned Ember Strike at B\'s Swordsman');
  await clickSel(page, '.ready-big');
  await clickSel(page, '.ready-big');
  await sleep(600);
  await step('both Ready: the response window opens for B');
  j.shots = [await shot(page, 'ux02-1-response-window')];
  const sameTickBefore = await page.evaluate(() => window.__versus.state.tick);
  for (let i = 0; i < 5; i++) { await page.keyboard.down('Meta'); await page.keyboard.press('Enter'); await page.keyboard.up('Meta'); await page.keyboard.down('Control'); await page.keyboard.press('Enter'); await page.keyboard.up('Control'); await sleep(150); }
  await sleep(2500);
  await step('B pressed Ctrl+Enter and Cmd+Enter five times each during the window', { tickBefore: sameTickBefore });
  j.shots.push(await shot(page, 'ux02-2-after-shortcut'));
  const pass = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find((b) => /^Pass/.test(b.innerText.trim())) ?? null);
  if (pass.asElement()) { await pass.asElement().click(); await sleep(400); }
  await step('B passed once');
  const pass2 = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find((b) => /^Pass/.test(b.innerText.trim())) ?? null);
  if (pass2.asElement()) { await pass2.asElement().click(); await sleep(400); }
  await sleep(3000);
  await step('A passed once; the Spell resolves and playback finishes');
  j.result = await page.evaluate(() => { const a = window.__versus; const ev = a.session.events; return { emberCastEvents: ev.filter((e) => e.type === 'ability_announced' || e.type === 'spell_announced').length, cardDamage: ev.filter((e) => e.type === 'card_damage').length, plansLocked: ev.filter((e) => e.type === 'plans_locked').length, tickStarted: ev.filter((e) => e.type === 'tick_started').map((e) => e.tick), replayTicks: a.session.replay.ticks.map((t) => t.tick), poolA: a.state.players.A.pool, tick: a.state.tick }; });
  j.shots.push(await shot(page, 'ux02-3-resolved'));
  j.errors = page.errors;
  report.journeys.ux02 = j;
  await page.close();
}

// --- UX-03: selection agrees with visible height -------------------------------------------------
if (want.has('ux03')) {
  const page = await open('autostart=1&fixture=stacked&a=human&b=human');
  const j = { cases: [] };
  const pick = async (name, memberId, opts = {}) => {
    await key(page, 'Escape');
    const at = await screenOf(page, memberId, opts.lift ?? 0.45);
    await clickAt(page, at);
    const sel = await selection(page);
    const camera = await page.evaluate(() => { const c = window.__versus.cam; return { yawDeg: Math.round(c.yaw * 180 / Math.PI), pitchDeg: Math.round(c.pitch * 180 / Math.PI), distance: +c.distance.toFixed(1) }; });
    j.cases.push({ name, clickedOn: memberId, at, selected: sel, camera });
    return sel;
  };
  await pick('home view · flyer body (A.fly, +3)', 'A.fly.s5');
  j.shots = [await shot(page, 'ux03-1-flyer-click-home')];
  await pick('home view · hilltop Archer (A.hill, +2)', 'A.hill.s8');
  j.shots.push(await shot(page, 'ux03-2-hill-click-home'));
  await pick('home view · open-ground Knight (B.walk, +1)', 'B.walk.s5');
  // the surface of R6C5, where the flyer's ground marker and the roofed tunnel's outline both lie
  await key(page, 'Escape');
  const ground = await screenOfTerritory(page, 5, 6);
  await clickAt(page, ground);
  const listed = await selection(page) ?? await page.evaluate(() => ({ candidates: document.querySelector('.pick-list') ? [...document.querySelectorAll('.pick-list button')].map((b) => b.innerText.replace(/\s+/g, ' ').trim()) : null }));
  j.cases.push({ name: 'home view · ground surface of R6C5 (flyer marker + tunnel outline)', clickedOn: 'territory R6C5 surface', at: ground, selected: listed });
  j.shots.push(await shot(page, 'ux03-2b-stacked-candidates'));
  const focusedAtOpen = await page.evaluate(() => document.activeElement?.closest('.pick-list') ? document.activeElement.innerText.replace(/\s+/g, ' ').trim() : null);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await sleep(700);
  j.cases.push({ name: 'keyboard: the list opened focused; ArrowDown then Enter chose the second candidate', focusedAtOpen, clickedOn: 'candidate 2 (keyboard)', selected: await selection(page) });
  j.shots.push(await shot(page, 'ux03-2c-chose-tunnel'));
  await page.evaluate(() => { const a = window.__versus; a.view.setLayer(null); a.view.sync(a.state); a._renderAll(); });
  await key(page, 'q'); await key(page, 'q'); await sleep(900);
  await pick('rotated 90° · flyer body', 'A.fly.s5');
  await pick('rotated 90° · hilltop Archer', 'A.hill.s8');
  j.shots.push(await shot(page, 'ux03-3-rotated'));
  await key(page, 'Home'); await sleep(900);
  await key(page, 'v'); await sleep(900);
  await pick('tactical · flyer over tunnel (same territory)', 'A.fly.s5');
  j.shots.push(await shot(page, 'ux03-4-tactical-stacked'));
  await key(page, 'Escape'); await key(page, 'v'); await sleep(900);
  // layer filter: show only band +3; the tunnel party below must not win a click over its territory
  await page.evaluate(() => { const a = window.__versus; a.view.setLayer(3); a.view.sync(a.state); a._renderAll(); });
  await pick('layer +3 only · click the tunnel party\'s position', 'B.tunnel.s5', { lift: 0 });
  await page.evaluate(() => { const a = window.__versus; a.view.setLayer(-2); a.view.sync(a.state); a._renderAll(); });
  await pick('layer −2 only · tunnel Pikeman', 'B.tunnel.s2');
  j.shots.push(await shot(page, 'ux03-5-layer-minus2'));
  await page.evaluate(() => { const a = window.__versus; a.view.setLayer(null); a.view.sync(a.state); a._renderAll(); });
  j.errors = page.errors;
  report.journeys.ux03 = j;
  await page.close();
}

// --- UX-04: decorative scenery must not hide the excavation volume ------------------------------
if (want.has('ux04')) {
  const page = await open('autostart=1&fixture=stacked&a=human&b=human');
  await sleep(1500); // scenery loads asynchronously
  const j = { cases: [] };
  for (const [band, pid] of [[-2, 'B.tunnel'], [-3, 'B.deep']]) {
    for (const scenery of [true, false]) {
      const r = await page.evaluate(async (band, pid, scenery) => {
        const a = window.__versus, THREE = a.view.root.parent.constructor; // not used; THREE comes from the page below
        const { stateFingerprint } = await import('/src/hapa/rules/state.js');
        const before = stateFingerprint(a.state);
        a.view.setLayer(band); a.view.sync(a.state); a._renderAll();
        const P = a.state.parties[pid];
        a.cam.focusOn(a.view.toWorld(P.x, P.y).setY(a.view.partyY(P)));
        if (a.scenery) a.scenery.group.visible = scenery;
        await new Promise((res) => setTimeout(res, 1200));
        // line of sight from the camera to points on each member's sprite, against the decorative meshes
        const cam = a.engine.camera, ray = new (a.raycaster.constructor)();
        const decor = []; a.scenery?.group.traverse((o) => { if (o.isMesh && o.visible && a.scenery.group.visible) decor.push(o); });
        let pts = 0, hidden = 0;
        for (const id of Object.values(P.slots).filter(Boolean)) {
          const spr = a.view.sprites.get(id);
          for (const lift of [0.1, 0.45, 0.8]) {
            const target = spr.position.clone(); target.y += lift;
            const dir = target.clone().sub(cam.position); const dist = dir.length(); dir.normalize();
            ray.set(cam.position, dir); ray.far = dist - 0.01;
            pts++; if (ray.intersectObjects(decor, false).length) hidden++;
          }
        }
        const after = stateFingerprint(a.state);
        return { band, party: pid, scenery, points: pts, hiddenBehindScenery: hidden, decorMeshes: decor.length, fingerprintUnchanged: before === after };
      }, band, pid, scenery);
      r.shot = await shot(page, `ux04-band${band}-scenery-${scenery ? 'on' : 'off'}`);
      j.cases.push(r);
    }
  }
  await page.evaluate(() => { const a = window.__versus; if (a.scenery) a.scenery.group.visible = true; a.view.setLayer(null); a.view.sync(a.state); });
  j.errors = page.errors;
  report.journeys.ux04 = j;
  await page.close();
}

await browser.close();
fs.writeFileSync(path.join(out, `${label}-report.json`), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
