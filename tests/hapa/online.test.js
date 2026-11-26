/**
 * Changed trust boundaries of online play (Assignment 16 journey 5; p2p-matchmaking-v1 §8, §10):
 * remote record admission, result verification and the conflict-aware result index. The match is
 * produced in memory with the same record order the live authority writes; no network is needed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import crypto from 'hypercore-crypto';
import b4a from 'b4a';
import { signRecord } from '../../src/hapa/protocol/messages.js';
import { admitRecord } from '../../src/hapa/protocol/admission.js';
import { PhaseAgreement } from '../../src/hapa/protocol/agreement.js';
import { createContext } from '../../src/hapa/rules/context.js';
import { initializeMatch, stateFingerprint } from '../../src/hapa/rules/state.js';
import { beginCount, validatePlan, resolveTick } from '../../src/hapa/rules/match.js';
import { fingerprint } from '../../src/hapa/rules/encoding.js';
import { HeuristicBot } from '../../src/hapa/controllers/heuristic-bot.js';
import { presetManifest, initialStateHash, rulesImplementation, compatibility, ONLINE_PROTOCOL } from '../../src/hapa/network/compat.js';
import { signBody } from '../../src/hapa/network/control.js';
import { buildBundle, verifyBundle } from '../../src/hapa/network/results.js';
import { prefixRoot } from '../../src/hapa/network/prefix.js';
import { ResultIndex } from '../../src/hapa/network/result-index.js';
import { playerIdOf } from '../../src/hapa/network/identity.js';

function player(label) {
  const kp = crypto.keyPair();
  const publicKey = b4a.toString(kp.publicKey, 'hex');
  return { identityKind: 'hapa_versus_player_key_v1', participantId: playerIdOf(publicKey), signingKeyId: `ed25519:${publicKey}`, publicKey, secretKey: b4a.toString(kp.secretKey, 'hex'), label };
}
const pub = (p) => ({ participantId: p.participantId, identityKind: p.identityKind, label: p.label, signingKeyId: p.signingKeyId, publicKey: p.publicKey });

const raw = (rec) => b4a.from(JSON.stringify(rec)); // Hypercore's JSON value encoding
/** Both players' terminal attestations over the exact prefixes (as OnlineMatch writes them). */
function attest(descriptor, records, ids, outcome, finalHash) {
  const blocks = { A: records.A.map(raw), B: records.B.map(raw) };
  const prefixes = {};
  for (const s of ['A', 'B']) prefixes[s] = { key: descriptor.feeds[s], fork: 0, length: blocks[s].length, root: prefixRoot(blocks[s]) };
  const attestations = {};
  for (const s of ['A', 'B']) {
    const rec = signRecord(ids[s], { type: 'closing', matchId: descriptor.matchId, authorSequence: records[s].length + 1, count: records[s].at(-1).body.count, phaseId: 'closing', priorStateHash: records[s].at(-1).body.priorStateHash, payload: { v: 2, finalHash, outcome, descriptorHash: fingerprint(descriptor), prefixes } });
    attestations[s] = { index: records[s].length, block: raw(rec) };
  }
  return { prefixes, blocks, attestations };
}

