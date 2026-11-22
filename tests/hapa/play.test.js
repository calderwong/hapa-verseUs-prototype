// HV-30/31 — bots play complete matches; replays verify; history imports are idempotent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, playMatch, verifyReplay } from '../../src/hapa/rules/session.js';
import { HistoryStore } from '../../src/hapa/rules/stats.js';
import { HeuristicBot } from '../../src/hapa/controllers/heuristic-bot.js';
import { profileById, BASE_PROFILE } from '../../fixtures/hapa/profiles.js';
import { CATALOG } from '../../fixtures/hapa/content.js';

const play = (seed, budget) => {
  const s = createSession({ matchId: `t-${seed}`, profile: profileById(BASE_PROFILE.id), catalog: CATALOG, seed });
  const outcome = playMatch(s, { A: new HeuristicBot({ seat: 'A', seed: seed * 2 + 1 }), B: new HeuristicBot({ seat: 'B', seed: seed * 2 + 2 }) }, { tickBudget: budget });
  return { s, outcome };
};

test('a bot completes a match against a bot with a rules-defined result; the replay verifies', () => {
  const { s, outcome } = play(2, 60);
  assert.equal(outcome.result, 'win');
  const v = verifyReplay(JSON.parse(JSON.stringify(s.replay)));
  assert.ok(v.ok, JSON.stringify(v));
  assert.equal(v.finalFingerprint, s.replay.finalFingerprint);
});

test('a Tick budget yields an unfinished record, not an invented result', () => {
  const { outcome, s } = play(2, 5);
  assert.equal(outcome.result, 'unfinished');
  assert.equal(s.state.outcome, null);
});

test('a tampered replay reports the first diverging Tick', () => {
  const { s } = play(2, 12);
  const r = JSON.parse(JSON.stringify(s.replay));
  r.ticks[3].plans.A = [];
  const v = verifyReplay(r);
  assert.equal(v.ok, false);
  assert.ok(v.tick <= 4);
});

test('importing the same events twice does not duplicate history', () => {
  const { s } = play(2, 30);
  const h = new HistoryStore();
  const first = h.append(s.events);
  const second = h.append(JSON.parse(JSON.stringify(s.events)));
  assert.equal(second, 0);
  assert.equal(h.size, first);
});
