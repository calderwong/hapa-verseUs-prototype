/**
 * One bounded consumer probe: does Keep itself change playback?
 * node --experimental-vm-modules keep-playback-invariance-probe.mjs <repository-root>
 * Loads actual Soundtrack and dom.js without source changes. DOM/audio/owner responses and
 * timers are local fixtures. No browser, network, owner process or real-time playback is used.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const root = process.argv[2];
if (!root || !vm.SourceTextModule) throw Error('Usage: node --experimental-vm-modules <probe> <repository-root>');
const sourcePath = resolve(root, 'src/hapa/presentation/soundtrack.js');
const source = await readFile(sourcePath);
const domSource = await readFile(resolve(root, 'src/hapa/presentation/dom.js'));
const blob = (b) => createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
const flush = () => new Promise((r) => setImmediate(r));
class DetailEvent extends Event { constructor(type, { detail } = {}) { super(type); this.detail = detail; } }
class Element extends EventTarget {
  constructor(tag, text = '') { super(); this.tag = tag; this.nodeType = tag === '#text' ? 3 : 1; this.text = text; this.children = []; this.attrs = {}; this.style = {}; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  remove() {}
  get textContent() { return this.text + this.children.map((x) => x.textContent ?? String(x)).join(''); }
  findButton(label) { if (this.tag === 'button' && this.textContent === label) return this; for (const c of this.children) { const b = c.findButton?.(label); if (b) return b; } }
}
const audioCalls = [], requests = [], timers = new Map(), keptEvents = [];
let timerId = 0, resolveKeep;
class AudioFixture extends EventTarget {
  constructor() { super(); this._src = ''; this._time = 0; this._volume = 0.55; this.paused = true; }
  get src() { return this._src; }
  set src(v) { audioCalls.push({ operation: 'src', value: v }); this._src = v; }
  get currentTime() { return this._time; }
  set currentTime(v) { audioCalls.push({ operation: 'currentTime', value: v }); this._time = v; }
  get volume() { return this._volume; }
  set volume(v) { audioCalls.push({ operation: 'volume', value: v }); this._volume = v; }
  getAttribute(k) { return k === 'src' ? this._src || null : null; }
  removeAttribute(k) { if (k === 'src') { audioCalls.push({ operation: 'remove-src' }); this._src = ''; } }
  pause() { audioCalls.push({ operation: 'pause' }); this.paused = true; }
  load() { audioCalls.push({ operation: 'load' }); this._time = 0; }
  play() { audioCalls.push({ operation: 'play' }); this.paused = false; return Promise.resolve(); }
}
const ownerStates = {
  saved: { acquisitionId: 'acq-fixture', discoveryId: 'discovery-fixture', state: 'saved-downloading' },
  offline: { acquisitionId: 'acq-fixture', discoveryId: null, state: 'available-offline', retained: { libraryId: 'retained:fixture', receiptId: 'receipt-fixture' } },
};
const context = vm.createContext({
  EventTarget, CustomEvent: DetailEvent, AbortController, Audio: AudioFixture,
  document: { createElement: (tag) => new Element(tag), createTextNode: (text) => new Element('#text', text) },
  localStorage: { getItem: () => null, setItem() {} },
  URL: { revokeObjectURL: (value) => audioCalls.push({ operation: 'revoke-url', value }) },
  console: { warn: (line) => { throw Error(`Unexpected playback failure: ${line}`); } },
  setTimeout: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
  clearTimeout: (id) => timers.delete(id), clearInterval() {},
  fetch: (url, options = {}) => {
    requests.push({ url, method: options.method ?? 'GET', body: options.body ? JSON.parse(options.body) : null });
    if (url === '/music/fixture/keep') return new Promise((r) => { resolveKeep = () => r({ ok: true, json: async () => ownerStates.saved }); });
    if (url === '/music/fixture/keep/acq-fixture') return Promise.resolve({ ok: true, json: async () => ownerStates.offline });
    if (url === '/music/fixture/audio') return new Promise(() => {}); // independent ended control only
    throw Error(`Unexpected request: ${url}`);
  },
});
const mod = new vm.SourceTextModule(source.toString('utf8'), { context, identifier: sourcePath });
const dom = new vm.SourceTextModule(domSource.toString('utf8'), { context, identifier: 'actual:dom.js' });
await mod.link((specifier) => { if (specifier !== './dom.js') throw Error(specifier); return dom; });
await mod.evaluate();
const s = new mod.namespace.Soundtrack({ host: new Element('host'), sessionId: 'fixture-session', epoch: 1, listener: { library: 'fixture', seat: 'A', label: 'You' }, controller: true });
const entry = (id) => ({ queueEntryId: id, assetId: `sha256:fixture-${id}`, title: `Song ${id}`, own: false, playlistId: 'fixture-playlist', contributor: { nodeId: 'fixture-red', label: 'Red', participant: { avatarId: 'red-reaper', label: 'Red' } }, offer: { fixture: id }, credits: { creators: null } });
s.queue = { revision: 7, index: 0, controllerSeat: 'A', entries: [entry('A'), entry('B')] };
s.status = 'playing';
s.active = { gen: s.playGen, entry: s.now, url: 'blob:fixture-A', bytes: 1234 };
s.audio._src = 'blob:fixture-A'; s.audio._time = 37.25; s.audio.paused = false;
s.heard.set('A', '2026-11-25T00:00:00.000Z');
s.addEventListener('kept', (e) => keptEvents.push({ entry: e.detail.entry.queueEntryId, state: e.detail.state.state }));
s._render();
const snapshot = () => ({ selected: s.now.queueEntryId, queueIndex: s.queue.index, queueRevision: s.queue.revision, active: s.active?.entry.queueEntryId ?? null, generation: s.playGen, src: s.audio.src, currentTime: s.audio.currentTime, paused: s.audio.paused, volume: s.audio.volume, listening: s.settings.listening, playbackStatus: s.status, savedState: s.keeps.get('A')?.state ?? null });
const before = snapshot();
s.el.findButton('♡ Keep').dispatchEvent(new Event('click')); // actual rendered Keep handler
await flush();
const pending = snapshot();
resolveKeep();
await flush();
const saved = snapshot();
const poll = [...timers].find(([, t]) => t.ms === 500);
if (!poll) throw Error('Expected one scheduled acquisition poll.');
timers.delete(poll[0]); poll[1].fn();
await flush();
const offline = snapshot();
const playback = ({ savedState, ...rest }) => rest;
const unchanged = [pending, saved, offline].every((x) => JSON.stringify(playback(x)) === JSON.stringify(playback(before)));
const callsDuringKeep = audioCalls.slice();
// Independent control: a separate ended event advances via the real constructor listener.
// This demonstrates a distinct cause; it does not establish why a user's live track changed.
s.audio.dispatchEvent(new Event('ended'));
await flush();
const endedControl = { after: snapshot(), reason: s.queue.lastChange?.reason ?? null, calls: audioCalls.slice(callsDuringKeep.length) };
console.log(JSON.stringify({
  schema: 'hapa.versus.review12.keep-playback-invariance.v1',
  reviewBaselineCommit: '8308ea15df3ef844ade37b24a0097f915ac7ba6c',
  source: { path: sourcePath, gitBlobSha: blob(source), matchesReviewedBlob: blob(source) === '813ba478622183ea83d4cca66b16297f4f6c199b', domGitBlobSha: blob(domSource) },
  method: 'Actual Soundtrack constructor, DOM builder, Keep click handler, keep and poll; audio/DOM/owner fixtures; one manual poll timer.',
  limitations: 'No real-time playback, browser hit testing, actual owner response or Table voice acknowledgement is simulated. Audio time is deliberately held constant.',
  before, pending, saved, offline, keptEvents, callsDuringKeep, playbackUnchangedAcrossKeep: unchanged,
  endedControl, requests, networkRequests: 0,
}, null, 2));
if (!unchanged || callsDuringKeep.length) process.exitCode = 1;
