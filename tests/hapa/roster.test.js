/**
 * Local Avatar choice (Review 22 V22-02 / N24-02): one selection operation, reconciled at setup,
 * reopen and Start. Preference/handler level; the rendered setup is observed separately in the browser.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const { ROSTER, loadRoster, saveRoster, selectAvatar, resolveChoice, statusOf } = await import('../../src/hapa/presentation/roster.js');

test('V22-02 / N24-02: a figure removed from the roster cannot stay selected through any path, reopen or Start', () => {
  store.clear();
  // clean state: Red is in the roster and the supported default choice
  let enabled = loadRoster();
  assert.equal(enabled['red-reaper'], true);
  assert.deepEqual(resolveChoice({ avatarId: 'red-reaper' }, enabled), { avatarId: 'red-reaper', changed: false });
  // the reviewer's sequence: take Red out of the roster …
  enabled['red-reaper'] = false; saveRoster(enabled);
  // … then try to choose Red again (the old top checkbox wrote avatarId = 'red-reaper' unconditionally)
  const again = selectAvatar('red-reaper', loadRoster());
  assert.equal(again.ok, false);
  assert.equal(again.avatarId, null, 'rejected, not selected');
  assert.match(again.why, /^Red: .*roster/);
  // reopen with the contradictory stored state an older build could leave behind: reconciled, with a reason
  enabled = loadRoster();
  const reopened = resolveChoice({ avatarId: 'red-reaper', songIds: [] }, enabled);
  assert.equal(reopened.changed, true);
  assert.equal(reopened.avatarId, null, 'no figure — never another figure');
  assert.ok(reopened.why.startsWith('Red'));
  // Start applies the same check (resolveChoice is what startMatch calls)
  assert.equal(resolveChoice({ avatarId: 'red-reaper' }, loadRoster()).avatarId, null);
  // back in the roster: selectable again
  enabled['red-reaper'] = true; saveRoster(enabled);
  assert.deepEqual(selectAvatar('red-reaper', loadRoster()), { ok: true, avatarId: 'red-reaper' });
});

test('N24-02: explicit no-figure, served and unserved optional figures', () => {
  store.clear();
  const enabled = loadRoster();
  assert.deepEqual(selectAvatar(null, enabled), { ok: true, avatarId: null }, 'play without a figure is a valid choice');
  assert.deepEqual(resolveChoice({ avatarId: null }, enabled), { avatarId: null, changed: false });
  // Falka and Leo are served by Mesh Avatar's player node: selectable once in the roster, never by default
  for (const id of ['avatar-8', 'avatar-46']) {
    const e = ROSTER.find((x) => x.id === id);
    assert.equal(e.served, 'mesh');
    assert.equal(enabled[id], false, 'not in the roster on a clean state');
    assert.equal(selectAvatar(id, enabled).ok, false);
    assert.match(selectAvatar(id, enabled).why, /In my roster/);
    assert.deepEqual(selectAvatar(id, { ...enabled, [id]: true }), { ok: true, avatarId: id });
    assert.equal(statusOf(e, { ...enabled, [id]: true }), 'ready (figure from Mesh Avatar)');
  }
  for (const id of ['avatar-39']) {
    const e = ROSTER.find((x) => x.id === id);
    assert.equal(e.served, null);
    // even when the player puts it in the roster, an unserved figure is not selectable and Red is not substituted
    const on = { ...enabled, [id]: true };
    const r = selectAvatar(id, on);
    assert.equal(r.ok, false);
    assert.equal(r.avatarId, null);
    assert.match(r.why, /no owner serves it/);
    assert.equal(statusOf(e, on), 'not served to Versus yet');
  }
  assert.equal(selectAvatar('nobody', enabled).ok, false);
  assert.equal(statusOf(ROSTER[0], enabled), 'ready (figure from Harbor)');
});

test('Mesh Avatar owner route: only the named players\' files, read-only paths, nothing else', async () => {
  const { matchOwnerRoute, MESH_PLAYERS } = await import('../../src/hapa/host/owner-routes.js');
  assert.deepEqual(MESH_PLAYERS, ['falka', 'leo']);
  assert.deepEqual(matchOwnerRoute('/mesh/apps/player/falka/rig.json'), { owner: 'mesh', path: '/apps/player/falka/rig.json' });
  assert.deepEqual(matchOwnerRoute('/mesh/apps/player/leo/assets/leo-base.png'), { owner: 'mesh', path: '/apps/player/leo/assets/leo-base.png' });
  for (const p of ['/mesh/apps/player/thor/rig.json', '/mesh/apps/player/falka/../leo/rig.json', '/mesh/apps/player/falka/.hidden', '/mesh/server/api.mjs', '/mesh/v1/control', '/mesh/apps/player/falka/', '/mesh/apps/player/falka/a b.png']) assert.equal(matchOwnerRoute(p), null, p);
  // the existing owners are unchanged
  assert.equal(matchOwnerRoute('/puppet/red-player.mjs').owner, 'harbor');
});
