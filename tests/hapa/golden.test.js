// Golden fixtures and acceptance scenarios (Master Requirements v3 ch.18; References Master ch.3).
// Expectations are stated from the documents, not from what the implementation outputs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beginCount, runTick, validatePlan } from '../../src/hapa/rules/match.js';
import { activeColumnsAt, roundOf, nextActivation, mintForecast, planPayment, supplyOf } from '../../src/hapa/rules/economy.js';
import { planRoute } from '../../src/hapa/rules/movement.js';
import { residual, individualProtection } from '../../src/hapa/rules/combat.js';
import { stateFingerprint } from '../../src/hapa/rules/state.js';
import { opening, scenario, MIRRORED_QUEEN } from '../../fixtures/hapa/scenarios.js';

const U = 1_000_000;
const tick = (fx, plans = { A: [], B: [] }, choose) => {
  const minted = beginCount(fx.state, fx.ctx);
  const r = runTick(fx.state, fx.ctx, plans, choose);
  return { minted, events: r.events, choices: r.choices };
};
const living = (state, partyId) => Object.values(state.parties[partyId].slots).filter((id) => id && state.members[id].alive);

test('Round boundaries: prologue 1–4, Round 1 = 5–13, Round 2 begins at 14', () => {
  const { ctx } = opening();
  const p = ctx.profile;
  assert.deepEqual([1, 2, 3, 4].map((t) => roundOf(p, t).period), ['prologue', 'prologue', 'prologue', 'prologue']);
  assert.equal(roundOf(p, 5).round, 1);
  assert.equal(roundOf(p, 13).round, 1);
  assert.equal(roundOf(p, 14).round, 2);
  assert.deepEqual(activeColumnsAt(p, 1), [1, 9]);
  assert.deepEqual(activeColumnsAt(p, 5), [5]);
  assert.deepEqual(activeColumnsAt(p, 9), [1, 9]);
  assert.deepEqual(activeColumnsAt(p, 10), [1, 9]);
  assert.deepEqual(activeColumnsAt(p, 14), [5]);
  assert.equal(nextActivation(p, 4, 4), 6); // C4 mints again within Round 1
});

test('Empty opening hand: Tick 1 mints two rank-2 Wands, Supply 2, Mana 0, into C1 and C9', () => {
  const fx = opening();
  beginCount(fx.state, fx.ctx);
  for (const seat of ['A', 'B']) {
    const bank = fx.state.players[seat].bank.minor;
    const ids = Object.values(bank).filter(Boolean);
    assert.equal(ids.length, 2);
    for (const id of ids) {
      const c = fx.state.cards[id];
      assert.equal(c.suit, 'wands');
      assert.equal(c.rank, 2);
      assert.equal(c.supply, 2 * U);
      assert.deepEqual(c.mana, {});
    }
    assert.ok(bank['1'] && bank['9']);
  }
});

test('Clock and storage: 2, 4, 6, 8, 9 slots after five Ticks; a full Round mints 17 per player', () => {
  const fx = opening();
  const filled = [];
  for (let t = 1; t <= 5; t++) { tick(fx); filled.push(Object.values(fx.state.players.A.bank.minor).filter(Boolean).length); }
  assert.deepEqual(filled, [2, 4, 6, 8, 9]);
  let mints = 0;
  for (let t = 6; t <= 13; t++) {
    const r = tick(fx);
    mints += r.minted.filter((e) => e.type === 'card_minted' && e.seat === 'A').length;
  }
  // Tick 5 minted 1 (C5); Ticks 6–13 mint 16
  assert.equal(mints + 1, 17);
});

