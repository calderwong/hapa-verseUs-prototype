/**
 * One online match, as one player's authority (p2p-matchmaking-v1 §8–9).
 *
 * Each peer owns one Hypercore of signed records and reads the opponent's. The own feed is also
 * the durable command journal: a Ready, a choice or a receipt is appended (and therefore committed)
 * before it is reported to the interface, and on reopen the loop consumes the recorded own records
 * before it asks the player anything. Restart recovery is therefore replay of signed history — no
 * second Ready, no re-asked choice, no re-minted resource.
 *
 * The renderer never resolves authority: it receives the locked pair, the choices and the agreed
 * receipt hash and replays them for presentation.
 */
import Hypercore from 'hypercore';
import b4a from 'b4a';
import { join } from 'node:path';
import { createContext } from '../rules/context.js';
import { initializeMatch, stateFingerprint, other } from '../rules/state.js';
import { beginCount, validatePlan, resolveTick } from '../rules/match.js';
import { fingerprint } from '../rules/encoding.js';
import { PhaseAgreement, agreementPolicy } from '../protocol/agreement.js';
import { signRecord } from '../protocol/messages.js';
import { admitRecord } from '../protocol/admission.js';
import { writeJsonAtomic } from './store.js';

const DRAFT_COALESCE_MS = 600;
const MAX_INBOX = 512; // unconsumed opponent records held at once
const MAX_TICKS = 10_000; // no legal match comes near this many Ticks

export class OnlineMatch {
  /**
   * @param {{ dir: string, identity: any, session: { descriptor: any, manifest: any, sigs: any, seat: 'A'|'B' }, controller?: any, emit: (e: any) => void, log?: (s: string) => void, onComplete?: (m: OnlineMatch) => void }} o
   */
  constructor(o) {
    this.o = o;
    this.dir = o.dir;
    this.identity = o.identity;
    this.descriptor = o.session.descriptor;
    this.manifest = o.session.manifest;
    this.seat = o.session.seat;
    this.other = other(this.seat);
    this.matchId = this.descriptor.matchId;
    this.opponent = this.manifest.participants[this.other];
    this.controller = o.controller ?? null;
    this.log = o.log ?? (() => {});
    this.inbox = [];
    this.waiters = new Set();
    this.history = [];
    this.status = 'opening';
    this.connection = 'waiting';
    this._chain = Promise.resolve();
  }

  emit(kind, data = {}) { this.o.emit({ type: 'match', matchId: this.matchId, kind, ...data }); }

  async open() {
    this.own = new Hypercore(join(this.dir, 'own'), { valueEncoding: 'json' });
    await this.own.ready();
    if (b4a.toString(this.own.key, 'hex') !== this.descriptor.feeds[this.seat]) throw new Error('own match feed key differs from the agreed session');
    this.remote = new Hypercore(join(this.dir, 'remote'), b4a.from(this.descriptor.feeds[this.other], 'hex'), { valueEncoding: 'json' });
    await this.remote.ready();
    this.remote.on('truncate', (length, fork) => { if (length < this.remoteRead) this._dispute(`the opponent's feed was rewritten below agreed position ${this.remoteRead} (fork ${fork})`); });
    this.ctx = createContext(this.manifest);
    this.state = initializeMatch(this.manifest);
    if (stateFingerprint(this.state) !== this.descriptor.initialStateHash) throw new Error('initial state differs from the agreed session');
    this.ownCursor = 0;
    this.ownLength = this.own.length; // records written before this open: replayed, not re-signed
    this.remoteRead = 0;
    this.status = 'active';
    this._read();
    this._run();
    return this;
  }

  /** Replicate both feeds over an authenticated connection to the opponent. */
  attach(conn) {
    if (this.closed) return;
    this.own.replicate(conn);
    this.remote.replicate(conn);
    this.connection = 'connected';
    this.emit('connection', { state: 'connected' });
  }

  detached() { if (!this.closed && this.status === 'active') { this.connection = 'reconnecting'; this.emit('connection', { state: 'reconnecting' }); } }

