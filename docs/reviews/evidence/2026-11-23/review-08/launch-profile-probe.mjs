import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { launchURL, resolveLaunch } from '../../../../../src/hapa/presentation/dev-preset.js';
import { profileById, DEFAULT_PROFILE_ID } from '../../../../../fixtures/hapa/profiles.js';
const app = readFileSync(new URL('../../../../../src/hapa/presentation/app.js', import.meta.url), 'utf8');
const expression = app.match(/const url = (launchURL\(\{ \.\.\.c, profileId: c\.profileId === DEFAULT_PROFILE_ID \? null : c\.profileId \}\));/)[1];
const c = { seats: { A: 'human', B: 'bot' }, seed: 1, profileId: DEFAULT_PROFILE_ID, fixture: null };
// Exact menu expression with real launch/resolve helpers. Stored preset remains a
// legitimate legacy selection; only the copied link should override it.
const copiedLink = new Function('c', 'DEFAULT_PROFILE_ID', 'launchURL', `return ${expression};`)(c, DEFAULT_PROFILE_ID, launchURL);
const saved = { a: 'bot', b: 'human', seed: 7, profile: 'hapa_open_10x9_v3_02' };
const reopened = resolveLaunch(copiedLink.split('?')[1], saved, { profileOk: id => !!profileById(id) });
assert.equal(reopened.config.profileId, saved.profile);
assert.notEqual(reopened.config.profileId, c.profileId);
assert.deepEqual(reopened.config.seats, c.seats);
assert.equal(reopened.config.seed, 1);
const result = { snapshot: 'f7c4f0f69afbc22458c400f01521e5b468f5f602', sourceProfile: c.profileId, copiedLink, receiverSavedProfile: saved.profile, reopenedProfile: reopened.config.profileId, reopenedPolicy: profileById(reopened.config.profileId).planning?.agreement ?? 'pair_acknowledgment_v3', profileSource: reopened.sources.profile };
console.log(JSON.stringify(result, null, 2));
writeFileSync(new URL('launch-profile-results.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
