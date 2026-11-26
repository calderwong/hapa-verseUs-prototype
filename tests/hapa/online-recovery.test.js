/**
 * Durable decisions, recovery and the player view (reviews 16/17: R16-04, R16-05, R17-03, R17-04,
 * R17-05). Adapted from the reviews' source-method probes into positive regressions: the same
 * extraction of exact app methods for the view, and the real OnlineMatch/PeerRuntime classes for
 * the authority. No browser, Electron or network is involved here; the native journeys are separate.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OnlineMatch } from '../../src/hapa/network/online-match.js';
import { PeerRuntime } from '../../src/hapa/network/runtime.js';
import { readJson } from '../../src/hapa/network/store.js';

const appSource = readFileSync(new URL('../../src/hapa/presentation/app.js', import.meta.url), 'utf8');
const clientSource = readFileSync(new URL('../../src/hapa/presentation/online.js', import.meta.url), 'utf8');
const cls = clientSource.slice(clientSource.indexOf('export class OnlineClient'), clientSource.indexOf('/** A session object')).replace('export class', 'class');
const OnlineClient = new Function(`${cls}; return OnlineClient;`)();
const method = (start, end, name) => {
  const first = appSource.indexOf(start), last = appSource.indexOf(end, first);
  assert.ok(first >= 0 && last > first, `missing method ${name}`);
  return new Function('other', 'document', `return ({${appSource.slice(first, last)}}).${name};`)((s) => (s === 'A' ? 'B' : 'A'), { querySelector: () => null });
};
const onEvent = method('  _onOnlineEvent(e, gen) {', '  /** Ready in an online match:', '_onOnlineEvent');
const applyTick = method('  _applyOnlineTick() {', '  _onOnlineEvent(e, gen) {', '_applyOnlineTick');
const can = method('  _can(seat = this.viewSeat) {', "  /** The seat's plan errors", '_can');

function harness(tick) {
  const client = new OnlineClient({ onEvent: () => () => {}, call: async () => null });
  const m = client.bind({ matchId: 'm1', seat: 'A', status: 'active', connection: 'connected' });
  const app = {
    generation: 1, state: { tick, outcome: null }, onlineMatch: m, _onlineSnap: null, seats: { A: 'human', B: 'remote' }, viewSeat: 'A', resolving: true,
    plans: { A: [], B: [] }, rev: { A: 0, B: 0 }, ready: { A: null, B: null }, agreement: { ready: {} },
    _publish(seat, kind) { if (kind === 'ready') this.agreement.ready[seat] = true; return { ok: true }; },
    _readyValid(seat) { return !!this.agreement.ready[seat]; }, _planErrors() { return []; }, _syncDraftMana() {}, _renderAll() {}, _toast() {}, _showBlocked() { this.blockedShown = true; }, _tryResolve() {},
  };
  client.on((e) => onEvent.call(app, e, 1));
  return { app, client };
}
const remote = [
  { type: 'match', matchId: 'm1', kind: 'remotePlan', count: 5, revision: 2, commands: [{ type: 'set_destination', partyId: 'B.castle', target: { column: 9, row: 7 } }] },
  { type: 'match', matchId: 'm1', kind: 'remoteReady', count: 5, revision: 2, commands: [{ type: 'set_destination', partyId: 'B.castle', target: { column: 9, row: 7 } }] },
];

test('R17-04: public plans and Ready received while the view is behind appear when their Tick opens', () => {
  const { app, client } = harness(4);
  for (const e of remote) client._event(e);
  Object.assign(app, { state: { tick: 5, outcome: null }, resolving: false, plans: { A: [], B: [] }, rev: { A: 0, B: 0 }, ready: { A: null, B: null }, agreement: { ready: {} } });
  applyTick.call(app);
  assert.equal(app.plans.B.length, 1);
  assert.equal(app.rev.B, 2);
  assert.equal(!!app.agreement.ready.B, true);
  // events that arrived before the view bound (snapshot/subscription race) are kept as well
  const early = new OnlineClient({ onEvent: () => () => {}, call: async () => null });
  for (const e of remote) early._event(e);
  const m = early.bind({ matchId: 'm1', seat: 'A', status: 'active', connection: 'connected', current: { count: 5, remote: { revision: 1, commands: [], ready: false } } });
  assert.deepEqual([m.remote.get(5).revision, m.remote.get(5).ready], [2, true]);
});

test('R17-05 / R16-05: a disputed match and an in-flight Ready both freeze the own plan', () => {
  const { app, client } = harness(5);
  app.resolving = false;
  assert.equal(can.call(app, 'A').edit, true);
  app._readyPending = true;
  assert.deepEqual([can.call(app, 'A').edit, can.call(app, 'A').ready], [false, false]);
  app._readyPending = false;
  client._event({ type: 'match', matchId: 'm1', kind: 'disputed', reason: 'fixture receipt mismatch' });
  const g = can.call(app, 'A');
  assert.deepEqual([g.edit, g.ready, g.blocked], [false, false, true]);
  assert.equal(app.blockedShown, true); // a persistent sheet, not only a toast
  assert.match(appSource, /'match\.leave'/); // the renderer offers explicit departure
});

test('R17-03: a response stays pending until its exact answer is durable; a failed append leaves a usable retry', async () => {
  const m = Object.create(OnlineMatch.prototype);
  let resolved = 0, attempts = 0;
  const pc = { req: { choiceId: 'C3.1' }, index: 0, requestHash: 'sha256:x', resolve: () => { resolved++; } };
  Object.assign(m, { matchId: 'm1', seat: 'B', current: { count: 3, pendingChoice: pc, choices: [] } });
  m._publish = () => (++attempts === 1 ? Promise.reject(new Error('disk full')) : Promise.resolve({}));
  await assert.rejects(m.choice({ matchId: 'm1', count: 3, choiceId: 'C3.1', answer: { pass: true } }), (e) => e.code === 'CHOICE_NOT_RECORDED');
  assert.equal(m.current.pendingChoice, pc); // still waiting, still answerable
  assert.equal(resolved, 0);
  const [a, b] = await Promise.all([m.choice({ matchId: 'm1', count: 3, choiceId: 'C3.1', answer: { pass: true } }), m.choice({ matchId: 'm1', count: 3, choiceId: 'C3.1', answer: { pass: true } })]);
  assert.deepEqual(a, b); // one submission, one record
  assert.equal(attempts, 2);
  assert.equal(resolved, 1);
  assert.equal(m.current.pendingChoice, null);
  m.current.choices.push({ seat: 'B', choiceId: 'C3.1', answer: { pass: true } });
  const again = await m.choice({ matchId: 'm1', count: 3, choiceId: 'C3.1', answer: { pass: true } });
  assert.deepEqual(again.recorded, { choiceId: 'C3.1', answer: { pass: true } }); // a lost acknowledgment reconciles structurally
});

test('R16-04: an interrupted setup is shown stalled, can be left durably, and late messages cannot revive it', async () => {
  const root = mkdtempSync(join(tmpdir(), 'hv-setup-'));
  try {
    const rt = new PeerRuntime({ root, networkId: 'test-setup' });
    await rt.open();
    rt._reserve({ phase: 'accepted', role: 'joiner', challengeId: 'ab'.repeat(16), matchId: `hv-${'ab'.repeat(16)}`, opponent: 'hv1:' + 'c'.repeat(64), opponentLabel: 'Kai', at: Date.now() - 31_000 });
    rt._sweepOffers();
    assert.equal(rt.reservation.stalled, true);
    assert.equal(rt.lobbyView().reservation.stalled, true);
    rt.setupLeave({ challengeId: 'ab'.repeat(16) });
    assert.equal(rt.reservation, null);
    assert.ok(readJson(join(root, 'test-setup', 'tombstones.json')).attempts['ab'.repeat(16)]);
    const peer = { playerId: 'hv1:' + 'c'.repeat(64), player: { publicKey: 'c'.repeat(64), label: 'Kai' } };
    await rt._onMessage(peer, { t: 'start', descriptor: { matchId: `hv-${'ab'.repeat(16)}` }, manifest: {}, sig: 'x' });
    await rt._onMessage(peer, { t: 'started', matchId: `hv-${'ab'.repeat(16)}`, sig: 'x' });
    assert.equal(rt.reservation, null);
    assert.equal(rt.match, null);
    await rt.close();
    const again = new PeerRuntime({ root, networkId: 'test-setup' });
    await again.open(); // a restart keeps the tombstone and opens no match for the abandoned attempt
    assert.equal(again.match, null);
    assert.ok(again._tombstoned(null, `hv-${'ab'.repeat(16)}`));
    await again.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