test('Opening merge: Castle loads the 2 of Wands, advances one square, merges with its Pawn (9 members, Supply 1)', () => {
  const fx = opening();
  beginCount(fx.state, fx.ctx);
  const plans = {
    A: [{ type: 'load_supply', cardId: 'A.C1.T1.0', partyId: 'A.mount.C1' }, { type: 'set_destination', partyId: 'A.mount.C1', target: { column: 1, row: 2 } }],
    B: [{ type: 'load_supply', cardId: 'B.C1.T1.0', partyId: 'B.mount.C1' }, { type: 'set_destination', partyId: 'B.mount.C1', target: { column: 9, row: 9 } }],
  };
  assert.ok(validatePlan(fx.state, fx.ctx, 'A', plans.A).ok);
  const r = runTick(fx.state, fx.ctx, plans);
  for (const [seat, id, pawn] of [['A', 'A.mount.C1', 'A.pawn.C1'], ['B', 'B.mount.C1', 'B.pawn.C1']]) {
    const P = fx.state.parties[id];
    assert.equal(living(fx.state, id).length, 9, `${seat} members`);
    assert.equal(supplyOf(P), 1 * U, `${seat} Supply`);
    assert.equal(P.destination, null);
    assert.equal(fx.state.parties[pawn].retired, true);
    // every original member kept its identity
    assert.ok(['p1', 'p2', 'p3', 'p7', 'p9', 'm4', 'm5', 'm6', 'm8'].every((s) => fx.state.members[`${seat}.C1.${s}`].party === id));
    assert.equal(fx.state.cards[`${seat}.C1.T1.0`].state, 'supply');
  }
  assert.ok(r.events.some((e) => e.type === 'parties_merged'));
  // the consumed instance cannot be used again
  const again = validatePlan(fx.state, fx.ctx, 'A', [{ type: 'burn', cardId: 'A.C1.T1.0' }]);
  assert.equal(again.ok, false);
});

test('Resource curve: R2 → 2 of Wands, no Mana; R6 → rank 6 with 3 Red + 1 Green and per-row provenance', () => {
  const fx = scenario({ parties: [{ id: 'A.x', owner: 'A', mount: 'castle', column: 1, row: 6, slots: { 5: 'center' } }] });
  const f = mintForecast(fx.state, fx.ctx, 'A', 1);
  assert.equal(f.rank, 6);
  assert.equal(f.supply, 6 * U);
  assert.deepEqual(f.mana, { red: 3, green: 1 });
  assert.deepEqual(f.pips.map((p) => [p.row, p.color]), [[3, 'red'], [4, 'red'], [5, 'red'], [6, 'green']]);
  const fx2 = scenario({ parties: [{ id: 'A.y', owner: 'A', mount: null, column: 1, row: 2, slots: { 1: 'swordsman' } }] });
  const g = mintForecast(fx2.state, fx2.ctx, 'A', 1);
  assert.equal(g.rank, 2);
  assert.deepEqual(g.mana, {});
});

test('Three board profiles and deployment Mana', () => {
  const nine = scenario({ profileId: 'hapa_open_9x9_v3_01', parties: [{ id: 'A.x', owner: 'A', mount: 'castle', column: 1, row: 5, slots: { 5: 'center' } }] });
  assert.deepEqual(mintForecast(nine.state, nine.ctx, 'A', 1).mana, { red: 3, green: 1 }); // R3, R4 red; dual R5 red + green
  const eleven = scenario({ profileId: 'hapa_open_11x9_v3_01', parties: [{ id: 'A.x', owner: 'A', mount: 'castle', column: 5, row: 6, slots: { 5: 'center' } }] });
  assert.deepEqual(mintForecast(eleven.state, eleven.ctx, 'A', 5).mana, { rainbow: 5 }); // R3–R5 + dual R6 → two Rainbow
  const dep = scenario({ profileId: 'hapa_open_10x9_v3_01_deploy_mana', parties: [{ id: 'A.y', owner: 'A', column: 1, row: 2, slots: { 1: 'swordsman' } }] });
  const f = mintForecast(dep.state, dep.ctx, 'A', 1);
  assert.equal(f.supply, 2 * U); // the Supply curve is unchanged
  assert.deepEqual(f.mana, { red: 2 });
});

test('Center cutoff: A at R2 and R7, B at R5 and R9 → each side falls back to its own R2', () => {
  const mk = (id, owner, row) => ({ id, owner, mount: 'castle', column: 1, row, slots: { 5: 'center' } });
  const fx = scenario({ parties: [mk('A.r2', 'A', 2), mk('A.r7', 'A', 7), mk('B.r5', 'B', 5), mk('B.r9', 'B', 9)] });
  assert.equal(mintForecast(fx.state, fx.ctx, 'A', 1).frontierParty, 'A.r2');
  assert.equal(mintForecast(fx.state, fx.ctx, 'B', 1).frontierParty, 'B.r9');
  assert.equal(mintForecast(fx.state, fx.ctx, 'B', 1).rank, 2);
  // a stray retainer never substitutes for a center: only party anchors count
  const fx2 = scenario({ parties: [mk('A.r6', 'A', 6), { id: 'B.side', owner: 'B', mount: 'castle', column: 2, row: 4, slots: { 4: 'swordsman' } }] });
  assert.equal(mintForecast(fx2.state, fx2.ctx, 'A', 1).frontierParty, 'A.r6');
});

