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
    this.state = 'connecting';
    const opts = { keyPair: this.o.transportKeyPair };
    if (this.o.bootstrap) opts.bootstrap = this.o.bootstrap;
    if (this.o.relayThrough) opts.relayThrough = this.o.relayThrough;
    this.swarm = new Hyperswarm(opts);
    this.swarm.on('connection', (conn, info) => this._onConnection(conn, info));
    this.swarm.on('update', () => this._emitTransport());
    const lobby = this.join('lobby', this.o.networkId);
    this._beat = setInterval(() => this._heartbeat(), HEARTBEAT_MS);
    this._sweep = setInterval(() => this._expire(), 5_000);
    lobby.flushed().then(() => { if (this.swarm) { this.state = 'online'; this._emitTransport(); } }).catch((e) => { this.state = 'failed'; this.error = e.message; this._emitTransport(); });
  }

  /** Join (or keep) a discovery topic; topics are versioned and namespaced by kind. */
  join(kind, id, { server = true, client = true } = {}) {
    const key = `${kind}:${id}`;
    if (this.topics.has(key)) return this.topics.get(key);
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
    return { state: this.state, error: this.error ?? null, connections: this.swarm?.connections.size ?? 0, peers: this.peers.size, relay: !!this.o.relayThrough };
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
    conn.on('error', () => {});
    conn.on('close', () => this._drop(ctx, 'connection closed'));
    setTimeout(() => { if (!ctx.authed && !ctx.dropped) { this.log(`unauthenticated connection ${remoteKey.slice(0, 8)} timed out`); conn.destroy(); } }, 20_000);
  }

  _send(ctx, msg) {
    try { ctx.message.send(encodeFrame(msg, msg.t === 'start' ? MAX_START_FRAME : msg.t === 'result' || msg.t === 'resultBundle' ? MAX_RESULT_FRAME : MAX_FRAME)); return true; } catch (e) { this.log(`send ${msg.t} failed: ${e.message}`); return false; }
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
      if (msg.network !== this.o.networkId || msg.v !== LOBBY_PROTOCOL) { this.log('hello for another network/version'); ctx.conn.destroy(); return; }
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
      if (!verifyBody('hello', body, msg.sig, h.player.publicKey)) { this.log('auth signature refused'); ctx.conn.destroy(); return; }
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
      const peer = { playerId: ctx.player.participantId, player: ctx.player, fingerprint: fingerprintOf(ctx.player.publicKey), transportKey: ctx.remoteKey, compat: h.compat, compatible: h.compat === this.o.compat.id, presence: presenceOf(h.presence), lastSeen: now(), since: now(), ctx, path: pathOf(ctx) };
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
        if (next) { p.ctx = next; p.standby = p.standby.filter((c) => c !== next && !c.dropped); p.transportKey = next.remoteKey; p.path = pathOf(next); p.lastSeen = now(); this.o.onConnection?.(p, next.conn); this.o.onPeer(p, 'presence'); return; }
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
      if (t - p.lastSeen > EXPIRY_MS) { this.log(`presence of ${p.fingerprint} expired`); p.ctx.conn.destroy(); }
    }
  }

  roster() {
    const t = now();
    return [...this.peers.values()].map((p) => ({ playerId: p.playerId, label: p.player.label, fingerprint: p.fingerprint, availability: p.presence.availability, controller: p.presence.controller, role: p.presence.role, compatible: p.compatible, seenMsAgo: t - p.lastSeen, connectedMs: t - p.since, path: p.path }));
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
  return { availability: AVAIL.includes(p?.availability) ? p.availability : 'busy', controller: ['human', 'bot'].includes(p?.controller) ? p.controller : 'human', label: sanitizeName(p?.label), role: p?.role === 'archive' ? 'archive' : 'player' };
}
const publicOf = (id) => ({ participantId: id.participantId, publicKey: id.publicKey, signingKeyId: id.signingKeyId, identityKind: id.identityKind, label: id.label });

/** Direct or relayed, only when observable from the connection; otherwise unknown. */
function pathOf(ctx) {
  const raw = ctx.conn?.rawStream;
  if (ctx.conn?.relay || raw?.relay) return 'relayed';
  if (raw && typeof raw.remoteHost === 'string') return 'direct';
  return 'unknown';
}

export { crypto as _crypto };
