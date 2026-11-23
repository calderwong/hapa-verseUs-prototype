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
const want = new Set(String(args.journeys ?? 'ux01,ux02,ux03,ux04,ux07,ux08,ux08b,ux09,ux10,ux14rm,ux06,ux14kb,hv41,ux12,ux11').split(','));
const W = 1600, H = 1000;

const pcPath = process.env.PUPPETEER_CORE;
const puppeteer = (await import(pcPath ? pathToFileURL(path.join(pcPath, 'lib/puppeteer/puppeteer-core.js')).href : 'puppeteer-core')).default;
const executablePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
fs.mkdirSync(out, { recursive: true });

const browser = await puppeteer.launch({ executablePath, headless: 'new', protocolTimeout: 90000, args: [`--window-size=${W},${H}`, '--ignore-gpu-blocklist', '--enable-webgl', '--use-angle=metal', '--no-first-run', '--mute-audio'], defaultViewport: { width: W, height: H, deviceScaleFactor: 1 } });
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
const shot = async (page, name) => { const f = `${label}-${name}.png`; await page.mouse.move(4, 4); await sleep(700); await page.screenshot({ path: path.join(out, f) }); return f; };
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

// --- UX-07: the home view frames the board and both banks in the available viewport --------------
if (want.has('ux07')) {
  const j = { cases: [] };
  for (const [vw, vh] of [[1600, 1000], [1280, 720], [1100, 900]]) {
    for (const seat of ['A', 'B']) {
      const page = await open(`autostart=1&a=${seat === 'A' ? 'human' : 'bot'}&b=${seat === 'B' ? 'human' : 'bot'}&seed=1`);
      await page.setViewport({ width: vw, height: vh, deviceScaleFactor: 1 });
      await sleep(1500);
      await page.evaluate(() => { window.__versus.cam.home(); });
      await sleep(1500);
      const m = await page.evaluate(() => {
        const a = window.__versus, v = a.view, cam = a.engine.camera, r = a.engine.renderer.domElement.getBoundingClientRect();
        const scr = (x, z) => { const p = new (cam.position.constructor)(x, 0, z).project(cam); return { x: (p.x + 1) / 2 * r.width, y: (1 - p.y) / 2 * r.height }; };
        const S = 1.5, w = v.w, h = v.h;
        const board = [scr(0, 0), scr(w * S, 0), scr(0, -h * S), scr(w * S, -h * S)];
        const bx = board.map((p) => p.x), by = board.map((p) => p.y);
        const area = (Math.max(...bx) - Math.min(...bx)) * (Math.max(...by) - Math.min(...by)) / (r.width * r.height);
        const inView = (p) => p.x >= 0 && p.x <= r.width && p.y >= 0 && p.y <= r.height;
        const tiles = [...v.cardTiles.values()].map((t) => scr(t.position.x, t.position.z));
        // territory width on screen, nearest home row vs farthest row (perspective crowding)
        const rowW = (row) => { const y = (4 * row - 2) * S; const p0 = scr(0, -y), p1 = scr(w * S, -y); return Math.hypot(p1.x - p0.x, p1.y - p0.y) / 9; };
        const near = a.viewSeat === 'A' ? 1 : v.rows, far = a.viewSeat === 'A' ? v.rows : 1;
        return { viewport: [Math.round(r.width), Math.round(r.height)], boardCornersInView: `${board.filter(inView).length}/4`, boardBBoxShare: +area.toFixed(3), bankTilesInView: `${tiles.filter(inView).length}/${tiles.length}`, nearRowTerritoryPx: +rowW(near).toFixed(1), farRowTerritoryPx: +rowW(far).toFixed(1), camera: { yawDeg: Math.round(a.cam.yaw * 180 / Math.PI), pitchDeg: Math.round(a.cam.pitch * 180 / Math.PI), distance: +a.cam.distance.toFixed(1) } };
      });
      m.seat = seat; m.window = [vw, vh];
      m.shot = await shot(page, `ux07-home-${seat}-${vw}x${vh}`);
      j.cases.push(m);
      await page.close();
    }
  }
  report.journeys.ux07 = j;
}

