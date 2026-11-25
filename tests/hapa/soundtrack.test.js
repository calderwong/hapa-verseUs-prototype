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
