// CJ's direction after response 08 (profile hapa_open_10x9_v3_04): a Tick of travel goes center to
// center; arriving on an unmounted friendly Pawn's center absorbs it; Knights pass through friendly
// territories and may take either L; enemies still meet on body contact.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, createFixtureSession, openTick, closeTick, verifyReplay } from '../../src/hapa/rules/session.js';
import { profileById, DEFAULT_PROFILE_ID } from '../../fixtures/hapa/profiles.js';
import { CATALOG } from '../../fixtures/hapa/content.js';
import { scenario } from '../../fixtures/hapa/scenarios.js';
import { routeFromHere, routeClearance, legalDestinations } from '../../src/hapa/rules/movement.js';
import { validatePlan } from '../../src/hapa/rules/match.js';
import { supplyOf } from '../../src/hapa/rules/economy.js';

const pass = () => ({ pass: true });
const V304 = 'hapa_open_10x9_v3_04';
const bank = (s) => Object.values(s.state.players.A.bank.minor).filter(Boolean);
function play(profileId, upTo, plansAt) {
  const s = createSession({ matchId: `ct-${profileId}`, profile: profileById(profileId), catalog: CATALOG, seed: 1 });
  const events = [];
  for (let t = 1; t <= upTo; t++) {
    openTick(s);
    const A = plansAt[t]?.(s) ?? [];
    assert.deepEqual(validatePlan(s.state, s.ctx, 'A', A).errors, [], `Tick ${t} plan`);
    events.push(...closeTick(s, { A, B: [] }, pass).events);
  }
  return { s, events };
}
const at = (s, id) => { const p = s.state.parties[id]; return [p.region.row, p.region.column, p.x === s.ctx.geo.center(p.region.column, p.region.row).x && p.y === s.ctx.geo.center(p.region.column, p.region.row).y]; };

test('v3_04 validates; the default v3_07 keeps its travel rules', () => {
  assert.equal(DEFAULT_PROFILE_ID, 'hapa_open_10x9_v3_07');
  const { knightTurn, absorption, ...rest } = profileById(DEFAULT_PROFILE_ID).movement;
  assert.deepEqual(rest, profileById(V304).movement);
  assert.deepEqual([knightTurn, absorption], ['free_follow_v1', 'living_reserved_v1']);
  const p = profileById(V304);
  assert.deepEqual([p.movement.traversal, p.movement.knightPaths, p.movement.recovery, p.planning.agreement], ['center_to_center_v1', 'either_l_v1', 'reachable_segment_v1', 'own_plan_ready_v1']);
});

test('the opening Bishop steps center to center past its own Pawn and absorbs the Pawn in front of the King', () => {
  const { s, events } = play(V304, 3, { 3: (s) => [...['7', '3'].map((c) => ({ type: 'load_supply', cardId: s.state.players.A.bank.minor[c], partyId: 'A.mount.C3' })), { type: 'set_destination', partyId: 'A.mount.C3', target: { column: 7, row: 5 } }] });
  const merged = events.find((e) => e.type === 'parties_merged' && e.partyId === 'A.mount.C3');
  assert.equal(merged?.retired, 'A.pawn.C4');
  assert.deepEqual(at(s, 'A.mount.C3'), [2, 4, true]); // one Tick, one territory, on its center
  assert.equal(supplyOf(s.state.parties['A.mount.C3']) / s.ctx.U, 3); // 4 loaded, 1 spent
  assert.equal(events.filter((e) => e.type === 'travel_blocked').length, 0);
  assert.equal(verifyReplay(s.replay).ok, true);
});

test('the Knight takes either L and absorbs the Pawn its path reaches (Tick 2 opening cases)', () => {
  const cases = [
    { target: { column: 3, row: 3 }, via: 'long', pawn: 'A.pawn.C2' },
    { target: { column: 3, row: 3 }, via: 'short', pawn: 'A.pawn.C3' }, // through the Bishop's territory
    { target: { column: 4, row: 2 }, via: 'long', pawn: 'A.pawn.C4' }, // through Bishop and King, onto the Pawn
    { target: { column: 1, row: 3 }, via: 'short', pawn: 'A.pawn.C1' }, // through the Castle's territory
  ];
  for (const c of cases) {
    const { s } = play(V304, 4, { 2: (s) => [...bank(s).slice(0, 2).map((id) => ({ type: 'load_supply', cardId: id, partyId: 'A.mount.C2' })), { type: 'set_destination', partyId: 'A.mount.C2', target: c.target, via: c.via }] });
    const absorbed = ['A.pawn.C1', 'A.pawn.C2', 'A.pawn.C3', 'A.pawn.C4'].filter((id) => s.state.parties[id].retired);
    assert.deepEqual(absorbed, [c.pawn], `${c.via} L to R${c.target.row}C${c.target.column}`);
    assert.deepEqual(at(s, 'A.mount.C2'), [c.target.row, c.target.column, true]);
    assert.equal(verifyReplay(s.replay).ok, true);
  }
});

