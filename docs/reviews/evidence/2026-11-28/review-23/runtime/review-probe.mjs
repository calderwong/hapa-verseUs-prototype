/**
 * Review 23 / V22-01 closure diagnostic, source 29c7c1d466f94b5534fce1634f775a4df944a93f.
 * Exact, hash-checked source bodies; real synthetic Ed25519 signatures.
 * Controlled Hypercore readiness/replication, persistence, transport and game loops.
 * This is callback/lifecycle evidence, not native, installed, WAN or human acceptance.
 * Run: node review-probe.mjs [source-root]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as crypto from 'node:crypto';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const source = process.argv[2] ? resolve(process.argv[2]) : join(here, 'source');
const register = JSON.parse(readFileSync(join(here, 'source-register.json'), 'utf8'));
const expected = new Map(register.files.map(f => [f.path, f.blob]));
const used = [];
function load(path, deps, names) {
  const raw = readFileSync(join(source, path), 'utf8'), bytes = Buffer.from(raw);
  const blob = crypto.createHash('sha1').update(Buffer.from('blob ' + bytes.length + '\0')).update(bytes).digest('hex');
  assert.equal(blob, expected.get(path), path);
  used.push({ path, blob, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
  const body = raw.replace(/^import .+ from .+;\s*$/gm, '').replace(/^export \{.*\};\s*$/gm, '').replace(/\bexport (?=class |function |const |async function )/g, '');
  return new Function(...Object.keys(deps), body + '\nreturn {' + names.join(',') + '};')(...Object.values(deps));
}
const encoding = load('src/hapa/rules/encoding.js', {}, ['canonicalize', 'fingerprint', 'utf8', 'parseStrict']);
const b4a = { from: (...a) => Buffer.from(...a), toString: (b, e) => Buffer.from(b).toString(e) };
const pri = Buffer.from('302e020100300506032b657004220420', 'hex'), pub = Buffer.from('302a300506032b6570032100', 'hex');
function identity(seed, label) {
  const sk = Buffer.alloc(32, seed), key = crypto.createPrivateKey({ key: Buffer.concat([pri, sk]), format: 'der', type: 'pkcs8' });
  const pk = crypto.createPublicKey(key).export({ format: 'der', type: 'spki' }).subarray(-32);
  return { participantId: 'hv1:' + pk.toString('hex'), publicKey: pk.toString('hex'), secretKey: Buffer.concat([sk, pk]).toString('hex'), label, identityKind: 'human', signingKeyId: 'ed25519:' + pk.toString('hex') };
}
const signing = {
  sign: (data, key) => crypto.sign(null, data, crypto.createPrivateKey({ key: Buffer.concat([pri, Buffer.from(key).subarray(0, 32)]), format: 'der', type: 'pkcs8' })),
  verify: (data, sig, key) => crypto.verify(null, data, crypto.createPublicKey({ key: Buffer.concat([pub, Buffer.from(key)]), format: 'der', type: 'spki' }), sig), randomBytes: crypto.randomBytes,
};
const control = load('src/hapa/network/control.js', { crypto: signing, b4a, ...encoding }, ['signBody', 'verifyBody', 'keyOfPlayer', 'encodeFrame', 'decodeFrame', 'MAX_FRAME', 'MAX_RESULT_FRAME']);
const { Lobby } = load('src/hapa/network/lobby.js', { b4a, ...control, createHash: crypto.createHash, sanitizeName: s => s, fingerprintOf: s => s.slice(0, 12), LOBBY_PROTOCOL: 'hapa-versus-lobby/v1' }, ['Lobby']);
const A = identity(0x42, 'Ari'), B = identity(0x43, 'Bea');
const memories = new Map(), holds = new Map(), replications = [];
const persistence = { readJson: (p, f) => structuredClone(memories.get(p) ?? f), writeJsonAtomic: (p, v) => memories.set(p, structuredClone(v)) };
function hold(path) {
  let release, enter;
  const wait = new Promise(r => { release = r; });
  const entered = new Promise(r => { enter = r; });
  holds.set(path, { wait, enter });
  return { entered, release };
}
class ReadinessCore {
  constructor(dir, key) { this.dir = dir; this.key = Buffer.isBuffer(key) ? key : Buffer.from('b'.repeat(64), 'hex'); this.length = 0; }
  async ready() { const h = holds.get(this.dir); if (h) { h.enter(); await h.wait; } }
  replicate(conn) { replications.push({ path: this.dir, role: this.dir.endsWith('/own') ? 'own' : 'remote', connection: conn.id }); }
  on() {} async close() { this.closed = true; }
}
const { OnlineMatch } = load('src/hapa/network/online-match.js', {
  Hypercore: ReadinessCore, join, b4a, randomUUID: crypto.randomUUID,
  other: s => s === 'A' ? 'B' : 'A', createContext: () => ({}), initializeMatch: () => ({}), stateFingerprint: () => 'fixture-state',
}, ['OnlineMatch']);
class ControlledLoopMatch extends OnlineMatch { _read() {} _run() {} }
const { PeerRuntime } = load('src/hapa/network/runtime.js', {
  b4a, join, ...persistence, ...control, fingerprint: encoding.fingerprint, existsSync: () => true,
  readdirSync: () => [], OnlineMatch: ControlledLoopMatch,
}, ['PeerRuntime']);

function session(matchId) {
  const descriptor = { matchId, players: { A: { participantId: A.participantId, publicKey: A.publicKey }, B: { participantId: B.participantId, publicKey: B.publicKey } }, feeds: { A: 'a'.repeat(64), B: 'b'.repeat(64) }, initialStateHash: 'fixture-state' };
  return { descriptor, manifest: { participants: { A, B } }, sigs: { A: control.signBody('session', descriptor, A), B: control.signBody('session', descriptor, B) }, seat: 'B', phase: 'active' };
}
function fixture(name) {
  const events = [], sent = [], callbacks = [], announced = [];
  const r = new PeerRuntime({ root: name, onEvent: e => events.push(structuredClone(e)) });
  r.identity = B; r.state = 'open'; r.store = { path: (...p) => join(name, ...p) }; r.tombstones = { attempts: {} };
  r.lobbyView = () => ({ reservation: r.reservation, match: !!r.match });
  r.attempt = { id: name, stage: 'negotiating', challengeId: name, cancel: new AbortController(), startedAt: Date.now() };
  const l = new Lobby({ identity: B, networkId: 'fixture', compat: { id: 'fixture-compat' }, relays: [],
    onPeer: (p, ev) => { callbacks.push({ kind: 'peer', event: ev, connection: p.ctx.conn.id }); return r._onPeer(p, ev); },
    onConnection: (p, conn) => { callbacks.push({ kind: 'connection', connection: conn.id }); return r._onConnection(p, conn); },
  });
  l.swarm = { keyPair: { publicKey: Buffer.from('d'.repeat(64), 'hex') }, connections: new Set(), join: () => ({ flushed: async () => {}, destroy: async () => {} }) };
  l._send = (ctx, msg) => { sent.push({ connection: ctx.conn.id, msg }); return true; };
  l.announce = () => announced.push(true); l.dial = () => {}; l.transport = () => ({ state: 'controlled' });
  r.lobby = l;
  function authenticate(id) {
    const ctx = { conn: { id, destroy() { this.destroyed = true; } }, remoteKey: 'c'.repeat(64), nonce: 'e'.repeat(64) };
    l.pending.add(ctx);
    l._onFrame(ctx, control.encodeFrame({ t: 'hello', v: 'hapa-versus-lobby/v1', network: 'fixture', transportKey: ctx.remoteKey, nonce: 'f'.repeat(64), player: A, presence: { role: 'player' }, compat: 'fixture-compat' }));
    const body = { network: 'fixture', signer: A.participantId, signerTransport: ctx.remoteKey, peerTransport: 'd'.repeat(64), peerNonce: ctx.nonce };
    l._onFrame(ctx, control.encodeFrame({ t: 'auth', sig: control.signBody('hello', body, A) }));
    assert.equal(ctx.authed, true);
    return ctx;
  }
  const initial = authenticate(name + '-initial');
  const matchId = 'hv-' + name, s = session(matchId), dir = r.store.path('matches', matchId);
  const ownHold = hold(join(dir, 'own'));
  const message = { descriptor: s.descriptor, manifest: s.manifest, sig: s.sigs.A };
  const peer = l.peers.get(A.participantId);
  const replicas = () => replications.filter(x => x.path.startsWith(dir + '/'));
  return { name, r, l, events, sent, callbacks, announced, initial, matchId, s, dir, ownHold, message, peer, authenticate, replicas };
}
function start(f) {
  f.r.reservation = { phase: 'accepted', role: 'joiner', challengeId: f.name, matchId: f.matchId, opponent: A.participantId };
  f.r._descriptorError = () => null; // descriptor contents are fixture data; validation is outside the reviewed lifecycle cut
  return f.r._serial(() => f.r._onStart(f.peer, f.message));
}
const countStarted = f => f.sent.filter(x => x.msg.t === 'started').length;
const results = [];

// Full frame -> signed hello/auth -> onPeer -> onConnection; then standby promotion while opening.
{
  const f = fixture('current-at-readiness'), opening = start(f);
  await f.ownHold.entered;
  assert.ok(f.r.match.own); assert.equal(f.r.match.remote, undefined);
  f.l._drop(f.initial, 'controlled reconnect');
  const reconnect = f.authenticate('re-authenticated');
  assert.deepEqual(f.callbacks.slice(-2).map(x => x.kind), ['peer', 'connection']);
  assert.deepEqual(f.replicas(), []); assert.equal(f.r.match.connection, 'waiting'); assert.equal(countStarted(f), 0);
  const standby = f.authenticate('standby-current');
  assert.equal(f.l.peers.get(A.participantId).ctx, reconnect);
  f.l._drop(reconnect, 'controlled standby promotion');
  assert.equal(f.l.peers.get(A.participantId).ctx, standby);
  assert.deepEqual(f.replicas(), []); assert.equal(f.r.match.connection, 'waiting'); assert.equal(countStarted(f), 0);
  f.ownHold.release(); await opening;
  assert.deepEqual(f.replicas().map(x => [x.role, x.connection]), [['own', 'standby-current'], ['remote', 'standby-current']]);
  assert.equal(f.r.match.connection, 'connected'); assert.equal(f.r.reservation.activated, true); assert.equal(countStarted(f), 1);
  const beforeAnnounce = f.announced.length;
  f.r._onConnection(f.l.peers.get(A.participantId), standby.conn);
  assert.equal(f.replicas().length, 2); assert.equal(f.announced.length, beforeAnnounce);
  f.r._onPeer(f.l.peers.get(A.participantId), 'joined'); await f.r._onStart(f.peer, f.message);
  assert.equal(countStarted(f), 3);
  assert.equal(f.r.cancelAttempt({ attemptId: f.name }).notCancellable, 'the match has already started; use Leave this match instead');
  results.push({ id: 'N24-01_current_connection_and_standby', result: 'pass', actual: { authenticatedCallbacksBeforeReady: 2, replicationCallsBeforeReady: 0, connectionBeforeReady: 'waiting', startedBeforeReady: 0, replicationAfterReady: f.replicas(), activated: true, duplicateConnectionAddsNoReplication: true, activatedReconnectAndDuplicateReplies: 2 } });
  await f.r.match.close();
}

// The same full authenticated callback while opening, then actual Cancel and the opener's fence.
{
  const f = fixture('cancel-before-readiness'), opening = start(f);
  await f.ownHold.entered;
  f.l._drop(f.initial, 'controlled reconnect'); f.authenticate('cancel-reconnect');
  assert.equal(f.r.match.connection, 'waiting'); assert.deepEqual(f.replicas(), []);
  f.r.cancelAttempt({ attemptId: f.name });
  f.ownHold.release(); await opening; await f.r.attempt.leaving;
  const actual = { attempt: f.r.attempt.stage, started: countStarted(f), opened: f.events.filter(e => e.kind === 'opened').length, replicas: f.replicas().length, tombstones: Object.keys(f.r.tombstones.attempts).length, match: !!f.r.match, reservation: f.r.reservation, progress: memories.get(join(f.dir, 'progress.json')).status, joinedMatchTopic: f.l.topics.has('match:' + f.matchId) };
  assert.deepEqual(actual, { attempt: 'cancelled', started: 0, opened: 0, replicas: 0, tombstones: 1, match: false, reservation: null, progress: 'abandoned_setup', joinedMatchTopic: false });
  results.push({ id: 'N24-01_cancelled_opening_never_attaches', result: 'pass', actual });
}

// A finishing authority has no STARTED activation/reservation; it must still attach and reconnect.
{
  const f = fixture('finishing-authority');
  f.r.attempt = null;
  const opening = f.r._openMatch(f.s, { finishing: true });
  await f.ownHold.entered;
  f.l._drop(f.initial, 'controlled reconnect');
  const reconnect = f.authenticate('finishing-reconnect');
  assert.equal(f.r.match, null); assert.equal(f.r.finishing.size, 1); assert.deepEqual(f.replicas(), []);
  f.ownHold.release(); const m = await opening;
  m.status = 'finishing'; // the controlled game loop does not compute a terminal game
  assert.deepEqual(f.replicas().map(x => [x.role, x.connection]), [['own', 'finishing-reconnect'], ['remote', 'finishing-reconnect']]);
  f.r._onConnection(f.l.peers.get(A.participantId), reconnect.conn);
  assert.equal(f.replicas().length, 2);
  f.l._drop(reconnect, 'controlled reconnect after readiness');
  const next = f.authenticate('finishing-next');
  assert.deepEqual(f.replicas().slice(2).map(x => [x.role, x.connection]), [['own', 'finishing-next'], ['remote', 'finishing-next']]);
  await m.close(); f.r._onConnection(f.l.peers.get(A.participantId), { id: 'closed-ignored' });
  assert.equal(m.attach(next.conn), 'closed'); assert.equal(f.replicas().length, 4); assert.equal(countStarted(f), 0);
  results.push({ id: 'N24-01_finishing_authority_replication', result: 'pass', actual: { activeMatch: false, reservation: false, activatedFlag: false, replicationAfterReadyAndReconnect: f.replicas(), closedAuthorityDeclines: true, startedMessages: 0 }, limit: 'Finishing status is assigned because game loops are controlled. This checks attachment dispatch only, not result computation or native recovery.' });
}

const report = { repository: register.repository, reviewedHead: register.head, scope: 'Controlled exact-source lifecycle/callback diagnostics; no native, installed, WAN or human qualification.', sourceFiles: used, results };
writeFileSync(join(here, 'review-probe-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
