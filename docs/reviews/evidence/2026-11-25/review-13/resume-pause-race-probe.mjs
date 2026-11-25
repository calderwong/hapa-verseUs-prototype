/**
 * Review 13: delayed AudioContext resume must not undo Pause.
 * Usage: node --experimental-vm-modules <this-file> <repository-root>
 * Loads the exact Soundtrack + MusicSignal modules. No network/browser/audio output.
 * The audio element and suspended audio context are fixtures; both public togglePlay calls,
 * MusicSignal.resume and the later audio.play decision are actual source under review.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const root = process.argv[2];
if (!root || !vm.SourceTextModule) throw Error('Pass a repository root with --experimental-vm-modules');
const paths = ['src/hapa/presentation/soundtrack.js', 'src/hapa/presentation/music-signal.js'];
const bytes = await Promise.all(paths.map((p) => readFile(resolve(root, p))));
const hash = (b) => createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
const calls = [];
class DetailEvent extends Event { constructor(type, o) { super(type); this.detail = o?.detail; } }
class AudioFixture extends EventTarget {
  constructor() { super(); this.src = 'blob:fixture-song'; this.currentTime = 37; this.duration = 120; this.paused = true; this.ended = false; this.volume = 1; }
  getAttribute(k) { return k === 'src' ? this.src : null; }
  pause() { calls.push('audio.pause'); this.paused = true; this.dispatchEvent(new Event('pause')); }
  play() { calls.push('audio.play'); this.paused = false; this.dispatchEvent(new Event('playing')); return Promise.resolve(); }
}
let release;
const gate = new Promise((r) => { release = r; });
const graph = { state: 'suspended', resume() { calls.push('context.resume'); return gate; } };
const ctx = vm.createContext({
  Event, EventTarget, CustomEvent: DetailEvent, Audio: AudioFixture, AbortController,
  localStorage: { getItem: () => JSON.stringify({ listening: false }), setItem() {} },
  setTimeout, clearTimeout, setInterval, clearInterval, console,
  fetch: () => { throw Error('No network expected'); },
});
const signal = new vm.SourceTextModule(bytes[1].toString('utf8'), { context: ctx });
const soundtrack = new vm.SourceTextModule(bytes[0].toString('utf8'), { context: ctx });
await signal.link(() => { throw Error('Unexpected import'); });
await soundtrack.link((specifier) => { if (specifier !== './music-signal.js') throw Error(specifier); return signal; });
await soundtrack.evaluate();
const s = new soundtrack.namespace.Soundtrack({ sessionId: 'fixture', epoch: 1, listener: { library: 'fixture', seat: 'A', label: 'You' }, controller: true });
const item = { key: 'queue-fixture-A', kind: 'offer', assetId: 'sha256:fixture-A', recordingId: 'fixture-A', entry: {} };
s.queue.entries = [{ queueEntryId: item.key, item }];
s.queue.index = 0;
s.active = { gen: 0, item, url: s.audio.src, started: true };
s.status = 'paused';
s.signal.ctx = graph;
s.signal.gain = { gain: { value: 0.55 } };
const snap = () => ({ listening: s.settings.listening, status: s.status, generation: s.playGen, activeGeneration: s.active.gen, audioPaused: s.audio.paused, item: s.now.key, time: s.audio.currentTime, calls: [...calls] });
const before = snap();
s.togglePlay(); // explicit Play starts an async graph resume and waits before audio.play
const pending = snap();
s.togglePlay(); // explicit Pause fences the attempt and pauses the element
const paused = snap();
graph.state = 'running';
release(); // old graph resume settles after Pause
await new Promise((r) => setImmediate(r));
await new Promise((r) => setImmediate(r));
const after = snap();
const latePlay = calls.slice(paused.calls.length).includes('audio.play');
console.log(JSON.stringify({
  schema: 'hapa.versus.review13.resume-pause-race.v1',
  reviewBaselineCommit: 'e04286188e13800e588557bd5cb53a9b0e3724c0',
  source: paths.map((path, i) => ({ path, gitBlobSha: hash(bytes[i]) })),
  method: 'Actual Soundtrack.togglePlay twice and actual MusicSignal.resume with a deferred suspended-context fixture; Audio.play dispatches playing as a browser would.',
  limitations: 'Controlled scheduling proof, not a live browser reproduction. No owner, network or audible output.',
  before, pending, paused, after,
  stalePlayAfterPause: latePlay,
  pausedIntentUndone: !after.listening && after.status === 'paused' && !after.audioPaused,
}, null, 2));
// Exit 0 indicates the diagnostic ran, not that the behavior satisfies the requirement.
