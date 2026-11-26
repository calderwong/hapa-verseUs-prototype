/**
 * Durable, rebuildable public result index (p2p-matchmaking-v1 §10 "Persistence and distribution").
 *
 * Bundles are stored by result key (network/match); the projection — per-player totals by bucket —
 * is derived only from verified evidence and can be rebuilt from the stored bundles at any time.
 *  - The same commitment again (a duplicate or an equivalent repackaging) adds nothing.
 *  - An invalid or forged submission is quarantined and never touches a verified result.
 *  - A different, independently verified commitment under the same jointly signed session (the same
 *    participants and descriptor) is a real dispute: both are kept and that result leaves the default
 *    totals until resolved. Evidence signed by other participants that merely reuses the match id is
 *    a separate record about those participants; it can never dispute or erase someone else's win.
 */
import { mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { readJson, writeJsonAtomic } from './store.js';
import { verifyBundle, bucketOf } from './results.js';

const fileKey = (key) => createHash('sha256').update(key).digest('hex').slice(0, 32);

export class ResultIndex {
  /** @param {string} dir */
  constructor(dir) {
    this.dir = dir;
    mkdirSync(join(dir, 'bundles'), { recursive: true, mode: 0o700 });
    mkdirSync(join(dir, 'quarantine'), { recursive: true, mode: 0o700 });
    this.rebuild();
  }

  /** Recompute the projection from stored, re-verified bundles (verification is the source of truth). */
  rebuild() {
    this.entries = new Map(); // key → { verified: [v], disputed: bool }
    for (const f of readdirSync(join(this.dir, 'bundles'))) {
      if (!f.endsWith('.json')) continue;
      const stored = readJson(join(this.dir, 'bundles', f));
      for (const b of stored?.bundles ?? []) { const v = verifyBundle(b); if (v.ok) this._add(v); }
    }
  }

  /** Entries are per result key *and* agreed session: only the same signers can dispute a result. */
  _add(v) {
    const id = `${v.key}#${v.descriptorHash}`;
    const e = this.entries.get(id) ?? { key: v.key, verified: [] };
    if (!e.verified.some((x) => x.commitment === v.commitment)) e.verified.push(v);
    e.disputed = e.verified.length > 1;
    this.entries.set(id, e);
    return e;
  }

  /** Is this exact commitment already known? */
  has(key, commitment) { for (const e of this.entries.values()) if (e.key === key && e.verified.some((x) => x.commitment === commitment)) return true; return false; }

  /**
   * Admit a bundle. Returns `{ status: 'added'|'duplicate'|'disputed'|'invalid'|'unsupported'|'unfinished', key?, commitment?, reason? }`.
   * @param {any} bundle @param {{ source?: string }} [o]
   */
  submit(bundle, o = {}) {
    const v = verifyBundle(bundle);
    if (!v.ok) {
      const q = join(this.dir, 'quarantine', `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.json`);
      try { writeJsonAtomic(q, { reason: v.reason, status: v.status, source: o.source ?? null, matchId: String(bundle?.matchId ?? '').slice(0, 80) }); } catch { /* best effort */ }
      return { status: v.status, reason: v.reason };
    }
    if (this.has(v.key, v.commitment)) return { status: 'duplicate', key: v.key, commitment: v.commitment };
    const file = join(this.dir, 'bundles', `${fileKey(v.key)}.json`);
    const stored = readJson(file, { key: v.key, bundles: [] });
    stored.bundles.push(bundle);
    writeJsonAtomic(file, stored);
    const e = this._add(v);
    return { status: e.disputed ? 'disputed' : 'added', key: v.key, commitment: v.commitment };
  }

  /** Stored bundles for a key (to serve to observers). */
  bundles(key) { return readJson(join(this.dir, 'bundles', `${fileKey(key)}.json`), { bundles: [] }).bundles; }

  /** Verified result summaries, optionally for one player, newest key order (paginated). */
  list({ playerId = null, offset = 0, limit = 20 } = {}) {
    const out = [];
    for (const e of this.entries.values()) {
      const v = e.verified[0], key = e.key;
      if (playerId && v.players.A.participantId !== playerId && v.players.B.participantId !== playerId) continue;
      out.push({ key, session: v.descriptorHash, matchId: v.matchId, commitment: v.commitment, disputed: !!e.disputed, outcome: v.outcome, players: v.players, controllers: v.controllers, bucket: bucketOf(v.controllers), ticks: v.ticks });
    }
    out.sort((a, b) => a.key.localeCompare(b.key) || a.session.localeCompare(b.session));
    return { total: out.length, items: out.slice(offset, offset + Math.min(limit, 50)) };
  }

  /** A player's verified record by bucket: wins, losses, draws, completed, win rate over decisive games. */
  stats(playerId) {
    const buckets = {};
    let disputed = 0;
    for (const e of this.entries.values()) {
      const v = e.verified[0];
      const seat = v.players.A.participantId === playerId ? 'A' : v.players.B.participantId === playerId ? 'B' : null;
      if (!seat) continue;
      if (e.disputed) { disputed++; continue; }
      const b = buckets[bucketOf(v.controllers)] ??= { wins: 0, losses: 0, draws: 0 };
      if (v.outcome.result === 'draw') b.draws++;
      else if (v.outcome.result === 'win') { if (v.outcome.winner === seat) b.wins++; else b.losses++; }
    }
    for (const b of Object.values(buckets)) { b.completed = b.wins + b.losses + b.draws; b.decisive = b.wins + b.losses; b.winRate = b.decisive ? b.wins / b.decisive : null; }
    return { playerId, buckets, disputed };
  }
}

export const hasIndex = (dir) => existsSync(join(dir, 'bundles'));
