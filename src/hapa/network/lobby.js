/**
 * Discovery, authenticated connections and presence (p2p-matchmaking-v1 §6).
 *
 * One Hyperswarm per process. Every connection opens one control channel
 * (`hapa-versus/control/v1`) on the connection's Protomux, the same mux Hypercore replication uses.
 * A peer becomes part of the roster only after HELLO/AUTH: each side signs the other's fresh nonce
 * together with both Noise transport keys, so a forwarded or replayed announcement cannot pass.
 * A name, feed key or advertised role is never authentication.
 *
 * Presence is ephemeral: a heartbeat every 15 s, expiry 45 s after the last fresh evidence, timed
 * with this process's monotonic clock (remote wall-clock fields are hints only).
 */
import Hyperswarm from 'hyperswarm';
import Protomux from 'protomux';
import c from 'compact-encoding';
import b4a from 'b4a';
import crypto from 'hypercore-crypto';
import { createHash } from 'node:crypto';
import { signBody, verifyBody, encodeFrame, decodeFrame, randomHex, keyOfPlayer, MAX_FRAME, MAX_START_FRAME, MAX_RESULT_FRAME } from './control.js';
import { LOBBY_PROTOCOL } from './compat.js';
import { sanitizeName, fingerprintOf } from './identity.js';

export const HEARTBEAT_MS = 15_000;
export const EXPIRY_MS = 45_000;
const CHANNEL = 'hapa-versus/control/v1';
const now = () => Number(process.hrtime.bigint() / 1_000_000n);

export const topicOf = (kind, id) => createHash('sha256').update(`hapa-versus/${kind}/v1/${id}`).digest();

export class Lobby {
  /**
   * @param {{ networkId: string, identity: any, transportKeyPair: { publicKey: Buffer, secretKey: Buffer }, compat: any, presence: () => any, onPeer: (p: any, event: string) => void, onMessage: (p: any, msg: any) => void, onConnection: (p: any, conn: any) => void, bootstrap?: any[], relayThrough?: any, log?: (s: string) => void }} o
   */
  constructor(o) {
    this.o = o;
    this.log = o.log ?? (() => {});
    this.peers = new Map(); // playerId → authenticated peer
    this.pending = new Set(); // connections not yet authenticated
    this.state = 'off';
    this.topics = new Map();
  }

  async start() {
    if (this.swarm) return;
    // no eligible discovery provider (N20-02): stay off and say why; never fall back to library defaults
    if (Array.isArray(this.o.bootstrap) && this.o.bootstrap.length === 0) { this.state = 'failed'; this.error = this.o.noRoute ?? 'no eligible discovery provider is adopted'; this._emitTransport(); return; }
    this.state = 'connecting';
    const opts = { keyPair: this.o.transportKeyPair };
    if (this.o.bootstrap?.length) opts.bootstrap = this.o.bootstrap;
    // relay candidates (N19-03 → N22-03): read from the current policy at each use (an expired or
    // retired relay stops being handed out), with per-relay evidence kept by id. `forceRelay` relays every
    // connection (for proving the relay path only); `dht` lets a qualification fixture supply its own
    // DHT instance (network-namespace fixture), never set by the app.
    this.relayState = new Map();
    if (this.o.dht) opts.dht = this.o.dht;
    if (this._relayList().length || typeof this.o.relays === 'function') opts.relayThrough = (force) => (force || this.o.forceRelay ? this._nextRelay() : null);
    this.swarm = new Hyperswarm(opts);
    this.swarm.on('connection', (conn, info) => this._onConnection(conn, info));
    this.swarm.on('update', () => this._emitTransport());
    const lobby = this.join('lobby', this.o.networkId);
    this._beat = setInterval(() => this._heartbeat(), HEARTBEAT_MS);
    this._sweep = setInterval(() => this._expire(), 5_000);
    lobby.flushed().then(() => { if (this.swarm) { this.state = 'online'; this._emitTransport(); } }).catch((e) => { this.state = 'failed'; this.error = e.message; this._emitTransport(); });
  }