// --- UX-08: one Card anatomy — follow the same card through ribbon, inspector and drag -----------
if (want.has('ux08')) {
  const page = await open('autostart=1&a=human&b=bot&seed=1');
  const j = { steps: [] };
  for (let i = 0; i < 8; i++) { await page.keyboard.down('Control'); await page.keyboard.press('Enter'); await page.keyboard.up('Control'); await sleep(2600); }
  const pickCard = await page.evaluate(() => { // prefer a card with a local Tarot face
    const a = window.__versus, own = Object.entries(a.state.players.A.bank.minor).filter(([, id]) => id);
    const withArt = own.find(([, id]) => document.querySelector('#ownhand .face:not(.fallback)') && a.state.cards[id]);
    return { tick: a.state.tick, cards: own.map(([c, id]) => `${c}:${a.state.cards[id].rank}${a.state.cards[id].suit[0]}`), faces: document.querySelectorAll('#ownhand .face:not(.fallback)').length, fallbacks: document.querySelectorAll('#ownhand .face.fallback').length, overflowTags: document.querySelectorAll('.tile .more').length, oppAbilityLabels: document.querySelectorAll('#opphand .abil').length };
  });
  j.steps.push({ name: 'hand after 8 Ticks', ...pickCard });
  const tile = await page.$('#ownhand .tile:not(.empty)');
  if (tile) { await tile.click(); await sleep(500); }
  j.steps.push({ name: 'first own card selected', inspector: await page.evaluate(() => ({ face: !!document.querySelector('#inspector .inspect-face'), label: document.querySelector('#inspector .inspect-face')?.getAttribute('aria-label'), heading: document.querySelector('#inspector h3')?.innerText })) });
  j.shot = await shot(page, 'ux08-hand-and-inspector');
  j.errors = page.errors;
  report.journeys.ux08 = j;
  await page.close();
}

// --- UX-09: planned Supply vs resolved Supply — drop, rest, landing --------------------------------
if (want.has('ux09')) {
  const page = await open('autostart=1&a=human&b=bot&seed=1');
  const j = { steps: [] };
  await page.evaluate(() => { const a = window.__versus, P = a.state.parties['A.mount.C1']; a.cam.focusOn(a.view.toWorld(P.x, P.y).add({ x: 0, y: 0, z: 3 })); a.cam.goal.distance = a.view.size * 0.5; });
  await sleep(1500);
  const target = await page.evaluate(() => { const a = window.__versus, mk = a.view.markers.get('A.mount.C1'); const p = mk.position.clone().project(a.engine.camera), r = a.engine.renderer.domElement.getBoundingClientRect(); return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height }; });
  const tile = await (await page.$('#ownhand .tile:not(.empty)')).boundingBox();
  const from = { x: tile.x + tile.width / 2, y: tile.y + tile.height / 2 };
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  for (let i = 1; i <= 20; i++) { await page.mouse.move(from.x + (target.x - from.x) * i / 20, from.y + (target.y - from.y) * i / 20); await sleep(20); }
  await page.mouse.up();
  await sleep(450);
  const clip = await page.evaluate(() => { const r = document.getElementById('world').getBoundingClientRect(); return { x: r.x + r.width * 0.15, y: r.y + r.height * 0.2, width: r.width * 0.7, height: r.height * 0.8 }; });
  const cshot = async (name) => { const f = `${label}-${name}.png`; await page.screenshot({ path: path.join(out, f), clip }); return f; };
  const state = () => page.evaluate(() => { const a = window.__versus; return { tick: a.state.tick, planA: a.plans.A.map((c) => `${c.type}:${c.cardId}->${c.partyId ?? ''}`), tag: document.querySelector('#ownhand .plannedtag')?.innerText ?? null, planLinks: a.view.planLinks?.children.length ?? null, fx: a.view.fx.items.map((i) => i.kind), supplyA1: a.state.parties['A.mount.C1'].supply.reduce((n, x) => n + x.units, 0) / 1e6 }; });
  j.steps.push({ name: 'about 0.45 s after the drop (planning cue)', ...(await state()), shot: await cshot('ux09-1-drop') });
  await sleep(1500);
  j.steps.push({ name: 'at rest, still planning', ...(await state()), shot: await cshot('ux09-2-planned') });
  await page.keyboard.down('Control'); await page.keyboard.press('Enter'); await page.keyboard.up('Control');
  await page.waitForFunction(() => window.__versus.view.fx.items.some((i) => i.kind === 'supply'), { timeout: 8000 }).catch(() => {});
  await sleep(250);
  j.steps.push({ name: 'resolution: the Supply lands', ...(await state()), shot: await cshot('ux09-3-landing') });
  j.errors = page.errors;
  report.journeys.ux09 = j;
  await page.close();
}

