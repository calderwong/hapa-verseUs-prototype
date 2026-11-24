// Review 08 / assignment 10, R8-01 and R8-02 — the review's diagnostics as corrected regressions:
// absorbing a Pawn conserves every living member in a distinct slot (successive partial Pawns,
// casualty vacancies), permission and allocation agree, and the bot uses the shared Knight
// traversal. v3_06 keeps its recorded slot-order allocator (historical replays).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, createFixtureSession, openTick, closeTick, verifyReplay } from '../../src/hapa/rules/session.js';
import { DEFAULT_PROFILE_ID, profileById } from '../../fixtures/hapa/profiles.js';
import { CATALOG } from '../../fixtures/hapa/content.js';
import { scenario } from '../../fixtures/hapa/scenarios.js';
import { routeFromHere, routeClearance, absorptionPlan } from '../../src/hapa/rules/movement.js';
import { validatePlan } from '../../src/hapa/rules/match.js';
import { supplyOf } from '../../src/hapa/rules/economy.js';
import { killMember } from '../../src/hapa/rules/combat.js';
import { HeuristicBot } from '../../src/hapa/controllers/heuristic-bot.js';

const pass = () => ({ pass: true });
const move = (id, column, row, extra = {}) => [{ type: 'set_destination', partyId: id, target: { column, row }, ...extra }];
const commanders = [
  { id: 'A.commander', owner: 'A', column: 1, row: 1, mount: 'commander', commander: true, slots: { 5: 'center' } },
  { id: 'B.commander', owner: 'B', column: 9, row: 10, mount: 'commander', commander: true, slots: { 5: 'center' } },
];
const fixture = (id, parties, profileId = DEFAULT_PROFILE_ID) => createFixtureSession(scenario({ matchId: id, profileId, keep: [], parties: [...parties, ...commanders] }), { id, title: 'Absorption regression fixture' });
const activate = (s, col) => { openTick(s); while (!s.state.activeColumns.includes(col)) { closeTick(s, { A: [], B: [] }, pass); openTick(s); } };

/** Every living member the party owns sits in exactly one of its slots, and every slot reference is consistent. */
function assertComposition(s, id) {
  const p = s.state.parties[id];
  const owned = Object.values(s.state.members).filter((m) => m.alive && m.party === id).map((m) => m.id).sort();
  const slotted = Object.entries(p.slots).filter(([, mid]) => mid && s.state.members[mid].alive);
  assert.deepEqual(slotted.map(([, mid]) => mid).sort(), owned, 'every living member is in a slot');
  for (const [slot, mid] of slotted) assert.equal(s.state.members[mid].slot, Number(slot), `${mid} knows its slot`);
  assert.equal(new Set(slotted.map(([, mid]) => mid)).size, slotted.length, 'no member twice');
  assert.equal(p.slots['5'] && s.state.members[p.slots['5']].isCenter, true, 'the Mount keeps slot 5');
  return owned.length;
}

test('successive partial Pawns: both pickups keep every survivor in a distinct slot', () => {
  const s = fixture('abs-two-pawns', [
    { id: 'A.q', owner: 'A', column: 3, row: 4, mount: 'queen', supply: 3, slots: { 5: 'center' } },
    { id: 'A.p1', owner: 'A', column: 3, row: 5, slots: { 1: 'swordsman', 2: 'swordsman' } },
    { id: 'A.p2', owner: 'A', column: 3, row: 6, slots: { 1: 'swordsman', 2: 'swordsman' } },
  ]);
  activate(s, 3);
  assert.deepEqual(validatePlan(s.state, s.ctx, 'A', move('A.q', 3, 7)).errors, []);
  const ev = [...closeTick(s, { A: move('A.q', 3, 7), B: [] }, pass).events];
  for (let i = 0; i < 2; i++) { openTick(s); ev.push(...closeTick(s, { A: [], B: [] }, pass).events); }
  const merges = ev.filter((e) => e.type === 'parties_merged');
  assert.deepEqual(merges.map((e) => e.retired), ['A.p1', 'A.p2']);
  assert.deepEqual(merges[1].moved.map((m) => m.to), [3, 4]); // reserved: never both to slot 3
  assert.equal(assertComposition(s, 'A.q'), 5);
  assert.equal(s.state.parties['A.p1'].retired && s.state.parties['A.p2'].retired, true);
  assert.equal(ev.filter((e) => e.type === 'merge_failed').length, 0);
  assert.equal(verifyReplay(s.replay).ok, true);
});