  /** The relays eligible now (policy re-evaluated by the runtime at each call), each with its kept state. */
  _relayList() {
    const list = (typeof this.o.relays === 'function' ? this.o.relays() : this.o.relays ?? []).filter((r) => /^[0-9a-f]{64}$/.test(r?.key ?? '')).slice(0, 16);
    return list.map((r) => {
      let st = this.relayState?.get(r.id ?? r.key);
      if (!st) { st = { handed: 0, awaiting: 0, confirmed: 0, lastConfirmed: 0, suspected: 0, cooldownUntil: 0, handouts: [] }; this.relayState?.set(r.id ?? r.key, st); }
      return Object.assign(st, { id: r.id ?? r.key.slice(0, 12), key: r.key, endpoint: r.endpoint ?? null, label: r.label ?? r.id, buf: st.buf ?? b4a.from(r.key, 'hex') });
    });
  }
  get relays() { return this._relayList(); }

  /**
   * The next relay candidate (Review 20 / N22-03; Hapa connectivity v0.1 §6, HC-09).
   *
   * Hyperswarm's relay callback carries no peer or attempt identity, so a handout cannot be tied to the
   * connection it was for. Evidence is therefore kept conservatively, per relay:
   *  - a handout is *unconfirmed* (`awaiting`) — never by itself a failure, whatever other consumers do;
   *  - *confirmed* only when a connection is observed arriving from that relay's published endpoint;
   *  - *suspected unavailable* only after 3 or more handouts spread over at least 30 s with no
   *    confirmation in that window; then it cools down (30 s doubling to 10 min) and confirmation clears it.
   * Unconfirmed handouts rotate across eligible relays so concurrent consumers spread over them; a
   * relay confirmed in the last 10 min (and not suspected) is preferred. When every relay is cooling
   * down, no relay is handed out (`null`): Hyperswarm then makes its ordinary direct attempt and asks
   * again later — exhaustion is reported, not hidden by retrying a suspected relay at once.
   */
  _nextRelay() {
    const t = now(), list = this._relayList();
    if (!list.length) return null;
    for (const r of list) {
      r.handouts = r.handouts.filter((h) => t - h < 120_000);
      const window = r.handouts.filter((h) => h > r.lastConfirmed);
      if (window.length >= 3 && t - window[0] >= 30_000 && !(r.cooldownUntil > t)) { r.suspected++; r.cooldownUntil = t + Math.min(600_000, 30_000 * 2 ** (r.suspected - 1)); r.handouts = []; }
    }
    const eligible = list.filter((r) => !(r.cooldownUntil > t));
    this.relaysExhausted = !eligible.length;
    if (!eligible.length) return null;
    const preferred = eligible.filter((r) => r.lastConfirmed && t - r.lastConfirmed < 600_000 && !r.suspected).sort((a, b) => b.lastConfirmed - a.lastConfirmed)[0];
    const pick = preferred ?? eligible[(this._relayTurn = ((this._relayTurn ?? -1) + 1) % eligible.length)];
    pick.handed++; pick.awaiting = pick.handouts.length + 1; pick.handouts.push(t); pick.lastHanded = t;
    return pick.buf;
  }

  /** Observed path of a connection; a match against a relay's published endpoint marks that relay working. */
  _path(ctx) {
    const eps = (this.relays ?? []).filter((r) => r.endpoint);
    const path = pathOf(ctx, eps.map((r) => r.endpoint));
    if (path === 'relayed') {
      const raw = ctx.conn?.rawStream, ep = `${raw?.remoteHost}:${raw?.remotePort}`;
      const r = eps.find((x) => x.endpoint === ep || (x.endpoint.startsWith('*:') && ep.endsWith(x.endpoint.slice(1))));
      if (r) { r.confirmed++; r.lastConfirmed = now(); r.suspected = 0; r.cooldownUntil = 0; r.handouts = []; r.awaiting = 0; ctx.relayId = r.id; }
    }
    return path;
  }

  /** Join (or keep) a discovery topic; topics are versioned and namespaced by kind. */
  join(kind, id, { server = true, client = true } = {}) {
    const key = `${kind}:${id}`;
    if (this.topics.has(key)) return this.topics.get(key);
    if (!this.swarm) return { flushed: async () => {}, destroy: async () => {} };
    const d = this.swarm.join(topicOf(kind, id), { server, client });
    this.topics.set(key, d);
    return d;
  }

  async leaveTopic(kind, id) {
    const key = `${kind}:${id}`;
    if (!this.topics.has(key)) return;
    this.topics.delete(key);
    await this.swarm?.leave(topicOf(kind, id)).catch(() => {});
  }

