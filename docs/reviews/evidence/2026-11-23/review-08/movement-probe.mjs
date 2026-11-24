// Review 08 actual-rules probes at f7c4f0f. Diagnostic fixtures, not ordinary-opening claims.
import assert from 'node:assert/strict';
import { createSession, createFixtureSession, openTick, closeTick, verifyReplay } from '../../../../../src/hapa/rules/session.js';
import { DEFAULT_PROFILE_ID, profileById } from '../../../../../fixtures/hapa/profiles.js';
import { CATALOG } from '../../../../../fixtures/hapa/content.js';
import { scenario } from '../../../../../fixtures/hapa/scenarios.js';
import { routeFromHere, routeClearance, quoteRoute, destinationHeldError, legalDestinations, placeMembers, simulateMovement, setDestination } from '../../../../../src/hapa/rules/movement.js';
import { validatePlan } from '../../../../../src/hapa/rules/match.js';
import { supplyOf } from '../../../../../src/hapa/rules/economy.js';
import { HeuristicBot } from '../../../../../src/hapa/controllers/heuristic-bot.js';
import { killMember } from '../../../../../src/hapa/rules/combat.js';

const pass = () => ({ pass: true });
const commands = (id, column, row, extra = {}) => [{ type: 'set_destination', partyId: id, target: { column, row }, ...extra }];
const commanders = [
  { id: 'A.commander', owner: 'A', column: 1, row: 1, mount: 'commander', commander: true, slots: { 5: 'center' } },
  { id: 'B.commander', owner: 'B', column: 9, row: 10, mount: 'commander', commander: true, slots: { 5: 'center' } },
];
function fixture(id, parties) { return createFixtureSession(scenario({ matchId: id, profileId: DEFAULT_PROFILE_ID, keep: [], parties: [...parties, ...commanders] }), { id, title: 'Review 08 diagnostic fixture' }); }
function activate(s, col) { openTick(s); while (!s.state.activeColumns.includes(col)) { closeTick(s, { A: [], B: [] }, pass); openTick(s); } }
function count(s, id) { const p = s.state.parties[id]; return { referenced: Object.values(p.slots).filter(mid => mid && s.state.members[mid].alive), ownedAlive: Object.values(s.state.members).filter(m => m.alive && m.party === id).map(m => m.id), slots: p.slots }; }

// Two partial Pawns joined in successive legal center arrivals. Capacity is never exceeded.
const m = fixture('r08-two-pawns', [
  { id: 'A.q', owner: 'A', column: 3, row: 4, mount: 'queen', supply: 3, slots: { 5: 'center' } },
  { id: 'A.p1', owner: 'A', column: 3, row: 5, slots: { 1: 'swordsman', 2: 'swordsman' } },
  { id: 'A.p2', owner: 'A', column: 3, row: 6, slots: { 1: 'swordsman', 2: 'swordsman' } },
]);
activate(m, 3);
const mcmd = commands('A.q', 3, 7);
assert.deepEqual(validatePlan(m.state, m.ctx, 'A', mcmd).errors, []);
const mev = [];
mev.push(...closeTick(m, { A: mcmd, B: [] }, pass).events);
for (let i = 0; i < 2; i++) { openTick(m); mev.push(...closeTick(m, { A: [], B: [] }, pass).events); }
const merged = { count: count(m, 'A.q'), events: mev.filter(e => ['parties_merged', 'merge_failed', 'destination_reached'].includes(e.type)), replay: verifyReplay(m.replay).ok };
assert.equal(merged.count.ownedAlive.length, 5);
assert.equal(merged.count.referenced.length, 4); // reproduces a living member silently omitted from formation

