// Review 07: bounded probes of the exact source snapshot; no game code is changed.
import assert from 'node:assert/strict';
import { UI_FIXTURES } from '../../../../../fixtures/hapa/ui-fixtures.js';
import { createFixtureSession, openTick, closeTick, verifyReplay } from '../../../../../src/hapa/rules/session.js';
import { validatePlan, projectPlan } from '../../../../../src/hapa/rules/match.js';
import { PhaseAgreement } from '../../../../../src/hapa/protocol/agreement.js';

const result = { source: '4fd5eaf9c0f9750242d9d3d013ac36801d96a92f', kind: 'actual-source diagnostic, not browser play', cases: [] };
const make = () => { const s = createFixtureSession(UI_FIXTURES.response.build(), { id: 'response', title: 'Existing spell/response fixture' }); openTick(s); return s; };
const burn = { type: 'burn', cardId: 'A.red' };
const cast = { type: 'play_ability', cardId: 'A.ember', actorPartyId: 'A.c', target: { memberId: 'B.c.s2' }, burns: [] };
{
  const s = make(), tick = s.state.tick;
  const onlyBurn = projectPlan(s.state, s.ctx, 'A', [burn]);
  assert.deepEqual(onlyBurn.state.players.A.pool, { red: 2 });
  assert.deepEqual(s.state.players.A.pool, {});
  const v = validatePlan(s.state, s.ctx, 'A', [burn, cast]);
  assert.equal(v.ok, true);
  const projected = projectPlan(s.state, s.ctx, 'A', [burn, cast]);
  assert.deepEqual(projected.state.players.A.pool, {});
  const r = closeTick(s, { A: [burn, cast], B: [] }, () => ({ pass: true }));
  const events = r.events.filter(e => ['card_burned', 'mana_paid', 'ability_announced', 'card_damage', 'ability_resolved', 'mana_expired'].includes(e.type));
  assert.equal(r.events.filter(e => e.type === 'card_burned' && e.cardId === 'A.red').length, 1);
  assert.equal(r.events.some(e => e.type === 'card_damage'), true);
  assert.equal(s.state.tick, tick);
  assert.equal(verifyReplay(s.replay).ok, true);
  result.cases.push({ name: 'same_tick_burn_then_cast', tick, burnPreviewPool: onlyBurn.state.players.A.pool, authoritativeBeforeResolution: {}, projectedAfterPayment: projected.state.players.A.pool, accepted: v.ok, events, replay: verifyReplay(s.replay) });
}
{
  const s = make();
  const r = closeTick(s, { A: [burn], B: [] }, () => ({ pass: true }));
  assert.deepEqual(s.state.players.A.pool, { red: 2 });
  const availableThroughResolvedTick = { ...s.state.players.A.pool };
  const boundary = openTick(s);
  assert.deepEqual(s.state.players.A.pool, {});
  assert.equal(boundary.filter(e => e.type === 'mana_expired' && e.seat === 'A').length, 1);
  result.cases.push({ name: 'unspent_mana_expires_next_boundary', resolvedTick: s.state.tick - 1, availableThroughResolvedTick, nextTick: s.state.tick, nextTickPool: s.state.players.A.pool, expiry: boundary.filter(e => e.type === 'mana_expired'), burnCount: r.events.filter(e => e.type === 'card_burned' && e.cardId === 'A.red').length });
}
{
  const s = make();
  const removedFunding = validatePlan(s.state, s.ctx, 'A', [cast]);
  const wrongOrder = validatePlan(s.state, s.ctx, 'A', [cast, burn]);
  const duplicate = validatePlan(s.state, s.ctx, 'A', [burn, burn]);
  assert.equal(removedFunding.ok, false); assert.equal(wrongOrder.ok, false); assert.equal(duplicate.ok, false);
  result.cases.push({ name: 'dependencies_and_exclusivity', removedFunding: removedFunding.errors, castBeforeBurn: wrongOrder.errors, duplicateBurn: duplicate.errors });
}
{
  const ag = new PhaseAgreement({ matchId: 'review-07', count: 1, phaseId: 'plan', priorStateHash: 'sha256:probe' });
  const rec = (seat, sequence, type, payload) => ({ schemaVersion: 1, type, matchId: 'review-07', authorId: seat, signingKeyId: 'fixture', authorSequence: sequence, count: 1, phaseId: 'plan', priorStateHash: 'sha256:probe', payload });
  ag.receive('A', rec('A', 1, 'plan', { planRevision: 1, commands: [] }));
  ag.receive('B', rec('B', 1, 'plan', { planRevision: 1, commands: [] }));
  ag.receive('A', rec('A', 2, 'ready', ag.pair()));
  ag.receive('B', rec('B', 2, 'plan', { planRevision: 2, commands: [{ type: 'burn', cardId: 'fixture-card' }] }));
  const afterBReady = ag.receive('B', rec('B', 3, 'ready', ag.pair()));
  const stale = ag.stale('A');
  assert.equal(stale, true); assert.equal(afterBReady.locked, null);
  const afterAAgain = ag.receive('A', rec('A', 3, 'ready', ag.pair()));
  assert.ok(afterAAgain.locked);
  result.cases.push({ name: 'existing_agreement_demands_second_A_ready', AReadyStaleAfterBOwnReady: stale, lockedAfterEachPlayerOnce: afterBReady.locked, lockedAfterAAgain: afterAAgain.locked });
}
console.log(JSON.stringify(result, null, 2));
