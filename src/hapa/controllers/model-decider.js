/**
 * Model-assisted decisions for a bot seat (Milestone C, docs/integrations/IMPLEMENTATION_CHECKPOINT.md).
 *
 * The seat's heuristic plan is computed and stored first: it is the fallback, and it is what plays
 * whenever the model is late, unavailable, invalid or fenced out. The model is asked once per
 * decision through Hapa Harness's participant-game view (no Avatar memory, no tools). It chooses
 * among a shortlist the host derived from the same legal, fundable destinations the heuristic
 * weighs, so every proposal is checked by the shared validator before admission. There is no repair
 * loop.
 *
 * Each decision is an immutable packet bound to the match, session epoch, seat, Avatar, Tick,
 * phase or choice, the request ID, a state fingerprint and an input digest. A result is consumed at
 * most once, and only while all of those still hold; otherwise it is rejected and receipted. The
 * host's deadline is authoritative (planning 5 s, response 1.5 s by default; configurable outside
 * the rules). Receipts are diagnostics kept apart from the replay, which records only accepted plans
 * and answers.
 */
import { sha256Hex, utf8 } from '../rules/encoding.js';
import { stateFingerprint, other } from '../rules/state.js';
import { validatePlan } from '../rules/match.js';
import { supplyOf } from '../rules/economy.js';

export const MODEL_CONTROLLER_REVISION = 'model-assisted/0.1.0';
export const DEFAULT_DEADLINES = Object.freeze({ plan: 5000, response: 1500 });

// the Harness's canonical JSON (sorted object keys), so both sides compute the same input digest
const canonical = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x));
const digest = (v) => sha256Hex(utf8(canonical(v)));
const freeze = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(freeze); Object.freeze(o); } return o; };
const at = (r) => `R${r.row}C${r.column}`;
const piece = (p) => (p.mount ? p.mount[0].toUpperCase() + p.mount.slice(1) : 'Pawn');

/** The boundary shape of a proposal; returns a reason when it is not { choices: [{decision, option}], remark? }. */
export function proposalShape(p, max) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return 'not an object';
  if (!Array.isArray(p.choices)) return 'choices is not a list';
  if (p.choices.length > max) return 'more choices than decisions';
  if (p.choices.some((c) => !c || typeof c !== 'object' || typeof c.decision !== 'string' || typeof c.option !== 'string')) return 'a choice is not { decision, option }';
  if (p.remark !== undefined && typeof p.remark !== 'string') return 'remark is not text';
  return null;
}

/** The receipt outcome for a request that did not arrive as a usable reply. */
const notArrived = (status) => ({ deadline: 'deadline-fallback', cancelled: 'cancelled-fallback', malformed: 'rejected-malformed-reply' })[status] ?? 'unavailable-fallback';

export class ModelDecider {
  /**
   * @param {{ seat: 'A'|'B', avatarId: string, identityRevision: string, endpoint?: string, deadlines?: { plan: number, response: number } }} o
   */
  constructor(o) {
    this.seat = o.seat;
    this.avatarId = o.avatarId;
    this.identityRevision = String(o.identityRevision ?? 'unknown').replace(/[^A-Za-z0-9:._-]/g, '.');
    this.endpoint = o.endpoint ?? '/harness';
    this.deadlines = { ...DEFAULT_DEADLINES, ...(o.deadlines ?? {}) };
    this.consumed = new Set();
    this.receipts = []; // diagnostics only (never in the replay)
  }

  /** The permitted view at the decision boundary: public board facts for this seat. */
  _view(state, ctx) {
    const seat = this.seat;
    const alive = Object.values(state.parties).filter((p) => p.alive && !p.retired);
    const party = (p) => ({ piece: piece(p), at: at(p.region), members: Object.values(p.slots).filter((id) => id && state.members[id]?.alive).length, ...(p.commander ? { commander: true } : {}), ...(p.owner === seat ? { supply: Math.round((supplyOf(p) / ctx.U) * 10) / 10 } : {}) });
    const cmd = (s) => Object.values(state.members).find((m) => m.commander && m.owner === s);
    const capital = ctx.geo.toGlobal(other(seat), ctx.profile.board.capitalColumn, 1);
    return {
      seat, tick: state.tick, goal: `Win by moving a party center into the enemy Capital at ${at(capital)} or by killing the enemy Commander.`,
      my_commander_hp: cmd(seat)?.alive ? Math.round(cmd(seat).hp / ctx.U) : 0, enemy_commander_hp: cmd(other(seat))?.alive ? Math.round(cmd(other(seat)).hp / ctx.U) : 0,
      my_parties: alive.filter((p) => p.owner === seat).slice(0, 16).map(party),
      enemy_parties: alive.filter((p) => p.owner !== seat).slice(0, 16).map(party),
    };
  }

