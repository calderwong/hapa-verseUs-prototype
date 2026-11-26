// Bounded diagnostic for VA-01. Run from a repository checkout, or pass its root:
// node docs/reviews/evidence/2026-11-26/visual-animation/timeline-end-probe.mjs [repo-root]
// Add --expect-fixed to assert the complete terminal event prefix after a correction.
// This executes real rules and the presentation helper, without a browser or GPU.
import assert from 'node:assert/strict';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const root = pathToFileURL(resolve(args.find(a => !a.startsWith('--')) ?? '.') + sep);
const { scenario } = await import(new URL('fixtures/hapa/scenarios.js', root));
const { beginCount, resolveTick, validatePlan } = await import(new URL('src/hapa/rules/match.js', root));
const { snapshot, timeline, poseAt, eventsBeforeMovement } = await import(new URL('src/hapa/presentation/playback.js', root));

const { state, ctx } = scenario({ profileId: 'hapa_open_10x9_v3_07', parties: [
  { id: 'A.test.castle', owner: 'A', mount: 'castle', column: 1, row: 3, facing: 'N', slots: { 5: 'center' }, supply: 20 },
  { id: 'A.test.turn', owner: 'A', mount: 'castle', column: 9, row: 3, facing: 'N', slots: { 5: 'center', 2: 'swordsman' }, supply: 20 },
] });
beginCount(state, ctx);
const before = structuredClone(state), frames = [];
let lastQ = -1;
// Matches VersusApp._resolveAgreed's trace callback at the reviewed source.
ctx.trace = (s, q, events) => {
  if (q - lastQ >= 20 || events.length !== frames.at(-1)?.evLen) {
    frames.push({ q, pos: snapshot(state), evLen: events.length });
    lastQ = q;
  }
};
const proposed = [
  { type: 'set_destination', partyId: 'A.test.castle', target: { column: 1, row: 4 } },
  { type: 'change_formation', partyId: 'A.test.turn', facing: 'E' },
];
const checked = validatePlan(state, ctx, 'A', proposed);
assert.equal(checked.accepted.length, 2, JSON.stringify(checked));
const gen = resolveTick(state, ctx, { A: checked.accepted, B: [] });
let step = gen.next();
while (!step.done) step = gen.next({ pass: true });
const events = step.value;
assert.ok(frames.length > 0, 'The fixture must trace actual movement.');
const all = timeline(snapshot(before), frames, events.length, eventsBeforeMovement(events));
const end = poseAt(all, 1000, b => b);
const omitted = events.slice(end.evLen);
const result = {
  reviewBaseline: 'bd66817326c6966d28c73b4cc06a144551077a1b',
  sourceIdentityNote: 'The accompanying register verifies the baseline run. Record the actual checkout when rerunning this diagnostic.',
  method: 'Real rules resolve a legal movement and formation-turn Tick; unchanged playback helper; source-identical trace callback. No browser/GPU execution.',
  nodeVersion: process.version,
  acceptedCommands: checked.accepted,
  frames: frames.length,
  lastFrameQuantum: frames.at(-1).q,
  totalEvents: events.length,
  playbackEndEventPrefix: end.evLen,
  eventsOmittedFromPlaybackDispatch: omitted.map(e => ({ type: e.type, id: e.id })),
  positionsChanged: before.parties['A.test.castle'].y !== state.parties['A.test.castle'].y,
  formationFacing: { before: before.parties['A.test.turn'].facing, resolved: state.parties['A.test.turn'].facing },
  terminalPrefixComplete: end.evLen === events.length,
};
console.log(JSON.stringify(result, null, 2));
if (args.includes('--expect-fixed')) assert.equal(end.evLen, events.length, 'Every event must be reachable at the terminal presentation boundary.');
