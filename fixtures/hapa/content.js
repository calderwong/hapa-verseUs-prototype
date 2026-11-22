/**
 * The bundled content catalog: member archetypes and the six diagnostic Cards (Master
 * Requirements v3, Chapters 7 and 10, Appendices A–B). Engineering example content, not final
 * balance or a claim about an existing Hapa collection. Every definition carries creator and
 * lineage fields; the catalog's fingerprints pin the exact bytes a match uses.
 *
 * Powers and protections are in points; the rules convert them to the shared health scale.
 */

const FIXTURE_CREATOR = { id: 'hapa-versus:fixture-author', kind: 'development', label: 'Hapa Versus requirements v3 (diagnostic content)' };
const lineage = (parents = []) => ({ creator: FIXTURE_CREATOR, parents, sourceHapaCard: null });

const FRONT = ['front'];
const ALL_FACES = ['front', 'rear', 'left', 'right', 'above', 'below'];

/** Member archetypes. `—` values from the roster are explicit zeros here (Appendix A fixture). */
export const ARCHETYPES = {
  swordsman: {
    schemaVersion: 1, id: 'fixture.swordsman', revision: 1, kind: 'archetype', title: 'Red Swordsman with Shield', role: 'swordsman', color: 'red',
    hp: 3, poolCapacity: 3,
    attacks: [{ id: 'sword', kind: 'melee', hits: 1, power: 3, channel: 'physical', charge: true }],
    protections: [{ id: 'shield', channel: 'physical', amount: 1, faces: FRONT, scope: 'line' }],
    lineage: lineage(),
  },
  pikeman: {
    schemaVersion: 1, id: 'fixture.pikeman', revision: 1, kind: 'archetype', title: 'Blue Pikeman', role: 'pikeman', color: 'blue',
    hp: 3, poolCapacity: 3,
    attacks: [{ id: 'pike', kind: 'melee', hits: 1, power: 3, channel: 'physical', charge: true }],
    protections: [{ id: 'pike-guard', channel: 'physical', amount: 1, faces: FRONT, scope: 'line' }],
    traits: ['pike_entrench', 'blocks_charge_through'],
    lineage: lineage(),
  },
  archer: {
    schemaVersion: 1, id: 'fixture.archer', revision: 1, kind: 'archetype', title: 'Green Archer', role: 'archer', color: 'green',
    hp: 3, poolCapacity: 3,
    attacks: [{ id: 'bow', kind: 'ranged', hits: 2, power: 1, channel: 'physical', face: 'above', range: 2, elevation: true, needsArc: true }],
    protections: [],
    lineage: lineage(),
  },
  mage: {
    schemaVersion: 1, id: 'fixture.mage', revision: 1, kind: 'archetype', title: 'Orange Mage', role: 'mage', color: 'orange',
    hp: 3, poolCapacity: 3,
    attacks: [{ id: 'bolt', kind: 'ranged', hits: 1, power: 2, channel: 'magic', face: 'actual', range: 2 }],
    protections: [{ id: 'ward', channel: 'magic', amount: 1, faces: ALL_FACES, scope: 'party' }],
    lineage: lineage(),
  },
  priest: {
    schemaVersion: 1, id: 'fixture.priest', revision: 1, kind: 'archetype', title: 'Purple Priest', role: 'priest', color: 'purple',
    hp: 3, poolCapacity: 3,
    attacks: [{ id: 'smite', kind: 'ranged', hits: 1, power: 1, channel: 'magic', face: 'actual', range: 2 }],
    protections: [],
    lineage: lineage(),
  },
  center: {
    schemaVersion: 1, id: 'fixture.center', revision: 1, kind: 'archetype', title: 'Mount center (diagnostic)', role: 'center', color: null,
    hp: 6, poolCapacity: 6,
    attacks: [{ id: 'blade', kind: 'melee', hits: 1, power: 3, channel: 'physical', charge: true }],
    protections: [{ id: 'center-guard', channel: 'physical', amount: 1, faces: FRONT, scope: 'line' }],
    lineage: lineage(),
  },
};

/** Supported rule operations (rules version hapa-versus-rules/0.1.0). */
export const OPERATIONS = Object.freeze({
  damage: { version: 1, fields: ['hits', 'power', 'channel', 'incomingFace'] },
  counter: { version: 1, fields: [] },
  formation_immediate: { version: 1, fields: [] },
  place_row_enchantment: { version: 1, fields: ['row'] },
  mint_row_multiplier: { version: 1, fields: ['factor'] },
  protection_modifier: { version: 1, fields: ['channel', 'faces', 'amount'] },
  excavate: { version: 1, fields: [] },
  fill: { version: 1, fields: [] },
});