  /** Dial a known transport key directly (invitations, an opponent we lost). */
  dial(transportKeyHex) { if (this.swarm && /^[0-9a-f]{64}$/.test(transportKeyHex)) this.swarm.joinPeer(b4a.from(transportKeyHex, 'hex')); }

  transport() {
    return { state: this.state, error: this.error ?? null, connections: this.swarm?.connections.size ?? 0, peers: this.peers.size, relay: !!this.relays?.length, relays: (this.relayState ? this._relayList() : []).map((r) => ({ id: r.id, label: r.label, handed: r.handed, unconfirmed: r.handouts.length, confirmed: r.confirmed, observed: !!r.lastConfirmed, suspected: r.suspected, coolingMs: Math.max(0, r.cooldownUntil - now()) })), relaysExhausted: !!this.relaysExhausted, dht: this.swarm?.dht ? { bootstrapped: !!this.swarm.dht.bootstrapped, firewalled: this.swarm.dht.firewalled ?? null, randomized: this.swarm.dht.randomized ?? null } : null };
  }

  _emitTransport() { this.o.onPeer(null, 'transport'); }

  _onConnection(conn, info) {
    const remoteKey = b4a.toString(conn.remotePublicKey, 'hex');
    const mux = Protomux.from(conn);
    const ctx = { conn, mux, remoteKey, nonce: randomHex(32), authed: false, player: null, lastSeen: now(), info };
    this.pending.add(ctx);
    const channel = mux.createChannel({
      protocol: CHANNEL,
      onopen: () => this._send(ctx, { t: 'hello', v: LOBBY_PROTOCOL, network: this.o.networkId, player: publicOf(this.o.identity), transportKey: b4a.toString(this.swarm.keyPair.publicKey, 'hex'), nonce: ctx.nonce, compat: this.o.compat.id, presence: this.o.presence() }),
      onclose: () => this._drop(ctx, 'channel closed'),
    });
    if (!channel) { conn.destroy(); return; }
    ctx.channel = channel;
    ctx.message = channel.addMessage({ encoding: c.raw, onmessage: (buf) => this._onFrame(ctx, buf) });
    channel.open();
    conn.on('error', (e) => { ctx.lastError = e?.code ?? e?.message ?? 'error'; });
    conn.on('close', () => this._drop(ctx, `connection closed${ctx.lastError ? ` (${ctx.lastError})` : ''}`));
    setTimeout(() => { if (!ctx.authed && !ctx.dropped) { this.log(`unauthenticated connection ${remoteKey.slice(0, 8)} timed out`); conn.destroy(); } }, 20_000);
  }

  /** Bounded counters for diagnostics: incompatible peers, failed authentication (no addresses kept). */
  _note(kind, detail) { const n = (this.notes ??= {})[kind] ??= { count: 0, last: null }; n.count++; n.last = { detail, at: new Date().toISOString() }; }

  _send(ctx, msg) {
    try { ctx.message.send(encodeFrame(msg, msg.t === 'start' ? MAX_START_FRAME : msg.t === 'result' || msg.t === 'resultBundle' ? MAX_RESULT_FRAME : MAX_FRAME)); return true; } catch (e) { this.log(`send ${msg.t} failed: ${e.message}`); return false; }
  }

