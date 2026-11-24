// Response 08: review 07's movement, agreement and Mana cases re-run against the implementation,
// under the archived v3_02 (the defect must still reproduce there) and the new default v3_03.
// Actual headless rules; no browser claim. Run: node docs/reviews/evidence/2026-11-23/response-08/acceptance-probe.mjs
import { createSession, createFixtureSession, openTick, closeTick, verifyReplay } from '../../../../../src/hapa/rules/session.js';
import { profileById } from '../../../../../fixtures/hapa/profiles.js';
import { CATALOG } from '../../../../../fixtures/hapa/content.js';
import { UI_FIXTURES } from '../../../../../fixtures/hapa/ui-fixtures.js';
import { quoteRoute, routeFromHere, routeClearance } from '../../../../../src/hapa/rules/movement.js';
import { validatePlan, projectPlan } from '../../../../../src/hapa/rules/match.js';
import { supplyOf } from '../../../../../src/hapa/rules/economy.js';
import { PhaseAgreement, agreementPolicy } from '../../../../../src/hapa/protocol/agreement.js';
import { HeuristicBot } from '../../../../../src/hapa/controllers/heuristic-bot.js';

const pass = () => ({ pass: true });
const move = (partyId, column, row) => ({ type: 'set_destination', partyId, target: { column, row } });
const Q = 'A.mount.C6';
const u = (s, v) => v / s.ctx.U;
const where = (s) => { const q = s.state.parties[Q]; return { at: [u(s, q.x), u(s, q.y)], supply: u(s, supplyOf(q)), state: q.state, destination: q.destination }; };

function opening(profileId) {
  const s = createSession({ matchId: `r08-${profileId}`, profile: profileById(profileId), catalog: CATALOG, seed: 1 });
  let preview = null, r;
  for (let tick = 1; tick <= 6; tick++) {
    openTick(s);
    const plans = { A: [], B: [] };
    if (tick === 6) {
      plans.A = [6, 5, 4].map((c) => ({ type: 'load_supply', cardId: s.state.players.A.bank.minor[String(c)], partyId: Q }));
      const proj = projectPlan(s.state, s.ctx, 'A', plans.A).state, p = proj.parties[Q];
      const c = routeClearance(proj, s.ctx, p, routeFromHere(proj, s.ctx, p, { column: 9, row: 4 }).path);
      preview = c.clear ? { clear: true } : { clear: false, friendly: c.friendly, blocker: c.partyId, blockerMember: c.memberId, mover: c.moverId, region: c.region, afterSupplyUnits: u(s, c.along) };
      plans.A.push(move(Q, 9, 4));
    }
    r = closeTick(s, plans, pass);
  }
  return { s, preview, tick6: { ...where(s), blockedEvents: r.events.filter((e) => e.type === 'travel_blocked').map((e) => ({ by: e.by, at: e.at, quantum: e.quantum })) } };
}
function branch(s) {
  const d = createFixtureSession({ manifest: s.manifest, ctx: s.ctx, state: structuredClone(s.state) }, { id: 'r08-recovery', title: 'Recovery branch from the legal Tick 7 state' });
  openTick(d);
  let repeats = 0;
  while (!d.state.activeColumns.includes(6)) { repeats += closeTick(d, { A: [], B: [] }, pass).events.filter((e) => e.type === 'travel_blocked').length; openTick(d); }
  return { d, repeats };
}

