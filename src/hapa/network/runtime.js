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

export const RUNTIME_VERSION = 'hapa-versus-peer-runtime/0.2.0';
const OFFER_MS = 120_000;
const START_MS = 30_000;
const now = () => Number(process.hrtime.bigint() / 1_000_000n);

export class PeerRuntime {
  /**
   * @param {{ root: string, networkId?: string, displayName?: string, controller?: 'human'|'bot', autoAccept?: boolean, bootstrap?: any[], relayThrough?: any, log?: (s: string) => void, onEvent?: (e: any) => void, host?: string }} o
   */
  constructor(o) {
    this.o = o;
    this.networkId = o.networkId ?? 'public-alpha';
    this.controllerKind = o.controller === 'bot' ? 'bot' : 'human';
    this.log = o.log ?? (() => {});
    this.onEvent = o.onEvent ?? (() => {});
    this.state = 'closed';
    this.incoming = new Map(); // challengeId → { body, sig, from, receivedAt }
    this.match = null;
  }

  emit(e) { try { this.onEvent(e); } catch (err) { this.log(`event handler: ${err.message}`); } }

  async open() {
    this.store = openDataRoot(this.o.root, this.networkId);
    const { identity, created } = openIdentity(this.store, { displayName: this.o.displayName });
    this.identity = identity;
    this.createdIdentity = created;
    this.settings = readJson(this.store.path('settings.json'), { availability: 'available', joined: false });
    this.reservation = readJson(this.store.path('reservation.json'), null);
    this.launch = await this._recordLaunch();
    this.compat = compatibility();
    this.state = 'open';
    this.log(`runtime open ${this.networkId} ${fingerprintOf(identity.publicKey)} launch ${this.launch.index}`);
    await this._resumeMatches();
    return this.status();
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
    if (this.reservation) return 'joining';
    return this.settings.availability === 'busy' ? 'busy' : 'available';
  }
  _presence() { return { availability: this.availability(), controller: this.controllerKind, label: this.identity.label }; }
  _saveSettings() { writeJsonAtomic(this.store.path('settings.json'), this.settings); }
  _reserve(r) { this.reservation = r; if (r) writeJsonAtomic(this.store.path('reservation.json'), r); else writeJsonAtomic(this.store.path('reservation.json'), null); this.lobby?.announce(); this.emit({ type: 'lobby', kind: 'reservation', reservation: this._publicReservation() }); }
  _publicReservation() { const r = this.reservation; return r ? { phase: r.phase, role: r.role, challengeId: r.challengeId, matchId: r.matchId ?? null, opponent: r.opponentLabel ?? null } : null; }

  // --- lobby ----------------------------------------------------------------------------------
  async joinLobby(args = {}) {
    if (args.name) renameIdentity(this.store, this.identity, args.name);
    if (!this.lobby) {
      this.lobby = new Lobby({
        networkId: this.networkId, identity: this.identity, transportKeyPair: this._transportKeyPair(), compat: this.compat,
        presence: () => this._presence(), bootstrap: this.o.bootstrap, relayThrough: this.o.relayThrough, log: this.log,
        onPeer: (p, ev) => this._onPeer(p, ev),
        onMessage: (p, msg) => this._onMessage(p, msg).catch((e) => this.log(`message ${msg.t}: ${e.message}`)),
        onConnection: (p, conn) => this._onConnection(p, conn),
      });
      await this.lobby.start();
      if (this.match) this.lobby.join('match', this.match.matchId);
    }
    if (!this.settings.joined) { this.settings.joined = true; this._saveSettings(); }
    this._sweepTimer ??= setInterval(() => this._sweepOffers(), 2_000);
    return this.lobbyView();
  }

  async leaveLobby() {
    this.settings.joined = false;
    this._saveSettings();
    clearInterval(this._sweepTimer); this._sweepTimer = null;
    const l = this.lobby; this.lobby = null;
    await l?.stop();
    this.emit({ type: 'lobby', kind: 'transport', transport: { state: 'off' } });
    return this.lobbyView();
  }

  lobbyView() {
    return {
      joined: !!this.lobby, transport: this.lobby?.transport() ?? { state: 'off' }, me: { ...publicPlayer(this.identity), fingerprint: fingerprintOf(this.identity.publicKey), availability: this.availability(), manual: this.settings.availability, controller: this.controllerKind },
      roster: this.lobby?.roster() ?? [], incoming: [...this.incoming.values()].map((x) => ({ challengeId: x.body.challengeId, from: x.body.from, label: x.fromLabel, fingerprint: fingerprintOf(keyOfPlayer(x.body.from)), controller: x.body.controller, expiresInMs: Math.max(0, OFFER_MS - (now() - x.receivedAt)) })),
      reservation: this._publicReservation(), compat: { id: this.compat.id.slice(7, 19), profileId: this.compat.profileId, rules: this.compat.rulesImplementation.slice(7, 19) },
      match: this.match ? { matchId: this.match.matchId, status: this.match.status, seat: this.match.seat, opponent: this.match.opponent.label } : null,
    };
  }

  _onPeer(peer, ev) {
    if (ev === 'joined' && this.reservation) this._resendStart(peer);
    if ((ev === 'lost' || ev === 'replaced') && this.match && peer?.playerId === this.match.opponent.participantId && ev === 'lost') { this.match.detached(); this.lobby?.dial(peer.transportKey); this.lobby?.announce(); }
    this.emit({ type: 'lobby', kind: ev === 'transport' ? 'transport' : 'roster', roster: this.lobby?.roster() ?? [], transport: this.lobby?.transport() });
  }

