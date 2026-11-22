// HV-03..HV-06 — encoding, profiles, content and initializeMatch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalize, fingerprint, parseStrict, xorshift32, EncodingError } from '../../src/hapa/rules/encoding.js';
import { validateProfile, validateContent } from '../../src/hapa/rules/validate.js';
import { createManifest, initializeMatch, stateFingerprint } from '../../src/hapa/rules/state.js';
import { profileById, PROFILE_IDS, BASE_PROFILE } from '../../fixtures/hapa/profiles.js';
import { CATALOG } from '../../fixtures/hapa/content.js';

test('Appendix B test vector: {"a":1,"b":2}', () => {
  assert.equal(canonicalize({ b: 2, a: 1 }), '{"a":1,"b":2}');
  assert.equal(fingerprint({ a: 1, b: 2 }), 'sha256:43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777');
});

test('canonical encoding rejects what public_protocol_v1 rejects', () => {
  for (const bad of [1.5, -0, Infinity, NaN, 2 ** 53, [1, , 3], { a: undefined }, '\ud800']) {
    assert.throws(() => canonicalize(bad), EncodingError, String(bad));
  }
  assert.throws(() => parseStrict('{"a":1,"a":2}'), /duplicate key/);
  assert.deepEqual(parseStrict('{"z":[1,2],"a":{"b":true}}'), { z: [1, 2], a: { b: true } });
  // integer-looking keys are written in UTF-16 order, not JavaScript's integer-first order
  assert.equal(canonicalize({ 10: 1, 2: 2, a: 3 }), '{"10":1,"2":2,"a":3}');
});

test('xorshift32_v1 rejects zero and is reproducible', () => {
  assert.throws(() => xorshift32(0));
  let x = 1;
  const seq = [];
  for (let i = 0; i < 4; i++) seq.push((x = xorshift32(x)));
  assert.deepEqual(seq, [270369, 67634689, 2647435461, 307599695]);
});

test('every profile validates and variants change only named fields', () => {
  for (const id of PROFILE_IDS) {
    const p = profileById(id);
    const r = validateProfile(p, CATALOG);
    assert.ok(r.ok, `${id}: ${r.errors.join('; ')}`);
  }
  const nine = profileById('hapa_open_9x9_v3_01');
  assert.equal(nine.board.rows, 9);
  assert.deepEqual(nine.board.dualRows, [5]);
  assert.deepEqual(nine.movement, BASE_PROFILE.movement);
  assert.equal(fingerprint(profileById(BASE_PROFILE.id)), fingerprint(JSON.parse(JSON.stringify(BASE_PROFILE))));
});

test('the profile validator rejects each listed invalid case with a reason', () => {
  const cases = [
    [(p) => (p.combat.protection = 'magic_shield'), /unknown combat.protection/],
    [(p) => (p.cards.bindings[2] = 'fixture.missing'), /missing definition "fixture.missing"/],
    [(p) => (p.movement.stepCost = -1), /negative ordinary movement cost/],
    [(p) => (p.roster.pawn.slots[5] = 'archer'), /impossible slot 5/],
    [(p) => (p.roster.pawn.slots[11] = 'archer'), /impossible slot 11/],
  ];
  for (const [mutate, reason] of cases) {
    const p = profileById(BASE_PROFILE.id);
    mutate(p);
    const r = validateProfile(p, CATALOG);
    assert.ok(!r.ok);
    assert.match(r.errors.join('\n'), reason);
  }
});

test('content validator names unsupported operations and duplicate ids', () => {
  assert.ok(validateContent(CATALOG).ok, validateContent(CATALOG).errors.join('; '));
  const bad = JSON.parse(JSON.stringify(CATALOG));
  bad.cards['fixture.ember_strike'].operations.push({ type: 'ride_through' });
  bad.items['fixture.metal'].id = 'fixture.armor';
  const r = validateContent(bad);
  assert.match(r.errors.join('\n'), /unsupported operation "ride_through"/);
  assert.match(r.errors.join('\n'), /duplicate definition id fixture.armor/);
});

test('initializeMatch: 36 parties, 162 members, mirrored, reproducible', () => {
  const manifest = createManifest({ matchId: 'test-match', profile: profileById(BASE_PROFILE.id), catalog: CATALOG });
  const s1 = initializeMatch(manifest);
  const s2 = initializeMatch(JSON.parse(JSON.stringify(manifest)));
  assert.equal(Object.keys(s1.parties).length, 36);
  assert.equal(Object.keys(s1.members).length, 162);
  assert.equal(stateFingerprint(s1), stateFingerprint(s2));
  assert.equal(stateFingerprint(JSON.parse(JSON.stringify(s1))), stateFingerprint(s1));
  // A's Commander at global R1C5; B's Commander at R10C5; B's King at global C6, Queen at C4
  const U = 1e6;
  assert.equal(s1.parties['A.mount.C5'].commander, true);
  assert.deepEqual(s1.parties['A.mount.C5'].region, { column: 5, row: 1 });
  assert.deepEqual(s1.parties['B.mount.C5'].region, { column: 5, row: 10 });
  assert.deepEqual(s1.parties['B.mount.C4'].region, { column: 6, row: 10 });
  assert.equal(s1.parties['B.mount.C4'].mount, 'king');
  assert.equal(s1.parties['B.mount.C6'].region.column, 4);
  assert.equal(s1.parties['B.mount.C6'].mount, 'queen');
  // the Pawn's empty center still anchors it
  const pawn = s1.parties['A.pawn.C1'];
  assert.equal(pawn.slots[5], null);
  assert.deepEqual([pawn.x, pawn.y], [2 * U, 6 * U]);
  // A's Swordsman in slot 1 stands front-left of its anchor (−x, +y); B's mirrors it
  const sw = s1.members['A.C1.p1'];
  assert.deepEqual([sw.x - pawn.x, sw.y - pawn.y], [-U, U]);
  const bp = s1.parties['B.pawn.C1'], bsw = s1.members['B.C1.p1'];
  assert.deepEqual([bsw.x - bp.x, bsw.y - bp.y], [U, -U]);
});
