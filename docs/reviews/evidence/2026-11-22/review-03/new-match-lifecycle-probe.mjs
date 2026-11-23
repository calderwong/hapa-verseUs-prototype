// Historical review reproduction for 164b8dfe46d2b6b8ec0975cc8f53ea5428770230.
// Intentionally expects the pre-fix defect; not a permanent regression test.
// Executes extracted app controller methods with real rules and minimal presentation adapters.
// No browser rendering or focus-navigation observation is claimed.
// From the repository: node docs/reviews/evidence/2026-11-22/review-03/new-match-lifecycle-probe.mjs
// Optional argument points to a separate snapshot of the reviewed repository.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

import path from 'node:path';
import * as nodeUrl from 'node:url';

const repoRoot = process.argv[2] ? path.resolve(process.argv[2]) : nodeUrl.fileURLToPath(new URL('../../../../../', import.meta.url));
const load = rel => import(nodeUrl.pathToFileURL(path.join(repoRoot, rel)).href);
const [{ UI_FIXTURES }, { BASE_PROFILE }, { createFixtureSession, openTick, verifyReplay }, { validatePlan, resolveTick }, { snapshot }, { stateFingerprint }, { clone }] = await Promise.all([
  load('fixtures/hapa/ui-fixtures.js'),
  load('fixtures/hapa/profiles.js'),
  load('src/hapa/rules/session.js'),
  load('src/hapa/rules/match.js'),
  load('src/hapa/presentation/playback.js'),
  load('src/hapa/rules/state.js'),
  load('src/hapa/rules/encoding.js'),
]);

const source = fs.readFileSync(path.join(repoRoot, 'src/hapa/presentation/app.js'), 'utf8');
const blob = crypto.createHash('sha1').update(`blob ${Buffer.byteLength(source)}\0`).update(source).digest('hex');
assert.equal(blob, 'a95383d275d7133e16022767c97227174241355a');
const method = (name, async = false) => {
  const start = source.indexOf(`  ${async ? 'async ' : ''}${name}(`);
  assert.ok(start >= 0);
  return source.slice(start, source.indexOf('\n  }', start) + '\n  }'.length);
};
class ViewAdapter {
  constructor() { this.root = {}; this.w = 27; this.h = 30; }
  sync() {}
  syncBanks() {}
  setActiveColumns() {}
}
class CameraAdapter { setHome() {} dispose() {} }
const C = vm.runInNewContext(`(class Probe {
  get state() { return this.session.state; }
  ${method('startMatch', true)}
  ${method('_newTick')}
  ${method('_can')}
  ${method('_resolveAgreed', true)}
  ${method('_askResponse')}
})`, {
  BASE_PROFILE, UI_FIXTURES, createFixtureSession, openTick,
  loadCharacterKit: async () => {}, loadRenditions: async () => {},
  BoardView: ViewAdapter, BoardCamera: CameraAdapter,
  buildScenery: async () => ({}), drawCardCanvas: () => {}, activeCatalog: null,
  validatePlan, resolveTick, snapshot, stateFingerprint, clone,
  console, Date, setTimeout,
});
const old = createFixtureSession(UI_FIXTURES.response.build(), { id: 'response', title: 'Spell and response' });
openTick(old);
const ui = new C();
Object.assign(ui, {
  session: old, ctx: old.ctx, seats: { A: 'human', B: 'human' }, bots: {}, viewSeat: 'A',
  plans: { A: [{ type: 'play_ability', cardId: 'A.ember', actorPartyId: 'A.c', target: { memberId: 'B.c.s2' }, burns: ['A.red'] }], B: [] },
  resolving: true, tickEvents: [], view: new ViewAdapter(), speed: 1,
  el: { overlay: { hidden: true }, inspector: { querySelector: () => null }, world: {} },
  engine: { scene: { remove() {} }, camera: {} },
  _initEngine() {}, _renderCamPad() {}, _renderAll() {}, _readyValid: () => false,
  _play: async () => {},
});
const resolution = ui._resolveAgreed();
const oldChoice = ui.pendingChoice;
assert.equal(oldChoice.req.seat, 'B');
assert.equal(old.state.tick, 9);

// This is the existing Match menu > New match > terrain fixture controller path.
await ui.startMatch({ fixture: 'terrain', seats: { A: 'human', B: 'human' } });
const newSession = ui.session;
const afterStart = {
  oldMatchId: old.state.matchId,
  newMatchId: newSession.state.matchId,
  newTick: newSession.state.tick,
  newPhase: newSession.state.phase,
  oldResponseStillPending: ui.pendingChoice === oldChoice,
  newMatchCanEdit: ui._can('A').edit,
  newReplayTicks: newSession.replay.ticks.length,
};
assert.equal(afterStart.oldResponseStillPending, true);
assert.equal(afterStart.newMatchCanEdit, false);

// Resolve the orphaned choice exactly as the current panel's finish function does.
ui.pendingChoice = null;
oldChoice.resolve({ pass: true });
await new Promise(resolve => setImmediate(resolve));
assert.equal(ui.pendingChoice.req.seat, 'A');
const nextOldChoice = ui.pendingChoice;
ui.pendingChoice = null;
nextOldChoice.resolve({ pass: true });
await resolution;
const afterOldResolution = {
  newMatchTick: newSession.state.tick,
  replayTickNumbers: newSession.replay.ticks.map(t => t.tick),
  oldSpellEventsInNewSession: newSession.events.filter(e => e.type === 'card_damage' || e.type === 'ability_resolved').map(e => ({ type: e.type, tick: e.tick, cardId: e.cardId })),
  replayVerification: verifyReplay(newSession.replay),
};
assert.deepEqual(afterOldResolution.replayTickNumbers, [9]);
assert.equal(afterOldResolution.newMatchTick, 5);
assert.equal(afterOldResolution.replayVerification.ok, false);
console.log(JSON.stringify({
  pin: '164b8dfe46d2b6b8ec0975cc8f53ea5428770230', appBlob: blob,
  scope: 'Actual extracted app methods and real rules/session. Scene, camera, asset and render adapters stubbed; no browser rendering.',
  afterStart, afterOldResolution,
}, null, 2));
