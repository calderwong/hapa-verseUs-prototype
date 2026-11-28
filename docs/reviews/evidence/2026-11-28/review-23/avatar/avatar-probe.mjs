import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Run with an explicit checkout at the reviewed head: node avatar-probe.mjs /path/to/checkout
// Controlled DOM, owner responses and frame messages; no private renderer or network access.
const HEAD = '29c7c1d466f94b5534fce1634f775a4df944a93f';
const root = pathToFileURL(resolve(process.argv[2] || process.cwd()) + '/');
const expected = {
  "src/hapa/presentation/app.js": "ef979ac4695e16318da4f32498d363b8617344a4",
  "src/hapa/presentation/roster.js": "1650072fa40c3073c384c4b4cdc9a161caaf101d",
  "src/hapa/presentation/avatar-opponent.js": "7ade98db0cfeae3b29805314f024b4fc025a9f3e",
  "src/hapa/presentation/red-bridge.js": "891b206f47352ff093078d82ba5daefcd6ac887d"
};
const register = Object.keys(expected).map(path => {
  const b = fs.readFileSync(new URL(path, root));
  const gitBlob = crypto.createHash('sha1').update(Buffer.from(`blob ${b.length}\0`)).update(b).digest('hex');
  assert.equal(gitBlob, expected[path], `reviewed source ${path}`);
  return { path, sha256: crypto.createHash('sha256').update(b).digest('hex'), gitBlob };
});
const { ROSTER, loadRoster, saveRoster, selectAvatar, resolveChoice, statusOf } = await import(new URL('src/hapa/presentation/roster.js', root));
const { AvatarOpponent } = await import(new URL('src/hapa/presentation/avatar-opponent.js', root));
const { FramedRedPlayer } = await import(new URL('src/hapa/presentation/red-bridge.js', root));
const storage = new Map();
globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)) };
globalThis.location = { protocol: 'http:', origin: 'http://controlled-versus.invalid' };
if (typeof CustomEvent !== 'function') globalThis.CustomEvent = class extends Event { constructor(type, o = {}) { super(type); this.detail = o.detail; } };

const pkgFor = id => { const e = ROSTER.find(x => x.id === id); return { id: e.package.id, revision: e.package.revision, avatarId: e.id, renderer: e.renderer, status: 'candidate' }; };
globalThis.fetch = async url => ({ ok: true, json: async () => url === '/capabilities' ? { avatarPackage: { available: true, id: 'controlled-red', revision: 'fixture' } } : pkgFor(ROSTER.find(e => e.player && url.includes(`/${e.player}/`))?.id) });
const app = fs.readFileSync(new URL('src/hapa/presentation/app.js', root), 'utf8');
const from = app.indexOf('  _tableSetup() {'), to = app.indexOf('\n  async startMatch(', from);
assert.ok(from >= 0 && to > from);
const h = (tag, attrs = {}, ...kids) => ({ tag, ...attrs, children: kids.flat(), replaceChildren(...xs) { this.children = xs.flat(); } });
const setup = new Function('h', 'ROSTER', 'loadRoster', 'saveRoster', 'selectAvatar', 'resolveChoice', 'statusOf', `return ({${app.slice(from, to)}})._tableSetup`)(h, ROSTER, loadRoster, saveRoster, selectAvatar, resolveChoice, statusOf);
let ctx = {}, surface = setup.call(ctx);
const descendants = node => [node, ...(node?.children ?? []).flatMap(descendants)];
const row = id => descendants(surface).find(x => x?.['data-avatar'] === id);
const radio = id => descendants(row(id)).find(x => x?.tag === 'input' && x.type === 'radio');
const roster = id => descendants(row(id)).find(x => x?.tag === 'input' && x.type === 'checkbox' && !x.disabled);
const set = (el, checked = true) => { el.checked = checked; el.onchange({ target: el }); };
const state = () => ({ choice: ctx._tableChoice.avatarId, enabled: loadRoster(), selectedRadios: descendants(surface).filter(x => x?.tag === 'input' && x.type === 'radio' && x.checked).map(x => ({ id: x.value, disabled: !!x.disabled })) });
const rosterResults = { clean: state() };
assert.equal(rosterResults.clean.choice, 'red-reaper');
set(roster('red-reaper'), false);
rosterResults.removeRed = state();
assert.equal(ctx._tableChoice.avatarId, null);
set(radio('red-reaper')); // even a forced disabled-radio callback uses the policy operation
rosterResults.forcedOldSelection = state();
assert.equal(ctx._tableChoice.avatarId, null);
storage.set('hapa-versus.table.v1', JSON.stringify({ avatarId: 'red-reaper', songIds: [] }));
ctx = {}; surface = setup.call(ctx);
rosterResults.reopenContradictoryLegacyState = state();
assert.equal(ctx._tableChoice.avatarId, null);
for (const id of ['avatar-8', 'avatar-46', 'avatar-39']) {
  set(roster(id), true); set(radio(id));
  assert.equal(ctx._tableChoice.avatarId, id);
}
rosterResults.optionalSelection = state();
assert.equal(rosterResults.optionalSelection.selectedRadios.length, 1);