test('Replacement and exclusive use', () => {
  const fx = opening();
  for (let t = 1; t <= 8; t++) tick(fx);
  const old = fx.state.players.A.bank.minor['1'];
  tick(fx); // Tick 9 activates C1 again
  const now = fx.state.players.A.bank.minor['1'];
  assert.notEqual(old, now);
  assert.equal(fx.state.cards[old].state, 'replaced');
  assert.equal(validatePlan(fx.state, fx.ctx, 'A', [{ type: 'burn', cardId: old }]).ok, false);
  // load then burn the same instance: the second use fails deterministically
  const v = validatePlan(fx.state, fx.ctx, 'A', [{ type: 'load_supply', cardId: now, partyId: 'A.pawn.C3' }, { type: 'burn', cardId: now }]);
  assert.equal(v.accepted.length, 1);
  assert.match(v.errors[0].error, /no longer available \(supply\)/);
  // Supply may go to a party in an inactive column; an unmounted Pawn stores it but cannot move
  assert.equal(validatePlan(fx.state, fx.ctx, 'A', [{ type: 'set_destination', partyId: 'A.pawn.C1', target: { column: 1, row: 3 } }]).errors[0].error.includes('unmounted Pawn'), true);
});

test('Cross-column payment: 3 Red + 3 Rainbow pays 4 Red leaving 2 Rainbow; Rainbow-only needs Rainbow', () => {
  const pay = planPayment({ red: 3, rainbow: 3 }, { red: 4 });
  assert.deepEqual(pay.remaining, { red: 0, rainbow: 2 });
  assert.equal(planPayment({ blue: 5 }, { rainbow_only: 1 }), null);
  const both = planPayment({ blue: 3, rainbow: 1 }, { blue: 3, rainbow_only: 1 });
  assert.ok(both);
  assert.deepEqual(both.remaining, { blue: 0, rainbow: 0 });
});

test('Directional hits: front Defense does not cover Above; per-hit floors', () => {
  assert.equal(residual(U, 1, [1, 1], 1) * 2, 0); // two 1-point hits vs Defense 1
  assert.equal(residual(U, 2, [1, 1], 1) * 2, 2 * U); // two 2-point hits vs Defense 1
  assert.equal(residual(U, 3, [1, 2], 1), 500_000); // uphill ½ impact: 1.5 − 1 = 0.5 HP
  const fx = scenario({ parties: [{ id: 'A.s', owner: 'A', column: 1, row: 3, slots: { 1: 'swordsman' } }] });
  const m = fx.state.members['A.s.s1'];
  assert.equal(individualProtection(fx.state, fx.ctx, m, 'physical', 'front').total, 1);
  assert.equal(individualProtection(fx.state, fx.ctx, m, 'physical', 'above').total, 0);
  assert.equal(individualProtection(fx.state, fx.ctx, m, 'magic', 'front').total, 0);
});

test('Knight travel: the L route costs 3, goes long axis then short, and takes 1.5 Ticks at Speed 2', () => {
  const fx = scenario({ parties: [{ id: 'A.k', owner: 'A', mount: 'knight', column: 2, row: 2, slots: { 5: 'center' }, supply: 3 }] });
  const plan = planRoute(fx.ctx, 'knight', { column: 2, row: 2 }, { column: 3, row: 4 });
  assert.equal(plan.cost, 3);
  assert.deepEqual(plan.route, [{ column: 2, row: 3 }, { column: 2, row: 4 }, { column: 3, row: 4 }]);
  fx.state.tick = 1; fx.state.activeColumns = [2, 8]; fx.state.phase = 'planning';
  runTick(fx.state, fx.ctx, { A: [{ type: 'set_destination', partyId: 'A.k', target: { column: 3, row: 4 } }], B: [] });
  const k = fx.state.parties['A.k'];
  assert.deepEqual([k.x, k.y], [6 * U, 14 * U]); // R4C2 after one Tick
  tick(fx); // continues outside the highlighted columns
  assert.deepEqual([k.x, k.y], [10 * U, 14 * U]);
  assert.equal(supplyOf(k), 0);
});

