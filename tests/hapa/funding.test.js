// Human-feedback addendum 01, HF-04: under hapa_open_10x9_v3_02 a new destination needs its whole
// remaining route funded by held Supply plus earlier planned loads. Supply sets distance, Speed the
// rate. The v3 base profile keeps partial-Supply travel for its golden fixtures and old replays.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scenario } from '../../fixtures/hapa/scenarios.js';
import { BASE_PROFILE, DEFAULT_PROFILE_ID, profileById } from '../../fixtures/hapa/profiles.js';
import { CATALOG } from '../../fixtures/hapa/content.js';
import { createFixtureSession, createSession, openTick, closeTick, playMatch, verifyReplay } from '../../src/hapa/rules/session.js';
import { validatePlan, projectPlan } from '../../src/hapa/rules/match.js';
import { quoteRoute, quotedDestinations } from '../../src/hapa/rules/movement.js';
import { validateProfile } from '../../src/hapa/rules/validate.js';
import { HeuristicBot } from '../../src/hapa/controllers/heuristic-bot.js';

const U = 1_000_000;
const pass = () => ({ pass: true });
const party = (id, column, row, mount, supply) => ({ id, owner: 'A', mount, column, row, slots: { 5: 'center', 2: 'swordsman' }, supply });
const enemy = { id: 'B.far', owner: 'B', mount: 'castle', column: 9, row: 10, slots: { 5: 'center' } };

/** A scenario session with the parties, opened to a Tick whose active columns include `column`. */
function at(profileId, parties, column) {
  const sess = createFixtureSession(scenario({ profileId, matchId: `funding-${profileId}`, parties: [...parties, enemy] }), { id: 'funding', title: 'Funding diagnostic' });
  openTick(sess);
  while (!sess.state.activeColumns.includes(column)) { closeTick(sess, { A: [], B: [] }, pass); openTick(sess); }
  return sess;
}
const errorsOf = (sess, cmds) => validatePlan(sess.state, sess.ctx, 'A', cmds).errors.map((e) => `${e.index}:${e.type}`);
const move = (partyId, column, row) => ({ type: 'set_destination', partyId, target: { column, row } });

test('the funded profile validates; an unknown funding policy is rejected', () => {
  assert.equal(validateProfile(profileById(DEFAULT_PROFILE_ID), CATALOG).ok, true);
  const bad = profileById(DEFAULT_PROFILE_ID);
  bad.movement.destinationFunding = 'pay_later';
  assert.match(validateProfile(bad, CATALOG).errors.join(';'), /unknown movement.destinationFunding policy "pay_later"/);
  assert.equal(profileById(BASE_PROFILE.id).movement.destinationFunding, undefined, 'the v3 base profile is unchanged');
});

test('Castle with Supply 2: a two-step endpoint is funded, three steps is not (the old profile allows both)', () => {
  const s = at(DEFAULT_PROFILE_ID, [party('A.c', 1, 3, 'castle', 2)], 1);
  assert.deepEqual(errorsOf(s, [move('A.c', 1, 5)]), []);
  const e = validatePlan(s.state, s.ctx, 'A', [move('A.c', 1, 6)]).errors[0];
  assert.match(e.error, /needs 3, the party has 2/);
  const legacy = at(BASE_PROFILE.id, [party('A.c', 1, 3, 'castle', 2)], 1);
  assert.deepEqual(errorsOf(legacy, [move('A.c', 1, 6)]), [], 'v3: partial Supply may start a longer route');
  assert.deepEqual(errorsOf(at(BASE_PROFILE.id, [party('A.c', 1, 3, 'castle', 0)], 1), [move('A.c', 1, 7)]), []);
});

