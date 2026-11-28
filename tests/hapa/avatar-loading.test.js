/**
 * A renderer that is still loading is released completely (Review 23 V23-01 / N25-02).
 *
 * The actual AvatarOpponent and FramedRedPlayer modules; only the platform is controlled: a
 * DOM-shaped iframe/canvas, window message listeners and the owner's package responses. A slow
 * figure is disposed (a new match, another opponent) before its frame says "loaded"; its frame and
 * listener must go at once, its attach must settle, the next figure must bind normally, and the old
 * frame's late messages must change nothing. A load that never completes is covered too, so a
 * stranded promise cannot hide behind the bridge's 45-second timeout. No WebGL, owner art or browser.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
globalThis.location = { protocol: 'http:', origin: 'http://versus.test' };
if (typeof CustomEvent !== 'function') globalThis.CustomEvent = class extends Event { constructor(t, o = {}) { super(t); this.detail = o.detail; } };

const frames = new Set(); // frames in the document now
const listeners = new Set(); // window 'message' listeners now
const made = []; // every frame ever created, in order
const element = (tag) => {
  const e = { tag, setAttribute() {}, addEventListener() {}, append() {}, classList: { toggle() {} }, remove() { frames.delete(this); }, getContext: () => ({ clearRect() {}, drawImage() {} }) };
  if (tag === 'iframe') { e.contentWindow = { posts: [], postMessage(m) { this.posts.push(m); } }; made.push(e); }
  return e;
};
globalThis.document = { createElement: element, body: { append: (e) => frames.add(e) } };
globalThis.window = { addEventListener: (t, f) => t === 'message' && listeners.add(f), removeEventListener: (t, f) => t === 'message' && listeners.delete(f) };
const send = (frame, data) => { for (const f of [...listeners]) f({ source: frame.contentWindow, origin: location.origin, data }); };
const turns = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

const { ROSTER } = await import('../../src/hapa/presentation/roster.js');
const { AvatarOpponent } = await import('../../src/hapa/presentation/avatar-opponent.js');
const { FramedRedPlayer } = await import('../../src/hapa/presentation/red-bridge.js');
const pkg = (id) => { const e = ROSTER.find((x) => x.id === id); return { id: e.package.id, revision: e.package.revision, avatarId: id, renderer: 'fixture', status: 'candidate' }; };
globalThis.fetch = async (url) => ({ ok: true, json: async () => pkg(ROSTER.find((e) => e.player && url.includes(`/${e.player}/`)).id) });

class Opponent extends AvatarOpponent { _build() { return element('aside'); } _render() {} }
let epoch = 0;
const opponent = (id) => {
  const o = new Opponent({ host: element('host'), seat: 'B', avatarId: id, sessionId: `t-${id}`, epoch: ++epoch, controller: { kind: 'heuristic', revision: 'heuristic-bot/0.2.0', label: 'the heuristic bot' } });
  o.renders = 0;
  o.addEventListener('rendering', () => o.renders++);
  return o;
};
const settled = (p) => { const s = { state: 'pending' }; p.then((v) => Object.assign(s, { state: 'resolved', value: v }), (e) => Object.assign(s, { state: 'rejected', error: e })); return s; };

test('V23-01 / N25-02: disposing a figure mid-load releases it at once; the replacement binds and the old frame is not heard', { timeout: 5000 }, async () => {
  // Falka's frame is mounted but never says "loaded" before the match ends
  const old = opponent('avatar-8');
  const oldAttach = settled(old.attach());
  await turns();
  const oldFrame = made.at(-1);
  assert.equal(frames.size, 1); assert.equal(listeners.size, 1);
  old.dispose();
  // released promptly: no frame, no listener, the frame was told, the attach settled (not left pending)
  assert.equal(frames.size, 0, 'old frame removed at dispose');
  assert.equal(listeners.size, 0, 'old listener removed at dispose');
  assert.ok(oldFrame.contentWindow.posts.some((m) => m.t === 'dispose'), 'the old frame received dispose');
  await turns();
  assert.deepEqual([oldAttach.state, oldAttach.value], ['resolved', false], 'the old attach settled false');
  assert.equal(old.player, null); assert.equal(old.renders, 0);

  // the replacement (Leo) binds normally: exactly one frame and one listener
  const next = opponent('avatar-46');
  const nextAttach = next.attach();
  await turns();
  const newFrame = made.at(-1);
  assert.notEqual(newFrame, oldFrame);
  send(newFrame, { t: 'loaded', size: [673, 841] });
  assert.equal(await nextAttach, true);
  assert.equal(next.renders, 1);
  assert.equal(frames.size, 1); assert.equal(listeners.size, 1);

  // the old frame finishes late and keeps talking: nothing about the new player changes
  const leo = next.player;
  send(oldFrame, { t: 'loaded', size: [10, 10] });
  send(oldFrame, { t: 'failed', error: 'late' });
  send(oldFrame, { t: 'playback', detail: { status: 'started', audioTime: 9 } });
  await turns();
  assert.equal(next.player, leo, 'the new player is still the bound one');
  assert.equal(leo.disposed, false);
  assert.equal(next.renders, 1); assert.equal(old.renders, 0);
  assert.deepEqual([next.canvas.width, next.canvas.height], [673, 841], 'the late old frame did not resize the new seat');
  assert.equal(leo.audio.currentTime, 0, 'no stale playback reached the new player');
  assert.equal(frames.size, 1); assert.equal(listeners.size, 1);
  assert.equal(await next.attach(), true, 'still bound; no second performer');

  next.dispose();
  assert.equal(frames.size, 0); assert.equal(listeners.size, 0);
});

test('V23-01 / N25-02: a load that never completes settles exactly once on dispose; retry and failures keep working', { timeout: 5000 }, async () => {
  // the bridge itself: dispose settles its pending load (it used to clear the timer and leave it pending)
  const p = new FramedRedPlayer(element('canvas'), { origin: location.origin, name: 'Thor' });
  let rejections = 0, resolutions = 0, reason = null;
  p.load().then(() => resolutions++, (e) => { rejections++; reason = e; });
  await turns();
  const f = made.at(-1);
  p.dispose(); p.dispose();
  send(f, { t: 'loaded', size: [1, 1] });
  await turns();
  assert.deepEqual([rejections, resolutions], [1, 0], 'settled once, as a rejection');
  assert.equal(reason.code, 'released');
  assert.equal(p._loading, null);
  assert.equal(frames.size, 0); assert.equal(listeners.size, 0);

  // a renderer whose own load never settles and whose dispose does not settle it either (Harbor's
  // module is not ours): the attempt still settles at dispose and releases that renderer
  let disposed = 0;
  const stuck = opponent('avatar-39');
  stuck._makePlayer = async () => ({ load: () => new Promise(() => {}), dispose: () => disposed++ });
  const a = settled(stuck.attach());
  await turns();
  stuck.dispose();
  await turns();
  assert.deepEqual([a.state, a.value, disposed], ['resolved', false, 1]);

  // an owner request that never answers: dispose aborts it and the attempt settles
  let signal = null;
  const silent = opponent('avatar-8');
  silent._get = (_url, s) => { signal = s; return new Promise(() => {}); };
  const b = settled(silent.attach());
  await turns();
  silent.dispose();
  await turns();
  assert.equal(signal.aborted, true, 'the owner request was aborted');
  assert.deepEqual([b.state, b.value], ['resolved', false]);
  assert.equal(frames.size, 0);

  // control: a real failure still goes text-only and the explicit retry binds (no regression)
  const flaky = opponent('avatar-46');
  const first = flaky.attach(); await turns();
  send(made.at(-1), { t: 'failed', error: 'owner renderer failed' });
  assert.equal(await first, false);
  assert.equal(flaky.binding.status, 'text-only');
  assert.match(flaky.bindingError, /owner renderer failed/);
  assert.equal(frames.size, 0);
  const again = flaky.retry(); await turns();
  send(made.at(-1), { t: 'loaded', size: [673, 841] });
  assert.equal(await again, true);
  assert.equal(flaky.renders, 1); assert.equal(frames.size, 1);
  flaky.dispose();
  assert.equal(frames.size, 0); assert.equal(listeners.size, 0);
});
