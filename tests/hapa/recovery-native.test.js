/**
 * Inherited Assignment 18 cuts staged natively (Assignment 20, N20-06; HC-10/11): real PeerRuntimes,
 * Hypercore journals and a local HyperDHT testnet. Each test exercises its decisive boundary:
 *  - lost STARTED: the joiner is active, the challenger never saw it start and leaves;
 *  - delayed Ready append: the authority reports `committing`, then `committed` once, with the commands;
 *  - early terminal cut: one side stops right at its terminal step, before the other's closing record
 *    is present, and finishes after restart through the reconnected finishing authority;
 *  - delayed counterpart: one side stops after publishing its closing; the other completes and retires;
 *    the restarted side finishes from the counterpart's stored, verified evidence.
 * Controlled same-host engineering evidence — not an installed app or an internet result.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { PeerRuntime } from '../../src/hapa/network/runtime.js';
import { readJson } from '../../src/hapa/network/store.js';

const createTestnet = createRequire(import.meta.url)('hyperdht/testnet');
const until = async (pred, ms = 120_000, what = 'condition') => { const t0 = Date.now(); for (;;) { const v = await pred(); if (v) return v; if (Date.now() - t0 > ms) throw new Error(`timed out waiting for ${what}`); await new Promise((r) => setTimeout(r, 100)); } };
const progress = (rt, root, id) => readJson(join(root, rt.networkId, 'matches', id, 'progress.json'));

async function setup(name, opts = {}) {
  const testnet = await createTestnet(3);
  const roots = { A: mkdtempSync(join(tmpdir(), `hv-${name}-a-`)), B: mkdtempSync(join(tmpdir(), `hv-${name}-b-`)) };
  const events = { A: [], B: [] };
  const make = (k, o = {}) => new PeerRuntime({ root: roots[k], networkId: `test-${name}`, displayName: k === 'A' ? 'Ada' : 'Bram', controller: opts.controller ?? 'bot', autoAccept: k === 'B', bootstrap: testnet.bootstrap, retireDelayMs: 200, onEvent: (e) => { events[k].push(e); o.onEvent?.(e); }, ...o });
  const cleanup = async (...rts) => { for (const r of rts) await r?.close().catch(() => {}); await testnet.destroy(); for (const r of Object.values(roots)) rmSync(r, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); };
  return { testnet, roots, events, make, cleanup };
}
/** The declared bot on this side concedes from Tick 2 (a legal end; heuristic bots can stalemate for hundreds of Ticks). */
function concedeSoon(m, fromTick = 2) { const plan = m.controller.plan.bind(m.controller); m.controller.plan = (st, ctx) => (st.tick >= fromTick ? [{ type: 'concede' }] : plan(st, ctx)); }
async function challenge(A, B) {
  const peer = await until(() => A.lobbyView().roster.find((r) => r.label === 'Bram' && r.availability === 'available'), 60_000, 'Bram in the roster');
  A.challenge({ playerId: peer.playerId });
}

test('lost STARTED: the active joiner is released when the starting challenger leaves; both can start again', { timeout: 180_000 }, async () => {
  const s = await setup('lost');
  const A = s.make('A'), B = s.make('B');
  try {
    await A.open(); await B.open(); await A.joinLobby({}); await B.joinLobby({});
    const send = B.lobby.send.bind(B.lobby);
    B.lobby.send = (pid, msg) => (msg.t === 'started' ? true : send(pid, msg)); // STARTED never arrives
    await challenge(A, B);
    await until(() => B.match && B.reservation?.phase === 'active' && A.reservation?.phase === 'starting', 60_000, 'asymmetric start');
    const matchId = B.match.matchId;
    A.reservation.at = Date.now() - 31_000; A._sweepOffers();
    assert.equal(A.reservation.stalled, true);
    A.setupLeave({ challengeId: A.reservation.challengeId });
    await until(() => !B.match && !B.reservation, 30_000, 'joiner released');
    assert.equal(progress(B, s.roots.B, matchId).status, 'abandoned_setup');
    assert.ok(Object.values(B.tombstones.attempts).some((t) => t.matchId === matchId));
    assert.ok(!s.events.B.some((e) => e.kind === 'resultSaved'), 'no result or loss is fabricated');
    B.lobby.send = send;
    await challenge(A, B);
    await until(() => A.match && B.match && A.match.matchId === B.match.matchId && A.match.matchId !== matchId, 90_000, 'a new supported match');
  } finally { await s.cleanup(A, B); }
});

