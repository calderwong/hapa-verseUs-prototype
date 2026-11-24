/**
 * Public plan agreement (Master Requirements v3 Chapter 16 "Proposed first public planning
 * fixture"; References Master Chapter 4). Transport-agnostic: it consumes verified records.
 *
 *  - Each participant publishes plans with a monotonically increasing revision; Ready freezes
 *    the sender's own plan for this phase.
 *  - Two declared policies (the profile's `planning.agreement`; absent = the v3 fixture):
 *    · `pair_acknowledgment_v3` — Ready names the exact pair of plan revisions and hashes
 *      reviewed. A changed opponent plan makes an earlier Ready stale; the frozen player must
 *      acknowledge the new pair. The phase locks only when two Ready records name the same pair.
 *    · `own_plan_ready_v1` (human-feedback addendum 03, HF3-02) — Ready commits the sender's own
 *      exact plan revision and hash, once. The opponent may keep editing its own plan; that never
 *      revokes the commitment. The phase locks the final pair when both own plans are committed.
 *    An unknown policy is refused, never treated as either.
 *  - A repeated message (same author and sequence) has no second effect; conflicting content under
 *    one identity is a reported protocol error. Packet arrival never grants priority.
 */
import { fingerprint } from '../rules/encoding.js';

export const AGREEMENT_POLICIES = ['pair_acknowledgment_v3', 'own_plan_ready_v1'];
/** The agreement policy a profile declares; absent means the v3 pair acknowledgment (old manifests). */
export const agreementPolicy = (profile) => profile?.planning?.agreement ?? 'pair_acknowledgment_v3';

export class PhaseAgreement {
  /** @param {{ matchId: string, count: number, phaseId: string, priorStateHash: string, policy?: string }} o */
  constructor(o) {
    Object.assign(this, o);
    this.policy = o.policy ?? 'pair_acknowledgment_v3';
    if (!AGREEMENT_POLICIES.includes(this.policy)) throw new Error(`unknown agreement policy "${this.policy}" (supported: ${AGREEMENT_POLICIES.join(', ')})`);
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
    if (record.type === 'ready' && this.policy === 'own_plan_ready_v1') {
      if (this.ready[seat]) return this._error(`${seat} already committed its plan for this phase`);
      if (p.planRevision !== this.plans[seat].revision || p.planHash !== this.plans[seat].hash) return this._error(`${seat}'s Ready names its own revision ${p.planRevision}, current is ${this.plans[seat].revision}`);
      this.ready[seat] = { revision: p.planRevision, hash: p.planHash };
      return { ok: true, locked: this._tryLock() };
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
    if (this.policy === 'own_plan_ready_v1') return r.revision === this.plans[seat].revision && r.hash === this.plans[seat].hash;
    return ['A', 'B'].every((s) => r.pair[s] === this.plans[s].revision && r.hashes[s] === this.plans[s].hash);
  }

  stale(seat) { return !!this.ready[seat] && !this.current(seat); }

  _tryLock() {
    if (this.current('A') && this.current('B')) {
      this.locked = { A: this.plans.A.commands, B: this.plans.B.commands, revisions: { A: this.plans.A.revision, B: this.plans.B.revision }, hashes: { A: this.plans.A.hash, B: this.plans.B.hash } };
    }
    return this.locked;
  }

  _error(msg) { this.errors.push(msg); return { ok: false, error: msg }; }

  /** The Ready payload a seat sends now under the policy: its own plan, or the pair it acknowledges. */
  readyPayload(seat) {
    return this.policy === 'own_plan_ready_v1' ? { planRevision: this.plans[seat].revision, planHash: this.plans[seat].hash } : this.pair();
  }

  /** The pair a seat would acknowledge now. */
  pair() { return { planRevisions: { A: this.plans.A.revision, B: this.plans.B.revision }, planHashes: { A: this.plans.A.hash, B: this.plans.B.hash } }; }
}
