#!/usr/bin/env node
/**
 * Stage verdict for the relay NAT witness (Review 22 V22-03 / N24-03; run by relay-nat-witness.sh).
 *
 *   node tools/hapa/relay-witness-aggregate.mjs <stage out dir> <stage 1|2>
 *
 * A stage passes only with its EXACT expected report set: stage 1 = Peer-a and Peer-b, stage 2 =
 * Peer-a, Peer-b and Peer-c. Every required report must exist, parse, name the peer its file is for,
 * be unique, run in the stage's mode, report ok, and list each other expected peer exactly once as
 * authenticated over a relayed path through the live relay. A missing, unparseable, duplicated,
 * misidentified or failing report fails the stage, as does an unexpected extra report, a control that
 * did not hold, or fewer relay pairings matched than the stage requires. Writes summary.json and exits
 * 0 (pass) or 1 (fail).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const STAGES = {
  1: { peers: ['a', 'b'], mode: 'single', minMatched: 1 },
  2: { peers: ['a', 'b', 'c'], mode: 'fallback', minMatched: 3 },
};
const ALL = ['a', 'b', 'c'];

/**
 * @param {{ stage: string|number, reports: Record<string, unknown>, stats: any, control: any }} input
 *   `reports[x]` is the parsed peer-x.json, `undefined` when the file is absent, or an `Error` when it
 *   did not parse.
 * @returns {{ ok: boolean, stage: string, problems: string[] }}
 */
export function verdict({ stage, reports, stats, control }) {
  const spec = STAGES[stage];
  const problems = [];
  if (!spec) return { ok: false, stage: String(stage), problems: [`unknown stage ${stage}`] };
  const names = spec.peers.map((x) => `Peer-${x}`);
  for (const x of ALL) {
    const r = reports[x], want = `Peer-${x}`;
    if (!spec.peers.includes(x)) { if (r !== undefined) problems.push(`unexpected report peer-${x}.json in stage ${stage}`); continue; }
    if (r === undefined) { problems.push(`missing required report peer-${x}.json`); continue; }
    if (r instanceof Error || !r || typeof r !== 'object') { problems.push(`peer-${x}.json is not a valid report${r instanceof Error ? ` (${r.message})` : ''}`); continue; }
    if (r.name !== want) problems.push(`peer-${x}.json names "${r.name}", expected "${want}"`);
    if (r.mode !== spec.mode) problems.push(`${want} ran mode "${r.mode}", expected "${spec.mode}"`);
    if (r.ok !== true) problems.push(`${want} reported ok=${r.ok}`);
    const others = names.filter((n) => n !== want);
    const roster = Array.isArray(r.roster) ? r.roster : [];
    for (const n of others) {
      const seen = roster.filter((p) => p?.label === n);
      if (seen.length !== 1) problems.push(`${want} lists ${n} ${seen.length} times, expected once`);
      else if (seen[0].path !== 'relayed' || seen[0].relay !== 'live') problems.push(`${want} reaches ${n} via path=${seen[0].path} relay=${seen[0].relay}, expected relayed via live`);
    }
    const strangers = roster.filter((p) => !others.includes(p?.label));
    if (strangers.length) problems.push(`${want} lists unexpected players: ${strangers.map((p) => p?.label).join(', ')}`);
  }
  const claimed = spec.peers.map((x) => reports[x]?.name).filter(Boolean);
  if (new Set(claimed).size !== claimed.length) problems.push(`duplicated peer identity among reports: ${claimed.join(', ')}`);
  if (!control || control.peersBehindRandomizedNat !== true || control.unsolicitedInboundDropped !== true || control.peerToRelay !== true) problems.push('the topology control did not hold');
  const matched = stats?.pairings?.matched;
  if (!(Number.isInteger(matched) && matched >= spec.minMatched)) problems.push(`relay pairings matched ${matched ?? 'unknown'}, expected at least ${spec.minMatched}`);
  return { ok: problems.length === 0, stage: String(stage), problems };
}

const readOrError = (f) => { if (!existsSync(f)) return undefined; try { return JSON.parse(readFileSync(f, 'utf8')); } catch (e) { return e; } };

/** Read a stage's output directory, decide, and write summary.json beside the reports. */
export function aggregate(out, stage) {
  const reports = Object.fromEntries(ALL.map((x) => [x, readOrError(join(out, `peer-${x}.json`))]));
  const stats = readOrError(join(out, 'relay-stats.json'));
  const control = readOrError(join(out, 'control.json'));
  const v = verdict({ stage, reports, stats: stats instanceof Error ? null : stats, control: control instanceof Error ? null : control });
  const peers = ALL.map((x) => reports[x]).filter((r) => r && !(r instanceof Error)).map((p) => Object.fromEntries(['name', 'ok', 'seconds', 'roster', 'relays', 'diag', 'firewall'].map((k) => [k, p[k]])));
  const summary = { ok: v.ok, stage: v.stage, problems: v.problems, expectedPeers: STAGES[stage]?.peers.map((x) => `Peer-${x}`) ?? [], control: control instanceof Error ? null : control ?? null, relayStats: stats instanceof Error ? null : stats ?? null, peers };
  writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 1));
  return summary;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [out, stage = '1'] = process.argv.slice(2);
  if (!out) { console.error('usage: relay-witness-aggregate.mjs <stage out dir> <1|2>'); process.exit(2); }
  const s = aggregate(out, stage);
  console.log(JSON.stringify(s, null, 1));
  process.exit(s.ok ? 0 : 1);
}
