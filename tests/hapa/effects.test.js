// HV-23 — layered characteristics, Major bindings and formation changes in contact
// (Master Requirements v3 ch.10 "Effect families and ordering", Appendix A "Formation and facing").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beginCount, runTick, validatePlan } from '../../src/hapa/rules/match.js';
import { individualProtection } from '../../src/hapa/rules/combat.js';
import { layeredValue, orderLayers } from '../../src/hapa/rules/effects.js';
import { scenario } from '../../fixtures/hapa/scenarios.js';

const U = 1_000_000;
const tick = (fx, plans = { A: [], B: [] }) => { beginCount(fx.state, fx.ctx); return runTick(fx.state, fx.ctx, plans).events; };

test('layers: base → set → add → multiply → limit, independent of input order', () => {
  const layers = [
    { id: 'm', stage: 'multiply', ratio: [1, 2] },
    { id: 'a', stage: 'add', value: 1 },
    { id: 's', stage: 'set', value: 3 },
    { id: 'l', stage: 'limit', max: 10 },
  ];
  assert.equal(layeredValue(1, layers).value, 2); // (3 + 1) × ½
  assert.equal(layeredValue(1, [...layers].reverse()).value, 2);
  // within a stage: creation order, then ID; an explicit dependency comes first
  const sets = [{ id: 'x', stage: 'set', value: 5, createdSeq: 2 }, { id: 'y', stage: 'set', value: 7, createdSeq: 1 }];
  assert.equal(layeredValue(0, sets).value, 5); // the later-created set wins
  assert.deepEqual(orderLayers([{ ...sets[0], dependsOn: [] }, { ...sets[1], dependsOn: ['x'] }]).map((l) => l.id), ['x', 'y']);
  assert.equal(layeredValue(0, [{ ...sets[0] }, { ...sets[1], dependsOn: ['x'] }]).value, 7);
  // no negative protection, and limits round down
  assert.equal(layeredValue(1, [{ id: 'n', stage: 'add', value: -4 }]).value, 0);
  assert.equal(layeredValue(3, [{ id: 'h', stage: 'multiply', ratio: [1, 2] }, { id: 'f', stage: 'limit' }]).value, 1);
});

test('a set-stage protection effect replaces the base; the Bound Standard still adds after it', () => {
  const fx = scenario({ majors: { 3: 'fixture.bound_standard' }, keep: ['A.mount.C5', 'B.mount.C5', 'A.mount.C3'], parties: [] });
  const s = fx.state;
  const bishop = s.parties['A.mount.C3'];
  const m = s.members[Object.values(bishop.slots).find((id) => id && s.members[id].isCenter)];
  const before = individualProtection(s, fx.ctx, m, 'physical', 'front').total;
  // (fixture) a set-stage effect created after the Standard: the value becomes 4, then the Standard adds 1
  s.effects['F.fixture.set'] = { id: 'F.fixture.set', definition: 'fixture.set_zero@1', source: 'fixture', owner: 'A', op: 'protection_modifier', active: true, stage: 'set', amount: 4, channel: 'physical', faces: ['front'], scope: 'bound_party', boundParty: bishop.id, createdSeq: 99 };
  const p = individualProtection(s, fx.ctx, m, 'physical', 'front');
  assert.ok(before >= 1); // the Standard applies to its Bishop
  assert.equal(p.total, 5); // set (4) precedes add (+1) although created later
  assert.ok(p.sources.some((x) => x.stage === 'set'));
});

/** A's Castle holds C5R5 with a center and one front-left Swordsman; B's Queen closes from R6. */
function engaged(extra = {}) {
  const fx = scenario({ parties: [
    { id: 'A.p', owner: 'A', mount: 'castle', column: 5, row: 5, slots: { 5: 'center', 1: 'swordsman', ...extra }, supply: 1 },
    { id: 'B.q', owner: 'B', mount: 'queen', column: 5, row: 6, slots: { 5: 'center', 1: 'swordsman', 2: 'swordsman', 3: 'swordsman' }, supply: 0.25 },
  ] });
  for (const m of Object.values(fx.state.members)) { m.hp = 50 * U; m.maxHp = 50 * U; } // (fixture) no casualties
  const s = fx.state;
  s.tick = 5; s.activeColumns = [5]; s.phase = 'planning';
  runTick(s, fx.ctx, { A: [], B: [{ type: 'set_destination', partyId: 'B.q', target: { column: 5, row: 5 } }] });
  assert.equal(s.parties['A.p'].state, 'engaged');
  s.tick = 13; // C5 active again at Tick 14
  return fx;
}

