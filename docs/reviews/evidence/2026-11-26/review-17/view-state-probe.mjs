// Bounded source-method probes. No DOM, WebGL, Electron, native storage or real peer is run.
// Exact OnlineClient class and selected VersusApp methods are loaded from the reviewed files.
// Run from a checkout root, or pass that root as the first positional argument. JSON goes to stdout.
import { readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = pathToFileURL(resolve(process.argv[2] ?? '.') + sep);
const appSource = readFileSync(new URL('src/hapa/presentation/app.js', root), 'utf8');
const clientSource = readFileSync(new URL('src/hapa/presentation/online.js', root), 'utf8');
const runtimeSource = readFileSync(new URL('src/hapa/network/runtime.js', root), 'utf8');
const cls = clientSource.slice(clientSource.indexOf('export class OnlineClient'), clientSource.indexOf('/** A session object')).replace('export class', 'class');
const OnlineClient = new Function(`${cls}; return OnlineClient;`)();
const method = (start, end, name) => {
  const first = appSource.indexOf(start), last = appSource.indexOf(end, first);
  assert.ok(first >= 0 && last > first, `missing method ${name}`);
  return new Function('other', 'document', `return ({${appSource.slice(first, last)}}).${name};`)(s => s === 'A' ? 'B' : 'A', { querySelector: () => null });
};
const onEvent = method('  _onOnlineEvent(e, gen) {', '  /** Ready in an online match:', '_onOnlineEvent');
const applyTick = method('  _applyOnlineTick() {', '  _onOnlineEvent(e, gen) {', '_applyOnlineTick');
const can = method('  _can(seat = this.viewSeat) {', "  /** The seat's plan errors", '_can');

function harness(tick) {
  const toasts = [], publishes = [];
  const client = new OnlineClient({ onEvent: () => () => {}, call: () => { throw new Error('host call not part of probe'); } });
  const m = client.bind({ matchId: 'review-m', seat: 'A', status: 'active', connection: 'connected' });
  const app = {
    generation: 1, state: { tick, outcome: null }, onlineMatch: m, _onlineSnap: null,
    seats: { A: 'human', B: 'remote' }, viewSeat: 'A', resolving: true,
    plans: { A: [], B: [] }, rev: { A: 0, B: 0 }, ready: { A: null, B: null }, agreement: { ready: {} },
    _publish(seat, kind) { publishes.push({ seat, kind }); if (kind === 'ready') this.agreement.ready[seat] = true; return { ok: true }; },
    _readyValid(seat) { return !!this.agreement.ready[seat]; },
    _planErrors() { return []; }, _syncDraftMana() {}, _renderAll() {},
    _toast(text) { toasts.push(text); },
    _tryResolve() { throw new Error('no locked event in this probe'); },
  };
  client.on(e => onEvent.call(app, e, 1));
  return { app, client, toasts, publishes };
}

const events = [
  { type: 'match', matchId: 'review-m', kind: 'remotePlan', count: 5, revision: 2, commands: [{ type: 'set_destination', partyId: 'B.castle', target: { column: 9, row: 7 } }] },
  { type: 'match', matchId: 'review-m', kind: 'remoteReady', count: 5, revision: 2, commands: [{ type: 'set_destination', partyId: 'B.castle', target: { column: 9, row: 7 } }] },
];
const delayed = harness(4);
for (const e of events) delayed.client._event(e);
// Renderer finishes the earlier Tick and opens the next one, as _newTick does before _applyOnlineTick.
Object.assign(delayed.app, { state: { tick: 5, outcome: null }, resolving: false, plans: { A: [], B: [] }, rev: { A: 0, B: 0 }, ready: { A: null, B: null }, agreement: { ready: {} } });
applyTick.call(delayed.app);
const delayedView = { commands: delayed.app.plans.B, revision: delayed.app.rev.B, remoteReady: !!delayed.app.agreement.ready.B, clientRemoteCache: delayed.client.match.remote };
assert.equal(delayedView.commands.length, 0);
assert.equal(delayedView.revision, 0);
assert.equal(delayedView.remoteReady, false);

const current = harness(5);
current.app.resolving = false;
for (const e of events) current.client._event(e);
const currentView = { commands: current.app.plans.B, revision: current.app.rev.B, remoteReady: !!current.app.agreement.ready.B };
assert.equal(currentView.commands.length, 1);
assert.equal(currentView.revision, 2);
assert.equal(currentView.remoteReady, true);

const disputed = harness(5);
disputed.app.resolving = false;
disputed.client._event({ type: 'match', matchId: 'review-m', kind: 'disputed', reason: 'fixture receipt mismatch' });
const gates = can.call(disputed.app, 'A');
assert.equal(disputed.app.onlineMatch.status, 'disputed');
assert.equal(gates.edit, true);
assert.equal(gates.ready, true);
const result = {
  sourceCommit: 'd113216c8473cf8fc1809e7720cd7a09ad76fa6b',
  method: 'Actual OnlineClient and extracted app methods, fake rendering/publish helpers and synthetic already-authenticated runtime events. No network, browser, native-store or game-rule acceptance claim.',
  futureTickProjection: {
    circumstance: 'Presentation held on Tick 4 while authority delivers remote Tick 5 revision 2 and Ready; then renderer opens Tick 5.',
    deliveredEvents: events.map(({ kind, count, revision }) => ({ kind, count, revision })),
    delayedView, sameEventsDeliveredAtCurrentTick: currentView,
  },
  disputedControls: {
    status: disputed.app.onlineMatch.status, gates, toasts: disputed.toasts,
    rendererCallsMatchLeave: /["']match\.leave["']/.test(appSource + clientSource),
    runtimeExportsMatchLeave: /case 'match\.leave': return this\.abandon\(args\)/.test(runtimeSource),
    lobbyReturnCondition: "v.match && v.match.status === 'active'",
  },
};
console.log(JSON.stringify(result, null, 2));