test('v3_05 replaces each side\'s King with a second Queen; victory stays on the Commander', () => {
  for (const seat of ['A', 'B']) {
    const s = createSession({ matchId: `q-${seat}`, profile: profileById(DEFAULT_PROFILE_ID), catalog: CATALOG, seed: 1 });
    const mounts = Object.values(s.state.parties).filter((p) => p.owner === seat && p.mount).map((p) => p.mount).sort();
    assert.deepEqual(mounts, ['bishop', 'bishop', 'castle', 'castle', 'commander', 'knight', 'knight', 'queen', 'queen']);
  }
  const p = profileById(DEFAULT_PROFILE_ID);
  assert.equal(p.victory.commanderDeath, true);
  assert.equal(profileById(V304).board.columnMap[3].mount, 'king'); // archived profiles keep their King
});

test('both L paths are offered, quoted alike, and checked for clearance; the short L is refused before v3_04', () => {
  const { s } = play(V304, 1, {});
  openTick(s);
  const k = s.state.parties['A.mount.C2'];
  const d = legalDestinations(s.state, s.ctx, k).find((x) => x.column === 3 && x.row === 3);
  assert.deepEqual(d.vias, ['long', 'short']);
  const long = routeFromHere(s.state, s.ctx, k, { column: 3, row: 3 }, 'long'), short = routeFromHere(s.state, s.ctx, k, { column: 3, row: 3 }, 'short');
  assert.deepEqual(long.route.map((n) => `R${n.row}C${n.column}`), ['R2C2', 'R3C2', 'R3C3']);
  assert.deepEqual(short.route.map((n) => `R${n.row}C${n.column}`), ['R1C3', 'R2C3', 'R3C3']);
  assert.equal(routeClearance(s.state, s.ctx, k, short.path).clear, true); // passes the Bishop, joins R2C3's Pawn
  const old = createSession({ matchId: 'old', profile: profileById('hapa_open_10x9_v3_03'), catalog: CATALOG, seed: 1 });
  openTick(old);
  const v = validatePlan(old.state, old.ctx, 'A', [{ type: 'set_destination', partyId: 'A.mount.C1', target: { column: 1, row: 2 }, via: 'short' }]);
  assert.match(v.errors[0]?.error ?? '', /only a Knight/);
});

test('a line Mount cannot stop on or pass a friendly-held territory; a destination held by a non-Pawn is refused', () => {
  const fx = (profileId) => createFixtureSession(scenario({ profileId, matchId: 'held', keep: [], parties: [
    { id: 'A.castle', owner: 'A', column: 3, row: 4, mount: 'castle', supply: 3, slots: { 4: 'pikeman', 5: 'center', 6: 'mage' } },
    { id: 'A.other', owner: 'A', column: 3, row: 5, mount: 'castle', slots: { 5: 'center' } },
    { id: 'A.commander', owner: 'A', column: 1, row: 1, mount: 'commander', commander: true, slots: { 5: 'center' } },
    { id: 'B.commander', owner: 'B', column: 9, row: 10, mount: 'commander', commander: true, slots: { 5: 'center' } },
  ] }), { id: 'held', title: 'Friendly-held territory' });
  const d = fx(V304);
  openTick(d);
  while (!d.state.activeColumns.includes(3)) { closeTick(d, { A: [], B: [] }, pass); openTick(d); }
  const onto = validatePlan(d.state, d.ctx, 'A', [{ type: 'set_destination', partyId: 'A.castle', target: { column: 3, row: 5 } }]);
  assert.match(onto.errors[0]?.error ?? '', /already holds R5C3/);
  const p = d.state.parties['A.castle'];
  const c = routeClearance(d.state, d.ctx, p, routeFromHere(d.state, d.ctx, p, { column: 3, row: 7 }).path);
  assert.equal(c.clear, false);
  assert.equal(c.partyId, 'A.other');
});