test('Persistent destination: travel continues outside highlighted columns; a new order replaces it', () => {
  const fx = scenario({ parties: [{ id: 'A.c', owner: 'A', mount: 'castle', column: 1, row: 3, slots: { 5: 'center' }, supply: 4 }] });
  fx.state.tick = 0;
  tick(fx, { A: [{ type: 'set_destination', partyId: 'A.c', target: { column: 1, row: 7 } }], B: [] });
  for (let t = 0; t < 3; t++) tick(fx);
  const c = fx.state.parties['A.c'];
  assert.deepEqual(c.region, { column: 1, row: 7 });
  assert.equal(c.destination, null);
  assert.equal(supplyOf(c), 0);
});

test('Queen/Knight diagnostic: first touch at quantum 125 with the Queen shifted half a member width', () => {
  const full = { 1: 'swordsman', 2: 'swordsman', 3: 'swordsman', 4: 'swordsman', 5: 'center', 6: 'swordsman', 7: 'swordsman', 8: 'swordsman', 9: 'swordsman' };
  const fx = scenario({ parties: [
    { id: 'A.queen', owner: 'A', mount: 'queen', column: 5, row: 5, facing: 'W', slots: full, supply: 5 },
    { id: 'B.knight', owner: 'B', mount: 'knight', column: 5, row: 6, facing: 'S', slots: full, supply: 5 },
  ] });
  fx.state.tick = 5; fx.state.activeColumns = [5]; fx.state.phase = 'planning';
  const r = runTick(fx.state, fx.ctx, { A: [{ type: 'set_destination', partyId: 'A.queen', target: { column: 3, row: 5 } }], B: [{ type: 'set_destination', partyId: 'B.knight', target: { column: 4, row: 4 } }] });
  const contact = r.events.find((e) => e.type === 'contact');
  assert.ok(contact, 'a contact was recorded');
  assert.equal(contact.quantum, 125);
  assert.equal(contact.attacker, 'B.knight');
  assert.equal(contact.defender, 'A.queen');
  assert.equal(contact.anchors['A.queen'].x, 18 * U - 500_000);
  // the Knight stops at the enemy (one member width travelled) instead of leaping through
  assert.equal(contact.anchors['B.knight'].y, 21 * U);
  assert.ok(r.events.some((e) => e.type === 'exchange' && e.cause === 'first_contact'));
});

function mirrored(profileId, slots = MIRRORED_QUEEN, allocationPolicies) {
  const fx = scenario({ profileId, allocationPolicies, parties: [
    // a quarter Supply closes the one-member gap, so the fight stays at its first contact
    { id: 'A.q', owner: 'A', mount: 'queen', column: 5, row: 5, slots, supply: 0.25 },
    { id: 'B.q', owner: 'B', mount: 'queen', column: 5, row: 6, slots, supply: 3 },
  ] });
  fx.state.tick = 5; fx.state.activeColumns = [5]; fx.state.phase = 'planning';
  const r = runTick(fx.state, fx.ctx, { A: [{ type: 'set_destination', partyId: 'A.q', target: { column: 5, row: 6 } }], B: [] });
  const ex = r.events.find((e) => e.type === 'exchange');
  return { fx, ex, events: r.events };
}

test('Mirrored Swordsmen, individual Defense: every front Swordsman takes 2', () => {
  const { fx, ex } = mirrored(undefined, { 5: 'center', 1: 'swordsman', 2: 'swordsman', 3: 'swordsman' });
  const sword = ex.hits.filter((h) => h.attack === 'sword');
  assert.equal(sword.length, 6);
  assert.ok(sword.every((h) => h.damage === 2 * U && h.face === 'front'));
  for (const id of ['A.q.s1', 'A.q.s2', 'A.q.s3', 'B.q.s1', 'B.q.s2', 'B.q.s3']) assert.equal(fx.state.members[id].hp, 1 * U);
});

test('Mirrored Queen with Archers, individual: six Above arrows finish the 1-HP Swordsmen first', () => {
  const { fx, ex } = mirrored();
  const arrows = ex.hits.filter((h) => h.attack === 'bow');
  assert.equal(arrows.length, 12); // three Archers × two hits, each side
  assert.ok(arrows.every((h) => h.face === 'above' && h.protection === 0 && h.damage === U));
  for (const s of ['A', 'B']) {
    assert.deepEqual(['s1', 's2', 's3'].map((x) => fx.state.members[`${s}.q.${x}`].alive), [false, false, false]);
    assert.equal(fx.state.members[`${s}.q.s5`].hp, 3 * U);
  }
});