// --- UX-08b: compact Mana never hides an overflow (labeled cards fixture) ----------------------
if (want.has('ux08b')) {
  const j = {};
  // Mana overflow: the labeled cards fixture holds 0-, 1-, 3- and 5-color cards
  const pc = await open('autostart=1&fixture=cards&a=human&b=human');
  j.overflow = await pc.evaluate(() => [...document.querySelectorAll('#ownhand .tile:not(.empty), #opphand .tile:not(.empty)')].map((t) => ({ ribbon: t.closest('#ownhand') ? 'own' : 'opp', label: t.querySelector('.tl')?.innerText.replace(/\s+/g, ' '), chips: t.querySelectorAll('.mchip').length, more: t.querySelector('.more')?.innerText ?? null, moreTitle: t.querySelector('.more')?.title ?? null, none: !!t.querySelector('.nomana') })));
  j.overflowShot = await shot(pc, 'ux08-mana-overflow');
  await pc.close();
  report.journeys.ux08b = j;
}

// --- UX-10: ownership quiet, selection strongest — a selected Castle among its neighbours ---------
if (want.has('ux10')) {
  const page = await open('autostart=1&a=human&b=bot&seed=1');
  const j = { shots: [] };
  await page.evaluate(() => { const a = window.__versus; a.selected = { kind: 'party', id: 'A.mount.C3' }; a._renderAll(); a._focusSelection(); });
  await sleep(1500);
  const clip = await page.evaluate(() => { const r = document.getElementById('world').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  const cshot = async (name) => { const f = `${label}-${name}.png`; await page.mouse.move(4, 4); await sleep(700); await page.screenshot({ path: path.join(out, f), clip }); return f; };
  j.shots.push(await cshot('ux10-selected-castle-home'));
  await page.keyboard.press('KeyQ'); await page.keyboard.press('KeyQ'); await sleep(1200);
  j.shots.push(await cshot('ux10-selected-castle-rotated90'));
  j.errors = page.errors;
  report.journeys.ux10 = j;
  await page.close();
}

// --- UX-14 (part): the reduced-motion preference reaches the board's pulse and pop ----------------
if (want.has('ux14rm')) {
  const j = {};
  for (const mode of ['no-preference', 'reduce']) {
    const page = await browser.newPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: mode }]);
    await page.goto(`${base}/versus.html?autostart=1&a=human&b=bot&seed=1`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => window.__versus?.view); await sleep(1500);
    j[mode] = await page.evaluate(async () => {
      const a = window.__versus, v = a.view;
      v.dropHighlight(a.state, a.state.parties['A.mount.C1'], true);
      const ring = []; for (let i = 0; i < 6; i++) { await new Promise((r) => setTimeout(r, 70)); ring.push(+v.dropRing.scale.x.toFixed(3)); }
      v.dropHighlight(a.state, null, false);
      v.syncSupplyTokens(a.state, { 'A.mount.C1': 2e6 });
      const tok = v.supplyTokens.get('A.mount.C1'), pops = [];
      for (let i = 0; i < 4; i++) { await new Promise((r) => setTimeout(r, 60)); pops.push(+(tok.scale.x / tok.userData.w).toFixed(3)); }
      return { dropRingScales: ring, supplyTokenScale: pops };
    });
    await page.close();
  }
  report.journeys.ux14rm = j;
}

