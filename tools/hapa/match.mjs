#!/usr/bin/env node
/**
 * npm run match -- [--profile <id>] [--seed <n>] [--ticks <budget>] [--out <replay.json>] [--quiet]
 *
 * A headless rules simulation: two heuristic bots play one match under a profile. Prints the
 * outcome and summary, verifies the replay by recomputation, and optionally writes the replay.
 * (A rules simulation, not a peer-verified match: one process applies both controllers.)
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createSession, playMatch, verifyReplay } from '../../src/hapa/rules/session.js';
import { HeuristicBot } from '../../src/hapa/controllers/heuristic-bot.js';
import { summarize } from '../../src/hapa/rules/stats.js';
import { profileById, BASE_PROFILE } from '../../fixtures/hapa/profiles.js';
import { CATALOG } from '../../fixtures/hapa/content.js';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : dflt;
};
const quiet = process.argv.includes('--quiet');
const profileId = arg('profile', BASE_PROFILE.id);
const seed = Number(arg('seed', 1));
const budget = Number(arg('ticks', 400));
const out = arg('out', null);

const t0 = Date.now();
const session = createSession({
  matchId: `bot-${profileId}-${seed}`, profile: profileById(profileId), catalog: CATALOG, seed: seed || 1,
  controllers: { A: { type: 'bot', revision: 'heuristic-bot/0.1.0' }, B: { type: 'bot', revision: 'heuristic-bot/0.1.0' } },
});
const bots = { A: new HeuristicBot({ seat: 'A', seed: seed * 2 + 1 }), B: new HeuristicBot({ seat: 'B', seed: seed * 2 + 2 }) };
const outcome = playMatch(session, bots, { tickBudget: budget });
const ms = Date.now() - t0;
const verify = verifyReplay(JSON.parse(JSON.stringify(session.replay)));
const summary = summarize(session.events, session.state);
if (out) { mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(session.replay)); }
const report = { profile: profileId, seed, outcome, ticks: session.state.tick, ms, replayVerified: verify.ok, summary };
if (!quiet) console.log(JSON.stringify(report, null, 2));
else console.log(`${profileId} seed ${seed}: ${outcome.result}${outcome.winner ? ` (${outcome.winner})` : ''} at Tick ${session.state.tick}, ${ms} ms, replay ${verify.ok ? 'verified' : 'DIVERGED'}`);
process.exit(verify.ok ? 0 : 1);