  _ref(app, kind, phaseId, choiceId, input) {
    return {
      match_id: app.session.manifest.matchId, session_epoch: app.generation, seat: this.seat, controller_binding_revision: MODEL_CONTROLLER_REVISION.replace('/', '.'),
      avatar_id: this.avatarId, avatar_identity_revision: this.identityRevision, tick: app.state.tick, phase_id: phaseId, kind,
      request_id: crypto.randomUUID(), choice_id: choiceId, decision_state_hash: stateFingerprint(app.state).replace(/^sha256:/, ''), input_hash: digest(input),
    };
  }

  /**
   * One Harness request under the host's deadline. Resolves to { proposal, receipt, status } where
   * status is 'arrived', 'deadline', 'unavailable', 'malformed' or 'cancelled'; a reply after the
   * deadline is receipted as late and ignored.
   */
  _ask(request, deadline) {
    const rid = request.ref.request_id;
    const sent = performance.now();
    const ctl = new AbortController();
    (this.inflight ??= new Map()).set(rid, ctl);
    const reply = fetch(`${this.endpoint}/game-decision`, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ request, deadline_ms: deadline }) })
      .then(async (r) => {
        // the outer wrapper is checked before anything completes (R11-03): a reply that is not a JSON
        // object (null, a list, a number, unparsable text) is a malformed reply, never an arrival
        const raw = await r.json().catch(() => undefined);
        const j = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null;
        if (!r.ok) throw Object.assign(Error(j?.error || j?.code || `harness ${r.status}`), { code: j?.code || j?.error || `http_${r.status}` });
        if (!j) throw Object.assign(Error(`malformed harness reply (${raw === undefined ? 'not JSON' : raw === null ? 'null' : Array.isArray(raw) ? 'a list' : typeof raw})`), { code: 'malformed-reply' });
        return j;
      });
    reply.finally?.(() => this.inflight?.delete(rid)).catch(() => {});
    return new Promise((resolve) => {
      let done = false;
      this._settle ??= new Map();
      // dispose(): stop waiting at once; the caller still fences, because cancellation is cooperative
      this._settle.set(rid, () => { if (done) return; done = true; clearTimeout(timer); resolve({ status: 'cancelled', proposal: null, receipt: null, ms: performance.now() - sent }); });
      const timer = setTimeout(() => {
        done = true;
        resolve({ status: 'deadline', proposal: null, receipt: null, ms: performance.now() - sent });
        // the Harness's own deadline aborts its one request; this only stops waiting, then cancels
        fetch(`${this.endpoint}/game-decision-cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ request_id: rid }) }).catch(() => {});
        reply.then((j) => this._record({ requestId: rid, kind: request.ref.kind, tick: request.ref.tick, outcome: 'late-ignored', harness: j.receipt ?? null }), () => {});
      }, deadline);
      // exactly one settlement: arrival, failure, deadline or cancellation, whichever is first; the
      // wrapper was validated above, so nothing here can throw after the recovery paths are cleared
      reply.then((j) => { this._settle?.delete(rid); if (done) return; done = true; clearTimeout(timer); resolve({ status: 'arrived', proposal: j.proposal ?? null, receipt: j.receipt ?? null, ms: performance.now() - sent }); },
        (e) => { this._settle?.delete(rid); if (done) return; done = true; clearTimeout(timer); resolve({ status: e?.code === 'malformed-reply' ? 'malformed' : 'unavailable', proposal: null, receipt: null, error: e?.code === 'malformed-reply' ? e.message : e?.code || e?.message || String(e), ms: performance.now() - sent }); });
    });
  }

  /** Cancel every outstanding request (match detached or reset). Fences stay in force. */
  dispose() {
    this.disposed = true;
    for (const [rid, ctl] of this.inflight ?? []) {
      ctl.abort();
      fetch(`${this.endpoint}/game-decision-cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ request_id: rid }) }).catch(() => {});
    }
    for (const settle of this._settle?.values() ?? []) settle();
    this.inflight?.clear(); this._settle?.clear();
  }

  _record(r) {
    const rec = { at: new Date().toISOString(), ...r };
    this.receipts.push(rec);
    if (this.receipts.length > 200) this.receipts.shift();
    return rec;
  }

  /** Fencing at admission: the same match epoch, Tick, state and an unconsumed request. */
  _fenced(app, request, gen, fp) {
    if (app.generation !== gen) return 'stale-epoch';
    if (app.state.tick !== request.ref.tick) return 'stale-tick';
    if (stateFingerprint(app.state) !== fp) return 'stale-state';
    if (this.consumed.has(request.ref.request_id)) return 'duplicate';
    return null;
  }

  /**
   * Plan for this Tick. Always returns a plan: the model's admitted choice or the stored fallback.
   * @returns {Promise<{ commands: any[], source: 'model'|'fallback', receipt: any }>}
   */
  async plan(app, bot) {
    const state = app.state, ctx = app.ctx, gen = app.generation, fp = stateFingerprint(state);
    const fallback = freeze(bot.plan(state, ctx)); // stored before any request
    const shortlist = bot.options(state, ctx).slice(0, 8);
    if (!shortlist.length) return { commands: fallback, source: 'fallback', receipt: this._record({ kind: 'plan', tick: state.tick, outcome: 'no-decision', note: 'no party had a destination choice this Tick; no model request' }) };
    const keyMap = new Map(); // `${decision}:${option}` → bot option key
    const decisions = shortlist.map((d, i) => {
      const p = state.parties[d.partyId];
      const id = `d${i + 1}`;
      keyMap.set(`${id}:hold`, 'hold');
      return { id, subject: `${piece(p)}${p.commander ? ' (Commander)' : ''} at ${at(p.region)}`, options: [{ key: 'hold', text: 'no new destination this Tick' },
        ...d.options.map((o, j) => { keyMap.set(`${id}:o${j + 1}`, o.key); return { key: `o${j + 1}`, text: `move to R${o.row}C${o.column}${o.attack ? ', attacking the enemy there' : ''}${o.joins ? ', picking up a Pawn on the way' : ''} (route cost ${o.cost})` }; })] };
    });
    const view = this._view(state, ctx);
    const request = freeze({ schema: 'hapa.versus.decision-request/v1', ref: this._ref(app, 'plan', 'plan', null, { view, decisions }), view, decisions });
    const res = await this._ask(request, this.deadlines.plan);
    const base = { requestId: request.ref.request_id, kind: 'plan', tick: request.ref.tick, inputHash: request.ref.input_hash, waitedMs: Math.round(res.ms), harness: res.receipt };
    // every rejection plays the fallback stored for this request (never a recomputed plan)
    const fallBack = (outcome, extra = {}) => ({ commands: fallback, source: 'fallback', receipt: this._record({ ...base, outcome, admitted: false, ...extra }) });
    try {
      if (res.status !== 'arrived') return fallBack(notArrived(res.status), { error: res.error ?? null });
      const fence = this._fenced(app, request, gen, fp);
      if (fence) return fallBack(`rejected-${fence}`);
      this.consumed.add(request.ref.request_id); // single consumption, admitted or not
      if (res.receipt?.request_id !== request.ref.request_id || res.receipt?.input_hash !== request.ref.input_hash) return fallBack('rejected-mismatched-receipt');
      const shape = proposalShape(res.proposal, decisions.length);
      if (shape) return fallBack(`rejected-${res.proposal ? 'malformed' : res.receipt?.outcome ?? 'empty'}`, { reason: shape, proposal: res.proposal ?? null });
      // explicit abstention: no choices means "no requested destination", which is the fallback, not a model move
      if (!res.proposal.choices.length) return fallBack('abstained', { proposal: res.proposal });
      const choice = {};
      const seen = new Set();
      for (const c of res.proposal.choices) {
        const key = keyMap.get(`${c.decision}:${c.option}`);
        if (!key || seen.has(c.decision)) return fallBack('rejected-invalid-choice', { proposal: res.proposal });
        seen.add(c.decision);
        choice[shortlist[Number(c.decision.slice(1)) - 1].partyId] = key;
      }
      const commands = bot.plan(state, ctx, choice);
      // faithful application: every selected destination must be in the plan (joint funding can
      // make a second choice unaffordable); otherwise the proposal is not admitted at all
      const missing = Object.entries(choice).filter(([partyId, key]) => {
        const dest = commands.find((c) => c.type === 'set_destination' && c.partyId === partyId);
        if (key === 'hold') return !!dest;
        const [col, row, via] = key.split('_');
        return !dest || dest.target.column !== Number(col) || dest.target.row !== Number(row) || (via ?? null) !== (dest.via ?? null);
      }).map(([partyId]) => partyId);
      if (missing.length) return fallBack('rejected-unfulfilled-choice', { proposal: res.proposal, reason: `selected destinations not all realizable together (${missing.join(', ')})` });
      const v = validatePlan(state, ctx, this.seat, commands);
      if (v.errors.length) return fallBack('rejected-invalid-plan', { proposal: res.proposal, errors: v.errors.map((e) => e.error) });
      return { commands, source: 'model', receipt: this._record({ ...base, outcome: 'admitted', admitted: true, proposal: res.proposal, choice, commands: commands.length }) };
    } catch (e) {
      return fallBack('rejected-error', { error: e.message });
    }
  }

  /**
   * A response choice: only when the heuristic has a legal counter ready; the model decides between
   * that counter and Pass. Returns the answer (the fallback on any failure).
   */
  async respond(app, bot, req) {
    const state = app.state, ctx = app.ctx, gen = app.generation, fp = stateFingerprint(state);
    const fallback = freeze(bot.choose(req, state, ctx));
    if (fallback.pass) return fallback; // nothing to decide: no counter is available
    const top = req.stack[req.stack.length - 1];
    const def = ctx.catalog.cards[state.cards[fallback.cardId]?.abilityId];
    const decisions = [{ id: 'd1', subject: `the opponent's ${ctx.catalog.cards[top.defId]?.title ?? top.defId} is waiting to resolve`, options: [{ key: 'pass', text: 'let it resolve' }, { key: 'counter', text: `counter it with ${def?.title ?? 'a response'}${fallback.burns?.length ? `, burning ${fallback.burns.length} card(s)` : ''}` }] }];
    const view = this._view(state, ctx);
    const request = freeze({ schema: 'hapa.versus.decision-request/v1', ref: this._ref(app, 'response', req.choiceId.replace(/[^A-Za-z0-9:._-]/g, '.'), req.choiceId, { view, decisions }), view, decisions });
    const res = await this._ask(request, this.deadlines.response);
    const base = { requestId: request.ref.request_id, kind: 'response', tick: request.ref.tick, choiceId: req.choiceId, inputHash: request.ref.input_hash, waitedMs: Math.round(res.ms), harness: res.receipt };
    const reject = (outcome, extra = {}) => { this._record({ ...base, outcome, admitted: false, ...extra }); return fallback; };
    try {
      if (res.status !== 'arrived') return reject(notArrived(res.status), { error: res.error ?? null });
      const fence = this._fenced(app, request, gen, fp);
      if (fence) return reject(`rejected-${fence}`);
      this.consumed.add(request.ref.request_id);
      // bound as strictly as planning: the request ID and the input digest, then exactly one known choice
      if (res.receipt?.request_id !== request.ref.request_id || res.receipt?.input_hash !== request.ref.input_hash) return reject('rejected-mismatched-receipt');
      const shape = proposalShape(res.proposal, 1);
      if (shape) return reject('rejected-malformed', { reason: shape, proposal: res.proposal ?? null });
      const cs = res.proposal.choices;
      if (cs.length !== 1 || cs[0].decision !== 'd1' || !['pass', 'counter'].includes(cs[0].option)) return reject('rejected-invalid-choice', { proposal: res.proposal });
      this._record({ ...base, outcome: 'admitted', admitted: true, proposal: res.proposal });
      return cs[0].option === 'pass' ? { pass: true } : fallback;
    } catch (e) { return reject('rejected-error', { error: e.message }); }
  }
}
