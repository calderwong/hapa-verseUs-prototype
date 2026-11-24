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
 *    addendum 02 / response 06 — select to command, approach to inspect, one territory environment;
 *    contract 4: z08–z11 for review 06 / response 07 — one displayed moment, intent across controls,
 *    unobstructed reading at real text sizes, terrain content and cutaway truth)
 *        [--out-root docs/reviews/evidence/2026-11-22/regress] [--run <id>] [--source-dir <checkout>]
 *
 * --source-dir names the checkout the server is serving when it is not this one (a baseline
 * worktree), so the report records that source's commit and working-tree state.
 *
 * Each run writes to a new directory <out-root>/<run id> (default: UTC time + source commit, with
 * "-dirty" for an uncommitted tree) and refuses to reuse an existing one, so evidence is never
 * overwritten. --sabotage swaps two expectations for wrong values (c1, c3) and reinstates two
 * review 06 defects in the page (z10: final-state playback facts; z11: count-keyed scenery) to
 * show the checks can fail.
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
  conventions: 'Browser zoom is emulated as a smaller CSS viewport at a higher device pixel ratio. Text size (contract 4): the browser default font size is set through CDP Page.setFontSizes (16 px = 100%, 24 = 150%, 32 = 200%); inspection text, the command and inspection bars use rem and follow it, other HUD parts still use px. Camera: the default fitted Home view unless a check says otherwise.',
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

