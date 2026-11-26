#!/usr/bin/env node
/**
 * History projections from replays (HV-40): recompute each replay's events with the shared rules,
 * import them into an idempotent history store (twice, to show a re-import adds nothing) and print
 * match, combat-credit, creator, item and quest reports.
 *
 *   npm run history -- a.replay.json [b.replay.json …] [--experiment id]
 */
import { readFileSync } from 'node:fs';
import { verifyReplay } from '../../src/hapa/rules/session.js';
import { canonicalize } from '../../src/hapa/rules/encoding.js';
import { HistoryStore, matchReport, combatCredit, creatorStats, itemHistory, questProgress } from '../../src/hapa/rules/stats.js';

const files = process.argv.slice(2).filter((a) => !a.startsWith('--') && a !== process.argv[process.argv.indexOf('--experiment') + 1]);
const experimentId = process.argv.includes('--experiment') ? process.argv[process.argv.indexOf('--experiment') + 1] : null;
if (!files.length) { console.error('usage: npm run history -- file.replay.json [...]'); process.exit(2); }
const store = new HistoryStore();
const imports = [];
for (const f of files) {
  const replay = JSON.parse(readFileSync(f, 'utf8'));
  const events = [];
  const v = verifyReplay(replay, { onEvents: (e) => events.push(...e) });
  if (!v.ok) { imports.push({ file: f, ok: false, reason: v.reason, tick: v.tick }); continue; }
  // the calculated outcome is what counts; a replay whose top-level claim differs is refused (assignment 16, finding 6)
  if (replay.outcome !== undefined && canonicalize(replay.outcome ?? null) !== canonicalize(v.outcome ?? replay.outcome ?? null) && !(replay.outcome?.result === 'unfinished' && !v.outcome)) { imports.push({ file: f, ok: false, reason: 'the replay claims an outcome its inputs do not produce', claimed: replay.outcome, calculated: v.outcome ?? null }); continue; }
  const outcome = v.outcome ?? { result: 'unfinished', tick: replay.ticks.length };
  const first = store.importMatch({ manifest: replay.manifest, events, outcome, experimentId });
  const again = store.importMatch({ manifest: replay.manifest, events, outcome, experimentId });
  imports.push({ file: f, ok: true, matchId: replay.manifest.matchId, eventsAdded: first, reimportAdded: again });
}
const QUESTS = [
  { id: 'priest-support', version: 1, kind: 'member_damage', role: 'priest', threshold: 5 },
  { id: 'ember-strike-regular', version: 1, kind: 'definition_matches', definition: 'fixture.ember_strike', threshold: 3 },
  { id: 'first-craft', version: 1, kind: 'mine_and_craft', threshold: 1 },
];
console.log(JSON.stringify({
  imports, events: store.size, matches: matchReport(store), combatCredit: combatCredit(store),
  creators: creatorStats(store), items: itemHistory(store), quests: questProgress(store, QUESTS),
}, null, 1));
