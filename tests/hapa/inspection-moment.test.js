// Review 06 R6-03/R6-04: during playback every inspected fact belongs to the displayed moment
// (ward providers, headcount, shared pools, survival), and line-defense values are labelled by
// scope (a member's contribution versus the line a hit reaches). Rules outcomes are unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scenario } from '../../fixtures/hapa/scenarios.js';
import { runTick } from '../../src/hapa/rules/match.js';
import { applyCardHit } from '../../src/hapa/rules/combat.js';
import { stateFingerprint } from '../../src/hapa/rules/state.js';
import { memberFacts, partyFacts, linePreview, rangedTargets, momentSlice, stateAt } from '../../src/hapa/rules/inspection.js';

const U = 1_000_000;
const recorder = (ctx) => { const moments = []; ctx.observeEvents = (s) => moments.push(momentSlice(s)); return moments; };

function wardFight(observe) {
  const fx = scenario({ profileId: 'hapa_open_10x9_v3_02', parties: [
    { id: 'A.p', owner: 'A', mount: 'queen', column: 5, row: 5, slots: { 5: 'center', 2: 'swordsman' }, supply: 1 },
    { id: 'B.p', owner: 'B', mount: 'castle', column: 5, row: 6, slots: { 5: 'center', 2: 'mage', 8: 'archer' }, supply: 1 },
  ] });
  const { state, ctx } = fx;
  state.tick = 5; state.activeColumns = [5]; state.phase = 'planning';
  const before = structuredClone(state);
  const moments = observe ? recorder(ctx) : null;
  const { events } = runTick(state, ctx, { A: [{ type: 'set_destination', partyId: 'A.p', target: { column: 5, row: 6 } }], B: [] });
  ctx.observeEvents = null;
  return { state, ctx, before, events, moments };
}

test('the review 06 Mage case: ward, headcount and body agree before and after the displayed death', () => {
  const { state, ctx, before, events, moments } = wardFight(true);
  assert.equal(moments.length, events.length, 'one moment per event');
  const contact = events.findIndex((e) => e.type === 'contact');
  const died = events.findIndex((e) => e.type === 'member_died' && e.memberId === 'B.p.s2');
  assert.ok(contact >= 0 && died > contact);
  const early = stateAt(before, moments, contact, state);
  assert.equal(memberFacts(early, ctx, 'B.p.s2').alive, true);
  assert.equal(memberFacts(early, ctx, 'B.p.s2').health.hp, 3 * U);
  assert.equal(memberFacts(early, ctx, 'B.p.s8').protection.magic.front.total, 1, 'the living Mage still wards the Archer');
  assert.equal(partyFacts(early, ctx, 'B.p').living, 3);
  const justBefore = stateAt(before, moments, died, state);
  assert.equal(memberFacts(justBefore, ctx, 'B.p.s8').protection.magic.front?.total, 1);
  const after = stateAt(before, moments, died + 1, state);
  assert.equal(memberFacts(after, ctx, 'B.p.s2').alive, false);
  assert.equal(memberFacts(after, ctx, 'B.p.s8').protection.magic.front, undefined, 'the ward ends with its provider');
  assert.equal(partyFacts(after, ctx, 'B.p').living, 2);
  // final convergence: everything shown is the accepted state itself
  assert.equal(stateAt(before, moments, events.length, state), state);
});

test('observing moments changes no rules outcome (fingerprint and events identical)', () => {
  const a = wardFight(false), b = wardFight(true);
  assert.equal(stateFingerprint(b.state), stateFingerprint(a.state));
  assert.deepEqual(b.events, a.events);
  assert.equal(Object.keys(b.events).includes('observe'), false, 'the hook is not part of the event list');
});