/** Play a bot match and write both seats' signed records in the live authority's order. */
function playRecorded({ seed = 3, matchId = `hv-${'ab'.repeat(16)}`, tamper = null, ids = { A: player('Ada'), B: player('Bram') }, botSeeds = [11, 12], session = null } = {}) {
  const manifest = presetManifest({ matchId, seed, players: { A: pub(ids.A), B: pub(ids.B) }, controllers: { A: { type: 'bot', revision: 'heuristic-bot/0.2.0' }, B: { type: 'bot', revision: 'heuristic-bot/0.2.0' } } });
  const descriptor = { online: ONLINE_PROTOCOL, network: 'test-unit', matchId, challengeHash: fingerprint({ c: 1 }), acceptHash: fingerprint({ a: 1 }), manifestHash: fingerprint(manifest), initialStateHash: initialStateHash(manifest), rulesImplementation: rulesImplementation(), compat: compatibility().id,
    players: { A: { participantId: ids.A.participantId, publicKey: ids.A.publicKey }, B: { participantId: ids.B.participantId, publicKey: ids.B.publicKey } },
    feeds: { A: 'a'.repeat(64), B: 'b'.repeat(64) }, policy: { agreement: 'own_plan_ready_v1', results: 'public_replay_v1' }, recovery: 'journal_replay_v1' };
  const sigs = { A: signBody('session', descriptor, ids.A), B: signBody('session', descriptor, ids.B) };
  const ctx = createContext(manifest), state = initializeMatch(manifest);
  const bots = { A: new HeuristicBot({ seat: 'A', seed: botSeeds[0] }), B: new HeuristicBot({ seat: 'B', seed: botSeeds[1] }) };
  const records = { A: [], B: [] };
  const pubRec = (s, type, count, phaseId, prior, payload) => { const r = signRecord(ids[s], { type, matchId, authorSequence: records[s].length + 1, count, phaseId, priorStateHash: prior, payload }); records[s].push(r); return r.body; };
  while (!state.outcome && state.tick < 120) {
    beginCount(state, ctx);
    const count = state.tick, prior = stateFingerprint(state);
    const ag = new PhaseAgreement({ matchId, count, phaseId: 'plan', priorStateHash: prior, policy: 'own_plan_ready_v1' });
    for (const s of ['A', 'B']) {
      ag.receive(s, pubRec(s, 'plan', count, 'plan', prior, { planRevision: 1, commands: bots[s].plan(state, ctx) }));
      ag.receive(s, pubRec(s, 'ready', count, 'plan', prior, ag.readyPayload(s)));
    }
    const plans = {};
    for (const s of ['A', 'B']) plans[s] = validatePlan(state, ctx, s, ag.locked[s]).accepted;
    const gen = resolveTick(state, ctx, plans);
    let step = gen.next(), index = 0;
    while (!step.done) {
      const req = step.value;
      const answer = bots[req.seat].choose(req, state, ctx) ?? { pass: true };
      pubRec(req.seat, 'choice', count, req.choiceId, prior, { choiceId: req.choiceId, choiceIndex: index++, requestHash: fingerprint(req), answer });
      step = gen.next(answer);
    }
    for (const s of ['A', 'B']) pubRec(s, 'receipt', count, 'receipt', prior, { stateHash: stateFingerprint(state), outcome: state.outcome ?? null, lockedPair: ag.locked.hashes });
  }
  if (tamper) tamper(records, ids);
  const sess = session ?? { descriptor, sigs, manifest };
  const evidence = attest(sess.descriptor, records, ids, state.outcome, stateFingerprint(state));
  const bundle = buildBundle({ session: sess, evidence });
  return { ids, manifest, descriptor, records, bundle, evidence, outcome: state.outcome, finalHash: stateFingerprint(state) };
}

const base = playRecorded();

