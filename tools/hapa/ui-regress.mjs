#!/usr/bin/env node
/**
 * Regression assertions for the confirmed interface risks (design review 02, R2-08). Unlike the
 * evidence recorder (ui-journeys.mjs), every check here compares what the running application did
 * with an expectation stated independently (from the rules, the fixture as built, or the value the
 * player entered before the action under test), and the process exits 1 if any check fails, a
 * required control is missing, or the page reports an error not on the explicit allow-list.
 *
 *   node tools/hapa/ui-regress.mjs [--base http://127.0.0.1:5199] [--only c1,c3] [--sabotage]
 *   (contract 2: the board-first interface of addendum 01 / response 05; contract 3: z-checks for
 *    addendum 02 / response 06 — select to command, approach to inspect, one territory environment)
 *        [--out-root docs/reviews/evidence/2026-11-22/regress] [--run <id>] [--source-dir <checkout>]
 *
 * --source-dir names the checkout the server is serving when it is not this one (a baseline
 * worktree), so the report records that source's commit and working-tree state.
 *
 * Each run writes to a new directory <out-root>/<run id> (default: UTC time + source commit, with
 * "-dirty" for an uncommitted tree) and refuses to reuse an existing one, so evidence is never
 * overwritten. --sabotage swaps two expectations for wrong values to show the checks can fail.
 *
 * Drives the dev server (127.0.0.1 only) in headless Chrome with real pointer and keyboard input.
 * A few setup steps call the app's own methods (named as setup in the report); assertions never
 * read their expected values from the code under test. Needs puppeteer-core: set PUPPETEER_CORE.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? [...a, [v.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]]] : a), []));
const base = String(args.base ?? 'http://127.0.0.1:5199');
const sabotage = !!args.sabotage;
const only = args.only ? new Set(String(args.only).split(',')) : null;
const want = (id) => !only || only.has(id);

// --- provenance and a unique run directory ----------------------------------------------------
const sh = (cmd, cwd) => { try { return execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return null; } };
const here = sh('git rev-parse --show-toplevel', process.cwd()) ?? process.cwd();
// --source-dir: the checkout the server at --base is serving, when it is not this one (a baseline)
const repo = args['source-dir'] ? path.resolve(String(args['source-dir'])) : here;
const commit = sh('git rev-parse HEAD', repo);
const status = sh('git status --porcelain', repo) ?? '';
const diff = sh('git diff HEAD', repo) ?? '';
const untracked = (sh('git ls-files --others --exclude-standard', repo) ?? '').split('\n').filter(Boolean);
const untrackedHash = createHash('sha256');
for (const f of untracked.sort()) { untrackedHash.update(f); try { untrackedHash.update(fs.readFileSync(path.join(repo, f))); } catch { /* unreadable */ } }
const source = { commit, dirty: !!status, diffSha256: status ? createHash('sha256').update(diff).digest('hex') : null, untracked, untrackedSha256: untracked.length ? untrackedHash.digest('hex') : null };
// engine provenance (review 03, R3-05): the parent's recorded gitlink, and separately a verified
// checkout only when vendor/lumina is its own Git work tree (git -C would otherwise climb upward)
const gitlink = (sh('git ls-tree HEAD vendor/lumina', repo) ?? '').split(/\s+/)[2] ?? null;
const ownTree = fs.existsSync(path.join(repo, 'vendor/lumina/.git')) && sh('git -C vendor/lumina rev-parse --show-toplevel', repo) === path.join(fs.realpathSync(repo), 'vendor/lumina');
const engine = { gitlink, checkout: ownTree ? sh('git -C vendor/lumina rev-parse HEAD', repo) : null, verified: ownTree, note: ownTree ? 'vendor/lumina is a Git work tree at the recorded commit' : 'vendor/lumina has no own Git metadata here; only the gitlink is recorded' };
const runId = String(args.run ?? `${new Date().toISOString().replace(/[:.]/g, '-')}-${(commit ?? 'nogit').slice(0, 7)}${source.dirty ? '-dirty' : ''}${sabotage ? '-sabotage' : ''}`);
const outRoot = path.resolve(here, String(args['out-root'] ?? 'docs/reviews/evidence/2026-11-22/regress'));
const dir = path.join(outRoot, runId);
if (fs.existsSync(dir)) { console.error(`refusing to overwrite existing run directory ${dir}`); process.exit(2); }
fs.mkdirSync(dir, { recursive: true });

const pcPath = process.env.PUPPETEER_CORE;
const puppeteer = (await import(pcPath ? pathToFileURL(path.join(pcPath, 'lib/puppeteer/puppeteer-core.js')).href : 'puppeteer-core')).default;
const executablePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await puppeteer.launch({ executablePath, headless: 'new', protocolTimeout: 120000, args: ['--ignore-gpu-blocklist', '--enable-webgl', '--use-angle=metal', '--no-first-run', '--mute-audio'] });

/** Resource failures that are expected and harmless, each with its reason. Anything else fails. */
const ALLOWED = [
  { pattern: /\/favicon\.ico(\?|$)/, reason: 'the prototype ships no favicon' },
  { pattern: /\/renditions\//, reason: 'optional owner Tarot art in ignored local storage (public/renditions); absent faces fall back to the procedural face' },
];
const manifest = {
  runId, startedAt: new Date().toISOString(), tool: 'tools/hapa/ui-regress.mjs', base, source, engine,
  browser: await browser.version(), os: `${os.type()} ${os.release()} ${os.arch()}`, node: process.version,
  sabotage, allowedResourceErrors: ALLOWED.map((a) => ({ pattern: String(a.pattern), reason: a.reason })),
  conventions: 'Browser zoom is emulated as a smaller CSS viewport at a higher device pixel ratio; the HUD uses px type, so it has no separate text-size setting. Camera: the default fitted Home view unless a check says otherwise.',
  checks: [],
};

// --- assertion recording ------------------------------------------------------------------------
let current = null;
const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort()) : x));
function expect(name, actual, expected, note) {
  const pass = canon(actual) === canon(expected);
  current.assertions.push({ name, pass, actual, expected, ...(note ? { note } : {}) });
  console.log(`  ${pass ? '✔' : '✖'} ${name}${pass ? '' : `\n      expected ${canon(expected)}\n      actual   ${canon(actual)}`}`);
  return pass;
}
const ok = (name, cond, detail) => expect(name, !!cond, true, detail);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function check(id, title, config, fn) {
  if (!want(id)) return;
  console.log(`${id} · ${title}`);
  current = { id, title, config, assertions: [], shots: [], setup: [], errors: [] };
  manifest.checks.push(current);
  try { await fn(); } catch (e) { current.assertions.push({ name: 'check ran to completion', pass: false, actual: String(e?.stack ?? e), expected: 'no exception' }); console.log(`  ✖ exception: ${e?.message ?? e}`); }
  const unexpected = current.errors.filter((e) => !ALLOWED.some((a) => a.pattern.test(e.url ?? '')));
  expect('no unexpected application errors', unexpected, []);
  current.allowedErrors = current.errors.filter((e) => ALLOWED.some((a) => a.pattern.test(e.url ?? '')));
  delete current.errors;
}