test('Shared line Defense 3 stops every 3-point sword hit; six arrows deal 6 (attacker allocation)', () => {
  const { fx, ex } = mirrored('hapa_open_10x9_v3_01_line_attacker');
  assert.ok(ex.hits.filter((h) => h.attack === 'sword').every((h) => h.protection === 3 && h.damage === 0));
  const arrowDamage = ex.hits.filter((h) => h.attack === 'bow' && fx.state.members[h.recipient].owner === 'A').reduce((a, h) => a + h.damage, 0);
  assert.equal(arrowDamage, 6 * U);
  assert.deepEqual(['s1', 's2', 's3'].map((x) => fx.state.members[`A.q.${x}`].alive), [false, false, true]);
});

test('Defender allocation with a center-first standing policy puts all six arrows on the Queen', () => {
  const { fx, ex } = mirrored('hapa_open_10x9_v3_01_line_defender', MIRRORED_QUEEN, { A: 'center_first', B: 'slot_order' });
  const onA = ex.hits.filter((h) => h.attack === 'bow' && fx.state.members[h.recipient].owner === 'A');
  assert.ok(onA.every((h) => h.recipient === 'A.q.s5' && h.allocator === 'A'));
  assert.equal(fx.state.members['A.q.s5'].hp, 0);
  assert.equal(fx.state.members['A.q.s1'].alive, true); // the retainers are preserved
  // B allocated by slot order: two of its Swordsmen fell instead
  assert.deepEqual(['s1', 's2'].map((x) => fx.state.members[`B.q.${x}`].alive), [false, false]);
});

test('Party maintenance: 24-HP pool takes six arrows → 18; two retainers removed without a second debit', () => {
  const { fx, events } = mirrored('hapa_open_10x9_v3_01_party_maintenance');
  const P = fx.state.parties['A.q'];
  assert.deepEqual(P.pool, { hp: 18 * U, max: 24 * U });
  const removed = events.find((e) => e.type === 'maintenance_removed' && e.partyId === 'A.q');
  assert.deepEqual(removed.removed, ['A.q.s1', 'A.q.s2']);
  assert.equal(living(fx.state, 'A.q').length, 5);
});

test('Charge impact: Speed-2 approach doubles the first impact; the next exchange uses ordinary Attack', () => {
  const fx = scenario({ parties: [
    { id: 'A.wall', owner: 'A', mount: 'castle', column: 5, row: 5, slots: { 5: 'center', 2: 'swordsman' } },
    { id: 'B.k', owner: 'B', mount: 'knight', column: 5, row: 7, slots: { 5: 'center', 2: 'swordsman' }, supply: 3 },
  ] });
  fx.state.tick = 5; fx.state.activeColumns = [5]; fx.state.phase = 'planning';
  const r = runTick(fx.state, fx.ctx, { A: [], B: [{ type: 'set_destination', partyId: 'B.k', target: { column: 4, row: 5 } }] });
  const first = r.events.find((e) => e.type === 'exchange');
  const bHit = first.hits.find((h) => h.source === 'B.k.s2');
  assert.deepEqual(bHit.ratio, [2, 1]);
  assert.equal(bHit.damage, 5 * U); // 3 × 2 − 1
  const aHit = first.hits.find((h) => h.source === 'A.wall.s2');
  assert.deepEqual(aHit.ratio, [1, 1]);
});

test('Pike entrenchment transfers a charge multiplier to the stationary Pike', () => {
  const fx = scenario({ parties: [
    { id: 'A.pk', owner: 'A', mount: 'castle', column: 5, row: 5, slots: { 5: 'center', 2: 'pikeman' } },
    { id: 'B.k', owner: 'B', mount: 'knight', column: 5, row: 7, slots: { 5: 'center', 2: 'swordsman' }, supply: 3 },
  ] });
  fx.state.tick = 5; fx.state.activeColumns = [5]; fx.state.phase = 'planning';
  const r = runTick(fx.state, fx.ctx, { A: [], B: [{ type: 'set_destination', partyId: 'B.k', target: { column: 4, row: 5 } }] });
  const ex = r.events.find((e) => e.type === 'exchange');
  assert.deepEqual(ex.hits.find((h) => h.source === 'B.k.s2').ratio, [1, 1]);
  const pike = ex.hits.find((h) => h.source === 'A.pk.s2');
  assert.deepEqual(pike.ratio, [2, 1]);
  assert.equal(pike.pikeTransfer, true);
});