const out = { kind: 'actual headless rules, response 08 implementation', profiles: {} };
for (const profileId of ['hapa_open_10x9_v3_02', 'hapa_open_10x9_v3_03']) {
  const { s, preview, tick6 } = opening(profileId);
  const res = { recovery: profileById(profileId).movement.recovery ?? 'nearest_node_v3 (absent)', agreement: agreementPolicy(profileById(profileId)), previewBeforeOrdering: preview, afterTick6: tick6, recovery13: [] };
  for (const target of [{ column: 6, row: 1 }, { column: 6, row: 2 }, { column: 7, row: 2 }]) {
    const { d, repeats } = branch(s);
    const p = d.state.parties[Q];
    const q = quoteRoute(d.state, d.ctx, p, target);
    const v = validatePlan(d.state, d.ctx, 'A', [move(Q, target.column, target.row)]);
    const before = where(d);
    closeTick(d, { A: [move(Q, target.column, target.row)], B: [] }, pass);
    const after1 = where(d);
    let merged = false;
    if (target.row === 2 && target.column === 6) { for (let i = 0; i < 2 && !d.state.parties['A.pawn.C6'].retired; i++) { openTick(d); closeTick(d, { A: [], B: [] }, pass); } merged = !!d.state.parties['A.pawn.C6'].retired; }
    res.recovery13.push({ atTick: before && d.state.tick, target, repeatedBlockedEventsWhileWaiting: repeats, quote: q.error ? { error: q.error } : { required: u(d, q.required), path: q.path }, accepted: v.ok, before, afterOneTick: after1, ...(target.row === 2 && target.column === 6 ? { mergedWithPawn: merged, supplyAfterMerge: u(d, supplyOf(p)) } : {}), replayVerified: verifyReplay(d.replay).ok });
  }
  // the heuristic bot at the same moment
  const { d } = branch(s);
  const cmds = new HeuristicBot({ seat: 'A', seed: 3 }).plan(d.state, d.ctx).filter((c) => c.type === 'set_destination');
  res.botAtTick13 = cmds.map((c) => { const p = d.state.parties[c.partyId]; const k = routeClearance(d.state, d.ctx, p, routeFromHere(d.state, d.ctx, p, c.target).path); return { partyId: c.partyId, target: c.target, knownFriendlyBlock: !k.clear && k.friendly ? k.partyId : null }; });
  out.profiles[profileId] = res;
}
// Ready: A Ready → B edits → B Ready, under both policies
const rec = (a, n, type, payload) => ({ schemaVersion: 1, type, matchId: 'm', authorId: a, signingKeyId: 'k', authorSequence: n, count: 1, phaseId: 'plan', priorStateHash: 'sha256:x', payload });
out.ready = {};
for (const policy of ['pair_acknowledgment_v3', 'own_plan_ready_v1']) {
  const ag = new PhaseAgreement({ matchId: 'm', count: 1, phaseId: 'plan', priorStateHash: 'sha256:x', policy });
  ag.receive('A', rec('a', 1, 'plan', { planRevision: 1, commands: [] }));
  ag.receive('B', rec('b', 1, 'plan', { planRevision: 1, commands: [] }));
  ag.receive('A', rec('a', 2, 'ready', ag.readyPayload('A')));
  ag.receive('B', rec('b', 2, 'plan', { planRevision: 2, commands: [{ type: 'burn', cardId: 'fixture-card' }] }));
  const r = ag.receive('B', rec('b', 3, 'ready', ag.readyPayload('B')));
  out.ready[policy] = { lockedAfterOneReadyEach: !!r.locked, AStale: ag.stale('A'), lockedRevisions: r.locked?.revisions ?? null };
}
// Mana: burn → same-Tick cast (existing response fixture), undo, duplicate, expiry
{
  const s = createFixtureSession(UI_FIXTURES.response.build(), { id: 'response', title: 'Existing spell/response fixture' }); openTick(s);
  const burn = { type: 'burn', cardId: 'A.red' }, cast = { type: 'play_ability', cardId: 'A.ember', actorPartyId: 'A.c', target: { memberId: 'B.c.s2' }, burns: [] };
  const afterBurn = projectPlan(s.state, s.ctx, 'A', [burn]).state.players.A.pool;
  const afterCast = projectPlan(s.state, s.ctx, 'A', [burn, cast]).state.players.A.pool;
  const undo = validatePlan(s.state, s.ctx, 'A', [cast]);
  const r = closeTick(s, { A: [burn, cast], B: [] }, pass);
  out.mana = { availableAfterBurn: afterBurn, availableAfterQueuedCast: afterCast, undoBurnLeavesCast: { ok: undo.ok, errors: undo.errors.map((e) => e.error) }, duplicateBurn: validatePlan(s.state, s.ctx, 'A', [burn, burn]).ok,
    accepted: { burns: r.events.filter((e) => e.type === 'card_burned').length, payments: r.events.filter((e) => e.type === 'mana_paid').length, damage: r.events.filter((e) => e.type === 'card_damage').length }, replayVerified: verifyReplay(s.replay).ok };
}
console.log(JSON.stringify(out, null, 2));
