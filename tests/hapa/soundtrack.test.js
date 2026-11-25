// Focused contracts for the table soundtrack (Assignment 13 §3B–C): local replay bookmark and Return,
// replay-end stop, quiet Keep bound to its original encounter, and Kept rows by exact asset. Audio,
// fetch and storage are fixtures; this does not prove browser playback or live owner retention.
import test from 'node:test';
import assert from 'node:assert/strict';

class FakeAudio extends EventTarget {
  constructor() { super(); this.calls = []; this.paused = true; this.ended = false; this.currentTime = 0; this.duration = 100; this.volume = 1; this.readyState = 1; this._src = null; }
  set src(v) { this.calls.push('src'); this._src = v; this.currentTime = 0; }
  get src() { return this._src; }
  getAttribute(k) { return k === 'src' ? this._src : null; }
  removeAttribute() { this.calls.push('removeSrc'); this._src = null; }
  load() { this.calls.push('load'); }
  play() { this.calls.push('play'); this.paused = false; queueMicrotask(() => this.dispatchEvent(new Event('playing'))); return Promise.resolve(); }
  pause() { this.calls.push('pause'); this.paused = true; }
}
globalThis.Audio = FakeAudio;
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

const offer = (n) => ({ manifest: { files: [{ assetId: `sha256:${String(n).repeat(64).slice(0, 64)}` }], recording: { id: `rec-${n}`, version: null } } });
const snapshot = (lib, ids) => ({ playlistId: `pl-${lib}`, revision: 1, contributor: { nodeId: `${lib}-node`, label: lib, participant: { label: lib === 'red' ? 'Red' : 'You', avatarId: lib === 'red' ? 'red-reaper' : undefined } },
  entries: ids.map((n) => ({ entryId: `${lib}-${n}`, recordingId: `rec-${n}`, title: `Song ${n}`, credits: { creators: null, generator: { name: 'Gen' } }, durationSeconds: 100, offer: offer(n) })) });