test('Victory: an enemy center entering the fixed Capital captures it', () => {
  const fx = scenario({ keep: ['B.mount.C5'], parties: [{ id: 'B.c', owner: 'B', mount: 'castle', column: 5, row: 3, slots: { 5: 'center' }, supply: 3 }] });
  fx.state.tick = 5; fx.state.activeColumns = [5]; fx.state.phase = 'planning';
  runTick(fx.state, fx.ctx, { A: [], B: [{ type: 'set_destination', partyId: 'B.c', target: { column: 5, row: 1 } }] });
  tick(fx);
  assert.equal(fx.state.outcome?.result, 'win');
  assert.equal(fx.state.outcome.winner, 'B');
  assert.equal(fx.state.outcome.reasons[0].reason, 'capital_captured');
});

test('Victory: simultaneous Commander deaths draw', () => {
  const fx = scenario({ keep: [], parties: [
    { id: 'A.cmd', owner: 'A', mount: 'commander', commander: true, column: 5, row: 5, slots: { 5: 'center' }, supply: 2 },
    { id: 'B.cmd', owner: 'B', mount: 'commander', commander: true, column: 5, row: 6, slots: { 5: 'center' } },
  ] });
  fx.state.members['A.cmd.s5'].hp = U; fx.state.members['B.cmd.s5'].hp = U;
  fx.state.tick = 5; fx.state.activeColumns = [5]; fx.state.phase = 'planning';
  runTick(fx.state, fx.ctx, { A: [{ type: 'set_destination', partyId: 'A.cmd', target: { column: 5, row: 6 } }], B: [] });
  assert.equal(fx.state.outcome?.result, 'draw');
});

test('A counter can be countered; the original Ember Strike then resolves (public_stack_v1)', () => {
  const fx = scenario({ parties: [
    { id: 'A.c', owner: 'A', mount: 'castle', column: 1, row: 4, slots: { 5: 'center' } },
    { id: 'B.c', owner: 'B', mount: 'castle', column: 1, row: 5, slots: { 5: 'center', 2: 'swordsman' } },
    { id: 'B.far', owner: 'B', mount: 'castle', column: 7, row: 9, slots: { 5: 'center' } },
  ] });
  const s = fx.state;
  s.tick = 1; s.activeColumns = [1, 9]; s.phase = 'planning';
  const card = (id, owner, column, abilityId) => {
    s.cards[id] = { id, owner, column, localColumn: column, tick: 1, suit: 'x', rank: 2, supply: 2 * U, mana: {}, pips: [], ability: `${abilityId}@1`, abilityId, state: 'available' };
    s.players[owner].bank.minor[String(column)] = id;
  };
  card('A.ember', 'A', 1, 'fixture.ember_strike');
  card('A.deny', 'A', 3, 'fixture.blue_denial');
  card('B.deny', 'B', 7, 'fixture.blue_denial');
  s.players.A.pool = { red: 2, blue: 2 };
  s.players.B.pool = { blue: 2 };
  const script = [
    (req) => (req.seat === 'B' ? { cardId: 'B.deny', actorPartyId: 'B.far', target: { stackId: req.stack[0].id } } : null),
    (req) => (req.seat === 'A' ? { cardId: 'A.deny', actorPartyId: 'A.c', target: { stackId: req.stack[1].id } } : null),
  ];
  let i = 0;
  const choose = (req) => script[i++]?.(req) ?? { pass: true };
  const r = runTick(s, fx.ctx, { A: [{ type: 'play_ability', cardId: 'A.ember', actorPartyId: 'A.c', target: { memberId: 'B.c.s2' } }], B: [] }, choose);
  const types = r.events.map((e) => e.type);
  assert.ok(types.includes('counter_applied'));
  assert.ok(types.includes('ability_countered'));
  const dmg = r.events.find((e) => e.type === 'card_damage');
  assert.equal(dmg.recipient, 'B.c.s2');
  assert.equal(dmg.damage, 2 * U); // 2 Magic from the Front; Swordsman has no Magic Defense
  assert.equal(s.members['B.c.s2'].hp, 1 * U);
  for (const id of ['A.ember', 'A.deny', 'B.deny']) assert.equal(s.cards[id].state, 'played'); // no refund
  assert.equal(r.choices[0].request.seat, 'B'); // the opponent responds first
});

