// HV-16 — elevation: Archer curve, roofs, ramps, cliffs and uphill Speed
// (Master Requirements v3 Appendix A "Ground travel", "Archer elevation", "Terrain obstruction";
// "Numeric precision": Attack three at uphill approach Speed one-half is a 1.5-point impact).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beginCount, runTick, validatePlan } from '../../src/hapa/rules/match.js';
import { rangedShot, residual } from '../../src/hapa/rules/combat.js';
import { supplyOf } from '../../src/hapa/rules/economy.js';
import { raiseTerritory, cellKey } from '../../src/hapa/rules/terrain.js';
import { scenario } from '../../fixtures/hapa/scenarios.js';

const U = 1_000_000;
const bow = { id: 'bow', kind: 'ranged', hits: 2, power: 1, channel: 'physical', face: 'above', range: 2, elevation: true, needsArc: true };
const bolt = { id: 'bolt', kind: 'ranged', hits: 1, power: 2, channel: 'magic', face: 'actual', range: 2 };

function archers() {
  return scenario({ parties: [
    { id: 'A.arch', owner: 'A', mount: 'castle', column: 5, row: 4, slots: { 5: 'center', 8: 'archer' } },
    { id: 'B.t', owner: 'B', mount: 'castle', column: 5, row: 6, slots: { 5: 'center', 2: 'swordsman' } },
  ] });
}

test('Archer elevation: one adjustment by sign — lower +1/+1, higher −1/−1, minimum range 1 and power 0', () => {
  const fx = archers();
  const s = fx.state, A = s.parties['A.arch'], B = s.parties['B.t'], m = s.members['A.arch.s8'];
  const level = rangedShot(s, fx.ctx, m, A, bow, B);
  assert.deepEqual([level.range, level.power, level.elevation], [2, 1, 'level']);
  raiseTerritory(s, fx.ctx, 5, 4, 2); // two bands up: still a single adjustment
  assert.equal(m.band, 3);
  const down = rangedShot(s, fx.ctx, m, A, bow, B);
  assert.deepEqual([down.range, down.power, down.elevation], [3, 2, 'target_lower']);
  const fx2 = archers();
  raiseTerritory(fx2.state, fx2.ctx, 5, 6, 1);
  const s2 = fx2.state;
  const up = rangedShot(s2, fx2.ctx, s2.members['A.arch.s8'], s2.parties['A.arch'], bow, s2.parties['B.t']);
  assert.deepEqual([up.range, up.power, up.elevation], [1, 0, 'target_higher']);
  // a weapon without the Archer curve keeps its numbers but the face becomes Above/Below
  const magic = rangedShot(s2, fx2.ctx, s2.members['A.arch.s8'], s2.parties['A.arch'], bolt, s2.parties['B.t']);
  assert.deepEqual([magic.range, magic.power, magic.vertical], [2, 2, 'below']);
});

test('a roof obstructs the Archer\'s Above arc; a direct magic shot is not an arc', () => {
  const fx = archers();
  const s = fx.state, B = s.parties['B.t'];
  B.band = -2; for (const id of Object.values(B.slots)) if (id) s.members[id].band = -2;
  s.terrain.kind = 'volume';
  s.terrain.cells[cellKey(B.x / U, B.y / U, -2)] = { solid: false, material: 'air' }; // a roofed tunnel
  const m = s.members['A.arch.s8'], A = s.parties['A.arch'];
  assert.equal(rangedShot(s, fx.ctx, m, A, bow, B).blocked, true);
  assert.equal(rangedShot(s, fx.ctx, m, A, bolt, B).blocked, false);
  // open the roof: the arc is clear again
  for (const b of [-1, 1, 2, 3]) s.terrain.cells[cellKey(B.x / U, B.y / U, b)] = { solid: false, material: 'air' };
  assert.equal(rangedShot(s, fx.ctx, m, A, bow, B).blocked, false);
});

const ready = (fx, tick = 5) => { fx.state.tick = tick - 1; beginCount(fx.state, fx.ctx); };