  // --- remote feed ----------------------------------------------------------------------------
  async _read() {
    while (!this.closed && !this.disputed) {
      // bounded pending input: stop reading ahead while unconsumed future records pile up
      if (this.inbox.length >= MAX_INBOX) { try { await this._until(() => this.inbox.length < MAX_INBOX / 2); } catch { return; } }
      let rec;
      try { rec = await this.remote.get(this.remoteRead); } catch (e) { if (this.closed) return; await sleep(200); continue; }
      // the reader may run ahead of a replaying loop, so plausibility is bounded by the profile, not by local progress
      const r = admitRecord(rec, { matchId: this.matchId, author: this.opponent, index: this.remoteRead, maxCount: MAX_TICKS });
      if (!r.ok) { this._dispute(`opponent record ${this.remoteRead} refused: ${r.error}`); return; }
      this.remoteRead++;
      this.inbox.push(r.body);
      this._wake();
    }
  }

  _wake() { for (const w of [...this.waiters]) w(); }

  /** Wait (without a game timeout: human thinking has none) until a predicate holds. */
  _until(pred) {
    return new Promise((resolve, reject) => {
      const check = () => {
        if (this.closed || this.disputed) { this.waiters.delete(check); reject(new Error(this.disputed ? `disputed: ${this.disputed}` : 'closed')); return; }
        const v = pred();
        if (v) { this.waiters.delete(check); resolve(v); }
      };
      this.waiters.add(check);
      check();
    });
  }

  _take(pred) { return this._until(() => { const i = this.inbox.findIndex(pred); return i >= 0 ? this.inbox.splice(i, 1)[0] : null; }); }

  // --- own feed (the journal) -----------------------------------------------------------------
  async _ownRecorded() {
    if (this.ownCursor >= this.ownLength) return null;
    return (await this.own.get(this.ownCursor)).body;
  }
  async _consumeOwn() { const b = await this._ownRecorded(); this.ownCursor++; return b; }

  /**
   * Append one signed record. Appends are serialized; `payload` may be a function evaluated inside
   * the queue and `then(body)` runs there too, so a coalesced draft and a Ready can never compute
   * the same plan revision.
   */
  _publish(type, count, phaseId, payload, then = null) {
    const job = this._chain.then(async () => {
      const p = typeof payload === 'function' ? payload() : payload;
      if (p === null) return null; // nothing to publish any more
      const rec = signRecord(this.identity, { type, matchId: this.matchId, authorSequence: this.own.length + 1, count, phaseId, priorStateHash: this.priorHash, payload: p });
      await this.own.append(rec);
      this.ownCursor = this.own.length;
      this.ownLength = this.own.length;
      if (then) then(rec.body);
      return rec.body;
    });
    this._chain = job.catch(() => {});
    return job;
  }

  // --- the match loop -------------------------------------------------------------------------
  async _run() {
    try {
      while (!this.state.outcome && !this.closed) await this._tick();
      if (this.closed) return;
      const finalHash = stateFingerprint(this.state);
      const rec = await this._ownRecorded();
      if (rec?.type === 'closing') await this._consumeOwn(); else await this._publish('closing', this.state.tick, 'closing', { finalHash });
      this.status = 'complete';
      this.finalHash = finalHash;
      this._persist({ status: 'complete', outcome: this.state.outcome, finalHash });
      this.emit('complete', { outcome: this.state.outcome, finalHash, ticks: this.history.length });
      this.o.onComplete?.(this);
      this._take((b) => b.type === 'closing').then((b) => { this.remoteClosing = b.payload.finalHash; this.emit('closing', { agreed: b.payload.finalHash === finalHash }); }).catch(() => {});
    } catch (e) {
      if (this.closed) return;
      if (!this.disputed) this._dispute(e.message);
    }
  }