test('casualty vacancies are refilled: five survivors absorb a four-member Pawn', () => {
  const base = scenario({ matchId: 'abs-dead-slots', profileId: DEFAULT_PROFILE_ID, keep: [], parties: [
    { id: 'A.q', owner: 'A', column: 3, row: 4, mount: 'queen', supply: 1, slots: { 1: 'swordsman', 2: 'swordsman', 3: 'swordsman', 4: 'pikeman', 5: 'center', 6: 'mage', 7: 'archer', 8: 'priest', 9: 'archer' } },
    { id: 'A.p', owner: 'A', column: 3, row: 5, slots: { 1: 'swordsman', 2: 'swordsman', 3: 'swordsman', 7: 'archer' } },
    ...commanders,
  ] });
  for (const slot of [1, 2, 3, 4]) killMember(base.state, base.ctx, [], base.state.members[`A.q.s${slot}`], 'regression casualty before the fixture snapshot');
  const s = createFixtureSession(base, { id: 'abs-dead-slots', title: 'Survivors absorb a Pawn' });
  activate(s, 3);
  const q = s.state.parties['A.q'], p = s.state.parties['A.p'];
  assert.equal(absorptionPlan(s.state, s.ctx, q, p).error, undefined); // permission and allocation agree
  const r = closeTick(s, { A: move('A.q', 3, 5), B: [] }, pass);
  assert.equal(r.events.filter((e) => e.type === 'merge_failed').length, 0);
  const merged = r.events.find((e) => e.type === 'parties_merged');
  assert.deepEqual(merged.moved.map((m) => [m.from, m.to]), [[1, 1], [2, 2], [3, 3], [7, 4]]); // dead slots are free; 7 is taken by a survivor
  assert.equal(assertComposition(s, 'A.q'), 9);
  assert.equal(p.retired, true);
  assert.equal(supplyOf(q), 0);
  assert.equal(verifyReplay(s.replay).ok, true);
});

test('a Pawn that cannot be absorbed is never co-located: the mover is stopped instead', () => {
  const s = fixture('abs-full', [
    { id: 'A.q', owner: 'A', column: 3, row: 4, mount: 'queen', supply: 2, slots: { 1: 'swordsman', 2: 'swordsman', 3: 'swordsman', 4: 'pikeman', 5: 'center', 6: 'mage', 7: 'archer' } },
    { id: 'A.p', owner: 'A', column: 3, row: 5, slots: { 1: 'swordsman', 2: 'swordsman', 3: 'swordsman' } },
  ]);
  activate(s, 3);
  // ten living members would not fit: the Pawn's territory is not a legal destination at all
  assert.match(validatePlan(s.state, s.ctx, 'A', move('A.q', 3, 5)).errors[0]?.error ?? '', /cannot absorb it/);
  const c = routeClearance(s.state, s.ctx, s.state.parties['A.q'], routeFromHere(s.state, s.ctx, s.state.parties['A.q'], { column: 3, row: 6 }).path);
  assert.equal(c.clear, false);
  assert.equal(c.partyId, 'A.p');
  closeTick(s, { A: move('A.q', 3, 6), B: [] }, pass);
  const q = s.state.parties['A.q'], p = s.state.parties['A.p'];
  assert.ok(!p.retired, 'the Pawn is not absorbed');
  assert.notDeepEqual([q.x, q.y], [p.x, p.y]);
  assertComposition(s, 'A.q');
});

