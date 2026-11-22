// HV-19 — corner helpers (Master Requirements v3 ch.7 "Contact lines corners and breaches";
// Appendix A "Corner support" and "Helpers at retreat"). Expectations come from the documents.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beginCount, runTick } from '../../src/hapa/rules/match.js';
import { supplyOf } from '../../src/hapa/rules/economy.js';
import { scenario } from '../../fixtures/hapa/scenarios.js';

const U = 1_000_000;
const tick = (fx, plans = { A: [], B: [] }) => { beginCount(fx.state, fx.ctx); return runTick(fx.state, fx.ctx, plans).events; };

/**
 * A holds C5R5 with a stationary Castle and has a neighbour at C6R5; B's Queen advances from R6
 * into A's line. With the one-member gap, A's neighbouring corner Swordsman can only reach B by a
 * local step into the contact strip.
 */
function cornerFixture(profileId) {
  const fx = scenario({ profileId, parties: [
    { id: 'A.att', owner: 'A', mount: 'castle', column: 5, row: 5, slots: { 5: 'center', 1: 'swordsman', 2: 'swordsman', 3: 'swordsman' }, supply: 2 },
    { id: 'A.nbr', owner: 'A', mount: 'castle', column: 6, row: 5, slots: { 5: 'center', 1: 'swordsman', 3: 'swordsman' }, supply: 1 },
    { id: 'B.def', owner: 'B', mount: 'queen', column: 5, row: 6, slots: { 5: 'center', 1: 'swordsman', 2: 'swordsman', 3: 'swordsman' }, supply: 0.25 },
  ] });
  for (const m of Object.values(fx.state.members)) if (m.archetype === 'swordsman') { m.hp = 20 * U; m.maxHp = 20 * U; } // (fixture) no casualties
  for (const p of Object.values(fx.state.parties)) if (p.pool) p.pool = { hp: 100 * U, max: 100 * U }; // (fixture) no maintenance removals
  fx.state.tick = 5; fx.state.activeColumns = [5]; fx.state.phase = 'planning';
  return fx;
}

test('a neighbouring corner helper steps into the contact strip at zero time and Supply, keeping its identity', () => {
  const fx = cornerFixture();
  const s = fx.state;
  const before = { x: s.parties['A.nbr'].x, y: s.parties['A.nbr'].y, supply: supplyOf(s.parties['A.nbr']) };
  const home = { x: s.members['A.nbr.s1'].x, y: s.members['A.nbr.s1'].y };
  const ev = runTick(s, fx.ctx, { A: [], B: [{ type: 'set_destination', partyId: 'B.def', target: { column: 5, row: 5 } }] }).events;
  const contact = ev.find((e) => e.type === 'contact');
  const step = ev.find((e) => e.type === 'helper_stepped');
  assert.ok(contact && step, 'contact and a helper step');
  assert.equal(step.memberId, 'A.nbr.s1'); // the neighbour's corner (front-left) member
  assert.equal(step.helps, 'A.att');
  assert.equal(step.against, 'B.def');
  assert.equal(step.supplyCost, 0);
  assert.equal(step.quantum, contact.quantum); // during engagement setup, no simulation time
  const h = s.members['A.nbr.s1'];
  assert.ok(Math.max(Math.abs(h.x - home.x), Math.abs(h.y - home.y)) <= U, 'one local step at most');
  // its party anchor and Supply did not change; it keeps its home party and slot
  assert.equal(s.parties['A.nbr'].x, before.x);
  assert.equal(s.parties['A.nbr'].y, before.y);
  assert.equal(supplyOf(s.parties['A.nbr']), before.supply);
  assert.equal(h.party, 'A.nbr');
  assert.equal(h.homeParty, 'A.nbr');
  assert.equal(h.slot, 1);
  assert.equal(s.parties['A.nbr'].slots['1'], 'A.nbr.s1');
  // its hits reach B on the flank in the immediate first exchange; one record, contributing once
  const ex = ev.find((e) => e.type === 'exchange' && e.cause === 'first_contact');
  const mine = ex.hits.filter((hh) => hh.source === 'A.nbr.s1');
  const sword = fx.ctx.catalog.archetypes.swordsman.attacks.filter((a) => a.kind === 'melee').reduce((n, a) => n + a.hits, 0);
  assert.equal(mine.length, sword);
  assert.ok(mine.every((hh) => hh.recipient === 'B.def.s1' && hh.face === 'left'), JSON.stringify(mine));
  // B's touching member strikes back at the helper's one health record
  const back = ex.hits.filter((hh) => hh.recipient === 'A.nbr.s1');
  assert.ok(back.length > 0);
  assert.equal(h.hp, 20 * U - back.reduce((n, hh) => n + hh.damage, 0));
  // a blocked spot is never taken: no two living bodies overlap
  const bodies = Object.values(s.members).filter((m) => m.alive);
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    const a = bodies[i], b = bodies[j];
    assert.ok(!(Math.abs(a.x - b.x) < U && Math.abs(a.y - b.y) < U), `${a.id} overlaps ${b.id}`);
  }
  // the next Tick's scheduled exchange includes the helper's line once
  const ev2 = tick(fx);
  const sched = ev2.find((e) => e.type === 'exchange' && e.cause === 'scheduled');
  assert.equal(sched.hits.filter((hh) => hh.source === 'A.nbr.s1').length, sword);
  assert.equal(ev2.filter((e) => e.type === 'helper_stepped').length, 0); // it is already in place
});

