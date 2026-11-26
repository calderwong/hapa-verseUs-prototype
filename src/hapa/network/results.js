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
import { prefixRoot } from './prefix.js';
import b4a from 'b4a';

/** v2 binds authenticated feed prefixes and both terminal attestations; v1 bundles are legacy. */
export const RESULT_SCHEMA = 'hapa-versus-result/v2';
export const LEGACY_SCHEMAS = ['hapa-versus-result/v1'];
export const METRICS_VERSION = 'summarize_v1';
export const MAX_BUNDLE_BYTES = 64 * 1024 * 1024;

/** The stable identity of a result: network + match. Equivalent repackaging keeps it. */
export const resultKey = (network, matchId) => `${network}/${matchId}`;

/**
 * Build a v2 bundle from a participant's store: the signed session, the manifest, each seat's exact
 * game-input prefix as raw stored blocks (key, fork, length, root) and both terminal attestations.
 * @param {{ session: any, evidence: { prefixes: any, blocks: any, attestations: any } }} o
 */
export function buildBundle({ session, evidence }) {
  const enc = (buf) => b4a.toString(buf, 'base64');
  const transcript = {}, attestations = {};
  for (const s of ['A', 'B']) {
    const p = evidence.prefixes[s];
    transcript[s] = { feedKey: p.key, fork: p.fork, length: p.length, root: p.root, blocks: evidence.blocks[s].map(enc) };
    attestations[s] = { index: evidence.attestations[s].index, block: enc(evidence.attestations[s].block) };
  }
  return { schema: RESULT_SCHEMA, network: session.descriptor.network, matchId: session.descriptor.matchId, session: { descriptor: session.descriptor, sigs: session.sigs }, manifest: session.manifest, transcript, attestations };
}

/** The canonical result commitment: session, computed outcome/state and transcript boundaries. */
export function commitmentOf(v) {
  return fingerprint({ network: v.network, matchId: v.matchId, descriptor: v.descriptorHash, outcome: v.outcome, finalStateHash: v.finalStateHash, prefixes: v.prefixes });
}

/**
 * Verify a bundle completely. Returns `{ ok: true, ... }` with the calculated result, or
 * `{ ok: false, status, reason }` where status is `invalid` (forged, inconsistent) or `unsupported`
 * (a rules implementation this verifier cannot run). Never returns a claimed value unchecked.
 */
