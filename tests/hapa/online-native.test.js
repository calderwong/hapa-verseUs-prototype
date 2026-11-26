/**
 * Native online lifecycle (reviews 16/17: R16-01, R16-02, R17-06) on real Hypercore storage and a
 * local HyperDHT testnet: two runtimes play two successive matches, attest authenticated prefixes,
 * finalize results and close every authority; then both documented finalization crash cuts are
 * reconstructed from the real journals. Also a real fork/prefix boundary on a native core.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import Hypercore from 'hypercore';
import b4a from 'b4a';
import { PeerRuntime } from '../../src/hapa/network/runtime.js';
import { feedPrefix, prefixRoot, rawBlocks } from '../../src/hapa/network/prefix.js';
import { readJson } from '../../src/hapa/network/store.js';

const createTestnet = createRequire(import.meta.url)('hyperdht/testnet');
const NET = 'test-native';
const until = async (pred, ms = 90_000) => { const t0 = Date.now(); for (;;) { const v = await pred(); if (v) return v; if (Date.now() - t0 > ms) throw new Error('timed out'); await new Promise((r) => setTimeout(r, 100)); } };

test('a real Hypercore fork changes the authenticated prefix; the recomputed root matches the core', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'hv-fork-'));
  try {
    const core = new Hypercore(join(dir, 'c'), { valueEncoding: 'json' });
    await core.ready();
    for (let i = 0; i < 6; i++) await core.append({ i });
    const before = await feedPrefix(core, 5);
    assert.equal(prefixRoot(await rawBlocks(core, 0, 5)), before.root);
    await core.truncate(3); // a writer rewriting history
    for (let i = 0; i < 3; i++) await core.append({ i, rewritten: true });
    const after = await feedPrefix(core, 5);
    assert.notEqual(after.root, before.root);
    assert.ok(after.fork > before.fork);
    assert.notEqual(prefixRoot(await rawBlocks(core, 0, 5)), before.root); // the old attested prefix no longer matches these bytes
    await core.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('two runtimes finish two matches, close every authority, and finalization repairs both crash cuts', { timeout: 240_000 }, async () => {
  const testnet = await createTestnet(3);
  const roots = { A: mkdtempSync(join(tmpdir(), 'hv-nat-a-')), B: mkdtempSync(join(tmpdir(), 'hv-nat-b-')) };
  const events = { A: [], B: [] };
  const make = (k, o = {}) => new PeerRuntime({ root: roots[k], networkId: NET, displayName: k === 'A' ? 'Ada' : 'Bram', controller: 'bot', autoAccept: k === 'B', bootstrap: testnet.bootstrap, retireDelayMs: 200, onEvent: (e) => events[k].push(e), ...o });
  try {
    const rt = { A: make('A'), B: make('B') };
    await rt.A.open(); await rt.B.open();
    await rt.A.joinLobby({}); await rt.B.joinLobby({});
    const opened = [];
    for (let n = 1; n <= 2; n++) {
      const peer = await until(() => rt.A.lobbyView().roster.find((r) => r.label === 'Bram' && r.availability === 'available'));
      rt.A.challenge({ playerId: peer.playerId });
      const m = await until(() => (rt.A.match && !opened.includes(rt.A.match) ? rt.A.match : null));
      opened.push(m);
      await until(() => events.A.filter((e) => e.kind === 'resultSaved').length >= n && events.B.filter((e) => e.kind === 'resultSaved').length >= n);
      await until(() => rt.A.finishing.size === 0 && rt.B.finishing.size === 0 && m.closed);
    }
    // R17-06: both authorities were retired after their evidence was durable; nothing is still owned
    assert.deepEqual(opened.map((m) => m.closed), [true, true]);
    assert.equal(rt.A.match, null);
    // R16-01: each side holds two verified, attested results; statuses are recorded
    for (const k of ['A', 'B']) assert.equal(rt[k].results.list({}).total, 2);
    const ids = readdirSync(join(roots.A, NET, 'matches'));
    for (const id of ids) assert.equal(readJson(join(roots.A, NET, 'matches', id, 'progress.json')).status, 'recorded');
    await rt.A.close(); await rt.B.close();

    // R16-02 cut 1: terminal journal/progress exists, the result and its sharing job do not
    const [first] = ids;
    const mdir = join(roots.A, NET, 'matches', first);
    const key = readJson(join(mdir, 'progress.json')).key;
    writeFileSync(join(mdir, 'progress.json'), JSON.stringify({ status: 'terminal' }));
    rmSync(join(roots.A, NET, 'results'), { recursive: true, force: true });
    const outbox = readJson(join(roots.A, NET, 'outbox.json')); delete outbox[key]; writeFileSync(join(roots.A, NET, 'outbox.json'), JSON.stringify(outbox));
    events.A.length = 0;
    const r1 = make('A');
    await r1.open(); // no network: the opponent's attestation is already in the local replica
    await until(() => events.A.some((e) => e.kind === 'resultSaved' && e.matchId === first) && r1.finishing.size === 0);
    assert.equal(r1.results.list({}).total, 1); // the repaired result (the other match's index was removed with the folder and is not rebuilt from nothing)
    assert.ok(r1.outbox[key]);
    assert.equal(readJson(join(mdir, 'progress.json')).status, 'recorded');
    await r1.close();

    // R16-02 cut 2: the verified result exists, its sharing job does not
    writeFileSync(join(mdir, 'progress.json'), JSON.stringify({ status: 'attested' }));
    const ob = readJson(join(roots.A, NET, 'outbox.json')); delete ob[key]; writeFileSync(join(roots.A, NET, 'outbox.json'), JSON.stringify(ob));
    events.A.length = 0;
    const r2 = make('A');
    await r2.open();
    await until(() => events.A.some((e) => e.kind === 'resultSaved' && e.matchId === first) && r2.finishing.size === 0);
    assert.equal(r2.results.list({}).total, 1); // a duplicate, not a second count
    assert.equal(Object.values(r2.outbox).filter((o) => o.matchId === first).length, 1);
    await r2.close();

    // reopening again changes nothing
    const r3 = make('A');
    await r3.open();
    assert.equal(r3.finishing.size, 0);
    assert.equal(r3.results.list({}).total, 1);
    await r3.close();
  } finally {
    await testnet.destroy();
    for (const r of Object.values(roots)) rmSync(r, { recursive: true, force: true });
  }
});