// Exercise the actual AvatarOpponent attach/dispose methods and actual FramedRedPlayer. Only the
// platform is controlled: DOM-shaped frame/canvas, events and owner package responses. No WebGL,
// browser, installed app or private owner availability is claimed by this probe.
const liveFrames = new Set();
const winListeners = new Map();
const framesEver = [];
const makeElement = tag => {
  const e = { tag, setAttribute() {}, addEventListener() {}, append() {}, classList: { toggle() {} }, remove() { liveFrames.delete(this); }, getContext: () => ({ clearRect() {}, drawImage() {} }) };
  if (tag === 'iframe') { e.contentWindow = { posts: [], postMessage(m, origin) { this.posts.push({ m, origin }); } }; framesEver.push(e); }
  return e;
};
globalThis.document = { createElement: makeElement, body: { append(e) { liveFrames.add(e); } } };
globalThis.window = { addEventListener(type, f) { if (!winListeners.has(type)) winListeners.set(type, new Set()); winListeners.get(type).add(f); }, removeEventListener(type, f) { winListeners.get(type)?.delete(f); } };
const emit = (f, data, origin = location.origin) => { for (const fn of [...(winListeners.get('message') ?? [])]) fn({ source: f.contentWindow, origin, data }); };
const turns = async () => { for (let n = 0; n < 8; n++) await Promise.resolve(); };
class ControlledOpponent extends AvatarOpponent {
  _build() { return makeElement('aside'); }
  _render() {}
}
const make = id => new ControlledOpponent({ host: makeElement('host'), seat: 'B', avatarId: id, sessionId: `probe-${id}`, epoch: framesEver.length + 1, controller: { kind: 'heuristic', revision: 'heuristic-bot/0.2.0', label: 'the heuristic bot, not a model' } });
const results = [];
for (const id of ['avatar-8', 'avatar-46', 'avatar-39']) {
  const a = make(id); let renders = 0;
  a.addEventListener('rendering', () => renders++);
  const p = a.attach();
  assert.equal(a.attach(), p, 'concurrent attempts share one promise');
  await turns();
  const f = framesEver.at(-1);
  emit(f, { t: 'loaded', size: [673, 841] }, 'http://wrong.invalid');
  assert.equal(a.player, undefined, 'wrong-origin load rejected');
  emit(f, { t: 'loaded', size: [673, 841] });
  assert.equal(await p, true);
  assert.equal(renders, 1);
  assert.equal(await a.attach(), true);
  assert.equal(liveFrames.size, 1);
  results.push({ id, binding: a.binding, renderingEvents: renders, framesWhileBound: liveFrames.size });
  a.dispose();
  assert.equal(liveFrames.size, 0, 'bound player frame removed');
}