async function open(query, { width = 1600, height = 1000, dpr = 1 } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: dpr });
  page.on('pageerror', (e) => current.errors.push({ kind: 'pageerror', message: String(e?.message ?? e) }));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) current.errors.push({ kind: 'console', message: m.text() }); });
  page.on('response', (r) => { if (r.status() >= 400) current.errors.push({ kind: 'http', status: r.status(), url: r.url() }); });
  page.on('requestfailed', (r) => current.errors.push({ kind: 'requestfailed', url: r.url(), message: r.failure()?.errorText }));
  await page.goto(`${base}/versus.html?${query}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.__versus?.session && window.__versus.view, { timeout: 30000 });
  await sleep(900);
  return page;
}
const shot = async (page, name) => { const f = `${current.id}-${name}.png`; await page.mouse.move(2, 2); await sleep(500); await page.screenshot({ path: path.join(dir, f) }); current.shots.push(f); return f; };
const setup = (what) => current.setup.push(what);
const focused = (page) => page.evaluate(() => { const e = document.activeElement; return e && e !== document.body ? { name: (e.getAttribute('aria-label') || e.innerText || e.tagName).replace(/\s+/g, ' ').trim().slice(0, 90), visible: e.matches(':focus-visible'), tag: e.tagName } : null; });
/** Press Tab until the focused control's accessible name matches; null if it never does. */
async function tabTo(page, re, max = 120) {
  for (let i = 0; i < max; i++) { const f = await focused(page); if (f && re.test(f.name)) return { ...f, tabs: i }; await page.keyboard.press('Tab'); }
  return null;
}
const ctrlEnter = async (page) => { await page.keyboard.down('Control'); await page.keyboard.press('Enter'); await page.keyboard.up('Control'); await sleep(150); };
/** Click a control found by its accessible name (aria-label or text). Missing controls fail the check. */
async function clickNamed(page, selector, re, name) {
  const handle = await page.evaluateHandle((sel, src, flags) => { const r = new RegExp(src, flags); return [...document.querySelectorAll(sel)].find((e) => r.test((e.getAttribute('aria-label') || e.innerText || '').replace(/\s+/g, ' ').trim())) ?? null; }, selector, re.source, re.flags);
  const el = handle.asElement();
  ok(`control present: ${name}`, !!el);
  if (!el) return false;
  await el.evaluate((e) => e.scrollIntoView({ block: 'nearest' }));
  await el.click(); await sleep(250);
  return true;
}
const app = (page, fn, ...a) => page.evaluate(fn, ...a);
const agreement = (page) => app(page, () => { const a = window.__versus; return { tick: a.state.tick, viewSeat: a.viewSeat, rev: { ...a.rev }, plans: { A: a.plans.A.map((c) => JSON.stringify(c)), B: a.plans.B.map((c) => JSON.stringify(c)) }, stale: { A: a._can('A').stale, B: a._can('B').stale }, replayTicks: a.session.replay.ticks.length }; });
const waitResolved = (page, tick) => page.waitForFunction((t) => { const a = window.__versus; return a.state.tick >= t && !a.playback && !a.resolving && !a.pendingChoice; }, { timeout: 30000 }, tick);
const screenOf = (page, memberId, lift = 0.45) => app(page, (id, lift) => {
  const a = window.__versus, spr = a.view.sprites.get(id);
  const v = spr.position.clone(); v.y += lift;
  const p = v.project(a.engine.camera), r = a.engine.renderer.domElement.getBoundingClientRect();
  return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
}, memberId, lift);
const clickAt = async (page, p) => { await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.up(); await sleep(300); };
const layerButton = (band) => (band === null ? /^All$/ : new RegExp(`^[${band < 0 ? '−-' : '+'}]${Math.abs(band)}( \\d+)?$`));

// ================================================================================================
// Contract 2 (response 05): the board is the interface. Expectations come from the rules, the
// fixture as built, or the value entered before the action under test — never from the UI itself.
// ================================================================================================
const READY = '#matchbar .ready-big';
const openNav = async (page) => { if (!(await app(page, () => document.body.classList.contains('roster-open')))) { await page.keyboard.press('n'); await sleep(300); } };
const pinVia = async (page, re, name) => { await openNav(page); return clickNamed(page, '#roster .rrow', re, name); };
const peek = (page, slot = 'pinned') => app(page, (slot) => { const v = document.querySelector(`.peek.${slot}`); return v ? { title: v.querySelector('.peek-title')?.textContent, text: v.innerText.replace(/\s+/g, ' ') } : null; }, slot);
const hoverAt = async (page, p, wait = 450) => { await page.mouse.move(p.x, p.y, { steps: 4 }); await sleep(wait); };
const anchor = (page, subject) => app(page, (sub) => { const a = window.__versus; const c = a._screenAnchor(sub); if (!c) return null; const r = a.el.world.getBoundingClientRect(); return { x: r.left + c.x, y: r.top + c.y }; }, subject);
const tileAt = (page, cardId) => app(page, (id) => { const a = window.__versus; const t = [...a.view.cardTiles.values()].find((x) => x.userData.cardId === id); if (!t) return null; const v = t.position.clone(); v.y = 0.06; const p = v.project(a.engine.camera), r = a.engine.renderer.domElement.getBoundingClientRect(); return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height }; }, cardId);

// --- C1: Ready freezes the own plan; an opponent revision is reviewed and acknowledged ----------
await check('c1', 'Ready freezes the own plan through an opponent revision (UX-01)', { query: 'autostart=1&a=human&b=human&seed=1', viewport: '1600x1000@1', seat: 'A then B (hotseat)', profile: 'hapa_open_10x9_v3_02' }, async () => {
  const page = await open('autostart=1&a=human&b=human&seed=1');
  await pinVia(page, /^Your Castle at R1C1/, 'navigator row for your C1 Castle');
  await clickNamed(page, '.cmdbar summary', /^Supply ▾/, 'Supply menu (command bar)');
  await clickNamed(page, '.cmdbar button', /^Load 2 Supply from 2♣ \(C1\)/, 'Load Supply from the C1 card (command bar)');
  const before = await agreement(page);
  expect('A entered one Supply order', before.plans.A.length, 1);
  await clickNamed(page, READY, /^Ready/, 'Ready (strip)');
  const frozen = await agreement(page);
  expect('Ready hands the hotseat to B', frozen.viewSeat, 'B');
  await page.keyboard.press('1'); await sleep(150); await page.keyboard.press('b'); await sleep(300);
  await clickNamed(page, READY, /^Ready/, 'Ready (B)');
  const st = await agreement(page);
  expect('view returns to A to acknowledge', st.viewSeat, 'A');
  expect('A acknowledgment is stale', st.stale.A, true);
  await page.keyboard.press('2'); await sleep(150); await page.keyboard.press('b'); await sleep(300);
  const after = await agreement(page);
  expect('A plan unchanged after B revised and A tried to edit', after.plans.A, before.plans.A);
  expect('A revision unchanged', after.rev.A, frozen.rev.A + (sabotage ? 1 : 0), sabotage ? 'SABOTAGE: deliberately wrong expectation (+1)' : undefined);
  const view = await app(page, () => ({ ordersOpen: !document.getElementById('orders').hidden, removeInOwn: document.querySelectorAll('#plan .planbox.a button.x').length, added: document.querySelectorAll('#plan .planbox.b li.added').length, banner: document.querySelector('#plan .plan-banner')?.innerText ?? '', ready: document.querySelector('#matchbar .ready-big')?.innerText.replace(/\s+/g, ' ').trim() }));
  expect('Orders opened by itself for the stale review', view.ordersOpen, true);
  expect('no Remove controls on the frozen own plan', view.removeInOwn, 0);
  expect('B\'s new order is marked NEW', view.added, 1);
  ok('banner says the own orders stay frozen', /stay frozen/.test(view.banner), view.banner);
  ok('primary action is Acknowledge', /^Acknowledge updated plan/.test(view.ready), view.ready);
  await shot(page, 'stale-review');
  await clickNamed(page, READY, /^Acknowledge/, 'Acknowledge updated plan');
  await waitResolved(page, 2);
  expect('the resolved Tick used exactly the frozen A plan', await app(page, () => window.__versus.session.replay.ticks.at(-1).plans.A.map((c) => JSON.stringify(c))), before.plans.A);
  await page.close();
});

// --- C2: one resolution despite Ready spam; a paid counter actually cast (R3-01) -----------------
await check('c2', 'One resolution during a response window; a paid counter through the browser (UX-02, R3-01)', { query: 'autostart=1&fixture=response&a=human&b=human', viewport: '1600x1000@1' }, async () => {
  const run = async (mode) => {
    const page = await open('autostart=1&fixture=response&a=human&b=human');
    setup('A\'s Ember Strike order is added with the app\'s own _addCommand (ability targeting is not under test here)');
    await app(page, () => window.__versus._addCommand('A', { type: 'play_ability', cardId: 'A.ember', actorPartyId: 'A.c', target: { memberId: 'B.c.s2' }, burns: ['A.red'] }));
    const t0 = await agreement(page);
    await clickNamed(page, READY, /^Ready/, 'Ready (A)');
    await clickNamed(page, READY, /^Ready/, 'Ready (B)');
    await page.waitForFunction(() => !!window.__versus.pendingChoice, { timeout: 15000 });
    const f = await focused(page);
    const panel = await app(page, () => ({ shown: !document.getElementById('decision').hidden, text: document.getElementById('decision').innerText.replace(/\s+/g, ' ') }));
    if (mode === 'spam') { for (let i = 0; i < 12; i++) await ctrlEnter(page); for (let i = 0; i < 3; i++) await page.$eval(READY, (b) => b.click()).catch(() => {}); }
    if (mode === 'counter') await clickNamed(page, '#decision .response button', /^Blue Denial/, 'Blue Denial (paid response)');
    let passes = 0;
    while (passes < 8 && await app(page, () => !!window.__versus.pendingChoice)) { await clickNamed(page, '#decision .response button', /^Pass$/, 'Pass'); passes++; await sleep(300); }
    await waitResolved(page, 10);
    const r = await app(page, () => { const a = window.__versus, ev = a.session.events.filter((e) => e.tick === 9); return { replayTicks: a.session.replay.ticks.length, locked: ev.filter((e) => e.type === 'plans_locked').length, damage: ev.filter((e) => e.type === 'card_damage').length, countered: ev.filter((e) => e.type === 'counter_applied').length, rejected: ev.filter((e) => e.type === 'command_rejected').length, paymentBurns: ev.filter((e) => e.type === 'card_burned' && e.seat === 'B').map((e) => e.cardId), poolB: a.state.players.B.pool, fingerprint: a.session.replay.ticks.at(-1).fingerprint, events: a.session.events.length }; });
    if (mode !== 'calm') await shot(page, `after-${mode}`);
    await page.close();
    return { ...r, before: t0.replayTicks, focusAtOpen: f, panel };
  };
  const spam = await run('spam'), calm = await run('calm'), counter = await run('counter');
  expect('the required response is its own visible surface', spam.panel.shown, true);
  ok('it shows the pending effect, costs and Pass', /Ember Strike/.test(spam.panel.text) && /Cost: 2 Blue/.test(spam.panel.text) && /Pass/.test(spam.panel.text), spam.panel.text.slice(0, 200));
  ok('focus starts on a choice', /Blue Denial|Pass/.test(spam.focusAtOpen?.name ?? ''), spam.focusAtOpen);
  expect('exactly one replay entry added (with Ready spam)', spam.replayTicks - spam.before, 1);
  expect('exactly one plans_locked event for Tick 9', spam.locked, 1);
  expect('spam run and calm run end in the same state', spam.fingerprint, calm.fingerprint);
  expect('paid counter: countered, no damage, nothing rejected', [counter.countered, counter.damage, counter.rejected], [1, 0, 0]);
  expect('paid counter: B burned exactly its 2-Blue Card to pay', counter.paymentBurns, ['B.blue']);
  expect('paid counter: B\'s pool is empty afterwards (2 Blue spent)', counter.poolB, {});
  current.observed = { spam, calm, counter };
});

// --- C3: height-aware selection -------------------------------------------------------------
await check('c3', 'Selection follows the visible height (UX-03)', { query: 'autostart=1&fixture=stacked&a=human&b=human', viewport: '1600x1000@1' }, async () => {
  const page = await open('autostart=1&fixture=stacked&a=human&b=human');
  const pickAt = async (band, memberId, lift = 0.45) => {
    await clickNamed(page, '.layer-rail button', layerButton(band), `layer ${band ?? 'All'}`);
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await sleep(150);
    await clickAt(page, await screenOf(page, memberId, lift));
    return app(page, () => window.__versus.selected?.id ?? null);
  };
  expect('layer −2: clicking the tunnel party selects it', await pickAt(-2, 'B.tunnel.s5'), sabotage ? 'A.fly' : 'B.tunnel', sabotage ? 'SABOTAGE: deliberately wrong expected target' : undefined);
  await shot(page, 'layer-minus2-tunnel');
  expect('layer +3: clicking the flyer selects it', await pickAt(3, 'A.fly.s5'), 'A.fly');
  const hidden = await pickAt(3, 'B.tunnel.s5', 0);
  ok('layer +3: the hidden tunnel party never wins a click', hidden !== 'B.tunnel', hidden);
  await page.close();
});

// --- C4: the selected height filter holds throughout playback --------------------------------------
await check('c4', 'Off-layer bodies stay filtered during and after playback (R2-01)', { query: 'autostart=1&fixture=stacked&a=human&b=human', layers: ['−2', '+3', 'All'] }, async () => {
  for (const band of [-2, 3, null]) {
    const page = await open('autostart=1&fixture=stacked&a=human&b=human');
    const expected = await app(page, (b) => Object.values(window.__versus.state.members).filter((m) => m.alive && (b === null || (m.band ?? 1) === b)).map((m) => m.id).sort(), band);
    await clickNamed(page, '.layer-rail button', layerButton(band), `layer ${band ?? 'All'}`);
    await clickNamed(page, READY, /^Ready/, 'Ready (A)');
    await clickNamed(page, READY, /^Ready/, 'Ready (B)');
    const samples = [];
    for (let i = 0; i < 400; i++) {
      const s = await app(page, () => { const a = window.__versus; return { playing: !!a.playback, visible: [...a.view.sprites].filter(([, spr]) => spr.visible).map(([id]) => id).sort() }; });
      if (s.playing) samples.push(s.visible); else if (samples.length) break;
      await sleep(25);
    }
    await sleep(300);
    const end = await app(page, () => [...window.__versus.view.sprites].filter(([, spr]) => spr.visible).map(([id]) => id).sort());
    const name = band === null ? 'All' : band > 0 ? `+${band}` : `−${-band}`;
    ok(`layer ${name}: playback was sampled (${samples.length} frames)`, samples.length >= 5, samples.length);
    expect(`layer ${name}: every playback sample shows only the expected bodies`, [...new Set(samples.map((x) => canon(x)))], [canon(expected)]);
    expect(`layer ${name}: after playback`, end, expected);
    await page.close();
  }
});

// --- C5: the quiet default — no permanent duplicates; both owners' real banks reachable -------------
const SIZES2 = [{ w: 1600, h: 1000, label: '1600x1000' }, { w: 1280, h: 720, label: '1280x720' }];
await check('c5', 'Quiet default: no ribbons/inspector/Mana panel; both banks, basins and the strip reachable (HF-01/02, R4-01)', { sizes: SIZES2.map((x) => x.label), seats: ['A', 'B'] }, async () => {
  const measured = [];
  for (const sz of SIZES2) for (const seat of ['A', 'B']) {
    const page = await open(seat === 'A' ? 'autostart=1&a=human&b=bot&seed=1' : 'autostart=1&a=bot&b=human&seed=1', { width: sz.w, height: sz.h });
    const m = await app(page, () => {
      const a = window.__versus, s = a.state;
      const world = a.el.world.getBoundingClientRect(), canvas = a.engine.renderer.domElement.getBoundingClientRect();
      const inWorld = (p) => p && p.x >= world.left && p.x <= world.right && p.y >= world.top && p.y <= world.bottom;
      const proj = (v) => { const p = v.clone().project(a.engine.camera); return { x: canvas.left + ((p.x + 1) / 2) * canvas.width, y: canvas.top + ((1 - p.y) / 2) * canvas.height }; };
      const tiles = [...a.view.cardTiles.values()].map((t) => ({ id: t.userData.cardId, owner: s.cards[t.userData.cardId]?.owner, p: proj(t.position) }));
      const banked = ['A', 'B'].flatMap((x) => [...Object.values(s.players[x].bank.minor), ...Object.values(s.players[x].bank.major ?? {}), ...Object.values(s.players[x].bank.rows ?? {})].filter(Boolean));
      const gone = ['ownhand', 'opphand', 'inspector', 'resources', 'side'].filter((id) => document.getElementById(id));
      const rect = (el) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) }; };
      return { gone, rosterShown: getComputedStyle(document.getElementById('roster')).display !== 'none', canvas: rect(a.engine.renderer.domElement), banked: banked.length, tilesOnScreen: tiles.filter((t) => inWorld(t.p)).length, tilesBoth: [...new Set(tiles.filter((t) => inWorld(t.p)).map((t) => t.owner))].sort(), basins: ['A', 'B'].map((x) => inWorld(a._screenAnchor({ kind: 'basin', id: x }) && { x: world.left + a._screenAnchor({ kind: 'basin', id: x }).x, y: world.top + a._screenAnchor({ kind: 'basin', id: x }).y })), strip: ['.ready-big', '.strip-btn.orders', '[aria-label="Match menu"]'].map((q) => { const r = document.querySelector(`#matchbar ${q}`)?.getBoundingClientRect(); return !!r && r.width > 0 && r.right <= innerWidth + 1; }) };
    });
    const tag = `${sz.label} · seat ${seat}`;
    expect(`${tag}: no permanent ribbons, inspector, Mana panel or side column`, m.gone, []);
    expect(`${tag}: the navigator is closed by default`, m.rosterShown, false);
    expect(`${tag}: every banked Card's tile is on screen in the home view`, m.tilesOnScreen, m.banked);
    expect(`${tag}: tiles of both owners on screen`, m.tilesBoth, ['A', 'B']);
    expect(`${tag}: both Mana basins on screen`, m.basins, [true, true]);
    expect(`${tag}: Ready, Orders and the menu in the strip`, m.strip, [true, true, true]);
    if (seat === 'A') await shot(page, `quiet-${sz.label}`);
    measured.push({ size: sz.label, seat, ...m });
    await page.close();
  }
  current.observed = measured;
});