test('ordinary opening control: the Queen reaches R2C7, absorbs its Pawn and keeps exact Supply', () => {
  const s = createSession({ matchId: 'abs-opening', profile: profileById(DEFAULT_PROFILE_ID), catalog: CATALOG, seed: 1 });
  for (let tick = 1; tick <= 6; tick++) {
    openTick(s);
    const A = tick === 6 ? [6, 5, 4].map((c) => ({ type: 'load_supply', cardId: s.state.players.A.bank.minor[c], partyId: 'A.mount.C6' })).concat(move('A.mount.C6', 9, 4)) : [];
    assert.deepEqual(closeTick(s, { A, B: [] }, pass).rejected, { A: [], B: [] });
  }
  const q = s.state.parties['A.mount.C6'];
  assert.deepEqual([q.region, { x: q.x, y: q.y }, supplyOf(q) / s.ctx.U], [{ column: 7, row: 2 }, s.ctx.geo.center(7, 2), 5]);
  assert.equal(s.state.parties['A.pawn.C7'].retired, true);
  assert.equal(assertComposition(s, q.id), 9);
  assert.equal(verifyReplay(s.replay).ok, true);
});

test('v3_06 keeps its recorded slot-order allocator (historical replays are not reinterpreted)', () => {
  const s = fixture('abs-legacy', [
    { id: 'A.q', owner: 'A', column: 3, row: 4, mount: 'queen', supply: 3, slots: { 5: 'center' } },
    { id: 'A.p1', owner: 'A', column: 3, row: 5, slots: { 1: 'swordsman', 2: 'swordsman' } },
    { id: 'A.p2', owner: 'A', column: 3, row: 6, slots: { 1: 'swordsman', 2: 'swordsman' } },
  ], 'hapa_open_10x9_v3_06');
  activate(s, 3);
  const ev = [...closeTick(s, { A: move('A.q', 3, 7), B: [] }, pass).events];
  for (let i = 0; i < 2; i++) { openTick(s); ev.push(...closeTick(s, { A: [], B: [] }, pass).events); }
  assert.deepEqual(ev.filter((e) => e.type === 'parties_merged')[1].moved.map((m) => m.to), [3, 3]); // the reviewed defect, by design
  assert.equal(verifyReplay(s.replay).ok, true);
});

test('the bot may send a funded Knight through friendly territory to a legal endpoint (R8-02)', () => {
  const s = fixture('abs-bot-knight', [
    { id: 'A.k', owner: 'A', column: 3, row: 4, mount: 'knight', supply: 3, slots: { 5: 'center' } },
    ...[[3, 5], [3, 6], [4, 4], [2, 4]].map(([column, row], i) => ({ id: `A.h${i}`, owner: 'A', column, row, mount: 'castle', slots: { 5: 'center' } })),
  ]);
  activate(s, 3);
  const k = s.state.parties['A.k'];
  const path = routeFromHere(s.state, s.ctx, k, { column: 4, row: 6 }, 'long');
  assert.deepEqual(path.route.map((n) => `R${n.row}C${n.column}`), ['R5C3', 'R6C3', 'R6C4']); // through two friendly Castles
  assert.equal(routeClearance(s.state, s.ctx, k, path.path).clear, true);
  const cmds = new HeuristicBot({ seat: 'A', seed: 1 }).plan(s.state, s.ctx);
  const order = cmds.find((c) => c.type === 'set_destination' && c.partyId === 'A.k');
  assert.ok(order, 'the Knight receives a destination');
  assert.deepEqual(validatePlan(s.state, s.ctx, 'A', cmds).errors, []);
  const r = routeFromHere(s.state, s.ctx, k, order.target, order.via ?? null);
  assert.ok(r.route.slice(0, -1).some((n) => Object.values(s.state.parties).some((o) => o.id !== k.id && o.owner === 'A' && o.region.column === n.column && o.region.row === n.row)), 'its route passes friendly territory');
});