  _onConnection(peer, conn) {
    if (this.match && peer.playerId === this.match.opponent.participantId) { this.match.attach(conn); this.lobby?.announce(); }
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
    for (const [id, x] of this.incoming) if (t - x.receivedAt > OFFER_MS) { this.incoming.delete(id); this.emit({ type: 'lobby', kind: 'challengeExpired', challengeId: id }); }
    const r = this.reservation;
    if (r && r.phase === 'offered' && t - (r.localAt ?? 0) > OFFER_MS) { this._reserve(null); this.emit({ type: 'lobby', kind: 'challengeExpired', challengeId: r.challengeId, outgoing: true }); }
    if (r && r.phase === 'accepted' && r.localAt && t - r.localAt > START_MS && !r.warned) { r.warned = true; this.emit({ type: 'lobby', kind: 'startSlow', challengeId: r.challengeId }); }
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
    this._reserve({ phase: 'accepted', role: 'joiner', challengeId: x.body.challengeId, challenge: x.body, matchId, feed, accept: body, acceptSig: sig, opponent: x.body.from, opponentLabel: x.fromLabel, localAt: now() });
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
        if (r?.phase === 'offered' && r.challengeId === msg.challengeId && r.opponent === peer.playerId) { this._reserve(null); this.emit({ type: 'lobby', kind: 'challengeDeclined', challengeId: msg.challengeId, reason: String(msg.reason ?? 'declined').slice(0, 24), by: peer.player.label }); }
        return;
      }
      case 'accept': return this._onAccept(peer, msg);
      case 'start': return this._onStart(peer, msg);
      case 'started': return this._onStarted(peer, msg);
      default: return;
    }
  }

  async _onAccept(peer, msg) {
    const r = this.reservation, b = msg.body;
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
    this._reserve({ ...r, phase: 'starting', matchId, localAt: now() });
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
  async _openMatch(session) {
    if (this.match && this.match.matchId === session.descriptor.matchId) return this.match;
    for (const s of ['A', 'B']) if (!verifyBody('session', session.descriptor, session.sigs?.[s], session.descriptor.players[s].publicKey)) throw new Error(`session signature of seat ${s} is missing or invalid`);
    const controller = this.controllerKind === 'bot' ? new HeuristicBot({ seat: session.seat, seed: session.manifest.randomStream.seed * 2 + (session.seat === 'A' ? 1 : 2) }) : null;
    const m = new OnlineMatch({ dir: this.store.path('matches', session.descriptor.matchId), identity: this.identity, session, controller, log: this.log, emit: (e) => this.emit(e), onComplete: (mm) => this._onComplete(mm) });
    this.match = m;
    await m.open();
    this.lobby?.join('match', m.matchId);
    const opp = this.lobby?.peers.get(m.opponent.participantId);
    if (opp) m.attach(opp.ctx.conn);
    this.lobby?.announce();
    this.emit({ type: 'match', matchId: m.matchId, kind: 'opened', seat: m.seat, opponent: m.opponent.label });
    return m;
  }

  /** Reopen an active match after a restart: signed session + journal replay. */
  async _resumeMatches() {
    const dir = this.store.path('matches');
    if (!existsSync(dir)) return;
    for (const id of readdirSync(dir)) {
      const s = readJson(join(dir, id, 'session.json'));
      const p = readJson(join(dir, id, 'progress.json'));
      if (s?.phase === 'active' && s.sigs?.A && s.sigs?.B && p?.status !== 'complete' && p?.status !== 'abandoned') {
        try { await this._openMatch(s); this.log(`resumed match ${id} as seat ${s.seat}`); } catch (e) { this.log(`could not resume ${id}: ${e.message}`); }
        break; // one active match per identity
      }
    }
  }

  _onComplete(m) {
    this._reserve(null);
    this.lobby?.leaveTopic('match', m.matchId);
    this.lobby?.announce();
  }

  _matchFor(args) {
    if (!this.match || (args.matchId && args.matchId !== this.match.matchId)) throw Object.assign(new Error('no such active match'), { code: 'NO_MATCH' });
    return this.match;
  }

  async abandon(args) {
    const m = this._matchFor(args);
    if (m.status !== 'active' && m.status !== 'disputed') throw new Error('the match is not active');
    writeJsonAtomic(join(m.dir, 'progress.json'), { status: 'abandoned', at: new Date().toISOString(), lastAgreedTick: m.history.at(-1)?.tick ?? 0 });
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
      case 'challenge': return this.challenge(args);
      case 'challenge.cancel': return this.cancelChallenge(args);
      case 'challenge.respond': return this.respond(args);
      case 'match.get': return this.match ? this.match.snapshot() : null;
      case 'match.draft': return this._matchFor(args).draft(args);
      case 'match.ready': return this._matchFor(args).ready(args);
      case 'match.choice': return this._matchFor(args).choice(args);
      case 'match.leave': return this.abandon(args);
      case 'history.list': return this.history();
      default: throw new Error(`unknown operation ${op}`);
    }
  }

  async close() {
    if (this.state === 'closed') return;
    this.state = 'closing';
    clearInterval(this._sweepTimer);
    await this.match?.close();
    await this.lobby?.stop();
    this.store?.release();
    this.state = 'closed';
  }
}
