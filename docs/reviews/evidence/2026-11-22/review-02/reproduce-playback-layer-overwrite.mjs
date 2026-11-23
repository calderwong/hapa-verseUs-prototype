#!/usr/bin/env node
/**
 * Review reproduction, not a browser test or proposed production implementation.
 * Executes the unchanged _stepPlayback method from the pinned app.js and the unchanged
 * selected-band visibility expression from the pinned board-view.js. The rest of the
 * view is a minimal stub: no DOM, Three.js scene, WebGL, sprites, or actual game session.
 *
 * From a checkout containing the exact reviewed source:
 * node docs/reviews/evidence/2026-11-22/review-02/reproduce-playback-layer-overwrite.mjs
 *
 * This is an archived defect reproduction, not a passing regression test. Hash guards
 * intentionally reject changed source. By default it prints results; --out writes a new file.
 * Preserve the archived result JSON rather than using it as the output path.
 *
 * Override snapshot paths with --source /path/app.js --board /path/board-view.js
 * --prior /path/old-app.js --out /path/result.json. Hash mismatches refuse execution.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) =>
  v.startsWith('--') ? [...a, [v.slice(2), all[i + 1]]] : a, []));
const sourcePath = path.resolve(args.source ?? path.join(here, '../../../../../src/hapa/presentation/app.js'));
const boardPath = path.resolve(args.board ?? path.join(here, '../../../../../src/hapa/presentation/board-view.js'));
const priorPath = args.prior ? path.resolve(args.prior) : null;
const outputPath = args.out ? path.resolve(args.out) : null;
const sourceBytes = fs.readFileSync(sourcePath);
const source = sourceBytes.toString('utf8');
const board = fs.readFileSync(boardPath, 'utf8');
const gitBlob = (bytes) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const expectedAppBlob = '45cf2a10104aa43611a649d43563002c73a9a650';
assert.equal(gitBlob(sourceBytes), expectedAppBlob, 'app.js must match the reviewed Git blob');
assert.equal(gitBlob(Buffer.from(board)), '69da8a7bc1ed9369a80d06ee6c14585bb60b5060',
  'board-view.js must match the reviewed Git blob');

const start = source.indexOf('  _stepPlayback(dt) {');
const end = source.indexOf('\n  _askResponse(req)', start);
assert.ok(start >= 0 && end > start, 'unchanged method boundaries must exist');
const method = source.slice(start, end);
const predicateMatch = board.match(/spr\.visible = (\(m\.alive \|\| \(positions\?\.\[m\.id\][^\n]+);/);
assert.ok(predicateMatch, 'BoardView selected-band visibility assignment must exist');
const predicate = predicateMatch[1];
const visibility = new Function('m', 'positions', 'layer', 'band', `return ${predicate};`);
const Playback = new Function(`return class IsolatedPlayback {${method}}`)();
const overwrite = 'spr.visible = p[2] !== false && (this.state.members[id]?.alive || !dead.has(id));';
assert.ok(method.includes(overwrite), 'reviewed overwrite must still be present');
const prior = priorPath && fs.existsSync(priorPath) ? fs.readFileSync(priorPath, 'utf8') : null;
if (prior !== null) assert.equal(gitBlob(Buffer.from(prior)), '4ee4f6e349aec62e83bd324febacccb7d64f629c', 'prior app must match verified af6977d bytes');

const cases = [];
for (const selectedBand of [-2, 3, null]) {
  for (const progress of [0.01, 0.5, 0.99, 1]) {
    const app = new Playback();
    app.state = { members: {
      air: { id: 'air', alive: true, band: 3 },
      tunnel: { id: 'tunnel', alive: true, band: -2 },
    } };
    app.playback = { t: 0, duration: 1, all: [
      { q: 0, pos: { air: [1, 1], tunnel: [1, 1] }, evLen: 0 },
      { q: 1000, pos: { air: [1, 2], tunnel: [1, 2] }, evLen: 0 },
    ], events: [], shown: 0, resolve() {} };
    const syncSnapshots = [];
    app.view = {
      sprites: new Map([['air', { visible: false }], ['tunnel', { visible: false }]]),
      sync(state, positions = null) {
        for (const [id, sprite] of this.sprites) {
          const m = state.members[id];
          sprite.visible = Boolean(visibility(m, positions, selectedBand, m.band));
        }
        syncSnapshots.push(Object.fromEntries([...this.sprites].map(([id, s]) => [id, s.visible])));
      },
      setWalking() {},
      syncBanks() {},
    };
    // _stepPlayback references this renderer helper only at completion; the actual stubbed
    // syncBanks ignores it. Supply a harmless lexical identifier to the extracted method.
    globalThis.drawCardCanvas = () => {};
    app._stepPlayback(progress);
    const finalVisibility = Object.fromEntries([...app.view.sprites].map(([id, s]) => [id, s.visible]));
    const expectedVisibility = Object.fromEntries(Object.entries(app.state.members).map(([id, m]) =>
      [id, selectedBand === null || m.band === selectedBand]));
    cases.push({ selectedBand, progress, expectedVisibility, afterSync: syncSnapshots[0],
      finalVisibility, mismatch: Object.keys(expectedVisibility).some((id) =>
        finalVisibility[id] !== expectedVisibility[id]), playbackComplete: app.playback === null });
  }
}
delete globalThis.drawCardCanvas;
const mismatches = cases.filter((c) => c.mismatch);
assert.equal(mismatches.length, 6, 'six partial-playback filtered cases should reproduce the reviewed defect');
assert.ok(cases.filter((c) => c.progress === 1).every((c) => !c.mismatch), 'final sync restores the filter');
const result = {
  schemaVersion: 1,
  kind: 'isolated_controller_reproduction',
  reviewedRepository: 'calderwong/hapa-verseUs-prototype',
  reviewedCommit: 'a68cfd0b8af874498cdb3e617715f941e52b76f2',
  provenance: {
    appPath: 'src/hapa/presentation/app.js', appGitBlob: gitBlob(sourceBytes),
    appMethod: '_stepPlayback', appMethodLines: '393-424', extractedMethodSha256: sha256(method),
    boardPath: 'src/hapa/presentation/board-view.js',
    boardGitBlob: gitBlob(Buffer.from(board)), boardPredicateLine: 322,
    unchangedBoardVisibilityPredicate: predicate,
    priorSourceCommit: 'af6977d295dd0970a744bb65281f7ec4ea8c1457',
    priorAppGitBlob: prior === null ? null : gitBlob(Buffer.from(prior)),
    overwritePresentBeforeReviewedUpdates: prior === null ? null : prior.includes(overwrite),
  },
  environment: { node: process.version, platform: process.platform, arch: process.arch },
  limitations: [
    'This executes the original controller method and original selected-band predicate in an isolated fixture.',
    'The surrounding view, session, and renderer are stubs. No browser, WebGL, DOM, real sprite, or gameplay session was executed.',
    'This establishes a visibility-property overwrite, not the composited appearance of a real rendered frame.',
    'Live stacked-fixture playback remains necessary to verify the user-visible consequence and any correction.',
    'The overwrite predates the reviewed update commits; it is a remaining defect, not an introduced regression.',
  ],
  observed: { caseCount: cases.length, mismatchCount: mismatches.length,
    conclusion: 'During partial playback, the controller restores off-layer live members to visible; final sync restores filtering.' },
  cases,
};
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
if (outputPath) {
  assert.notEqual(path.resolve(outputPath), path.join(here, 'playback-layer-overwrite-result.json'), 'do not overwrite archived review evidence');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');
} else console.log(JSON.stringify(result, null, 2));
console.log(JSON.stringify({ outputPath, reviewedCommit: result.reviewedCommit,
  appGitBlob: result.provenance.appGitBlob, priorStatus: result.provenance.overwritePresentBeforeReviewedUpdates,
  ...result.observed }, null, 2));
