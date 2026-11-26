/**
 * Presentation boundary (visual review VA-01, VA-02): every accepted event reaches the terminal
 * playback boundary — including events after the movement trace ends — and the displayed moment
 * reads facing from the shown events, not from the future. Real rules, the playback helper and the
 * inspection read model; no browser or GPU. Adapted from the review's timeline-end probe.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scenario } from '../../fixtures/hapa/scenarios.js';
import { beginCount, resolveTick, validatePlan } from '../../src/hapa/rules/match.js';
import { snapshot, timeline, poseAt, eventsBeforeMovement } from '../../src/hapa/presentation/playback.js';
import { momentSlice, stateAt } from '../../src/hapa/rules/inspection.js';

test('VA-01/02: the terminal boundary carries every event and the shown moment keeps facing until its event', () => {
  const { state, ctx } = scenario({ profileId: 'hapa_open_10x9_v3_07', parties: [
    { id: 'A.test.castle', owner: 'A', mount: 'castle', column: 1, row: 3, facing: 'N', slots: { 5: 'center' }, supply: 20 },
    { id: 'A.test.turn', owner: 'A', mount: 'castle', column: 9, row: 3, facing: 'N', slots: { 5: 'center', 2: 'swordsman' }, supply: 20 },
  ] });
  beginCount(state, ctx);
  const before = structuredClone(state), frames = [], moments = [];
  let lastQ = -1;
  ctx.trace = (s, q, events) => { if (q - lastQ >= 20 || events.length !== frames.at(-1)?.evLen) { frames.push({ q, pos: snapshot(state), evLen: events.length }); lastQ = q; } };
  ctx.observeEvents = (s) => moments.push(momentSlice(s));
  const plan = validatePlan(state, ctx, 'A', [{ type: 'set_destination', partyId: 'A.test.castle', target: { column: 1, row: 4 } }, { type: 'change_formation', partyId: 'A.test.turn', facing: 'E' }]);
  const gen = resolveTick(state, ctx, { A: plan.accepted, B: [] });
  let step = gen.next();
  while (!step.done) step = gen.next({ pass: true });
  const events = step.value;
  const all = timeline(snapshot(before), frames, events.length, eventsBeforeMovement(events), snapshot(state));
  const end = poseAt(all, 1000, (b) => b);
  assert.equal(end.evLen, events.length);
  assert.ok(['supply_spent', 'formation_changed', 'tick_finished'].every((t) => events.slice(0, end.evLen).some((e) => e.type === t)));
  // mid-trajectory the board's displayed moment still faces North; the turn appears with its event
  const mid = poseAt(all, 500, (b) => b);
  const turnAt = events.findIndex((e) => e.type === 'formation_changed');
  assert.ok(mid.evLen <= turnAt);
  assert.equal(stateAt(before, moments, mid.evLen, state).parties['A.test.turn'].facing, 'N');
  assert.equal(stateAt(before, moments, end.evLen, state).parties['A.test.turn'].facing, 'E');
});