  async _tick() {
    const { state, ctx } = this;
    beginCount(state, ctx);
    const count = state.tick;
    this.priorHash = stateFingerprint(state);
    const agreement = new PhaseAgreement({ matchId: this.matchId, count, phaseId: 'plan', priorStateHash: this.priorHash, policy: agreementPolicy(this.manifest.profile) });
    if (agreement.policy !== 'own_plan_ready_v1') throw new Error(`online play needs own_plan_ready_v1, not ${agreement.policy}`);
    const cur = this.current = { count, agreement, committed: false, draft: null, choices: [], pendingChoice: null, locked: null, replaying: true };
    // 1. replay this Tick's recorded own plan revisions and Ready
    for (let rec = await this._ownRecorded(); rec && rec.count === count && (rec.type === 'plan' || rec.type === 'ready'); rec = await this._ownRecorded()) {
      await this._consumeOwn();
      const r = agreement.receive(this.seat, rec);
      if (!r.ok) throw new Error(`own journal refused at Tick ${count}: ${r.error}`);
      if (rec.type === 'ready') cur.committed = true;
    }
    cur.replaying = false;
    this.emit('tick', { count, priorHash: this.priorHash, committed: cur.committed });
    // 2. a declared bot seat plans for itself
    if (!cur.committed && this.controller) {
      cur.draft = this.controller.plan(state, ctx);
      await this._commit(cur);
    }
    // 3. the opponent's public plan revisions and Ready, in feed order, until both own plans lock
    const pump = () => {
      for (let i = 0; i < this.inbox.length; i++) {
        const b = this.inbox[i];
        if (b.count !== count || (b.type !== 'plan' && b.type !== 'ready')) continue;
        this.inbox.splice(i--, 1);
        const r = agreement.receive(this.other, b);
        if (!r.ok) { this._dispute(`opponent ${b.type} at Tick ${count} refused: ${r.error}`); return true; }
        this.emit(b.type === 'plan' ? 'remotePlan' : 'remoteReady', { count, revision: agreement.plans[this.other].revision, commands: agreement.plans[this.other].commands });
      }
      return agreement.locked;
    };
    const locked = await this._until(pump);
    cur.locked = locked;
    const plans = {};
    for (const s of ['A', 'B']) plans[s] = validatePlan(state, ctx, s, locked[s]).accepted;
    this.emit('locked', { count, plans: { A: locked.A, B: locked.B }, hashes: locked.hashes, revisions: locked.revisions });
    // 4. resolve; each choice comes from its owning seat only
    const gen = resolveTick(state, ctx, plans);
    let step = gen.next();
    let index = 0;
    while (!step.done) {
      const req = step.value;
      const requestHash = fingerprint(req);
      let answer;
      if (req.seat === this.seat) {
        const rec = await this._ownRecorded();
        if (rec && rec.type === 'choice' && rec.count === count && rec.payload.choiceId === req.choiceId) {
          await this._consumeOwn();
          if (rec.payload.choiceIndex !== index || rec.payload.requestHash !== requestHash) throw new Error(`own journal choice ${req.choiceId} does not match the request`);
          answer = rec.payload.answer;
        } else if (this.controller) {
          answer = this.controller.choose(req, state, ctx) ?? { pass: true };
          await this._publish('choice', count, req.choiceId, { choiceId: req.choiceId, choiceIndex: index, requestHash, answer });
        } else {
          answer = await new Promise((resolve) => { cur.pendingChoice = { req, index, requestHash, resolve }; this.emit('choiceNeeded', { count, index, request: req }); this._wake(); });
        }
      } else {
        const b = await this._take((x) => x.type === 'choice' && x.count === count && x.payload.choiceId === req.choiceId);
        if (b.payload.choiceIndex !== index || b.payload.requestHash !== requestHash) throw new Error(`opponent choice ${req.choiceId} is bound to a different request`);
        answer = b.payload.answer;
      }
      cur.choices.push({ seat: req.seat, choiceId: req.choiceId, answer });
      this.emit('choice', { count, index, seat: req.seat, choiceId: req.choiceId, answer });
      index++;
      step = gen.next(answer);
    }
    // 5. receipts: advance only on a matching pair
    const hash = stateFingerprint(state);
    const outcome = state.outcome ?? null;
    const recorded = await this._ownRecorded();
    if (recorded?.type === 'receipt' && recorded.count === count) {
      await this._consumeOwn();
      if (recorded.payload.stateHash !== hash) throw new Error(`replayed Tick ${count} no longer reaches the recorded receipt`);
    } else {
      await this._publish('receipt', count, 'receipt', { stateHash: hash, outcome, lockedPair: locked.hashes });
    }
    const theirs = await this._take((b) => b.type === 'receipt' && b.count === count);
    if (fingerprint(theirs.payload.lockedPair) !== fingerprint(locked.hashes)) throw new Error(`Tick ${count}: the locked plan pairs differ`);
    if (theirs.payload.stateHash !== hash) throw new Error(`Tick ${count}: receipts differ (${hash.slice(7, 19)} vs ${String(theirs.payload.stateHash).slice(7, 19)})`);
    this.history.push({ tick: count, plans, choices: cur.choices.map((x) => x.answer), fingerprint: hash });
    this.current = null;
    this._persist({ status: 'active', lastAgreedTick: count, lastAgreedHash: hash });
    this.emit('tickAgreed', { count, hash, outcome });
  }

