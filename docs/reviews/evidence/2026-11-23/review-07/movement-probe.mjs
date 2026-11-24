// Review 07: actual rules, no presentation mock. Read-only diagnostic; never imports app state.
import assert from 'node:assert/strict';
import { createSession, createFixtureSession, openTick, closeTick, verifyReplay } from '../../../../../src/hapa/rules/session.js';
import { profileById, DEFAULT_PROFILE_ID } from '../../../../../fixtures/hapa/profiles.js';
import { CATALOG } from '../../../../../fixtures/hapa/content.js';
import { scenario } from '../../../../../fixtures/hapa/scenarios.js';
import { quoteRoute, routeOrigin, nearestNode } from '../../../../../src/hapa/rules/movement.js';
import { validatePlan } from '../../../../../src/hapa/rules/match.js';
import { supplyOf } from '../../../../../src/hapa/rules/economy.js';
import { slotOffset } from '../../../../../src/hapa/rules/geometry.js';

const pass = () => ({ pass: true });
const move = (partyId, column, row) => ({ type: 'set_destination', partyId, target: { column, row } });
const summary = (s, id) => {
  const p = s.state.parties[id];
  return { x: p.x / s.ctx.U, y: p.y / s.ctx.U, region: p.region, state: p.state, destination: p.destination, supply: supplyOf(p) / s.ctx.U, blockedTick: p.blockedTick ?? null, nextNode: p.route[0] ?? null };
};
const s = createSession({ matchId: 'review07-opening-queen', profile: profileById(DEFAULT_PROFILE_ID), catalog: CATALOG, seed: 1 });
let resolution;
for (let tick = 1; tick <= 6; tick++) {
  openTick(s);
  const plans = { A: [], B: [] };
  if (tick === 6) plans.A = [6, 5, 4].map(c => ({ type: 'load_supply', cardId: s.state.players.A.bank.minor[String(c)], partyId: 'A.mount.C6' })).concat(move('A.mount.C6', 9, 4));
  resolution = closeTick(s, plans, pass);
  assert.deepEqual(resolution.rejected, { A: [], B: [] });
}
const initial = s.ctx.geo.center(6, 1);
const queen = s.state.parties['A.mount.C6'];
assert.equal((queen.x - initial.x) / s.ctx.geo.pitch, 0.5);
assert.equal((queen.y - initial.y) / s.ctx.geo.pitch, 0.5);
assert.equal(supplyOf(queen) / s.ctx.U, 5.5);
assert.equal(verifyReplay(s.replay).ok, true);
const opening = { afterTick6: summary(s, queen.id), events: resolution.events.filter(e => e.partyId === queen.id), replayVerified: true };
// Inspect the next 1/1000-Tick proposal against the same strict body-interior overlap criterion.
const step = s.ctx.geo.pitch / s.ctx.profile.geometry.quantaPerTick;
const targetPawn = Object.values(s.state.parties).find(p => p.id !== queen.id && p.x === queen.route[0].x && p.y === queen.route[0].y);
const collisions = [];
for (const mid of Object.values(queen.slots).filter(Boolean)) {
  const m = s.state.members[mid], off = slotOffset(m.slot, queen.facing);
  const x = queen.x + step + off.dx * s.ctx.U, y = queen.y + step + off.dy * s.ctx.U;
  for (const p of Object.values(s.state.parties)) if (p.id !== queen.id && p.id !== targetPawn?.id && p.alive && !p.retired) {
    for (const oid of Object.values(p.slots).filter(Boolean)) {
      const o = s.state.members[oid];
      if (o.alive && Math.abs(x - o.x) < s.ctx.U && Math.abs(y - o.y) < s.ctx.U) collisions.push({ movingMember: mid, movingRole: m.archetype, blockerParty: p.id, blockerMember: oid, blockerRole: o.archetype, prospectivePosition: [x / s.ctx.U, y / s.ctx.U], blockerPosition: [o.x / s.ctx.U, o.y / s.ctx.U] });
    }
  }
}
assert.ok(collisions.some(x => x.blockerParty === 'A.pawn.C6'));
opening.nextQuantumBodyOverlap = collisions;
openTick(s); const second = closeTick(s, { A: [], B: [] }, pass);
opening.afterTick7 = summary(s, queen.id);
opening.tick7RelevantEvents = second.events.filter(e => e.partyId === queen.id);
assert.equal(supplyOf(queen) / s.ctx.U, 5.5);
assert.equal(queen.x, initial.x + s.ctx.geo.pitch / 2);

const recovery = [];
for (const target of [{ column: 6, row: 1 }, { column: 6, row: 2 }, { column: 7, row: 2 }]) {
  const d = createFixtureSession({ manifest: s.manifest, ctx: s.ctx, state: structuredClone(s.state) }, { id: 'blocked-recovery', title: 'Recovery branch cloned from legal Tick 7 state' });
  openTick(d);
  while (!d.state.activeColumns.includes(6)) { closeTick(d, { A: [], B: [] }, pass); openTick(d); }
  const p = d.state.parties[queen.id], before = summary(d, queen.id), command = move(p.id, target.column, target.row);
  const origin = routeOrigin(d.state, d.ctx, p), near = nearestNode(d.ctx, p);
  const validation = validatePlan(d.state, d.ctx, 'A', [command]);
  const quote = quoteRoute(d.state, d.ctx, p, target);
  const r = closeTick(d, { A: [command], B: [] }, pass);
  recovery.push({ atTick: d.state.tick, target, before, origin, nearest: near, quote, rejected: r.rejected, after: summary(d, p.id), events: r.events.filter(e => e.partyId === p.id) });
  assert.equal(p.x, before.x * d.ctx.U);
  assert.equal(p.y, before.y * d.ctx.U);
}

const clear = [];
for (const mount of ['queen', 'bishop']) {
  const d = createFixtureSession(scenario({ profileId: DEFAULT_PROFILE_ID, matchId: `review07-clear-${mount}`, keep: [], parties: [
    { id: 'A.test', owner: 'A', column: 3, row: 4, mount, supply: 1, slots: { 4: 'pikeman', 5: 'center', 6: 'mage', 8: 'priest' } },
    { id: 'A.commander', owner: 'A', column: 1, row: 1, mount: 'commander', commander: true, slots: { 5: 'center' } },
    { id: 'B.commander', owner: 'B', column: 9, row: 10, mount: 'commander', commander: true, slots: { 5: 'center' } },
  ] }), { id: `clear-${mount}`, title: 'Clear flat diagonal — diagnostic fixture' });
  openTick(d);
  while (!d.state.activeColumns.includes(3)) { closeTick(d, { A: [], B: [] }, pass); openTick(d); }
  const before = summary(d, 'A.test');
  const quote = quoteRoute(d.state, d.ctx, d.state.parties['A.test'], { column: 4, row: 5 });
  const r = closeTick(d, { A: [move('A.test', 4, 5)], B: [] }, pass);
  assert.deepEqual(r.rejected, { A: [], B: [] });
  assert.deepEqual(d.state.parties['A.test'].region, { column: 4, row: 5 });
  assert.equal(d.state.parties['A.test'].destination, null);
  assert.equal(supplyOf(d.state.parties['A.test']), 0);
  assert.equal(verifyReplay(d.replay).ok, true);
  clear.push({ mount, before, quote, after: summary(d, 'A.test'), replayVerified: true });
}
console.log(JSON.stringify({ reviewedRevision: '4fd5eaf9c0f9750242d9d3d013ac36801d96a92f', mode: 'actual headless rules; no browser claim', opening, clear, recovery }, null, 2));