// Wrong owner identity is rejected before any renderer is constructed; correcting the owner makes
// the existing explicit retry succeed.
const bad = make('avatar-8');
bad._get = async () => ({ ...pkgFor('avatar-8'), avatarId: 'avatar-46' });
assert.equal(await bad.attach(), false);
assert.equal(liveFrames.size, 0);
const rejection = { status: bad.binding.status, error: bad.bindingError, frames: liveFrames.size };
bad._get = async () => pkgFor('avatar-8');
const retry = bad.retry(); await turns();
emit(framesEver.at(-1), { t: 'loaded', size: [673, 841] });
assert.equal(await retry, true);
const recovery = { attempts: bad.attempts, status: bad.binding.status, frames: liveFrames.size };
bad.dispose();

// During a slow frame load, dispose only sees this.player, which is assigned after load resolves.
// The old frame/listener therefore survives into the next Avatar's attach. Late completion is
// correctly fenced and finally removes it: record both the gap and the successful boundary.
const old = make('avatar-8'); let oldRenders = 0;
old.addEventListener('rendering', () => oldRenders++);
const oldP = old.attach(); await turns(); const oldFrame = framesEver.at(-1);
old.dispose();
const afterDispose = { oldDisposed: old.disposed, oldEpoch: old.epoch, frames: liveFrames.size, listeners: winListeners.get('message')?.size ?? 0, oldFrameReceivedDispose: oldFrame.contentWindow.posts.some(p => p.m.t === 'dispose') };
const next = make('avatar-46'); const nextP = next.attach(); await turns(); const newFrame = framesEver.at(-1);
emit(newFrame, { t: 'loaded', size: [673, 841] }); await nextP;
const duringReplacement = { frames: liveFrames.size, listeners: winListeners.get('message')?.size ?? 0, newAvatar: next.binding.avatar.id, oldRenderingEvents: oldRenders };
emit(oldFrame, { t: 'loaded', size: [673, 841] });
const lateResult = await oldP;
const afterOldCompletion = { lateResult, frames: liveFrames.size, listeners: winListeners.get('message')?.size ?? 0, oldRenderingEvents: oldRenders, newAvatar: next.binding.avatar.id };
assert.equal(afterDispose.frames, 1);
assert.equal(duringReplacement.frames, 2);
assert.equal(afterOldCompletion.frames, 1);
assert.equal(oldRenders, 0, 'old completion cannot seat the old performer');
assert.equal(lateResult, false);
next.dispose();
assert.equal(liveFrames.size, 0);
assert.equal(winListeners.get('message').size, 0);

// Repair guard: merely exposing and disposing the pending player is insufficient with today's
// bridge, because dispose clears the timer but leaves the load promise unresolved.
const direct = new FramedRedPlayer(makeElement('canvas'), { origin: location.origin });
let directLoadState = 'pending';
direct.load().then(() => { directLoadState = 'resolved'; }, () => { directLoadState = 'rejected'; });
direct.dispose(); await turns();
const directDispose = { loadPromiseAfterDispose: directLoadState, loadingSlotStillPresent: !!direct._loading, frames: liveFrames.size, listeners: winListeners.get('message').size };
assert.equal(directLoadState, 'pending');
assert.equal(directDispose.frames, 0);

const out = { head: HEAD, sourceFiles: register, scope: 'Exact application method/module probe with controlled DOM, localStorage, owner responses and frame messages. No live browser, native owner/WebGL or installed-app claim.', roster: rosterResults, binding: results, wrongIdentity: rejection, explicitRetry: recovery, pendingLoadDisposal: { afterDispose, duringReplacement, afterOldCompletion, directDispose, remainingFramesAtEnd: liveFrames.size, remainingListenersAtEnd: winListeners.get('message').size } };
fs.writeFileSync(new URL('avatar-probe-results.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 2));