  /** Resolve when a given player is authenticated (or reject after `ms`). */
  waitForPlayer(playerId, ms = 30_000, signal = null, onAuthenticating = null) {
    if (this.peers.has(playerId)) return Promise.resolve(this.peers.get(playerId));
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      let said = false;
      const iv = setInterval(() => {
        const p = this.peers.get(playerId);
        if (p) { clearInterval(iv); resolve(p); return; }
        if (signal?.aborted) { clearInterval(iv); reject(Object.assign(new Error('cancelled'), { code: 'CANCELLED' })); return; }
        // a connection is open and its HELLO/AUTH is under way (we cannot know whose until it authenticates)
        if (!said && this.pending.size && onAuthenticating) { said = true; onAuthenticating(); }
        if (Date.now() - t0 > ms || !this.swarm) {
          clearInterval(iv);
          const why = this.state !== 'online' ? 'discovery has not reached the network yet (it may be blocked here)' : said ? 'a connection opened but that player did not authenticate' : 'no connection to that player opened: they may be offline, or one of the networks blocks the peer transport';
          reject(Object.assign(new Error(`could not reach that player: ${why}`), { code: 'UNREACHABLE' }));
        }
      }, 250);
    });
  }

  /** Send a control message to an authenticated player (false when not connected). */
  send(playerId, msg) {
    const p = this.peers.get(playerId);
    return p ? this._send(p.ctx, msg) : false;
  }

  _onFrame(ctx, buf) {
    let msg;
    try { msg = decodeFrame(buf, ctx.authed ? MAX_RESULT_FRAME : MAX_FRAME); } catch (e) { this.log(`dropped frame: ${e.message}`); ctx.bad = (ctx.bad ?? 0) + 1; if (ctx.bad > 8) ctx.conn.destroy(); return; }
    if (!ctx.authed) return this._handshake(ctx, msg);
    ctx.lastSeen = now();
    const peer = this.peers.get(ctx.player.participantId);
    if (!peer || peer.ctx !== ctx) return;
    if (msg.t === 'presence') { peer.presence = presenceOf(msg.presence); peer.lastSeen = ctx.lastSeen; this.o.onPeer(peer, 'presence'); return; }
    if (msg.t === 'bye') { peer.presence = { ...peer.presence, availability: 'offline' }; this.o.onPeer(peer, 'left'); return; }
    this.o.onMessage(peer, msg);
  }

  _handshake(ctx, msg) {
    if (msg.t === 'hello') {
      const pk = keyOfPlayer(msg.player?.participantId);
      if (msg.network !== this.o.networkId || msg.v !== LOBBY_PROTOCOL) { this.log('hello for another network/version'); this._note('incompatible', msg.network !== this.o.networkId ? 'another network' : `lobby protocol ${String(msg.v).slice(0, 40)}`); ctx.conn.destroy(); return; }
      if (!pk || msg.player.publicKey !== pk || msg.player.signingKeyId !== `ed25519:${pk}`) { ctx.conn.destroy(); return; }
      if (msg.transportKey !== ctx.remoteKey) { this.log('hello transport key differs from the Noise key'); ctx.conn.destroy(); return; }
      if (typeof msg.nonce !== 'string' || !/^[0-9a-f]{64}$/.test(msg.nonce)) { ctx.conn.destroy(); return; }
      ctx.hello = msg;
      const body = { network: this.o.networkId, signer: this.o.identity.participantId, signerTransport: b4a.toString(this.swarm.keyPair.publicKey, 'hex'), peerTransport: ctx.remoteKey, peerNonce: msg.nonce };
      this._send(ctx, { t: 'auth', sig: signBody('hello', body, this.o.identity) });
      if (ctx.pendingAuth) this._handshake(ctx, ctx.pendingAuth);
      return;
    }
    if (msg.t === 'auth') {
      if (!ctx.hello) { ctx.pendingAuth = msg; return; }
      const h = ctx.hello;
      const body = { network: this.o.networkId, signer: h.player.participantId, signerTransport: ctx.remoteKey, peerTransport: b4a.toString(this.swarm.keyPair.publicKey, 'hex'), peerNonce: ctx.nonce };
      if (!verifyBody('hello', body, msg.sig, h.player.publicKey)) { this.log('auth signature refused'); this._note('authFailed', 'signature refused'); ctx.conn.destroy(); return; }
      if (h.player.participantId === this.o.identity.participantId) { ctx.conn.destroy(); return; } // our own key elsewhere
      ctx.authed = true;
      ctx.player = { participantId: h.player.participantId, publicKey: h.player.publicKey, signingKeyId: h.player.signingKeyId, identityKind: h.player.identityKind, label: sanitizeName(h.player.label) || 'Player' };
      this.pending.delete(ctx);
      const prev = this.peers.get(ctx.player.participantId);
      if (prev && prev.ctx !== ctx && !prev.ctx.dropped) {
        // Hyperswarm may briefly deliver a second connection to the same peer and then close one of
        // them itself; keep the connection already in use and hold the other in reserve
        (prev.standby ??= []).push(ctx);
        return;
      }
      const peer = { playerId: ctx.player.participantId, player: ctx.player, fingerprint: fingerprintOf(ctx.player.publicKey), transportKey: ctx.remoteKey, compat: h.compat, compatible: h.compat === this.o.compat.id, presence: presenceOf(h.presence), lastSeen: now(), since: now(), ctx, path: this._path(ctx), endpoint: null };
      this.peers.set(peer.playerId, peer);
      this.o.onPeer(peer, 'joined');
      this.o.onConnection?.(peer, ctx.conn);
    }
  }

  _drop(ctx, why) {
    if (ctx.dropped) return;
    ctx.dropped = true;
    this.pending.delete(ctx);
    if (ctx.player) {
      const p = this.peers.get(ctx.player.participantId);
      if (p && p.ctx === ctx) {
        const next = (p.standby ?? []).find((c) => !c.dropped);
        if (next) { p.ctx = next; p.standby = p.standby.filter((c) => c !== next && !c.dropped); p.transportKey = next.remoteKey; p.path = this._path(next); p.lastSeen = now(); this.o.onConnection?.(p, next.conn); this.o.onPeer(p, 'presence'); return; }
        // why an authenticated player went away, for the log and the connection report (no addresses)
        this.log(`player ${p.fingerprint} lost: ${why} after ${Math.round((now() - p.since) / 1000)} s (path ${p.path})`);
        this._note('dropped', `${why} after ${Math.round((now() - p.since) / 1000)} s`);
        this.peers.delete(ctx.player.participantId); this.o.onPeer(p, 'lost');
      } else if (p?.standby) p.standby = p.standby.filter((c) => c !== ctx);
    }
  }

  /** Broadcast our presence (manual intent or derived state) to every authenticated peer. */
  _heartbeat() { const presence = this.o.presence(); for (const p of this.peers.values()) this._send(p.ctx, { t: 'presence', presence }); }
  announce() { this._heartbeat(); }

  _expire() {
    const t = now();
    for (const p of [...this.peers.values()]) {
      if (t - p.lastSeen > EXPIRY_MS) { this.log(`presence of ${p.fingerprint} expired`); p.ctx.expired = true; p.ctx.lastError = 'presence expired'; p.ctx.conn.destroy(); }
    }
  }

  roster() {
    const t = now();
    return [...this.peers.values()].map((p) => ({ playerId: p.playerId, label: p.player.label, fingerprint: p.fingerprint, availability: p.presence.availability, controller: p.presence.controller, role: p.presence.role, table: p.presence.table, compatible: p.compatible, seenMsAgo: t - p.lastSeen, connectedMs: t - p.since, path: p.path, relay: p.ctx.relayId ?? null }));
  }

  async stop() {
    clearInterval(this._beat);
    clearInterval(this._sweep);
    for (const p of this.peers.values()) this._send(p.ctx, { t: 'bye' });
    const s = this.swarm;
    this.swarm = null;
    this.state = 'off';
    if (s) await s.destroy().catch(() => {});
    this.peers.clear();
  }
}