test('record admission: the agreed author, this match, its feed position and a bounded payload only', () => {
  const rec = base.records.A[0];
  const ok = admitRecord(rec, { matchId: base.descriptor.matchId, author: base.ids.A, index: 0, maxCount: 10_000 });
  assert.equal(ok.ok, true);
  const no = (r, e) => assert.equal(admitRecord(r, e).ok, false);
  no(rec, { matchId: 'hv-other', author: base.ids.A, index: 0, maxCount: 10_000 }); // wrong session
  no(rec, { matchId: base.descriptor.matchId, author: base.ids.B, index: 0, maxCount: 10_000 }); // wrong seat/author
  no(rec, { matchId: base.descriptor.matchId, author: base.ids.A, index: 3, maxCount: 10_000 }); // wrong position (gap/rollback)
  no({ ...rec, body: { ...rec.body, payload: { ...rec.body.payload, commands: [] } } }, { matchId: base.descriptor.matchId, author: base.ids.A, index: 0, maxCount: 10_000 }); // altered after signing
  no({ ...rec, extra: 1 }, { matchId: base.descriptor.matchId, author: base.ids.A, index: 0, maxCount: 10_000 }); // malformed envelope
  no({ body: { ...rec.body, type: 'shell' }, signature: rec.signature }, { matchId: base.descriptor.matchId, author: base.ids.A, index: 0, maxCount: 10_000 }); // unknown type
  const huge = signRecord(base.ids.A, { type: 'plan', matchId: base.descriptor.matchId, authorSequence: 1, count: 1, phaseId: 'plan', priorStateHash: rec.body.priorStateHash, payload: { planRevision: 1, commands: [{ type: 'concede', note: 'x'.repeat(70_000) }] } });
  no(huge, { matchId: base.descriptor.matchId, author: base.ids.A, index: 0, maxCount: 10_000 }); // oversized
  // a new match legitimately restarts its sequence at 1
  const other = playRecorded({ seed: 5, matchId: `hv-${'cd'.repeat(16)}` });
  assert.equal(admitRecord(other.records.A[0], { matchId: other.descriptor.matchId, author: other.ids.A, index: 0, maxCount: 10_000 }).ok, true);
});

test('result verification recomputes the match from authenticated prefixes and both terminal attestations', () => {
  const v = verifyBundle(base.bundle);
  assert.equal(v.ok, true, v.reason);
  assert.deepEqual(v.outcome, base.outcome);
  const wrongContext = structuredClone(base.bundle);
  wrongContext.session.descriptor.network = 'elsewhere';
  assert.equal(verifyBundle(wrongContext).ok, false);
  const unsigned = structuredClone(base.bundle);
  unsigned.session.sigs.B = '0'.repeat(128);
  assert.match(verifyBundle(unsigned).reason, /consent of seat B/);
  const truncated = structuredClone(base.bundle);
  truncated.transcript.B.blocks.pop(); truncated.transcript.B.length--;
  assert.equal(verifyBundle(truncated).ok, false);
  const unsupported = structuredClone(base.bundle);
  unsupported.session.descriptor.rulesImplementation = 'sha256:' + '0'.repeat(64);
  assert.equal(verifyBundle(unsupported).status, 'invalid'); // the consent no longer covers the altered descriptor
  // identity is checked from the key itself, never from the archive that supplied it
  const alias = structuredClone(base.bundle);
  alias.session.descriptor.players.A.participantId = 'hv1:' + 'c'.repeat(64);
  assert.match(verifyBundle(alias).reason, /canonical player key/);
  // v1 evidence keeps its bytes but never inherits the verified label
  assert.equal(verifyBundle({ ...structuredClone(base.bundle), schema: 'hapa-versus-result/v1' }).status, 'legacy');
});

