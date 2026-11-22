#!/usr/bin/env node
/**
 * npm run experiment -- [--profiles id,id] [--seeds 1-6] [--ticks 300] [--out .data/experiments/x]
 *
 * A rules simulation batch (not peer-verified): heuristic bots play every profile × seed with
 * seats swapped on alternate seeds. Reports wins, draws and unfinished runs, Ticks to first
 * engagement and outcome, Supply/Mana, casts, damage by channel and face, casualties — grouped by
 * profile, with each match's replay kept behind the aggregate.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createSession, playMatch, verifyReplay } from '../../src/hapa/rules/session.js';
import { HeuristicBot } from '../../src/hapa/controllers/heuristic-bot.js';
import { summarize } from '../../src/hapa/rules/stats.js';
import { profileById, BASE_PROFILE } from '../../fixtures/hapa/profiles.js';
import { CATALOG } from '../../fixtures/hapa/content.js';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const profiles = arg('profiles', `${BASE_PROFILE.id},hapa_open_10x9_v3_01_line_attacker,hapa_open_10x9_v3_01_party_maintenance`).split(',');
const [s0, s1] = arg('seeds', '1-4').split('-').map(Number);
const ticks = Number(arg('ticks', 250));
const out = arg('out', `.data/experiments/${new Date().toISOString().replace(/[:.]/g, '-')}`);
mkdirSync(out, { recursive: true });
const report = { kind: 'hapa-versus-rules-simulation', controllers: 'heuristic-bot/0.1.0 vs heuristic-bot/0.1.0', tickBudget: ticks, seeds: [s0, s1], profiles: {} };
for (const pid of profiles) {
  const agg = { runs: 0, wins: { A: 0, B: 0 }, draws: 0, unfinished: 0, ticksToOutcome: [], firstEngagement: [], casualties: { A: 0, B: 0 }, damage: { physical: 0, magic: 0 }, damageByFace: {}, casts: {}, manaExpired: 0, replacedUnused: 0, matches: [] };
  for (let seed = s0; seed <= s1; seed++) {
    const swap = seed % 2 === 0; // alternate seats: the bot seeded first plays B on even seeds
    const session = createSession({ matchId: `exp-${pid}-${seed}`, profile: profileById(pid), catalog: CATALOG, seed,
      controllers: { A: { type: 'bot', revision: 'heuristic-bot/0.1.0' }, B: { type: 'bot', revision: 'heuristic-bot/0.1.0' } } });
    const bots = { A: new HeuristicBot({ seat: 'A', seed: seed * 2 + (swap ? 2 : 1) }), B: new HeuristicBot({ seat: 'B', seed: seed * 2 + (swap ? 1 : 2) }) };
    const o = playMatch(session, bots, { tickBudget: ticks });
    const v = verifyReplay(JSON.parse(JSON.stringify(session.replay)));
    const s = summarize(session.events, session.state);
    agg.runs++;
    if (o.result === 'win') { agg.wins[o.winner]++; agg.ticksToOutcome.push(o.tick); } else if (o.result === 'draw') agg.draws++; else agg.unfinished++;
    if (s.firstEngagementTick) agg.firstEngagement.push(s.firstEngagementTick);
    for (const k of ['A', 'B']) agg.casualties[k] += s.casualties[k];
    for (const k of ['physical', 'magic']) agg.damage[k] += s.damage[k];
    for (const [f, d] of Object.entries(s.damageByFace)) agg.damageByFace[f] = (agg.damageByFace[f] ?? 0) + d;
    for (const [c, n] of Object.entries(s.casts)) agg.casts[c] = (agg.casts[c] ?? 0) + n;
    agg.manaExpired += s.manaExpired.A + s.manaExpired.B;
    agg.replacedUnused += s.replacedUnused.A + s.replacedUnused.B;
    const file = `${out}/${pid}.seed${seed}.replay.json`;
    writeFileSync(file, JSON.stringify(session.replay));
    agg.matches.push({ seed, outcome: o.result, winner: o.winner ?? null, tick: session.state.tick, replay: file, replayVerified: v.ok });
    process.stderr.write(`${pid} seed ${seed}: ${o.result}${o.winner ? ` ${o.winner}` : ''} @${session.state.tick}\n`);
  }
  const mean = (a) => (a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : null);
  report.profiles[pid] = { ...agg, meanTicksToOutcome: mean(agg.ticksToOutcome), meanFirstEngagement: mean(agg.firstEngagement) };
}
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1));
for (const [pid, a] of Object.entries(report.profiles)) console.log(`${pid}: A ${a.wins.A} · B ${a.wins.B} · draw ${a.draws} · unfinished ${a.unfinished} · mean outcome Tick ${a.meanTicksToOutcome} · first contact ${a.meanFirstEngagement} · casualties ${a.casualties.A}/${a.casualties.B}`);
console.log(`report: ${out}/report.json`);