  /** Publish the current draft (if new) and the Ready for it; durable before it returns. */
  async _commit(cur) {
    const ag = cur.agreement;
    const cmds = cur.draft ?? ag.plans[this.seat].commands;
    const errors = validatePlan(this.state, this.ctx, this.seat, cmds).errors;
    if (errors.length) throw Object.assign(new Error(`plan order ${errors[0].index + 1}: ${errors[0].error}`), { code: 'PLAN_INVALID' });
    const receive = (body) => { const r = ag.receive(this.seat, body); if (!r.ok) throw new Error(r.error); };
    await this._publish('plan', cur.count, 'plan', () => (fingerprint(cmds) !== ag.plans[this.seat].hash || ag.plans[this.seat].revision === 0 ? { planRevision: ag.plans[this.seat].revision + 1, commands: cmds } : null), receive);
    await this._publish('ready', cur.count, 'plan', () => ag.readyPayload(this.seat), receive);
    cur.committed = true;
    this.emit('ownCommitted', { count: cur.count, revision: ag.plans[this.seat].revision, hash: ag.plans[this.seat].hash });
    this._wake();
  }

  // --- interface operations (from the renderer via the host adapter) ---------------------------
  _check(args) {
    if (args.matchId !== this.matchId) throw new Error('stale match');
    const cur = this.current;
    if (!cur || cur.replaying) throw Object.assign(new Error('this Tick is not open for planning yet'), { code: 'NOT_OPEN' });
    if (args.count !== cur.count) throw Object.assign(new Error(`stale Tick ${args.count} (now ${cur.count})`), { code: 'STALE_TICK' });
    return cur;
  }

  /** Update the own draft; semantic changes are published as public plan revisions, coalesced. */
  draft(args) {
    const cur = this._check(args);
    if (cur.committed) throw Object.assign(new Error('your plan is committed for this Tick'), { code: 'COMMITTED' });
    if (!Array.isArray(args.commands) || args.commands.length > 64) throw new Error('bad plan');
    cur.draft = args.commands;
    clearTimeout(cur.draftTimer);
    cur.draftTimer = setTimeout(() => {
      if (this.current !== cur || cur.committed || cur.locked) return;
      const ag = cur.agreement;
      if (fingerprint(cur.draft) === ag.plans[this.seat].hash) return;
      if (validatePlan(this.state, this.ctx, this.seat, cur.draft).errors.length) return; // drafts in repair are not published
      const cmds = cur.draft;
      this._publish('plan', cur.count, 'plan', () => (cur.committed || cur.committing || ag.ready[this.seat] || fingerprint(cmds) === ag.plans[this.seat].hash ? null : { planRevision: ag.plans[this.seat].revision + 1, commands: cmds }), (body) => ag.receive(this.seat, body))
        .then((body) => { if (body) this.emit('ownPlan', { count: cur.count, revision: body.payload.planRevision }); }).catch((e) => this.log(`draft publish failed: ${e.message}`));
    }, DRAFT_COALESCE_MS);
    return { ok: true };
  }

  /** Ready: commit the own plan once. A repeated request (lost acknowledgment) gets the same result. */
  async ready(args) {
    const cur = this._check(args);
    const ag = cur.agreement;
    if (cur.committed) return { ok: true, already: true, revision: ag.ready[this.seat]?.revision, hash: ag.ready[this.seat]?.hash };
    if (cur.committing) return cur.committing;
    clearTimeout(cur.draftTimer);
    if (Array.isArray(args.commands)) cur.draft = args.commands;
    cur.committing = this._commit(cur).then(() => ({ ok: true, revision: ag.ready[this.seat].revision, hash: ag.ready[this.seat].hash })).finally(() => { cur.committing = null; });
    return cur.committing;
  }

