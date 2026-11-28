/**
 * Relay witness stage verdict (Review 22 V22-03 / N24-03): the exact expected report set per stage.
 * Uses the actual passing evidence of run 46101799012 (Response 23) as the complete case, then removes,
 * duplicates, mislabels or corrupts reports. Harness-level; no network experiment is repeated.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { aggregate } from '../../tools/hapa/relay-witness-aggregate.mjs';

const EVIDENCE = new URL('../../docs/reviews/evidence/2026-11-27/response-23/relay-witness-46101799012/', import.meta.url).pathname;
const stageDir = (stage, edit = () => {}) => { const d = mkdtempSync(join(tmpdir(), `hv-agg-${stage}-`)); cpSync(join(EVIDENCE, `stage${stage}`), d, { recursive: true }); rmSync(join(d, 'summary.json'), { force: true }); edit(d); return d; };
const rewrite = (d, f, fn) => writeFileSync(join(d, f), JSON.stringify(fn(JSON.parse(readFileSync(join(d, f), 'utf8')))));
const run = (stage, edit) => { const d = stageDir(stage, edit); try { return aggregate(d, String(stage)); } finally { rmSync(d, { recursive: true, force: true }); } };

test('V22-03 / N24-03: the published run passes with its exact peer sets', () => {
  const s1 = run(1), s2 = run(2);
  assert.equal(s1.ok, true, s1.problems.join('; '));
  assert.deepEqual(s1.expectedPeers, ['Peer-a', 'Peer-b']);
  assert.equal(s2.ok, true, s2.problems.join('; '));
  assert.deepEqual(s2.peers.map((p) => p.name).sort(), ['Peer-a', 'Peer-b', 'Peer-c']);
});

test('V22-03 / N24-03: missing, duplicated, misidentified, invalid, failing or extra reports fail the stage', () => {
  const fails = (stage, edit, pattern) => { const s = run(stage, edit); assert.equal(s.ok, false, `expected failure: ${pattern}`); assert.ok(s.problems.some((p) => pattern.test(p)), `${pattern} not in ${JSON.stringify(s.problems)}`); };
  // the reviewer's case: stage 2 without Peer-c's report used to pass
  fails(2, (d) => unlinkSync(join(d, 'peer-c.json')), /missing required report peer-c\.json/);
  fails(1, (d) => unlinkSync(join(d, 'peer-b.json')), /missing required report peer-b\.json/);
  // a duplicated report standing in for the missing peer
  fails(2, (d) => cpSync(join(d, 'peer-b.json'), join(d, 'peer-c.json')), /names "Peer-b", expected "Peer-c"|duplicated peer identity/);
  // misidentified
  fails(2, (d) => rewrite(d, 'peer-a.json', (r) => ({ ...r, name: 'Peer-x' })), /names "Peer-x"/);
  // unparseable
  fails(2, (d) => writeFileSync(join(d, 'peer-b.json'), '{"name":"Peer-b",'), /not a valid report/);
  // a report that says it failed, or reached a peer directly / through the dead relay
  fails(2, (d) => rewrite(d, 'peer-c.json', (r) => ({ ...r, ok: false })), /Peer-c reported ok=false/);
  fails(2, (d) => rewrite(d, 'peer-a.json', (r) => ({ ...r, roster: r.roster.map((p) => (p.label === 'Peer-b' ? { ...p, path: 'direct', relay: null } : p)) })), /via path=direct/);
  // a peer missing from someone's roster, or listed twice
  fails(2, (d) => rewrite(d, 'peer-b.json', (r) => ({ ...r, roster: r.roster.filter((p) => p.label !== 'Peer-a') })), /Peer-b lists Peer-a 0 times/);
  fails(2, (d) => rewrite(d, 'peer-b.json', (r) => ({ ...r, roster: [...r.roster, r.roster[0]] })), /lists .* 2 times/);
  // a stray report in a stage that expects two peers
  fails(1, (d) => cpSync(join(EVIDENCE, 'stage2', 'peer-c.json'), join(d, 'peer-c.json')), /unexpected report peer-c\.json/);
  // wrong mode, a broken control, or too few relay pairings
  fails(2, (d) => rewrite(d, 'peer-a.json', (r) => ({ ...r, mode: 'single' })), /ran mode "single"/);
  fails(2, (d) => rewrite(d, 'control.json', (c) => ({ ...c, unsolicitedInboundDropped: false })), /control did not hold/);
  fails(2, (d) => rewrite(d, 'relay-stats.json', (s) => ({ ...s, pairings: { ...s.pairings, matched: 2 } })), /pairings matched 2, expected at least 3/);
});