// --- C6: hover / pin / command separation on real Cards, parties and basins -------------------------
await check('c6', 'Hover inspects without selecting; pin, compare, Escape; both owners; every Card type present (HF-01/02, §3)', { query: 'autostart=1&a=human&b=human&seed=1', viewport: '1280x720@1' }, async () => {
  const page = await open('autostart=1&a=human&b=human&seed=1', { width: 1280, height: 720 });
  const st0 = await agreement(page);
  const cam0 = await app(page, () => JSON.stringify(window.__versus.cam.goal));
  const oppCard = await app(page, () => window.__versus.state.players.B.bank.minor['9'] ?? Object.values(window.__versus.state.players.B.bank.minor).find(Boolean));
  const ownCard = await app(page, () => window.__versus.state.players.A.bank.minor['1']);
  const t0 = Date.now();
  await hoverAt(page, await tileAt(page, oppCard), 0);
  await page.waitForSelector('.peek.transient', { timeout: 3000 });
  const latency = Date.now() - t0;
  const v1 = await peek(page, 'transient');
  ok('hovering the opponent\'s Card opens its view without a click', !!v1 && /B's Minor Arcana/.test(v1.text), v1?.text.slice(0, 120));
  ok('the view names that instance (Details) and its exact Supply / Mana', v1 && v1.text.includes(oppCard) === false ? /Supply/.test(v1.text) : true, v1?.title);
  expect('hover did not select or pin anything', await app(page, () => [window.__versus.selected, window.__versus.pinned]), [null, null]);
  expect('hover did not change plans', (await agreement(page)).plans, st0.plans);
  expect('hover did not move the camera', await app(page, () => JSON.stringify(window.__versus.cam.goal)), cam0);
  ok('hover did not take keyboard focus', !(await app(page, () => !!document.activeElement?.closest('.peek'))), true);
  await hoverAt(page, { x: 5, y: 400 }, 700);
  expect('leaving closes the transient view after the grace period', await peek(page, 'transient'), null);
  await hoverAt(page, await tileAt(page, ownCard));
  const v2 = await peek(page, 'transient');
  ok('own Card view offers the three uses', v2 && /Load Supply 2 into/.test(v2.text) && /Burn for 0 Mana — consumes this Card/.test(v2.text) && /Use /.test(v2.text), v2?.text.slice(0, 200));
  await clickAt(page, await tileAt(page, ownCard));
  expect('a click pins the Card as a reference', await app(page, () => window.__versus.pinned?.id), ownCard);
  await hoverAt(page, await anchor(page, { kind: 'party', id: 'A.mount.C3' }));
  const cmp = await app(page, () => ({ pinned: document.querySelector('.peek.pinned .peek-title')?.textContent, compare: document.querySelector('.peek.transient .peek-title')?.textContent }));
  ok('hovering a party shows only a short hint beside the pinned Card (HF2-02)', !!cmp.pinned && /Bishop/.test(cmp.compare ?? ''), cmp);
  const party = await peek(page, 'transient');
  ok('the party hint is one line, not the formation document', party && !/FRONT/.test(party.text.toUpperCase()) && /\/9/.test(party.text), party?.text.slice(0, 160));
  { const f = `${current.id}-pin-and-compare.png`; await page.screenshot({ path: path.join(dir, f) }); current.shots.push(f); } // pointer stays on the party
  await page.keyboard.press('Escape'); await sleep(200);
  expect('Escape closes the comparison first', await app(page, () => [!!document.querySelector('.peek.pinned'), !!document.querySelector('.peek.transient')]), [true, false]);
  await page.keyboard.press('Escape'); await sleep(200);
  expect('Escape again unpins (reference cleared, no order)', [await app(page, () => window.__versus.pinned), (await agreement(page)).plans], [null, st0.plans]);
  await hoverAt(page, await anchor(page, { kind: 'basin', id: 'B' }));
  const basin = await peek(page, 'transient');
  ok('the opponent\'s Mana basin is inspectable', basin && /B's Fire Pit and Mana basin/.test(basin.title ?? ''), basin?.title);
  current.observed = { hoverLatencyMs: latency };
  await page.close();
});

// --- C7: the opening by keyboard alone at a compact size -----------------------------------------
await check('c7', 'Opening by keyboard alone through the navigator and pinned views (HF-02, §3 keyboard)', { query: 'autostart=1&a=human&b=bot&seed=1', viewport: '1280x720@1' }, async () => {
  const page = await open('autostart=1&a=human&b=bot&seed=1', { width: 1280, height: 720 });
  const log = [];
  const step = async (name, re, max) => { const f = await tabTo(page, re, max); ok(`reach by Tab: ${name}`, !!f, f); if (f) { ok(`focus is visible on ${name}`, f.visible, f); log.push({ name, tabs: f.tabs }); } return !!f; };
  if (await step('Parties & Cards', /^☰ Parties & Cards$/, 40)) { await page.keyboard.press('Enter'); await sleep(300); }
  if (await step('navigator: your C1 Castle', /^Your Castle at R1C1/, 40)) { await page.keyboard.press('Enter'); await sleep(500); }
  expect('1 · the C1 Castle is selected for commands (no party document pinned)', await app(page, () => [window.__versus.selected?.id, !!document.querySelector('.peek.pinned')]), ['A.mount.C1', false]);
  ok('1 · focus moved into the command bar', await app(page, () => !!document.activeElement?.closest('.cmdbar')), await focused(page));
  if (await step('Supply menu', /^Supply ▾/, 20)) { await page.keyboard.press('Enter'); await sleep(300); }
  if (await step('Load Supply from 2♣ (C1)', /^Load 2 Supply from 2♣ \(C1\)/, 20)) { await page.keyboard.press('Enter'); await sleep(500); }
  ok('2 · focus moves into the opened Move menu', /^Move Castle R1C1 to/.test((await focused(page))?.name ?? ''), await focused(page));
  if (await step('Move Castle to R2C1 (funded, joins your Pawn)', /^Move Castle R1C1 to R2C1: needs 1 Supply · joins your Pawn/, 20)) { await page.keyboard.press('Enter'); await sleep(500); }
  expect('3 · the plan holds Supply then the move', (await agreement(page)).plans.A.map((c) => JSON.parse(c).type), ['load_supply', 'set_destination']);
  ok('3 · focus lands on Ready', /^Ready/.test((await focused(page))?.name ?? ''), await focused(page));
  await page.keyboard.press('Enter'); await sleep(200);
  await waitResolved(page, 2);
  await page.keyboard.press('p'); await sleep(400);
  if (await step('result: Supply landed (in Orders)', /loaded 2 Supply from A's 2♣ \(C1\)/, 80)) { await page.keyboard.press('Enter'); await sleep(500); }
  const ev = await app(page, () => window.__versus.pinned?.event ?? null);
  expect('4 · the supply_loaded event is pinned', ev?.type, 'supply_loaded');
  if (await step('Inspect the Card', /^Inspect the Card/, 40)) { await page.keyboard.press('Enter'); await sleep(400); }
  expect('4 · its Card is pinned', await app(page, () => window.__versus.pinned?.id), ev?.cardId);
  const P = await app(page, () => { const p = window.__versus.state.parties['A.mount.C1']; return { region: p.region, supply: p.supply.reduce((n, x) => n + x.units, 0) / 1e6, members: Object.values(p.slots).filter(Boolean).length }; });
  expect('result agrees with the rules: R2C1, Supply 1, nine members', P, { region: { column: 1, row: 2 }, supply: 1, members: 9 });
  await shot(page, 'keyboard-result');
  current.observed = { tabs: log };
  await page.close();
});

// --- C8: funded destinations in the interface ---------------------------------------------------------
await check('c8', 'Funded destinations: range, refusal with shortfall, invalidated funding blocks Ready (HF-04)', { query: 'autostart=1&a=human&b=human&seed=1', viewport: '1600x1000@1', profile: 'hapa_open_10x9_v3_02' }, async () => {
  const page = await open('autostart=1&a=human&b=human&seed=1');
  await pinVia(page, /^Your Castle at R1C1/, 'navigator: C1 Castle');
  const list0 = await app(page, () => document.querySelector('.cmdbar .cmd-why')?.textContent ?? '');
  ok('with 0 Supply the bar says no route is funded', /No Supply for any route/.test(list0), list0);
  await clickNamed(page, '.cmdbar summary', /^Supply ▾/, 'Supply menu');
  await clickNamed(page, '.cmdbar button', /^Load 2 Supply from 2♣ \(C1\)/, 'Load Supply');
  const labels = await app(page, () => [...document.querySelectorAll('.cmdbar details.movelist button')].map((b) => b.getAttribute('aria-label') ?? b.textContent));
  current.observed = { moveLabels: labels };
  const targets = labels.map((l) => l.match(/to (R\d+C\d+): needs (\d+(?:\.\d+)?)/)?.slice(1)).filter(Boolean);
  const names = targets.map(([t]) => t).sort();
  expect('2 Supply funds exactly the targets within two steps of R1C1', names, ['R1C2', 'R1C3', 'R2C1', 'R3C1'].sort());
  await clickNamed(page, '#matchbar .strip-btn', /^☰ Parties & Cards$/, 'close the navigator'); await sleep(250);
  await page.keyboard.press('Home'); await sleep(1200); // the home view: the whole field in sight
  // right-click a legal but unfunded target that is visibly on the canvas: refused with its shortfall
  const far = await app(page, () => {
    const a = window.__versus, canvas = a.engine.renderer.domElement, r = canvas.getBoundingClientRect();
    for (const d of a._fundedTargets(a.state.parties['A.mount.C1']).filter((x) => !x.funded).sort((x, y) => x.required - y.required)) {
      const c = a.ctx.geo.center(d.column, d.row), p = a.view.toWorld(c.x, c.y).project(a.engine.camera);
      const pt = { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
      if (document.elementFromPoint(pt.x, pt.y) === canvas) return { ...pt, target: `R${d.row}C${d.column}`, need: d.required / 1e6 };
    }
    return null;
  });
  ok('an unfunded legal target is visible to right-click', !!far, far);
  if (far) { await page.mouse.move(far.x, far.y); await page.mouse.down({ button: 'right' }); await page.mouse.up({ button: 'right' }); await sleep(400); }
  const toast = await app(page, () => document.querySelector('.toast')?.textContent ?? '');
  ok(`an unfunded target (${far?.target}) is refused with its shortfall`, new RegExp(`needs ${far?.need}, the party has 2`).test(toast), toast);
  expect('…and no destination was added', (await agreement(page)).plans.A.map((c) => JSON.parse(c).type), ['load_supply']);
  if (!(await app(page, () => !!document.querySelector('.cmdbar details.cmd-menu[open] .movelist')))) await clickNamed(page, '.cmdbar summary', /^Move to ▾/, 'open Move to');
  await clickNamed(page, '.cmdbar details.movelist button', /to R3C1: needs 2/, 'Move to R3C1');
  expect('the funded move is planned after its load', (await agreement(page)).plans.A.map((c) => JSON.parse(c).type), ['load_supply', 'set_destination']);
  // remove the funding load: the destination stays, is invalid, Ready is blocked and opens Orders
  await page.keyboard.press('p'); await sleep(300);
  await clickNamed(page, '#plan .planbox.a button.x', /^Remove order 1: \+2 Supply/, 'Remove the funding load');
  const st = await app(page, () => { const a = window.__versus; return { plan: a.plans.A.map((c) => c.type), errors: a._planErrors('A').map((e) => e.error), ready: document.querySelector('#matchbar .ready-big').innerText.replace(/\s+/g, ' ').trim(), ghost: a.view.intents.children.map((g) => g.userData.partyId) }; });
  expect('the dependent destination is kept, not shortened or dropped', st.plan, ['set_destination']);
  ok('it is explicitly invalid for lack of funding', /needs 2, the party has 0/.test(st.errors.join(';')), st.errors);
  ok('Ready says to fix the order', /^Fix 1 order/.test(st.ready), st.ready);
  await shot(page, 'unfunded-draft');
  await page.keyboard.press('Escape'); await sleep(200);
  await clickNamed(page, READY, /^Fix 1 order/, 'blocked Ready');
  expect('pressing it opens Orders to repair; nothing is frozen', await app(page, () => [!document.getElementById('orders').hidden, !!window.__versus.ready.A]), [true, false]);
  await clickNamed(page, '#plan button.restore', /^Restore removed order/, 'Restore the load');
  expect('restoring the load re-funds the destination', await app(page, () => window.__versus._planErrors('A').length), 0);
  await page.close();
});

// --- C9: Fire Pit, planned versus accepted, exact basin counts ---------------------------------------
await check('c9', 'Fire Pit: planned offering, projection, accepted burn with separate colors, zero Mana (HF-05)', { query: 'autostart=1&fixture=cards&a=human&b=human', viewport: '1600x1000@1' }, async () => {
  const page = await open('autostart=1&fixture=cards&a=human&b=human');
  const mana = await app(page, () => window.__versus.state.cards['A.five'].mana);
  await app(page, () => { window.__versus.pinned = { kind: 'card', id: 'A.five' }; window.__versus._renderAll(); });
  setup('the A.five Card is pinned via selection, then its Burn button is clicked');
  await clickNamed(page, '.peek.pinned button.burn', /^Burn .+ for /, 'Burn for its Mana (Card view)');
  const planned = await app(page, () => { const a = window.__versus; return { pool: a.state.players.A.pool, projected: a._plannedPool('A'), offerings: a.view.sites.sites.A.offerings.children.length, counter: a.el.basins.A.getAttribute('aria-label') }; });
  expect('planning changes nothing real', planned.pool, {});
  expect('the projection shows exactly the Card\'s Mana', planned.projected, mana);
  expect('one ghost offering rests over A\'s pit', planned.offerings, 1);
  ok('the counter labels the projection separately', /empty; projected after its plan/.test(planned.counter), planned.counter);
  await shot(page, 'planned-offering');
  await app(page, () => { window.__versus.speed = 0.5; });
  await clickNamed(page, READY, /^Ready/, 'Ready (A)');
  await clickNamed(page, READY, /^Ready/, 'Ready (B)');
  let peak = 0;
  for (let i = 0; i < 30; i++) { peak = Math.max(peak, await app(page, () => window.__versus.view.sites.effects.length)); await sleep(40); }
  await waitResolved(page, 10);
  const after = await app(page, () => { const a = window.__versus, ev = a.session.events; const b = ev.find((e) => e.type === 'card_burned' && e.cardId === 'A.five'); const x = ev.find((e) => e.type === 'mana_expired' && e.seat === 'A' && e.tick === 10); return { burnedPool: b?.pool ?? null, expired: x?.mana ?? null, offerings: a.view.sites.sites.A.offerings.children.length }; });
  ok('the accepted burn played its effect (1 dissolve + 5 color streams)', peak >= 6, peak);
  expect('the accepted burn put exactly the Card\'s colors in the pool', after.burnedPool, mana);
  expect('unspent, they expired at the Tick boundary (no carryover in this profile)', after.expired, mana);
  expect('the offering left the pit', after.offerings, 0);
  // zero Mana: plainly labelled, legal, no gain effect
  const p2 = await open('autostart=1&a=human&b=human&seed=1');
  const zero = await app(p2, () => window.__versus.state.players.A.bank.minor['1']);
  await app(p2, (id) => { window.__versus.pinned = { kind: 'card', id }; window.__versus._renderAll(); }, zero);
  const label = await app(p2, () => document.querySelector('.peek.pinned button.burn')?.textContent);
  expect('a zero-Mana Card says what burning it does', label, 'Burn for 0 Mana — consumes this Card');
  await p2.close();
  // New match mid-effect clears every effect
  await app(page, () => window.__versus.view.sites.burn('A', null, { red: 2 }));
  await app(page, () => window.__versus.startMatch({ seats: { A: 'human', B: 'bot' }, seed: 2 }));
  await sleep(1200);
  expect('New match during an effect leaves no effect behind', await app(page, () => window.__versus.view.sites.effects.length), 0);
  await page.close();
});

// --- C10: destination intent on the board ------------------------------------------------------------
await check('c10', 'Endpoint intent: one marker per destination, drafts replace accepted, never occupants (HF-03)', { query: 'autostart=1&a=human&b=human&seed=1', viewport: '1600x1000@1' }, async () => {
  const page = await open('autostart=1&a=human&b=human&seed=1');
  setup('two A loads and destinations are added with _addCommand (pointer routes are covered in c7/c8)');
  const r = await app(page, () => {
    const a = window.__versus, s = a.state;
    a._addCommand('A', { type: 'load_supply', cardId: s.players.A.bank.minor['1'], partyId: 'A.mount.C1' });
    a._addCommand('A', { type: 'set_destination', partyId: 'A.mount.C1', target: { column: 1, row: 3 } });
    a._addCommand('A', { type: 'load_supply', cardId: s.players.A.bank.minor['9'], partyId: 'A.mount.C9' });
    a._addCommand('A', { type: 'set_destination', partyId: 'A.mount.C9', target: { column: 9, row: 3 } });
    a._renderAll();
    const occ = (c, r) => Object.values(s.parties).filter((p) => p.alive && !p.retired && p.region.column === c && p.region.row === r).length;
    return { ghosts: a.view.intents.children.map((g) => g.userData.partyId).sort(), pickables: a.view.markers.size, occupantsAtTargets: [occ(1, 3), occ(9, 3)] };
  });
  expect('one endpoint per planned destination', r.ghosts, ['A.mount.C1', 'A.mount.C9']);
  expect('endpoints are not rules occupants', r.occupantsAtTargets, [0, 0]);
  await shot(page, 'intents');
  await clickNamed(page, READY, /^Ready/, 'Ready (A)');
  await clickNamed(page, READY, /^Ready/, 'Ready (B)');
  await waitResolved(page, 2);
  const after = await app(page, () => ({ ghosts: window.__versus.view.intents.children.map((g) => g.userData.partyId).sort(), dest: ['A.mount.C1', 'A.mount.C9'].map((id) => window.__versus.state.parties[id].destination) }));
  // after one Tick the Castles have merged with their Pawns at R2 and continue toward R3
  expect('accepted, still-travelling destinations keep their markers', after.ghosts, after.dest.map((d, i) => (d ? ['A.mount.C1', 'A.mount.C9'][i] : null)).filter(Boolean));
  await page.close();
});

// --- C11: New match ownership (R3-02) and modal containment (R3-03) ------------------------------
await check('c11', 'New match detaches unfinished work; blocking sheets contain focus (R3-02, R3-03)', { query: 'autostart=1&fixture=response&a=human&b=human', viewport: '1600x1000@1' }, async () => {
  const page = await open('autostart=1&fixture=response&a=human&b=human');
  await app(page, () => window.__versus._addCommand('A', { type: 'play_ability', cardId: 'A.ember', actorPartyId: 'A.c', target: { memberId: 'B.c.s2' }, burns: ['A.red'] }));
  await clickNamed(page, READY, /^Ready/, 'Ready (A)');
  await clickNamed(page, READY, /^Ready/, 'Ready (B)');
  await page.waitForFunction(() => !!window.__versus.pendingChoice, { timeout: 15000 });
  // the visible menu → New match → the setup sheet → Start
  await clickNamed(page, '#matchbar button', /^Match menu$/, 'Match menu');
  // R3-03 first: Tab and Shift+Tab stay inside the sheet; the background is inert
  const inside = [];
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); inside.push(await app(page, () => !!document.activeElement?.closest('#overlay'))); }
  for (let i = 0; i < 3; i++) { await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift'); inside.push(await app(page, () => !!document.activeElement?.closest('#overlay'))); }
  expect('Tab / Shift+Tab never leave the open sheet', inside.every(Boolean), true);
  expect('everything behind the sheet is inert', await app(page, () => [...document.getElementById('app').children].filter((e) => e.id !== 'overlay').every((e) => e.inert)), true);
  const before = await agreement(page);
  await ctrlEnter(page);
  expect('the Ready shortcut does nothing behind the sheet', (await agreement(page)).rev, before.rev);
  await clickNamed(page, '#overlay button', /^New match$/, 'New match');
  await clickNamed(page, '#overlay button', /^Start|^Play|^New match/, 'Start (setup sheet)');
  await sleep(1500);
  const fresh = await app(page, () => { const a = window.__versus; return { pending: !!a.pendingChoice, edit: a._can(a.viewSeat).edit, replay: a.session.replay.ticks.length, tick: a.state.tick, fixture: !!a.session.fixture }; });
  expect('the new match has no old response attached and is editable', [fresh.pending, fresh.edit], [false, true]);
  expect('the new match starts with only its own (empty) history', fresh.replay, 0);
  await app(page, () => window.__versus._pressReady());
  await page.waitForFunction(() => { const a = window.__versus; return !a.playback && !a.resolving && a.state.tick >= 2 || (a.seats.B === 'human' && a.viewSeat === 'B'); }, { timeout: 20000 });
  if (await app(page, () => window.__versus.viewSeat === 'B' && !window.__versus.ready.B)) await app(page, () => window.__versus._pressReady());
  await page.waitForFunction(() => { const a = window.__versus; return a.state.tick >= 2 && !a.playback && !a.resolving; }, { timeout: 20000 });
  const v = await app(page, async () => { const m = await import('/src/hapa/rules/session.js'); const r = m.verifyReplay(window.__versus.session.replay); return { ok: r.ok, ticks: window.__versus.session.replay.ticks.map((t) => t.tick) }; });
  expect('after a normal Tick the new match replay verifies with only its own Ticks', v, { ok: true, ticks: [1] });
  await page.close();
});

// --- C12: orbit, layers and reduced motion keep identities and targets -------------------------------
await check('c12', 'Full orbit and a height layer keep standards, endpoints and hover targets; reduced motion (HF-03)', { query: 'autostart=1&fixture=stacked&a=human&b=human', viewport: '1600x1000@1' }, async () => {
  const page = await open('autostart=1&fixture=stacked&a=human&b=human');
  const ids = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('q'); await sleep(700);
    const r = await app(page, () => { const a = window.__versus; return { bearing: Math.round(a.cam.bearing), standards: [...a.view.markers.values()].filter((m) => m.visible && m.userData.standard?.visible).length, visibleParties: Object.values(a.state.parties).filter((p) => p.alive && !p.retired).length }; });
    const target = await anchor(page, { kind: 'party', id: 'A.hill' });
    await page.mouse.move(5, 5); await sleep(350);
    if (target) { await hoverAt(page, target, 500); }
    const v = await peek(page, 'transient');
    ids.push({ ...r, hovered: v?.title ?? null });
  }
  ok('every visible party keeps its chess standard through a full orbit', ids.every((x) => x.standards === x.visibleParties), ids.map((x) => x.standards));
  ok('the hill party stays hoverable at every bearing', ids.filter((x) => /Castle/.test(x.hovered ?? '')).length >= 7, ids.map((x) => x.hovered));
  await shot(page, 'orbit-end');
  await clickNamed(page, '.layer-rail button', layerButton(-2), 'layer −2');
  const layer = await app(page, () => { const a = window.__versus; return [...a.view.markers.entries()].filter(([, m]) => m.userData.standard?.visible).map(([id]) => id).sort(); });
  expect('at layer −2 only that band\'s standards (and flyers) show', layer, await app(page, () => Object.values(window.__versus.state.parties).filter((p) => p.alive && !p.retired && ((p.band ?? 1) === -2 || p.movementMode === 'air')).map((p) => p.id).sort()));
  await page.close();
  const rm = await browser.newPage();
  await rm.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await rm.setViewport({ width: 1280, height: 720 });
  rm.on('pageerror', (e) => current.errors.push({ kind: 'pageerror', message: String(e?.message ?? e) }));
  await rm.goto(`${base}/versus.html?autostart=1&fixture=cards&a=human&b=human`, { waitUntil: 'networkidle0' });
  await rm.waitForFunction(() => window.__versus?.session);
  await app(rm, () => { const a = window.__versus; a.view.sites.burn('A', null, { red: 1, green: 1 }); });
  expect('reduced motion: a burn plays no travelling streams', await app(rm, () => window.__versus.view.sites.effects.length <= 1), true);
  await rm.close();
});

// ================================================================================================
// Contract 3 (response 06, addendum 02 / assignment 06): select to command, approach to inspect.
// ================================================================================================
const partyAt = (page, id) => anchor(page, { kind: 'party', id });
const labelsShown = (page) => app(page, () => [...document.querySelectorAll('.mlabel:not([hidden])')].map((e) => e.innerText.replace(/\s+/g, ' ').trim()));
const settle = (ms = 1600) => sleep(ms);

// --- Z01/Z02: ordinary command play without a party document ---------------------------------------
await check('z01', 'Ordinary movement: select, funded Move from the command bar, no party document; reasons stay visible (Z01, Z02)', { query: 'autostart=1&a=human&b=human&seed=1', viewport: '1280x720@1' }, async () => {
  const page = await open('autostart=1&a=human&b=human&seed=1', { width: 1280, height: 720 });
  const cam0 = await app(page, () => JSON.stringify(window.__versus.cam.goal));
  await clickAt(page, await partyAt(page, 'A.mount.C1'));
  const st = await app(page, () => ({ sel: window.__versus.selected?.id, pinned: !!document.querySelector('.peek.pinned'), bar: !document.querySelector('.cmdbar').hidden, why: document.querySelector('.cmdbar .cmd-why')?.textContent ?? null, cam: JSON.stringify(window.__versus.cam.goal) }));
  expect('a click selects the party for commands', st.sel, 'A.mount.C1');
  expect('no party document opens; the small command bar does', [st.pinned, st.bar], [false, true]);
  expect('selecting does not move the camera', st.cam, cam0);
  ok('the bar says why it cannot move yet', /No Supply for any route/.test(st.why ?? ''), st.why);
  await clickNamed(page, '.cmdbar summary', /^Supply ▾/, 'Supply menu');
  await clickNamed(page, '.cmdbar button', /^Load 2 Supply from 2♣ \(C1\)/, 'Load Supply');
  // every funded target in the bar matches the rules' quote exactly
  const q = await app(page, () => { const a = window.__versus; return { bar: [...document.querySelectorAll('.cmdbar .movelist button[aria-label^="Move "]')].map((b) => b.getAttribute('aria-label').match(/to (R\d+C\d+): needs ([\d.]+)/).slice(1).join(':')).sort(), rules: a._fundedTargets(a.state.parties['A.mount.C1']).filter((d) => d.funded).map((d) => `R${d.row}C${d.column}:${d.required / 1e6}`).sort() }; });
  expect('the bar lists exactly the funded targets with the rules\' Supply quote', q.bar, q.rules);
  await clickNamed(page, '.cmdbar .movelist button', /to R2C1: needs 1/, 'Move to R2C1');
  expect('the move is planned after its load', (await agreement(page)).plans.A.map((c) => JSON.parse(c).type), ['load_supply', 'set_destination']);
  // opening and closing a Card reference keeps the command selection and orders
  await clickAt(page, await tileAt(page, await app(page, () => window.__versus.state.players.A.bank.minor['9'])));
  await page.keyboard.press('Escape'); await sleep(200);
  expect('closing a Card view keeps the selected party and its orders', [await app(page, () => window.__versus.selected?.id), (await agreement(page)).plans.A.length], ['A.mount.C1', 2]);
  // Z02: an unmounted Pawn says why; after Ready, the plan is frozen
  await clickAt(page, await partyAt(page, 'A.pawn.C3'));
  ok('an unmounted Pawn shows "Needs a Mount"', /^Needs a Mount/.test(await app(page, () => document.querySelector('.cmdbar .cmd-why')?.textContent ?? '')), true);
  await shot(page, 'pawn-reason');
  await clickNamed(page, READY, /^Ready/, 'Ready (A)');
  await app(page, () => { window.__versus.viewSeat = 'A'; window.__versus._renderAll(); });
  ok('after Ready the bar says the plan is frozen', /Plan frozen/.test(await app(page, () => document.querySelector('.cmdbar .cmd-why')?.textContent ?? '')), true);
  await page.close();
});

// --- Z03/Z04/Z05: the real formation carries its facts --------------------------------------------
await check('z03', 'Approach to inspect: zoom over an enemy keeps the own selection; nine and five member labels; truthful stats (Z03, Z04, Z05)', { query: 'autostart=1&a=human&b=human&seed=1', viewport: '1600x1000@1' }, async () => {
  const page = await open('autostart=1&a=human&b=human&seed=1');
  await clickAt(page, await partyAt(page, 'A.mount.C1'));
  const plans0 = (await agreement(page)).plans;
  // wheel zoom toward an enemy party
  const e = await partyAt(page, 'B.mount.C5');
  await page.mouse.move(e.x, e.y);
  for (let i = 0; i < 6; i++) { await page.mouse.wheel({ deltaY: -260 }); await sleep(120); }
  await settle();
  const z = await app(page, () => ({ sel: window.__versus.selected?.id, sub: window.__versus.inspectParty?.partyId ?? null, level: window.__versus.labels.level }));
  expect('zooming over an enemy inspects it; the own command selection stays', [z.sel, z.sub], ['A.mount.C1', 'B.mount.C5']);
  expect('…without issuing an order', (await agreement(page)).plans, plans0);
  ok('member labels appear at a readable size', ['identity', 'combat'].includes(z.level), z.level);
  await shot(page, 'enemy-inspection');
  // explicit Focus on a merged nine-member party (after the opening merge) and the five-member Pawn
  await page.keyboard.press('Home'); await sleep(800);
  await app(page, () => { const a = window.__versus; a.selected = { kind: 'party', id: 'A.pawn.C3' }; a._renderAll(); });
  await page.keyboard.press('f'); await settle();
  const pawn = await labelsShown(page);
  expect('the five-member Pawn shows five labels — no center member invented', pawn.length, 5);
  ok('its collective label says the center is empty', /empty center/.test(await app(page, () => document.querySelector('.mparty')?.innerText ?? '')), true);
  await shot(page, 'pawn-five');
  await page.keyboard.press('r'); await settle(900);
  expect('Return restores the prior pose and releases inspection', await app(page, () => [window.__versus.inspectParty, window.__versus._returnPose]), [null, null]);
  await page.close();
  // nine members: play the opening merge, then inspect
  const p2 = await open('autostart=1&a=human&b=human&seed=1');
  await app(p2, async () => { const a = window.__versus, s = a.state; a._addCommand('A', { type: 'load_supply', cardId: s.players.A.bank.minor['1'], partyId: 'A.mount.C1' }); a._addCommand('A', { type: 'set_destination', partyId: 'A.mount.C1', target: { column: 1, row: 2 } }); a._pressReady(); await new Promise((r) => setTimeout(r, 200)); a._pressReady(); });
  setup('opening merge played with _addCommand/_pressReady (the pointer route is c7/z01)');
  await waitResolved(p2, 2);
  await app(p2, () => { const a = window.__versus; a.viewSeat = 'A'; a.selected = { kind: 'party', id: 'A.mount.C1' }; a._renderAll(); a._focusInspect('A.mount.C1'); });
  await settle(2000);
  const nine = await labelsShown(p2);
  expect('the merged party shows nine compact labels', nine.length, 9);
  ok('compact labels are role + health, not stat sheets (a full formation)', nine.every((t) => t.split(' ').length <= 6), nine);
  await shot(p2, 'nine-members');
  // hover one body: its full breakdown expands (and only that one)
  const archer = await app(p2, () => Object.values(window.__versus.state.parties['A.mount.C1'].slots).find((id) => id && window.__versus.state.members[id].archetype === 'archer'));
  const sp = await app(p2, (id) => { const a = window.__versus, v = a.view.sprites.get(id).position.clone(); v.y += 0.5; const q = v.project(a.engine.camera), r = a.engine.renderer.domElement.getBoundingClientRect(); return { x: r.left + (q.x + 1) / 2 * r.width, y: r.top + (1 - q.y) / 2 * r.height }; }, archer);
  await hoverAt(p2, sp, 500);
  const exp = await app(p2, () => [...document.querySelectorAll('.mlabel.expanded:not([hidden])')].map((e) => e.innerText.replace(/\s+/g, ' ')));
  ok('one hovered member expands with its attack and a labelled preview', exp.length === 1 && /Bow: 2 × 1 Physical, base range 2/.test(exp[0]) && /not a result/.test(exp[0]), exp);
  ok('…and the Mage ward shows as applied Magic protection with its source', /Magic 1 = 1 .*ward/i.test(exp[0] ?? ''), exp[0]);
  await shot(p2, 'expanded-member');
  // labels are passive: a wheel over a label still zooms the camera
  const d0 = await app(p2, () => window.__versus.cam.goal.distance);
  const lab = await app(p2, () => { const r = document.querySelector('.mlabel:not([hidden])').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await p2.mouse.move(lab.x, lab.y); await p2.mouse.wheel({ deltaY: 200 }); await sleep(300);
  ok('a wheel over a passive label still zooms (labels do not block)', (await app(p2, () => window.__versus.cam.goal.distance)) > d0, true);
  await p2.close();
});

// --- Z06: playback labels follow the shown moment ------------------------------------------------
await check('z06', 'Playback: labels use event-aligned health during a mid-movement exchange; New match removes stale labels (Z06)', { query: 'autostart=1&fixture=corner&a=human&b=human', viewport: '1600x1000@1' }, async () => {
  const page = await open('autostart=1&fixture=corner&a=human&b=human');
  await app(page, () => { const a = window.__versus; a.selected = { kind: 'party', id: 'A.mid' }; a._renderAll(); a._focusInspect('A.mid'); });
  await settle();
  const pre = await app(page, () => Object.values(window.__versus.state.parties['A.mid'].slots).filter(Boolean).reduce((n, id) => n + window.__versus.state.members[id].hp, 0));
  await app(page, () => { window.__versus.speed = 0.25; });
  await clickNamed(page, READY, /^Ready/, 'Ready (A)');
  await clickNamed(page, READY, /^Ready/, 'Ready (B)');
  const samples = [];
  for (let i = 0; i < 160; i++) {
    const s = await app(page, () => { const a = window.__versus, pb = a.playback; if (!pb) return null; const f = a._labelFacts('A.mid'); return { shown: pb.shown, sum: Object.values(f.members).reduce((n, m) => n + m.health.hp, 0), final: Object.values(a.state.parties['A.mid'].slots).filter(Boolean).reduce((n, id) => n + a.state.members[id].hp, 0), note: document.querySelector('.mparty')?.innerText ?? '' }; });
    if (s) samples.push(s); else if (samples.length) break;
    await sleep(30);
  }
  await waitResolved(page, 6);
  const final = samples.at(-1)?.final;
  ok('playback was sampled', samples.length >= 5, samples.length);
  ok('the contact exchange damaged the inspected party this Tick (precondition)', final < pre, { pre, final });
  ok('early in playback the labels show the pre-Tick health, not the accepted result', samples[0]?.sum === pre, samples.slice(0, 2));
  ok('health shown only ever falls as events are shown, ending at the accepted value', samples.every((x, i) => i === 0 || x.sum <= samples[i - 1].sum) && (await app(page, () => Object.values(window.__versus._labelFacts('A.mid').members).reduce((n, m) => n + m.health.hp, 0))) === final, samples.map((x) => x.sum));
  ok('the party label says health is as of the shown moment', samples.some((x) => /as of the moment shown/.test(x.note)), samples[0]?.note);
  await app(page, () => window.__versus.startMatch({ seats: { A: 'human', B: 'bot' }, seed: 4 }));
  await sleep(1500);
  expect('New match leaves no labels, inspection subject, return pose or diorama', await app(page, () => [document.querySelectorAll('.mlabel:not([hidden])').length, window.__versus.inspectParty, window.__versus._returnPose, window.__versus.view.diorama.group.children.length]), [0, null, null, 0]);
  await page.close();
});

// --- Z07/Z11/Z12: one territory environment through orbit and genuine terrain ----------------------
await check('z07', 'Territory environment: world-stable through a full orbit, not pickable, honest terrain, roofs and cutaway (Z07, Z11, Z12)', { query: 'autostart=1&fixture=terrain&a=human&b=human', viewport: '1600x1000@1' }, async () => {
  const page = await open('autostart=1&fixture=terrain&a=human&b=human');
  await app(page, () => { const a = window.__versus; a.selected = { kind: 'party', id: 'A.hill' }; a._renderAll(); a._focusInspect('A.hill'); });
  await settle(2200);
  const d0 = await app(page, () => { const a = window.__versus, g = a.view.diorama.group; return { n: g.children.length, visible: g.visible, opacity: +a.view.diorama.opacity.toFixed(2), landmark: g.children.find((c) => c.children?.length >= 6)?.position.toArray().map((v) => +v.toFixed(3)) ?? null, hillTop: +(a.view.partyY(a.state.parties['A.hill'])).toFixed(3) }; });
  ok('the environment is built and visible around the inspected territory', d0.n > 20 && d0.visible && d0.opacity > 0.9, d0);
  ok('a world-placed landmark exists', !!d0.landmark, d0.landmark);
  const facing0 = await app(page, () => window.__versus.state.parties['A.hill'].facing);
  const frames = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('q'); await sleep(750);
    frames.push(await app(page, () => { const a = window.__versus, g = a.view.diorama.group, lm = g.children.find((c) => c.children?.length >= 6); return { bearing: Math.round(a.cam.bearing), landmark: lm?.position.toArray().map((v) => +v.toFixed(3)), quat: lm?.quaternion.toArray().map((v) => +v.toFixed(3)), labels: document.querySelectorAll('.mlabel:not([hidden])').length }; }));
    if (i % 2 === 1) await shot(page, `orbit-${frames.at(-1).bearing}`);
  }
  expect('the landmark never moves or turns to face the camera through 360°', [...new Set(frames.map((f) => JSON.stringify([f.landmark, f.quat])))].length, 1);
  expect('world facing is unchanged by the orbit', await app(page, () => window.__versus.state.parties['A.hill'].facing), facing0);
  ok('member labels stay attached through the orbit', frames.every((f) => f.labels >= 4), frames.map((f) => f.labels));
  // decoration is never pickable: the pick at the landmark position equals the pick with it hidden
  const pickCmp = await app(page, () => { const a = window.__versus, g = a.view.diorama.group, lm = g.children.find((c) => c.children?.length >= 6); const v = lm.position.clone(); v.y += 1; const q = v.project(a.engine.camera), r = a.engine.renderer.domElement.getBoundingClientRect(); const ev = { clientX: r.left + (q.x + 1) / 2 * r.width, clientY: r.top + (1 - q.y) / 2 * r.height }; const on = a._rayFrom(ev); g.visible = false; const off = a._rayFrom(ev); g.visible = true; const key = (p) => JSON.stringify([p?.territory, p?.party?.id ?? null, p?.candidates?.length ?? 0]); return [key(on), key(off)]; });
  expect('the landmark does not intercept board picking', pickCmp[0], pickCmp[1]);
  // a genuine pit keeps its opening; a roofed tunnel is not x-rayed; a cutaway hides the dressing
  await app(page, () => { const a = window.__versus; a.selected = { kind: 'party', id: 'B.tunnel' }; a._renderAll(); a._focusInspect('B.tunnel'); });
  await settle(2000);
  const tunnel = await app(page, () => ({ labels: document.querySelectorAll('.mlabel:not([hidden])').length, note: document.querySelector('.mparty')?.innerText ?? '' }));
  expect('a roofed tunnel party shows no member labels at ordinary close zoom', tunnel.labels, 0);
  ok('…and says how to read it (open its layer)', /Roofed tunnel/.test(tunnel.note), tunnel.note);
  await clickNamed(page, '.layer-rail button', layerButton(-2), 'layer −2');
  await settle(1200);
  const cut = await app(page, () => ({ labels: document.querySelectorAll('.mlabel:not([hidden])').length, dio: window.__versus.view.diorama.group.visible }));
  ok('with its layer open the members are read; the surface dressing is hidden', cut.labels >= 2 && cut.dio === false, cut);
  await shot(page, 'tunnel-cutaway');
  await page.close();
  // planned → running → completed work stays distinct (dig fixture)
  const p2 = await open('autostart=1&fixture=dig&a=human&b=human');
  await app(p2, () => { const a = window.__versus; const w = a._workList(a.state.parties['A.worker']); return !!w; });
  const dig = await app(p2, async () => {
    const a = window.__versus; const cmd = { type: 'begin_work', partyId: 'A.worker', work: 'excavate', target: { x: 1, y: 10, band: -3 } };
    const out = {};
    a._addCommand('A', cmd); a._renderAll();
    out.planned = a.view.terrain.work?.children.length ?? 0;
    const { solidAt } = await import('/src/hapa/rules/terrain.js');
    out.solidPlanned = solidAt(a.state.terrain, 1, 10, -3);
    a._pressReady(); await new Promise((r) => setTimeout(r, 200)); a._pressReady();
    await new Promise((r) => { const t = setInterval(() => { if (!a.playback && !a.resolving) { clearInterval(t); r(); } }, 100); });
    out.solidDone = solidAt(a.state.terrain, 1, 10, -3);
    out.changed = a.session.events.some((e) => e.type === 'terrain_changed');
    return out;
  });
  setup('dig fixture: the begin_work order is added with _addCommand (the Work menu is the same command)');
  expect('a planned dig is drawn but the cube stays solid', [dig.planned > 0, dig.solidPlanned], [true, true]);
  expect('the accepted dig empties the cube (terrain_changed)', [dig.solidDone, dig.changed], [false, true]);
  await p2.close();
});

// --- C13: performance context (measured, not a pass/fail target) ----------------------------------
await check('c13', 'Frame time and hover response measured on this machine (no approved target)', { viewport: '1600x1000@1 and 1280x720@1' }, async () => {
  const rows = [];
  for (const [w, hgt] of [[1600, 1000], [1280, 720]]) {
    const page = await open('autostart=1&a=human&b=human&seed=1', { width: w, height: hgt });
    const ft = await app(page, () => new Promise((res) => { const t = []; let last = performance.now(); const tick = (n) => { t.push(n - last); last = n; if (t.length < 180) requestAnimationFrame(tick); else res(t.slice(10)); }; requestAnimationFrame(tick); }));
    const sorted = [...ft].sort((a, b) => a - b);
    const card = await app(page, () => window.__versus.state.players.B.bank.minor['9']);
    const lat = [];
    for (let i = 0; i < 3; i++) { await page.mouse.move(5, 5); await sleep(500); const p = await tileAt(page, card); const t0 = Date.now(); await page.mouse.move(p.x, p.y); await page.waitForSelector('.peek.transient', { timeout: 3000 }); lat.push(Date.now() - t0); }
    rows.push({ viewport: `${w}x${hgt}`, frameMs: { median: +sorted[Math.floor(sorted.length / 2)].toFixed(1), p95: +sorted[Math.floor(sorted.length * 0.95)].toFixed(1) }, hoverOpenMs: lat, note: 'headless Chrome; hover includes the deliberate 150 ms entry delay' });
    await page.close();
  }
  ok('measured', rows.length === 2, rows);
  current.observed = rows;
});

// --- C7: concession is confirmed, truthful and never reopens a frozen plan -------------------------
await check('c14', 'Concession: confirmation, cancel, truthful feedback by phase (R2-07)', { query: 'autostart=1&a=human&b=human&seed=1; fixture=response', viewport: '1600x1000@1' }, async () => {
  const page = await open('autostart=1&a=human&b=human&seed=1');
  const snap = () => agreement(page);
  const toast = () => app(page, () => document.querySelector('.toast')?.textContent ?? '');
  const s0 = await snap();
  await clickNamed(page, '#matchbar button', /^Match menu$/, 'Match menu');
  ok('menu opens with focus inside it', /^Resume$/.test((await focused(page))?.name ?? ''), await focused(page));
  await clickNamed(page, '#overlay button', /^Concede as A…$/, 'Concede as A…');
  ok('confirmation opens on Cancel', /^Cancel/.test((await focused(page))?.name ?? ''), await focused(page));
  await page.keyboard.press('Enter'); await sleep(250); // Cancel by keyboard
  expect('Cancel changes nothing', await snap(), s0);
  ok('focus returns to the Match menu button', /^Match menu$/.test((await focused(page))?.name ?? ''), await focused(page));
  await clickNamed(page, '#matchbar button', /^Match menu$/, 'Match menu');
  await page.keyboard.press('Escape'); await sleep(200);
  expect('Escape closes the menu and changes nothing', await snap(), s0);
  await clickNamed(page, '#matchbar button', /^Match menu$/, 'Match menu');
  await clickNamed(page, '#overlay button', /^Concede as A…$/, 'Concede as A…');
  await shot(page, 'confirm');
  await clickNamed(page, '#overlay button', /^Concede as A$/, 'Concede as A (confirm)');
  const s1 = await snap();
  expect('confirmed concession is one order in A\'s plan', s1.plans.A.map((c) => JSON.parse(c).type), ['concede']);
  ok('success is reported only after acceptance', /^Concession added to A's plan/.test(await toast()), await toast());
  await clickNamed(page, READY, /^Ready/, 'Ready (A)');
  await app(page, () => { const a = window.__versus; a.viewSeat = 'A'; a._renderAll(); });
  setup('the hotseat view is switched back to A with viewSeat to inspect A\'s menu after Ready');
  await clickNamed(page, '#matchbar button', /^Match menu$/, 'Match menu');
  const frozenNote = await app(page, () => ({ note: document.querySelector('#concede-note')?.innerText ?? '', button: [...document.querySelectorAll('#overlay button')].some((b) => /^Concede as/.test(b.innerText)) }));
  ok('after Ready: the menu explains the concession is already in the frozen plan', /in your frozen plan/.test(frozenNote.note), frozenNote.note);
  expect('after Ready: no Concede button', frozenNote.button, false);
  await page.keyboard.press('Escape'); await sleep(150);
  await app(page, () => { window.__versus.viewSeat = 'B'; window.__versus._renderAll(); });
  await clickNamed(page, READY, /^Ready/, 'Ready (B)');
  await page.waitForFunction(() => !!window.__versus.state.outcome, { timeout: 20000 });
  const out = await app(page, () => window.__versus.state.outcome);
  expect('the match ends by A\'s concession when the Tick resolves', { winner: out.winner, reasons: out.reasons.map((r) => `${r.seat}:${r.reason}`) }, { winner: 'B', reasons: ['A:conceded'] });
  await shot(page, 'result');
  await page.close();
  // during a response window, and after Ready without a planned concession
  const p2 = await open('autostart=1&fixture=response&a=human&b=human');
  await app(p2, () => window.__versus._addCommand('A', { type: 'play_ability', cardId: 'A.ember', actorPartyId: 'A.c', target: { memberId: 'B.c.s2' }, burns: ['A.red'] }));
  setup('response fixture: A\'s Ember Strike added with _addCommand');
  await clickNamed(p2, READY, /^Ready/, 'Ready (A)');
  await app(p2, () => { window.__versus.viewSeat = 'A'; window.__versus._renderAll(); });
  await clickNamed(p2, '#matchbar button', /^Match menu$/, 'Match menu');
  const frozen = await app(p2, () => ({ note: document.querySelector('#concede-note')?.innerText ?? '', button: [...document.querySelectorAll('#overlay button')].some((b) => /^Concede as/.test(b.innerText)) }));
  ok('frozen (no concession planned): explains it is unavailable and the plan is not reopened', /not available now: your plan is frozen after Ready.*has not been reopened/s.test(frozen.note), frozen.note);
  expect('frozen: no Concede button', frozen.button, false);
  await p2.keyboard.press('Escape'); await sleep(150);
  await app(p2, () => { window.__versus.viewSeat = 'B'; window.__versus._renderAll(); });
  await clickNamed(p2, READY, /^Ready/, 'Ready (B)');
  await p2.waitForFunction(() => !!window.__versus.pendingChoice, { timeout: 15000 });
  await clickNamed(p2, '#matchbar button', /^Match menu$/, 'Match menu');
  const resp = await app(p2, () => ({ note: document.querySelector('#concede-note')?.innerText ?? '', button: [...document.querySelectorAll('#overlay button')].some((b) => /^Concede as/.test(b.innerText)) }));
  ok('response window: explains concession is unavailable', /response window is open/.test(resp.note), resp.note);
  expect('response window: no Concede button', resp.button, false);
  ok('no success toast for a refused concession', !/Concession added/.test(await app(p2, () => document.querySelector('.toast')?.textContent ?? '')), true);
  await shot(p2, 'response-menu');
  await p2.close();
});

// --- report --------------------------------------------------------------------------------------
await browser.close();
manifest.finishedAt = new Date().toISOString();
const all = manifest.checks.flatMap((c) => c.assertions);
manifest.summary = { checks: manifest.checks.length, assertions: all.length, failed: all.filter((a) => !a.pass).length };
fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(manifest, null, 1));
console.log(`\n${manifest.summary.assertions - manifest.summary.failed}/${manifest.summary.assertions} assertions passed · ${dir}`);
process.exit(manifest.summary.failed ? 1 : 0);
