/**
 * Public plan agreement (Master Requirements v3 Chapter 16 "Proposed first public planning
 * fixture"; References Master Chapter 4). Transport-agnostic: it consumes verified records.
 *
 *  - Each participant publishes plans with a monotonically increasing revision; Ready freezes
 *    the sender's own plan for this phase.
 *  - Ready names the Count, phase, prior-state fingerprint and the exact pair of plan revisions
 *    and hashes reviewed. A changed opponent plan makes an earlier Ready stale; the frozen player
 *    must acknowledge the new pair (without editing their own plan).
 *  - The phase locks only when two valid Ready records name the same current pair.
 *  - A repeated message (same author and sequence) has no second effect; conflicting content under
 *    one identity is a reported protocol error. Packet arrival never grants priority.
 */
import { fingerprint } from '../rules/encoding.js';

export class PhaseAgreement {
  /** @param {{ matchId: string, count: number, phaseId: string, priorStateHash: string }} o */
  constructor(o) {
    Object.assign(this, o);
    this.plans = { A: { revision: 0, commands: [], hash: fingerprint([]) }, B: { revision: 0, commands: [], hash: fingerprint([]) } };
    this.ready = { A: null, B: null };
    this.seen = new Map(); // `${author}:${sequence}` → record fingerprint
    this.errors = [];
    this.locked = null;
  }

  /** @returns {{ ok: boolean, duplicate?: boolean, error?: string, locked?: any }} */
  receive(seat, record) {
    const key = `${record.authorId}:${record.authorSequence}`;
    const fp = fingerprint(record);
    if (this.seen.has(key)) {
      if (this.seen.get(key) === fp) return { ok: true, duplicate: true };
      return this._error(`conflicting content for ${key}`);
    }
    if (record.matchId !== this.matchId || record.count !== this.count || record.phaseId !== this.phaseId) return this._error(`record for another phase (${record.count}/${record.phaseId})`);
    if (record.priorStateHash !== this.priorStateHash) return this._error('prior state hash differs');
    if (this.locked) return this._error('phase already locked; later messages cannot revise it');
    this.seen.set(key, fp);
    const p = record.payload;
    if (record.type === 'plan') {
      if (this.ready[seat]) return this._error(`${seat} is Ready: its plan is frozen for this phase`);
      if (!(p.planRevision > this.plans[seat].revision)) return this._error(`plan revision ${p.planRevision} is not newer than ${this.plans[seat].revision}`);
      this.plans[seat] = { revision: p.planRevision, commands: p.commands, hash: fingerprint(p.commands) };
      return { ok: true };
    }
    if (record.type === 'ready') {
      const pair = p.planRevisions;
      if (pair[seat] !== this.plans[seat].revision) return this._error(`${seat}'s Ready names its own revision ${pair[seat]}, current is ${this.plans[seat].revision}`);
      this.ready[seat] = { pair: { ...pair }, hashes: { ...p.planHashes } };
      return { ok: true, locked: this._tryLock() };
    }
    return this._error(`unknown record type ${record.type}`);
  }

  /** Is a seat's Ready current (naming both present revisions and hashes)? */
  current(seat) {
    const r = this.ready[seat];
    if (!r) return false;
    return ['A', 'B'].every((s) => r.pair[s] === this.plans[s].revision && r.hashes[s] === this.plans[s].hash);
  }

  stale(seat) { return !!this.ready[seat] && !this.current(seat); }

  _tryLock() {
    if (this.current('A') && this.current('B')) {
      this.locked = { A: this.plans.A.commands, B: this.plans.B.commands, revisions: { A: this.plans.A.revision, B: this.plans.B.revision } };
    }
    return this.locked;
  }

  _error(msg) { this.errors.push(msg); return { ok: false, error: msg }; }

  /** The pair a seat would acknowledge now. */
  pair() { return { planRevisions: { A: this.plans.A.revision, B: this.plans.B.revision }, planHashes: { A: this.plans.A.hash, B: this.plans.B.hash } }; }
}
