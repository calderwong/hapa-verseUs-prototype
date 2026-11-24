// Review 08 / assignment 10, R8-03 and R8-04: pure presentation contracts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLaunch, launchURL } from '../../src/hapa/presentation/dev-preset.js';
import { definitionRegistry } from '../../src/hapa/presentation/member-labels.js';
import { DEFAULT_PROFILE_ID } from '../../fixtures/hapa/profiles.js';

test('a copied link reopens its own profile over a saved legacy preset; a bare URL still follows the preset', () => {
  const legacy = { a: 'human', b: 'bot', seed: 1, profile: 'hapa_open_10x9_v3_02' };
  const copied = launchURL({ seats: { A: 'human', B: 'bot' }, seed: 1, profileId: DEFAULT_PROFILE_ID, fixture: null }, '/versus.html');
  assert.equal(copied, `/versus.html?autostart=1&a=human&b=bot&seed=1&profile=${DEFAULT_PROFILE_ID}`);
  const reopened = resolveLaunch(copied.split('?')[1], legacy);
  assert.deepEqual([reopened.config.profileId, reopened.sources.profile, reopened.config.seats, reopened.config.seed], [DEFAULT_PROFILE_ID, 'url', { A: 'human', B: 'bot' }, 1]);
  const bare = resolveLaunch('autostart=1&a=human&b=bot&seed=1', legacy);
  assert.deepEqual([bare.config.profileId, bare.sources.profile], ['hapa_open_10x9_v3_02', 'preset']); // intentional preset kept
  assert.equal(launchURL({ seats: { A: 'human', B: 'human' }, seed: 1, profileId: null, fixture: 'response' }, '/versus.html'), '/versus.html?autostart=1&fixture=response&a=human&b=human');
});

test('definitions exist for every member, drawn or not, and follow the current facts', () => {
  const chip = (key, value) => ({ key, kind: key, title: key, value, text: `${key} ${value}` });
  const unavailable = { id: 'A.p.s1', visible: false, chips: [chip('role', ''), chip('health', '3/3'), chip('shield:0', '1')] };
  let reg = definitionRegistry([unavailable]);
  assert.deepEqual([...reg.keys()], ['A.p.s1|role', 'A.p.s1|health', 'A.p.s1|shield:0']);
  // a later snapshot: the health changed, the shield is gone, another subject's entries vanish
  reg = definitionRegistry([{ ...unavailable, chips: [chip('role', ''), chip('health', '1/3'), chip('shield:none', '0')] }]);
  assert.equal(reg.get('A.p.s1|health').value, '1/3');
  assert.equal(reg.has('A.p.s1|shield:0'), false);
  assert.equal(definitionRegistry([]).size, 0);
});
