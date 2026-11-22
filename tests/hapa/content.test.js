// HV-39 — content exchange (Master Requirements v3 ch.11; ch.16 "Content exchange": both peers
// receive complete compatible definitions; a derivative preserves its creator lineage and original
// parent; unsupported operations are named before play).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportBundle, loadBundle, deriveDefinition, reviseDefinition, generateWording, bundleText, definitionHash } from '../../src/hapa/adapters/content.js';
import { parseStrict, fingerprint, clone } from '../../src/hapa/rules/encoding.js';
import { beginCount, runTick } from '../../src/hapa/rules/match.js';
import { createManifest } from '../../src/hapa/rules/state.js';
import { CATALOG } from '../../fixtures/hapa/content.js';
import { opening, scenario } from '../../fixtures/hapa/scenarios.js';

const U = 1_000_000;
const CREATOR_B = { id: 'dev:creator-b', kind: 'local_development_identity', label: 'Player B (development identity)' };

/** Client B authors Ember Lance from Ember Strike: 3 power for 2 Red + 1 Black. */
function clientB() {
  const lance = deriveDefinition(CATALOG.cards['fixture.ember_strike'], { title: 'Ember Lance', operations: [{ type: 'damage', hits: 1, power: 3, channel: 'magic', incomingFace: 'front' }], cost: { consumeSourceInstance: true, mana: { red: 2, black: 1 } } }, CREATOR_B);
  const catalog = clone(CATALOG);
  catalog.cards[lance.id] = lance;
  return { lance, catalog };
}

test('a derived Card keeps its creator, its parent and the original; wording is generated from its operations', () => {
  const { lance } = clientB();
  assert.equal(lance.id, 'dev_creator_b.ember_lance');
  assert.equal(lance.revision, 1);
  assert.equal(lance.lineage.creator.id, 'dev:creator-b');
  assert.equal(lance.lineage.parents[0].id, 'fixture.ember_strike');
  assert.equal(lance.lineage.original.id, 'fixture.ember_strike');
  assert.equal(lance.lineage.original.creator.id, 'hapa-versus:fixture-author');
  assert.equal(lance.text, 'Consume this card and pay 2 Red and 1 Black. A friendly party in an active column deals one 3-point Magic hit from the Front to one enemy member in any of the eight adjacent territories at the same height. Counterable.');
  // a derivative of a derivative still names the original parent
  const again = deriveDefinition(lance, { title: 'Ember Pike' }, { id: 'dev:creator-c', kind: 'local_development_identity' });
  assert.equal(again.lineage.parents[0].id, lance.id);
  assert.equal(again.lineage.original.id, 'fixture.ember_strike');
  // a revision keeps the identity and points at the previous revision
  const r2 = reviseDefinition(lance, { cost: { consumeSourceInstance: true, mana: { red: 3 } } }, CREATOR_B);
  assert.equal(r2.id, lance.id);
  assert.equal(r2.revision, 2);
  assert.equal(r2.lineage.parents[0].hash, definitionHash(lance));
  assert.match(r2.text, /pay 3 Red\./);
});