test('delayed Ready append: committing → committed once, the late commitment carries the commands', { timeout: 180_000 }, async () => {
  const s = await setup('ready', { controller: 'human' });
  const A = s.make('A'), B = s.make('B');
  try {
    await A.open(); await B.open(); await A.joinLobby({}); await B.joinLobby({});
    await challenge(A, B);
    await until(() => A.match?.current && !A.match.current.replaying, 90_000, 'Tick open');
    const m = A.match, count = m.current.count;
    const pub = m._publish.bind(m);
    m._publish = async (type, ...rest) => { if (type === 'ready') await new Promise((r) => setTimeout(r, 1500)); return pub(type, ...rest); };
    const p = A.handle('match.ready', { matchId: m.matchId, count, commands: [] });
    const during = await A.handle('match.get', {});
    assert.equal(during.current.readyState, 'committing', 'an in-flight append is reported, not an empty refusal');
    const again = await A.handle('match.ready', { matchId: m.matchId, count, commands: [] }); // a retry joins the same append
    const r = await p;
    assert.deepEqual(again, r);
    assert.equal((await A.handle('match.get', {})).current?.count === count ? (await A.handle('match.get', {})).current.readyState : 'committed', 'committed');
    const committed = s.events.A.filter((e) => e.kind === 'ownCommitted' && e.count === count);
    assert.equal(committed.length, 1, 'one durable commitment');
    assert.deepEqual(committed[0].commands, []);
  } finally { await s.cleanup(A, B); }
});

test('early terminal cut: a side stopped at its terminal step finishes after restart through the reconnected finishing authority', { timeout: 240_000 }, async () => {
  let stopA = null;
  const s = await setup('term');
  let A = s.make('A', { onEvent: (e) => { if (e.kind === 'terminal' && !stopA) { stopA = A.close(); } } });
  const B = s.make('B');
  try {
    await A.open(); await B.open(); await A.joinLobby({}); await B.joinLobby({});
    await challenge(A, B);
    await until(() => B.match, 60_000, 'B match');
    concedeSoon(B.match);
    await until(() => !!stopA, 120_000, 'A reaching its terminal step');
    await stopA;
    const id = B.match?.matchId ?? [...B.finishing.keys()][0];
    assert.ok(['terminal'].includes(progress(A, s.roots.A, id).status), 'A stopped with terminal progress and no result');
    assert.ok(!s.events.B.some((e) => e.kind === 'resultSaved'), 'B cannot finish without A\'s closing record');
    // restart A: the finishing authority gets its topic and connection, publishes/receives closings, finalizes once
    A = s.make('A');
    await A.open();
    assert.equal(A.finishing.size, 1);
    await A.joinLobby({});
    await until(() => progress(A, s.roots.A, id)?.status === 'recorded' && progress(B, s.roots.B, id)?.status === 'recorded', 120_000, 'both recorded');
    await until(() => A.finishing.size === 0 && B.finishing.size === 0, 30_000, 'authorities retired');
    assert.equal(progress(A, s.roots.A, id).commitment, progress(B, s.roots.B, id).commitment, 'the same verified result on both');
    assert.equal(A.results.list({}).total, 1);
  } finally { await s.cleanup(A, B); }
});

test('delayed counterpart: after the other side completed and retired, a restarted side finishes from its stored verified evidence', { timeout: 240_000 }, async () => {
  const s = await setup('late');
  const A = s.make('A');
  let B = s.make('B');
  let stopB = null;
  try {
    await A.open(); await B.open(); await A.joinLobby({}); await B.joinLobby({});
    await challenge(A, B);
    await until(() => B.match, 60_000, 'B match');
    const m = B.match, id = m.matchId;
    concedeSoon(m);
    // B publishes its closing, lets it replicate to A, then stops; A holds its own closing until B is
    // down, so B's stored replica never receives it (it can only come back as A's stored evidence)
    let bDown = false;
    const pub = m._publish.bind(m);
    m._publish = async (type, ...rest) => { const r = await pub(type, ...rest); if (type === 'closing' && !stopB) stopB = new Promise((res) => setTimeout(res, 2000)).then(() => B.close()).then(() => { bDown = true; }); return r; };
    await until(() => A.match, 60_000, 'A match');
    const ma = A.match, pubA = ma._publish.bind(ma);
    ma._publish = async (type, ...rest) => { if (type === 'closing') await until(() => bDown, 120_000, 'B down'); return pubA(type, ...rest); };
    await until(() => !!stopB, 120_000, 'B publishing its closing');
    await stopB;
    // A receives B's closing, completes, records and retires its authority
    await until(() => progress(A, s.roots.A, id)?.status === 'recorded' && A.finishing.size === 0 && !A.match, 120_000, 'A recorded and retired');
    assert.notEqual(progress(B, s.roots.B, id)?.status, 'recorded');
    // B restarts: A's match cores are closed, so replication cannot supply A's closing; evidence retrieval does
    B = s.make('B');
    await B.open(); await B.joinLobby({});
    await until(() => progress(B, s.roots.B, id)?.status === 'recorded', 120_000, 'B recorded from evidence');
    assert.equal(progress(B, s.roots.B, id).via, 'retrieved-evidence');
    assert.equal(progress(B, s.roots.B, id).commitment, progress(A, s.roots.A, id).commitment);
    await until(() => B.finishing.size === 0, 30_000, 'B retired');
    assert.equal(B.results.list({}).total, 1, 'one result, no duplicate');
  } finally { await s.cleanup(A, B); }
});
