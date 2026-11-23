#!/usr/bin/env node
/**
 * Regression assertions for the confirmed interface risks (design review 02, R2-08). Unlike the
 * evidence recorder (ui-journeys.mjs), every check here compares what the running application did
 * with an expectation stated independently (from the rules, the fixture as built, or the value the
 * player entered before the action under test), and the process exits 1 if any check fails, a
 * required control is missing, or the page reports an error not on the explicit allow-list.
 *
 *   node tools/hapa/ui-regress.mjs [--base http://127.0.0.1:5199] [--only c1,c3] [--sabotage]
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
const engine = sh('git -C vendor/lumina rev-parse HEAD', repo) ?? (sh('git submodule status vendor/lumina', repo) ?? '').trim().split(/\s+/)[0]?.replace(/^[-+]/, '');
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

// --- C1: Ready freezes the own plan; an opponent revision is reviewed and acknowledged ----------
await check('c1', 'Ready freezes the own plan through an opponent revision (UX-01, journey 5/6)', { query: 'autostart=1&a=human&b=human&seed=1', viewport: '1600x1000@1', seat: 'A then B (hotseat)', layer: 'All' }, async () => {
  const page = await open('autostart=1&a=human&b=human&seed=1');
  await clickNamed(page, '#roster [role=button]', /^Your Castle at R1C1/, 'roster row for your C1 Castle');
  await clickNamed(page, '#inspector button', /^Load 2 Supply from 2♣ \(C1\)/, 'Load Supply from the C1 card');
  const before = await agreement(page);
  expect('A entered one Supply order', before.plans.A.length, 1);
  await clickNamed(page, '#plan .ready-big', /^Ready/, 'Ready');
  const frozen = await agreement(page);
  expect('Ready hands the hotseat to B', frozen.viewSeat, 'B');
  // B revises (keyboard: hand slot 1, Burn) and presses Ready
  await page.keyboard.press('1'); await sleep(150); await page.keyboard.press('b'); await sleep(300);
  await clickNamed(page, '#plan .ready-big', /^Ready/, 'Ready (B)');
  const st = await agreement(page);
  expect('view returns to A to acknowledge', st.viewSeat, 'A');
  expect('A acknowledgment is stale', st.stale.A, true);
  // attempts to change the frozen plan: keyboard Burn, and any Remove control
  await page.keyboard.press('2'); await sleep(150); await page.keyboard.press('b'); await sleep(300);
  const after = await agreement(page);
  expect('A plan unchanged after B revised and A tried to edit', after.plans.A, before.plans.A);
  expect('A revision unchanged', after.rev.A, frozen.rev.A + (sabotage ? 1 : 0), sabotage ? 'SABOTAGE: deliberately wrong expectation (+1)' : undefined);
  const view = await app(page, () => ({ removeInOwn: document.querySelectorAll('#plan .planbox.a button.x').length, added: [...document.querySelectorAll('#plan .planbox.b li.added')].map((e) => e.innerText.replace(/\s+/g, ' ')), banner: document.querySelector('#plan .plan-banner')?.innerText ?? '', first: document.querySelector('#plan .plans > *')?.className, ready: document.querySelector('#plan .ready-big')?.innerText.replace(/\s+/g, ' ').trim() }));
  expect('no Remove controls on the frozen own plan', view.removeInOwn, 0);
  expect('B\'s new order is marked NEW', view.added.length, 1);
  ok('banner says the own orders stay frozen', /stay frozen/.test(view.banner), view.banner);
  ok('opponent plan is shown first while reviewing', /planbox b/.test(view.first ?? ''), view.first);
  ok('primary action is Acknowledge', /^Acknowledge updated plan/.test(view.ready), view.ready);
  await shot(page, 'stale-review');
  await clickNamed(page, '#plan .ready-big', /^Acknowledge/, 'Acknowledge updated plan');
  await waitResolved(page, 2);
  const resolved = await app(page, () => window.__versus.session.replay.ticks.at(-1).plans.A.map((c) => JSON.stringify(c)));
  expect('the resolved Tick used exactly the frozen A plan', resolved, before.plans.A);
  await page.close();
});

// --- C2: one resolution however often Ready is pressed during a response window ------------------
await check('c2', 'One resolution during a response window despite repeated Ready (UX-02)', { query: 'autostart=1&fixture=response&a=human&b=human', viewport: '1600x1000@1', seat: 'A plans; B responds', layer: 'All' }, async () => {
  const run = async (spam) => {
    const page = await open('autostart=1&fixture=response&a=human&b=human');
    setup('A\'s Ember Strike order is added with the app\'s own _addCommand (ability targeting is not under test here)');
    await app(page, () => window.__versus._addCommand('A', { type: 'play_ability', cardId: 'A.ember', actorPartyId: 'A.c', target: { memberId: 'B.c.s2' }, burns: ['A.red'] }));
    const t0 = await agreement(page);
    await clickNamed(page, '#plan .ready-big', /^Ready/, 'Ready (A)');
    await clickNamed(page, '#plan .ready-big', /^Ready/, 'Ready (B)');
    await page.waitForFunction(() => !!window.__versus.pendingChoice, { timeout: 15000 });
    const f = await focused(page);
    let spammed = 0;
    if (spam) {
      for (let i = 0; i < 12; i++) { await ctrlEnter(page); spammed++; }
      for (let i = 0; i < 3; i++) { await page.$eval('#plan .ready-big', (b) => b.click()).catch(() => {}); spammed++; }
    }
    let passes = 0;
    while (passes < 8 && await app(page, () => !!window.__versus.pendingChoice)) { await clickNamed(page, '#inspector .response button', /^Pass$/, 'Pass'); passes++; await sleep(300); }
    await waitResolved(page, 10);
    const r = await app(page, () => { const a = window.__versus, ev = a.session.events.filter((e) => e.tick === 9); return { replayTicks: a.session.replay.ticks.length, locked: ev.filter((e) => e.type === 'plans_locked').length, damage: ev.filter((e) => e.type === 'card_damage').length, fingerprint: a.session.replay.ticks.at(-1).fingerprint, events: a.session.events.length }; });
    if (spam) await shot(page, 'after-spam');
    await page.close();
    return { ...r, before: t0.replayTicks, focusAtOpen: f, spammed, passes };
  };
  const spam = await run(true), calm = await run(false);
  ok('the response window opens with focus on a choice', /Blue Denial|Pass/.test(spam.focusAtOpen?.name ?? ''), spam.focusAtOpen);
  expect('exactly one replay entry added (with Ready spam)', spam.replayTicks - spam.before, 1);
  expect('exactly one plans_locked event for Tick 9', spam.locked, 1);
  expect('the Spell resolved once', spam.damage, 1);
  expect('spam run and calm run end in the same state', spam.fingerprint, calm.fingerprint);
  expect('spam run and calm run record the same number of events', spam.events, calm.events);
  current.observed = { spam, calm };
});

// --- C3: height-aware selection -------------------------------------------------------------
await check('c3', 'Selection follows the visible height (UX-03)', { query: 'autostart=1&fixture=stacked&a=human&b=human', viewport: '1600x1000@1', seat: 'A', camera: 'fitted Home' }, async () => {
  const page = await open('autostart=1&fixture=stacked&a=human&b=human');
  const pickAt = async (band, memberId, lift = 0.45) => {
    await clickNamed(page, '.layer-rail button', layerButton(band), `layer ${band ?? 'All'}`);
    await page.keyboard.press('Escape'); await sleep(150);
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
await check('c4', 'Off-layer bodies stay filtered during and after playback (R2-01)', { query: 'autostart=1&fixture=stacked&a=human&b=human', viewport: '1600x1000@1', layers: ['−2', '+3', 'All'] }, async () => {
  for (const band of [-2, 3, null]) {
    const page = await open('autostart=1&fixture=stacked&a=human&b=human');
    // the expectation comes from the fixture as built: live members on the band
    const expected = await app(page, (b) => Object.values(window.__versus.state.members).filter((m) => m.alive && (b === null || (m.band ?? 1) === b)).map((m) => m.id).sort(), band);
    await clickNamed(page, '.layer-rail button', layerButton(band), `layer ${band ?? 'All'}`);
    await clickNamed(page, '#plan .ready-big', /^Ready/, 'Ready (A)');
    await clickNamed(page, '#plan .ready-big', /^Ready/, 'Ready (B)');
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
    expect(`layer ${name}: every playback sample shows only the expected bodies`, [...new Set(samples.map((s) => canon(s)))], [canon(expected)]);
    expect(`layer ${name}: after playback`, end, expected);
    if (band === -2) await shot(page, 'after-playback-minus2');
    await page.close();
  }
});

// --- C5: the opening by keyboard alone at a compact size -----------------------------------------
await check('c5', 'Opening by keyboard alone, compact (R2-04; journey steps 1–7)', { query: 'autostart=1&a=human&b=bot&seed=1', viewport: '1280x720@1', seat: 'A', layer: 'All', camera: 'fitted Home' }, async () => {
  const page = await open('autostart=1&a=human&b=bot&seed=1', { width: 1280, height: 720 });
  const log = [];
  const step = async (name, re, max) => { const f = await tabTo(page, re, max); ok(`reach by Tab: ${name}`, !!f, f); if (f) { ok(`focus is visible on ${name}`, f.visible, f); log.push({ name, tabs: f.tabs }); } return !!f; };
  await app(page, () => document.activeElement?.blur());
  // a Card tile keeps focus when Enter selects it (the tile is rebuilt)
  if (await step('your C1 hand tile', /^2 of Wands, your C1/)) {
    await page.keyboard.press('Enter'); await sleep(300);
    const f = await focused(page);
    ok('Enter on a Card tile keeps focus on that tile', /^2 of Wands, your C1/.test(f?.name ?? ''), f);
    expect('the Card is selected', await app(page, () => window.__versus.selected?.kind), 'card');
    await page.keyboard.press('Escape'); await sleep(200);
  }
  await app(page, () => document.activeElement?.blur());
  if (await step('Parties drawer toggle', /^☰ Parties$/)) { await page.keyboard.press('Enter'); await sleep(250); }
  if (await step('roster row: your C1 Castle', /^Your Castle at R1C1/, 60)) { await page.keyboard.press('Enter'); await sleep(400); }
  expect('1 · the C1 Castle is selected', await app(page, () => window.__versus.selected?.id), 'A.mount.C1');
  ok('1 · focus continues in the inspector', /^castle/i.test((await focused(page))?.name ?? ''), await focused(page)); // the heading is uppercased by CSS
  if (await step('Load Supply from 2♣ (C1)', /^Load 2 Supply from 2♣ \(C1\)/, 60)) { await page.keyboard.press('Enter'); await sleep(400); }
  ok('2 · focus moves on to Move to…', /^Move to/.test((await focused(page))?.name ?? ''), await focused(page));
  await page.keyboard.press('Enter'); await sleep(200); // open the list
  if (await step('Move Castle to R2C1 (joins your Pawn)', /^Move Castle R1C1 to R2C1/, 40)) { await page.keyboard.press('Enter'); await sleep(400); }
  const plan1 = await agreement(page);
  expect('3 · the plan holds Supply then the move', plan1.plans.A.map((c) => JSON.parse(c).type), ['load_supply', 'set_destination']);
  ok('3 · focus lands on the new order', /^Remove order 2: Move Castle R1C1 → R2C1/.test((await focused(page))?.name ?? ''), await focused(page));
  await page.keyboard.press('Enter'); await sleep(400);
  expect('4 · Remove takes the move out', (await agreement(page)).plans.A.map((c) => JSON.parse(c).type), ['load_supply']);
  ok('4 · focus lands on Restore', /^Restore removed order/.test((await focused(page))?.name ?? ''), await focused(page));
  await page.keyboard.press('Enter'); await sleep(400);
  const plan2 = await agreement(page);
  expect('4 · Restore puts the same order back', plan2.plans.A, plan1.plans.A);
  await shot(page, 'planned');
  if (await step('Ready', /^Ready/, 40)) { await page.keyboard.press('Enter'); await sleep(200); }
  ok('5 · Ready freezes the plan (A frozen)', await app(page, () => !!window.__versus.ready.A), true);
  await waitResolved(page, 2);
  // 7 · the result and its Card cause, by keyboard
  await page.keyboard.press('Escape'); await sleep(300);
  await app(page, () => document.activeElement?.blur());
  if (await step('result: Supply landed', /loaded 2 Supply from A's 2♣ \(C1\)/, 80)) { await page.keyboard.press('Enter'); await sleep(400); }
  const ev = await app(page, () => window.__versus.selected?.event ?? null);
  expect('7 · the supply_loaded event is inspected', ev?.type, 'supply_loaded');
  // the same result may be reached in the inspector list or the event strip; Tab onward to the panel's link
  if (await step('Inspect the Card', /^Inspect the Card/, 120)) { await page.keyboard.press('Enter'); await sleep(400); }
  expect('7 · its Card is inspected', await app(page, () => window.__versus.selected?.id), ev?.cardId);
  // independent expectation from the rules: 2 Supply loaded, one step costs 1, the Pawn merges
  const P = await app(page, () => { const p = window.__versus.state.parties['A.mount.C1']; return { region: p.region, supply: p.supply.reduce((n, x) => n + x.units, 0) / 1e6, members: Object.values(p.slots).filter(Boolean).length }; });
  expect('7 · result agrees with the rules: R2C1, Supply 1, nine members', P, { region: { column: 1, row: 2 }, supply: 1, members: 9 });
  await shot(page, 'result-card');
  current.observed = { tabs: log };
  await page.close();
});

// --- C6: public information and essential controls at compact sizes ----------------------------
const SIZES = [
  { w: 1600, h: 1000, dpr: 1, label: '1600x1000' }, { w: 1441, h: 900, dpr: 1, label: '1441x900 (above drawer breakpoint)' }, { w: 1440, h: 900, dpr: 1, label: '1440x900 (drawer)' },
  { w: 1280, h: 720, dpr: 1, label: '1280x720' }, { w: 1181, h: 900, dpr: 1, label: '1181x900' }, { w: 1180, h: 900, dpr: 1, label: '1180x900' }, { w: 1100, h: 900, dpr: 1, label: '1100x900' },
  { w: 1067, h: 667, dpr: 1.5, label: '1600x1000 at 150% browser zoom' },
  { w: 800, h: 500, dpr: 2, label: '1600x1000 at 200% browser zoom (observed, not asserted)', observe: true },
];
await check('c6', 'Roster, Mana/Burn, nine bank positions, plans and Ready reachable at every size (R2-03)', { sizes: SIZES.map((s) => s.label), seats: ['A', 'B'] }, async () => {
  const measured = [];
  for (const sz of SIZES) for (const seat of ['A', 'B']) {
    const page = await open(seat === 'A' ? 'autostart=1&a=human&b=bot&seed=1' : 'autostart=1&a=bot&b=human&seed=1', { width: sz.w, height: sz.h, dpr: sz.dpr });
    const m = await app(page, () => {
      const R = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), shown: cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0 }; };
      const inView = (r) => r && r.shown && r.x >= 0 && r.y >= 0 && r.x + r.w <= innerWidth + 1 && r.y + r.h <= innerHeight + 1;
      const tiles = (sel) => [...document.querySelectorAll(`${sel} .tile`)].map(R);
      const own = tiles('#ownhand'), opp = tiles('#opphand');
      const res = R(document.getElementById('resources'));
      return {
        viewport: [innerWidth, innerHeight, devicePixelRatio], canvas: R(document.querySelector('#world canvas')),
        resources: res, resourcesInView: inView(res), pools: /A pool/.test(document.getElementById('resources').innerText) && /B pool/.test(document.getElementById('resources').innerText),
        roster: R(document.getElementById('roster')), rosterToggle: R(document.querySelector('.roster-toggle')),
        ownTiles: own.length, oppTiles: opp.length, tilesInView: own.every(inView) && opp.every(inView), minTileW: Math.min(...own.map((r) => r.w), ...opp.map((r) => r.w)),
        columnSkew: Math.max(...own.map((r, i) => Math.abs((r.x + r.w / 2) - (opp[i].x + opp[i].w / 2)))),
        plan: R(document.getElementById('plan')), ready: R(document.querySelector('#plan .ready-big')), readyInView: inView(R(document.querySelector('#plan .ready-big'))),
      };
    });
    const tag = `${sz.label} · seat ${seat}`;
    if (sz.observe) { if (seat === 'A') await shot(page, `${sz.w}x${sz.h}-observe`); measured.push({ size: sz.label, seat, observeOnly: true, ...m }); await page.close(); continue; }
    expect(`${tag}: nine bank positions in each ribbon`, [m.ownTiles, m.oppTiles], [9, 9]);
    ok(`${tag}: every bank position on screen and ≥ 40 px wide`, m.tilesInView && m.minTileW >= 40, { min: m.minTileW });
    ok(`${tag}: own and opponent position i share a physical column (±2 px)`, m.columnSkew <= 2, m.columnSkew);
    ok(`${tag}: both Mana pools on screen (≥ 120 px wide)`, m.resourcesInView && m.pools && m.resources.w >= 120, m.resources);
    ok(`${tag}: roster column or drawer toggle on screen`, (m.roster?.shown && m.roster.w >= 150) || m.rosterToggle?.shown, { roster: m.roster, toggle: m.rosterToggle });
    ok(`${tag}: plans get ≥ 110 px and Ready is on screen`, m.plan?.h >= 110 && m.readyInView, { plan: m.plan, ready: m.ready });
    // the labeled Burn path: select the first own Card, the inspector offers Burn
    await clickNamed(page, '#ownhand .tile[role=button]', /./, `${tag}: a hand Card`);
    ok(`${tag}: labeled Burn control`, await app(page, () => [...document.querySelectorAll('#inspector button')].some((b) => /^Burn/.test(b.innerText) && !b.disabled)), true);
    if (m.rosterToggle?.shown) {
      await page.click('.roster-toggle'); await sleep(250);
      ok(`${tag}: the drawer opens with every party listed`, await app(page, () => { const r = document.getElementById('roster').getBoundingClientRect(); return r.width >= 200 && document.querySelectorAll('#roster [role=button]').length >= 4; }), true);
      await page.keyboard.press('Escape'); await sleep(200);
      ok(`${tag}: Escape closes the drawer`, await app(page, () => !document.body.classList.contains('roster-open')), true);
    }
    if (seat === 'A' && [1600, 1280, 1100, 1067].includes(sz.w)) await shot(page, `${sz.w}x${sz.h}`);
    measured.push({ size: sz.label, seat, ...m });
    await page.close();
  }
  current.observed = measured;
});

// --- C7: concession is confirmed, truthful and never reopens a frozen plan -------------------------
await check('c7', 'Concession: confirmation, cancel, truthful feedback by phase (R2-07)', { query: 'autostart=1&a=human&b=human&seed=1; fixture=response', viewport: '1600x1000@1' }, async () => {
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
  await clickNamed(page, '#plan .ready-big', /^Ready/, 'Ready (A)');
  await app(page, () => { const a = window.__versus; a.viewSeat = 'A'; a._renderAll(); });
  setup('the hotseat view is switched back to A with viewSeat to inspect A\'s menu after Ready');
  await clickNamed(page, '#matchbar button', /^Match menu$/, 'Match menu');
  const frozenNote = await app(page, () => ({ note: document.querySelector('#concede-note')?.innerText ?? '', button: [...document.querySelectorAll('#overlay button')].some((b) => /^Concede as/.test(b.innerText)) }));
  ok('after Ready: the menu explains the concession is already in the frozen plan', /in your frozen plan/.test(frozenNote.note), frozenNote.note);
  expect('after Ready: no Concede button', frozenNote.button, false);
  await page.keyboard.press('Escape'); await sleep(150);
  await app(page, () => { window.__versus.viewSeat = 'B'; window.__versus._renderAll(); });
  await clickNamed(page, '#plan .ready-big', /^Ready/, 'Ready (B)');
  await page.waitForFunction(() => !!window.__versus.state.outcome, { timeout: 20000 });
  const out = await app(page, () => window.__versus.state.outcome);
  expect('the match ends by A\'s concession when the Tick resolves', { winner: out.winner, reasons: out.reasons.map((r) => `${r.seat}:${r.reason}`) }, { winner: 'B', reasons: ['A:conceded'] });
  await shot(page, 'result');
  await page.close();
  // during a response window, and after Ready without a planned concession
  const p2 = await open('autostart=1&fixture=response&a=human&b=human');
  await app(p2, () => window.__versus._addCommand('A', { type: 'play_ability', cardId: 'A.ember', actorPartyId: 'A.c', target: { memberId: 'B.c.s2' }, burns: ['A.red'] }));
  setup('response fixture: A\'s Ember Strike added with _addCommand');
  await clickNamed(p2, '#plan .ready-big', /^Ready/, 'Ready (A)');
  await app(p2, () => { window.__versus.viewSeat = 'A'; window.__versus._renderAll(); });
  await clickNamed(p2, '#matchbar button', /^Match menu$/, 'Match menu');
  const frozen = await app(p2, () => ({ note: document.querySelector('#concede-note')?.innerText ?? '', button: [...document.querySelectorAll('#overlay button')].some((b) => /^Concede as/.test(b.innerText)) }));
  ok('frozen (no concession planned): explains it is unavailable and the plan is not reopened', /not available now: your plan is frozen after Ready.*has not been reopened/s.test(frozen.note), frozen.note);
  expect('frozen: no Concede button', frozen.button, false);
  await p2.keyboard.press('Escape'); await sleep(150);
  await app(p2, () => { window.__versus.viewSeat = 'B'; window.__versus._renderAll(); });
  await clickNamed(p2, '#plan .ready-big', /^Ready/, 'Ready (B)');
  await p2.waitForFunction(() => !!window.__versus.pendingChoice, { timeout: 15000 });
  await clickNamed(p2, '#matchbar button', /^Match menu$/, 'Match menu');
  const resp = await app(p2, () => ({ note: document.querySelector('#concede-note')?.innerText ?? '', button: [...document.querySelectorAll('#overlay button')].some((b) => /^Concede as/.test(b.innerText)) }));
  ok('response window: explains concession is unavailable', /response window is open/.test(resp.note), resp.note);
  expect('response window: no Concede button', resp.button, false);
  ok('no success toast for a refused concession', !/Concession added/.test(await app(p2, () => document.querySelector('.toast')?.textContent ?? '')), true);
  await shot(p2, 'response-menu');
  await p2.close();
});

// --- C8: Card edge cases: exact Mana, ability and planned use without hover -------------------------
await check('c8', 'Card labels carry exact Supply, Mana, ability and planned use (R2-05)', { query: 'autostart=1&fixture=cards&a=human&b=human', viewport: '1280x720@1' }, async () => {
  const page = await open('autostart=1&fixture=cards&a=human&b=human', { width: 1280, height: 720 });
  // the expectation from the state: every Card in both banks
  const cards = await app(page, () => { const s = window.__versus.state; const out = []; for (const seat of ['A', 'B']) for (const id of Object.values(s.players[seat].bank.minor).filter(Boolean)) { const c = s.cards[id]; out.push({ id, seat, supply: c.supply / 1e6, mana: Object.entries(c.mana ?? {}).filter(([, n]) => n).map(([k, n]) => `${n} ${k[0].toUpperCase()}${k.slice(1)}`).join(' + ') || 'no Mana' }); } return out; });
  const labels = await app(page, () => [...document.querySelectorAll('.tile[role=button]')].map((t) => t.getAttribute('aria-label')));
  for (const c of cards) ok(`tile for ${c.id} names Supply ${c.supply} and ${c.mana}`, labels.some((l) => l.includes(`Supply ${c.supply}`) && l.includes(c.mana)), c);
  ok('a multi-color Card shows a +n chip for the entries it cannot fit', await app(page, () => [...document.querySelectorAll('.tile .mana')].some((m) => /\+\d/.test(m.innerText))), true);
  // planned use is named in the tile itself and its label
  setup('A plans a Burn of A.five via hand slot 5 and the B key');
  await page.keyboard.press('5'); await sleep(200); await page.keyboard.press('b'); await sleep(400);
  const five = await app(page, () => { const t = [...document.querySelectorAll('#ownhand .tile')].find((x) => /Burn planned/.test(x.innerText)); return t ? { label: t.getAttribute('aria-label'), text: t.innerText.replace(/\s+/g, ' ') } : null; });
  ok('the planned Card shows its use on the tile', !!five, five);
  ok('…and in its accessible name', /\(planned: Burn planned\)/.test(five?.label ?? ''), five?.label);
  await shot(page, 'planned-burn');
  await page.close();
});

// --- report --------------------------------------------------------------------------------------
await browser.close();
manifest.finishedAt = new Date().toISOString();
const all = manifest.checks.flatMap((c) => c.assertions);
manifest.summary = { checks: manifest.checks.length, assertions: all.length, failed: all.filter((a) => !a.pass).length };
fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(manifest, null, 1));
console.log(`\n${manifest.summary.assertions - manifest.summary.failed}/${manifest.summary.assertions} assertions passed · ${dir}`);
process.exit(manifest.summary.failed ? 1 : 0);