test('a bundle crosses to another client byte for byte; the recipient verifies hashes and uses it with attribution', () => {
  const { lance, catalog } = clientB();
  const bundle = exportBundle(catalog, [lance.id], { exporter: CREATOR_B });
  const wire = bundleText(bundle);
  // client A: a separate catalog that has never seen Ember Lance
  const r = loadBundle(parseStrict(wire), CATALOG, { receivedFrom: 'dev:participant-b' });
  assert.deepEqual(r.errors, []);
  assert.ok(r.ok);
  assert.equal(r.received[0].hash, definitionHash(lance));
  assert.equal(r.received[0].creator, 'dev:creator-b');
  assert.equal(CATALOG.cards[lance.id], undefined, 'the local catalog object is never mutated');
  assert.equal(bundleText(exportBundle(r.catalog, [lance.id], { exporter: CREATOR_B })), wire, 'exportBundle returns the same bytes');

  // B's deck binds Ember Lance to its local C2; A's client mints B's C2 card with that ability
  const decks = { A: { majors: {}, bindings: opening().manifest.decks.A.bindings }, B: { majors: {}, bindings: { ...opening().manifest.decks.B.bindings, 2: lance.id } } };
  const fx = opening(undefined, { catalog: r.catalog, decks });
  for (let t = 1; t <= 2; t++) { beginCount(fx.state, fx.ctx); if (t < 2) runTick(fx.state, fx.ctx, { A: [], B: [] }); }
  const bCard = fx.state.cards[fx.state.players.B.bank.minor['8']]; // B's local C2 is global C8
  assert.equal(bCard.ability, `${lance.id}@1`);
  const aCard = fx.state.cards[fx.state.players.A.bank.minor['2']];
  assert.equal(aCard.ability, 'fixture.ember_strike@1'); // A's own deck is unchanged

  // played: the announcement names the exact revision and its creator; the hit has 3 power
  const sc = scenario({ catalog: r.catalog, decks, parties: [
    { id: 'A.t', owner: 'A', mount: 'castle', column: 5, row: 5, slots: { 5: 'center', 2: 'swordsman' } },
    { id: 'B.c', owner: 'B', mount: 'castle', column: 5, row: 6, slots: { 5: 'center' } },
  ] });
  const s = sc.state;
  s.tick = 4; beginCount(s, sc.ctx); // Tick 5: C5 active
  s.cards['B.lance'] = { id: 'B.lance', owner: 'B', column: 5, localColumn: 5, tick: 5, suit: 'wands', rank: 5, supply: 5 * U, mana: {}, pips: [], ability: `${lance.id}@1`, abilityId: lance.id, state: 'available' };
  s.players.B.bank.minor['5'] = 'B.lance';
  s.players.B.pool = { red: 2, black: 1 };
  s.members['A.t.s2'].hp = 10 * U;
  const ev = runTick(s, sc.ctx, { A: [], B: [{ type: 'play_ability', cardId: 'B.lance', actorPartyId: 'B.c', target: { memberId: 'A.t.s2' } }] }).events;
  const ann = ev.find((e) => e.type === 'ability_announced');
  assert.equal(ann.definition, `${lance.id}@1`);
  assert.equal(ann.creator, 'dev:creator-b');
  const hit = ev.find((e) => e.type === 'card_damage');
  assert.equal(hit.power, 3);
});

test('tampered bytes, unsupported operations and revision conflicts are named before play', () => {
  const { lance, catalog } = clientB();
  const bundle = exportBundle(catalog, [lance.id], { exporter: CREATOR_B });
  const tampered = clone(bundle);
  tampered.definitions[0].definition.operations[0].power = 9;
  assert.match(loadBundle(tampered, CATALOG).errors.join('\n'), /content hash mismatch/);

  const ride = deriveDefinition(CATALOG.cards['fixture.ember_strike'], { title: 'Ride Through', operations: [{ type: 'ride_through', exchanges: 1 }] }, CREATOR_B);
  const cat2 = clone(CATALOG); cat2.cards[ride.id] = ride; cat2.operations = { ...cat2.operations, ride_through: { version: 1, fields: ['exchanges'] } };
  const r = loadBundle(exportBundle(cat2, [ride.id], { exporter: CREATOR_B }), CATALOG);
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /unsupported operation "ride_through"/);
  assert.equal(r.catalog, CATALOG); // nothing merged

  // a different definition under an existing id and revision is a conflict, not an overwrite
  const forged = clone(lance); forged.title = 'Ember Lance (forged)'; forged.text = generateWording(forged);
  const local = loadBundle(exportBundle(catalog, [lance.id], { exporter: CREATOR_B }), CATALOG).catalog;
  const c2 = clone(catalog); c2.cards[lance.id] = forged;
  assert.match(loadBundle(exportBundle(c2, [lance.id], { exporter: CREATOR_B }), local).errors.join('\n'), /conflicts with local revision 1/);
  // wording that claims something the operations do not do is rejected
  const liar = clone(lance); liar.text = 'Deals 99 damage.';
  const c3 = clone(catalog); c3.cards[lance.id] = liar;
  assert.match(loadBundle(exportBundle(c3, [lance.id], { exporter: CREATOR_B }), CATALOG).errors.join('\n'), /wording does not match/);
});

test('a match keeps the catalog it agreed at setup when the local catalog later changes', () => {
  const { lance, catalog } = clientB();
  const manifest = createManifest({ matchId: 'm', profile: opening().ctx.profile, catalog });
  const before = manifest.catalogFingerprint;
  const r = loadBundle(exportBundle(catalog, [lance.id], { exporter: CREATOR_B }), catalog);
  r.catalog.cards[lance.id] = reviseDefinition(lance, { title: 'Ember Lance II' }, CREATOR_B);
  assert.equal(fingerprint(manifest.catalog), before);
});
