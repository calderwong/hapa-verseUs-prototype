/**
 * Review 22 bounded diagnostics, pinned 164aa5dc6eb96ee4b4cc4eab6f0cdb2298554536.
 * Exact source bodies and real Ed25519 signatures; controlled persistence, transport,
 * Hypercore readiness, and game loops. No native/installed/WAN claim.
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
  const raw = readFileSync(join(source, path), 'utf8'), b = Buffer.from(raw);
  const blob = crypto.createHash('sha1').update(Buffer.from('blob ' + b.length + '\0')).update(b).digest('hex');
  assert.equal(blob, expected.get(path), path);
  used.push({ path, blob, sha256: crypto.createHash('sha256').update(b).digest('hex') });
  const body = raw.replace(/^import .+ from .+;\s*$/gm, '').replace(/^export \{.*\};\s*$/gm, '').replace(/\bexport (?=class |function |const |async function )/g, '');
  return new Function(...Object.keys(deps), body + '\nreturn {' + names.join(',') + '};')(...Object.values(deps));
}
const encoding = load('src/hapa/rules/encoding.js', {}, ['canonicalize', 'fingerprint', 'utf8', 'parseStrict']);
const b4a = { from: (...a) => Buffer.from(...a), toString: (b, e) => Buffer.from(b).toString(e) };
const pri = Buffer.from('302e020100300506032b657004220420', 'hex'), pub = Buffer.from('302a300506032b6570032100', 'hex');
function identity(seed) {
  const sk = Buffer.alloc(32, seed), key = crypto.createPrivateKey({ key: Buffer.concat([pri, sk]), format: 'der', type: 'pkcs8' });
  const pk = crypto.createPublicKey(key).export({ format: 'der', type: 'spki' }).subarray(-32);
  return { participantId: 'hv1:' + pk.toString('hex'), publicKey: pk.toString('hex'), secretKey: Buffer.concat([sk, pk]).toString('hex'), label: seed === 0x42 ? 'Ari' : 'Bea', identityKind: 'human', signingKeyId: 'ed25519:' + pk.toString('hex') };
}
const signing = {
  sign: (data, key) => crypto.sign(null, data, crypto.createPrivateKey({ key: Buffer.concat([pri, Buffer.from(key).subarray(0, 32)]), format: 'der', type: 'pkcs8' })),
  verify: (data, sig, key) => crypto.verify(null, data, crypto.createPublicKey({ key: Buffer.concat([pub, Buffer.from(key)]), format: 'der', type: 'spki' }), sig), randomBytes: crypto.randomBytes,
};
const control = load('src/hapa/network/control.js', { crypto: signing, b4a, ...encoding }, ['signBody', 'verifyBody', 'keyOfPlayer']);
const memories = new Map();
const persistence = { readJson: (p, f) => structuredClone(memories.get(p) ?? f), writeJsonAtomic: (p, v) => memories.set(p, structuredClone(v)) };
class HistoryCore {
  static stores = new Map();
  constructor(dir) { this.dir = dir; if (!HistoryCore.stores.has(dir)) HistoryCore.stores.set(dir, []); this.records = HistoryCore.stores.get(dir); }
  get length() { return this.records.length; }
  async ready() {} async get(i) { return structuredClone(this.records[i]); }
  async append(v) { this.records.push(...structuredClone(Array.isArray(v) ? v : [v])); } async close() {}
}
const services = load('src/hapa/network/services.js', { Hypercore: HistoryCore, createHash: crypto.createHash, canonicalize: encoding.canonicalize }, ['ServicePolicy']);
const { Lobby } = load('src/hapa/network/lobby.js', { b4a, ...control, createHash: crypto.createHash, sanitizeName: s => s, fingerprintOf: s => s.slice(0, 12), pathOf: () => 'direct' }, ['Lobby']);
const A = identity(0x42), B = identity(0x43);
let releaseMatch, holdMatch = true;
class ControlledMatch {
  constructor(o) { this.o = o; this.dir = o.dir; this.matchId = o.session.descriptor.matchId; this.seat = o.session.seat; this.opponent = o.session.manifest.participants[this.seat === 'A' ? 'B' : 'A']; this.status = 'opening'; this.history = []; }
  async open() { if (holdMatch) await new Promise(r => { releaseMatch = r; }); this.status = 'active'; }
  attach() {} async close() { this.closed = true; }
}
class CapturedLobby {
  constructor(o) { this.o = o; this.peers = new Map(); this.dials = []; }
  async start() {} dial(t) { this.dials.push(t); } join() {} announce() {}
}
let MatchImpl = ControlledMatch;
function MatchProxy(o) { return new MatchImpl(o); }
const { PeerRuntime } = load('src/hapa/network/runtime.js', { b4a, join, ...persistence, ...control, fingerprint: encoding.fingerprint, existsSync: () => true, readdirSync: () => [], OnlineMatch: MatchProxy, Lobby: CapturedLobby }, ['PeerRuntime']);
function runtime(name) {
  const events = [], sent = [];
  const r = new PeerRuntime({ root: name, onEvent: e => events.push(structuredClone(e)) });
  r.identity = B; r.store = { path: (...p) => join(name, ...p) }; r.tombstones = { attempts: {} };
  r.lobby = { announce() {}, send: (to, msg) => sent.push({ to, msg }), peers: new Map(), join() {}, leaveTopic() {}, roster: () => [], transport: () => ({}) };
  r.lobbyView = () => ({ reservation: r.reservation, match: !!r.match });
  r.attempt = { id: name, stage: 'negotiating', challengeId: name, cancel: new AbortController(), startedAt: Date.now() };
  return { r, events, sent };
}
function session(matchId) {
  const descriptor = { matchId, players: { A: { participantId: A.participantId, publicKey: A.publicKey }, B: { participantId: B.participantId, publicKey: B.publicKey } }, feeds: { A: 'a'.repeat(64), B: 'b'.repeat(64) }, initialStateHash: 'fixture-state' };
  const manifest = { participants: { A, B } };
  return { descriptor, manifest, sigs: { A: control.signBody('session', descriptor, A), B: control.signBody('session', descriptor, B) }, seat: 'B', phase: 'active' };
}
function openingFixture(name) {
  const f = runtime(name), r = f.r, matchId = 'hv-' + name, s = session(matchId);
  r.reservation = { phase: 'accepted', role: 'joiner', challengeId: name, matchId, opponent: A.participantId };
  r._descriptorError = () => null; // descriptor validation is outside this lifecycle cut
  const peer = { playerId: A.participantId, presence: { role: 'player' }, path: 'direct' };
  const message = { descriptor: s.descriptor, manifest: s.manifest, sig: s.sigs.A };
  const opening = r._serial(() => r._onStart(peer, message));
  return { ...f, peer, message, opening, matchId };
}
const results = [];
{
  const f = openingFixture('cancel-reconnect'); await Promise.resolve();
  const { r, peer, sent, events, opening, matchId } = f;
  assert.equal(r.match.status, 'opening');
  r._onPeer(peer, 'joined'); await r._onStart(peer, f.message);
  assert.equal(sent.filter(x => x.msg.t === 'started').length, 0);
  r.cancelAttempt({ attemptId: 'cancel-reconnect' });
  r._onPeer(peer, 'joined'); await r._onStart(peer, f.message);
  assert.equal(sent.filter(x => x.msg.t === 'started').length, 0);
  releaseMatch(); await opening; await r.attempt.leaving;
  const actual = { attempt: r.attempt.stage, started: sent.filter(x => x.msg.t === 'started').length, opened: events.filter(e => e.kind === 'opened').length, tombstones: Object.keys(r.tombstones.attempts).length, match: !!r.match, reservation: r.reservation, progress: memories.get(join('cancel-reconnect', 'matches', matchId, 'progress.json')).status };
  assert.deepEqual(actual, { attempt: 'cancelled', started: 0, opened: 0, tombstones: 1, match: false, reservation: null, progress: 'abandoned_setup' });
  results.push({ id: 'N23-01_cancel_resend_duplicate', result: 'corrected_at_tested_cut', actual });
}
{
  const f = openingFixture('activated-resend'); await Promise.resolve(); releaseMatch(); await f.opening;
  assert.equal(f.r.reservation.activated, true);
  const before = f.sent.filter(x => x.msg.t === 'started').length;
  f.r._onPeer(f.peer, 'joined'); await f.r._onStart(f.peer, f.message);
  const after = f.sent.filter(x => x.msg.t === 'started').length;
  assert.equal(after - before, 2);
  assert.equal(f.r.cancelAttempt({ attemptId: 'activated-resend' }).notCancellable, 'the match has already started; use Leave this match instead');
  results.push({ id: 'N23-01_activated_retransmission', result: 'preserved', actual: { activated: true, reconnectAndDuplicateReplies: after - before, postActivationCancel: 'use Leave this match' } });
}
{
  let clock = Date.now();
  const archive = { id: 'arch-x', role: 'archive', player: 'hv1:' + 'a'.repeat(64), transport: 'a'.repeat(64), expiresAt: clock + 60000 };
  const service = new services.ServicePolicy({ dir: 'archive-policy', bundled: null, local: { services: [archive] } });
  await service.open();
  const r = new PeerRuntime({ root: 'archive-runtime', now: () => clock, archives: [{ player: 'hv1:' + 'e'.repeat(64), transport: 'e'.repeat(64) }] });
  r.services = service; r.policy = service.refresh(clock); r.settings = {}; r._saveSettings = () => {}; r.lobbyView = () => ({}); r._transportKeyPair = () => ({});
  assert.deepEqual(r.archives.map(a => a.source), ['explicit', 'configured']);
  const count = service.records.length; clock += 120000;
  await r.joinLobby({}); clearInterval(r._sweepTimer);
  const actual = { sources: r.archives.map(a => a.source), dialed: r.lobby.dials.map(t => t.slice(0, 2)), expiredConfiguredDialed: r.lobby.dials.includes('a'.repeat(64)), historyUnchanged: service.records.length === count };
  assert.deepEqual(actual, { sources: ['explicit'], dialed: ['ee'], expiredConfiguredDialed: false, historyUnchanged: true });
  results.push({ id: 'N23-02_current_archive_eligibility', result: 'corrected_at_tested_cut', actual });
}
{
  const list = [{ id: 'R', key: 'a'.repeat(64), endpoint: '198.51.100.9:9' }];
  const l = new Lobby({ relays: () => list }); l.relayState = new Map();
  assert.equal(l._nextRelay().toString('hex'), 'a'.repeat(64));
  const old = l.relayState.get('R'); old.confirmed = 7; old.lastConfirmed = 42; old.suspected = 2; old.cooldownUntil = 9999999999999;
  list[0] = { id: 'R', key: 'b'.repeat(64), endpoint: '198.51.100.10:10' };
  const selected = l._nextRelay().toString('hex'), fresh = l.relayState.get('R');
  const actual = { selected: selected.slice(0, 2), confirmed: fresh.confirmed, lastConfirmed: fresh.lastConfirmed, suspected: fresh.suspected, cooldownUntil: fresh.cooldownUntil };
  assert.deepEqual(actual, { selected: 'bb', confirmed: 0, lastConfirmed: 0, suspected: 0, cooldownUntil: 0 });
  results.push({ id: 'N23-02_relay_descriptor_identity', result: 'corrected_at_tested_cut', actual });
}

// Actual OnlineMatch.open() is held at its first own.ready() await. Its constructor, open,
// attach, runtime _openMatch/_onConnection, and Lobby._handshake auth dispatch are exact source.
// Only the Hypercore backend/readiness and game loops are controlled; real handshake/session
// Ed25519 signatures verify. This is a callback-path diagnostic, not a native network run.
let releaseOwn;
const ownGate = new Promise(r => { releaseOwn = r; });
const replications = [];
class ReadinessCore {
  constructor(dir, key) { this.dir = dir; this.key = Buffer.isBuffer(key) ? key : Buffer.from('b'.repeat(64), 'hex'); this.length = 0; }
  async ready() { if (this.dir.endsWith('/own')) await ownGate; }
  replicate(conn) { replications.push({ role: this.dir.endsWith('/own') ? 'own' : 'remote', connection: conn.id }); }
  on() {} async close() {}
}
const { OnlineMatch: ActualOnlineMatch } = load('src/hapa/network/online-match.js', { Hypercore: ReadinessCore, join, b4a, randomUUID: crypto.randomUUID, other: s => s === 'A' ? 'B' : 'A', createContext: () => ({}), initializeMatch: () => ({}), stateFingerprint: () => 'fixture-state' }, ['OnlineMatch']);
class HeldActualMatch extends ActualOnlineMatch { _read() {} _run() {} }
MatchImpl = HeldActualMatch;
{
  const { r, events } = runtime('full-reconnect');
  const s = session('hv-full-reconnect');
  r.reservation = { phase: 'active', role: 'joiner', challengeId: 'full-reconnect', matchId: s.descriptor.matchId, opponent: A.participantId, activated: false };
  const wire = [];
  const l = new Lobby({ identity: B, networkId: 'fixture', compat: { id: 'fixture-compat' }, relays: [], onPeer: (p, ev) => r._onPeer(p, ev), onConnection: (p, conn) => r._onConnection(p, conn) });
  l.swarm = { keyPair: { publicKey: Buffer.from('d'.repeat(64), 'hex') }, connections: new Set(), join: () => ({ flushed: async () => {} }) }; l.send = (to, msg) => { wire.push(msg); return true; }; l.announce = () => {};
  r.lobby = l;
  const opening = r._openMatch(s, { activation: true });
  assert.ok(r.match.own); assert.equal(r.match.remote, undefined); assert.equal(r.match.status, 'opening');
  const ctx = { conn: { id: 'authenticated-reconnect', destroy() {} }, remoteKey: 'c'.repeat(64), nonce: 'e'.repeat(64), hello: { player: A, presence: { role: 'player' }, compat: 'fixture-compat' } };
  const body = { network: 'fixture', signer: A.participantId, signerTransport: ctx.remoteKey, peerTransport: 'd'.repeat(64), peerNonce: ctx.nonce };
  let thrown = null;
  try { l._handshake(ctx, { t: 'auth', sig: control.signBody('hello', body, A) }); } catch (e) { thrown = { name: e.name, message: e.message, top: e.stack.split('\n').slice(0, 5).map(line => line.replaceAll(here, '<review-evidence>')) }; }
  assert.equal(ctx.authed, true); assert.equal(thrown?.name, 'TypeError'); assert.match(thrown.message, /replicate/);
  assert.equal(wire.filter(m => m.t === 'started').length, 0, 'N23 activation guard works before the separate attach failure');
  const during = { matchStatus: r.match.status, ownExists: !!r.match.own, remoteExists: !!r.match.remote, authenticated: ctx.authed, peerAdmitted: l.peers.has(A.participantId), startedMessages: wire.filter(m => m.t === 'started').length, replications: structuredClone(replications), thrown };
  releaseOwn(); await opening;
  assert.equal(r.match.status, 'active');
  results.push({ id: 'V22_runtime_full_handshake_while_opening', result: 'failure_reproduced', actual: during, afterRelease: { matchStatus: r.match.status, ownAndRemoteExist: !!r.match.own && !!r.match.remote, replications: structuredClone(replications), openedEvents: events.filter(e => e.kind === 'opened').length }, scope: 'Exact source callback path, signed synthetic handshake, controlled Hypercore readiness and game loops. Exception escapes Lobby._handshake. No claim of native socket failure, worker termination, installed behavior or WAN frequency.' });
}
const report = { repository: register.repository, reviewedHead: register.ref, scope: 'Controlled exact-source diagnostics; no native, installed, or WAN qualification.', sourceFiles: used, results };
writeFileSync(join(here, 'review-probe-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