// Current original user regression: Queen diagonal reaches the next center, absorbing its Pawn.
const q = createSession({ matchId: 'r08-opening-queen', profile: profileById(DEFAULT_PROFILE_ID), catalog: CATALOG, seed: 1 });
let qr;
for (let tick = 1; tick <= 6; tick++) {
  openTick(q);
  const A = tick === 6 ? [6,5,4].map(c => ({ type: 'load_supply', cardId: q.state.players.A.bank.minor[c], partyId: 'A.mount.C6' })).concat(commands('A.mount.C6', 9, 4)) : [];
  qr = closeTick(q, { A, B: [] }, pass);
  assert.deepEqual(qr.rejected, { A: [], B: [] });
}
const qp = q.state.parties['A.mount.C6'];
assert.deepEqual(qp.region, { column: 7, row: 2 });
assert.deepEqual({ x: qp.x, y: qp.y }, q.ctx.geo.center(7, 2));
assert.equal(supplyOf(qp)/q.ctx.U, 5);
const opening = { region: qp.region, atCenter: true, supply: 5, retiredPawn: q.state.parties['A.pawn.C7'].retired, replay: verifyReplay(q.replay).ok };

// Knight route passes through a mounted friendly; legal rules/clearance agree but bot rejects it.
const b = fixture('r08-bot-knight-through-friendly', [
  { id: 'A.k', owner: 'A', column: 3, row: 4, mount: 'knight', supply: 3, slots: { 5: 'center' } },
  ...[[3,5],[3,6],[4,4],[2,4]].map(([column,row], i) => ({ id: `A.h${i}`, owner: 'A', column, row, mount: 'castle', slots: { 5:'center' } })),
]);
activate(b, 3);
const kp = b.state.parties['A.k'];
const btarget = { column: 4, row: 6 };
const br = routeFromHere(b.state, b.ctx, kp, btarget, 'long');
const bc = routeClearance(b.state, b.ctx, kp, br.path);
assert.equal(bc.clear, true);
assert.equal(destinationHeldError(b.state,b.ctx,kp,btarget), null);
assert.deepEqual(validatePlan(b.state,b.ctx,'A', commands(kp.id,4,6,{via:'long'})).errors, []);
const botcmd = new HeuristicBot({seat:'A',seed:1}).plan(b.state,b.ctx);
assert.equal(botcmd.some(c => c.type==='set_destination' && c.partyId===kp.id), false);
const bot = { target: btarget, path: br.route, clearance: bc, affordable: quoteRoute(b.state,b.ctx,kp,btarget,'long').funded, commands: botcmd };

// Combat death leaves slot IDs. The capacity checker allows five survivors + four recruits,
// but the merge allocator mistakenly treats the four dead members' slots as occupied.
const deadBase = scenario({ matchId:'r08-dead-slots', profileId:DEFAULT_PROFILE_ID, keep:[], parties:[
  { id:'A.q', owner:'A', column:3, row:4, mount:'queen', supply:1, slots:{1:'swordsman',2:'swordsman',3:'swordsman',4:'pikeman',5:'center',6:'mage',7:'archer',8:'priest',9:'archer'} },
  { id:'A.p', owner:'A', column:3, row:5, slots:{1:'swordsman',2:'swordsman',3:'swordsman',7:'archer'} },
  ...commanders,
] });
for (const slot of [1,2,3,4]) killMember(deadBase.state,deadBase.ctx,[],deadBase.state.members[`A.q.s${slot}`],'diagnostic casualty before fixture snapshot');
const dead = createFixtureSession(deadBase,{id:'dead-slots',title:'Diagnostic battle survivors before Pawn absorption'});
activate(dead,3);
assert.deepEqual(validatePlan(dead.state,dead.ctx,'A',commands('A.q',3,5)).errors,[]);
const dr=closeTick(dead,{A:commands('A.q',3,5),B:[]},pass);
const deadSlots={events:dr.events.filter(e=>['merge_failed','parties_merged','destination_reached'].includes(e.type)),pawnRetired:dead.state.parties['A.p'].retired, sameCenter:dead.state.parties['A.p'].x===dead.state.parties['A.q'].x&&dead.state.parties['A.p'].y===dead.state.parties['A.q'].y,replay:verifyReplay(dead.replay).ok};
assert.equal(deadSlots.events.find(e=>e.type==='merge_failed')?.reason,'over capacity');
assert.equal(deadSlots.sameCenter,true);
assert.equal(deadSlots.pawnRetired,false);

console.log(JSON.stringify({ sha: 'f7c4f0f69afbc22458c400f01521e5b468f5f602', profile: DEFAULT_PROFILE_ID, evidence: 'actual rules; labelled diagnostic fixtures; no browser claim', merged, deadSlots, opening, bot }, null, 2));