test('enemies still meet on body contact under center-to-center travel (same outcome as v3_03)', () => {
  const run = (profileId) => {
    const d = createFixtureSession(scenario({ profileId, matchId: 'enemy', keep: [], parties: [
      { id: 'A.q', owner: 'A', column: 4, row: 4, mount: 'queen', supply: 2, slots: { 4: 'pikeman', 5: 'center', 6: 'mage' } },
      { id: 'B.p', owner: 'B', column: 5, row: 6, mount: 'castle', facing: 'S', slots: { 1: 'swordsman', 2: 'swordsman', 3: 'swordsman', 5: 'center' } },
      { id: 'A.commander', owner: 'A', column: 1, row: 1, mount: 'commander', commander: true, slots: { 5: 'center' } },
      { id: 'B.commander', owner: 'B', column: 9, row: 10, mount: 'commander', commander: true, slots: { 5: 'center' } },
    ] }), { id: 'enemy', title: 'Enemy contact' });
    openTick(d);
    while (!d.state.activeColumns.includes(4)) { closeTick(d, { A: [], B: [] }, pass); openTick(d); }
    const events = [...closeTick(d, { A: [{ type: 'set_destination', partyId: 'A.q', target: { column: 6, row: 6 } }], B: [] }, pass).events];
    for (let i = 0; i < 2; i++) { openTick(d); events.push(...closeTick(d, { A: [], B: [] }, pass).events); }
    return events.filter((e) => ['contact', 'exchange', 'member_died', 'destination_reached'].includes(e.type)).map((e) => `${e.tick}:${e.type}:${e.quantum ?? ''}`);
  };
  const now = run(V304);
  assert.ok(now.some((x) => x.includes(':contact:')), 'an enemy in the neighbouring territory is met by body contact');
  assert.deepEqual(now, run('hapa_open_10x9_v3_03'));
});

test('v3_06 Knights turn for free: no Tick, no Supply; they face each leg and the chosen arrival facing', () => {
  const run = (profileId, cmd, ticks) => {
    const s = createSession({ matchId: `kt-${profileId}`, profile: profileById(profileId), catalog: CATALOG, seed: 1 });
    const ev = [];
    for (let t = 1; t <= ticks; t++) {
      openTick(s);
      const A = t === 2 ? [...bank(s).slice(0, 2).map((id) => ({ type: 'load_supply', cardId: id, partyId: 'A.mount.C2' })), cmd] : [];
      assert.deepEqual(validatePlan(s.state, s.ctx, 'A', A).errors, []);
      ev.push(...closeTick(s, { A, B: [] }, pass).events);
    }
    return { s, ev, k: s.state.parties['A.mount.C2'] };
  };
  const short = { type: 'set_destination', partyId: 'A.mount.C2', target: { column: 3, row: 3 }, via: 'short' };
  // v3_05: one Tick turning first; v3_06: it moves in Tick 2 and arrives a Tick earlier
  const old = run('hapa_open_10x9_v3_05', short, 3);
  assert.equal(old.ev.filter((e) => e.type === 'region_entered' && e.partyId === 'A.mount.C2' && e.tick === 2).length, 0);
  const now = run(DEFAULT_PROFILE_ID, short, 3);
  assert.ok(now.ev.some((e) => e.type === 'region_entered' && e.partyId === 'A.mount.C2' && e.tick === 2), 'moves in its first Tick');
  assert.deepEqual([now.k.region, now.k.facing, now.k.state], [{ column: 3, row: 3 }, 'N', 'idle']); // default: the way it was moving
  assert.equal(now.ev.filter((e) => e.type === 'supply_spent' && e.partyId === 'A.mount.C2').reduce((n, e) => n + e.units, 0) / now.s.ctx.U, 3); // the L's price only
  assert.deepEqual(now.ev.filter((e) => e.type === 'facing_changed').map((e) => `${e.from}>${e.to}:${e.cause}`), ['N>E:knight_leg', 'E>N:knight_leg']);
  // an ordered arrival facing
  const faced = run(DEFAULT_PROFILE_ID, { type: 'set_destination', partyId: 'A.mount.C2', target: { column: 3, row: 3 }, via: 'long', face: 'S' }, 3);
  assert.deepEqual([faced.k.region, faced.k.facing], [{ column: 3, row: 3 }, 'S']);
  assert.equal(verifyReplay(faced.s.replay).ok, true);
  // only Knights, and only N/E/S/W
  const s = createSession({ matchId: 'kf', profile: profileById(DEFAULT_PROFILE_ID), catalog: CATALOG, seed: 1 });
  openTick(s);
  assert.match(validatePlan(s.state, s.ctx, 'A', [{ type: 'load_supply', cardId: bank(s)[0], partyId: 'A.mount.C1' }, { type: 'set_destination', partyId: 'A.mount.C1', target: { column: 1, row: 2 }, face: 'E' }]).errors[0]?.error ?? '', /only a Knight/);
});