const AVAIL = ['available', 'busy', 'joining', 'in-match', 'reconnecting'];
function presenceOf(p) {
  return { availability: AVAIL.includes(p?.availability) ? p.availability : 'busy', controller: ['human', 'bot'].includes(p?.controller) ? p.controller : 'human', label: sanitizeName(p?.label), role: p?.role === 'archive' ? 'archive' : 'player', table: typeof p?.table === 'string' && /^[0-9a-f]{32}$/.test(p.table) ? p.table : null };
}
const publicOf = (id) => ({ participantId: id.participantId, publicKey: id.publicKey, signingKeyId: id.signingKeyId, identityKind: id.identityKind, label: id.label });

/**
 * Direct or relayed, only when observable; otherwise unknown. The connection's UDP remote endpoint
 * is the one thing visible here: when it is the configured relay's own endpoint (operators publish
 * it beside the relay key), traffic is going through the relay. A visible host alone proves nothing.
 */
function pathOf(ctx, relayEndpoints = []) {
  const raw = ctx.conn?.rawStream;
  const ep = raw && typeof raw.remoteHost === 'string' ? `${raw.remoteHost}:${raw.remotePort}` : null;
  if (ep && relayEndpoints.some((r) => r === ep || (r.startsWith('*:') && ep.endsWith(r.slice(1))))) return 'relayed';
  return 'unknown';
}
export { pathOf };

export { crypto as _crypto };
