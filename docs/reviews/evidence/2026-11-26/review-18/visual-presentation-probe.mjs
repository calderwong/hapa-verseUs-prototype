/**
 * Review 18 visual diagnostic: historical-failure assertions.
 *
 * The runVisualReviewProbes function was executed in functions.exec V8 against
 * pinned GitHub source b2a31f45baed1b70f0e1777eba93fe0267b09a5b.
 * This filesystem/CLI wrapper was supplied for reproduction but NOT executed
 * by the reviewer. Exit 0 means the historical failures reproduced, not that
 * the product passed qualification. Future fixes should replace these failure
 * assertions with positive regressions. The returned sourceRef names the
 * historical baseline; separately record the actual checkout used for reruns.
 *
 * Run from the repository root, or pass a checkout root as the first argument.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function runVisualReviewProbes(appSource, boardSource) {
  const cut = (source, start, end) => {
    const a = source.indexOf(start), b = source.indexOf(end, a);
    if (a < 0 || b < 0) throw Error(`Source boundary changed: ${start}`);
    return source.slice(a, b).trim();
  };
  const require = (ok, message) => { if (!ok) throw Error(message); };
  const spawnSource = cut(appSource, '  _spawnHits(events) {', '\n\n\n  _stepPlayback');
  const updateSource = cut(boardSource, '  update(dt, camera) {', '\n\n  /** Show an accepted action');
  const stepSource = cut(appSource, '  _stepPlayback(dt) {', '\n\n  _askResponse');
  const playSource = cut(appSource, '  _play(before, frames, events, moments = []) {', '\n\n  /**\n   * Fire Pit');
  const spawn = Function('activeCatalog', 'pts', `return function ${spawnSource};`)({ cards: {}, archetypes: {} }, x => x);
  const update = Function('reducedMotion', `return function ${updateSource};`)(() => false);
  const makeStep = poseAt => Function('poseAt', 'bandY', 'drawCardCanvas', `return function ${stepSource};`)(poseAt, b => b, () => {});
  function terrainCase(cell) {
    const calls = [];
    const app = {
      state: { cards: {}, members: {}, parties: {} }, ctx: { U: 1e6 }, _fireEffect: () => false,
      view: {
        sprites: new Map(), markers: new Map(),
        fx: { terrain: (at, dig) => calls.push({ at: { x: at.x, y: at.y, z: at.z }, dig }) },
        toWorld: (x, y) => ({ x, y: 0, z: -y, setY(v) { this.y = v; return this; } }),
        partyY: () => -1
      }
    };
    spawn.call(app, [{ type: 'terrain_changed', cell, solid: false, taskId: 'W1.1', by: 'A.worker' }]);
    return calls;
  }
  const terrain = {
    ruleShapedCell: { x: 3, y: 4, band: -1 },
    ruleShapedCalls: terrainCase({ x: 3, y: 4, band: -1 }),
    nonRuleRegionControlCalls: terrainCase({ column: 1, row: 2, band: -1 })
  };
  require(terrain.ruleShapedCalls.length === 0 && terrain.nonRuleRegionControlCalls.length === 1, 'Terrain failure no longer matches baseline');

  let syncs = 0, resolved = 0;
  const gear = { visible: true };
  const sprite = {
    visible: true, direction: 'down', animation: 'idle_down',
    userData: { facing: 'S', act: { kind: 'attack1', until: 0.5 }, gear: { sword: gear } },
    faceVector() {}, play(name) { this.animation = name; }, update() {}
  };
  const view = {
    _time: 0, fx: { update() {} }, sites: { update() {} }, _sizeStandards() {},
    sprites: new Map([['m', sprite]]), setWalking() {},
    sync() { syncs++; gear.visible = true; }, syncBanks() {}
  };
  const app = {
    playback: { t: 0.9, duration: 1, all: [], events: [], shown: 0, resolve() { resolved++; } },
    state: {}, view
  };
  const step = makeStep(() => ({ pos: {}, evLen: 0 }));
  step.call(app, 0.1); update.call(view, 0.1, {});
  const atEnd = { playback: app.playback, gearVisible: gear.visible, animation: sprite.animation, syncs, resolved };
  step.call(app, 0.6); update.call(view, 0.6, {});
  const planning = { playback: app.playback, gearVisible: gear.visible, animation: sprite.animation, syncs, resolved };
  require(atEnd.gearVisible === false && planning.gearVisible === false && planning.animation === 'idle_down' && planning.syncs === 1, 'Gear failure no longer matches baseline');

  const play = Function('snapshot', 'timeline', 'eventsBeforeMovement', `return function ${playSource};`)(() => ({}), () => [], () => 0);
  const quanta = [], deltas = [];
  const speedApp = {
    speed: 1, watch: false, state: {},
    view: { setWalking() {}, syncPlanLinks() {}, sync() {}, syncBanks() {}, update(dt) { deltas.push(dt); } },
    engine: { camera: {} }, _renderReadyButton() {}, _renderBasins() {}, _displayState() { return {}; }
  };
  const speedStep = makeStep((_, q) => { quanta.push(q); return { pos: {}, evLen: 0 }; });
  const deltaLine = appSource.split('\n').find(l => l.includes('this.view.update(pb ?'));
  require(!!deltaLine, 'Battle-clock source boundary changed');
  const frameDelta = Function('pb', 'dt', deltaLine);
  play.call(speedApp, {}, [], []);
  speedStep.call(speedApp, 0.1); frameDelta.call(speedApp, speedApp.playback, 0.1);
  const before = { speed: 1, duration: speedApp.playback.duration, quantum: quanta.at(-1), bodyEffectDelta: deltas.at(-1) };
  speedApp.speed = 4;
  speedStep.call(speedApp, 0.1); frameDelta.call(speedApp, speedApp.playback, 0.1);
  const after = { speed: 4, duration: speedApp.playback.duration, quantum: quanta.at(-1), bodyEffectDelta: deltas.at(-1) };
  require(before.duration === after.duration && Math.abs(after.quantum - before.quantum * 2) < 1e-8 && after.bodyEffectDelta === before.bodyEffectDelta * 4, 'Speed failure no longer matches baseline');
  return {
    sourceRef: 'b2a31f45baed1b70f0e1777eba93fe0267b09a5b',
    method: 'Exact-source presentation methods and one exact frame-delta statement, with synthetic events and stubbed pose/render/view dependencies. No live browser/GPU/native claim. Assertions reproduce historical failures.',
    terrain,
    terminalGear: { atEnd, planning },
    midPlaybackSpeed: { before, after, quantumDeltaAfterChange: after.quantum - before.quantum }
  };
}

const checkoutRoot = resolve(process.argv[2] ?? process.cwd());
const appSource = readFileSync(resolve(checkoutRoot, 'src/hapa/presentation/app.js'), 'utf8');
const boardSource = readFileSync(resolve(checkoutRoot, 'src/hapa/presentation/board-view.js'), 'utf8');
console.log(JSON.stringify(runVisualReviewProbes(appSource, boardSource), null, 2));
