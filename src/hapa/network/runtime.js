/**
 * The reusable local peer runtime (Assignment 16; p2p-matchmaking-v1 §3, electron-desktop-v1 §3).
 *
 * One instance per player process. It owns the data root lock, the persistent identity, native
 * Hypercore storage and (when online) the single Hyperswarm, the lobby, one seat reservation and the
 * active match authority. It has no Electron or DOM imports: the desktop utility process and the
 * headless host wrap it with thin adapters that call `handle(op, args)` and forward `onEvent`.
 */
import Hypercore from 'hypercore';
import crypto from 'hypercore-crypto';
import b4a from 'b4a';
import { readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { openDataRoot, readJson, writeJsonAtomic } from './store.js';
import { openIdentity, publicPlayer, fingerprintOf, renameIdentity, sanitizeName } from './identity.js';
import { Lobby } from './lobby.js';
import { OnlineMatch } from './online-match.js';
import { compatibility, presetManifest, manifestError, initialStateHash, ONLINE_PROTOCOL, rulesImplementation } from './compat.js';
import { signBody, verifyBody, randomHex, keyOfPlayer } from './control.js';
import { fingerprint } from '../rules/encoding.js';
import { HeuristicBot } from '../controllers/heuristic-bot.js';
import { ResultIndex } from './result-index.js';
import { buildBundle, verifyBundle, resultKey } from './results.js';
import { feedPrefix } from './prefix.js';
import { ServicePolicy } from './services.js';
import { OwnContact, ContactBook, checkSnapshot } from './contact.js';

export const RUNTIME_VERSION = 'hapa-versus-peer-runtime/0.2.0';
const OFFER_MS = 120_000;
const TABLE_MS = 300_000;
const START_MS = 30_000;
const now = () => Number(process.hrtime.bigint() / 1_000_000n);

/** Parse and verify a pasted invitation capsule (it carries no secret and no loopback address). */
export function parseInvite(code) {
  // hvinv1 (archived meaning, still read) and hvinv2 (adds a signed contact snapshot); bounded size
  const m = typeof code === 'string' && code.trim().match(/^hvinv([12])\.([A-Za-z0-9_-]{40,4000})$/);
  if (!m) throw new Error('that is not a Hapa Versus invitation (it should start with hvinv)');
  let c;
  try { c = JSON.parse(b4a.toString(b4a.from(m[2], 'base64url'))); } catch { throw new Error('the invitation is damaged: copy the whole text again'); }
  const { sig, ...capsule } = c ?? {};
  const pk = keyOfPlayer(capsule.player);
  if (capsule.v !== Number(m[1]) || !pk || !/^[0-9a-f]{64}$/.test(capsule.transport ?? '') || !/^[0-9a-f]{32}$/.test(capsule.challengeId ?? '') || !Number.isSafeInteger(capsule.expiresAt)) throw new Error('the invitation is incomplete: copy the whole text again');
  if (!verifyBody('control', { kind: 'invite', ...capsule }, sig, pk)) throw new Error('the invitation signature does not match its player');
  if (capsule.v === 2) {
    const err = checkSnapshot(capsule.contact);
    if (err || capsule.contact.subject !== capsule.player) throw new Error(`the invitation's contact information is not valid (${err ?? 'another player'})`);
  }
  return capsule;
}

/** A compact verified record for the roster: human-vs-human first, other buckets kept separate. */
function recordLine(st) {
  const b = st.buckets;
  const pick = b['human-vs-human'] ?? b['human-vs-bot'] ?? b['bot-vs-bot'] ?? null;
  const bucket = b['human-vs-human'] ? 'human-vs-human' : b['human-vs-bot'] ? 'human-vs-bot' : b['bot-vs-bot'] ? 'bot-vs-bot' : null;
  return pick ? { bucket, wins: pick.wins, losses: pick.losses, draws: pick.draws, decisive: pick.decisive, winRate: pick.winRate, disputed: st.disputed } : { bucket: null, wins: 0, losses: 0, draws: 0, decisive: 0, winRate: null, disputed: st.disputed };
}

export class PeerRuntime {
  /**
   * @param {{ root: string, networkId?: string, displayName?: string, controller?: 'human'|'bot', autoAccept?: boolean, bootstrap?: any[], relayThrough?: any, log?: (s: string) => void, onEvent?: (e: any) => void, host?: string }} o
   */
  constructor(o) {
    this.o = o;
    this.networkId = o.networkId ?? 'public-alpha';
    this.controllerKind = o.controller === 'bot' ? 'bot' : 'human';
    this.role = o.role === 'archive' ? 'archive' : 'player';
    this._requests = new Map();
    this.log = o.log ?? (() => {});
    this.onEvent = o.onEvent ?? (() => {});
    this.state = 'closed';
    this.incoming = new Map(); // challengeId → { body, sig, from, receivedAt }
    this.match = null;
    this.finishing = new Map(); // matchId → completed authority still owned until its evidence is durable
    this.lastCompleted = null; // lightweight snapshot of the latest completed match (result view)
    this.archives = (o.archives ?? []).filter((a) => /^hv1:[0-9a-f]{64}$/.test(a?.player ?? '') && /^[0-9a-f]{64}$/.test(a?.transport ?? ''));
    this._profileCache = new Map(); // playerId → { at, sync }
    this._syncInFlight = new Map();
  }

  emit(e) { try { this.onEvent(e); } catch (err) { this.log(`event handler: ${err.message}`); } }

  async open() {
    this.store = openDataRoot(this.o.root, this.networkId);
    const { identity, created } = openIdentity(this.store, { displayName: this.o.displayName });
    this.identity = identity;
    this.createdIdentity = created;
    this.settings = readJson(this.store.path('settings.json'), { availability: 'available', joined: false });
    this.reservation = readJson(this.store.path('reservation.json'), null);
    this.tombstones = readJson(this.store.path('tombstones.json'), { attempts: {} });
    this.launch = await this._recordLaunch();
    // the effective connectivity policy from the append-only local service history (N19-03)
    this.services = new ServicePolicy({ dir: this.store.path('cores', 'service-policy'), bundled: this.o.services?.bundled ?? null, local: this.o.services?.local ?? null, override: this.o.bootstrap ? { bootstrap: this.o.bootstrap } : null, log: this.log });
    this.policy = await this.services.open();
    // signed contact history (N19-04): this player's own single-writer core and verified knowledge of others
    this.contact = await new OwnContact({ dir: this.store.path('cores', 'contact'), identity: this.identity, transport: b4a.toString(this._transportKeyPair().publicKey, 'hex'), log: this.log }).open();
    this.contacts = new ContactBook({ dir: this.store.path('contacts'), storeFile: this.store.path('contacts.json'), self: this.identity.participantId, log: this.log });
    const known = new Set(this.archives.map((a) => a.player));
    for (const a of this.policy.archives) if (!known.has(a.player)) this.archives.push(a);
    this.compat = compatibility();
    this.results = new ResultIndex(this.store.path('results'));
    this.outbox = readJson(this.store.path('outbox.json'), {});
    this.state = 'open';
    this.log(`runtime open ${this.networkId} ${fingerprintOf(identity.publicKey)} launch ${this.launch.index}`);
    await this._resumeMatches();
    this._reconcileReservation();
    return this.status();
  }

  /**
   * Startup reconciliation of the one reservation against the durable sessions (review 18, R18-03).
   * An `active` reservation must name the live authority; when it does not, the reservation is
   * released (durably) and the session's record is classified, never deleted: a legacy online
   * version (not executed as v2) is labelled unsupported with its journals and bytes kept; a
   * finishing, recorded, abandoned or missing session needs no reservation. Setup phases keep their
   * own stalled/Retry/Leave handling.
   */
  _reconcileReservation() {
    const r = this.reservation;
    if (!r || r.phase !== 'active' || (this.match && this.match.matchId === r.matchId)) return;
    const dir = this.store.path('matches', r.matchId ?? '-');
    const s = readJson(join(dir, 'session.json'));
    const p = readJson(join(dir, 'progress.json'));
    if (s && s.descriptor?.online !== ONLINE_PROTOCOL && !['abandoned', 'abandoned_setup', 'recorded', 'unsupported'].includes(p?.status)) {
      writeJsonAtomic(join(dir, 'progress.json'), { ...(p ?? {}), status: 'unsupported', previous: p?.status ?? s.phase ?? 'active', protocol: s.descriptor?.online ?? null, reason: `recorded by an older online version (${s.descriptor?.online ?? 'unknown'}); kept, not resumed`, at: new Date().toISOString() });
      this.log(`released the reservation for legacy match ${r.matchId} (${s.descriptor?.online}); its record is kept as unsupported`);
    } else this.log(`released a reservation with no live match (${r.matchId ?? 'no id'}, ${p?.status ?? 'no progress'})`);
    this._reserve(null);
  }

  /**
   * Append one launch record to a durable local Hypercore, then close and reopen it and read the
   * record back: the native-storage attachment proof, repeated at every open (length grows by one
   * per launch).
   */
  async _recordLaunch() {
    const dir = this.store.path('cores', 'launches');
    let core = new Hypercore(dir, { valueEncoding: 'json' });
    await core.ready();
    const before = core.length;
    const key = core.key.toString('hex');
    await core.append({ index: before, at: new Date().toISOString(), host: this.o.host ?? 'node', runtime: RUNTIME_VERSION, node: process.versions.node, electron: process.versions.electron ?? null });
    await core.close();
    core = new Hypercore(dir, { valueEncoding: 'json' });
    await core.ready();
    const reopened = { length: core.length, key: core.key.toString('hex'), last: await core.get(core.length - 1) };
    await core.close();
    if (reopened.key !== key || reopened.length !== before + 1 || reopened.last.index !== before) throw new Error('native store did not reopen with the appended record');
    return { index: before, length: reopened.length, coreKey: key.slice(0, 16) };
  }

  _transportKeyPair() {
    const file = this.store.path('transport.json');
    let t = readJson(file);
    if (!t) { const kp = crypto.keyPair(); t = { publicKey: b4a.toString(kp.publicKey, 'hex'), secretKey: b4a.toString(kp.secretKey, 'hex') }; writeJsonAtomic(file, t); }
    return { publicKey: b4a.from(t.publicKey, 'hex'), secretKey: b4a.from(t.secretKey, 'hex') };
  }

  // --- availability ---------------------------------------------------------------------------
  availability() {
    if (this.match && this.match.status === 'active') return this.match.connection === 'reconnecting' ? 'reconnecting' : 'in-match';
    if (this.role === 'archive') return 'busy';
    if (this.reservation) return 'joining';
    return this.settings.availability === 'busy' ? 'busy' : 'available';
  }
  _presence() { const r = this.reservation; return { availability: r?.phase === 'open' ? 'available' : this.availability(), controller: this.controllerKind, label: this.identity.label, role: this.role, table: r?.phase === 'open' ? r.challengeId : null }; }
  _saveSettings() { writeJsonAtomic(this.store.path('settings.json'), this.settings); }
  _reserve(r) {
    const prev = this.reservation;
    if (!r && prev && this.attempt?.challengeId === prev.challengeId) this._setStage(this.attempt, 'failed', 'the table setup ended before the match started');
    this.reservation = r; if (r) writeJsonAtomic(this.store.path('reservation.json'), r); else writeJsonAtomic(this.store.path('reservation.json'), null); this.lobby?.announce(); this.emit({ type: 'lobby', kind: 'reservation', reservation: this._publicReservation() }); }
  _publicReservation() { const r = this.reservation; return r ? { phase: r.phase, role: r.role, challengeId: r.challengeId, matchId: r.matchId ?? null, opponent: r.opponentLabel ?? null, invite: r.phase === 'open' ? r.invite : undefined, stalled: !!r.stalled } : null; }

  // --- lobby ----------------------------------------------------------------------------------
  async joinLobby(args = {}) {
    if (args.name) renameIdentity(this.store, this.identity, args.name);
    if (!this.lobby) {
      this.lobby = new Lobby({
        networkId: this.networkId, identity: this.identity, transportKeyPair: this._transportKeyPair(), compat: this.compat,
        presence: () => this._presence(), bootstrap: this.policy.bootstrap, noRoute: this.policy.noRoute, relays: this._relayCandidates(), forceRelay: this.o.forceRelay, log: this.log,
        onPeer: (p, ev) => this._onPeer(p, ev),
        onMessage: (p, msg) => this._onMessage(p, msg).catch((e) => this.log(`message ${msg.t}: ${e.message}`)),
        onConnection: (p, conn) => this._onConnection(p, conn),
      });
      await this.lobby.start();
      if (this.match) this.lobby.join('match', this.match.matchId);
      // every authority that still owns unfinished work is reachable too (review 18, R18-06)
      for (const m of this.finishing.values()) this.lobby.join('match', m.matchId);
      // configured directory/archive services are dialled directly by their transport key (R16-03)
      for (const a of this.archives) this.lobby.dial(a.transport);
    }
    if (!this.settings.joined || this.settings.leftLobby) { this.settings.joined = true; this.settings.leftLobby = false; this._saveSettings(); }
    this._sweepTimer ??= setInterval(() => this._sweepOffers(), 2_000);
    return this.lobbyView();
  }

  async leaveLobby() {
    this.settings.joined = false;
    this.settings.leftLobby = true; // Play online then waits for the player instead of rejoining by itself
    this._saveSettings();
    clearInterval(this._sweepTimer); this._sweepTimer = null;
    const l = this.lobby; this.lobby = null;
    await l?.stop();
    this.emit({ type: 'lobby', kind: 'transport', transport: { state: 'off' } });
    return this.lobbyView();
  }

  lobbyView() {
    return {
      joined: !!this.lobby, leftByPlayer: !!this.settings.leftLobby, transport: this.lobby?.transport() ?? { state: 'off' }, me: { ...publicPlayer(this.identity), fingerprint: fingerprintOf(this.identity.publicKey), availability: this.availability(), manual: this.settings.availability, controller: this.controllerKind },
      roster: (this.lobby?.roster() ?? []).map((r) => ({ ...r, record: r.role === 'archive' ? null : recordLine(this.results.stats(r.playerId)) })), record: recordLine(this.results.stats(this.identity.participantId)), incoming: [...this.incoming.values()].map((x) => ({ challengeId: x.body.challengeId, from: x.body.from, label: x.fromLabel, fingerprint: fingerprintOf(keyOfPlayer(x.body.from)), controller: x.body.controller, expiresInMs: Math.max(0, OFFER_MS - (now() - x.receivedAt)) })),
      services: this._services(), reservation: this._publicReservation(), compat: { id: this.compat.id.slice(7, 19), profileId: this.compat.profileId, rules: this.compat.rulesImplementation.slice(7, 19) },
      match: this.match ? { matchId: this.match.matchId, status: this.match.status, seat: this.match.seat, opponent: this.match.opponent.label, unstarted: this.match.history.length === 0 && !(this.match.remote?.length > 0) } : null,
      finishing: [...this.finishing.values()].filter((m) => !m.closed && m.status === 'finishing').map((m) => ({ matchId: m.matchId, opponent: m.opponent.label })),
    };
  }

  /**
   * A redacted connection report for support (N19-02): build/protocol compatibility, discovery and
   * policy state with provenance, the current attempt and bounded counters. No keys, tokens, raw
   * addresses, paths or invitation payloads — players appear only as short fingerprints.
   */
  diagnostics() {
    const t = this.lobby?.transport() ?? { state: 'off' };
    return {
      schema: 'hapa-versus-diagnostics/v1', at: new Date().toISOString(), runtime: RUNTIME_VERSION, network: this.networkId,
      compat: { id: this.compat.id.slice(7, 19), profile: this.compat.profileId, rules: this.compat.rulesImplementation.slice(7, 19), online: ONLINE_PROTOCOL },
      me: { fingerprint: fingerprintOf(this.identity.publicKey), contact: this.contact ? { core: `${this.contact.key.slice(0, 8)}…`, seq: this.contact.descriptor().seq, records: this.contact.records.length } : null },
      contacts: this.contacts?.summary() ?? null,
      discovery: { state: t.state, error: t.error ?? null, connections: t.connections ?? 0, players: t.peers ?? 0, dht: t.dht ?? null, relays: t.relays ?? [] },
      services: this.services?.summary() ?? null,
      roster: (this.lobby?.roster() ?? []).slice(0, 20).map((p) => ({ fingerprint: p.fingerprint, compatible: p.compatible, availability: p.availability, path: p.path, relay: p.relay ? 'configured relay' : null, role: p.role })),
      attempt: this._publicAttempt(), reservation: this._publicReservation() ? { phase: this.reservation.phase, role: this.reservation.role, stalled: !!this.reservation.stalled } : null,
      match: this.match ? { status: this.match.status, connection: this.match.connection, seat: this.match.seat, ticks: this.match.history.length } : null,
      finishing: this.finishing.size, notes: this.lobby?.notes ?? {}, launch: this.launch?.index ?? null,
    };
  }

  /** Relay candidates in policy order: accepted services, then a key passed by a tool (legacy option). */
  _relayCandidates() {
    const out = [...(this.policy?.relays ?? [])];
    if (typeof this.o.relayThrough === 'string' && /^[0-9a-f]{64}$/.test(this.o.relayThrough) && !out.some((r) => r.key === this.o.relayThrough)) out.push({ id: 'tool-relay', key: this.o.relayThrough, endpoint: this.o.relayEndpoints?.[0] ?? null, label: 'relay (tool option)' });
    for (const [i, ep] of (this.o.relayEndpoints ?? []).entries()) if (out[i] && !out[i].endpoint) out[i].endpoint = ep;
    return out;
  }

  /** Configured and opportunistic archives with what is actually observed about each. */
  _services() {
    const out = this.archives.map((a) => ({ label: a.label, player: a.player, configured: true, connected: !!this.lobby?.peers.get(a.player) }));
    for (const p of this.lobby?.peers.values() ?? []) if (p.presence.role === 'archive' && !this.archives.some((a) => a.player === p.playerId)) out.push({ label: p.player.label, player: p.playerId, configured: false, connected: true });
    return out;
  }

  _connectedArchives() { return [...(this.lobby?.peers.values() ?? [])].filter((p) => p.presence.role === 'archive'); }

  _onPeer(peer, ev) {
    if (ev === 'joined' && this.reservation) this._resendStart(peer);
    if (ev === 'joined' && this.contact) this.lobby.send(peer.playerId, { t: 'contact', snapshot: this.contact.snapshot() });
    if (ev === 'joined' && peer.presence.role === 'archive') this._flushOutbox(peer);
    if ((ev === 'lost' || ev === 'replaced') && this.match && peer?.playerId === this.match.opponent.participantId && ev === 'lost') { this.log(`opponent connection lost during the match; redialling`); this.match.detached(); this.lobby?.dial(peer.transportKey); this.lobby?.announce(); }
    if (ev === 'joined' && this.match && peer?.playerId === this.match.opponent.participantId) this.log(`opponent connected (path ${peer.path})`);
    this.emit({ type: 'lobby', kind: ev === 'transport' ? 'transport' : 'roster', roster: this.lobby?.roster() ?? [], transport: this.lobby?.transport() });
  }

  /**
   * Route a connection to every owned authority with this opponent — the active match and any match
   * still finishing (review 18, R18-06) — so a reopened terminal match replicates and can complete.
   */
  _onConnection(peer, conn) {
    let any = false;
    try { this.contact?.core.replicate(conn); } catch { /* replication already attached */ }
    for (const m of new Set([this.match, ...this.finishing.values()])) if (m && !m.closed && peer.playerId === m.opponent.participantId) { m.attach(conn); any = true; }
    if (any) this.lobby?.announce();
  }

  setAvailability(args) {
    if (!['available', 'busy'].includes(args.availability)) throw new Error('availability is available or busy');
    this.settings.availability = args.availability;
    this._saveSettings();
    this.lobby?.announce();
    return this.lobbyView();
  }

  _sweepOffers() {
    const t = now();
    if (this.finishing.size) this._recoverFinishing().catch((e) => this.log(`evidence recovery: ${e.message}`));
    for (const [id, x] of this.incoming) if (t - x.receivedAt > OFFER_MS) { this.incoming.delete(id); this.emit({ type: 'lobby', kind: 'challengeExpired', challengeId: id }); }
    const r = this.reservation;
    if (r && r.phase === 'open' && t - (r.localAt ?? 0) > TABLE_MS) { this._reserve(null); this.emit({ type: 'lobby', kind: 'tableExpired', challengeId: r.challengeId }); }
    if (r && r.phase === 'offered' && t - (r.localAt ?? 0) > OFFER_MS) { this._reserve(null); this.emit({ type: 'lobby', kind: 'challengeExpired', challengeId: r.challengeId, outgoing: true }); }
    // an accepted or starting attempt that makes no progress past the setup deadline is shown as
    // stalled with Retry and Leave; it is never freed automatically (the other side may already
    // hold a signed session) and never becomes a loss
    if (r && (r.phase === 'accepted' || r.phase === 'starting') && !r.stalled && Date.now() - (r.at ?? Date.now()) > START_MS) {
      this._reserve({ ...r, stalled: true });
      this.emit({ type: 'lobby', kind: 'setupStalled', challengeId: r.challengeId, phase: r.phase, opponent: r.opponentLabel });
    }
  }

  // --- challenges -----------------------------------------------------------------------------
  challenge(args) {
    if (!this.lobby) throw new Error('join the lobby first');
    if (this.reservation || this.match?.status === 'active') throw Object.assign(new Error('you already have a match or a pending challenge'), { code: 'BUSY' });
    const peer = this.lobby.peers.get(args.playerId);
    if (!peer) throw new Error('that player is not connected now');
    if (!peer.compatible) throw new Error('that player uses a different rules build');
    if (peer.presence.availability !== 'available') throw new Error(`that player is ${peer.presence.availability}`);
    const body = { kind: 'challenge', network: this.networkId, challengeId: randomHex(16), from: this.identity.participantId, to: peer.playerId, compat: this.compat.id, controller: this.controllerKind, seats: { A: this.identity.participantId, B: peer.playerId }, offerMs: OFFER_MS };
    const sig = signBody('control', body, this.identity);
    this._reserve({ phase: 'offered', role: 'challenger', challengeId: body.challengeId, challenge: body, challengeSig: sig, opponent: peer.playerId, opponentLabel: peer.player.label, localAt: now() });
    this.lobby.send(peer.playerId, { t: 'challenge', body, sig });
    return this.lobbyView();
  }

  // --- setup recovery (review 16, R16-04) -----------------------------------------------------
  _tombstoned(challengeId, matchId) { const a = this.tombstones.attempts; return !!(a[challengeId] || (matchId && Object.values(a).some((t) => t.matchId === matchId))); }

  /** Resend this attempt's last setup message and redial the opponent; the deadline restarts. */
  setupRetry(args) {
    const r = this.reservation;
    if (!r || r.challengeId !== args.challengeId || (r.phase !== 'accepted' && r.phase !== 'starting')) throw Object.assign(new Error('no such setup attempt'), { code: 'NO_ATTEMPT' });
    if (r.opponentTransport) this.lobby?.dial(r.opponentTransport);
    this._reserve({ ...r, stalled: false, at: Date.now() });
    const peer = this.lobby?.peers.get(r.opponent);
    if (peer) this._resendStart(peer);
    return this.lobbyView();
  }

  /**
   * Leave an interrupted setup attempt: the attempt-specific tombstone is durable before the
   * reservation is released, so a late ACCEPT/START/STARTED for it can never revive it.
   */
  setupLeave(args) {
    const r = this.reservation;
    if (!r || r.challengeId !== args.challengeId || !['accepted', 'starting', 'offered'].includes(r.phase)) throw Object.assign(new Error('no such setup attempt'), { code: 'NO_ATTEMPT' });
    this.tombstones.attempts[r.challengeId] = { matchId: r.matchId ?? `hv-${r.challengeId}`, phase: r.phase, opponent: r.opponent, at: new Date().toISOString() };
    writeJsonAtomic(this.store.path('tombstones.json'), this.tombstones);
    if (r.matchId && existsSync(this.store.path('matches', r.matchId))) writeJsonAtomic(this.store.path('matches', r.matchId, 'progress.json'), { status: 'abandoned_setup', at: new Date().toISOString() });
    this.lobby?.send(r.opponent, { t: 'decline', challengeId: r.challengeId, reason: 'left' });
    this._reserve(null);
    this.emit({ type: 'lobby', kind: 'setupLeft', challengeId: r.challengeId });
    return this.lobbyView();
  }

  /** Serialize every decision about the one reservation across its awaits (feed creation, signing). */
  _serial(fn) { const job = (this._setupChain ?? Promise.resolve()).then(fn, fn); this._setupChain = job.catch(() => {}); return job; }

  /** Host an open table: consent to the first compatible player who joins (no second approval). */
  openTable() {
    if (!this.lobby) throw new Error('join the lobby first');
    if (this.reservation || this.match?.status === 'active') throw Object.assign(new Error('you already have a match or a pending challenge'), { code: 'BUSY' });
    const body = { kind: 'challenge', network: this.networkId, challengeId: randomHex(16), from: this.identity.participantId, to: null, compat: this.compat.id, controller: this.controllerKind, seats: { A: this.identity.participantId, B: null }, offerMs: TABLE_MS };
    const sig = signBody('control', body, this.identity);
    // v2 (N19-04): the v1 table/network/expiry binding plus a compact signed contact snapshot
    if (!this.lobby.swarm) throw Object.assign(new Error(`discovery is off: ${this.lobby.error ?? 'no route'}`), { code: 'NO_ROUTE' });
    const capsule = { v: 2, network: this.networkId, player: this.identity.participantId, transport: b4a.toString(this.lobby.swarm.keyPair.publicKey, 'hex'), challengeId: body.challengeId, offer: fingerprint(body), expiresAt: Date.now() + TABLE_MS, contact: this.contact.snapshot() };
    const invite = `hvinv2.${b4a.toString(b4a.from(JSON.stringify({ ...capsule, sig: signBody('control', { kind: 'invite', ...capsule }, this.identity) })), 'base64url')}`;
    this._reserve({ phase: 'open', role: 'challenger', challengeId: body.challengeId, challenge: body, challengeSig: sig, opponent: null, opponentLabel: null, invite, localAt: now() });
    return this.lobbyView();
  }

  closeTable() {
    const r = this.reservation;
    if (r?.phase !== 'open') throw new Error('no open table');
    this._reserve(null);
    return this.lobbyView();
  }

  // --- connection attempts (Assignment 19, N19-02) -------------------------------------------
  /**
   * Start joining a table (lobby or invitation) as one attempt with a stable id. Returns at once;
   * the attempt advances through stages — starting discovery, finding the player, authenticating,
   * negotiating the table, connected — or ends failed/cancelled with a stage-specific reason, all as
   * `attempt` events. The same attempt id again returns the same attempt (no second seat); a new
   * attempt is refused while one is live or a reservation exists.
   */
  startJoin(args) {
    const id = typeof args.attemptId === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(args.attemptId) ? args.attemptId : randomHex(8);
    if (this.attempt?.id === id) return { attempt: this._publicAttempt(), view: this.lobbyView() };
    if (this.attempt && !['failed', 'cancelled', 'connected'].includes(this.attempt.stage)) throw Object.assign(new Error('another connection attempt is in progress'), { code: 'ATTEMPT_BUSY' });
    if (this.reservation || this.match?.status === 'active') throw Object.assign(new Error('you already have a match or a pending challenge'), { code: 'BUSY' });
    const gen = this._attemptGen = (this._attemptGen ?? 0) + 1;
    this.attempt = { id, gen, kind: args.invite ? 'invitation' : 'table', stage: 'starting-discovery', startedAt: Date.now(), at: Date.now(), error: null, target: null, cancel: new AbortController() };
    this._emitAttempt();
    this.joinTable(args, this.attempt).catch((e) => {
      const a = this.attempt;
      if (!a || a.gen !== gen || a.stage === 'cancelled') return;
      this._setStage(a, 'failed', e.code === 'CANCELLED' ? 'cancelled' : e.message);
    });
    return { attempt: this._publicAttempt(), view: this.lobbyView() };
  }

  _setStage(a, stage, error = null) {
    if (this.attempt !== a || ['failed', 'cancelled', 'connected'].includes(a.stage)) return false;
    a.stage = stage; a.at = Date.now(); a.error = error;
    this._emitAttempt();
    return true;
  }
  _publicAttempt() { const a = this.attempt; return a ? { id: a.id, kind: a.kind, stage: a.stage, error: a.error, target: a.target, elapsedMs: Date.now() - a.startedAt } : null; }
  _emitAttempt() { this.emit({ type: 'lobby', kind: 'attempt', attempt: this._publicAttempt() }); }

  /**
   * Cancel a live attempt. Before the accept is recorded nothing durable exists and the attempt is
   * simply fenced. After it (a reservation for this attempt's table exists), cancelling leaves that
   * setup attempt durably (tombstone + `left`), exactly once; it never becomes a loss.
   */
  cancelAttempt(args) {
    const a = this.attempt;
    if (!a || (args.attemptId && args.attemptId !== a.id)) throw Object.assign(new Error('no such connection attempt'), { code: 'NO_ATTEMPT' });
    if (['failed', 'cancelled', 'connected'].includes(a.stage)) return { attempt: this._publicAttempt(), view: this.lobbyView() };
    // the player's intent is terminal at once (N20-04): the attempt is `cancelled` before any cleanup,
    // so releasing its reservation cannot relabel it `failed`; work already queued sees the abort
    a.cancel.abort();
    this._setStage(a, 'cancelled', 'cancelled by you');
    // a recorded accept (accepted/starting) is left durably, once, after any in-flight setup step:
    // tombstone first, then `left`, then release — late setup messages stay fenced
    const leave = () => { const r = this.reservation; if (r && a.challengeId && r.challengeId === a.challengeId && ['accepted', 'starting'].includes(r.phase) && !this.tombstones.attempts[r.challengeId]) this.setupLeave({ challengeId: r.challengeId }); };
    leave();
    a.leaving = this._serial(async () => leave()).catch((e) => this.log(`cancel leave: ${e.message}`));
    return { attempt: this._publicAttempt(), view: this.lobbyView() };
  }

  /** Join an open table seen in the lobby, or one named by a pasted invitation. */
  async joinTable(args, attempt = null) {
    const live = () => { if (attempt && (attempt.cancel.signal.aborted || this.attempt !== attempt)) throw Object.assign(new Error('cancelled'), { code: 'CANCELLED' }); };
    const stage = (s) => { if (attempt) this._setStage(attempt, s); };
    if (!this.lobby) await this.joinLobby({});
    live();
    if (this.reservation || this.match?.status === 'active') throw Object.assign(new Error('you already have a match or a pending challenge'), { code: 'BUSY' });
    let playerId = args.playerId, challengeId = args.challengeId;
    if (typeof args.invite === 'string') {
      const c = parseInvite(args.invite);
      if (c.network !== this.networkId) throw new Error('that invitation is for another network');
      if (c.player === this.identity.participantId) throw new Error('that is your own invitation');
      if (c.expiresAt < Date.now() - 60_000) throw new Error('that invitation has expired: ask for a new one');
      playerId = c.player; challengeId = c.challengeId;
      if (c.contact) this.contacts?.admitSnapshot(c.contact, { source: 'invitation' }); // a signed capsule is an entry path, not an extension of the invite's expiry
      for (const t of new Set([c.transport, ...(this.contacts?.transportsOf(c.player) ?? [])])) this.lobby.dial(t); // an invitation bypasses roster discovery, not NAT or firewalls
    }
    if (attempt) { attempt.target = fingerprintOf(keyOfPlayer(playerId) ?? ''); attempt.challengeId = challengeId; }
    stage('finding-player');
    const peer = await this.lobby.waitForPlayer(playerId, 30_000, attempt?.cancel.signal, () => stage('authenticating'));
    live();
    stage('negotiating');
    const reply = await this._ask(peer, { t: 'table.get', challengeId }, 15_000);
    live();
    const b = reply.body;
    if (!b || b.kind !== 'challenge' || b.to !== null || b.from !== peer.playerId || b.challengeId !== challengeId || b.network !== this.networkId || !verifyBody('control', b, reply.sig, peer.player.publicKey)) throw new Error('that table is no longer open');
    if (b.compat !== this.compat.id) throw Object.assign(new Error('that table uses a different version of the game: both players need the same app build'), { code: 'INCOMPATIBLE' });
    this.incoming.set(b.challengeId, { body: b, sig: reply.sig, fromLabel: peer.player.label, receivedAt: now() });
    const view = await this._serial(async () => { live(); return this.respond({ challengeId: b.challengeId, accept: true }); }); // joining is this player's consent; recorded once
    if (attempt) attempt.awaitingStart = true; // 'connected' when the agreed session opens
    return view;
  }

  cancelChallenge(args) {
    const r = this.reservation;
    if (!r || r.challengeId !== args.challengeId || r.phase !== 'offered') throw new Error('no such pending challenge');
    this.lobby?.send(r.opponent, { t: 'cancel', challengeId: r.challengeId });
    this._reserve(null);
    return this.lobbyView();
  }

  async respond(args) {
    const x = this.incoming.get(args.challengeId);
    if (!x) throw new Error('that challenge is no longer open');
    this.incoming.delete(args.challengeId);
    if (!args.accept) { this.lobby?.send(x.body.from, { t: 'decline', challengeId: args.challengeId, reason: 'declined' }); return this.lobbyView(); }
    if (this.reservation || this.match?.status === 'active') { this.lobby?.send(x.body.from, { t: 'decline', challengeId: args.challengeId, reason: 'busy' }); throw new Error('you already have a match or a pending challenge'); }
    const matchId = `hv-${x.body.challengeId}`;
    const feed = await this._createFeed(matchId);
    const body = { kind: 'accept', network: this.networkId, challengeId: x.body.challengeId, challengeHash: fingerprint(x.body), matchId, from: this.identity.participantId, to: x.body.from, feed, controller: this.controllerKind };
    const sig = signBody('control', body, this.identity);
    this._reserve({ phase: 'accepted', role: 'joiner', challengeId: x.body.challengeId, challenge: x.body, matchId, feed, accept: body, acceptSig: sig, opponent: x.body.from, opponentLabel: x.fromLabel, opponentTransport: this.lobby?.peers.get(x.body.from)?.transportKey ?? null, localAt: now(), at: Date.now() });
    this.lobby?.send(x.body.from, { t: 'accept', body, sig });
    return this.lobbyView();
  }

  async _createFeed(matchId) {
    const dir = this.store.path('matches', matchId);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const core = new Hypercore(join(dir, 'own'), { valueEncoding: 'json' });
    await core.ready();
    const key = b4a.toString(core.key, 'hex');
    await core.close();
    return key;
  }

  async _onMessage(peer, msg) {
    const pk = peer.player.publicKey;
    switch (msg.t) {
      case 'challenge': {
        const b = msg.body;
        if (!b || b.kind !== 'challenge' || b.network !== this.networkId || b.to !== this.identity.participantId || b.from !== peer.playerId || !verifyBody('control', b, msg.sig, pk)) return;
        if (typeof b.challengeId !== 'string' || !/^[0-9a-f]{32}$/.test(b.challengeId)) return;
        if (b.compat !== this.compat.id) { this.lobby.send(peer.playerId, { t: 'decline', challengeId: b.challengeId, reason: 'incompatible' }); return; }
        if (this.reservation || this.match?.status === 'active' || this.settings.availability !== 'available') { this.lobby.send(peer.playerId, { t: 'decline', challengeId: b.challengeId, reason: 'busy' }); return; }
        if (this.incoming.size >= 8) return;
        this.incoming.set(b.challengeId, { body: b, sig: msg.sig, fromLabel: peer.player.label, receivedAt: now() });
        this.emit({ type: 'lobby', kind: 'challengeReceived', challengeId: b.challengeId, from: peer.player.label, fingerprint: peer.fingerprint, controller: b.controller });
        if (this.o.autoAccept) await this.respond({ challengeId: b.challengeId, accept: true });
        return;
      }
      case 'cancel': if (this.incoming.delete(msg.challengeId)) this.emit({ type: 'lobby', kind: 'challengeCancelled', challengeId: msg.challengeId }); return;
      case 'decline': {
        const r = this.reservation;
        // lost STARTED (R18-03): this side already opened the match, the other side never saw it start
        // and has now left that attempt. With no agreed Tick and nothing in its feed, the match can never
        // continue: it is closed as an unstarted setup (no result, no loss) and the seat is freed.
        if (r?.phase === 'active' && msg.reason === 'left' && r.challengeId === msg.challengeId && r.opponent === peer.playerId && this.match?.matchId === r.matchId && this.match.history.length === 0 && !(this.match.remote?.length > 0)) {
          return this._serial(() => this._releaseUnstarted('the other player left before the match started'));
        }
        if ((r?.phase === 'accepted' || r?.phase === 'starting') && r.challengeId === msg.challengeId && r.opponent === peer.playerId) { this._reserve({ ...r, stalled: true, otherLeft: String(msg.reason ?? 'left').slice(0, 24) }); this.emit({ type: 'lobby', kind: 'setupStalled', challengeId: r.challengeId, phase: r.phase, opponent: r.opponentLabel, reason: 'the other player left this attempt' }); return; }
        if (r?.phase === 'offered' && r.challengeId === msg.challengeId && r.opponent === peer.playerId) { this._reserve(null); this.emit({ type: 'lobby', kind: 'challengeDeclined', challengeId: msg.challengeId, reason: String(msg.reason ?? 'declined').slice(0, 24), by: peer.player.label }); }
        return;
      }
      case 'table.get': {
        const r = this.reservation;
        if (r?.phase === 'open' && r.challengeId === msg.challengeId) this.lobby.send(peer.playerId, { t: 'table.offer', req: msg.req, body: r.challenge, sig: r.challengeSig });
        else this.lobby.send(peer.playerId, { t: 'table.offer', req: msg.req, body: null });
        return;
      }
      case 'table.offer': { const q = this._requests.get(msg.req); if (q) { this._requests.delete(msg.req); q(msg); } return; }
      case 'result': return this._onResult(peer, msg);
      case 'resultAck': return this._onResultAck(peer, msg);
      case 'results.query': return this._onResultsQuery(peer, msg);
      case 'players.query': { const page = this.results.players({ offset: Number.isSafeInteger(msg.offset) ? msg.offset : 0, limit: 50 }); this.lobby.send(peer.playerId, { t: 'players.page', req: msg.req, total: page.total, items: page.items }); return; }
      case 'players.page': { const q = this._requests.get(msg.req); if (q) { this._requests.delete(msg.req); q(msg); } return; }
      case 'result.get': return this._onResultGet(peer, msg);
      case 'evidence.get': return this._onEvidenceGet(peer, msg);
      case 'contact': {
        // a signed snapshot from the authenticated player itself; then follow (replicate + verify) its core
        const r = this.contacts?.admitSnapshot(msg.snapshot, { source: 'peer', authenticatedAs: peer.playerId });
        if (r?.ok) await this.contacts.follow(peer.playerId, peer.ctx.conn).catch((e) => this.log(`contact follow: ${e.message}`));
        return;
      }
      case 'results.page': case 'resultBundle': { const r = this._requests.get(msg.req); if (r) { this._requests.delete(msg.req); r(msg); } return; }
      case 'accept': if (this._tombstoned(msg.body?.challengeId, msg.body?.matchId)) { this.lobby.send(peer.playerId, { t: 'decline', challengeId: msg.body?.challengeId, reason: 'left' }); return; } return this._serial(() => this._onAccept(peer, msg));
      case 'start': if (this._tombstoned(null, msg.descriptor?.matchId)) return; return this._serial(() => this._onStart(peer, msg));
      case 'started': if (this._tombstoned(null, msg.matchId)) return; return this._serial(() => this._onStarted(peer, msg));
      default: return;
    }
  }

  async _onAccept(peer, msg) {
    let r = this.reservation;
    const b = msg.body;
    if (r?.phase === 'open' && b?.challengeId === r.challengeId && b.to === this.identity.participantId && b.from !== this.identity.participantId) {
      // an open table: the first valid, compatible acceptance takes the seat
      if (!verifyBody('control', b, msg.sig, peer.player.publicKey)) return;
      r = { ...r, phase: 'offered', opponent: peer.playerId, opponentLabel: peer.player.label };
      this.reservation = r;
    } else if (r && b?.challengeId === r.challengeId && r.opponent && r.opponent !== peer.playerId) { this.lobby.send(peer.playerId, { t: 'decline', challengeId: b.challengeId, reason: 'taken' }); return; }
    if (!r || r.phase !== 'offered' || !b || b.challengeId !== r.challengeId || b.from !== peer.playerId || b.to !== this.identity.participantId) return;
    if (b.kind !== 'accept' || b.network !== this.networkId || b.challengeHash !== fingerprint(r.challenge) || b.matchId !== `hv-${r.challengeId}` || !/^[0-9a-f]{64}$/.test(b.feed ?? '')) return;
    if (!verifyBody('control', b, msg.sig, peer.player.publicKey)) return;
    const matchId = b.matchId;
    const feedA = await this._createFeed(matchId);
    const players = { A: publicPlayer(this.identity), B: { participantId: peer.player.participantId, identityKind: peer.player.identityKind, label: peer.player.label, signingKeyId: peer.player.signingKeyId, publicKey: peer.player.publicKey } };
    const seed = (crypto.randomBytes(4).readUInt32BE(0) >>> 0) || 1;
    const controllers = { A: { type: this.controllerKind, revision: this.controllerKind === 'bot' ? 'heuristic-bot/0.2.0' : 'hapa-versus-desktop/0.1.0' }, B: { type: b.controller === 'bot' ? 'bot' : 'human', revision: b.controller === 'bot' ? 'heuristic-bot/0.2.0' : 'hapa-versus-desktop/0.1.0' } };
    const manifest = presetManifest({ matchId, seed, players, controllers });
    const descriptor = {
      online: ONLINE_PROTOCOL, network: this.networkId, matchId, challengeHash: fingerprint(r.challenge), acceptHash: fingerprint(b),
      manifestHash: fingerprint(manifest), initialStateHash: initialStateHash(manifest), rulesImplementation: rulesImplementation(), compat: this.compat.id,
      players: { A: { participantId: players.A.participantId, publicKey: players.A.publicKey }, B: { participantId: players.B.participantId, publicKey: players.B.publicKey } },
      feeds: { A: feedA, B: b.feed }, policy: { agreement: 'own_plan_ready_v1', results: 'public_replay_v1' }, recovery: 'journal_replay_v1',
    };
    const sigA = signBody('session', descriptor, this.identity);
    writeJsonAtomic(this.store.path('matches', matchId, 'session.json'), { descriptor, manifest, sigs: { A: sigA }, seat: 'A', phase: 'starting' });
    this._reserve({ ...r, phase: 'starting', matchId, opponentTransport: peer.transportKey, localAt: now(), at: Date.now() });
    this.lobby.send(peer.playerId, { t: 'start', descriptor, manifest, sig: sigA });
  }

  async _onStart(peer, msg) {
    const r = this.reservation, d = msg.descriptor;
    if (!r || !d || d.matchId !== r.matchId || r.opponent !== peer.playerId) return;
    const existing = readJson(this.store.path('matches', d.matchId, 'session.json'));
    if (existing?.sigs?.A && existing?.sigs?.B) { if (fingerprint(existing.descriptor) === fingerprint(d)) this.lobby.send(peer.playerId, { t: 'started', matchId: d.matchId, sig: existing.sigs.B }); return; }
    if (r.phase !== 'accepted') return;
    const err = this._descriptorError(d, msg.manifest, peer, r);
    if (err) { this.log(`refused session start: ${err}`); this.lobby.send(peer.playerId, { t: 'decline', challengeId: r.challengeId, reason: 'bad-start' }); this._reserve(null); this.emit({ type: 'lobby', kind: 'startFailed', reason: err }); return; }
    const sigB = signBody('session', d, this.identity);
    const session = { descriptor: d, manifest: msg.manifest, sigs: { A: msg.sig, B: sigB }, seat: 'B', phase: 'active' };
    writeJsonAtomic(this.store.path('matches', d.matchId, 'session.json'), session);
    this._reserve({ ...r, phase: 'active' });
    await this._openMatch(session);
    this.lobby.send(peer.playerId, { t: 'started', matchId: d.matchId, sig: sigB });
  }

  _descriptorError(d, manifest, peer, r) {
    if (d.online !== ONLINE_PROTOCOL || d.network !== this.networkId) return 'another online protocol or network';
    if (d.challengeHash !== fingerprint(r.challenge) || d.acceptHash !== fingerprint(r.accept)) return 'the session does not name this challenge and acceptance';
    if (d.compat !== this.compat.id || d.rulesImplementation !== rulesImplementation()) return 'different rules implementation';
    if (d.players?.A?.participantId !== peer.playerId || d.players?.A?.publicKey !== peer.player.publicKey || d.players?.B?.participantId !== this.identity.participantId || d.players?.B?.publicKey !== this.identity.publicKey) return 'seat assignment differs';
    if (d.feeds?.B !== r.feed || !/^[0-9a-f]{64}$/.test(d.feeds?.A ?? '') || d.feeds.A === d.feeds.B) return 'feed binding differs';
    if (d.policy?.agreement !== 'own_plan_ready_v1' || d.recovery !== 'journal_replay_v1') return 'unsupported session policy';
    const players = { A: { participantId: peer.playerId, publicKey: peer.player.publicKey, signingKeyId: peer.player.signingKeyId }, B: { participantId: this.identity.participantId, publicKey: this.identity.publicKey, signingKeyId: this.identity.signingKeyId } };
    const me = manifestError(manifest, { matchId: d.matchId, players });
    if (me) return me;
    if (fingerprint(manifest) !== d.manifestHash) return 'manifest hash differs';
    if (initialStateHash(manifest) !== d.initialStateHash) return 'initial state hash differs';
    return null;
  }

  async _onStarted(peer, msg) {
    const r = this.reservation;
    if (r?.role === 'challenger' && r.phase === 'starting' && msg.matchId === r.matchId && r.opponent === peer.playerId) {
      const file = this.store.path('matches', r.matchId, 'session.json');
      const s = readJson(file);
      if (!s || !verifyBody('session', s.descriptor, msg.sig, peer.player.publicKey)) { this.log('refused STARTED signature'); return; }
      s.sigs.B = msg.sig; s.phase = 'active';
      writeJsonAtomic(file, s);
      this._reserve({ ...r, phase: 'active' });
      await this._openMatch(s);
      this.lobby.send(peer.playerId, { t: 'started', matchId: r.matchId, sig: s.sigs.A });
      return;
    }
    if (this.match && msg.matchId === this.match.matchId) this.emit({ type: 'match', matchId: msg.matchId, kind: 'bothStarted' });
  }

  _resendStart(peer) {
    const r = this.reservation;
    if (!r || r.opponent !== peer.playerId) return;
    if (r.phase === 'accepted') this.lobby.send(peer.playerId, { t: 'accept', body: r.accept, sig: r.acceptSig });
    if (r.phase === 'starting') { const s = readJson(this.store.path('matches', r.matchId, 'session.json')); if (s) this.lobby.send(peer.playerId, { t: 'start', descriptor: s.descriptor, manifest: s.manifest, sig: s.sigs.A }); }
    if (r.phase === 'active' && this.match) { const s = readJson(this.store.path('matches', r.matchId, 'session.json')); this.lobby.send(peer.playerId, { t: 'started', matchId: r.matchId, sig: s?.sigs?.[this.match.seat] }); }
  }

  // --- matches --------------------------------------------------------------------------------
  async _openMatch(session, { finishing = false } = {}) {
    const id = session.descriptor.matchId;
    if (this.match?.matchId === id) return this.match;
    if (this.finishing.has(id)) return this.finishing.get(id);
    for (const s of ['A', 'B']) if (!verifyBody('session', session.descriptor, session.sigs?.[s], session.descriptor.players[s].publicKey)) throw new Error(`session signature of seat ${s} is missing or invalid`);
    const controller = this.controllerKind === 'bot' ? new HeuristicBot({ seat: session.seat, seed: session.manifest.randomStream.seed * 2 + (session.seat === 'A' ? 1 : 2) }) : null;
    const m = new OnlineMatch({ dir: this.store.path('matches', id), identity: this.identity, session, controller, log: this.log, emit: (e) => this.emit(e), onComplete: (mm) => this._onComplete(mm) });
    // lifecycle ownership (R17-06): a predecessor that is still finishing is kept, never orphaned
    if (finishing) this.finishing.set(id, m);
    else {
      if (this.match && this.match.status !== 'active' && this.match.status !== 'disputed') this.finishing.set(this.match.matchId, this.match);
      this.match = m;
    }
    await m.open();
    this.lobby?.join('match', m.matchId);
    const opp = this.lobby?.peers.get(m.opponent.participantId);
    if (opp) m.attach(opp.ctx.conn);
    this.lobby?.announce();
    if (!finishing) this.emit({ type: 'match', matchId: m.matchId, kind: 'opened', seat: m.seat, opponent: m.opponent.label });
    if (!finishing && this.attempt?.challengeId && this.reservation?.challengeId === this.attempt.challengeId) this._setStage(this.attempt, 'connected');
    return m;
  }

  /**
   * Startup reconciliation (R16-02): reopen the one active match, reopen terminal matches whose
   * attestation or result finalization did not finish (both durable crash cuts), and repair a
   * recorded result missing its sharing job. Journals are kept; nothing is replayed as new input.
   */
  async _resumeMatches() {
    const dir = this.store.path('matches');
    if (!existsSync(dir)) return;
    let active = false, finishing = 0;
    for (const id of readdirSync(dir)) {
      const s = readJson(join(dir, id, 'session.json'));
      const p = readJson(join(dir, id, 'progress.json'));
      if (!s?.sigs?.A || !s?.sigs?.B || s.phase !== 'active' || this._tombstoned(null, id)) continue;
      if (s.descriptor.online !== ONLINE_PROTOCOL) continue; // a legacy online version keeps its record; it is not resumed
      if (p?.status === 'recorded') { if (p.key && !this.outbox[p.key]) { this.outbox[p.key] = { matchId: id, archivedBy: [] }; this._saveOutbox(); } continue; }
      if (['abandoned', 'abandoned_setup'].includes(p?.status)) continue;
      const terminal = p?.status === 'terminal' || p?.status === 'attested';
      if (!terminal && active) continue;
      if (terminal && finishing >= 4) continue;
      try {
        await this._openMatch(s, { finishing: terminal });
        if (terminal) finishing++; else active = true;
        this.log(`${terminal ? 'finishing' : 'resumed'} match ${id} as seat ${s.seat}`);
      } catch (e) { this.log(`could not reopen ${id}: ${e.message}`); }
    }
  }

  _onComplete(m) {
    if (this.reservation?.matchId === m.matchId || this.match === m) this._reserve(null);
    if (this.match === m) { this.finishing.set(m.matchId, m); }
    this.lobby?.announce();
    if (m._finalizing) return;
    m._finalizing = true;
    this._finalize(m).catch((e) => { m._finalizing = false; this.log(`result not saved: ${e.message}`); this.emit({ type: 'match', matchId: m.matchId, kind: 'resultSaved', status: 'failed', reason: e.message }); });
  }

  // --- terminal evidence after the counterpart retired (review 18, R18-06) ----------------------
  /**
   * Serve this player's durable result evidence for a match: the verified bundle stored in the
   * result index, never a live authority. A counterpart that crashed before receiving our closing
   * record can finish from it after we retired and even after we restarted. Public evidence (the same
   * bundles archives hold); at most one answer per peer per second.
   */
  _onEvidenceGet(peer, msg) {
    const at = (this._evidenceAt ??= new Map()).get(peer.playerId) ?? 0;
    if (Date.now() - at < 1000) return;
    this._evidenceAt.set(peer.playerId, Date.now());
    const key = resultKey(this.networkId, String(msg.matchId ?? '').slice(0, 80));
    const want = this.results.bundles(key).find((b) => { const v = verifyBundle(b); return v.ok && v.descriptorHash === msg.descriptorHash; }) ?? null;
    this.lobby.send(peer.playerId, { t: 'resultBundle', req: msg.req, key, bundle: want });
  }

  /**
   * For each match still waiting for the other side's closing record, ask the counterpart and
   * connected archives for the verified evidence, with a per-match backoff (5 s doubling to 60 s).
   * Adopted only if it verifies completely, names this session, contains exactly this player's own
   * stored history (same feed key, length and Merkle root) and the same final state.
   */
  async _recoverFinishing() {
    if (!this.lobby || this._recovering) return;
    this._recovering = true;
    try {
      for (const m of [...this.finishing.values()]) {
        if (m.closed || m._finalizing || m.status !== 'finishing' || !m.finalHash) continue;
        // replication normally delivers the closing record within moments; ask only after a pause
        if (m._evidenceNext === undefined) { m._evidenceNext = Date.now() + 5000; continue; }
        if (Date.now() < m._evidenceNext) continue;
        m._evidenceDelay = Math.min(60_000, (m._evidenceDelay ?? 2500) * 2);
        m._evidenceNext = Date.now() + m._evidenceDelay;
        const peers = [this.lobby.peers.get(m.opponent.participantId), ...[...this.lobby.peers.values()].filter((p) => p.presence.role === 'archive')].filter(Boolean);
        for (const p of peers) {
          const got = await this._ask(p, { t: 'evidence.get', matchId: m.matchId, descriptorHash: fingerprint(m.descriptor) }, 10_000).catch(() => null);
          if (got?.bundle && await this._adoptEvidence(m, got.bundle, p)) break;
        }
      }
    } finally { this._recovering = false; }
  }

  async _adoptEvidence(m, bundle, from) {
    const v = verifyBundle(bundle);
    if (!v.ok || v.matchId !== m.matchId || v.descriptorHash !== fingerprint(m.descriptor) || v.finalStateHash !== m.finalHash) return false;
    const mine = v.prefixes[m.seat];
    const held = await feedPrefix(m.own, mine.length).catch(() => null);
    if (!held || held.key !== mine.key || held.root !== mine.root || held.length !== mine.length) return false;
    if (m.closed || m._finalizing) return false;
    m._finalizing = true;
    this.log(`finishing ${m.matchId} from verified evidence held by ${from.player.label}`);
    this.emit({ type: 'match', matchId: m.matchId, kind: 'evidenceRecovered', from: from.player.label });
    await this._finalize(m, bundle).catch((e) => { m._finalizing = false; this.log(`result not saved: ${e.message}`); });
    return true;
  }

  /**
   * Idempotent finalization: verified result, then its sharing job, then `recorded`. Each step is
   * safe to repeat after a crash at any point; only then is the authority closed (once).
   */
  async _finalize(m, given = null) {
    const session = readJson(join(m.dir, 'session.json'));
    const bundle = given ?? buildBundle({ session, evidence: await m.evidence() });
    const r = this.results.submit(bundle, { source: 'participant' });
    if (r.status !== 'added' && r.status !== 'duplicate' && r.status !== 'disputed') throw new Error(`own evidence did not verify: ${r.reason}`);
    if (!this.outbox[r.key]) { this.outbox[r.key] = { matchId: m.matchId, archivedBy: [] }; this._saveOutbox(); }
    writeJsonAtomic(join(m.dir, 'progress.json'), { status: 'recorded', outcome: m.state.outcome, finalHash: m.finalHash, key: r.key, commitment: r.commitment, at: new Date().toISOString(), ...(given ? { via: 'retrieved-evidence' } : {}) });
    this.emit({ type: 'match', matchId: m.matchId, kind: 'resultSaved', status: 'saved', key: r.key, commitment: r.commitment, record: this.results.stats(this.identity.participantId) });
    for (const p of this.lobby?.peers.values() ?? []) if (p.presence.role === 'archive') this._flushOutbox(p);
    await this._retire(m);
    return r;
  }

  /** Close a finished authority once its evidence is durable (readers, waiters, native cores). */
  async _retire(m) {
    // the opponent may still need our final blocks: keep replicating briefly, then close
    await new Promise((res) => setTimeout(res, this.o.retireDelayMs ?? 3000));
    this.lastCompleted = m.snapshot();
    this.finishing.delete(m.matchId);
    if (this.match === m) this.match = null;
    this.lobby?.leaveTopic('match', m.matchId);
    await m.close();
  }

  _saveOutbox() { writeJsonAtomic(this.store.path('outbox.json'), this.outbox); }

  _flushOutbox(peer) {
    for (const [key, o] of Object.entries(this.outbox)) {
      if (o.archivedBy.includes(peer.playerId)) continue;
      for (const bundle of this.results.bundles(key)) this.lobby.send(peer.playerId, { t: 'result', key, bundle });
    }
  }

  _onResult(peer, msg) {
    // any peer may hold public evidence; it is verified independently before it counts
    const r = this.results.submit(msg.bundle, { source: peer.fingerprint });
    this.lobby.send(peer.playerId, { t: 'resultAck', key: r.key ?? msg.key, status: r.status, commitment: r.commitment ?? null });
    if (r.status === 'added' || r.status === 'disputed') this.emit({ type: 'results', kind: 'received', key: r.key, status: r.status });
  }

  _onResultAck(peer, msg) {
    const o = this.outbox[msg.key];
    if (!o || !['added', 'duplicate', 'disputed'].includes(msg.status)) return;
    if (!o.archivedBy.includes(peer.playerId)) { o.archivedBy.push(peer.playerId); this._saveOutbox(); }
    this.emit({ type: 'match', matchId: o.matchId, kind: 'resultArchived', key: msg.key, by: peer.player.label, status: msg.status });
  }

  _onResultsQuery(peer, msg) {
    // every verified commitment, not only the first of a conflict (R18-07)
    const page = this.results.commitments({ playerId: typeof msg.playerId === 'string' ? msg.playerId : null, offset: Number.isSafeInteger(msg.offset) ? msg.offset : 0, limit: 20 });
    this.lobby.send(peer.playerId, { t: 'results.page', req: msg.req, total: page.total, items: page.items.map((x) => ({ key: x.key, commitment: x.commitment })) });
  }

  _onResultGet(peer, msg) {
    const bundles = typeof msg.key === 'string' ? this.results.bundles(msg.key) : [];
    const want = typeof msg.commitment === 'string' ? bundles.find((b) => { const v = verifyBundle(b); return v.ok && v.commitment === msg.commitment; }) : bundles[0];
    this.lobby.send(peer.playerId, { t: 'resultBundle', req: msg.req, key: msg.key, bundle: want ?? null });
  }

  _ask(peer, msg, ms = 15_000) {
    const req = randomHex(8);
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { this._requests.delete(req); reject(new Error('the archive did not answer')); }, ms);
      this._requests.set(req, (m) => { clearTimeout(t); resolve(m); });
      if (!this.lobby.send(peer.playerId, { ...msg, req })) { clearTimeout(t); this._requests.delete(req); reject(new Error('not connected')); }
    });
  }

  /** Pull verified evidence from connected archives (optionally for one player); verify each locally. */
  async syncResults(args = {}) {
    const archives = [...(this.lobby?.peers.values() ?? [])].filter((p) => p.presence.role === 'archive');
    const out = { archives: archives.length, fetched: 0, added: 0, duplicate: 0, refused: 0, disputed: 0, sources: [] };
    // completion is tracked per source (review 18, R18-08): a source is `complete` only when every page
    // it advertised was enumerated and every missing item retrieved; a timeout on the first page is
    // `failed`, a later gap `partial`. Only complete sources can support a checked zero.
    for (const a of archives) {
      const src = { label: a.player.label, player: a.playerId, state: 'complete', error: null, advertised: 0 };
      out.sources.push(src);
      for (let offset = 0; offset < 1000; offset += 20) {
        let page;
        try { page = await this._ask(a, { t: 'results.query', playerId: args.playerId ?? null, offset }); } catch (e) { src.state = offset === 0 ? 'failed' : 'partial'; src.error = e.message; break; }
        src.advertised = page.total ?? src.advertised;
        for (const it of page.items ?? []) {
          if (this.results.has(it.key, it.commitment)) { out.duplicate++; continue; }
          let got;
          try { got = await this._ask(a, { t: 'result.get', key: it.key, commitment: it.commitment }); } catch (e) { src.state = 'partial'; src.error = e.message; continue; }
          if (!got?.bundle) { src.state = 'partial'; src.error = 'an advertised result was not returned'; continue; }
          out.fetched++;
          const r = this.results.submit(got.bundle, { source: `archive:${a.fingerprint}` });
          if (r.status === 'added') out.added++; else if (r.status === 'duplicate') out.duplicate++; else if (r.status === 'disputed') out.disputed++; else out.refused++;
        }
        if (!page.items?.length || offset + 20 >= page.total) break;
        if (offset + 20 >= 1000) { src.state = 'partial'; src.error = 'more results than one sync reads'; }
      }
    }
    return out;
  }

  /**
   * A player's verified record (R16-03): local verified evidence plus a coalesced, cached pull from
   * connected archives. A live match has priority, so syncing is deferred during play unless asked.
   * The sync state says what the numbers mean: unavailable, deferred, synced (with sources) or a
   * checked zero.
   */
  async profile(args) {
    const pid = args.playerId;
    if (typeof pid !== 'string' || !keyOfPlayer(pid)) throw new Error('playerId required');
    const archives = this._connectedArchives();
    const cached = this._profileCache.get(pid);
    let sync;
    if (!archives.length) sync = { state: 'archive-unavailable' };
    else if (this.match?.status === 'active' && !args.force) sync = cached?.sync ? { ...cached.sync, stale: true } : { state: 'deferred', reason: 'a match is in progress' };
    else if (cached && Date.now() - cached.at < 60_000 && !args.force) sync = cached.sync;
    else {
      let job = this._syncInFlight.get(pid);
      if (!job) { job = this.syncResults({ playerId: pid }).finally(() => this._syncInFlight.delete(pid)); this._syncInFlight.set(pid, job); }
      const r = await job.catch((e) => ({ error: e.message, sources: [] }));
      const done = (r.sources ?? []).filter((s) => s.state === 'complete'), bad = (r.sources ?? []).filter((s) => s.state !== 'complete');
      const sources = (r.sources ?? []).map((s) => ({ label: s.label, state: s.state, error: s.error }));
      // synced only when every source completed; a failed or partial source is said, never cached as
      // a checked answer, and retried on the next request (R18-08)
      sync = r.error || !done.length ? { state: 'archive-unavailable', error: r.error ?? bad[0]?.error ?? 'no archive answered', sources }
        : bad.length ? { state: 'partial', at: new Date().toISOString(), sources, fetched: r.fetched, added: r.added, refused: r.refused }
          : { state: 'synced', at: new Date().toISOString(), sources, fetched: r.fetched, added: r.added, refused: r.refused };
      if (sync.state === 'synced') this._profileCache.set(pid, { at: Date.now(), sync });
      else this._profileCache.delete(pid);
      if (this._profileCache.size > 200) this._profileCache.delete(this._profileCache.keys().next().value);
    }
    const stats = this.results.stats(pid);
    const recent = this.results.list({ playerId: pid, limit: 10 });
    return { playerId: pid, fingerprint: fingerprintOf(keyOfPlayer(pid)), label: recent.items.flatMap((x) => [x.players.A, x.players.B]).find((p) => p.participantId === pid)?.label ?? null, stats, recent, sync, checkedZero: sync.state === 'synced' && recent.total === 0 };
  }

  /** Players with verified records known here and at connected archives (they may be offline). */
  async directory() {
    const local = this.results.players({ limit: 200 }).items.map((x) => ({ ...x, source: 'this computer' }));
    const byId = new Map(local.map((x) => [x.playerId, x]));
    const archives = this._connectedArchives();
    if (!(this.match?.status === 'active')) {
      for (const a of archives) {
        const page = await this._ask(a, { t: 'players.query', offset: 0 }).catch(() => null);
        for (const it of page?.items ?? []) if (typeof it.playerId === 'string' && keyOfPlayer(it.playerId)) { const prev = byId.get(it.playerId); byId.set(it.playerId, { playerId: it.playerId, label: sanitizeName(it.label) || prev?.label || 'Player', results: Math.max(prev?.results ?? 0, it.results | 0), source: prev ? 'this computer and archive' : `archive (${a.player.label})` }); }
      }
    }
    const online = new Map((this.lobby?.roster() ?? []).map((r) => [r.playerId, r.availability]));
    return { archives: archives.length, deferred: this.match?.status === 'active', items: [...byId.values()].map((x) => ({ ...x, fingerprint: fingerprintOf(keyOfPlayer(x.playerId)), connected: online.has(x.playerId), availability: online.get(x.playerId) ?? 'offline' })).sort((a, b) => b.results - a.results).slice(0, 200) };
  }


  _matchFor(args) {
    if (!this.match || (args.matchId && args.matchId !== this.match.matchId)) throw Object.assign(new Error('no such active match'), { code: 'NO_MATCH' });
    return this.match;
  }

  /** Close an active match that never started on the other side; tombstoned, kept, no result (R18-03). */
  async _releaseUnstarted(reason) {
    const m = this.match, r = this.reservation;
    this.tombstones.attempts[r?.challengeId ?? m.matchId] = { matchId: m.matchId, phase: 'active-unstarted', opponent: m.opponent.participantId, at: new Date().toISOString() };
    writeJsonAtomic(this.store.path('tombstones.json'), this.tombstones);
    writeJsonAtomic(join(m.dir, 'progress.json'), { status: 'abandoned_setup', previous: 'active', reason, at: new Date().toISOString(), lastAgreedTick: 0 });
    await m.close();
    this.lobby?.leaveTopic('match', m.matchId);
    this.match = null;
    this._reserve(null);
    this.emit({ type: 'match', matchId: m.matchId, kind: 'unstarted', reason });
    this.emit({ type: 'lobby', kind: 'setupLeft', challengeId: r?.challengeId ?? null, reason });
  }

  async abandon(args) {
    const m = this._matchFor(args);
    if (m.status !== 'active' && m.status !== 'disputed') throw new Error('the match is not active');
    // explicit departure (never a concession): the record, the evidence so far and the reason stay
    writeJsonAtomic(join(m.dir, 'progress.json'), { status: 'abandoned', previous: m.status, reason: m.disputed ?? null, at: new Date().toISOString(), lastAgreedTick: m.history.at(-1)?.tick ?? 0 });
    await m.close();
    this.match = null;
    this._reserve(null);
    return { ok: true };
  }

  history() {
    const dir = this.store.path('matches');
    if (!existsSync(dir)) return [];
    return readdirSync(dir).map((id) => ({ id, s: readJson(join(dir, id, 'session.json')), p: readJson(join(dir, id, 'progress.json')) })).filter((x) => x.s)
      .map(({ id, s, p }) => ({ matchId: id, seat: s.seat, opponent: s.manifest.participants[s.seat === 'A' ? 'B' : 'A'].label, status: p?.status ?? s.phase, outcome: p?.outcome ?? null, lastAgreedTick: p?.lastAgreedTick ?? null }));
  }

  status() {
    const id = this.identity;
    return {
      runtime: RUNTIME_VERSION, state: this.state, networkId: this.networkId,
      player: id ? { ...publicPlayer(id), fingerprint: fingerprintOf(id.publicKey) } : null,
      createdIdentity: !!this.createdIdentity, launch: this.launch ?? null, joined: !!this.settings?.joined,
      transport: this.lobby?.transport() ?? { state: 'off' }, availability: this.state === 'open' ? this.availability() : null,
      match: this.match ? { matchId: this.match.matchId, status: this.match.status, seat: this.match.seat } : null,
      finishing: [...this.finishing.keys()],
      compat: this.compat ? { id: this.compat.id, profileId: this.compat.profileId, rulesImplementation: this.compat.rulesImplementation } : null,
      versions: { node: process.versions.node, electron: process.versions.electron ?? null, modules: process.versions.modules },
    };
  }

  /** Start then stop a separate transport once (attachment proof independent of the lobby). */
  async probeTransport() {
    const { default: Hyperswarm } = await import('hyperswarm');
    const swarm = new Hyperswarm();
    const t0 = Date.now();
    await swarm.listen();
    const out = { listened: true, transportKey: swarm.keyPair.publicKey.toString('hex').slice(0, 16), ms: Date.now() - t0 };
    await swarm.destroy();
    out.destroyed = true;
    return out;
  }

  /** The adapter entry point: one named operation with plain-data arguments. */
  async handle(op, args = {}) {
    if (this.state !== 'open') throw new Error('the peer runtime is not open');
    if (args === null || typeof args !== 'object' || Array.isArray(args)) throw new Error('bad arguments');
    switch (op) {
      case 'getStatus': return this.status();
      case 'probeTransport': return this.probeTransport();
      case 'setDisplayName': return { label: renameIdentity(this.store, this.identity, sanitizeName(args.name)) };
      case 'lobby.join': return this.joinLobby(args);
      case 'lobby.leave': return this.leaveLobby();
      case 'lobby.list': return this.lobbyView();
      case 'setAvailability': return this.setAvailability(args);
      case 'challenge': return this._serial(() => this.challenge(args));
      case 'challenge.cancel': return this.cancelChallenge(args);
      case 'challenge.respond': return this._serial(() => this.respond(args));
      case 'setup.retry': return this._serial(() => this.setupRetry(args));
      case 'setup.leave': return this._serial(() => this.setupLeave(args));
      case 'table.open': return this._serial(() => this.openTable());
      case 'table.close': return this.closeTable();
      // joins return at once with a stable attempt; progress, success or failure arrive as attempt
      // events, so the host's request deadline can never cut an operation in half (N19-02)
      case 'table.join': return this.startJoin({ playerId: args.playerId, challengeId: args.challengeId, attemptId: args.attemptId });
      case 'invite.join': return this.startJoin({ invite: args.code, attemptId: args.attemptId });
      case 'attempt.cancel': return this.cancelAttempt(args);
      case 'attempt.get': return this.attempt ? this._publicAttempt() : null;
      case 'diagnostics': return this.diagnostics();
      case 'match.get': return this.match ? this.match.snapshot() : (args.includeCompleted ? this.lastCompleted : null);
      case 'match.draft': return this._matchFor(args).draft(args);
      case 'match.ready': return this._matchFor(args).ready(args);
      case 'match.choice': return this._matchFor(args).choice(args);
      case 'match.leave': return this.abandon(args);
      case 'history.list': return this.history();
      case 'system.suspend': this.suspended = true; return { ok: true };
      case 'system.resume': {
        // host-only (never a renderer operation): presence is refreshed and a lost opponent redialled
        this.suspended = false;
        this.lobby?.announce();
        if (this.match?.status === 'active') { const opp = this.lobby?.peers.get(this.match.opponent.participantId); if (!opp) this.match.detached(); }
        return { ok: true };
      }
      case 'results.list': return this.results.list(args);
      case 'results.sync': return this.syncResults(args);
      case 'profile.get': return this.profile(args);
      case 'directory.list': return this.directory();
      default: throw new Error(`unknown operation ${op}`);
    }
  }

  async close() {
    if (this.state === 'closed') return;
    this.state = 'closing';
    clearInterval(this._sweepTimer);
    // drain every owned authority (active and finishing); journals stay on disk
    const owned = new Set([this.match, ...this.finishing.values()].filter(Boolean));
    for (const m of owned) await m.close().catch(() => {});
    this.finishing.clear();
    await this.lobby?.stop();
    await this.contacts?.close();
    await this.contact?.close();
    await this.services?.close();
    this.store?.release();
    this.state = 'closed';
  }
}
