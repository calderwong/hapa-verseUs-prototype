/**
 * Public result evidence and its verification (Assignment 16 finding 6; p2p-matchmaking-v1 §10).
 *
 * A `hapa-versus-result/v1` bundle carries the jointly signed session, the agreed manifest and both
 * players' complete signed record prefixes up to and including their final receipts. Its provenance
 * is the participants' signatures plus deterministic recomputation — not whoever delivered it. The
 * verifier never trusts a claimed outcome: it replays every Tick from the signed records with the
 * supported rules, checks every receipt, and only then reports the calculated result.
 *
 * Pure apart from hashing; no network and no clock. Node-only (signature checks).
 */
import { createContext } from '../rules/context.js';
import { initializeMatch, stateFingerprint, other } from '../rules/state.js';
import { beginCount, validatePlan, resolveTick } from '../rules/match.js';
import { fingerprint, canonicalize } from '../rules/encoding.js';
import { summarize } from '../rules/stats.js';
import { PhaseAgreement } from '../protocol/agreement.js';
import { admitRecord } from '../protocol/admission.js';
import { verifyBody } from './control.js';
import { rulesImplementation, manifestError, initialStateHash, ONLINE_PROTOCOL } from './compat.js';

export const RESULT_SCHEMA = 'hapa-versus-result/v1';
export const METRICS_VERSION = 'summarize_v1';
export const MAX_BUNDLE_BYTES = 64 * 1024 * 1024;

/** The stable identity of a result: network + match. Equivalent repackaging keeps it. */
export const resultKey = (network, matchId) => `${network}/${matchId}`;

/**
 * Build a bundle from a participant's store: the signed session and both feeds' records.
 * The endpoint of each feed is its final receipt (the terminal attestation); later records such as
 * `closing` are outside the transcript, so nothing after the attestation can alter the outcome.
 */
export function buildBundle({ session, records, calculation }) {
  const transcript = {};
  for (const s of ['A', 'B']) {
    const recs = records[s];
    let end = -1;
    for (let i = recs.length - 1; i >= 0; i--) if (recs[i].body.type === 'receipt') { end = i; break; }
    transcript[s] = { feedKey: session.descriptor.feeds[s], length: end + 1, records: recs.slice(0, end + 1) };
  }
  return {
    schema: RESULT_SCHEMA,
    network: session.descriptor.network,
    matchId: session.descriptor.matchId,
    session: { descriptor: session.descriptor, sigs: session.sigs },
    manifest: session.manifest,
    transcript,
    calculation,
  };
}

/** The canonical result commitment: session, computed outcome/state and transcript boundaries. */
export function commitmentOf(v) {
  return fingerprint({ network: v.network, matchId: v.matchId, descriptor: v.descriptorHash, outcome: v.outcome, finalStateHash: v.finalStateHash, endpoints: v.endpoints, transcriptDigest: v.transcriptDigest });
}

/**
 * Verify a bundle completely. Returns `{ ok: true, ... }` with the calculated result, or
 * `{ ok: false, status, reason }` where status is `invalid` (forged, inconsistent) or `unsupported`
 * (a rules implementation this verifier cannot run). Never returns a claimed value unchecked.
 */
export function verifyBundle(bundle) {
  try {
    if (!bundle || bundle.schema !== RESULT_SCHEMA) return bad('invalid', 'unknown result schema');
    const size = canonicalize(bundle).length;
    if (size > MAX_BUNDLE_BYTES) return bad('invalid', `bundle of ${size} bytes exceeds the cap`);
    const d = bundle.session?.descriptor, sigs = bundle.session?.sigs, manifest = bundle.manifest;
    if (!d || d.online !== ONLINE_PROTOCOL || d.network !== bundle.network || d.matchId !== bundle.matchId) return bad('invalid', 'session does not match the bundle');
    for (const s of ['A', 'B']) if (!verifyBody('session', d, sigs?.[s], d.players?.[s]?.publicKey)) return bad('invalid', `session consent of seat ${s} is missing or invalid`);
    if (d.rulesImplementation !== rulesImplementation()) return bad('unsupported', 'recorded with a rules implementation this build cannot verify');
    const players = { A: manifest?.participants?.A, B: manifest?.participants?.B };
    for (const s of ['A', 'B']) if (players[s]?.participantId !== d.players[s].participantId || players[s]?.publicKey !== d.players[s].publicKey) return bad('invalid', 'manifest players differ from the session');
    const me = manifestError(manifest, { matchId: d.matchId, players: { A: { ...d.players.A, signingKeyId: `ed25519:${d.players.A.publicKey}` }, B: { ...d.players.B, signingKeyId: `ed25519:${d.players.B.publicKey}` } } });
    if (me) return bad('invalid', me);
    if (fingerprint(manifest) !== d.manifestHash || initialStateHash(manifest) !== d.initialStateHash) return bad('invalid', 'manifest or initial state differs from the session');
    // every record: admitted against its agreed author, contiguous from the feed start
    const recs = {};
    for (const s of ['A', 'B']) {
      const t = bundle.transcript?.[s];
      if (!t || t.feedKey !== d.feeds[s] || !Array.isArray(t.records) || t.records.length !== t.length || t.length < 1) return bad('invalid', `transcript of seat ${s} is missing or inconsistent`);
      recs[s] = [];
      for (let i = 0; i < t.records.length; i++) {
        const r = admitRecord(t.records[i], { matchId: d.matchId, author: players[s], index: i, maxCount: 10_000 });
        if (!r.ok) return bad('invalid', `seat ${s} record ${i}: ${r.error}`);
        recs[s].push(r.body);
      }
    }
    const run = replayRecords(manifest, recs);
    if (!run.ok) return bad('invalid', run.reason);
    const claimed = bundle.calculation ?? {};
    const outcome = run.outcome;
    if (claimed.outcome !== undefined && fingerprint(claimed.outcome) !== fingerprint(outcome)) return bad('invalid', 'the claimed outcome differs from the calculated one');
    if (claimed.finalStateHash !== undefined && claimed.finalStateHash !== run.finalStateHash) return bad('invalid', 'the claimed final state differs from the calculated one');
    if (!outcome) return bad('unfinished', 'the transcript ends without a rules-defined result');
    const endpoints = { A: recs.A.length, B: recs.B.length };
    const transcriptDigest = fingerprint({ A: bundle.transcript.A.records, B: bundle.transcript.B.records });
    const v = { network: bundle.network, matchId: bundle.matchId, descriptorHash: fingerprint(d), outcome, finalStateHash: run.finalStateHash, endpoints, transcriptDigest };
    return {
      ok: true, status: 'verified', key: resultKey(bundle.network, bundle.matchId), commitment: commitmentOf(v), ...v, ticks: run.ticks,
      players: { A: { participantId: d.players.A.participantId, label: players.A.label }, B: { participantId: d.players.B.participantId, label: players.B.label } },
      controllers: { A: manifest.controllers.A.type, B: manifest.controllers.B.type }, metricsVersion: METRICS_VERSION, metrics: run.metrics,
    };
  } catch (e) {
    return bad('invalid', `verification error: ${e.message}`);
  }
}

