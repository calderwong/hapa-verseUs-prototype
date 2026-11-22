// HV-41 — rules and experiment panel logic (Master Requirements v3 ch.12, ch.14): a profile edit
// is a new fingerprinted revision; profiles compare field by field; a batch runs and verifies.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editProfile, profileDiff, runBatchMatch, batchSummary, PROFILE_FIELDS } from '../../src/hapa/adapters/profile-lab.js';
import { createManifest } from '../../src/hapa/rules/state.js';
import { fingerprint } from '../../src/hapa/rules/encoding.js';
import { profileById, BASE_PROFILE } from '../../fixtures/hapa/profiles.js';
import { CATALOG } from '../../fixtures/hapa/content.js';

test('a profile edit creates a new, deterministic, fingerprinted revision that names its parent', () => {
  const base = profileById(BASE_PROFILE.id);
  const a = editProfile(base, { 'combat.protection': 'line', 'movement.turnTicks': 2 }, { catalog: CATALOG });
  assert.deepEqual(a.errors, []);
  assert.notEqual(a.profile.id, base.id);
  assert.match(a.profile.id, /^hapa_open_10x9_v3_01~[0-9a-f]{8}$/);
  assert.equal(a.profile.revisionOf.fingerprint, fingerprint(base));
  assert.deepEqual(a.profile.changes, ['combat.protection', 'movement.turnTicks']);
  assert.notEqual(a.fingerprint, fingerprint(base));
  const again = editProfile(base, { 'movement.turnTicks': 2, 'combat.protection': 'line' }, { catalog: CATALOG });
  assert.equal(again.fingerprint, a.fingerprint); // the same edit is the same revision
  // a match records the exact revision; the base is untouched
  const m = createManifest({ matchId: 'x', profile: a.profile, catalog: CATALOG });
  assert.equal(m.profileFingerprint, a.fingerprint);
  assert.equal(base.combat.protection, 'individual');
});

test('field descriptions exist; illegal values and no-op edits are refused with reasons', () => {
  for (const f of PROFILE_FIELDS) assert.ok(f.description.length > 20, f.path);
  const base = profileById(BASE_PROFILE.id);
  assert.match(editProfile(base, { 'combat.health': 'shared' }, { catalog: CATALOG }).errors[0], /not one of member, party_pool/);
  assert.match(editProfile(base, { 'movement.turnTicks': 0 }, { catalog: CATALOG }).errors[0], /integer 1–3/);
  assert.match(editProfile(base, { 'board.rows': 12 }, { catalog: CATALOG }).errors[0], /not an editable field/);
  assert.match(editProfile(base, { 'combat.protection': 'individual' }, { catalog: CATALOG }).errors[0], /no field changed/);
});

test('profiles compare field by field (an earlier match\'s profile against a variant)', () => {
  const d = profileDiff(profileById(BASE_PROFILE.id), profileById('hapa_open_10x9_v3_01_party_maintenance'));
  assert.deepEqual(d.map((x) => x.path).sort(), ['combat.health', 'combat.preset', 'combat.protection']);
  assert.deepEqual(d.find((x) => x.path === 'combat.health'), { path: 'combat.health', from: 'member', to: 'party_pool' });
});

test('a small batch runs bot matches on an edited profile and every replay verifies', () => {
  const p = editProfile(profileById(BASE_PROFILE.id), { 'combat.cornerSupport.enabled': false }, { catalog: CATALOG }).profile;
  const rows = [1, 2].map((seed) => runBatchMatch(p, CATALOG, seed, 30));
  const s = batchSummary(rows);
  assert.equal(s.runs, 2);
  assert.equal(s.allReplaysVerified, true);
  assert.equal(s.winsA + s.winsB + s.draws + s.unfinished, 2);
  assert.equal(rows[0].replay.manifest.profile.id, p.id);
});
