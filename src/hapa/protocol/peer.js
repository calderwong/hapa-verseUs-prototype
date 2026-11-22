/**
 * One participant's application for a peer-verified match (Master Requirements v3 Chapters 16–17).
 *
 * Each peer writes its own Hypercore log of signed records (plan, ready, choice, receipt), reads and
 * retains the opponent's log, validates every record and calculates every outcome itself. There is
 * no referee: both peers run the same rules from the same manifest and compare signed state
 * receipts after each Tick. Duplicate delivery is a no-op; a fingerprint mismatch stops the match
 * as an explained protocol error, never as an invented result.
 */
import Hypercore from 'hypercore';
import { createContext } from '../rules/context.js';
import { initializeMatch, stateFingerprint } from '../rules/state.js';
import { beginCount, validatePlan, resolveTick } from '../rules/match.js';
import { fingerprint } from '../rules/encoding.js';
import { PhaseAgreement } from './agreement.js';
import { signRecord, verifyRecord } from './messages.js';

export class Peer {
  /**
   * @param {{ seat: 'A'|'B', identity: any, opponent: any, storage: string, manifest: any, controller: any, log?: (s: string) => void }} o
   */
  constructor(o) {
    this.seat = o.seat;
    this.other = o.seat === 'A' ? 'B' : 'A';
    this.identity = o.identity;
    this.opponent = o.opponent; // public identity
    this.storage = o.storage;
    this.manifest = o.manifest;
    this.controller = o.controller;
    this.log = o.log ?? (() => {});
    this.sequence = 0;
    this.inbox = []; // verified remote bodies
    this.waiters = [];
    this.seen = new Set();
    this.receipts = [];
    this.errors = [];
  }

  async open() {
    this.own = new Hypercore(`${this.storage}/own`, { valueEncoding: 'json' });
    await this.own.ready();
    this.ctx = createContext(this.manifest);
    this.state = initializeMatch(this.manifest);
    this.manifestFingerprint = fingerprint(this.manifest);
    return this.own.key.toString('hex');
  }

  /** Attach the opponent's log (read-only replica) and start reading it live. */
  async attachRemote(keyHex) {
    this.remote = new Hypercore(`${this.storage}/remote`, Buffer.from(keyHex, 'hex'), { valueEncoding: 'json' });
    await this.remote.ready();
    this._read();
  }

  /** A replication stream carrying both logs (pipe it to the other peer's stream). */
  replicate(isInitiator) {
    const s = this.own.replicate(isInitiator, { keepAlive: true });
    this.remote.replicate(s);
    return s;
  }

  async _read() {
    let i = 0;
    for (;;) {
      if (this.closed) return;
      if (i >= this.remote.length) {
        try { await this.remote.update({ wait: true }); } catch { if (this.closed) return; }
        if (i >= this.remote.length) { await new Promise((r) => setTimeout(r, 15)); continue; }
      }
      let rec;
      try { rec = await this.remote.get(i, { timeout: 0 }); } catch (e) { if (this.closed) return; await new Promise((r) => setTimeout(r, 15)); continue; }
      i++;
      this.deliver(rec);
    }
  }

  /** Verify and queue one remote record (also used to test duplicate delivery). */
  deliver(rec) {
    let body;
    try { body = verifyRecord(rec, this.opponent); } catch (e) { this.errors.push(`rejected record: ${e.message}`); return false; }
    const key = `${body.authorId}:${body.authorSequence}`;
    if (this.seen.has(key)) return false; // duplicate delivery: no second effect
    this.seen.add(key);
    this.inbox.push(body);
    for (const w of [...this.waiters]) w();
    return true;
  }

  async _publish(type, count, phaseId, payload) {
    const rec = signRecord(this.identity, { type, matchId: this.manifest.matchId, authorSequence: ++this.sequence, count, phaseId, priorStateHash: this.priorHash, payload });
    await this.own.append(rec);
    return rec.body;
  }