test('ground travel: a ramp climbs at half Speed and half the Supply per quantum; arrival raises the band', () => {
  const fx = scenario({ parties: [{ id: 'A.c', owner: 'A', mount: 'castle', column: 5, row: 5, slots: { 5: 'center', 2: 'swordsman' }, supply: 2 }] });
  raiseTerritory(fx.state, fx.ctx, 5, 6, 1, [{ column: 5, row: 5 }]);
  const s = fx.state, P = s.parties['A.c'];
  const y0 = P.y;
  ready(fx);
  runTick(s, fx.ctx, { A: [{ type: 'set_destination', partyId: 'A.c', target: { column: 5, row: 6 } }], B: [] });
  assert.equal(P.y - y0, 2 * U); // Speed 1 × ½ uphill: half a 4-unit step
  assert.equal(supplyOf(P), 1.5 * U); // pays for the distance actually travelled
  assert.equal(P.band, 1);
  beginCount(s, fx.ctx);
  const ev = runTick(s, fx.ctx, { A: [], B: [] }).events;
  assert.ok(ev.some((e) => e.type === 'elevation_changed' && e.partyId === 'A.c' && e.to === 2));
  assert.equal(P.band, 2);
  assert.equal(s.members['A.c.s2'].band, 2);
  assert.equal(supplyOf(P), U);
  // downhill is ordinary Speed
  beginCount(s, fx.ctx); // Tick 7
  for (let t = 7; t < 14; t++) { runTick(s, fx.ctx, { A: [], B: [] }); beginCount(s, fx.ctx); }
  runTick(s, fx.ctx, { A: [{ type: 'set_destination', partyId: 'A.c', target: { column: 5, row: 5 } }], B: [] }); // turns to face S first
  const y1 = P.y;
  beginCount(s, fx.ctx);
  runTick(s, fx.ctx, { A: [], B: [] });
  assert.equal(y1 - P.y, 4 * U);
  assert.equal(P.band, 1);
});

test('a one-band step without a ramp and a two-band step are cliffs with no ordinary connection', () => {
  const fx = scenario({ parties: [{ id: 'A.c', owner: 'A', mount: 'castle', column: 5, row: 5, slots: { 5: 'center' }, supply: 2 }] });
  raiseTerritory(fx.state, fx.ctx, 5, 6, 1);
  raiseTerritory(fx.state, fx.ctx, 4, 5, 2, [{ column: 5, row: 5 }]);
  ready(fx);
  const v = validatePlan(fx.state, fx.ctx, 'A', [{ type: 'set_destination', partyId: 'A.c', target: { column: 5, row: 6 } }]);
  assert.match(v.errors[0].error, /no ramp links/);
  const v2 = validatePlan(fx.state, fx.ctx, 'A', [{ type: 'set_destination', partyId: 'A.c', target: { column: 4, row: 5 } }]);
  assert.match(v2.errors[0].error, /vertical cliff/);
  // a flyer is not ground travel
  fx.state.parties['A.c'].movementMode = 'air';
  assert.deepEqual(validatePlan(fx.state, fx.ctx, 'A', [{ type: 'set_destination', partyId: 'A.c', target: { column: 5, row: 6 } }]).errors, []);
});

test('charge uses actual Speed: Attack 3 charging uphill at Speed ½ is a 1.5-point impact', () => {
  const fx = scenario({ parties: [
    { id: 'A.c', owner: 'A', mount: 'castle', column: 5, row: 5, slots: { 5: 'center', 2: 'swordsman' }, supply: 1 },
    { id: 'B.h', owner: 'B', mount: 'castle', column: 5, row: 6, slots: { 5: 'center', 2: 'swordsman' } },
  ] });
  raiseTerritory(fx.state, fx.ctx, 5, 6, 1, [{ column: 5, row: 5 }]);
  for (const m of Object.values(fx.state.members)) { m.hp = 20 * U; m.maxHp = 20 * U; }
  ready(fx);
  const ev = runTick(fx.state, fx.ctx, { A: [{ type: 'set_destination', partyId: 'A.c', target: { column: 5, row: 6 } }], B: [] }).events;
  const contact = ev.find((e) => e.type === 'contact');
  assert.deepEqual(contact.approach['A.c'], [1, 2]);
  assert.equal(contact.quantum, 500); // half Speed closes the one-unit gap in half a Tick
  const hit = ev.find((e) => e.type === 'exchange').hits.find((h) => h.source === 'A.c.s2');
  assert.deepEqual(hit.ratio, [1, 2]);
  assert.equal(residual(U, 3, [1, 2], 0), 1_500_000); // the impact before protection
  assert.equal(hit.damage, residual(U, 3, [1, 2], hit.protection)); // minus the front shield
});