  /** Answer this seat's pending response choice; the record is durable before the resolver resumes. */
  async choice(args) {
    if (args.matchId !== this.matchId) throw new Error('stale match');
    const cur = this.current;
    const pc = cur?.pendingChoice;
    if (!pc) {
      const done = cur?.choices.find((x) => x.choiceId === args.choiceId && x.seat === this.seat);
      if (done) return { ok: true, already: true };
      throw Object.assign(new Error('no response choice is waiting'), { code: 'NO_CHOICE' });
    }
    if (args.count !== cur.count || args.choiceId !== pc.req.choiceId) throw Object.assign(new Error('stale choice'), { code: 'STALE_CHOICE' });
    if (!args.answer || typeof args.answer !== 'object') throw new Error('bad answer');
    cur.pendingChoice = null;
    await this._publish('choice', cur.count, pc.req.choiceId, { choiceId: pc.req.choiceId, choiceIndex: pc.index, requestHash: pc.requestHash, answer: args.answer });
    pc.resolve(args.answer);
    return { ok: true };
  }

  /** Everything a (re)attached view needs to reconstruct the match without simulating authority. */
  snapshot() {
    const cur = this.current;
    const ag = cur?.agreement;
    return {
      matchId: this.matchId, seat: this.seat, status: this.status, disputed: this.disputed ?? null, connection: this.connection,
      manifest: this.manifest, descriptor: { matchId: this.matchId, initialStateHash: this.descriptor.initialStateHash, players: this.descriptor.players, online: this.descriptor.online },
      opponent: { participantId: this.opponent.participantId, label: this.opponent.label, publicKey: this.opponent.publicKey },
      controllers: this.manifest.controllers,
      history: this.history,
      current: cur ? {
        count: cur.count, replaying: cur.replaying, committed: cur.committed,
        own: { revision: ag.plans[this.seat].revision, commands: cur.draft ?? ag.plans[this.seat].commands, ready: !!ag.ready[this.seat] },
        remote: { revision: ag.plans[this.other].revision, commands: ag.plans[this.other].commands, ready: !!ag.ready[this.other] },
        locked: cur.locked ? { plans: { A: cur.locked.A, B: cur.locked.B }, hashes: cur.locked.hashes } : null,
        choices: cur.choices, pendingChoice: cur.pendingChoice ? { index: cur.pendingChoice.index, request: cur.pendingChoice.req } : null,
      } : null,
      outcome: this.state?.outcome ?? null, finalHash: this.finalHash ?? null,
      feeds: { own: { length: this.own?.length ?? 0, fork: this.own?.fork ?? 0 }, remote: { length: this.remote?.length ?? 0, read: this.remoteRead, fork: this.remote?.fork ?? 0 } },
    };
  }

  /** Both feeds' signed records as stored (for result evidence). */
  async records() {
    const read = async (core) => { const out = []; for (let i = 0; i < core.length; i++) out.push(await core.get(i)); return out; };
    const own = await read(this.own), remote = await read(this.remote);
    return this.seat === 'A' ? { A: own, B: remote } : { A: remote, B: own };
  }

  _persist(progress) {
    try { writeJsonAtomic(join(this.dir, 'progress.json'), { ...progress, at: new Date().toISOString() }); } catch (e) { this.log(`progress not saved: ${e.message}`); }
  }

  _dispute(reason) {
    if (this.disputed || this.closed) return;
    this.disputed = reason;
    this.status = 'disputed';
    this.log(`match ${this.matchId} disputed: ${reason}`);
    this._persist({ status: 'disputed', reason });
    this.emit('disputed', { reason });
    this._wake();
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    if (this.current?.pendingChoice) this.current.pendingChoice = null;
    this._wake();
    await this._chain.catch(() => {});
    await this.remote?.close().catch(() => {});
    await this.own?.close().catch(() => {});
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