  /** Wait for a remote record matching a predicate (consumes it). */
  _take(pred, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      const check = () => {
        const i = this.inbox.findIndex(pred);
        if (i >= 0) { this.waiters = this.waiters.filter((w) => w !== check); resolve(this.inbox.splice(i, 1)[0]); return true; }
        if (Date.now() - t0 > timeoutMs) { this.waiters = this.waiters.filter((w) => w !== check); reject(new Error('timed out waiting for the opponent (the match is paused, not conceded)')); return true; }
        return false;
      };
      if (!check()) { this.waiters.push(check); const iv = setInterval(() => { if (check()) clearInterval(iv); }, 50); }
    });
  }

  /** Play one Tick: plan, agree, resolve with public choices, exchange receipts. */
  async playTick() {
    const { state, ctx } = this;
    beginCount(state, ctx);
    const count = state.tick;
    this.priorHash = stateFingerprint(state);
    const phaseId = 'plan';
    const agreement = new PhaseAgreement({ matchId: this.manifest.matchId, count, phaseId, priorStateHash: this.priorHash });
    const mine = this.controller.plan(state, ctx);
    const planBody = await this._publish('plan', count, phaseId, { planRevision: 1, commands: mine });
    agreement.receive(this.seat, planBody);
    const theirs = await this._take((b) => b.count === count && b.type === 'plan');
    const r = agreement.receive(this.other, theirs);
    if (!r.ok) throw new Error(`protocol: ${r.error}`);
    const readyBody = await this._publish('ready', count, phaseId, agreement.pair());
    agreement.receive(this.seat, readyBody);
    const theirReady = await this._take((b) => b.count === count && b.type === 'ready');
    const rr = agreement.receive(this.other, theirReady);
    if (!rr.ok || !agreement.locked) throw new Error(`protocol: no matching Ready pair (${rr.error ?? 'stale'})`);
    const plans = {};
    for (const s of ['A', 'B']) plans[s] = validatePlan(state, ctx, s, agreement.locked[s]).accepted;
    const gen = resolveTick(state, ctx, plans);
    let step = gen.next();
    while (!step.done) {
      const req = step.value;
      let answer;
      if (req.seat === this.seat) {
        answer = this.controller.choose(req, state, ctx) ?? { pass: true };
        await this._publish('choice', count, req.choiceId, { choiceId: req.choiceId, answer });
      } else {
        const c = await this._take((b) => b.count === count && b.type === 'choice' && b.payload.choiceId === req.choiceId);
        answer = c.payload.answer;
      }
      step = gen.next(answer);
    }
    const hash = stateFingerprint(state);
    await this._publish('receipt', count, 'receipt', { stateHash: hash, outcome: state.outcome ?? null });
    const theirReceipt = await this._take((b) => b.count === count && b.type === 'receipt');
    const agreed = theirReceipt.payload.stateHash === hash;
    this.receipts.push({ count, hash, agreed });
    if (!agreed) throw new Error(`protocol: Tick ${count} receipts differ (${hash} vs ${theirReceipt.payload.stateHash})`);
    return { count, hash, outcome: state.outcome };
  }

  async play({ tickBudget = 200 } = {}) {
    while (!this.state.outcome && this.state.tick < tickBudget) {
      const r = await this.playTick();
      this.log(`${this.seat} Tick ${r.count} agreed ${r.hash.slice(7, 19)}`);
    }
    // a closing handshake: neither peer leaves before the other has its final receipt
    await this._publish('closing', this.state.tick, 'closing', { finalHash: stateFingerprint(this.state) });
    await this._take((b) => b.type === 'closing').catch(() => {});
    await new Promise((r) => setTimeout(r, 300));
    return this.state.outcome ?? { result: 'unfinished', reason: 'tick_budget', tick: this.state.tick };
  }

  async close() {
    this.closed = true;
    for (const w of this.waiters) w();
    await this.remote?.close().catch(() => {});
    await this.own?.close().catch(() => {});
  }
}