test('Bound Standard follows its Bishop; Column Standard stays on its column', () => {
  const fx = opening(undefined, { majors: { 3: 'fixture.bound_standard', 1: 'fixture.column_standard' } });
  const s = fx.state;
  const bishop = s.parties['A.mount.C3'];
  const center = s.members['A.C3.m5'];
  assert.equal(individualProtection(s, fx.ctx, center, 'physical', 'front').total, 2);
  bishop.region = { column: 4, row: 2 };
  assert.equal(individualProtection(s, fx.ctx, center, 'physical', 'front').total, 2); // the bound bonus follows
  const knight = s.parties['A.mount.C2'];
  knight.region = { column: 3, row: 1 };
  assert.equal(individualProtection(s, fx.ctx, s.members['A.C2.m5'], 'physical', 'front').total, 1); // no Bishop bonus
  knight.region = { column: 1, row: 1 };
  assert.equal(individualProtection(s, fx.ctx, s.members['A.C2.m5'], 'physical', 'front').total, 2); // column bonus
  assert.equal(individualProtection(s, fx.ctx, s.members['A.C2.m5'], 'physical', 'above').total, 0);
});

test('Row Mana Double doubles only that row: 3 Red + 1 Green → 3 Red + 2 Green', () => {
  const fx = scenario({ parties: [{ id: 'A.x', owner: 'A', mount: 'castle', column: 1, row: 6, slots: { 5: 'center' } }] });
  fx.state.effects['F.test'] = { id: 'F.test', owner: 'A', op: 'mint_row_multiplier', row: 6, factor: 2, active: true };
  assert.deepEqual(mintForecast(fx.state, fx.ctx, 'A', 1).mana, { red: 3, green: 2 });
});

test('Determinism: the same opening plans give the same fingerprint twice', () => {
  const run = () => {
    const fx = opening();
    for (let t = 1; t <= 6; t++) {
      beginCount(fx.state, fx.ctx);
      const plans = { A: [], B: [] };
      for (const seat of ['A', 'B']) for (const id of Object.values(fx.state.players[seat].bank.minor).filter(Boolean)) {
        const c = fx.state.cards[id];
        plans[seat].push({ type: 'load_supply', cardId: id, partyId: `${seat}.mount.C${c.localColumn}` });
      }
      runTick(fx.state, fx.ctx, plans);
    }
    return stateFingerprint(fx.state);
  };
  assert.equal(run(), run());
});

test('Breach: a casualty leaves a gap; its opponent steps one slot in and meets Archer 4 ahead and Swordsman 2 on the flank', () => {
  // the Chapter 7 example: Swordsmen 1–3, Archers 4 and 6, a Queen in 5
  const fx = scenario({ parties: [
    { id: 'A.att', owner: 'A', mount: 'castle', column: 5, row: 5, slots: { 5: 'center', 1: 'swordsman', 2: 'swordsman', 3: 'swordsman' }, supply: 0.25 },
    { id: 'B.def', owner: 'B', mount: 'queen', column: 5, row: 6, slots: { 5: 'center', 1: 'swordsman', 2: 'swordsman', 3: 'swordsman', 4: 'archer', 6: 'archer' } },
  ] });
  fx.state.members['B.def.s1'].hp = 1; // B's Swordsman 1 falls in the first exchange
  for (const x of ['s1', 's2', 's3']) fx.state.members[`A.att.${x}`].hp = 20 * U; // (fixture) A's front survives the Archers
  fx.state.tick = 5; fx.state.activeColumns = [5]; fx.state.phase = 'planning';
  runTick(fx.state, fx.ctx, { A: [{ type: 'set_destination', partyId: 'A.att', target: { column: 5, row: 6 } }], B: [] });
  assert.equal(fx.state.members['B.def.s1'].alive, false);
  const r = tick(fx);
  const breach = r.events.find((e) => e.type === 'breach_advanced');
  assert.ok(breach, 'a member advanced into the gap');
  assert.equal(breach.memberId, 'A.att.s3'); // the Swordsman opposite B's slot 1 (mirrored facing)
  assert.equal(breach.intoSlot, 1);
  const anchor = fx.state.parties['A.att'];
  assert.deepEqual([anchor.region.column, anchor.region.row], [5, 5]); // the party center did not move
  const ex = r.events.find((e) => e.type === 'exchange');
  const targets = ex.hits.filter((h) => h.source === 'A.att.s3').map((h) => h.recipient).sort();
  assert.deepEqual(targets, ['B.def.s2', 'B.def.s4']); // flank Swordsman 2 and Archer 4 ahead
  assert.equal(r.events.filter((e) => e.type === 'breach_advanced').length, 1); // no cascade
});