test('when the supported party retreats, the living helper returns home; only the retreating party loses members', () => {
  const fx = cornerFixture();
  const s = fx.state;
  runTick(s, fx.ctx, { A: [], B: [{ type: 'set_destination', partyId: 'B.def', target: { column: 5, row: 5 } }] });
  const home = (() => { const N = s.parties['A.nbr']; return { x: N.x - U, y: N.y + U }; })(); // slot 1 facing N
  s.tick = 13; // C5 active again at Tick 14
  const ev = tick(fx, { A: [{ type: 'retreat', partyId: 'A.att', target: { column: 5, row: 3 } }], B: [] });
  const ret = ev.find((e) => e.type === 'retreated');
  assert.ok(ret);
  assert.ok(ret.lost.every((id) => id.startsWith('A.att.')), 'only own members die');
  assert.deepEqual(ret.helpersReturned, ['A.nbr.s1']);
  const h = s.members['A.nbr.s1'];
  assert.equal(h.alive, true);
  assert.equal(h.helperAway, null);
  assert.deepEqual({ x: h.x, y: h.y }, home);
  assert.ok(ev.some((e) => e.type === 'helper_returned' && e.memberId === 'A.nbr.s1' && e.cause === 'supported_party_retreated'));
  assert.ok(!Object.values(s.engagements).some((E) => E.a === 'A.nbr' || E.b === 'A.nbr'), 'its support engagement ended');
});

test("when the helper's own party retreats while it touches an enemy, it is sacrificed like any own member", () => {
  const fx = cornerFixture();
  const s = fx.state;
  runTick(s, fx.ctx, { A: [], B: [{ type: 'set_destination', partyId: 'B.def', target: { column: 5, row: 5 } }] });
  // the next Tick (6) activates C4/C6: A's neighbour withdraws
  const ev = tick(fx, { A: [{ type: 'retreat', partyId: 'A.nbr', target: { column: 6, row: 3 } }], B: [] });
  const ret = ev.find((e) => e.type === 'retreated' && e.partyId === 'A.nbr');
  assert.ok(ret, JSON.stringify(ev.filter((e) => e.type === 'command_rejected')));
  assert.ok(ret.lost.includes('A.nbr.s1'));
  assert.equal(s.members['A.nbr.s1'].alive, false);
  assert.equal(s.members['A.nbr.s3'].alive, true); // not touching: survives
});

test('in a party-pool profile a helper\'s damage debits its own home pool', () => {
  const fx = cornerFixture('hapa_open_10x9_v3_01_party_maintenance');
  const s = fx.state;
  const pools = () => ({ att: s.parties['A.att'].pool.hp, nbr: s.parties['A.nbr'].pool.hp });
  const before = pools();
  const ev = runTick(s, fx.ctx, { A: [], B: [{ type: 'set_destination', partyId: 'B.def', target: { column: 5, row: 5 } }] }).events;
  const ex = ev.find((e) => e.type === 'exchange' && e.cause === 'first_contact');
  const onHelper = ex.hits.filter((h) => h.recipient === 'A.nbr.s1' || (h.recipient?.startsWith('A.nbr.'))).reduce((n, h) => n + h.damage, 0);
  assert.ok(onHelper > 0);
  assert.equal(before.nbr - pools().nbr, onHelper);
  assert.equal(s.members['A.nbr.s1'].hp, s.members['A.nbr.s1'].maxHp); // no invented per-member share
});

test('corner support can be switched off by the profile', () => {
  const fx = cornerFixture();
  fx.ctx.profile.combat.cornerSupport.enabled = false;
  const ev = runTick(fx.state, fx.ctx, { A: [], B: [{ type: 'set_destination', partyId: 'B.def', target: { column: 5, row: 5 } }] }).events;
  assert.equal(ev.filter((e) => e.type === 'helper_stepped').length, 0);
});

test('a blocked return takes the nearest legal vacant home slot (then lowest number), never overlapping', () => {
  const fx = cornerFixture();
  const s = fx.state;
  runTick(s, fx.ctx, { A: [], B: [{ type: 'set_destination', partyId: 'B.def', target: { column: 5, row: 5 } }] });
  // (fixture) a body now stands in the helper's reserved home slot
  const N = s.parties['A.nbr'];
  s.members['A.blk.s5'] = { ...s.members['A.nbr.s5'], id: 'A.blk.s5', party: 'A.blk', homeParty: 'A.blk', commander: false, x: N.x - U, y: N.y + U };
  s.parties['A.blk'] = { ...N, id: 'A.blk', slots: { 1: null, 2: null, 3: null, 4: null, 5: 'A.blk.s5', 6: null, 7: null, 8: null, 9: null }, x: N.x - U, y: N.y + U, state: 'idle' };
  s.tick = 13;
  const ev = tick(fx, { A: [{ type: 'retreat', partyId: 'A.att', target: { column: 5, row: 3 } }], B: [] });
  const back = ev.find((e) => e.type === 'helper_returned');
  assert.ok(back);
  assert.equal(back.slot, 2); // slots 2 and 4 are equally near; the lower number wins
  assert.equal(back.homeSlot, 1);
  assert.equal(N.slots['2'], 'A.nbr.s1');
  assert.equal(N.slots['1'], null);
  assert.equal(s.members['A.nbr.s1'].alive, true);
});