// --- C1: Ready commits the own plan once; opponent edits need no acknowledgment (HF3-02) ------
// Contract 5 (response 08) replaces the review 01–07 stale-acknowledgment expectation for new
// matches; the legacy pair-acknowledgment profile keeps its own branch below.
await check('c1', 'One Ready per seat: the opponent edits after my Ready, resolves once, no forced Orders; legacy v3_02 still acknowledges (HF3-02, UX-01)', { query: 'autostart=1&a=human&b=human&seed=1 · profile=hapa_open_10x9_v3_02', viewport: '1600x1000@1', seat: 'A then B (hotseat)', profile: 'hapa_open_10x9_v3_03 (default) and v3_02' }, async () => {
  const page = await open('autostart=1&a=human&b=human&seed=1');
  expect('the default match declares own-plan Ready', await app(page, () => window.__versus.agreement.policy), 'own_plan_ready_v1');
  await pinVia(page, /^Select Your Castle at R1C1/, 'navigator row for your C1 Castle');
  await clickNamed(page, '.cmdbar summary', /^Supply ▾/, 'Supply menu (command bar)');
  await clickNamed(page, '.cmdbar button', /^Load 2 Supply from 2♣ \(C1\)/, 'Load Supply from the C1 card (command bar)');
  const before = await agreement(page);
  expect('A entered one Supply order', before.plans.A.length, 1);
  await clickNamed(page, READY, /^Ready/, 'Ready (strip)');
  const frozen = await agreement(page);
  expect('Ready hands the hotseat to B', frozen.viewSeat, 'B');
  expect('nothing resolved yet', frozen.replayTicks, 0);
  // B edits its own plan after A's Ready, then presses Ready once
  await page.keyboard.press('1'); await sleep(150); await page.keyboard.press('b'); await sleep(300);
  const edited = await agreement(page);
  expect('B revised its plan', edited.plans.B.length, 1);
  expect('A\'s commitment is not stale', edited.stale.A, false);
  const drawer = await app(page, () => !document.getElementById('orders').hidden);
  expect('no drawer opened by itself', drawer, false);
  // spam: Ready clicks and held Ctrl+Enter cannot resolve twice or skip a Tick
  await clickNamed(page, READY, /^Ready/, 'Ready (B)');
  for (let i = 0; i < 4; i++) await ctrlEnter(page);
  await waitResolved(page, 2);
  await sleep(800);
  const st = await agreement(page);
  expect('exactly one Tick resolved', st.replayTicks, 1 + (sabotage ? 1 : 0), sabotage ? 'SABOTAGE: deliberately wrong expectation (+1)' : undefined);
  expect('the next Tick is open for planning', st.tick, 2);
  expect('the resolved Tick used exactly A\'s committed plan', await app(page, () => window.__versus.session.replay.ticks.at(-1).plans.A.map((c) => JSON.stringify(c))), before.plans.A);
  expect('B\'s edit after A\'s Ready was resolved too', await app(page, () => window.__versus.session.replay.ticks.at(-1).plans.B.length), 1);
  await shot(page, 'one-ready-resolved');
  await page.close();
  // legacy: the archived pair-acknowledgment profile still needs the pair acknowledged, without a forced drawer
  const old = await open('autostart=1&a=human&b=human&seed=1&profile=hapa_open_10x9_v3_02');
  expect('the legacy profile declares pair acknowledgment', await app(old, () => window.__versus.agreement.policy), 'pair_acknowledgment_v3');
  await app(old, () => window.__versus._pressReady());
  await old.keyboard.press('1'); await sleep(150); await old.keyboard.press('b'); await sleep(300);
  await app(old, () => window.__versus._pressReady());
  const ls = await agreement(old);
  expect('legacy: A must acknowledge the changed pair', ls.stale.A, true);
  expect('legacy: nothing resolved on two first Readies', ls.replayTicks, 0);
  const lv = await app(old, () => ({ open: !document.getElementById('orders').hidden, ready: document.querySelector('#matchbar .ready-big')?.innerText.replace(/\s+/g, ' ').trim() }));
  expect('legacy: Orders is not forced open', lv.open, false);
  ok('legacy: the primary action is Acknowledge', /^Acknowledge updated plan/.test(lv.ready), lv.ready);
  await clickNamed(old, READY, /^Acknowledge/, 'Acknowledge updated plan (legacy)');
  await waitResolved(old, 2);
  expect('legacy: resolved after the acknowledgment', (await agreement(old)).replayTicks, 1);
  await old.close();
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
    // contract 4 (R6-02): an own party becomes the command selection; another party is read (its
    // public summary pinned) without replacing the selection — either way, the clicked identity
    return app(page, () => { const a = window.__versus; return a.pinned?.kind === 'hint' ? a.pinned.id : a.selected?.id ?? null; });
  };
  expect('layer −2: clicking the tunnel party picks it (B\'s: read, not commanded)', await pickAt(-2, 'B.tunnel.s5'), sabotage ? 'A.fly' : 'B.tunnel', sabotage ? 'SABOTAGE: deliberately wrong expected target' : undefined);
  await shot(page, 'layer-minus2-tunnel');
  expect('layer +3: clicking the flyer picks it', await pickAt(3, 'A.fly.s5'), 'A.fly');
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
  if (await step('navigator: your C1 Castle', /^Select Your Castle at R1C1/, 40)) { await page.keyboard.press('Enter'); await sleep(500); }
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
  await pinVia(page, /^Select Your Castle at R1C1/, 'navigator: C1 Castle');
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
await check('c9', 'Fire Pit: a burn is available at once, animates when planned, reconciles once; zero Mana stays honest (HF3-06, HF-05)', { query: 'autostart=1&fixture=cards&a=human&b=human', viewport: '1600x1000@1' }, async () => {
  const page = await open('autostart=1&fixture=cards&a=human&b=human');
  const mana = await app(page, () => window.__versus.state.cards['A.five'].mana);
  await app(page, () => { window.__versus.pinned = { kind: 'card', id: 'A.five' }; window.__versus._renderAll(); });
  setup('the A.five Card is pinned via selection, then its Burn button is clicked');
  await clickNamed(page, '.peek.pinned button.burn', /^Burn .+ for /, 'Burn for its Mana (Card view)');
  let planPeak = 0;
  for (let i = 0; i < 10; i++) { planPeak = Math.max(planPeak, await app(page, () => window.__versus.view.sites.effects.length)); await sleep(40); }
  const planned = await app(page, () => { const a = window.__versus; return { pool: a.state.players.A.pool, available: a._availablePool('A'), offerings: a.view.sites.sites.A.offerings.children.length, counter: a.el.basins.A.getAttribute('aria-label'), text: a.el.basins.A.innerText.replace(/\s+/g, ' ') }; });
  expect('the authoritative pool is untouched before resolution', planned.pool, {});
  expect('available this Tick is exactly the Card\'s Mana', planned.available, mana);
  ok('the basin counter says available this Tick, with the colors', /available this Tick: /.test(planned.counter) && !/Empty|→ plan/.test(planned.text), `${planned.counter} | ${planned.text}`);
  ok('the burn animated when planned (1 dissolve + 5 color streams)', planPeak >= 6, planPeak);
  expect('no ghost offering lingers over the pit', planned.offerings, 0);
  await shot(page, 'available-now');
  await app(page, () => { window.__versus.speed = 0.5; });
  await clickNamed(page, READY, /^Ready/, 'Ready (A)');
  await clickNamed(page, READY, /^Ready/, 'Ready (B)');
  let peak = 0;
  for (let i = 0; i < 30; i++) { peak = Math.max(peak, await app(page, () => window.__versus.view.sites.effects.length)); await sleep(40); }
  await waitResolved(page, 10);
  const after = await app(page, () => { const a = window.__versus, ev = a.session.events; const b = ev.filter((e) => e.type === 'card_burned' && e.cardId === 'A.five'); const x = ev.find((e) => e.type === 'mana_expired' && e.seat === 'A' && e.tick === 10); return { burns: b.length, burnedPool: b[0]?.pool ?? null, expired: x?.mana ?? null }; });
  expect('the accepted burn is recorded once', after.burns, 1);
  ok('the accepted burn did not animate a second gain', peak < 6, peak);
  expect('the accepted burn put exactly the Card\'s colors in the pool', after.burnedPool, mana);
  expect('unspent, they expired at the Tick boundary (no carryover in this profile)', after.expired, mana);
  // zero Mana: plainly labelled, legal, no gain effect
  const p2 = await open('autostart=1&a=human&b=human&seed=1');
  const zero = await app(p2, () => window.__versus.state.players.A.bank.minor['1']);
  await app(p2, (id) => { window.__versus.pinned = { kind: 'card', id }; window.__versus._renderAll(); }, zero);
  const label = await app(p2, () => document.querySelector('.peek.pinned button.burn')?.textContent);
  expect('a zero-Mana Card says what burning it does', label, 'Burn for 0 Mana — consumes this Card');
  await clickNamed(p2, '.peek.pinned button.burn', /0 Mana/, 'Burn the zero-Mana Card');
  const z = await app(p2, () => ({ available: window.__versus._availablePool('A'), streams: window.__versus.view.sites.effects.length }));
  expect('a zero-Mana burn manufactures no Mana', z.available, {});
  ok('a zero-Mana burn shows the Card dissolving but no color stream (at most the dissolve and a settle)', z.streams <= 2, z.streams);
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
  // contract 5 (addendum 03, HF3-05): hovering a body highlights its label only; the source
  // breakdown is a deliberate choice (a tap on the body or the inspection bar), never a hover essay
  const hov = await app(p2, () => ({ hovered: document.querySelectorAll('.mlabel.hovered:not([hidden])').length, reading: !document.querySelector('.mreading')?.hidden }));
  expect('one hovered member is highlighted; no explanation opens on hover', [hov.hovered, hov.reading], [1, false]);
  await clickAt(p2, sp);
  const exp = await app(p2, () => ({ highlighted: document.querySelectorAll('.mlabel.expanded:not([hidden])').length, reading: document.querySelector('.mreading:not([hidden])')?.innerText.replace(/\s+/g, ' ') ?? '' }));
  ok('a tap on the body opens its source breakdown in the reading panel', exp.highlighted === 1 && /Bow: 2 × 1 Physical, base range 2/.test(exp.reading), exp);
  ok('…with no engaged party, no ranged target is implied', /No engaged target/.test(exp.reading) && !/Preview vs/.test(exp.reading), exp.reading);
  ok('…and the Mage ward is one grouped row with its source', /Magic protection 1 on all six faces: 1 from the party Mage \(ward\)/.test(exp.reading), exp.reading);
  await shot(p2, 'expanded-member');
  // labels are passive: a wheel over a label still zooms the camera
  const d0 = await app(p2, () => window.__versus.cam.goal.distance);
  const lab = await app(p2, () => { const r = document.querySelector('.mlabel:not([hidden])').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await p2.mouse.move(lab.x, lab.y); await p2.mouse.wheel({ deltaY: 200 }); await sleep(300);
  ok('a wheel over a label (and its symbols) still zooms the camera', (await app(p2, () => window.__versus.cam.goal.distance)) > d0, true);
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
  const tunnel = await app(page, () => ({ labels: document.querySelectorAll('.mlabel:not([hidden])').length, note: `${document.querySelector('.mparty')?.innerText ?? ''} ${document.querySelector('.inspect-bar:not([hidden])')?.innerText ?? ''}` }));
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

// ================================================================================================
// Contract 4 (review 06 / assignment 07): one displayed moment, consistent intent across controls,
// explanations that never cover the formation, terrain content that updates the scenery. Geometry
// is measured from the rendered DOM and independently projected bodies, never from the layout the
// code under test computed.
// ================================================================================================
/** Independent geometry of the inspected party: DOM rects and projected bodies, client coordinates. */
const geometry = (page) => app(page, () => {
  const a = window.__versus, sub = a.inspectParty?.partyId;
  if (!sub) return null;
  const cam = a.engine.camera, r = a.engine.renderer.domElement.getBoundingClientRect(), world = a.el.world.getBoundingClientRect();
  const proj = (v) => { const q = v.clone().project(cam); return { x: r.left + (q.x + 1) / 2 * r.width, y: r.top + (1 - q.y) / 2 * r.height }; };
  const right = cam.position.clone().setY(0); right.set(cam.matrixWorld.elements[0], 0, cam.matrixWorld.elements[2]).normalize();
  const bodies = [];
  for (const id of Object.values(a.state.parties[sub].slots).filter(Boolean)) {
    const sp = a.view.sprites.get(id);
    if (!sp?.visible) continue;
    const foot = proj(sp.position), head = proj(sp.position.clone().setY(sp.position.y + 1.25)), side = proj(sp.position.clone().addScaledVector(right, 0.5));
    const half = Math.max(6, Math.abs(side.x - foot.x));
    bodies.push({ id, x: Math.min(foot.x, head.x) - half, y: head.y, w: Math.abs(foot.x - head.x) + 2 * half, h: Math.max(6, foot.y - head.y) });
  }
  const rect = (el) => { if (!el || el.hidden || el.offsetParent === null) return null; const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; };
  const labels = [...document.querySelectorAll('.mlabel:not([hidden])')].map(rect).filter(Boolean);
  const controls = ['.cmdbar', '.inspect-bar', '.cam-pad', '.layer-rail', '#matchbar'].map((q) => rect(document.querySelector(q))).filter(Boolean);
  const ov = (p, q) => !!p && !!q && p.x < q.x + q.w - 0.5 && q.x < p.x + p.w - 0.5 && p.y < q.y + q.h - 0.5 && q.y < p.y + p.h - 0.5;
  const inside = (p) => !!p && p.x >= world.left - 0.5 && p.y >= world.top - 0.5 && p.x + p.w <= world.right + 0.5 && p.y + p.h <= world.bottom + 0.5;
  const reading = rect(document.querySelector('.mreading')), party = rect(document.querySelector('.mparty'));
  const fs = (q) => { const e = document.querySelector(q); return e ? parseFloat(getComputedStyle(e).fontSize) : null; };
  return {
    bearing: Math.round(a.cam.bearing), pitch: Math.round(a.cam.pitch * 180 / Math.PI), level: a.labels.level, labels: labels.length, bodies: bodies.length,
    reading: !!reading, docked: !!document.querySelector('.mreading.docked:not([hidden])'),
    readingOverBodies: bodies.filter((b) => ov(reading, b)).map((b) => b.id), readingOverLabels: labels.filter((l) => ov(reading, l)).length, readingOverControls: controls.filter((c) => ov(reading, c)).length, readingInside: !reading || inside(reading),
    partyShown: !!party, partyInside: !party || inside(party), partyOverBodies: bodies.filter((b) => ov(party, b)).length, partyOverReading: ov(party, reading),
    // role and health are read beside the bodies, or (when the labels step back) in the inspection bar
    font: { root: fs('html'), role: fs('.mlabel:not([hidden]) .mfact b') ?? fs('.inspect-bar .ib-member'), hp: fs('.mlabel:not([hidden]) .mfact.hpv b') ?? fs('.inspect-bar .ib-member'), reading: fs('.mreading:not([hidden])'), cmd: fs('.cmdbar button') },
    // the controls actually rendered (buttons inside a closed menu are not)
    // (a member scrolled out of the compact bar's one scrolling row is reached by arrows: its row must be on screen)
    cmdInside: [...document.querySelectorAll('.cmdbar summary, .cmdbar button, .inspect-bar .ib-head, .inspect-bar .ib-row, .inspect-bar:not(.compact) button')].filter((e) => e.getClientRects().length).every((e) => inside(rect(e) ?? { x: -1, y: -1, w: 0, h: 0 })),
    labelsShown: labels.length, labelOverlaps: labels.reduce((n, l, i) => n + labels.slice(i + 1).filter((m) => ov({ x: l.x + 2, y: l.y + 2, w: l.w - 4, h: l.h - 4 }, m)).length, 0),
    partyCrowded: !!document.querySelector('.mparty.crowded'), barFacts: document.querySelector('.inspect-bar:not([hidden]) .ib-head')?.innerText ?? '',
  };
});
const setTextScale = async (page, px) => { const cdp = await page.target().createCDPSession(); await cdp.send('Page.setFontSizes', { fontSizes: { standard: px, fixed: Math.round(px * 0.8125) } }); await sleep(400); return app(page, () => getComputedStyle(document.documentElement).fontSize); };
const openingMerge = async (page) => {
  await app(page, async () => { const a = window.__versus, s = a.state; a._addCommand('A', { type: 'load_supply', cardId: s.players.A.bank.minor['1'], partyId: 'A.mount.C1' }); a._addCommand('A', { type: 'set_destination', partyId: 'A.mount.C1', target: { column: 1, row: 2 } }); a._pressReady(); await new Promise((r) => setTimeout(r, 200)); a._pressReady(); });
  setup('opening merge played with _addCommand/_pressReady (the pointer route is z01/z08)');
  await waitResolved(page, 2);
  await app(page, () => { const a = window.__versus; a.viewSeat = 'A'; a._renderAll(); });
};
/** Press Escape only while an explanation, inspection or pinned view is open (a bare Escape deselects). */
const escOpen = async (page) => { for (let i = 0; i < 4; i++) { const open = await app(page, () => { const a = window.__versus; return !!(a.expandedPin || a.inspectParty || a.pinned || document.querySelector('.peek.pinned') || document.body.classList.contains('roster-open')); }); if (!open) return; await page.keyboard.press('Escape'); await sleep(150); } };
/** Open a member's explanation through the inspection bar (the keyboard/touch route). */
const openMember = async (page, re) => clickNamed(page, '.inspect-bar .ib-member', re, `inspection bar member ${re}`);

// --- Z08: reading another party keeps the command selection; Home and Return; real-height zoom ---
await check('z08', 'Intent across controls: navigator and board reading keep the friendly selection and orders; one Home transition; zoom anchored at real height (R6-02)', { query: 'autostart=1&a=human&b=human&seed=1; fixture=terrain', viewport: '1280x720@1' }, async () => {
  const page = await open('autostart=1&a=human&b=human&seed=1', { width: 1280, height: 720 });
  await clickAt(page, await partyAt(page, 'A.mount.C1'));
  await clickNamed(page, '.cmdbar summary', /^Supply ▾/, 'Supply menu');
  await clickNamed(page, '.cmdbar button', /^Load 2 Supply from 2♣ \(C1\)/, 'Load Supply');
  await clickNamed(page, '.cmdbar .movelist button', /to R2C1: needs 1/, 'Move to R2C1');
  const plans1 = (await agreement(page)).plans.A;
  expect('a legal funded order is queued for the friendly Castle', plans1.map((c) => JSON.parse(c).type), ['load_supply', 'set_destination']);
  const pose0 = await app(page, () => JSON.stringify(window.__versus.cam.goal));
  // keyboard navigator: inspect B's Bishop
  await page.keyboard.press('n'); await sleep(300);
  const row = await tabTo(page, /^Inspect B's Bishop/);
  ok('keyboard reaches "Inspect B\'s Bishop" in the navigator', !!row, row);
  await page.keyboard.press('Enter'); await settle(1800);
  const r1 = await app(page, () => ({ sel: window.__versus.selected?.id, sub: window.__versus.inspectParty?.partyId ?? null, ret: !!window.__versus._returnPose, bar: document.querySelector('.inspect-bar:not([hidden])')?.innerText.replace(/\s+/g, ' ') ?? '' }));
  expect('inspecting B keeps A\'s command selection', r1.sel, 'A.mount.C1');
  ok('B\'s Bishop is the inspected party and a Return pose is saved', /^B\./.test(r1.sub ?? '') && r1.ret, r1);
  ok('the inspection bar says which party is commanded', /commanding your Castle/.test(r1.bar), r1.bar);
  expect('no order changed', (await agreement(page)).plans.A, plans1);
  ok('focus lands on a member of the inspection bar (its symbols spoken as values)', /Health \d/.test((await focused(page))?.name ?? ''), await focused(page));
  await page.keyboard.press('Escape'); await sleep(250); // closes the navigator first
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter'); await sleep(500);
  const pinned = await app(page, () => ({ pin: window.__versus.expandedPin, reading: document.querySelector('.mreading:not([hidden])')?.innerText.replace(/\s+/g, ' ') ?? '', described: document.querySelector('.inspect-bar .ib-member[aria-pressed="true"]')?.getAttribute('aria-describedby'), fact: document.activeElement?.classList.contains('ib-fact'), tip: !document.getElementById('member-tip').hidden }));
  ok('Enter on a member opens its source breakdown (keyboard route), described by the reading panel', !!pinned.pin && pinned.reading.length > 20 && pinned.described === 'member-reading', pinned);
  ok('…and focus moves to its first symbol, whose definition shows (contract 5)', pinned.fact && pinned.tip, pinned);
  await page.keyboard.press('Escape'); await sleep(200);
  expect('Escape closes the symbol definition first', await app(page, () => [document.getElementById('member-tip').hidden, !!window.__versus.expandedPin]), [true, true]);
  await page.keyboard.press('Escape'); await sleep(200);
  expect('Escape then closes the explanation; inspection stays', await app(page, () => [window.__versus.expandedPin, !!window.__versus.inspectParty]), [null, true]);
  await page.keyboard.press('Escape'); await sleep(200);
  await page.keyboard.press('r'); await settle(1200);
  expect('Return restores the pose before Inspect', await app(page, () => JSON.stringify(window.__versus.cam.goal)), pose0);
  // another command to the original party, without reselecting it
  await clickNamed(page, '.cmdbar summary', /^Face/, 'Face menu');
  const faced = await app(page, () => { const b = [...document.querySelectorAll('.cmdbar .cmd-pop button')].find((x) => !x.disabled); b?.click(); return b?.innerText ?? null; });
  await sleep(300);
  const plans2 = (await agreement(page)).plans.A;
  ok('a further order for the friendly Castle is queued without reselecting it', plans2.length === 3 && plans1.every((c) => plans2.includes(c)), { faced, plans2 });
  // a board click on an enemy reads it; F inspects it; the selection stays
  await clickAt(page, await partyAt(page, 'B.mount.C5'));
  const read = await app(page, () => ({ sel: window.__versus.selected?.id, pin: window.__versus.pinned, view: document.querySelector('.peek.pinned')?.innerText.replace(/\s+/g, ' ') ?? '' }));
  ok('a click on an enemy pins its public summary and keeps the selection', read.sel === 'A.mount.C1' && read.pin?.kind === 'hint' && /Inspect up close/.test(read.view), read);
  await page.keyboard.press('f'); await settle(1500);
  expect('F inspects the party being read; the selection stays', await app(page, () => [window.__versus.selected?.id, window.__versus.inspectParty?.partyId]), ['A.mount.C1', 'B.mount.C5']);
  await shot(page, 'enemy-read-friendly-kept');
  // visible Home and keyboard Home are one transition
  for (const how of ['button', 'key']) {
    await escOpen(page);
    await page.keyboard.press('q'); await settle(900);           // a non-home view
    await app(page, () => { window.__versus.pinned = null; window.__versus._renderAll(); });
    await page.keyboard.press('f'); await settle(1200);           // Focus saves that pose
    if (how === 'button') {
      const cover = await app(page, () => { const b = document.querySelector('.cam-pad button[aria-label="Home view (Home)"]').getBoundingClientRect(); const e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return e?.closest('.cam-pad') ? null : (e?.className || e?.tagName || 'nothing'); });
      ok('the Home button is not covered by any panel', cover === null, cover);
      await clickNamed(page, '.cam-pad button', /^Home view \(Home\)$/, 'Home button');
    } else await page.keyboard.press('Home');
    await settle(900);
    const h1 = await app(page, () => ({ sub: window.__versus.inspectParty, ret: window.__versus._returnPose, home: window.__versus.cam.atHome }));
    expect(`${how} Home: inspection and the old Return pose are cleared; the view is home`, [h1.sub, h1.ret, h1.home], [null, null, true]);
    const homePose = await app(page, () => JSON.stringify(window.__versus.cam.goal));
    await page.keyboard.press('f'); await settle(1200);
    await page.keyboard.press('r'); await settle(1200);
    expect(`${how} Home → Focus → Return comes back to home, not the older pose`, await app(page, () => JSON.stringify(window.__versus.cam.goal)), homePose);
  }
  expect('the friendly selection survived the whole journey', await app(page, () => window.__versus.selected?.id), 'A.mount.C1');
  await page.close();
  // wheel approach at real height: hilltop, flyer and an underground party with its layer open
  const p2 = await open('autostart=1&fixture=terrain&a=human&b=human', { width: 1280, height: 720 });
  await app(p2, () => { const a = window.__versus; a.selected = { kind: 'party', id: 'A.hill' }; a._renderAll(); });
  const drift = [];
  for (const [id, layer] of [['A.hill', null], ['A.fly', null], ['B.tunnel', -2]]) {
    await p2.keyboard.press('Home'); await settle(900);
    if (layer !== null) { await clickNamed(p2, '.layer-rail button', layerButton(layer), `layer ${layer}`); await settle(600); }
    const at = () => app(p2, (pid) => { const a = window.__versus, p = a.state.parties[pid]; const v = a.view.toWorld(p.x, p.y).setY(a.view.partyY(p)); const q = v.project(a.engine.camera), r = a.engine.renderer.domElement.getBoundingClientRect(); return { x: r.left + (q.x + 1) / 2 * r.width, y: r.top + (1 - q.y) / 2 * r.height }; }, id);
    const s0 = await at();
    await p2.mouse.move(s0.x, s0.y);
    for (let i = 0; i < 4; i++) { await p2.mouse.wheel({ deltaY: -240 }); await sleep(90); }
    await settle(1400);
    const s1 = await at();
    const st = await app(p2, () => ({ sel: window.__versus.selected?.id, layer: window.__versus.view.terrain.cutaway }));
    drift.push({ id, wantLayer: layer, before: s0, after: s1, px: +Math.hypot(s1.x - s0.x, s1.y - s0.y).toFixed(1), ...st });
    if (layer !== null) { await clickNamed(p2, '.layer-rail button', layerButton(null), 'All layers'); await settle(400); }
  }
  ok('a wheel approach keeps each party under the cursor at its real height (drift ≤ 12 px)', drift.every((d) => d.px <= 12), drift);
  ok('…without changing the selected party or the chosen layer', drift.every((d) => d.sel === 'A.hill' && d.layer === d.wantLayer), drift.map((d) => [d.sel, d.layer, d.wantLayer]));
  current.observed = { drift };
  await p2.close();
});

// --- Z09: explanations never cover the formation; text scale; orbit, low pitch, screen edge --------
await check('z09', 'Unobstructed reading: four and nine members, 1280×720 and 1600×1000, eight bearings, low pitch, screen edge, 150% and 200% text (R6-01)', { query: 'autostart=1&a=human&b=human&seed=1', viewport: '1280x720@1, 1600x1000@1', textScale: 'CDP Page.setFontSizes 16/24/32 px' }, async () => {
  const cases = [];
  const judge = (tag, g) => {
    cases.push({ tag, ...g });
    return g;
  };
  for (const [w, hgt] of [[1280, 720], [1600, 1000]]) {
    const page = await open('autostart=1&a=human&b=human&seed=1', { width: w, height: hgt });
    await openingMerge(page);
    for (const [pid, who, re] of [['A.mount.C3', 'four', /^Mage/], ['A.mount.C1', 'nine', /^Archer/]]) {
      await page.keyboard.press('Home'); await settle(800);
      await app(page, (id) => { const a = window.__versus; a.selected = { kind: 'party', id }; a._renderAll(); }, pid);
      await page.keyboard.press('f'); await settle(2000);
      await openMember(page, re); await sleep(500);
      for (let i = 0; i < 8; i++) {
        judge(`${w}x${hgt} ${who} bearing`, await geometry(page));
        if (w === 1280 && i % 2 === 0) await shot(page, `${who}-${w}-b${(await geometry(page))?.bearing}`);
        await page.keyboard.press('q'); await settle(900);
      }
      // low pitch, then a screen edge
      await page.keyboard.press('x'); await page.keyboard.press('x'); await settle(1000);
      judge(`${w}x${hgt} ${who} low pitch`, await geometry(page));
      if (w === 1280) await shot(page, `${who}-low-pitch`);
      await page.keyboard.down('d'); await sleep(260); await page.keyboard.up('d'); await settle(900);
      const edge = await geometry(page);
      if (edge) { judge(`${w}x${hgt} ${who} screen edge`, edge); if (w === 1280) await shot(page, `${who}-edge`); }
      await escOpen(page);
    }
    // enlarged text at the same views (1280×720 is the dense case)
    if (w === 1280) {
      for (const [px, pct] of [[24, 150], [32, 200]]) {
        const root = await setTextScale(page, px);
        for (const [pid, who, re] of [['A.mount.C3', 'four', /^Mage/], ['A.mount.C1', 'nine', /^Archer/]]) {
          await page.keyboard.press('Home'); await settle(700);
          await app(page, (id) => { const a = window.__versus; a.selected = { kind: 'party', id }; a._renderAll(); }, pid);
          await page.keyboard.press('f'); await settle(2000);
          await openMember(page, re); await sleep(600);
          const g = judge(`${w}x${hgt} ${who} text ${pct}%`, { ...(await geometry(page)), rootFont: root });
          await shot(page, `${who}-text-${pct}`);
          await escOpen(page);
        }
      }
      await setTextScale(page, 16);
    }
    await page.close();
  }
  const real = cases.filter((c) => c.reading);
  ok('every case was measured with an open explanation', real.length === cases.length && cases.length >= 40, cases.filter((c) => !c.reading).map((c) => c.tag));
  ok('the explanation never covers an inspected body', real.every((c) => c.readingOverBodies.length === 0), real.filter((c) => c.readingOverBodies.length).map((c) => [c.tag, c.bearing, c.readingOverBodies]));
  ok('…nor a member label', real.every((c) => c.readingOverLabels === 0), real.filter((c) => c.readingOverLabels).map((c) => [c.tag, c.bearing, c.readingOverLabels]));
  ok('…nor the command bar, inspection bar, camera pad, layer rail or match bar', real.every((c) => c.readingOverControls === 0), real.filter((c) => c.readingOverControls).map((c) => [c.tag, c.bearing]));
  ok('the explanation and the party facts stay inside the view', cases.every((c) => c.readingInside && c.partyInside), cases.filter((c) => !c.readingInside || !c.partyInside).map((c) => c.tag));
  ok('the party facts never cover a body or the explanation', cases.every((c) => c.partyOverBodies === 0 && !c.partyOverReading), cases.filter((c) => c.partyOverBodies || c.partyOverReading).map((c) => [c.tag, c.bearing]));
  ok('collective facts stay reachable: beside the formation, or (when it steps aside) in the inspection bar', cases.every((c) => (c.partyShown && !c.partyCrowded) || /Supply .* band .*(exposed|not exposed)/.test(c.barFacts)), cases.filter((c) => c.partyCrowded).map((c) => [c.tag, c.barFacts]));
  ok('core role and health text is at least 14 px at 100% and scales with the text setting', cases.every((c) => { const k = /text 150/.test(c.tag) ? 1.5 : /text 200/.test(c.tag) ? 2 : 1; return c.font.role >= 14 * k - 0.5 && c.font.hp >= 14 * k - 0.5 && c.font.reading >= 14 * k - 0.5; }), cases.map((c) => [c.tag, c.font]));
  ok('compact member labels never overlap each other (beyond a 2 px edge)', cases.every((c) => c.labelOverlaps === 0), cases.filter((c) => c.labelOverlaps).map((c) => [c.tag, c.bearing, c.labelOverlaps]));
  ok('command and inspection bar controls stay on screen at every size', cases.every((c) => c.cmdInside), cases.filter((c) => !c.cmdInside).map((c) => c.tag));
  current.observed = { cases: cases.length, docked: cases.filter((c) => c.docked).map((c) => [c.tag, c.bearing]), summary: cases.map((c) => ({ tag: c.tag, bearing: c.bearing, pitch: c.pitch, level: c.level, labels: c.labels, docked: c.docked, font: c.font })) };
});

// --- Z10: playback facts belong to the displayed moment; open explanations refresh ----------------
await check('z10', 'Playback moment: ward provider, headcount and body agree before and after the displayed death; an open explanation refreshes; pause; New match (R6-03, R6-04)', { query: 'autostart=1&fixture=ward&a=human&b=human', viewport: '1280x720@1', profile: 'hapa_open_10x9_v3_02' }, async () => {
  const page = await open('autostart=1&fixture=ward&a=human&b=human', { width: 1280, height: 720 });
  await app(page, () => { window.__versus._focusInspect('B.p'); });
  setup('ward fixture: B\'s Castle inspected with _focusInspect (the navigator route is z08)');
  if (sabotage) { await app(page, () => { window.__versus._displayState = function () { return this.state; }; }); setup('SABOTAGE: inspection reads the final accepted state during playback (the review 06 defect)'); }
  await settle(1600);
  await openMember(page, /^Archer/);
  await app(page, () => { window.__versus.speed = 0.2; });
  await clickNamed(page, READY, /^Ready/, 'Ready (A)');
  await clickNamed(page, READY, /^Ready/, 'Ready (B)');
  const samples = [];
  let paused = null;
  for (let i = 0; i < 400; i++) {
    const s = await app(page, () => { const a = window.__versus, pb = a.playback; if (!pb) return null; const L = [...document.querySelectorAll('.mlabel:not([hidden])')].map((e) => e.innerText.replace(/\s+/g, ' ')); const ev = pb.events.slice(0, pb.shown); return { shown: pb.shown, mageDiedShown: ev.some((e) => e.type === 'member_died' && e.memberId === 'B.p.s2'), contactShown: ev.some((e) => e.type === 'contact'), mageLabel: !!document.querySelector('.mlabel:not([hidden]) .mfact[data-ref^="B.p.s2|"]') || L.some((t) => /^Mage/.test(t)), party: document.querySelector('.mparty')?.innerText.replace(/\s+/g, ' ') ?? '', reading: document.querySelector('.mreading:not([hidden])')?.innerText.replace(/\s+/g, ' ') ?? '' }; });
    if (s) samples.push(s); else if (samples.length) break;
    if (s && s.contactShown && !paused) {
      await page.keyboard.press('Space'); await sleep(150);
      const a0 = await app(page, () => [window.__versus.playback?.shown, document.querySelector('.mreading:not([hidden])')?.innerText]);
      await sleep(600);
      const a1 = await app(page, () => [window.__versus.playback?.shown, document.querySelector('.mreading:not([hidden])')?.innerText]);
      paused = { same: JSON.stringify(a0) === JSON.stringify(a1), shown: a0[0] };
      await page.keyboard.press('Space');
    }
    await sleep(25);
  }
  await waitResolved(page, 6);
  ok('playback was sampled across the death', samples.length >= 8 && samples.some((x) => !x.mageDiedShown) && samples.some((x) => x.mageDiedShown), samples.length);
  // independent expectation: from the events shown, not from the inspection code
  const before = samples.filter((x) => !x.mageDiedShown), after = samples.filter((x) => x.mageDiedShown);
  ok('before the displayed death: the Mage is labelled, the Archer is warded and the party counts 3 living', before.every((x) => x.mageLabel && /Magic protection 1 on all six faces: 1 from the party Mage/.test(x.reading) && /3\/9/.test(x.party)), before.slice(0, 2));
  ok('after it: no Mage label, no ward on the Archer, 2 living', after.every((x) => !x.mageLabel && !/from the party Mage/.test(x.reading) && /2\/9/.test(x.party)), after.slice(0, 2));
  ok('the open Archer explanation refreshed at contact without re-hovering (engaged, a named target)', samples.some((x) => x.contactShown && /engaged/.test(x.reading)) && samples.some((x) => !x.contactShown && /No engaged target/.test(x.reading)), samples.map((x) => x.reading.slice(-90)).filter((v, i, a) => a.indexOf(v) === i));
  ok('pausing holds the moment and its facts', !!paused?.same, paused);
  const fin = await app(page, () => { const a = window.__versus, f = a._labelFacts('B.p'); return { labels: f.party.living, rules: Object.values(a.state.parties['B.p'].slots).filter((id) => id && a.state.members[id].alive).length, mage: a.state.members['B.p.s2'].alive }; });
  expect('after playback the facts are the accepted state', [fin.labels, fin.mage], [fin.rules, false]);
  await shot(page, 'after-death');
  await clickNamed(page, '#matchbar button', /^Match menu$/, 'Match menu');
  await clickNamed(page, '#overlay button', /^New match$/, 'New match');
  await clickNamed(page, '#overlay button', /^Start|^Play|^New match/, 'Start (setup sheet)');
  await sleep(1500);
  const fresh = await app(page, () => ({ labels: document.querySelectorAll('.mlabel:not([hidden])').length, reading: !document.querySelector('.mreading')?.hidden, bar: !document.querySelector('.inspect-bar')?.hidden, sub: window.__versus.inspectParty, pin: window.__versus.expandedPin ?? null }));
  expect('New match leaves no labels, explanation, inspection bar or subject', fresh, { labels: 0, reading: false, bar: false, sub: null, pin: null });
  await page.close();
});

// --- Z11: terrain content updates the scenery; raised ground under a lower cutaway -----------------
await check('z11', 'Terrain truth: an existing filled cube dug, filled and dug again changes the scenery with the terrain; hill dressing follows the cutaway (R6-05)', { query: 'autostart=1&fixture=surface_dig&a=human&b=human; fixture=terrain', viewport: '1280x720@1' }, async () => {
  const page = await open('autostart=1&fixture=surface_dig&a=human&b=human', { width: 1280, height: 720 });
  await app(page, () => { window.__versus._focusInspect('A.worker'); });
  setup('surface_dig fixture: the worker is inspected with _focusInspect; work orders added with _addCommand (the Work menu issues the same command); Ticks advanced with both Ready buttons until C5 is active');
  if (sabotage) { await app(page, () => { const d = window.__versus.view.diorama; d.terrainSignature = (s) => `count:${Object.keys(s.terrain.cells).length}`; d.key = null; }); setup('SABOTAGE: the scenery keys on the terrain entry count again (the review 06 defect)'); }
  await settle(1800);
  const target = await app(page, () => { const a = window.__versus, P = a.state.parties['A.worker']; return { x: Math.round(P.x / 1e6) + 1, y: Math.round(P.y / 1e6), band: -1 }; });
  const look = () => app(page, async (t) => {
    const a = window.__versus, { solidAt } = await import('/src/hapa/rules/terrain.js');
    const d = a.view.diorama, sig = d.key ?? '';
    // the dressing's own record of the inspected territory's nine squares (centre of the 3×3 list)
    const parts = sig.split('|')[1]?.split(',') ?? [];
    const mine = parts[4] ?? '';
    const c = a.ctx.geo.center(5, 5), cx = Math.round(c.x / 1e6), cy = Math.round(c.y / 1e6);
    const idx = (1 - (t.y - cy)) * 3 + (t.x - cx + 1);
    const openInTerrainView = a.view.terrain.sig.includes(`${t.x},${t.y},-1`);
    return { solid: solidAt(a.state.terrain, t.x, t.y, -1), dressingSolid: mine.split(':')[1]?.[idx] === '1', terrainViewOpen: openInTerrainView, tick: a.state.tick, entries: Object.keys(a.state.terrain.cells).length };
  }, target);
  const runWork = async (work) => {
    for (let i = 0; i < 24; i++) {
      const active = await app(page, () => window.__versus.state.activeColumns.includes(5));
      if (active) break;
      await app(page, async () => { const a = window.__versus; a.speed = 8; a._pressReady(); await new Promise((r) => setTimeout(r, 120)); a._pressReady(); await new Promise((r) => { const t = setInterval(() => { if (!a.playback && !a.resolving) { clearInterval(t); r(); } }, 50); }); });
    }
    const added = await app(page, (w, t) => { const a = window.__versus; a.viewSeat = 'A'; const ok = a._addCommand('A', { type: 'begin_work', partyId: 'A.worker', work: w, target: t }); a._renderAll(); return ok; }, work, target);
    await app(page, async () => { const a = window.__versus; a._pressReady(); await new Promise((r) => setTimeout(r, 150)); a._pressReady(); await new Promise((r) => { const t = setInterval(() => { if (!a.playback && !a.resolving) { clearInterval(t); r(); } }, 50); }); });
    await settle(900);
    return { work, added: !!added, ...(await look()) };
  };
  const steps = [{ work: 'start', ...(await look()) }];
  steps.push(await runWork('excavate'));
  steps.push(await runWork('fill'));
  steps.push(await runWork('excavate'));
  current.observed = { target, steps };
  ok('each work order was accepted for planning', steps.slice(1).every((s) => s.added), steps);
  expect('the authoritative cube: solid → empty → solid → empty', steps.map((s) => s.solid), [true, false, true, false]);
  expect('the scenery agrees at every step (same entry count throughout)', steps.map((s) => s.dressingSolid), steps.map((s) => s.solid));
  expect('the terrain view shows the opening exactly when the cube is empty', steps.map((s) => s.terrainViewOpen), steps.map((s) => !s.solid));
  ok('the entry count never changed, so a count-based key would have missed every step', new Set(steps.map((s) => s.entries)).size === 1, steps.map((s) => s.entries));
  await shot(page, 'dug-again');
  await page.close();
  // raised ground: the +3 hill's dressing hides under layer +1 and returns with All layers
  const p2 = await open('autostart=1&fixture=terrain&a=human&b=human', { width: 1280, height: 720 });
  await app(p2, () => { window.__versus._focusInspect('A.hill'); });
  await settle(2000);
  const vis = () => app(p2, () => { const a = window.__versus, mats = a.view.diorama.mats ?? []; const hill = mats.filter((m) => (m.userData.surface ?? 1) > 1); return { hillShown: hill.filter((m) => m.visible && m.opacity > 0.05).length, hill: hill.length, flatShown: mats.filter((m) => (m.userData.surface ?? 1) === 1 && m.visible).length, cut: a.view.terrain.cutaway, hillMeshOpacity: a.view.terrain.hillMeshes[0]?.material[2]?.opacity }; });
  const all = await vis();
  await clickNamed(p2, '.layer-rail button', layerButton(1), 'layer +1'); await settle(900);
  const at1 = await vis();
  await shot(p2, 'hill-at-layer-plus1');
  await clickNamed(p2, '.layer-rail button', layerButton(null), 'All layers'); await settle(900);
  const back = await vis();
  ok('the hill top carries dressing at All layers', all.hill > 0 && all.hillShown === all.hill, all);
  ok('at layer +1 (below the +3 surface) the hill dressing is hidden as the hill turns see-through; flat ground keeps its own', at1.hillShown === 0 && at1.hillMeshOpacity < 1 && at1.flatShown > 0, at1);
  ok('All layers restores it', back.hillShown === back.hill, back);
  const pick = await app(p2, () => { const a = window.__versus, p = a.state.parties['A.hill'], v = a.view.toWorld(p.x, p.y).setY(a.view.partyY(p) + 0.5), q = v.project(a.engine.camera), r = a.engine.renderer.domElement.getBoundingClientRect(); const ev = { clientX: r.left + (q.x + 1) / 2 * r.width, clientY: r.top + (1 - q.y) / 2 * r.height }; const on = a._rayFrom(ev); a.view.diorama.group.visible = false; const off = a._rayFrom(ev); a.view.diorama.group.visible = true; return [on?.party?.id ?? null, off?.party?.id ?? null]; });
  expect('the dressing never changes what is picked on the hill', pick[0], pick[1]);
  await p2.close();
});

// ================================================================================================
// Contract 5 (response 08): addendum 03 / review 07 / assignment 08 — the connected play loop.
// Expected values come from the rules (fixtures, the reviewed opening) or from values entered
// before the action under test.
// ================================================================================================
const pressReady = (page) => app(page, () => window.__versus._pressReady());
const advanceTo = async (page, tick) => { while ((await app(page, () => window.__versus.state.tick)) < tick) { const t = await app(page, () => window.__versus.state.tick); await pressReady(page); await waitResolved(page, t + 1); } };
const selectParty = (page, id) => app(page, (id) => { const a = window.__versus; a.selected = { kind: 'party', id }; a._renderAll(); }, id);
const openMoves = (page) => app(page, () => { const a = window.__versus; a._cmdOpen = 'move'; a._renderCommandBar(); });

await check('z12', 'Blocked Queen (v3_03 body sweep): the route preview names the friendly blocker, travel stops once with Supply kept, recovery to the start is quoted and debited 0.5 (HF3-01, R7-01)', { query: 'autostart=1&a=human&b=bot&seed=1&profile=hapa_open_10x9_v3_03', viewport: '1280x720@1', profile: 'hapa_open_10x9_v3_03' }, async () => {
  const page = await open('autostart=1&a=human&b=bot&seed=1&profile=hapa_open_10x9_v3_03', { width: 1280, height: 720 });
  await app(page, () => { window.__versus.speed = 4; });
  setup('Ticks 1–5 pass with Ready only; Tick 6 loads the C6, C5 and C4 Cards into the Queen (validated commands)');
  await advanceTo(page, 6);
  await app(page, () => { const a = window.__versus, s = a.state; for (const c of [6, 5, 4]) a._addCommand('A', { type: 'load_supply', cardId: s.players.A.bank.minor[String(c)], partyId: 'A.mount.C6' }); });
  await selectParty(page, 'A.mount.C6'); await openMoves(page); await sleep(300);
  const pre = await app(page, () => [...document.querySelectorAll('.cmdbar .movelist button')].map((b) => b.getAttribute('aria-label')).find((t) => /to R4C9/.test(t)) ?? null);
  ok('the move list marks R4C9 as blocked by the Pawn at R2C6 before ordering', /blocked by your Pawn R2C6/.test(pre ?? ''), pre);
  const crossed = await app(page, () => window.__versus.view.destGroup.children.filter((m) => m.geometry?.parameters?.height && m.geometry.parameters.height < 0.5).length);
  ok('blocked destinations are crossed on the board, not only tinted', crossed >= 2, crossed);
  await clickNamed(page, '.cmdbar .movelist button', /to R4C9/, 'Move to R4C9 (command bar)');
  await pressReady(page); await waitResolved(page, 7);
  const q6 = await app(page, () => { const a = window.__versus, q = a.state.parties['A.mount.C6']; return { x: q.x / a.ctx.U, y: q.y / a.ctx.U, supply: q.supply.reduce((n, p) => n + p.units, 0) / a.ctx.U, destination: q.destination, blocked: a.session.events.filter((e) => e.type === 'travel_blocked' && e.partyId === q.id).map((e) => e.by) }; });
  expect('the Queen stops halfway at the friendly body', [q6.x, q6.y], [24, 4]);
  expect('unspent Supply is kept (5.5)', q6.supply, 5.5);
  expect('the destination is kept', q6.destination, { column: 9, row: 4 });
  expect('one named obstruction event', q6.blocked, ['A.pawn.C6']);
  await advanceTo(page, 13);
  await selectParty(page, 'A.mount.C6'); await sleep(300);
  const why = await app(page, () => document.querySelector('.cmdbar .cmd-why')?.textContent ?? '');
  ok('the command bar names the blocker and keeps the order', /Your Pawn at R2C6 blocks its path/.test(why), why);
  ok('an in-world blocked cue is drawn at the contact', await app(page, () => window.__versus.view.destGroup.children.some((c) => c.isSprite)), 'sprite');
  expect('no wall of repeated blocked messages while the Queen waits', await app(page, () => window.__versus.session.events.filter((e) => e.type === 'travel_blocked' && e.partyId === 'A.mount.C6').length), 1);
  await openMoves(page); await sleep(300);
  const back = await app(page, () => [...document.querySelectorAll('.cmdbar .movelist button')].map((b) => b.getAttribute('aria-label')).find((t) => /to R1C6:/.test(t)) ?? null);
  ok('the start territory R1C6 is a funded destination quoted at 0.5 Supply', /to R1C6: needs 0\.5 Supply/.test(back ?? ''), back);
  await clickNamed(page, '.cmdbar .movelist button', /to R1C6:/, 'Move to R1C6 (recovery)');
  await pressReady(page); await waitResolved(page, 14);
  const q13 = await app(page, () => { const a = window.__versus, q = a.state.parties['A.mount.C6']; return { at: [q.x / a.ctx.U, q.y / a.ctx.U], supply: q.supply.reduce((n, p) => n + p.units, 0) / a.ctx.U, state: q.state }; });
  expect('the Queen returned to the center of R1C6', q13.at, sabotage ? [24, 4] : [22, 2], sabotage ? 'SABOTAGE: reinstates the review 07 defect (no movement)' : undefined);
  expect('the recovery debited exactly 0.5', q13.supply, 5);
  expect('it arrived (idle)', q13.state, 'idle');
  await shot(page, 'recovered');
  await page.close();
});

await check('z16', 'Center-to-center opening (v3_04): the Bishop passes its own Pawn and absorbs the Pawn on R2C4; the Knight L switcher flips to the short L and absorbs R2C3 (CJ after response 08)', { query: 'autostart=1&a=human&b=bot&seed=1', viewport: '1280x720@1', profile: 'hapa_open_10x9_v3_04' }, async () => {
  const page = await open('autostart=1&a=human&b=bot&seed=1', { width: 1280, height: 720 });
  expect('the default profile travels center to center', await app(page, () => [window.__versus.ctx.profile.id, window.__versus.ctx.profile.movement.traversal]), ['hapa_open_10x9_v3_04', 'center_to_center_v1']);
  await app(page, () => { window.__versus.speed = 4; });
  await advanceTo(page, 2);
  await app(page, () => { const a = window.__versus; for (const id of Object.values(a.state.players.A.bank.minor).filter(Boolean).slice(0, 2)) a._addCommand('A', { type: 'load_supply', cardId: id, partyId: 'A.mount.C2' }); });
  await selectParty(page, 'A.mount.C2'); await openMoves(page); await sleep(300);
  const entry = await app(page, () => [...document.querySelectorAll('.cmdbar .movelist button')].map((b) => b.getAttribute('aria-label') ?? '').find((t) => /to R3C3:/.test(t)) ?? '');
  ok('the Knight entry names its default L and that it flips', /L via R2C2, R3C2 \(L flips\)/.test(entry) && /absorbs your Pawn/.test(entry), entry);
  await clickNamed(page, '.cmdbar .movelist button', /to R3C3:/, 'Move to R3C3 (Knight)');
  const sw = await app(page, () => [...document.querySelectorAll('.cmdbar .lswitch .lsw')].map((b) => `${b.getAttribute('aria-checked')}|${b.innerText.replace(/\s+/g, ' ')}`));
  ok('the switcher shows both L paths with the default chosen', sw.length === 2 && /^true\|via R2C2 → R3C2/.test(sw[0]) && /^false\|via R1C3 → R2C3/.test(sw[1]), sw);
  await page.mouse.move(2, 2);
  await page.keyboard.press('l'); await sleep(400);
  expect('L flips the drafted order to the short L', await app(page, () => window.__versus.plans.A.find((c) => c.type === 'set_destination')?.via), 'short');
  await shot(page, 'knight-switcher');
  await advanceTo(page, 5);
  const k = await app(page, () => { const a = window.__versus, p = a.state.parties['A.mount.C2'], c = a.ctx.geo.center(3, 3); return { centered: p.x === c.x && p.y === c.y, members: Object.values(p.slots).filter(Boolean).length, absorbed: ['A.pawn.C2', 'A.pawn.C3'].filter((id) => a.state.parties[id].retired) }; });
  expect('the Knight passed the Bishop\'s territory, absorbed R2C3\'s Pawn and stands on R3C3\'s center', [k.centered, k.members, k.absorbed], [true, 9, sabotage ? ['A.pawn.C2'] : ['A.pawn.C3']], sabotage ? 'SABOTAGE: expects the long L despite the flip' : undefined);
  await page.close();
  // CJ's Bishop: Tick 3, C7 and C3 Cards, toward R5C7
  const b = await open('autostart=1&a=human&b=bot&seed=1', { width: 1280, height: 720 });
  await app(b, () => { window.__versus.speed = 4; });
  await advanceTo(b, 3);
  await app(b, () => { const a = window.__versus; for (const c of ['7', '3']) a._addCommand('A', { type: 'load_supply', cardId: a.state.players.A.bank.minor[c], partyId: 'A.mount.C3' }); });
  await selectParty(b, 'A.mount.C3'); await openMoves(b); await sleep(300);
  const r5 = await app(b, () => [...document.querySelectorAll('.cmdbar .movelist button')].map((x) => x.getAttribute('aria-label') ?? '').find((t) => /to R5C7:/.test(t)) ?? '');
  ok('R5C7 is not marked blocked; the Pawn on R2C4 is absorbed on the way', !/blocked/.test(r5) && /absorbs your Pawn on the way/.test(r5), r5);
  await clickNamed(b, '.cmdbar .movelist button', /to R5C7:/, 'Move to R5C7 (Bishop)');
  await pressReady(b); await waitResolved(b, 4);
  const bi = await app(b, () => { const a = window.__versus, p = a.state.parties['A.mount.C3'], c = a.ctx.geo.center(4, 2); return { centered: p.x === c.x && p.y === c.y, absorbed: !!a.state.parties['A.pawn.C4'].retired, blocked: a.session.events.filter((e) => e.type === 'travel_blocked' && e.partyId === 'A.mount.C3').length, supply: p.supply.reduce((n, x) => n + x.units, 0) / a.ctx.U }; });
  expect('one Tick, one Supply: on R2C4\'s center, the Pawn absorbed, not blocked, 3 Supply left', [bi.centered, bi.absorbed, bi.blocked, bi.supply], [true, true, 0, 3]);
  await shot(b, 'bishop-absorbed');
  await b.close();
});

await check('z13', 'Development controllers: validated launch, A bot / B human, both bots Pause / Step / Stop, saved preset and launch link (HF3-04, R7-03)', { query: 'several; see setup', viewport: '1280x720@1' }, async () => {
  const bad = await open('autostart=1&a=robot&b=bot&seed=-4', { width: 1280, height: 720 });
  const eff = await app(bad, () => ({ eff: window.__versus.effective, toast: window.__versus.el.toast.textContent, problems: window.__versus.launch?.problems }));
  expect('an invalid role never creates an uncontrolled seat (A falls back to human)', eff.eff.seats, { A: 'human', B: 'bot' });
  expect('an invalid seed falls back to 1', eff.eff.seed, 1);
  expect('both problems are reported', eff.problems?.length, 2);
  const link = await app(bad, () => { window.__versus._menu(); return document.querySelector('.dev-preset .launch-link')?.textContent ?? ''; });
  ok('the menu shows the effective configuration as a launch link', /\/versus\.html\?autostart=1&a=human&b=bot&seed=1$/.test(link), link);
  await bad.close();
  const ab = await open('autostart=1&a=bot&b=human&seed=1', { width: 1280, height: 720 });
  const s0 = await app(ab, () => ({ view: window.__versus.viewSeat, botReady: !!window.__versus.agreement.ready.A }));
  expect('A bot / B human: the human views B', s0.view, 'B');
  expect('the bot committed its plan without a human', s0.botReady, true);
  await pressReady(ab); await waitResolved(ab, 2);
  expect('one human Ready resolved the Tick', await app(ab, () => window.__versus.session.replay.ticks.length), 1);
  await ab.close();
  const bb = await open('autostart=1&a=bot&b=bot&seed=1', { width: 1280, height: 720 });
  await bb.waitForFunction(() => window.__versus.state.tick >= 3, { timeout: 30000 });
  await clickNamed(bb, '.auto-ctl button', /Pause/, 'Pause (bot match)');
  await bb.waitForFunction(() => !window.__versus.resolving && !window.__versus.playback, { timeout: 30000 });
  const held = await app(bb, () => window.__versus.state.tick);
  await sleep(2500);
  expect('paused: no further Tick starts', await app(bb, () => window.__versus.state.tick), held);
  await clickNamed(bb, '.auto-ctl button', /^Step/, 'Step');
  await bb.waitForFunction((t) => window.__versus.state.tick === t + 1 && !window.__versus.playback && !window.__versus.resolving, { timeout: 30000 }, held);
  await sleep(1500);
  expect('Step advanced exactly one Tick and holds again', [await app(bb, () => window.__versus.state.tick), await app(bb, () => window.__versus.auto.mode)], [held + 1, 'pause']);
  await clickNamed(bb, '.auto-ctl button', /Stop/, 'Stop');
  await sleep(1500);
  expect('stopped: no automatic Tick and Run is disabled', [await app(bb, () => window.__versus.state.tick), await app(bb, () => [...document.querySelectorAll('.auto-ctl button')].find((b) => /Run/.test(b.textContent))?.disabled)], [held + 1, true]);
  await app(bb, () => { window.__versus.auto.mode = 'run'; window.__versus._scheduleAuto(); });
  await app(bb, () => window.__versus.startMatch({ seats: { A: 'bot', B: 'bot' }, seed: 3 }));
  await bb.waitForFunction(() => window.__versus.state.tick >= 2, { timeout: 30000 });
  const gen = await app(bb, () => ({ ticks: window.__versus.session.replay.ticks.map((t) => t.tick), mode: window.__versus.auto.mode }));
  ok('New match restarted cleanly: its own Ticks from 1, the old schedule gone', gen.ticks[0] === 1 && gen.ticks.every((t, i) => t === i + 1), JSON.stringify(gen));
  await bb.close();
  // saved preset: chosen in setup, used by a plain autostart; URL values still win
  const st = await browser.newPage();
  await st.setViewport({ width: 1280, height: 720 });
  st.on('pageerror', (e) => current.errors.push({ kind: 'pageerror', message: String(e?.message ?? e) }));
  await st.goto(`${base}/versus.html?debug=1`, { waitUntil: 'networkidle0' });
  await st.waitForSelector('#set-A');
  await st.select('#set-A', 'bot'); await st.select('#set-B', 'human');
  await st.evaluate(() => { const s = document.getElementById('set-seed'); s.value = '7'; s.dispatchEvent(new Event('input', { bubbles: true })); });
  const setupLink = await st.evaluate(() => document.querySelector('.setup .launch-link')?.textContent ?? '');
  ok('setup shows the launch link for the chosen controllers', /a=bot&b=human&seed=7/.test(setupLink), setupLink);
  await clickNamed(st, '.setup button', /^Start match$/, 'Start match (remember preset)');
  await st.goto(`${base}/versus.html?autostart=1`, { waitUntil: 'networkidle0' });
  await st.waitForFunction(() => window.__versus?.session, { timeout: 30000 });
  expect('a plain autostart uses the saved preset', await st.evaluate(() => ({ ...window.__versus.effective.seats, seed: window.__versus.effective.seed })), { A: 'bot', B: 'human', seed: 7 });
  await st.goto(`${base}/versus.html?autostart=1&a=human&b=bot`, { waitUntil: 'networkidle0' });
  await st.waitForFunction(() => window.__versus?.session, { timeout: 30000 });
  expect('URL values override the preset (seed still from the preset)', await st.evaluate(() => ({ ...window.__versus.effective.seats, seed: window.__versus.effective.seed })), { A: 'human', B: 'bot', seed: 7 });
  await st.evaluate(() => localStorage.removeItem('hapa-versus.dev-preset.v1'));
  await st.close();
});

await check('z14', 'Same-Tick Mana: burn → exact available count → cast reserves it → undo leaves the cast invalid and Ready names it → restore → one burn, one payment (HF3-06, R7-05)', { query: 'autostart=1&fixture=response&a=human&b=human', viewport: '1280x720@1' }, async () => {
  const page = await open('autostart=1&fixture=response&a=human&b=human', { width: 1280, height: 720 });
  const red = await app(page, () => window.__versus.state.cards['A.red'].mana);
  await app(page, () => { window.__versus.pinned = { kind: 'card', id: 'A.red' }; window.__versus._renderAll(); });
  await clickNamed(page, '.peek.pinned button.burn', /^Burn .+ for /, 'Burn A.red (Card view)');
  expect('burn → available this Tick is exactly its colors', await app(page, () => window.__versus._availablePool('A')), red);
  const added = await app(page, () => window.__versus._addCommand('A', { type: 'play_ability', cardId: 'A.ember', actorPartyId: 'A.c', target: { memberId: 'B.c.s2' }, burns: [] }));
  expect('the same-Tick cast validates against that Mana', added, true);
  expect('queueing the cast reserves its cost at once', await app(page, () => window.__versus._availablePool('A')), {});
  const burnAt = await app(page, () => window.__versus.plans.A.findIndex((c) => c.type === 'burn'));
  await app(page, (i) => window.__versus._removeOrder('A', i), burnAt);
  const undone = await app(page, () => { const a = window.__versus; return { plan: a.plans.A.map((c) => c.type), errors: a._planErrors('A').map((e) => e.error), ready: a.el.readyBig.innerText.replace(/\s+/g, ' '), toast: a.el.toast.textContent, avail: a._availablePool('A') }; });
  expect('undo keeps the dependent cast visible', undone.plan, ['play_ability']);
  expect('the cast is now invalid (not silently deleted)', undone.errors.length, 1);
  ok('Ready is blocked', /^Fix 1 order/.test(undone.ready), undone.ready);
  ok('the undo says which order became invalid', /dependent order is now invalid/.test(undone.toast), undone.toast);
  expect('the burn\'s credit is gone', undone.avail, {});
  await app(page, () => window.__versus._restoreOrder('A'));
  expect('restored: the plan is valid again', await app(page, () => window.__versus._planErrors('A').length), 0);
  await pressReady(page); // A commits; hotseat hands to B
  await pressReady(page);
  let sawWindow = false;
  for (let i = 0; i < 40; i++) {
    const w = await app(page, () => { const a = window.__versus; if (!a.pendingChoice) return null; const seat = a.pendingChoice.req.seat; return { seat, avail: a._availablePool(seat), actual: a.state.players[seat].pool }; });
    if (w) { sawWindow = true; expect(`the response window uses ${w.seat}'s actual pool`, w.avail, w.actual); await clickNamed(page, '#decision button', /^Pass$/, 'Pass'); }
    else if (await app(page, () => !window.__versus.resolving && !window.__versus.playback && window.__versus.state.tick > 9)) break;
    await sleep(250);
  }
  ok('a genuine response window was offered', sawWindow);
  await waitResolved(page, 10);
  const ev = await app(page, () => { const e = window.__versus.session.events; return { burns: e.filter((x) => x.type === 'card_burned' && x.cardId === 'A.red').length, paid: e.filter((x) => x.type === 'mana_paid' && x.cardId === 'A.ember').length, damage: e.filter((x) => x.type === 'card_damage').length }; });
  expect('exactly one accepted burn and one payment', [ev.burns, ev.paid], [1, sabotage ? 2 : 1], sabotage ? 'SABOTAGE: deliberately wrong expectation (two payments)' : undefined);
  ok('the cast resolved its damage', ev.damage >= 1, ev.damage);
  await page.close();
});

await check('z15', 'Symbols and history: exact member values, a symbol defined by pointer and keyboard, history opened, rotated and closed without hiding inspection or losing selection and orders (HF3-03/05/07, R7-04/06)', { query: 'autostart=1&a=human&b=bot&seed=1', viewport: '1280x720@1' }, async () => {
  const page = await open('autostart=1&a=human&b=bot&seed=1', { width: 1280, height: 720 });
  await app(page, () => { window.__versus.speed = 4; });
  await advanceTo(page, 2);
  await selectParty(page, 'A.mount.C1');
  await app(page, () => { const a = window.__versus; a._addCommand('A', { type: 'load_supply', cardId: a.state.players.A.bank.minor['1'] ?? a.state.players.A.bank.minor['9'], partyId: 'A.mount.C1' }); });
  const orders = await app(page, () => window.__versus.plans.A.map((c) => JSON.stringify(c)));
  setup('A selects its C1 Castle (command) with one Supply order, then inspects its C3 Pawn (five members)');
  await app(page, () => window.__versus._focusInspect('A.pawn.C3'));
  for (let i = 0; i < 10 && (await app(page, () => window.__versus.labels.level)) !== 'combat'; i++) { await app(page, () => window.__versus.cam.zoom(0.85)); await sleep(450); }
  expect('close view reaches the symbol level', await app(page, () => window.__versus.labels.level), 'combat');
  const vals = await app(page, () => { const a = window.__versus, out = {}; for (const el of document.querySelectorAll('.mlabel:not([hidden])')) { const ref = el.querySelector('.mfact')?.dataset.ref ?? ''; const id = ref.split('|')[0]; const m = a.state.members[id]; (out[m.archetype] ??= []).push([...el.querySelectorAll('.mfact')].map((c) => `${c.dataset.ref.split('|')[1]}=${c.textContent}`).join(' ')); } return out; });
  ok('Archer: 3/3, two hits of 1, base range 2, no protection shown as 0', (vals.archer ?? []).every((t) => /health=3\/3/.test(t) && /attack:0=2×1/.test(t) && /range:0=2/.test(t) && /shield:none=0/.test(t)) && vals.archer?.length === 2, JSON.stringify(vals.archer));
  ok('Swordsman: 3/3, one hit of 3, front-only Physical protection 1', (vals.swordsman ?? []).every((t) => /health=3\/3/.test(t) && /attack:0=1×3/.test(t) && /shield:0=1/.test(t)) && vals.swordsman?.length === 3, JSON.stringify(vals.swordsman));
  // pointer: the shield symbol answers the protection question directly
  const chip = await app(page, () => { const el = [...document.querySelectorAll('.mfact.sh')].find((c) => c.querySelector('.mface')); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, ref: el.dataset.ref }; });
  await hoverAt(page, chip, 600);
  const tip = await app(page, () => ({ shown: !document.getElementById('member-tip').hidden, text: document.getElementById('member-tip').innerText.replace(/\s+/g, ' ') }));
  ok('hovering the shield explains front-only Physical protection with its value', tip.shown && /Physical protection 1 on the front face; other faces meet 0/.test(tip.text), tip.text);
  ok('the member stays the same while the pointer is on its symbol', await app(page, () => window.__versus.inspectParty?.partyId === 'A.pawn.C3'));
  await page.keyboard.press('Escape'); await sleep(200);
  expect('Escape dismisses the definition first', await app(page, () => document.getElementById('member-tip').hidden), true);
  // keyboard: a member, then its symbols as stops with the same definitions
  await openMember(page, /^Archer/); await sleep(400);
  const kf = await focused(page);
  ok('choosing a member moves focus to its first symbol', /^Archer/.test(kf?.name ?? ''), kf?.name);
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await sleep(300);
  const kt = await app(page, () => ({ f: document.activeElement?.getAttribute('aria-label'), tip: document.getElementById('member-tip').innerText.replace(/\s+/g, ' '), shown: !document.getElementById('member-tip').hidden }));
  ok('arrowing to the attack symbol shows its definition (two separate hits of 1)', kt.shown && /2 separate hits of 1 Physical each/.test(kt.tip), `${kt.f} | ${kt.tip}`);
  // history composition: open, rotate, close; reading and controls stay clear of the drawer
  const clear = () => app(page, () => { const a = window.__versus, o = a.el.orders.getBoundingClientRect(); const hit = (el) => { if (!el || el.hidden || !el.offsetParent) return false; const r = el.getBoundingClientRect(); return r.right > o.left && r.left < o.right && r.bottom > o.top && r.top < o.bottom; }; return { open: !a.el.orders.hidden, tab: a.ordersTab, covered: ['.inspect-bar', '.cmdbar', '.mreading', '.cam-pad', '.layer-rail'].filter((s) => hit(document.querySelector(s))) }; });
  await page.keyboard.press('Escape'); await sleep(200);
  await page.mouse.move(2, 2);
  await page.keyboard.press('h'); await sleep(600);
  const h1 = await clear();
  expect('H opens the history voluntarily, nothing covered', [h1.open, h1.tab, h1.covered], [true, 'history', []]);
  const hist = await app(page, () => ({ ticks: [...document.querySelectorAll('#orders .hist-nav option')].map((o) => o.textContent), sum: document.querySelector('#orders .hist-sum')?.textContent ?? '' }));
  ok('history browses completed Ticks (not the current draft)', hist.ticks.length >= 1 && !hist.ticks.some((t) => /Tick 2$/.test(t)), JSON.stringify(hist));
  await app(page, () => window.__versus.cam.rotate(45)); await sleep(900);
  const h2 = await clear();
  expect('after one orbit step the drawer still covers nothing essential', h2.covered, []);
  await shot(page, 'history-with-inspection');
  await page.keyboard.press('h'); await sleep(500);
  const end = await app(page, () => { const a = window.__versus; return { open: !a.el.orders.hidden, selected: a.selected?.id, orders: a.plans.A.map((c) => JSON.stringify(c)), inspecting: a.inspectParty?.partyId, cmdbar: !a.el.cmdbar.hidden }; });
  expect('closing history keeps the command selection, its orders and the inspection', [end.open, end.selected, end.orders, end.inspecting, end.cmdbar], [false, 'A.mount.C1', orders, 'A.pawn.C3', true]);
  await page.close();
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
