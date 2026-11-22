/**
 * A local match session and the replay package (Master Requirements v3, Chapters 13 and 16;
 * Appendix B "Events explanations and replay").
 *
 * A replay is the manifest plus, for every Tick, the accepted public plans and the recorded
 * choice answers, with a checkpoint fingerprint after each Tick. `verifyReplay` recomputes the
 * whole match from those inputs and reports the first divergence.
 */
import { createManifest, initializeMatch, stateFingerprint } from './state.js';
import { createContext } from './context.js';
import { beginCount, validatePlan, runTick, replayChooser } from './match.js';
import { clone } from './encoding.js';

/**
 * Start a session from a profile and catalog.
 * @param {{ matchId: string, profile: any, catalog: any, controllers?: any, seed?: number, decks?: any }} o
 */
export function createSession(o) {
  const manifest = createManifest(o);
  const ctx = createContext(manifest);
  const state = initializeMatch(manifest);
  return {
    manifest, ctx, state,
    events: [],
    replay: { schemaVersion: 1, kind: 'hapa-versus-replay', manifest, initialFingerprint: stateFingerprint(state), ticks: [] },
  };
}

/**
 * A session that starts from a labeled diagnostic fixture state rather than the ordinary opening.
 * The replay carries the fixture's initial state so verification recomputes from it.
 * @param {{ id: string, title: string }} fixture
 */
export function createFixtureSession({ manifest, ctx, state }, fixture) {
  const initialState = clone(state);
  return {
    manifest, ctx, state,
    events: [],
    fixture,
    replay: { schemaVersion: 1, kind: 'hapa-versus-replay', manifest, fixture: { ...fixture, label: 'diagnostic fixture (not ordinary play)', initialState }, initialFingerprint: stateFingerprint(state), ticks: [] },
  };
}

/** Mint and open planning for the next Tick. */
export function openTick(session) {
  const ev = beginCount(session.state, session.ctx);
  session.events.push(...ev);
  return ev;
}

/**
 * Resolve the current Tick with plans (already agreed) and a synchronous chooser; record it.
 * Invalid commands are dropped by validatePlan and reported.
 */
export function closeTick(session, plans, choose) {
  const { state, ctx } = session;
  const accepted = {};
  const rejected = {};
  for (const seat of ['A', 'B']) {
    const v = validatePlan(state, ctx, seat, plans[seat] ?? []);
    accepted[seat] = v.accepted;
    rejected[seat] = v.errors;
  }
  const r = runTick(state, ctx, accepted, choose);
  session.events.push(...r.events);
  session.replay.ticks.push({ tick: state.tick, plans: clone(accepted), choices: r.choices.map((c) => c.answer), fingerprint: stateFingerprint(state) });
  return { events: r.events, rejected, choices: r.choices };
}

/**
 * Play a whole match between two controllers (`plan(state, ctx)`, `choose(request, state, ctx)`).
 * A Tick budget ends the run as an unfinished experiment, never an invented result.
 */
export function playMatch(session, controllers, { tickBudget = 400, onTick } = {}) {
  while (!session.state.outcome && session.state.tick < tickBudget) {
    openTick(session);
    const plans = { A: controllers.A.plan(session.state, session.ctx), B: controllers.B.plan(session.state, session.ctx) };
    const choose = (req) => controllers[req.seat].choose(req, session.state, session.ctx);
    const r = closeTick(session, plans, choose);
    onTick?.(session, r);
  }
  if (!session.state.outcome) session.state.unfinished = { reason: 'tick_budget', tickBudget, tick: session.state.tick };
  session.replay.outcome = session.state.outcome ?? { result: 'unfinished', reason: 'tick_budget', tick: session.state.tick };
  session.replay.finalFingerprint = stateFingerprint(session.state);
  return session.replay.outcome;
}

/** Recompute a replay from its manifest and inputs; compare each Tick's checkpoint. */
export function verifyReplay(replay, { onEvents } = {}) {
  const ctx = createContext(replay.manifest);
  const state = replay.fixture?.initialState ? clone(replay.fixture.initialState) : initializeMatch(replay.manifest);
  if (stateFingerprint(state) !== replay.initialFingerprint) return { ok: false, tick: 0, reason: 'initial state differs' };
  for (const t of replay.ticks) {
    const minted = beginCount(state, ctx);
    if (state.tick !== t.tick) return { ok: false, tick: t.tick, reason: `tick numbering differs (${state.tick})` };
    const r = runTick(state, ctx, t.plans, replayChooser(t.choices));
    onEvents?.([...minted, ...r.events]);
    const fp = stateFingerprint(state);
    if (fp !== t.fingerprint) return { ok: false, tick: t.tick, reason: 'checkpoint fingerprint differs', expected: t.fingerprint, actual: fp };
  }
  return { ok: true, ticks: replay.ticks.length, finalFingerprint: stateFingerprint(state), outcome: state.outcome };
}
