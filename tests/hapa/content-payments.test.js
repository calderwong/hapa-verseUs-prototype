/**
 * Shared rules and executable content (review 17, R17-01 and R17-02). Adapted from the review's
 * rules/content probe into positive regressions: repeated fuel is refused before anything is
 * consumed (casts and responses), distinct multi-Card payments still work, and imported operation
 * payloads are validated against the installed schema before storage or match admission.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scenario } from '../../fixtures/hapa/scenarios.js';
import { CATALOG } from '../../fixtures/hapa/content.js';
import { beginCount, validatePlan, resolveTick } from '../../src/hapa/rules/match.js';
import { stateFingerprint } from '../../src/hapa/rules/state.js';
import { validateContent } from '../../src/hapa/rules/validate.js';
import { exportBundle, loadBundle } from '../../src/hapa/adapters/content.js';

const card = (id, owner, column, abilityId, mana = {}) => ({ id, owner, column, state: 'available', category: 'minor', abilityId, ability: `${abilityId}@1`, supply: 0, mana });
function make(catalog = CATALOG) {
  const s = scenario({ profileId: 'hapa_open_10x9_v3_07', catalog, parties: [
    { id: 'A.caster', owner: 'A', mount: 'castle', column: 1, row: 3, slots: { 5: 'center' } },
    { id: 'B.target', owner: 'B', mount: 'castle', column: 1, row: 4, slots: { 5: 'center' } },
  ] });
  beginCount(s.state, s.ctx);
  s.state.players.A.pool = {};
  const put = (c) => { s.state.cards[c.id] = c; s.state.players[c.owner].bank.minor[String(c.column)] = c.id; };
  put(card('t.cast', 'A', 1, 'fixture.ember_strike'));
  put(card('t.fuel', 'A', 2, 'fixture.resource_only', { red: 1 }));
  put(card('t.fuel2', 'A', 3, 'fixture.resource_only', { red: 1 }));
  return { s, put };
}
const cast = (burns) => ({ type: 'play_ability', cardId: 't.cast', actorPartyId: 'A.caster', target: { memberId: 'B.target.s5' }, burns });
const resolve = (s, plans, answer = () => ({ pass: true })) => { const g = resolveTick(s.state, s.ctx, plans); let n = g.next(); while (!n.done) n = g.next(answer(n.value)); return n.value; };

test('R17-01: a Card instance pays Mana once — repeated fuel is refused before anything is consumed', () => {
  const { s } = make();
  const v = validatePlan(s.state, s.ctx, 'A', [cast(['t.fuel', 't.fuel'])]);
  assert.equal(v.ok, false);
  assert.match(v.errors[0].error, /only once/);
  const events = resolve(s, { A: [cast(['t.fuel', 't.fuel'])], B: [] });
  assert.equal(events.filter((e) => e.type === 'card_burned').length, 0);
  assert.equal(events.filter((e) => e.type === 'card_damage').length, 0);
  assert.equal(s.state.cards['t.fuel'].state, 'available');
  assert.equal(s.state.cards['t.cast'].state, 'available');
  assert.deepEqual(s.state.players.A.pool, {});
});

test('R17-01: a distinct two-Card payment still pays, each Card burns once and replay agrees', () => {
  const { s } = make();
  assert.equal(validatePlan(s.state, s.ctx, 'A', [cast(['t.fuel', 't.fuel2'])]).ok, true);
  const events = resolve(s, { A: [cast(['t.fuel', 't.fuel2'])], B: [] });
  const burned = events.filter((e) => e.type === 'card_burned').map((e) => e.cardId).sort();
  assert.deepEqual(burned, ['t.fuel', 't.fuel2']);
  assert.equal(events.filter((e) => e.type === 'card_damage').length, 1);
  assert.ok(Number.isSafeInteger(s.state.members['B.target.s5'].hp));
});

test('R17-01: a response cannot repeat its fuel either; the honest response fails on cost and the spell resolves', () => {
  for (const burns of [['t.blue', 't.blue'], ['t.blue']]) {
    const { s, put } = make();
    s.state.players.A.pool = { red: 2 };
    put(card('t.counter', 'B', 9, 'fixture.blue_denial'));
    put(card('t.blue', 'B', 8, 'fixture.resource_only', { blue: 1 }));
    let answered = false;
    const events = resolve(s, { A: [cast([])], B: [] }, (req) => {
      if (!answered && req.kind === 'response' && req.seat === 'B') { answered = true; return { cardId: 't.counter', actorPartyId: 'B.target', target: { stackId: req.stack[0].id }, burns }; }
      return { pass: true };
    });
    assert.equal(events.some((e) => e.type === 'response_announced'), false);
    assert.equal(events.some((e) => e.type === 'command_rejected'), true);
    assert.equal(events.filter((e) => e.type === 'card_burned' && e.cardId === 't.blue').length, 0);
    assert.equal(s.state.cards['t.blue'].state, 'available');
    assert.equal(events.filter((e) => e.type === 'card_damage' && e.cardId === 't.cast').length, 1);
  }
});

test('R17-02: an executable payload missing a required field is refused with a field error before import', () => {
  const corrupt = structuredClone(CATALOG);
  const broken = structuredClone(CATALOG.cards['fixture.ember_strike']);
  broken.id = 'probe.missing_power'; broken.title = 'Missing power fixture'; broken.cost.mana = {}; delete broken.operations[0].power;
  corrupt.cards[broken.id] = broken;
  const v = validateContent(corrupt);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => /probe\.missing_power: operation 1 \(damage\): missing required field "power"/.test(e)), v.errors.join('; '));
  const bundle = exportBundle({ ...corrupt, cards: { ...CATALOG.cards, [broken.id]: broken } }, [broken.id], { exporter: { id: 'dev:test', kind: 'local_development_identity' } });
  const imported = loadBundle(bundle, CATALOG);
  assert.equal(imported.ok, false);
  for (const [field, value] of [['hits', 0], ['channel', 'fire'], ['incomingFace', 'up'], ['power', Number.POSITIVE_INFINITY]]) {
    const c = structuredClone(CATALOG); const d = structuredClone(CATALOG.cards['fixture.ember_strike']);
    d.operations[0][field] = value; c.cards[d.id] = d;
    assert.equal(validateContent(c).ok, false, `${field}=${value} should be refused`);
  }
});

test('R17-02: a valid custom damage Card imports, plays and keeps finite safe-integer state', () => {
  const custom = structuredClone(CATALOG.cards['fixture.ember_strike']);
  custom.id = 'custom.spark'; custom.title = 'Spark'; custom.cost.mana = {}; custom.operations[0].power = 3;
  const withCustom = { ...structuredClone(CATALOG), cards: { ...CATALOG.cards, [custom.id]: custom } };
  assert.equal(validateContent(withCustom).ok, true);
  const imported = loadBundle(exportBundle(withCustom, [custom.id], { exporter: { id: 'dev:test', kind: 'local_development_identity' } }), CATALOG);
  assert.equal(imported.ok, true, JSON.stringify(imported.errors ?? imported.error));
  const { s } = make(imported.catalog);
  s.state.cards['t.cast'].abilityId = custom.id; s.state.cards['t.cast'].ability = `${custom.id}@1`;
  assert.equal(validatePlan(s.state, s.ctx, 'A', [cast([])]).ok, true);
  const events = resolve(s, { A: [cast([])], B: [] });
  assert.equal(events.filter((e) => e.type === 'card_damage').length, 1);
  assert.doesNotThrow(() => stateFingerprint(s.state));
});