test('Knight: Supply 2 cannot fund the L (3); Supply 3 can — Speed 2 is the rate, not the range', () => {
  const two = at(DEFAULT_PROFILE_ID, [party('A.k', 2, 3, 'knight', 2)], 2);
  assert.equal(validatePlan(two.state, two.ctx, 'A', [move('A.k', 3, 5)]).errors.length, 1);
  const three = at(DEFAULT_PROFILE_ID, [party('A.k', 2, 3, 'knight', 3)], 2);
  assert.deepEqual(errorsOf(three, [move('A.k', 3, 5)]), []);
  const q = quoteRoute(three.state, three.ctx, three.state.parties['A.k'], { column: 3, row: 5 });
  assert.equal(q.required, 3 * U);
});

test('a two-step Castle route with Supply 2 takes two Ticks and arrives with nothing left', () => {
  const s = at(DEFAULT_PROFILE_ID, [party('A.c', 1, 3, 'castle', 2)], 1);
  closeTick(s, { A: [move('A.c', 1, 5)], B: [] }, pass);
  for (let i = 0; i < 4 && s.state.parties['A.c'].destination; i++) { openTick(s); closeTick(s, { A: [], B: [] }, pass); }
  const P = s.state.parties['A.c'];
  assert.deepEqual(P.region, { column: 1, row: 5 });
  assert.equal(P.supply.reduce((n, x) => n + x.units, 0), 0);
  assert.equal(verifyReplay(s.replay).ok, true);
});

test('only a valid preceding planned load funds a destination', () => {
  const s = at(DEFAULT_PROFILE_ID, [party('A.c', 1, 3, 'castle', 0), { ...party('A.other', 3, 3, 'castle', 0) }], 1);
  const card = s.state.players.A.bank.minor['1'];
  assert.ok(card, 'the Tick 1 mint gives A a C1 Card');
  const supply = s.state.cards[card].supply / U;
  const steps = supply; // one step per Supply at baseline prices
  const load = { type: 'load_supply', cardId: card, partyId: 'A.c' };
  assert.deepEqual(errorsOf(s, [load, move('A.c', 1, 3 + steps)]), [], 'load first, then the funded move');
  assert.deepEqual(errorsOf(s, [move('A.c', 1, 3 + steps), load]), ['0:set_destination'], 'a later load does not count');
  assert.deepEqual(errorsOf(s, [{ ...load, partyId: 'A.other' }, move('A.c', 1, 3 + steps)]), ['1:set_destination'], 'Supply for another party does not count');
  assert.deepEqual(errorsOf(s, [{ type: 'burn', cardId: card }, load, move('A.c', 1, 3 + steps)]), ['1:load_supply', '2:set_destination'], 'a Card burned first cannot also fund');
  // the projection used by the board shows the same funded range
  const proj = projectPlan(s.state, s.ctx, 'A', [load]);
  const funded = quotedDestinations(proj.state, s.ctx, proj.state.parties['A.c']).filter((d) => d.funded).map((d) => `R${d.row}C${d.column}`);
  assert.ok(funded.includes(`R${3 + steps}C1`) && !funded.includes(`R${4 + steps}C1`), funded.join(' '));
  // removing the funding load leaves the dependent destination explicitly invalid (not shortened)
  assert.deepEqual(errorsOf(s, [move('A.c', 1, 3 + steps)]), ['0:set_destination']);
});

test('mid-edge replacement includes the unfinished edge: 2.5 Supply for half an edge plus two steps', () => {
  const s = at(DEFAULT_PROFILE_ID, [party('A.c', 1, 3, 'castle', 2.5)], 1);
  const P = s.state.parties['A.c'], { geo } = s.ctx;
  // diagnostic state: half a pitch short of R4C1 on an accepted route there
  const next = geo.center(1, 4);
  P.x = next.x; P.y = next.y - geo.pitch / 2;
  P.route = [{ column: 1, row: 4, ...next }]; P.destination = { column: 1, row: 4 }; P.state = 'moving';
  for (const id of Object.values(P.slots)) if (id) { const m = s.state.members[id]; m.y -= geo.pitch / 2; }
  const q = quoteRoute(s.state, s.ctx, P, { column: 1, row: 6 });
  assert.equal(q.required, 2.5 * U, 'half an edge plus two steps');
  P.supply[0].units = 2.4 * U;
  assert.equal(validatePlan(s.state, s.ctx, 'A', [move('A.c', 1, 6)]).errors.length, 1);
  P.supply[0].units = 2.5 * U;
  assert.deepEqual(errorsOf(s, [move('A.c', 1, 6)]), []);
  closeTick(s, { A: [move('A.c', 1, 6)], B: [] }, pass);
  for (let i = 0; i < 4 && P.destination; i++) { openTick(s); closeTick(s, { A: [], B: [] }, pass); }
  assert.deepEqual(P.region, { column: 1, row: 6 });
  assert.equal(P.supply.reduce((n, x) => n + x.units, 0), 0, 'the actual debit equals the quote');
});