/** The six diagnostic Cards plus the resource-only fallback (Chapter 10; Appendix B shape). */
export const CARDS = {
  'fixture.ember_strike': {
    schemaVersion: 1, id: 'fixture.ember_strike', revision: 1, category: 'spell', title: 'Ember Strike', color: 'red',
    text: 'Consume this card and pay 2 Red. A friendly party in an active column deals one 2-point Magic hit from the Front to one enemy member in any of the eight adjacent territories at the same height. Counterable.',
    timing: 'ordinary_action',
    cost: { consumeSourceInstance: true, mana: { red: 2 } },
    actor: { owner: 'self', kind: 'party', activeColumnRequired: true },
    target: { owner: 'opponent', kind: 'living_member', adjacentTerritories: 'eight_neighbors', sameHeight: true, lineOfSightRequired: false },
    counterable: true,
    operations: [{ type: 'damage', hits: 1, power: 2, channel: 'magic', incomingFace: 'front' }],
    invalidTargets: 'resolve_legal_remainder',
    refundOnCounter: false,
    lineage: lineage(),
  },
  'fixture.blue_denial': {
    schemaVersion: 1, id: 'fixture.blue_denial', revision: 1, category: 'spell', title: 'Blue Denial', color: 'blue',
    text: 'Response: consume this card and pay 2 Blue. Counter one pending counterable Spell. Any friendly party may act as the source, even outside active columns; no range limit.',
    timing: 'response',
    cost: { consumeSourceInstance: true, mana: { blue: 2 } },
    actor: { owner: 'self', kind: 'party', activeColumnRequired: false },
    target: { kind: 'pending_spell', counterable: true },
    counterable: true,
    operations: [{ type: 'counter' }],
    invalidTargets: 'resolve_legal_remainder',
    refundOnCounter: false,
    lineage: lineage(),
  },
  'fixture.wheel_formation': {
    schemaVersion: 1, id: 'fixture.wheel_formation', revision: 1, category: 'skill', title: 'Wheel Formation', color: 'purple',
    text: 'Consume this card. A friendly party in an active column changes to one legal formation and facing immediately instead of taking a Tick. It cannot move members out of hostile contact.',
    timing: 'ordinary_action',
    cost: { consumeSourceInstance: true, mana: {} },
    actor: { owner: 'self', kind: 'party', activeColumnRequired: true },
    target: { kind: 'self_actor' },
    counterable: false,
    operations: [{ type: 'formation_immediate' }],
    invalidTargets: 'resolve_legal_remainder',
    refundOnCounter: false,
    lineage: lineage(),
  },
  'fixture.row_mana_double': {
    schemaVersion: 1, id: 'fixture.row_mana_double', revision: 1, category: 'enchantment', title: 'Row Mana Double', color: 'white',
    text: 'Consume this card and pay 2 Blue through a friendly party in an active column. Place it in an empty row slot for an enemy-half Mana row. While present, double that row\'s contributions to your newly minted cards.',
    timing: 'ordinary_action',
    cost: { consumeSourceInstance: true, mana: { blue: 2 } },
    actor: { owner: 'self', kind: 'party', activeColumnRequired: true },
    target: { kind: 'own_row_slot', enemyHalfManaRow: true, empty: true },
    counterable: true,
    operations: [{ type: 'place_row_enchantment' }, { type: 'mint_row_multiplier', factor: 2, stage: 'row_contribution' }],
    duration: { until: 'source_leaves' },
    invalidTargets: 'resolve_legal_remainder',
    refundOnCounter: false,
    lineage: lineage(),
  },
  'fixture.bound_standard': {
    schemaVersion: 1, id: 'fixture.bound_standard', revision: 1, category: 'major', title: 'Bound Standard', color: 'purple',
    text: 'Major Arcana. Binds to the mount that starts in front of it. While this remains, that party gains +1 front Physical Defense once per hit calculation.',
    timing: 'setup',
    cost: { consumeSourceInstance: false, mana: {} },
    binding: { kind: 'mount_in_front_at_setup' },
    operations: [{ type: 'protection_modifier', channel: 'physical', faces: ['front'], amount: 1, scope: 'bound_party' }],
    duration: { until: 'source_leaves' },
    lineage: lineage(),
  },
  'fixture.column_standard': {
    schemaVersion: 1, id: 'fixture.column_standard', revision: 1, category: 'major', title: 'Column Standard', color: 'purple',
    text: 'Major Arcana. Each friendly party whose center is in this column gains +1 front Physical Defense once per hit calculation.',
    timing: 'setup',
    cost: { consumeSourceInstance: false, mana: {} },
    binding: { kind: 'column_region' },
    operations: [{ type: 'protection_modifier', channel: 'physical', faces: ['front'], amount: 1, scope: 'column_parties' }],
    duration: { until: 'source_leaves' },
    lineage: lineage(),
  },
  'fixture.resource_only': {
    schemaVersion: 1, id: 'fixture.resource_only', revision: 1, category: 'resource', title: 'Resource only', color: null,
    text: 'No attached ability: use this card for Supply or Mana.',
    timing: 'none', cost: { consumeSourceInstance: true, mana: {} }, operations: [], lineage: lineage(),
  },
};

/** Work tasks, materials and items (Chapter 9; Appendix A terrain and equipment). */
export const ITEMS = {
  'fixture.metal': { schemaVersion: 1, id: 'fixture.metal', revision: 1, kind: 'material', title: 'Metal', lineage: lineage() },
  'fixture.armor': {
    schemaVersion: 1, id: 'fixture.armor', revision: 1, kind: 'equipment', title: 'Sample armor', slot: 'torso',
    protections: [{ id: 'armor', channel: 'physical', amount: 1, faces: FRONT, scope: 'line' }], lineage: lineage(),
  },
  'fixture.armor_recipe': {
    schemaVersion: 1, id: 'fixture.armor_recipe', revision: 1, kind: 'recipe', title: 'Armor from Metal',
    inputs: { 'fixture.metal': 1 }, output: 'fixture.armor', ticks: 1, actor: 'living_center_stationary', lineage: lineage(),
  },
};

export const CATALOG = { schemaVersion: 1, id: 'hapa-versus.fixture-catalog', revision: 1, archetypes: ARCHETYPES, cards: CARDS, items: ITEMS, operations: OPERATIONS };