// --- UX-06: critical controls stay usable across window sizes and enlarged text --------------------
// Enlarged text is browser zoom: a 1600x1000 window at 150% is a 1067x667 CSS viewport at DPR 1.5.
if (want.has('ux06')) {
  const j = { cases: [] };
  for (const [vw, vh, dpr, name] of [[1600, 1000, 1, '1600x1000'], [1280, 720, 1, '1280x720'], [1100, 900, 1, '1100x900'], [1067, 667, 1.5, '1600x1000 at 150% text']]) {
    const page = await open('autostart=1&a=human&b=bot&seed=1');
    await page.setViewport({ width: vw, height: vh, deviceScaleFactor: dpr });
    await sleep(1500);
    const m = await page.evaluate(() => {
      const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), shown: cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 40 && r.height > 20 }; };
      const tiles = [...document.querySelectorAll('#ownhand .tile')].map((t) => t.getBoundingClientRect());
      const inWin = (r) => r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1;
      const rb = document.querySelector('.ready-big')?.getBoundingClientRect();
      return { world: box('#world'), roster: box('#roster'), rosterDrawerToggle: !!document.querySelector('.roster-toggle') && getComputedStyle(document.querySelector('.roster-toggle')).display !== 'none', resources: box('#resources'), plan: box('#plan'), ownTilesVisible: tiles.filter((r) => inWin(r) && r.width >= 40).length, ownTileMinWidth: Math.round(Math.min(...tiles.map((r) => r.width))), readyVisible: !!rb && inWin(rb) && rb.height >= 28, inspector: box('#inspector') };
    });
    m.window = name;
    m.shot = await shot(page, `ux06-${name.replace(/[^0-9a-z]+/gi, '-')}`);
    if (m.rosterDrawerToggle) { // the drawer: open, choose a party, closes; reopen and Escape closes
      await page.click('.roster-toggle'); await sleep(300);
      m.drawerOpened = await page.evaluate(() => getComputedStyle(document.getElementById('roster')).display !== 'none');
      m.drawerShot = await shot(page, `ux06-${name.replace(/[^0-9a-z]+/gi, '-')}-drawer`);
      await page.click('#roster .rrow'); await sleep(500);
      m.drawerAfterPick = await page.evaluate(() => ({ open: document.body.classList.contains('roster-open'), selected: window.__versus.selected?.id ?? null }));
      await page.click('.roster-toggle'); await sleep(200); await page.keyboard.press('Escape'); await sleep(200);
      m.drawerAfterEscape = await page.evaluate(() => document.body.classList.contains('roster-open'));
    }
    j.cases.push(m);
    await page.close();
  }
  report.journeys.ux06 = j;
}

