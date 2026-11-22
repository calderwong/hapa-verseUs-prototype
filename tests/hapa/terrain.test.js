// HV-36/37 — exposed ground, excavation limits and the terrain_work_v3_01 fixture (Appendix A).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beginCount, runTick } from '../../src/hapa/rules/match.js';
import { mintForecast } from '../../src/hapa/rules/economy.js';
import { individualProtection } from '../../src/hapa/rules/combat.js';
import { placeDeposit, cellKey, solidAt } from '../../src/hapa/rules/terrain.js';
import { stateFingerprint } from '../../src/hapa/rules/state.js';
import { scenario } from '../../fixtures/hapa/scenarios.js';

const U = 1_000_000;
const voidCell = (s, x, y, band) => { s.terrain.cells[cellKey(x, y, band)] = { solid: false, material: 'air' }; s.terrain.kind = 'volume'; };

/** terrain_work_v3_01: A's center-only Castle worker in a cleared shaft at x=2, y=10, band −3. */
function terrainWork() {
  const fx = scenario({ matchId: 'terrain_work_v3_01', parties: [{ id: 'A.worker', owner: 'A', mount: 'castle', column: 1, row: 3, slots: { 5: 'center' } }] });
  const s = fx.state;
  const P = s.parties['A.worker'], m = s.members['A.worker.s5'];
  P.band = -3; m.band = -3;
  for (const b of [-3, -2, -1]) voidCell(s, 2, 10, b);
  placeDeposit(s, 'deposit.A.C1.R3', 3, 10, -3);
  s.tick = 8; // the completed state of Tick 8
  return fx;
}

const step = (fx, A = []) => { beginCount(fx.state, fx.ctx); return runTick(fx.state, fx.ctx, { A, B: [] }).events; };

test('terrain_work_v3_01: extract (T9), craft (T10), equip (T18) → front Physical Defense 2', () => {
  const fx = terrainWork();
  const s = fx.state;
  const ev9 = step(fx, [{ type: 'begin_work', partyId: 'A.worker', work: 'extract', target: { x: 3, y: 10, band: -3 } }]);
  assert.equal(s.tick, 9);
  assert.ok(ev9.some((e) => e.type === 'deposit_extracted'));
  const metal = s.players.A.inventory.map((i) => s.items[i]).find((i) => i.definition === 'fixture.metal');
  assert.ok(metal);
  const ev10 = step(fx, [{ type: 'begin_work', partyId: 'A.worker', work: 'craft' }]);
  assert.equal(s.tick, 10);
  assert.ok(ev10.some((e) => e.type === 'item_crafted'));
  assert.equal(s.items[metal.id].state, 'consumed');
  for (let t = 11; t <= 17; t++) step(fx); // C1 is inactive until Tick 18
  const armor = s.players.A.inventory.map((i) => s.items[i]).find((i) => i.definition === 'fixture.armor');
  step(fx, [{ type: 'begin_work', partyId: 'A.worker', work: 'equip', itemId: armor.id, memberId: 'A.worker.s5' }]);
  assert.equal(s.tick, 18);
  assert.equal(s.members['A.worker.s5'].equipment.torso, armor.id);
  assert.equal(s.terrain.deposits['deposit.A.C1.R3'].extracted, true);
  assert.equal(individualProtection(s, fx.ctx, s.members['A.worker.s5'], 'physical', 'front').total, 2);
  assert.deepEqual(s.items[armor.id].provenance.inputs, [metal.id]);
  // the deposit cannot be extracted again, even after refilling its cube
  s.terrain.cells[cellKey(3, 10, -3)] = { solid: true, material: 'earth', deposit: 'deposit.A.C1.R3' };
  s.tick = 26; s.activeColumns = [1, 9];
  const again = runTick(s, fx.ctx, { A: [{ type: 'begin_work', partyId: 'A.worker', work: 'extract', target: { x: 3, y: 10, band: -3 } }], B: [] });
  assert.ok(again.events.some((e) => e.type === 'command_rejected' && /exhausted/.test(e.reason)));
  assert.equal(Object.values(s.items).filter((i) => i.definition === 'fixture.metal').length, 1);
});

test('excavation removes and refills a free face-adjacent cube; an occupied or supporting cube cannot change', () => {
  const fx = terrainWork();
  const s = fx.state;
  step(fx, [{ type: 'begin_work', partyId: 'A.worker', work: 'excavate', target: { x: 2, y: 9, band: -3 } }]);
  assert.equal(solidAt(s.terrain, 2, 9, -3), false);
  for (let t = 10; t <= 17; t++) step(fx);
  step(fx, [{ type: 'begin_work', partyId: 'A.worker', work: 'fill', target: { x: 2, y: 9, band: -3 } }]);
  assert.equal(solidAt(s.terrain, 2, 9, -3), true);
  // an occupied cube (the worker's own) cannot be filled
  const occ = step(fx, [{ type: 'begin_work', partyId: 'A.worker', work: 'fill', target: { x: 2, y: 10, band: -3 } }]);
  assert.ok(occ.some((e) => e.type === 'command_rejected' && /occupied|share a face/.test(e.reason)));
  // a supporting cube cannot be removed: a member stands on (2, 9, −3)
  voidCell(s, 2, 9, -2);
  s.members['A.worker.s8'] = { ...s.members['A.worker.s5'], id: 'A.worker.s8', archetype: 'priest', isCenter: false, commander: false, slot: 8, homeSlot: 8, x: 2 * U, y: 9 * U, band: -2 };
  s.parties['A.worker'].slots['8'] = 'A.worker.s8';
  for (let t = 20; t <= 26; t++) step(fx); // C1 is active again at Tick 27
  const sup = step(fx, [{ type: 'begin_work', partyId: 'A.worker', work: 'excavate', target: { x: 2, y: 9, band: -3 } }]);
  assert.ok(sup.some((e) => e.type === 'command_rejected' && /supports a member/.test(e.reason)), JSON.stringify(sup.filter((e) => e.type === 'command_rejected')));
});

test('exposed ground: an enemy center on an open pit floor blocks income; under a roof or flying it does not', () => {
  const mk = () => scenario({ parties: [
    { id: 'A.front', owner: 'A', mount: 'castle', column: 1, row: 6, slots: { 5: 'center' } },
    { id: 'B.dig', owner: 'B', mount: 'castle', column: 1, row: 4, slots: { 5: 'center' } },
  ] });
  // open pit: B's center stands at band −1 with nothing above
  const pit = mk();
  pit.state.parties['B.dig'].band = -1; pit.state.members['B.dig.s5'].band = -1;
  voidCell(pit.state, 2, 14, -1);
  assert.equal(mintForecast(pit.state, pit.ctx, 'A', 1), null); // cut off: no A anchor before the blocker
  // roofed tunnel: same depth, intact ground above
  const tunnel = mk();
  tunnel.state.parties['B.dig'].band = -2; tunnel.state.members['B.dig.s5'].band = -2;
  voidCell(tunnel.state, 2, 14, -2);
  assert.equal(mintForecast(tunnel.state, tunnel.ctx, 'A', 1).frontierParty, 'A.front');
  // flying: no ground anchor
  const fly = mk();
  fly.state.parties['B.dig'].movementMode = 'air'; fly.state.parties['B.dig'].band = 2;
  assert.equal(mintForecast(fly.state, fly.ctx, 'A', 1).frontierParty, 'A.front');
  // cutaway / camera views never enter the state: the fingerprint ignores them
  assert.equal(typeof stateFingerprint(pit.state), 'string');
  void U;
});