test('an engaged party may request a formation change; combat uses the old arrangement until a legal completion', () => {
  const fx = engaged();
  const s = fx.state;
  const sw = s.members['A.p.s1'];
  const old = { x: sw.x, y: sw.y };
  const plan = [{ type: 'change_formation', partyId: 'A.p', facing: 'E' }];
  beginCount(s, fx.ctx);
  assert.deepEqual(validatePlan(s, fx.ctx, 'A', plan).errors, []);
  const ev = runTick(s, fx.ctx, { A: plan, B: [] }).events;
  // this Tick's exchange came from the old arrangement
  const ex = ev.find((e) => e.type === 'exchange' && e.cause === 'scheduled');
  const startedAt = ev.findIndex((e) => e.type === 'formation_change_started');
  assert.ok(startedAt >= 0 && ev.indexOf(ex) > startedAt);
  assert.ok(ex.hits.some((h) => h.source === 'A.p.s1'));
  // facing E moves slot 1 to the front-right of the old front row: still touching B, so legal
  assert.ok(ev.some((e) => e.type === 'formation_changed' && e.partyId === 'A.p' && e.facing === 'E'));
  assert.equal(s.parties['A.p'].facing, 'E');
  assert.deepEqual({ x: sw.x, y: sw.y }, { x: s.parties['A.p'].x + U, y: s.parties['A.p'].y + U });
  assert.notDeepEqual({ x: sw.x, y: sw.y }, old);
  assert.equal(s.parties['A.p'].state, 'engaged');
  // no additional ordinary exchange in that Tick
  assert.equal(ev.filter((e) => e.type === 'exchange').length, 1);
  assert.equal(sw.lastVolleyTick, 0); // attack markers preserved (a Swordsman never volleys)
});

test('a rearrangement that would move a member out of hostile contact fails and keeps the old formation', () => {
  const fx = engaged();
  const s = fx.state;
  const sw = s.members['A.p.s1'];
  const old = { x: sw.x, y: sw.y };
  const ev = tick(fx, { A: [{ type: 'change_formation', partyId: 'A.p', facing: 'W' }], B: [] });
  const fail = ev.find((e) => e.type === 'formation_change_failed');
  assert.ok(fail);
  assert.match(fail.reason, /out of hostile contact/);
  assert.equal(fail.memberId, 'A.p.s1');
  assert.equal(s.parties['A.p'].facing, 'N');
  assert.deepEqual({ x: sw.x, y: sw.y }, old);
});

test('Wheel Formation changes duration only: immediate when legal, refused out of contact', () => {
  const card = (s, id) => {
    s.cards[id] = { id, owner: 'A', column: 1, localColumn: 1, tick: 13, suit: 'wands', rank: 5, supply: 5 * U, mana: {}, pips: [], ability: 'fixture.wheel_formation@1', abilityId: 'fixture.wheel_formation', state: 'available' };
    s.players.A.bank.minor['1'] = id;
  };
  // legal: E keeps the touching Swordsman in contact, and takes effect before the Tick's movement
  const fx = engaged();
  card(fx.state, 'A.wf');
  const ev = tick(fx, { A: [{ type: 'play_ability', cardId: 'A.wf', actorPartyId: 'A.p', target: { facing: 'E' } }], B: [] });
  const ch = ev.find((e) => e.type === 'formation_changed');
  assert.ok(ch && ch.immediate);
  assert.ok(ev.indexOf(ch) < ev.findIndex((e) => e.type === 'exchange'), 'immediate, before this Tick\'s exchange');
  assert.equal(fx.state.cards['A.wf'].state !== 'available', true);
  // illegal: W would pull the Swordsman out of contact — the Card's speed is no permission to escape
  const fx2 = engaged();
  card(fx2.state, 'A.wf2');
  const ev2 = tick(fx2, { A: [{ type: 'play_ability', cardId: 'A.wf2', actorPartyId: 'A.p', target: { facing: 'W' } }], B: [] });
  const f = ev2.find((e) => e.type === 'formation_change_failed');
  assert.ok(f && /out of hostile contact/.test(f.reason));
  assert.equal(fx2.state.parties['A.p'].facing, 'N');
});
