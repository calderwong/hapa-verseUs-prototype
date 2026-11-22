// HV-33/34/35 — public plan agreement, signed records and two independent peers with their own logs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PhaseAgreement } from '../../src/hapa/protocol/agreement.js';
import { createDevIdentity, publicIdentity, signRecord, verifyRecord } from '../../src/hapa/protocol/messages.js';
import { Peer } from '../../src/hapa/protocol/peer.js';
import { createManifest } from '../../src/hapa/rules/state.js';
import { HeuristicBot } from '../../src/hapa/controllers/heuristic-bot.js';
import { profileById, BASE_PROFILE } from '../../fixtures/hapa/profiles.js';
import { CATALOG } from '../../fixtures/hapa/content.js';
import { fingerprint } from '../../src/hapa/rules/encoding.js';

const rec = (author, seq, type, payload, extra = {}) => ({ schemaVersion: 1, type, matchId: 'm', authorId: author, signingKeyId: 'k', authorSequence: seq, count: 1, phaseId: 'plan', priorStateHash: 'sha256:x', payload, ...extra });

test('a stale Ready pair never resolves a newly edited plan', () => {
  const ag = new PhaseAgreement({ matchId: 'm', count: 1, phaseId: 'plan', priorStateHash: 'sha256:x' });
  ag.receive('A', rec('a', 1, 'plan', { planRevision: 1, commands: [{ type: 'burn', cardId: 'x' }] }));
  ag.receive('B', rec('b', 1, 'plan', { planRevision: 1, commands: [] }));
  ag.receive('A', rec('a', 2, 'ready', ag.pair()));
  assert.equal(ag.current('A'), true);
  // B edits after A's Ready: A's acknowledgment of the old pair is stale; nothing locks
  ag.receive('B', rec('b', 2, 'plan', { planRevision: 2, commands: [{ type: 'concede' }] }));
  assert.equal(ag.stale('A'), true);
  const r = ag.receive('B', rec('b', 3, 'ready', ag.pair()));
  assert.equal(r.locked, null);
  // A's own plan is frozen; A acknowledges the new pair, then the phase locks
  assert.equal(ag.receive('A', rec('a', 3, 'plan', { planRevision: 2, commands: [] })).ok, false);
  const l = ag.receive('A', rec('a', 4, 'ready', ag.pair()));
  assert.deepEqual(l.locked.B, [{ type: 'concede' }]);
  assert.deepEqual(l.locked.revisions, { A: 1, B: 2 });
  // later messages cannot revise the locked phase
  assert.equal(ag.receive('B', rec('b', 4, 'plan', { planRevision: 3, commands: [] })).ok, false);
});

test('duplicate delivery is a no-op; conflicting content under one identity is an error', () => {
  const ag = new PhaseAgreement({ matchId: 'm', count: 1, phaseId: 'plan', priorStateHash: 'sha256:x' });
  const r1 = rec('a', 1, 'plan', { planRevision: 1, commands: [] });
  assert.equal(ag.receive('A', r1).ok, true);
  assert.equal(ag.receive('A', JSON.parse(JSON.stringify(r1))).duplicate, true);
  assert.equal(ag.plans.A.revision, 1);
  assert.equal(ag.receive('A', rec('a', 1, 'plan', { planRevision: 5, commands: [] })).ok, false);
});

test('signed records verify; tampering or a wrong identity fails', () => {
  const a = createDevIdentity('a');
  const r = signRecord(a, { type: 'plan', matchId: 'm', authorSequence: 1, count: 1, phaseId: 'plan', priorStateHash: 'sha256:x', payload: { planRevision: 1, commands: [] } });
  assert.equal(verifyRecord(r, publicIdentity(a)).type, 'plan');
  const t = JSON.parse(JSON.stringify(r));
  t.body.payload.planRevision = 2;
  assert.throws(() => verifyRecord(t, publicIdentity(a)), /bad signature/);
  assert.throws(() => verifyRecord(r, publicIdentity(createDevIdentity('b'))), /identity binding/);
  assert.equal(a.identityKind, 'local_development_identity');
});

test('two independent peers with their own logs agree on every Tick and on the result', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'hapa-versus-peers-'));
  const idA = createDevIdentity('peer-a'), idB = createDevIdentity('peer-b');
  const manifest = createManifest({
    matchId: 'peer-test', profile: profileById(BASE_PROFILE.id), catalog: CATALOG, seed: 2,
    participants: { A: publicIdentity(idA), B: publicIdentity(idB) },
    controllers: { A: { type: 'bot', revision: 'heuristic-bot/0.1.0' }, B: { type: 'bot', revision: 'heuristic-bot/0.1.0' } },
  });
  const pa = new Peer({ seat: 'A', identity: idA, opponent: publicIdentity(idB), storage: join(dir, 'A'), manifest: JSON.parse(JSON.stringify(manifest)), controller: new HeuristicBot({ seat: 'A', seed: 5 }) });
  const pb = new Peer({ seat: 'B', identity: idB, opponent: publicIdentity(idA), storage: join(dir, 'B'), manifest: JSON.parse(JSON.stringify(manifest)), controller: new HeuristicBot({ seat: 'B', seed: 6 }) });
  const [ka, kb] = await Promise.all([pa.open(), pb.open()]);
  await pa.attachRemote(kb); await pb.attachRemote(ka);
  assert.equal(pa.manifestFingerprint, pb.manifestFingerprint);
  let sa = pa.replicate(true), sb = pb.replicate(false);
  sa.pipe(sb).pipe(sa);
  // play a few Ticks, drop the connection, reconnect and finish
  for (let i = 0; i < 6; i++) await Promise.all([pa.playTick(), pb.playTick()]);
  sa.destroy(); sb.destroy();
  sa = pa.replicate(true); sb = pb.replicate(false);
  sa.pipe(sb).pipe(sa);
  const [oa, ob] = await Promise.all([pa.play({ tickBudget: 60 }), pb.play({ tickBudget: 60 })]);
  assert.deepEqual(oa, ob);
  assert.equal(oa.result, 'win');
  assert.ok(pa.receipts.every((r) => r.agreed) && pb.receipts.every((r) => r.agreed));
  assert.equal(pa.receipts.at(-1).hash, pb.receipts.at(-1).hash);
  // re-delivering an already processed opponent record has no second effect
  const first = await pb.own.get(0);
  assert.equal(pa.deliver(first), false);
  await pa.close(); await pb.close();
  rmSync(dir, { recursive: true, force: true });
  void fingerprint;
});
