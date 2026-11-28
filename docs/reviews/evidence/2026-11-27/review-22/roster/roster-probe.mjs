import fs from 'node:fs';
import crypto from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = pathToFileURL(resolve(process.argv[2] || process.cwd()) + '/');
const expected = JSON.parse(fs.readFileSync(new URL('source-register.json', import.meta.url), 'utf8')).files.map(f => ({ path: f.path, sha: f.git_blob_sha }));
const gitBlob = (s) => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${Buffer.byteLength(s)}\0`), Buffer.from(s)])).digest('hex');
const read = (path) => {
  let s = fs.readFileSync(new URL(path, root), 'utf8');
  const want = expected.find((x) => x.path === path).sha;
  // Parent snapshot transport may temporarily add one trailing newline; accept only bytes matching
  // the exact pinned Git blob after that reversible transport normalization.
  if (gitBlob(s) !== want && s.endsWith('\n') && gitBlob(s.slice(0, -1)) === want) s = s.slice(0, -1);
  if (gitBlob(s) !== want) throw Error(`source mismatch: ${path}`);
  return s;
};
const app = read('src/hapa/presentation/app.js');
read('src/hapa/presentation/roster.js');
const { ROSTER, loadRoster, saveRoster, playable } = await import(new URL('src/hapa/presentation/roster.js', root));
const start = app.indexOf('  _tableSetup() {');
const end = app.indexOf('\n  async startMatch(', start);
if (start < 0 || end < 0) throw Error('setup method not found');

const storage = new Map();
globalThis.localStorage = { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) };
globalThis.location = { protocol: 'http:' };
globalThis.fetch = async () => ({ ok: true, json: async () => ({ avatarPackage: { available: true, id: 'controlled-owner', revision: 'fixture' } }) });
const h = (tag, attrs = {}, ...children) => ({ tag, ...attrs, children: children.flat(), replaceChildren(...xs) { this.children = xs.flat(); } });
const setup = new Function('h', 'ROSTER', 'loadRoster', 'saveRoster', 'playable', `return ({${app.slice(start, end)}})._tableSetup`)(h, ROSTER, loadRoster, saveRoster, playable);
const ctx = {};
let surface = setup.call(ctx);
const players = () => surface.children.find((x) => x?.class === 'roster');
const row = (id) => players().children[1 + ROSTER.findIndex((x) => x.id === id)];
const rosterToggle = (id) => row(id).children[0].children[0];
const choice = (id) => row(id).children[1].children[0];
const master = () => surface.children[0].children[0];
const toggle = (el, checked) => { el.checked = checked; el.onchange({ target: el }); };
const snapshot = () => ({ selected: ctx._tableChoice.avatarId, enabled: loadRoster(), redChoiceChecked: !!choice('red-reaper').checked, redChoiceDisabled: !!choice('red-reaper').disabled, masterChecked: !!master().checked });
const result = {
  source: '164aa5dc6eb96ee4b4cc4eab6f0cdb2298554536',
  method: 'Exact pinned _tableSetup method and roster module; controlled element builder, local-storage map and owner-capability response. No browser rendering, real owner call, game runtime or installed-app claim.',
  initial: snapshot(),
};
toggle(rosterToggle('avatar-46'), true);
result.enableLeo = { ...snapshot(), leoChoiceDisabled: !!choice('avatar-46').disabled };
toggle(rosterToggle('red-reaper'), false);
result.disableRed = snapshot();
toggle(master(), true);
result.reenableViaMaster = snapshot();
surface = setup.call({});
result.reopenSurface = { enabled: loadRoster(), savedTable: JSON.parse(storage.get('hapa-versus.table.v1')), redChoiceChecked: !!choice('red-reaper').checked, redChoiceDisabled: !!choice('red-reaper').disabled };
result.findingReproduced = result.reenableViaMaster.selected === 'red-reaper' && result.reenableViaMaster.enabled['red-reaper'] === false && result.reenableViaMaster.redChoiceChecked && result.reenableViaMaster.redChoiceDisabled;
console.log(JSON.stringify(result, null, 2));
if (!result.findingReproduced) process.exitCode = 1;