export function verifyBundle(bundle) {
  try {
    if (bundle && LEGACY_SCHEMAS.includes(bundle.schema)) return bad('legacy', 'v1 evidence has no authenticated prefixes or terminal attestations; it keeps its bytes but does not count');
    if (!bundle || bundle.schema !== RESULT_SCHEMA) return bad('invalid', 'unknown result schema');
    const size = canonicalize(bundle).length;
    if (size > MAX_BUNDLE_BYTES) return bad('invalid', `bundle of ${size} bytes exceeds the cap`);
    const d = bundle.session?.descriptor, sigs = bundle.session?.sigs, manifest = bundle.manifest;
    if (!d || d.online !== ONLINE_PROTOCOL || d.network !== bundle.network || d.matchId !== bundle.matchId) return bad('invalid', 'session does not match the bundle');
    // identity, established from the keys themselves (never from the archive that delivered it)
    const players = { A: manifest?.participants?.A, B: manifest?.participants?.B };
    for (const s of ['A', 'B']) {
      const dp = d.players?.[s], mp = players[s];
      if (!dp || !/^[0-9a-f]{64}$/.test(dp.publicKey ?? '') || dp.participantId !== `hv1:${dp.publicKey}`) return bad('invalid', `seat ${s} is not a canonical player key`);
      if (!mp || mp.participantId !== dp.participantId || mp.publicKey !== dp.publicKey || mp.signingKeyId !== `ed25519:${dp.publicKey}` || mp.identityKind !== 'hapa_versus_player_key_v1') return bad('invalid', `manifest seat ${s} differs from the session identity`);
      if (!/^[0-9a-f]{64}$/.test(d.feeds?.[s] ?? '')) return bad('invalid', `seat ${s} has no valid feed key`);
    }
    if (d.players.A.participantId === d.players.B.participantId || d.feeds.A === d.feeds.B) return bad('invalid', 'the two seats are not distinct');
    for (const s of ['A', 'B']) if (!verifyBody('session', d, sigs?.[s], d.players[s].publicKey)) return bad('invalid', `session consent of seat ${s} is missing or invalid`);
    if (d.rulesImplementation !== rulesImplementation()) return bad('unsupported', 'recorded with a rules implementation this build cannot verify');
    const me = manifestError(manifest, { matchId: d.matchId, players: { A: { ...d.players.A, signingKeyId: `ed25519:${d.players.A.publicKey}` }, B: { ...d.players.B, signingKeyId: `ed25519:${d.players.B.publicKey}` } } });
    if (me) return bad('invalid', me);
    if (fingerprint(manifest) !== d.manifestHash || initialStateHash(manifest) !== d.initialStateHash) return bad('invalid', 'manifest or initial state differs from the session');
    // each exact feed prefix: the supplied block bytes must produce the claimed Merkle root
    const recs = {}, prefixes = {};
    for (const s of ['A', 'B']) {
      const t = bundle.transcript?.[s];
      if (!t || t.feedKey !== d.feeds[s] || !Number.isSafeInteger(t.fork) || t.fork < 0 || !Array.isArray(t.blocks) || t.blocks.length !== t.length || t.length < 1 || !/^[0-9a-f]{64}$/.test(t.root ?? '')) return bad('invalid', `transcript of seat ${s} is missing or inconsistent`);
      const raw = t.blocks.map((x) => b4a.from(String(x), 'base64'));
      if (prefixRoot(raw) !== t.root) return bad('invalid', `seat ${s}'s blocks do not produce the claimed prefix root`);
      recs[s] = [];
      for (let i = 0; i < raw.length; i++) {
        let rec;
        try { rec = JSON.parse(b4a.toString(raw[i])); } catch { return bad('invalid', `seat ${s} block ${i} is not a record`); }
        const r = admitRecord(rec, { matchId: d.matchId, author: players[s], index: i, maxCount: 10_000 });
        if (!r.ok) return bad('invalid', `seat ${s} record ${i}: ${r.error}`);
        recs[s].push(r.body);
      }
      prefixes[s] = { key: t.feedKey, fork: t.fork, length: t.length, root: t.root };
    }
    // both terminal attestations: outside their prefixes, naming this session and both prefixes
    const att = {};
    for (const s of ['A', 'B']) {
      const a = bundle.attestations?.[s];
      if (!a || a.index !== prefixes[s].length) return bad('invalid', `seat ${s}'s attestation is missing or not directly after its prefix`);
      let rec;
      try { rec = JSON.parse(b4a.toString(b4a.from(String(a.block), 'base64'))); } catch { return bad('invalid', `seat ${s}'s attestation is not a record`); }
      const r = admitRecord(rec, { matchId: d.matchId, author: players[s], index: a.index, maxCount: 10_000 });
      if (!r.ok) return bad('invalid', `seat ${s}'s attestation: ${r.error}`);
      const p = r.body.payload;
      if (r.body.type !== 'closing' || p.v !== 2 || p.descriptorHash !== fingerprint(d) || fingerprint(p.prefixes ?? null) !== fingerprint(prefixes)) return bad('invalid', `seat ${s}'s attestation does not name this session and both prefixes`);
      att[s] = p;
    }
    if (att.A.finalHash !== att.B.finalHash || fingerprint(att.A.outcome ?? null) !== fingerprint(att.B.outcome ?? null)) return bad('invalid', 'the two attestations name different outcomes');
    const run = replayRecords(manifest, recs);
    if (!run.ok) return bad('invalid', run.reason);
    const outcome = run.outcome;
    if (!outcome) return bad('unfinished', 'the transcript ends without a rules-defined result');
    if (fingerprint(att.A.outcome) !== fingerprint(outcome) || att.A.finalHash !== run.finalStateHash) return bad('invalid', 'the attested outcome differs from the calculated one');
    const v = { network: bundle.network, matchId: bundle.matchId, descriptorHash: fingerprint(d), outcome, finalStateHash: run.finalStateHash, prefixes };
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
      if (!b || b.type !== 'choice' || b.count !== count || b.phaseId !== req.choiceId || b.priorStateHash !== prior || b.payload.choiceId !== req.choiceId || b.payload.choiceIndex !== index || b.payload.requestHash !== fingerprint(req)) return { ok: false, reason: `Tick ${count}: seat ${req.seat}'s choice ${req.choiceId} is missing or bound to another request` };
      step = gen.next(b.payload.answer);
      index++;
    }
    events.push(...step.value);
    const hash = stateFingerprint(state);
    for (const s of ['A', 'B']) {
      const b = take(s);
      if (!b || b.type !== 'receipt' || b.count !== count || b.phaseId !== 'receipt' || b.priorStateHash !== prior) return { ok: false, reason: `seat ${s} has no receipt for Tick ${count} in its context` };
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
