// Human-feedback addendum 01 §8: one versioned glossary covers the mechanical labels the interface
// shows; each entry has a short meaning and a source, and related terms resolve.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TERMS, termOf, GLOSSARY_VERSION } from '../../src/hapa/presentation/glossary.js';

const REQUIRED = [
  // Card types and the three uses; rank / suit / alignment
  'minor', 'major', 'enchantment', 'supply', 'burn', 'ability', 'rank', 'suit', 'alignment', 'mana', 'rainbow', 'firepit',
  // Mount / party / member / capacity; health, attack and defense categories; range, area
  'mount', 'party', 'member', 'capacity', 'health', 'physical', 'magic', 'defense', 'range',
  // formation / facing / contact; Tick / Round / active columns; route / Speed / destination
  'facing', 'contact', 'tick', 'round', 'active', 'route', 'speed', 'funded',
  // band / support / exposure / roof; frontier / income / blocking
  'band', 'exposure', 'roof', 'frontier', 'income', 'blocking',
  // planned / accepted / reserved / replaced; Ready / frozen / stale; response / Pass
  'planned', 'accepted', 'reserved', 'replaced', 'ready', 'frozen', 'stale', 'response', 'pass',
  // identities the board shows
  'commander', 'capital', 'pawn',
];

test('the glossary covers every required mechanical term with a meaning and a source', () => {
  assert.match(GLOSSARY_VERSION, /^hapa-versus-glossary\/\d+/);
  for (const id of REQUIRED) {
    const t = TERMS[id];
    assert.ok(t, `missing term ${id}`);
    assert.ok(t.label && t.short.length > 20 && t.source, `incomplete term ${id}`);
    for (const r of t.related ?? []) assert.ok(TERMS[r], `${id} relates to unknown ${r}`);
  }
});

test('aliases resolve to their canonical entry', () => {
  assert.equal(termOf('Supply Card').id, 'minor');
  assert.equal(termOf('movement allowance').id, 'supply');
  assert.equal(termOf('HP').id, 'health');
  assert.equal(termOf('nonsense'), null);
});

test('current-state examples come from supplied values, not invented ones', () => {
  assert.equal(TERMS.supply.example({ party: {}, held: 2e6, planned: 1e6, need: 3e6 }), 'This party holds 2 + 1 planned; the selected route needs 3.');
  assert.equal(TERMS.supply.example({}), null);
});