/**
 * Recompute a match from both seats' signed records (the same order the live authority consumes
 * them): per Tick, each seat's plan revisions and Ready, the owning seat's choices, then both
 * receipts, which must name the locked pair and the computed state.
 */
export function replayRecords(manifest, recs) {
  const ctx = createContext(manifest);
  const state = initializeMatch(manifest);
  const cur = { A: 0, B: 0 };
  const peek = (s) => recs[s][cur[s]];
  const take = (s) => recs[s][cur[s]++];
  const events = [];
  let ticks = 0;
  while (!state.outcome) {
    if (cur.A >= recs.A.length && cur.B >= recs.B.length) break;
    events.push(...beginCount(state, ctx));
    const count = state.tick;
    const prior = stateFingerprint(state);
    const ag = new PhaseAgreement({ matchId: manifest.matchId, count, phaseId: 'plan', priorStateHash: prior, policy: 'own_plan_ready_v1' });
    for (const s of ['A', 'B']) {
      for (;;) {
        const b = peek(s);
        if (!b) return { ok: false, reason: `seat ${s} transcript ends inside Tick ${count} planning` };
        if (b.count !== count || (b.type !== 'plan' && b.type !== 'ready')) return { ok: false, reason: `seat ${s} record ${cur[s]} is out of order at Tick ${count} (${b.type} for ${b.count})` };
        take(s);
        const r = ag.receive(s, b);
        if (!r.ok) return { ok: false, reason: `seat ${s} Tick ${count}: ${r.error}` };
        if (b.type === 'ready') break;
      }
    }
    if (!ag.locked) return { ok: false, reason: `Tick ${count} never locked` };
    const plans = {};
    for (const s of ['A', 'B']) plans[s] = validatePlan(state, ctx, s, ag.locked[s]).accepted;
    const gen = resolveTick(state, ctx, plans);
    let step = gen.next(), index = 0;
    while (!step.done) {
      const req = step.value;
      const b = take(req.seat);
      if (!b || b.type !== 'choice' || b.count !== count || b.payload.choiceId !== req.choiceId || b.payload.choiceIndex !== index || b.payload.requestHash !== fingerprint(req)) return { ok: false, reason: `Tick ${count}: seat ${req.seat}'s choice ${req.choiceId} is missing or bound to another request` };
      step = gen.next(b.payload.answer);
      index++;
    }
    events.push(...step.value);
    const hash = stateFingerprint(state);
    for (const s of ['A', 'B']) {
      const b = take(s);
      if (!b || b.type !== 'receipt' || b.count !== count) return { ok: false, reason: `seat ${s} has no receipt for Tick ${count}` };
      if (b.payload.stateHash !== hash) return { ok: false, reason: `seat ${s}'s Tick ${count} receipt names a different state` };
      if (fingerprint(b.payload.lockedPair) !== fingerprint(ag.locked.hashes)) return { ok: false, reason: `seat ${s}'s Tick ${count} receipt names a different locked pair` };
      if (fingerprint(b.payload.outcome ?? null) !== fingerprint(state.outcome ?? null)) return { ok: false, reason: `seat ${s}'s Tick ${count} receipt names a different outcome` };
    }
    ticks++;
  }
  for (const s of ['A', 'B']) if (cur[s] !== recs[s].length) return { ok: false, reason: `seat ${s} has ${recs[s].length - cur[s]} record(s) after the final receipt` };
  const sum = summarize(events, state);
  const metrics = { ticks, mints: sum.mints, manaBurned: sum.manaBurned, casualties: sum.casualties, supplyLoadedUnits: { A: Math.round(sum.supplyLoaded.A * 1e6), B: Math.round(sum.supplyLoaded.B * 1e6) }, engagements: sum.engagements };
  return { ok: true, outcome: state.outcome ?? null, finalStateHash: stateFingerprint(state), ticks, metrics };
}

const bad = (status, reason) => ({ ok: false, status, reason });

/** Which public bucket a verified result belongs to (separate totals per bucket). */
export function bucketOf(controllers) {
  const k = [controllers.A, controllers.B].sort().join('-');
  return k === 'human-human' ? 'human-vs-human' : k === 'bot-human' ? 'human-vs-bot' : k === 'bot-bot' ? 'bot-vs-bot' : 'other';
}

export { other };
