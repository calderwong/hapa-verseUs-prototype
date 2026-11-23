// Design review 02, R2-01: a selected height filter must hold throughout playback, casualties must
// stay down, and a ramp must reach its new height when the rules say it arrives. These tests resolve
// real fixtures through the same trace hook the battlefield uses, then check the playback pose
// against expectations taken from the fixture's built state (not from the poses under test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UI_FIXTURES } from '../../fixtures/hapa/ui-fixtures.js';
import { createFixtureSession, openTick, closeTick } from '../../src/hapa/rules/session.js';
import { snapshot, poseAt, bodyVisible, timeline } from '../../src/hapa/presentation/playback.js';

// the presentation's band floor heights (terrain-view.js bandY), restated so this test is headless
const BAND_H = 0.9;
const heightOf = (band) => (band >= 1 ? (band - 1) * BAND_H : band * BAND_H);

/** Resolve one Tick recording frames exactly as app.js _resolveAgreed does. */
function resolveTraced(sess, plans) {
  const start = snapshot(sess.state);
  const frames = [];
  let lastQ = -1;
  sess.ctx.trace = (s, q, events) => {
    if (q - lastQ >= 20 || events.length !== frames.at(-1)?.evLen) { frames.push({ q, pos: snapshot(s), evLen: events.length }); lastQ = q; }
  };
  const r = closeTick(sess, plans, () => ({ pass: true }));
  sess.ctx.trace = null;
  return { frames: timeline(start, frames, r.events.length), events: r.events, rejected: r.rejected };
}

const visibleAt = (frames, q, layer, ids) => ids.filter((id) => { const p = poseAt(frames, q, heightOf).pos[id]; return bodyVisible(p[2], p[3], layer); }).sort();

test('stacked fixture: off-layer bodies stay filtered at every playback moment (−2, +3, All)', () => {
  const built = UI_FIXTURES.stacked.build();
  // independent expectation from the fixture as built: which live members sit on each band
  const members = Object.values(built.state.members);
  const onBand = (band) => members.filter((m) => m.alive && (m.band ?? 1) === band).map((m) => m.id).sort();
  const everyone = members.filter((m) => m.alive).map((m) => m.id).sort();
  assert.ok(onBand(-2).length > 0 && onBand(3).length > 0, 'fixture has members at −2 and +3');

  const sess = createFixtureSession(built, { id: 'stacked', title: 'Stacked heights' });
  openTick(sess);
  const { frames } = resolveTraced(sess, { A: [], B: [] });
  assert.ok(frames.length >= 2, 'a pass Tick still records frames');
  const ids = members.map((m) => m.id);
  for (const q of [1, 10, 250, 500, 990, 1000]) {
    assert.deepEqual(visibleAt(frames, q, -2, ids), onBand(-2), `band −2 at q=${q}`);
    assert.deepEqual(visibleAt(frames, q, 3, ids), onBand(3), `band +3 at q=${q}`);
    assert.deepEqual(visibleAt(frames, q, null, ids), everyone, `all layers at q=${q}`);
  }
});

test('a member that died in an earlier Tick stays hidden throughout playback', () => {
  const frames = [
    { q: 0, pos: { dead: [0, 0, false, 1], live: [0, 0, true, 1] }, evLen: 0 },
    { q: 500, pos: { dead: [0, 0, false, 1], live: [5, 0, true, 1] }, evLen: 1 },
  ];
  for (const q of [0, 250, 500, 1000]) {
    const p = poseAt(frames, q, heightOf).pos;
    assert.equal(bodyVisible(p.dead[2], p.dead[3], null), false, `q=${q}`);
    assert.equal(bodyVisible(p.live[2], p.live[3], null), true, `q=${q}`);
  }
});

test('a casualty falls at the frame of its death and does not slide on', () => {
  const frames = [
    { q: 0, pos: { m: [0, 0, true, 1] }, evLen: 0 },
    { q: 400, pos: { m: [4, 0, false, 1] }, evLen: 2 },
  ];
  const mid = poseAt(frames, 200, heightOf);
  assert.equal(mid.pos.m[2], true);
  assert.equal(mid.evLen, 0);
  const after = poseAt(frames, 600, heightOf);
  assert.equal(after.pos.m[2], false);
  assert.equal(after.evLen, 2);
});

test('ramp: height changes when the rules record elevation_changed, not at the start or end of the Tick', () => {
  const built = UI_FIXTURES.terrain.build();
  const sess = createFixtureSession(built, { id: 'terrain', title: 'Terrain' });
  openTick(sess);
  // pass until the hill's column C3 accepts new orders (Tick 7 in this fixture)
  while (!sess.state.activeColumns.includes(3)) { closeTick(sess, { A: [], B: [] }, () => ({ pass: true })); openTick(sess); }
  const P = sess.state.parties['A.hill'];
  assert.equal(P.band, 2, 'A.hill starts on the hill top');
  // the order turns the party north first, then it walks down the ramp in a later Tick
  let plans = { A: [{ type: 'set_destination', partyId: 'A.hill', target: { column: 3, row: 4 } }], B: [] };
  let frames, ev;
  for (let i = 0; i < 4 && !ev; i++) {
    if (i) openTick(sess);
    const r = resolveTraced(sess, plans);
    assert.deepEqual(r.rejected?.A ?? [], []);
    frames = r.frames;
    ev = r.events.find((e) => e.type === 'elevation_changed' && e.partyId === 'A.hill');
    plans = { A: [], B: [] };
  }
  assert.ok(ev, 'the descent is an elevation_changed event within four Ticks');
  assert.deepEqual([ev.from, ev.to], [2, 1]);
  const key = 'party:A.hill';
  const before = poseAt(frames, Math.max(0, ev.quantum - 25), heightOf).pos[key];
  const at = poseAt(frames, ev.quantum, heightOf).pos[key];
  const end = poseAt(frames, 1000, heightOf).pos[key];
  assert.equal(before[3], 2, 'still on band +2 before arrival');
  assert.equal(at[3], 1, 'band +1 from the arrival quantum');
  assert.equal(at[4], heightOf(1));
  assert.equal(end[3], 1);
  // the drawn height between the bracketing frames never leaves the two floors
  for (let q = 0; q <= 1000; q += 5) {
    const h = poseAt(frames, q, heightOf).pos[key][4];
    assert.ok(h <= heightOf(2) + 1e-9 && h >= heightOf(1) - 1e-9, `height ${h} at q=${q}`);
  }
});
