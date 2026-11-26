/**
 * Review 18 historical-failure diagnostic.
 * Exit 0 means the asserted reviewed failures reproduced; it is not product acceptance.
 * Execution recorded for this review: this complete diagnostic body was run in the
 * functions JavaScript V8 isolate against exact GitHub-fetched source methods, with
 * controlled host replies, events, timers and persistence.
 * This portable Node file-reading wrapper was NOT separately executed.
 * No live browser, Electron, native-storage or network execution is claimed.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(process.argv[2] ?? process.cwd());
const files = ['src/hapa/presentation/app.js', 'src/hapa/presentation/online.js', 'src/hapa/network/runtime.js', 'desktop/main.mjs'];
const sources = Object.fromEntries(files.map(p => [p, readFileSync(resolve(root, p), 'utf8')]));
const result = await (async () => {

const paths = {
  app: 'src/hapa/presentation/app.js',
  client: 'src/hapa/presentation/online.js',
  runtime: 'src/hapa/network/runtime.js',
  main: 'desktop/main.mjs'
};
const assert = (ok, message) => { if (!ok) throw new Error(message); };
function method(file, start, end, name, bindings = {}) {
  const s = sources[file], a = s.indexOf(start), b = s.indexOf(end, a);
  assert(a >= 0 && b > a, 'source boundary missing: ' + name);
  return new Function(...Object.keys(bindings), 'return ({' + s.slice(a, b) + '}).' + name + ';')(...Object.values(bindings));
}
const clientText = sources[paths.client];
const cls = clientText.slice(clientText.indexOf('export class OnlineClient'), clientText.indexOf('/** A session object')).replace('export class', 'class');
const OnlineClient = new Function(cls + '; return OnlineClient;')();
const can = method(paths.app, '  _can(seat = this.viewSeat) {', "  /** The seat's plan errors", '_can');
const onEvent = method(paths.app, '  _onOnlineEvent(e, gen) {', '  /** Ready in an online match:', '_onOnlineEvent', { other: s => s === 'A' ? 'B' : 'A', document: { querySelector: () => null } });
const fakeHost = () => ({ onEvent: () => () => {}, call: async () => null });
function appFor(client, projection) {
  return { generation: 1, online: client, onlineMatch: projection, state: { tick: 5, outcome: null }, plans: { A: [{ type: 'first-plan' }], B: [] }, rev: { A: 1, B: 0 }, agreement: { ready: {} }, ready: { A: null, B: null }, seats: { A: 'human', B: 'remote' }, viewSeat: 'A',
    _renderAll() {}, _syncDraftMana() {}, _readyValid() { return !!this.agreement.ready.A; }, _planErrors() { return []; }, _publish() { return { ok: true }; }, _toast() {} };
}
const results = { baseline: 'b2a31f45baed1b70f0e1777eba93fe0267b09a5b', method: 'Exact current classes/methods with controlled events, host replies, persistence and timers. No native, browser or real network execution.' };

// An event newer than the snapshot must not be overwritten by binding that snapshot.
{
  const client = new OnlineClient(fakeHost());
  client._event({ type: 'match', matchId: 'm1', kind: 'disputed', reason: 'authenticated histories differ' });
  const before = { status: client.projections.get('m1').status, disputed: client.projections.get('m1').disputed };
  const projection = client.bind({ matchId: 'm1', seat: 'A', status: 'active', connection: 'connected' });
  const gate = can.call(appFor(client, projection), 'A');
  results.snapshotStatus = { before, after: { status: projection.status, disputed: projection.disputed }, blocked: gate.blocked, edit: gate.edit, ready: gate.ready };
  assert(before.status === 'disputed' && projection.status === 'active' && gate.edit && gate.ready, 'snapshot-status failure did not reproduce');
}

// A host deadline can precede the actual completion of the durable append.
{
  const messages = [];
  let durable = false;
  const client = new OnlineClient({ onEvent: () => () => {}, call: async op => {
    if (op === 'match.ready') throw new Error('match.ready timed out');
    if (op === 'match.get') return { matchId: 'm1', seat: 'A', current: { count: 5, own: { ready: durable, revision: 1, commands: [{ type: 'first-plan' }] }, ownReady: durable ? { revision: 1, hash: 'old-hash' } : null }, history: [] };
  } });
  const projection = client.bind({ matchId: 'm1', seat: 'A', status: 'active', connection: 'connected' });
  const app = appFor(client, projection); app._toast = msg => messages.push(msg);
  client.on(e => onEvent.call(app, e, 1));
  const press = method(paths.app, '  _pressReadyOnline(seat) {', '  /**\n   * Ready (first press)', '_pressReadyOnline', { clone: x => JSON.parse(JSON.stringify(x)), canonicalize: JSON.stringify, hostMessage: e => e.message });
  press.call(app, 'A');
  const during = { pending: app._readyPending, edit: can.call(app, 'A').edit };
  for (let i = 0; i < 12; i++) await Promise.resolve();
  const afterTimeout = { pending: app._readyPending, edit: can.call(app, 'A').edit, ready: can.call(app, 'A').ready };
  durable = true;
  client._event({ type: 'match', matchId: 'm1', kind: 'ownCommitted', count: 5, revision: 1, hash: 'old-hash' });
  const afterLateCommit = { pending: app._readyPending, edit: can.call(app, 'A').edit, ready: can.call(app, 'A').ready, viewFrozen: !!app.agreement.ready.A };
  results.uncertainReady = { during, afterTimeout, afterLateCommit, messages };
  assert(during.pending && !during.edit && afterTimeout.edit && afterLateCommit.edit && !afterLateCommit.viewFrozen, 'uncertain-Ready failure did not reproduce');
}

// STARTED is lost: A remains starting, B has already opened the match.
{
  const writes = [], messages = [], events = [];
  const setupLeave = method(paths.runtime, '  setupLeave(args) {', '  /** Serialize', 'setupLeave', { writeJsonAtomic: (p, d) => writes.push({ p, d: JSON.parse(JSON.stringify(d)) }), existsSync: () => false });
  const onMessage = method(paths.runtime, '  async _onMessage(peer, msg) {', '  async _onAccept(peer, msg) {', '_onMessage');
  const challengeId = 'ab'.repeat(16), matchId = 'hv-' + challengeId, aId = 'hv1:' + 'a'.repeat(64), bId = 'hv1:' + 'b'.repeat(64);
  const challenger = { reservation: { phase: 'starting', role: 'challenger', challengeId, matchId, opponent: bId }, tombstones: { attempts: {} }, store: { path: (...p) => p.join('/') }, lobby: { send: (id, msg) => messages.push({ id, msg }) }, _reserve(r) { this.reservation = r; }, emit: e => events.push(e), lobbyView() { return { reservation: this.reservation }; } };
  setupLeave.call(challenger, { challengeId });
  const joiner = { reservation: { phase: 'active', role: 'joiner', challengeId, matchId, opponent: aId }, match: { matchId, status: 'active' }, incoming: new Map(), _reserve(r) { this.reservation = r; }, emit: e => events.push(e) };
  await onMessage.call(joiner, { playerId: aId, player: { publicKey: 'a'.repeat(64), label: 'Cal' } }, messages[0].msg);
  results.setupDeparture = { challengerReservation: challenger.reservation, tombstoneWritten: writes.length === 1, sent: messages[0].msg, joinerReservationPhase: joiner.reservation.phase, joinerMatchStatus: joiner.match.status, events };
  assert(challenger.reservation === null && joiner.reservation.phase === 'active' && joiner.match.status === 'active', 'setup-departure failure did not reproduce');
}

// A startup timeout is not followed by worker retirement or a replacement.
{
  const src = sources[paths.main], a = src.indexOf('function startPeer() {'), b = src.indexOf('/** Wait for the current worker generation', a), c = src.indexOf('async function whenReady() {', b), d = src.indexOf('/**', c + 1);
  assert(a >= 0 && b > a && c > b && d > c, 'worker method boundary missing');
  const timers = [], broadcasts = [], events = new Map();
  let killed = 0, forks = 0;
  const proc = { stdout: { on() {} }, stderr: { on() {} }, on(type, fn) { events.set(type, fn); }, postMessage() {}, kill() { killed++; } };
  const peer = { proc: null, gen: 0, pending: new Map(), seq: 0, restarts: [], status: null, quitting: false, ready: null };
  const api = new Function('peer', 'appRoot', 'join', 'utilityProcess', 'process', 'STARTUP_MS', 'broadcast', 'setTimeout', 'clearTimeout', 'stateRoot', 'NETWORK_ID', 'networkConfig', src.slice(a, b) + '\n' + src.slice(c, d) + '\nreturn { startPeer, whenReady };')(
    peer, '/app', (...s) => s.join('/'), { fork() { forks++; return proc; } }, { stdout: { write() {} }, stderr: { write() {} } }, 30000, e => broadcasts.push(e),
    (fn, ms) => { const timer = { fn, ms }; timers.push(timer); return timer; }, () => {}, () => 'state-root', 'test-network', () => ({})
  );
  api.startPeer();
  timers.find(t => t.ms === 30000).fn();
  await Promise.resolve();
  const readiness = async () => { try { await api.whenReady(); return { ok: true }; } catch (e) { return { ok: false, code: e.code, message: e.message }; } };
  const afterTimeout = await readiness();
  events.get('message')({ type: 'ready', status: { runtime: 'test-ready' } });
  const afterLateReady = await readiness();
  results.startupTimeout = { afterTimeout, afterLateReady, peerStatus: peer.status, procStillCurrent: peer.proc === proc, kills: killed, forks, restartTimers: timers.filter(t => t.ms !== 30000).length, broadcasts };
  assert(!afterTimeout.ok && !afterLateReady.ok && killed === 0 && forks === 1, 'startup-timeout failure did not reproduce');
}

// An existing v1 active reservation survives a v2 startup while its match is skipped.
{
  const matchId = 'legacy-match';
  const session = { sigs: { A: 'recorded-A', B: 'recorded-B' }, phase: 'active', descriptor: { online: 'hapa-versus-online/v1', matchId } };
  const read = p => p.endsWith('/session.json') ? session : p.endsWith('/progress.json') ? { status: 'active' } : null;
  const resume = method(paths.runtime, '  async _resumeMatches() {', '  _onComplete(m) {', '_resumeMatches', { existsSync: () => true, readdirSync: () => [matchId], readJson: read, join: (...p) => p.join('/'), ONLINE_PROTOCOL: 'hapa-versus-online/v2' });
  const availability = method(paths.runtime, '  availability() {', '  _presence() {', 'availability');
  const setupLeave = method(paths.runtime, '  setupLeave(args) {', '  /** Serialize', 'setupLeave', { writeJsonAtomic() {}, existsSync: () => false });
  const matchFor = method(paths.runtime, '  _matchFor(args) {', '  async abandon(args) {', '_matchFor');
  let opened = 0;
  const rt = { reservation: { phase: 'active', challengeId: 'old-challenge', matchId }, match: null, role: 'player', settings: { availability: 'available' }, outbox: {}, store: { path: (...p) => p.join('/') }, _tombstoned: () => false, async _openMatch() { opened++; }, log() {}, _saveOutbox() {} };
  await resume.call(rt);
  let setupError = null, matchError = null;
  try { setupLeave.call(rt, { challengeId: 'old-challenge' }); } catch (e) { setupError = e.code; }
  try { matchFor.call(rt, { matchId }); } catch (e) { matchError = e.code; }
  results.legacyReservation = { opened, availability: availability.call(rt), reservationPhase: rt.reservation.phase, match: rt.match, setupLeaveError: setupError, matchLeaveBoundaryError: matchError };
  assert(opened === 0 && rt.match === null && availability.call(rt) === 'joining' && setupError === 'NO_ATTEMPT' && matchError === 'NO_MATCH', 'legacy reservation failure did not reproduce');
}

return results;

})();
console.log(JSON.stringify(result, null, 2));
