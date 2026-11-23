// The diagnostic fixtures added for the 2026-11-22 design review (UX-02 response window, UX-03
// stacked heights) are legal states that resolve and replay like any other labeled fixture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UI_FIXTURES } from '../../fixtures/hapa/ui-fixtures.js';
import { createFixtureSession, openTick, closeTick, verifyReplay } from '../../src/hapa/rules/session.js';

test('response fixture: Ember Strike opens one response window per seat and resolves once', () => {
  const sess = createFixtureSession(UI_FIXTURES.response.build(), { id: 'response', title: 'Spell and response window' });
  openTick(sess);
  assert.equal(sess.state.tick, 9);
  assert.ok(sess.state.activeColumns.includes(1));
  const asked = [];
  const r = closeTick(sess, { A: [{ type: 'play_ability', cardId: 'A.ember', actorPartyId: 'A.c', target: { memberId: 'B.c.s2' }, burns: ['A.red'] }], B: [] }, (req) => { asked.push(req.seat); return { pass: true }; });
  assert.deepEqual(asked, ['B', 'A']); // the opponent responds first; two passes resolve the Spell
  assert.equal(r.events.filter((e) => e.type === 'card_damage').length, 1);
  assert.equal(r.events.filter((e) => e.type === 'plans_locked').length, 1);
  assert.equal(verifyReplay(sess.replay).ok, true);
});

test('stacked fixture: a flyer above a roofed tunnel party in one territory, replayable', () => {
  const sess = createFixtureSession(UI_FIXTURES.stacked.build(), { id: 'stacked', title: 'Stacked heights' });
  const s = sess.state;
  assert.deepEqual([s.parties['A.fly'].region, s.parties['B.tunnel'].region], [{ column: 5, row: 6 }, { column: 5, row: 6 }]);
  assert.deepEqual([s.parties['A.fly'].band, s.parties['B.tunnel'].band, s.parties['A.hill'].band], [3, -2, 2]);
  openTick(sess); closeTick(sess, { A: [], B: [] }, () => ({ pass: true }));
  assert.equal(verifyReplay(sess.replay).ok, true);
});

test('cards fixture: multi-color cards are ordinary bank instances and the match replays', () => {
  const sess = createFixtureSession(UI_FIXTURES.cards.build(), { id: 'cards', title: 'Card anatomy' });
  openTick(sess);
  const five = sess.state.cards['A.five'];
  assert.equal(Object.keys(five.mana).length, 5);
  assert.equal(sess.state.players.A.bank.minor['5'], 'A.five');
  closeTick(sess, { A: [{ type: 'burn', cardId: 'A.five' }], B: [] }, () => ({ pass: true }));
  assert.equal(verifyReplay(sess.replay).ok, true);
});

test('dig fixture: the inspector-planned dig is an ordinary begin_work that empties the cube and replays', async () => {
  const { solidAt } = await import('../../src/hapa/rules/terrain.js');
  const sess = createFixtureSession(UI_FIXTURES.dig.build(), { id: 'dig', title: 'Terrain work' });
  openTick(sess);
  assert.equal(solidAt(sess.state.terrain, 1, 10, -3), true);
  const r = closeTick(sess, { A: [{ type: 'begin_work', partyId: 'A.worker', work: 'excavate', target: { x: 1, y: 10, band: -3 } }], B: [] }, () => ({ pass: true }));
  assert.ok(r.events.some((e) => e.type === 'terrain_changed'));
  assert.equal(solidAt(sess.state.terrain, 1, 10, -3), false);
  assert.equal(verifyReplay(sess.replay).ok, true);
});