// --- UX-14: the main journey by keyboard only, and a color-reduced view ---------------------------
if (want.has('ux14kb')) {
  const page = await open('autostart=1&a=human&b=bot&seed=1');
  const j = { steps: [] };
  const where = () => page.evaluate(() => { const e = document.activeElement; return e ? (e.getAttribute('aria-label') || e.innerText || e.tagName).replace(/\s+/g, ' ').trim().slice(0, 70) : null; });
  const plan = () => page.evaluate(() => window.__versus.plans.A.map((c) => `${c.type}:${c.partyId ?? ''}${c.target ? `>R${c.target.row}C${c.target.column}` : ''}`));
  // Tab order: which of the journey's controls are reachable with Tab alone
  await page.evaluate(() => document.activeElement?.blur());
  const seen = [];
  for (let i = 0; i < 160; i++) { await page.keyboard.press('Tab'); seen.push(await where()); }
  j.tabReach = { tabsPressed: 160, rosterRow: seen.findIndex((x) => /Your Castle at R1C1/.test(x ?? '')), handTile: seen.findIndex((x) => /your C1/.test(x ?? '')), ready: seen.findIndex((x) => /^Ready/.test(x ?? '')) };
  // 1. choose your C1 Castle from the roster with Tab + Enter
  let k = 0; await page.evaluate(() => document.activeElement?.blur());
  while (k++ < 200 && !/Your Castle at R1C1/.test(await where() ?? '')) await page.keyboard.press('Tab');
  await page.keyboard.press('Enter'); await sleep(500);
  j.steps.push({ name: 'Tab to the roster row, Enter', tabs: k, selected: await page.evaluate(() => window.__versus.selected?.id), plan: await plan() });
  // 2. Supply: Tab to the first Load Supply button in the inspector, Enter
  k = 0; while (k++ < 80 && !/^Load 2 Supply from 2♣ \(C1\)/.test(await where() ?? '')) await page.keyboard.press('Tab');
  await page.keyboard.press('Enter'); await sleep(400);
  j.steps.push({ name: 'Tab to Load Supply (+2), Enter', tabs: k, plan: await plan() });
  // 3. Move: Tab to the Move list, Enter opens it, Tab to the first destination, Enter
  k = 0; while (k++ < 80 && !/^Move to/.test(await where() ?? '')) await page.keyboard.press('Tab');
  await page.keyboard.press('Enter'); await sleep(200); await page.keyboard.press('Tab'); const dest = await where(); await page.keyboard.press('Enter'); await sleep(400);
  j.steps.push({ name: `Tab to 'Move to…', Enter, Tab to ${dest}, Enter`, tabs: k, plan: await plan() });
  j.shot = await shot(page, 'ux14-keyboard-planned');
  // 4. Ready by keyboard
  await page.keyboard.down('Control'); await page.keyboard.press('Enter'); await page.keyboard.up('Control'); await sleep(3500);
  j.steps.push({ name: 'Ctrl+Enter', tick: await page.evaluate(() => window.__versus.state.tick), events: await page.evaluate(() => window.__versus.session.events.filter((e) => (e.partyId === 'A.mount.C1') && ['supply_loaded', 'destination_set', 'region_entered', 'parties_merged', 'destination_reached'].includes(e.type)).map((e) => e.type)) });
  // color-reduced view: the same screen in grayscale
  await page.evaluate(() => { document.documentElement.style.filter = 'grayscale(1)'; window.__versus.selected = { kind: 'party', id: 'A.mount.C3' }; window.__versus._renderAll(); window.__versus._focusSelection(); });
  await sleep(1500);
  const clip = await page.evaluate(() => { const r = document.getElementById('world').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  await page.mouse.move(4, 4); await sleep(500);
  j.grayscaleShot = `${label}-ux14-grayscale.png`; await page.screenshot({ path: path.join(out, j.grayscaleShot), clip });
  // both owners in contact, in grayscale: ownership must survive without hue (single vs double brackets, disc vs ring)
  const p2 = await open('autostart=1&fixture=corner&a=human&b=human');
  await p2.evaluate(() => { document.documentElement.style.filter = 'grayscale(1)'; const a = window.__versus, P = a.state.parties['B.queen']; a.cam.focusOn(a.view.toWorld(P.x, P.y)); a.cam.goal.distance = a.view.size * 0.45; });
  await sleep(1800);
  const clip2 = await p2.evaluate(() => { const r = document.getElementById('world').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  await p2.mouse.move(4, 4); await sleep(400);
  j.grayscaleContactShot = `${label}-ux14-grayscale-contact.png`; await p2.screenshot({ path: path.join(out, j.grayscaleContactShot), clip: clip2 });
  await p2.close();
  j.errors = page.errors;
  report.journeys.ux14kb = j;
  await page.close();
}

// --- HV-41: rules & experiments panel — edit a copy, create a revision, compare, run a bot batch ---
if (want.has('hv41')) {
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e?.message ?? e)));
  await page.goto(`${base}/versus.html?debug=1`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => { try { localStorage.removeItem('hapa-versus.lab.v1'); } catch {} });
  const clickText = (re) => page.evaluate((src) => { const b = [...document.querySelectorAll('button')].find((x) => new RegExp(src).test(x.innerText.trim())); b?.click(); return !!b; }, re.source);
  const j = { steps: [] };
  j.steps.push({ name: 'open from setup', opened: await clickText(/^Rules & experiments/) });
  await sleep(500);
  j.fields = await page.evaluate(() => document.querySelectorAll('.lab-fields tr').length - 1);
  j.shots = [await shot(page, 'hv41-1-fields')];
  // edit the first integer field (+1), create a revision
  const edit = await page.evaluate(() => { const i = document.querySelector('.lab-fields input[type=number]'); const label = i.getAttribute('aria-label'); const from = Number(i.value); i.value = String(from + 1); i.dispatchEvent(new Event('change', { bubbles: true })); return { label, from, to: from + 1 }; });
  await sleep(300);
  await clickText(/^Create revision/); await sleep(400);
  const saved = await page.evaluate(() => document.querySelector('.lab-result')?.innerText.replace(/\s+/g, ' ') ?? null);
  j.steps.push({ name: 'edit one field, create revision', edit, saved });
  // start from the new revision and compare it with its base
  await page.evaluate(() => { const sel = document.querySelector('.lab > label select'); const opt = [...sel.options].find((o) => o.value.includes('~')); sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true })); });
  await sleep(300);
  await page.evaluate(() => { const sel = document.querySelector('.lab-compare select'); sel.value = sel.options[0].value; sel.dispatchEvent(new Event('change', { bubbles: true })); });
  await sleep(300);
  j.steps.push({ name: 'compare the revision with the base', diff: await page.evaluate(() => [...document.querySelectorAll('.lab-compare table tr')].slice(1).map((r) => r.innerText.replace(/\s+/g, ' '))) });
  // a small batch: seeds 1-2, 60 Ticks
  await page.evaluate(() => { const ins = document.querySelectorAll('.lab-batch input[type=number]'); ins[0].value = '1'; ins[1].value = '2'; ins[2].value = '60'; for (const i of ins) i.dispatchEvent(new Event('change', { bubbles: true })); });
  await clickText(/^Run bot batch/);
  await page.waitForFunction(() => !document.querySelector('.lab-batch button.primary')?.disabled && document.querySelectorAll('.lab-batch table tr').length >= 3, { timeout: 85000 }).catch(() => {});
  j.steps.push({ name: 'run a bot batch (seeds 1-2, 60 Ticks)', summary: await page.evaluate(() => document.querySelector('.lab-batch p:not(.dim)')?.innerText ?? null), rows: await page.evaluate(() => [...document.querySelectorAll('.lab-batch table tr')].slice(1).map((r) => r.innerText.replace(/\s+/g, ' '))) });
  j.shots.push(await shot(page, 'hv41-2-revision-compare-batch'));
  j.errors = errors;
  report.journeys.hv41 = j;
  await page.close();
}

