// Review 05 R5-04 / addendum 02 HF2-05: member labels come from one pure read model over the real
// combat functions — base versus applied protection with sources, health in the profile's form,
// target-dependent ranged previews, line-defense values, and playback-time health.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scenario } from '../../fixtures/hapa/scenarios.js';
import { UI_FIXTURES } from '../../fixtures/hapa/ui-fixtures.js';
import { memberFacts, partyFacts, partyLineProtection, rangedPreview, healthAt } from '../../src/hapa/rules/inspection.js';
import { createFixtureSession, openTick, closeTick } from '../../src/hapa/rules/session.js';
import { clone } from '../../src/hapa/rules/encoding.js';

const U = 1_000_000;

test('Bound Standard: base front Physical protection 1, applied 2, with named sources (review 05 observation)', () => {
  const fx = scenario({ profileId: 'hapa_open_10x9_v3_02', majors: { 3: 'fixture.bound_standard' }, keep: ['A.mount.C5', 'B.mount.C5', 'A.mount.C3'], parties: [] });
  const p = fx.state.parties['A.mount.C3'];
  const id = Object.values(p.slots).find((x) => x && fx.state.members[x].isCenter);
  const f = memberFacts(fx.state, fx.ctx, id);
  const front = f.protection.physical.front;
  assert.equal(front.base, 1, 'the archetype contributes 1');
  assert.equal(front.total, 2, 'Bound Standard adds 1 for this party');
  assert.ok(front.sources.some((s) => s.kind.startsWith('fixture.bound_standard@') && s.amount === 1 && s.scope === 'bound_party'), JSON.stringify(front.sources));
  assert.equal(f.protection.physical.rear, undefined, 'no protection behind: the shield and the Standard are front-only');
});

test('a Swordsman shield is directional; Mage ward is party-wide Magic for every member', () => {
  const fx = scenario({ matchId: 'insp', parties: [{ id: 'A.p', owner: 'A', mount: 'castle', column: 5, row: 5, slots: { 5: 'center', 2: 'swordsman', 6: 'mage', 8: 'archer' } }] });
  const sw = memberFacts(fx.state, fx.ctx, 'A.p.s2');
  assert.deepEqual(Object.keys(sw.protection.physical), ['front']);
  assert.equal(sw.protection.physical.front.total, 1);
  const archer = memberFacts(fx.state, fx.ctx, 'A.p.s8');
  assert.equal(archer.protection.magic.rear.total, 1, 'the Mage ward covers the Archer');
  assert.equal(archer.protection.magic.rear.base, 0, '…as an applied party layer, not the Archer\'s own');
  assert.deepEqual(archer.attacks[0], { id: 'bow', kind: 'ranged', hits: 2, power: 1, channel: 'physical', range: 2, elevationAware: true, needsArc: true, charge: false, face: 'above' });
});

test('health follows the profile: member health, or one shared party pool', () => {
  const ind = scenario({ matchId: 'h1', parties: [{ id: 'A.p', owner: 'A', mount: 'castle', column: 5, row: 5, slots: { 5: 'center', 2: 'swordsman' } }] });
  assert.deepEqual(memberFacts(ind.state, ind.ctx, 'A.p.s2').health, { mode: 'member', hp: 3 * U, max: 3 * U });
  const pool = scenario({ profileId: 'hapa_open_10x9_v3_01_party_maintenance', matchId: 'h2', parties: [{ id: 'A.p', owner: 'A', mount: 'castle', column: 5, row: 5, slots: { 5: 'center', 2: 'swordsman' } }] });
  const h = memberFacts(pool.state, pool.ctx, 'A.p.s2').health;
  assert.equal(h.mode, 'party_pool');
  assert.equal(h.partyId, 'A.p');
  assert.equal(h.max, pool.state.parties['A.p'].pool.max);
});

test('line defense: the shared front line value is the sum of the line members\' line-scope protection', () => {
  const fx = scenario({ profileId: 'hapa_open_10x9_v3_01_line_attacker', matchId: 'line', parties: [{ id: 'A.p', owner: 'A', mount: 'castle', column: 5, row: 5, slots: { 5: 'center', 1: 'swordsman', 2: 'swordsman', 3: 'swordsman' } }] });
  assert.equal(memberFacts(fx.state, fx.ctx, 'A.p.s1').protectionMode, 'line');
  const line = partyLineProtection(fx.state, fx.ctx, 'A.p', 'physical', 'front');
  assert.equal(line.total, 4, 'three shields and the center guard');
  assert.equal(line.sources.filter((s) => s.scope === 'line').length, 4);
});

test('ranged preview is target-dependent and comes from the rules (elevation-aware Archer)', () => {
  const fx = UI_FIXTURES.terrain.build(); // A.hill Archers on a +2 hill; B.walk on open ground nearby
  const s = fx.state;
  const archer = Object.values(s.parties['A.hill'].slots).find((id) => id && s.members[id].archetype === 'archer');
  const pv = rangedPreview(s, fx.ctx, archer, 'bow', 'B.walk');
  assert.equal(pv.preview, true);
  assert.equal(pv.elevation, 'target_lower');
  assert.deepEqual([pv.basePower, pv.power, pv.baseRange, pv.range], [1, 2, 2, 3], 'shooting down: +1 power, +1 range');
  assert.equal(pv.face, 'above');
});

test('playback-time health applies only the hits already shown', () => {
  const sess = createFixtureSession(UI_FIXTURES.response.build(), { id: 'response', title: 'r' });
  openTick(sess);
  const before = clone(sess.state);
  const r = closeTick(sess, { A: [{ type: 'play_ability', cardId: 'A.ember', actorPartyId: 'A.c', target: { memberId: 'B.c.s2' }, burns: ['A.red'] }], B: [] }, () => ({ pass: true }));
  const i = r.events.findIndex((e) => e.type === 'card_damage');
  assert.ok(i >= 0);
  const early = healthAt(before, r.events, i);
  const late = healthAt(before, r.events, r.events.length);
  assert.equal(early.hp['B.c.s2'], before.members['B.c.s2'].hp, 'before the hit is shown, health is the pre-Tick value');
  assert.equal(late.hp['B.c.s2'], sess.state.members['B.c.s2'].hp, 'after every event, it matches the accepted state');
});

test('party facts: a five-member Pawn reports an empty center and no Mount', () => {
  const fx = scenario({ matchId: 'pawn', keep: ['A.pawn.C1'], parties: [] });
  const f = partyFacts(fx.state, fx.ctx, 'A.pawn.C1');
  assert.equal(f.mount, null);
  assert.equal(f.centerEmpty, true);
  assert.equal(f.living, 5);
  assert.equal(f.slots[5], null);
});