let keepGate = null;
function installFetch({ retained = [], encounters = [] } = {}) {
  globalThis.fetch = async (url, o = {}) => {
    const json = (v) => new Response(JSON.stringify(v), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (url.endsWith('/songs')) return json({ songs: [{ id: 'a' }, { id: 'b' }] });
    if (url.endsWith('/contributions')) return json(snapshot(url.includes('/red/') ? 'red' : 'cj', url.includes('/red/') ? [1, 3] : [2]));
    if (url.endsWith('/retained')) return json({ entries: retained });
    if (url.endsWith('/encounters')) return json({ encounters });
    if (url.endsWith('/audio')) return new Response(new Blob([new Uint8Array(8)]), { status: 200 });
    if (url.endsWith('/keep')) { if (keepGate) await keepGate; return json({ acquisitionId: 'acq-x', state: 'available-offline' }); }
    throw Error(`unexpected ${url} ${o.method ?? 'GET'}`);
  };
}

const { Soundtrack } = await import('../../src/hapa/presentation/soundtrack.js');
const tick = () => new Promise((r) => setTimeout(r, 5));

async function playingTrack() {
  installFetch();
  const m = new Soundtrack({ sessionId: 's1', epoch: 1, listener: { library: 'cj', seat: 'A', label: 'You' }, controller: true });
  await m.prepare([{ library: 'red', participant: { label: 'Red' }, max: 2 }, { library: 'cj', songIds: ['x'], participant: { label: 'You' } }]);
  m.start();
  await tick(); await tick();
  return m;
}

test('a local replay bookmarks the table once, stops at its end, and Return restores the bookmark', async () => {
  const m = await playingTrack();
  assert.equal(m.status, 'playing');
  m.next(); await tick(); await tick(); // q2 has now played too
  m.audio.currentTime = 30;
  const tableEntry = m.tableEntry;
  const list = m.playedRows().map((r) => r.item);
  m.playItem(list[0], list, 'played'); await tick(); await tick();
  assert.equal(m.mode, 'replay');
  assert.deepEqual([m.bookmark.entry, m.bookmark.time, m.bookmark.listening], [tableEntry, 30, true]);
  m.next(); await tick(); await tick(); // manual navigation along the captured list
  assert.equal(m.now, list[1]);
  m.audio.currentTime = 1; m.previous(); await tick(); await tick();
  assert.equal(m.now, list[0]);
  assert.equal(m.bookmark.time, 30, 'navigation never overwrites the bookmark');
  const idx = m.queue.index;
  m.audio.dispatchEvent(new Event('ended'));
  assert.equal(m.mode, 'replay'); assert.equal(m.replay.ended, true); assert.equal(m.queue.index, idx, 'a replay end never advances the table');
  m.returnToTable(); await tick(); await tick();
  assert.equal(m.mode, 'table'); assert.equal(m.now, tableEntry.item); assert.equal(m.audio.currentTime, 30);
  assert.deepEqual(m.transport.map((x) => x.reason), ['start', 'next', 'replay-select', 'replay-next', 'replay-previous', 'replay-ended', 'return']);
  m.dispose();
});

test('Keep changes saved state only, and a reply after Next stays with the original encounter', async () => {
  const m = await playingTrack();
  const target = m.now;
  let release; keepGate = new Promise((r) => { release = r; });
  const before = { calls: m.audio.calls.length, gen: m.playGen, vol: m.audio.volume };
  const p = m.keep(target.entry.item);
  assert.equal(m.keeps.get(target.key).state, 'saving');
  assert.deepEqual({ calls: m.audio.calls.length, gen: m.playGen, vol: m.audio.volume }, before, 'pressing Keep touches no audio');
  m.next(); await tick(); await tick(); // an independent transport action while saving
  const now = m.now, calls = m.audio.calls.length, gen = m.playGen;
  release(); await p; await tick();
  keepGate = null;
  assert.equal(m.keeps.get(target.key).state, 'available-offline');
  assert.equal(m.keeps.get(now.key), undefined);
  assert.deepEqual([m.now, m.audio.calls.length, m.playGen], [now, calls, gen], 'the reply changes nothing about playback');
  m.dispose();
});

test('Kept rows are one per exact asset; similar titles stay apart; unretained saves are honest', async () => {
  installFetch({
    retained: [{ libraryId: 'retained:aaaaaaaaaaaaaaaaaaaaaaaa', assetId: 'sha256:a', title: 'Lantern (60 s)', durationSeconds: 60, introductions: [{ introducer: { label: 'Red' } }, { introducer: { label: 'Red' } }] },
      { libraryId: 'retained:bbbbbbbbbbbbbbbbbbbbbbbb', assetId: 'sha256:b', title: 'Lantern (24 s)', durationSeconds: 24, introductions: [] },
      { libraryId: 'retained:not-an-address', assetId: 'sha256:z', title: 'bad' }],
    encounters: [{ assetId: 'sha256:a', savedAt: '1' }, { assetId: 'sha256:c', title: 'Unretained', savedAt: '2', acquisition: { state: 'saved-reference-only' } }, { assetId: 'sha256:c', title: 'Unretained', savedAt: '3', acquisition: { state: 'saved-reference-only' } }],
  });
  const m = new Soundtrack({ sessionId: 's2', epoch: 1, listener: { library: 'cj', seat: 'A', label: 'You' }, controller: true });
  await m.refreshKept();
  const rows = m.keptRows();
  assert.deepEqual(rows.map((r) => [r.key, r.availability, !!r.item]), [['retained:aaaaaaaaaaaaaaaaaaaaaaaa', 'available-offline', true], ['retained:bbbbbbbbbbbbbbbbbbbbbbbb', 'available-offline', true], ['sha256:c', 'saved-reference-only', false]]);
  assert.equal(rows[2].introductions.length, 2, 'two discoveries of the same unretained asset group together');
  assert.equal(rows[0].item.key, 'cj/retained:aaaaaaaaaaaaaaaaaaaaaaaa', 'listener library + libraryId is the durable address');
  assert.equal(m.keptRows()[0].item, rows[0].item, 'row items are stable across reads');
  m.dispose();
});

// --- Review 13 / Assignment 14 focused transport families (R13-01 – R13-03) -----------------------

test('R13-01: a delayed graph resume after Pause never plays; the current valid attempt still starts', async () => {
  const m = await playingTrack();
  m.pause(); await tick();
  let release; const gate = new Promise((r) => { release = r; });
  m.signal.resume = () => gate.then(() => true); // the audio graph takes time to resume
  m.play(); // Play: the start waits on the graph
  assert.equal(m.primaryAction(), 'pause', 'a pending start shows Pause');
  m.pause(); // Pause while the old resume is pending
  const plays = m.audio.calls.filter((c) => c === 'play').length;
  release(); await tick(); await tick();
  assert.equal(m.audio.calls.filter((c) => c === 'play').length, plays, 'no late audio.play() after Pause');
  assert.deepEqual([m.settings.listening, m.status, m.audio.paused], [false, 'paused', true]);
  // the same fence for a selection change and for disposal during the wait
  let r2; m.signal.resume = () => new Promise((r) => { r2 = r; }).then(() => true);
  m.play(); const stale = m.now; m.next(); // the new selection's own start also waits on r2
  r2(); await tick(); await tick();
  assert.notEqual(m.now, stale);
  // a current valid attempt starts
  m.signal.resume = async () => true;
  m.pause(); m.play(); await tick(); await tick();
  assert.equal(m.status, 'playing'); assert.equal(m.audio.paused, false);
  let r3; m.signal.resume = () => new Promise((r) => { r3 = r; }).then(() => true);
  m.pause(); m.play(); const before = m.audio.calls.filter((c) => c === 'play').length;
  m.dispose(); r3(); await tick();
  assert.equal(m.audio.calls.filter((c) => c === 'play').length, before, 'disposal fences a pending start');
});

test('R13-02: one Play from ready, recoverable failure, finished and activation-blocked states', async () => {
  // ready (prepared, never started): one press plays
  installFetch();
  const a = new Soundtrack({ sessionId: 's3', epoch: 1, listener: { library: 'cj', seat: 'A', label: 'You' }, controller: true });
  await a.prepare([{ library: 'red', participant: { label: 'Red' }, max: 2 }]);
  assert.deepEqual([a.status, a.primaryAction()], ['ready', 'play']);
  a.togglePlay(); await tick(); await tick();
  assert.deepEqual([a.status, a.primaryAction(), a.audio.paused], ['playing', 'pause', false], 'the first press plays');
  // recoverable failure in the table mix: Play retries the same recording; the pending skip is cancelled
  const failed = a.now;
  a.audio.dispatchEvent(new Event('error'));
  assert.deepEqual([a.status, a.primaryAction()], ['failed', 'play']);
  a.togglePlay(); await tick(); await tick();
  assert.equal(a.now, failed); assert.equal(a.status, 'playing'); assert.equal(failed.entry.skipped, false);
  await new Promise((r) => setTimeout(r, 1700));
  assert.equal(a.now, failed, 'no skip after a successful retry');
  // finished table mix: Play again restarts the last song from zero
  a.next(); await tick(); await tick();
  a.audio.currentTime = 99.5; a.audio.dispatchEvent(new Event('ended'));
  assert.deepEqual([a.status, a.primaryAction()], ['finished', 'play-again']);
  a.togglePlay(); await tick(); await tick();
  assert.deepEqual([a.status, a.audio.currentTime, a.transport.at(-1).reason], ['playing', 0, 'play-again']);
  a.dispose();
  // activation blocked: the recording stays selected (never skipped) until one gesture
  const b = await playingTrack();
  b.pause();
  b.signal.resume = async () => false; // the browser holds the audio graph until a user gesture
  const keep = b.now;
  b.play(); await tick(); await tick();
  assert.deepEqual([b.status, b.primaryAction()], ['blocked', 'play']);
  await new Promise((r) => setTimeout(r, 1700));
  assert.equal(b.now, keep); assert.equal(!!keep.entry.skipped, false, 'a block is not unusable media');
  b.signal.resume = async () => true;
  b.togglePlay(); await tick(); await tick();
  assert.deepEqual([b.now, b.status], [keep, 'playing'], 'one gesture recovers the same recording');
  // a play() refusal (NotAllowedError) is the same block
  b.pause();
  const orig = b.audio.play.bind(b.audio);
  b.audio.play = () => Promise.reject(Object.assign(Error('denied'), { name: 'NotAllowedError' }));
  b.play(); await tick(); await tick();
  assert.equal(b.status, 'blocked');
  b.audio.play = orig; b.togglePlay(); await tick(); await tick();
  assert.equal(b.status, 'playing');
  b.dispose();
});

test('R13-03: Previous follows actual recent listening (1, 2, 3, replay 1, Return 3, Previous → 1)', async () => {
  installFetch();
  const m = new Soundtrack({ sessionId: 's4', epoch: 1, listener: { library: 'cj', seat: 'A', label: 'You' }, controller: true });
  await m.prepare([{ library: 'red', participant: { label: 'Red' }, max: 2 }, { library: 'cj', songIds: ['x'], participant: { label: 'You' } }]);
  m.start(); await tick(); await tick();
  m.next(); await tick(); await tick(); m.next(); await tick(); await tick();
  const [s1, , s3] = m.queue.entries.map((e) => e.item);
  assert.equal(m.now, s3);
  m.keep(s1); m.keptRows(); m.playedRows(); await tick(); // saving and browsing are not listening
  assert.deepEqual(m.history.map((x) => x.item), m.queue.entries.map((e) => e.item));
  m.audio.currentTime = 20;
  m.playItem(s1, m.playedRows().map((r) => r.item), 'played'); await tick(); await tick();
  m.returnToTable(); await tick(); await tick();
  assert.equal(m.now, s3);
  m.seek(0);
  assert.equal(m.nav().prev.does, 'replay-earlier');
  const recent = m.recentItems().map((i) => i.key); // latest occurrence order when Previous is pressed
  m.previous(); await tick(); await tick();
  assert.deepEqual([m.mode, m.now], ['replay', s1], 'the most recently heard other recording');
  // the replay list is captured then (recency order) and navigation walks back through it
  assert.deepEqual(m.replay.list.map((i) => i.key), recent);
  m.audio.currentTime = 10; m.previous();
  assert.equal(m.transport.at(-1).reason, 'restart', 'after 3 s Previous restarts the song');
  m.audio.currentTime = 1; m.previous(); await tick(); await tick();
  assert.equal(m.transport.at(-1).reason, 'replay-previous');
  m.dispose();
});