// --- UX-12: one mixed party through a full orbit — gear sides, facing, footprint ------------------
if (want.has('ux12')) {
  const page = await open('autostart=1&fixture=corner&a=human&b=human');
  const j = { frames: [] };
  await page.evaluate(() => { const a = window.__versus, P = a.state.parties['A.mid']; a.selected = { kind: 'party', id: 'A.mid' }; a._renderAll(); a.cam.focusOn(a.view.toWorld(P.x, P.y).setY(0.4)); a.cam.goal.distance = a.view.size * 0.24; a.cam.goal.pitch = 40 * Math.PI / 180; });
  await sleep(1500);
  const clip = await page.evaluate(() => { const r = document.getElementById('world').getBoundingClientRect(); return { x: r.x + r.width * 0.22, y: r.y + r.height * 0.12, width: r.width * 0.56, height: r.height * 0.76 }; });
  for (let i = 0; i < 8; i++) {
    // for each Swordsman: is the shield on the member's world left and the sword on its right, as seen on screen?
    const m = await page.evaluate(() => {
      const a = window.__versus, cam = a.engine.camera, r = a.engine.renderer.domElement.getBoundingClientRect();
      const scr = (v) => { const p = v.clone().project(cam); return (p.x + 1) / 2 * r.width; };
      const out = [];
      for (const id of ['A.mid.s1', 'A.mid.s2', 'A.mid.s3']) {
        const spr = a.view.sprites.get(id), g = spr.userData.gear;
        if (!g?.shield || !g?.sword) continue;
        const ws = new (cam.position.constructor)(), wb = new (cam.position.constructor)(), wl = new (cam.position.constructor)();
        g.shield.getWorldPosition(ws); g.sword.getWorldPosition(wb);
        const P = a.state.parties['A.mid'], F = { N: [0, 1], S: [0, -1], E: [1, 0], W: [-1, 0] }[P.facing]; // rules y up = world -z
        // the member's own left in world terms: rotate front (fx, fy) by +90° → (-fy, fx); world (x, -y)
        wl.copy(spr.position).add({ x: -F[1] * 1.0, y: 0, z: -F[0] * 1.0 });
        const leftOnScreen = scr(wl) - scr(spr.position.clone());
        // seen edge-on (the member's left/right axis points at the camera) the screen test is undefined
        const wf = spr.position.clone().add({ x: F[0] * 1.0, y: 0, z: -F[1] * 1.0 }); const frontOnScreen = scr(wf) - scr(spr.position.clone());
        if (Math.abs(leftOnScreen) < Math.abs(frontOnScreen)) { out.push({ id, shieldSide: 'edge-on', swordSide: 'edge-on' }); continue; }
        out.push({ id, shieldSide: Math.sign(scr(ws) - scr(spr.position.clone())) === Math.sign(leftOnScreen) ? 'left' : 'right', swordSide: Math.sign(scr(wb) - scr(spr.position.clone())) === Math.sign(leftOnScreen) ? 'left' : 'right' });
      }
      return { yawDeg: Math.round(a.cam.yaw * 180 / Math.PI) % 360, members: out };
    });
    m.shot = `${label}-ux12-orbit-${i * 45}.png`;
    await page.mouse.move(4, 4); await page.screenshot({ path: path.join(out, m.shot), clip });
    j.frames.push(m);
    await page.evaluate(() => window.__versus.cam.rotate(45)); await sleep(1200);
  }
  j.errors = page.errors;
  report.journeys.ux12 = j;
  await page.close();
}