test('nondefault prices: quote, acceptance and actual debit agree (Knight L at 4, Castle step at 2)', () => {
  for (const [mount, column, target, held, change] of [['knight', 2, { column: 3, row: 5 }, 4, { knightRouteCost: 4 }], ['castle', 1, { column: 1, row: 5 }, 4, { stepCost: 2 }]]) {
    const s = at(DEFAULT_PROFILE_ID, [party('A.p', column, 3, mount, held)], column);
    Object.assign(s.ctx.profile.movement, change); // diagnostic price change, this test only
    const P = s.state.parties['A.p'];
    const q = quoteRoute(s.state, s.ctx, P, target);
    assert.equal(q.required, held * U, `${mount}: quote`);
    P.supply[0].units = held * U - 1;
    assert.equal(validatePlan(s.state, s.ctx, 'A', [move('A.p', target.column, target.row)]).errors.length, 1, `${mount}: one unit short is refused`);
    P.supply[0].units = held * U;
    closeTick(s, { A: [move('A.p', target.column, target.row)], B: [] }, pass);
    for (let i = 0; i < 5 && P.destination; i++) { openTick(s); closeTick(s, { A: [], B: [] }, pass); }
    assert.deepEqual(P.region, target, `${mount}: arrives`);
    assert.equal(P.supply.reduce((n, x) => n + x.units, 0), 0, `${mount}: debited exactly the quote`);
  }
});

test('bots plan funded destinations in a valid order, and bot-vs-bot replays verify under both profiles', () => {
  for (const profileId of [DEFAULT_PROFILE_ID, BASE_PROFILE.id]) {
    const sess = createSession({ matchId: `bots-${profileId}`, profile: profileById(profileId), catalog: CATALOG, seed: 7 });
    const bots = { A: new HeuristicBot({ seat: 'A', seed: 3 }), B: new HeuristicBot({ seat: 'B', seed: 4 }) };
    let moves = 0, refused = 0;
    playMatch(sess, bots, { tickBudget: 30, onTick: () => {} });
    // replay the recorded plans: under the funded profile none of the bots' own commands may be refused
    for (const t of sess.replay.ticks) for (const seat of ['A', 'B']) moves += t.plans[seat].filter((c) => c.type === 'set_destination').length;
    refused = sess.events.filter((e) => e.type === 'command_rejected' && e.command?.type === 'set_destination').length;
    assert.ok(moves > 0, `${profileId}: bots moved`);
    assert.equal(verifyReplay(sess.replay).ok, true, `${profileId}: replay verifies`);
    if (profileId === DEFAULT_PROFILE_ID) {
      assert.equal(refused, 0, 'no accepted destination is refused at resolution');
      // every recorded destination was funded by Supply held or loaded earlier in the same plan
      const fresh = createSession({ matchId: `bots-${profileId}`, profile: profileById(profileId), catalog: CATALOG, seed: 7 });
      for (const t of sess.replay.ticks) {
        openTick(fresh);
        for (const seat of ['A', 'B']) assert.deepEqual(validatePlan(fresh.state, fresh.ctx, seat, t.plans[seat]).errors, [], `Tick ${t.tick} ${seat}`);
        closeTick(fresh, t.plans, (req) => t.choices.shift?.() ?? pass(req));
      }
    }
  }
});