test('R16-01: a unilateral rewrite of a participant\'s own receipt cannot become a different counted history', () => {
  const lastA = base.records.A.length - 1;
  const rewritten = signRecord(base.ids.A, { ...base.records.A[lastA].body, phaseId: 'plan' });
  // (a) only the block changes: it no longer produces the attested root
  const a = structuredClone(base.bundle);
  a.transcript.A.blocks[lastA] = raw(rewritten).toString('base64');
  assert.match(verifyBundle(a).reason, /claimed prefix root/);
  // (b) the block, the root and its author's own attestation change: the other player's attestation still names the original
  const b = structuredClone(base.bundle);
  const blocksA = base.evidence.blocks.A.slice(); blocksA[lastA] = raw(rewritten);
  b.transcript.A.blocks = blocksA.map((x) => x.toString('base64'));
  b.transcript.A.root = prefixRoot(blocksA);
  const prefixes = { A: { ...base.evidence.prefixes.A, root: b.transcript.A.root }, B: base.evidence.prefixes.B };
  const myClosing = signRecord(base.ids.A, { type: 'closing', matchId: base.descriptor.matchId, authorSequence: base.records.A.length + 1, count: rewritten.body.count, phaseId: 'closing', priorStateHash: rewritten.body.priorStateHash, payload: { v: 2, finalHash: base.finalHash, outcome: base.outcome, descriptorHash: fingerprint(base.descriptor), prefixes } });
  b.attestations.A.block = raw(myClosing).toString('base64');
  assert.match(verifyBundle(b).reason, /seat B's attestation does not name/);
  // (c) even when both keys sign it, a receipt outside its context is refused by replay
  const both = playRecorded({ ids: base.ids, session: { ...base.bundle.session, manifest: base.manifest }, tamper: (recs, ids) => { const i = recs.B.length - 1; recs.B[i] = signRecord(ids.B, { ...recs.B[i].body, phaseId: 'plan' }); } });
  assert.match(verifyBundle(both.bundle).reason, /receipt for Tick \d+ in its context/);
});

test('the result index counts a result once, quarantines forgeries and keeps real conflicts out of totals', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hv-results-'));
  try {
    const idx = new ResultIndex(dir);
    const winner = base.outcome.winner, loser = winner === 'A' ? 'B' : 'A';
    assert.equal(idx.submit(base.bundle).status, 'added');
    assert.equal(idx.submit(structuredClone(base.bundle)).status, 'duplicate');
    const repackaged = { ...structuredClone(base.bundle), introducer: { archive: 'elsewhere' } }; // equivalent evidence, different packaging
    assert.equal(idx.submit(repackaged).status, 'duplicate');
    const forged = structuredClone(base.bundle); forged.transcript.A.root = 'f'.repeat(64);
    assert.equal(idx.submit(forged).status, 'invalid');
    const stats = () => idx.stats(base.ids[winner].participantId).buckets['bot-vs-bot'];
    assert.deepEqual([stats().wins, stats().losses, idx.stats(base.ids[loser].participantId).buckets['bot-vs-bot'].losses], [1, 0, 1]);
    // reusing the match id with other signers is a separate record about them, never a dispute of this one
    const impostor = playRecorded({ seed: 3, matchId: base.descriptor.matchId });
    assert.equal(idx.submit(impostor.bundle).status, 'added');
    assert.equal(stats().wins, 1);
    // a unilateral receipt rewrite (with its author's re-signed attestation) cannot erase the win
    const lastA = base.records.A.length - 1;
    const tampered = playRecorded({ ids: base.ids, session: { ...base.bundle.session, manifest: base.manifest }, tamper: (recs, ids) => { recs.A[lastA] = signRecord(ids.A, { ...recs.A[lastA].body, payload: { ...recs.A[lastA].body.payload, stateHash: 'sha256:' + 'f'.repeat(64) } }); } });
    assert.equal(idx.submit(tampered.bundle).status, 'invalid');
    assert.equal(stats().wins, 1);
    // a real dispute: the same signers sign two different complete transcripts for the same session
    const twin = playRecorded({ seed: 3, matchId: base.descriptor.matchId, ids: base.ids, botSeeds: [21, 22], session: { ...base.bundle.session, manifest: base.manifest } });
    assert.equal(verifyBundle(twin.bundle).ok, true);
    assert.equal(idx.submit(twin.bundle).status, 'disputed');
    assert.equal(idx.stats(base.ids[winner].participantId).buckets['bot-vs-bot']?.wins ?? 0, 0);
    assert.equal(idx.stats(base.ids[winner].participantId).disputed, 1);
    // rebuild from disk gives the same projection
    const again = new ResultIndex(dir);
    assert.deepEqual(again.stats(base.ids[winner].participantId), idx.stats(base.ids[winner].participantId));
    assert.equal(again.list({}).total, 2); // base (disputed, both kept) and the impostor's own record
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