// --- UX-11: terrain materials and the three stages of digging ------------------------------------
if (want.has('ux11')) {
  const j = { steps: [] };
  const close = async (page, pid, dist = 0.32) => { await page.evaluate((pid, dist) => { const a = window.__versus, P = a.state.parties[pid]; a.cam.focusOn(a.view.toWorld(P.x, P.y).setY(a.view.partyY(P))); a.cam.goal.distance = a.view.size * dist; a.cam.goal.pitch = 48 * Math.PI / 180; }, pid, dist); await sleep(1500); };
  const wclip = (page) => page.evaluate(() => { const r = document.getElementById('world').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  const cshot = async (page, name) => { const f = `${label}-${name}.png`; await page.mouse.move(4, 4); await sleep(500); await page.screenshot({ path: path.join(out, f), clip: await wclip(page) }); return f; };
  // the terrain fixture: hill, open pit and tunnel
  const t = await open('autostart=1&fixture=terrain&a=human&b=human');
  await close(t, 'A.hill', 0.42);
  j.steps.push({ name: 'terrain fixture: hill and pit', shot: await cshot(t, 'ux11-1-hill-pit') });
  await t.evaluate(() => { const a = window.__versus; a.view.setLayer(-2); a.view.sync(a.state); a._renderAll(); });
  await close(t, 'B.tunnel', 0.42);
  j.steps.push({ name: 'layer -2: floor grid under the cutaway', floorVisible: await t.evaluate(() => !!window.__versus.view.terrain.floor?.visible), shot: await cshot(t, 'ux11-2-cutaway-floor') });
  await t.close();
  // the dig fixture: plan, then resolve
  const d = await open('autostart=1&fixture=dig&a=human&b=human');
  await d.evaluate(() => { const a = window.__versus; a.selected = { kind: 'party', id: 'A.worker' }; a.view.setLayer(-3); a.view.sync(a.state); a._renderAll(); });
  await close(d, 'A.worker', 0.22);
  const opts = await d.evaluate(() => [...document.querySelectorAll('#inspector details.movelist button')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()).filter((x) => /^(Dig|Fill|Mine)/.test(x)));
  await d.evaluate(() => { const det = [...document.querySelectorAll('#inspector details.movelist')].find((x) => /Terrain work/.test(x.textContent)); if (det) det.open = true; const b = [...(det?.querySelectorAll('button') ?? [])].find((x) => /^Dig/.test(x.textContent.trim())); b?.click(); });
  await sleep(500);
  j.steps.push({ name: 'dig fixture: legal work, plan a dig', options: opts, plan: await d.evaluate(() => window.__versus.plans.A.map((c) => `${c.type}:${c.work}@${c.target?.x},${c.target?.y},${c.target?.band}`)), workMarks: await d.evaluate(() => window.__versus.view.terrain.work?.children.length ?? 0), shot: await cshot(d, 'ux11-3-planned-dig') });
  await d.evaluate(() => { const a = window.__versus; a._pressReady(); a._pressReady(); });
  await sleep(3500);
  j.steps.push({ name: 'both Ready: the dig resolves', tick: await d.evaluate(() => window.__versus.state.tick), events: await d.evaluate(() => window.__versus.session.events.filter((e) => /work|terrain_changed/.test(e.type)).map((e) => e.type)), workMarks: await d.evaluate(() => window.__versus.view.terrain.work?.children.length ?? 0), shot: await cshot(d, 'ux11-4-dug') });
  j.errors = d.errors;
  await d.close();
  report.journeys.ux11 = j;
}

await browser.close();
fs.writeFileSync(path.join(out, `${label}-report.json`), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