test('pooled health: nothing shown keeps the full pool and every retainer; the hit and maintenance follow their events', () => {
  const fx = scenario({ profileId: 'hapa_open_10x9_v3_01_party_maintenance', parties: [{ id: 'B.p', owner: 'B', mount: 'castle', column: 5, row: 6, slots: { 5: 'center', 1: 'swordsman', 2: 'swordsman', 3: 'swordsman' } }] });
  const { state, ctx } = fx, before = structuredClone(state), events = [], moments = [];
  Object.defineProperty(events, 'observe', { value: (s) => moments.push(momentSlice(s)), enumerable: false });
  applyCardHit(state, ctx, events, { source: 'A.mount.C5', cardId: 'fixture.review.ember', recipientId: 'B.p.s5', channel: 'magic', power: 2, face: 'front' });
  const at0 = stateAt(before, moments, 0, state);
  assert.equal(memberFacts(at0, ctx, 'B.p.s1').health.hp, 15 * U);
  assert.equal(memberFacts(at0, ctx, 'B.p.s1').alive, true);
  assert.equal(partyFacts(at0, ctx, 'B.p').living, 4);
  const hit = events.findIndex((e) => e.type === 'card_damage');
  const atHit = stateAt(before, moments, hit + 1, state);
  assert.equal(memberFacts(atHit, ctx, 'B.p.s1').health.hp, 13 * U, 'the pool drops at the card hit');
  const fin = stateAt(before, moments, events.length, state);
  assert.equal(memberFacts(fin, ctx, 'B.p.s1').alive, state.members['B.p.s1'].alive);
  assert.equal(partyFacts(fin, ctx, 'B.p').living, partyFacts(state, ctx, 'B.p').living);
});

test('a party defeated later in the Tick is still alive (and labelled) before its displayed defeat', () => {
  const fx = scenario({ profileId: 'hapa_open_10x9_v3_02', parties: [
    { id: 'A.p', owner: 'A', mount: 'queen', column: 5, row: 5, slots: { 5: 'center', 1: 'swordsman', 2: 'swordsman', 3: 'swordsman' }, supply: 1 },
    { id: 'B.p', owner: 'B', mount: null, column: 5, row: 6, slots: { 2: 'archer' }, supply: 0 },
  ] });
  const { state, ctx } = fx;
  state.tick = 5; state.activeColumns = [5]; state.phase = 'planning';
  const before = structuredClone(state);
  const moments = recorder(ctx);
  const { events } = runTick(state, ctx, { A: [{ type: 'set_destination', partyId: 'A.p', target: { column: 5, row: 6 } }], B: [] });
  ctx.observeEvents = null;
  const defeated = events.findIndex((e) => e.type === 'party_defeated' && e.partyId === 'B.p');
  assert.ok(defeated > 0, 'the fixture eliminates B.p');
  assert.equal(state.parties['B.p'].alive, false);
  assert.equal(stateAt(before, moments, defeated, state).parties['B.p'].alive, true);
  assert.equal(stateAt(before, moments, defeated + 1, state).parties['B.p'].alive, false);
});

test('line defense: a member value is its contribution; the front-line preview equals a real exchange', () => {
  const slots = { 5: 'center', 1: 'swordsman', 2: 'swordsman', 3: 'swordsman' };
  const fx = scenario({ profileId: 'hapa_open_10x9_v3_01_line_attacker', parties: [
    { id: 'A.q', owner: 'A', mount: 'queen', column: 5, row: 5, slots, supply: 0.25 },
    { id: 'B.q', owner: 'B', mount: 'queen', column: 5, row: 6, slots, supply: 3 },
  ] });
  const { state, ctx } = fx;
  state.tick = 5; state.activeColumns = [5]; state.phase = 'planning';
  assert.equal(memberFacts(state, ctx, 'A.q.s2').protection.physical.front.total, 1, 'contribution');
  const pv = linePreview(state, ctx, 'A.q', 'physical', 'front');
  assert.deepEqual(pv.slots, [1, 2, 3]);
  assert.equal(pv.total, 3);
  const r = runTick(state, ctx, { A: [{ type: 'set_destination', partyId: 'A.q', target: { column: 5, row: 6 } }], B: [] });
  const swords = r.events.find((e) => e.type === 'exchange').hits.filter((h) => h.attack === 'sword');
  assert.ok(swords.length && swords.every((h) => h.protection === pv.total));
});

test('ranged preview targets only engaged parties, as the rules do', () => {
  const fx = scenario({ profileId: 'hapa_open_10x9_v3_02', parties: [
    { id: 'A.p', owner: 'A', mount: 'castle', column: 5, row: 5, slots: { 5: 'center', 8: 'archer' } },
    { id: 'B.p', owner: 'B', mount: 'castle', column: 5, row: 8, slots: { 5: 'center' } },
  ] });
  assert.deepEqual(rangedTargets(fx.state, fx.ctx, 'A.p.s8', 'bow'), [], 'not engaged: no preview target is implied');
});