test('Retreat: only touching own members die; the attacker follows into the vacated territory at no Supply', () => {
  const fx = scenario({ parties: [
    { id: 'A.att', owner: 'A', mount: 'castle', column: 5, row: 5, slots: { 5: 'center', 2: 'swordsman' }, supply: 0.25 },
    { id: 'B.def', owner: 'B', mount: 'castle', column: 5, row: 6, slots: { 5: 'center', 2: 'swordsman', 8: 'archer' }, supply: 2 },
  ] });
  fx.state.members['A.att.s2'].hp = 20 * U; // (fixture) the attacker's front survives
  fx.state.members['B.def.s2'].hp = 20 * U; // (fixture) so the retreat itself, not the exchange, kills it
  fx.state.tick = 5; fx.state.activeColumns = [5]; fx.state.phase = 'planning';
  runTick(fx.state, fx.ctx, { A: [{ type: 'set_destination', partyId: 'A.att', target: { column: 5, row: 6 } }], B: [] });
  fx.state.tick = 13; // C5 is active again at Tick 14
  const r = tick(fx, { A: [], B: [{ type: 'retreat', partyId: 'B.def', target: { column: 5, row: 8 } }] });
  const ret = r.events.find((e) => e.type === 'retreated');
  assert.deepEqual(ret.lost, ['B.def.s2']); // the touching Swordsman; the untouched Archer lives
  assert.equal(fx.state.members['B.def.s8'].alive, true);
  assert.ok(r.events.some((e) => e.type === 'follow_started' && e.partyId === 'A.att'));
  assert.equal(supplyOf(fx.state.parties['A.att']), 0); // it had none left, yet it follows
  assert.ok(fx.state.parties['A.att'].y > 18 * U); // advanced toward the vacated R6
});

test('Row Mana Double placed through its Card doubles only R6 at the next mint (end to end)', () => {
  const fx = scenario({ parties: [{ id: 'A.x', owner: 'A', mount: 'castle', column: 1, row: 6, slots: { 5: 'center' } }] });
  const s = fx.state;
  s.tick = 1; s.activeColumns = [1, 9]; s.phase = 'planning';
  s.cards['A.rmd'] = { id: 'A.rmd', owner: 'A', column: 5, localColumn: 5, tick: 1, suit: 'wildcard', rank: 2, supply: 2 * U, mana: {}, pips: [], ability: 'fixture.row_mana_double@1', abilityId: 'fixture.row_mana_double', state: 'available' };
  s.players.A.bank.minor['5'] = 'A.rmd';
  s.players.A.pool = { blue: 2 };
  const r = runTick(s, fx.ctx, { A: [{ type: 'play_ability', cardId: 'A.rmd', actorPartyId: 'A.x', target: { row: 6 } }], B: [] });
  assert.ok(r.events.some((e) => e.type === 'enchantment_placed' && e.row === 6));
  assert.equal(s.players.A.bank.rows['6'], 'A.rmd');
  // a newly placed production Enchantment first affects a later mint
  const next = tick(fx); // Tick 2 mints C2/C8 — the next C1 mint is Tick 9
  void next;
  for (let t = 3; t <= 9; t++) tick(fx);
  const card = s.cards[s.players.A.bank.minor['1']];
  assert.deepEqual(card.mana, { red: 3, green: 2 });
  assert.deepEqual(card.pips.find((p) => p.row === 6).multipliers, ['F.A.rmd']);
  // an own-half row is refused
  s.players.A.pool = { blue: 2 };
  s.cards['A.rmd2'] = { ...s.cards['A.rmd'], id: 'A.rmd2', state: 'available' };
  s.players.A.bank.minor['5'] = 'A.rmd2';
  const v = validatePlan(s, fx.ctx, 'A', [{ type: 'play_ability', cardId: 'A.rmd2', actorPartyId: 'A.x', target: { row: 4 } }]);
  assert.match(v.errors[0].error, /enemy-half Mana row/);
});
