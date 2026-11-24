// Historical Review 09 probe. Prints results; does not overwrite committed evidence.
// Review evidence only. Source snapshot is unmodified. Execute exact Peer class
// text with real rules/PhaseAgreement and a preverified in-process inbox. Only
// publication is stubbed; _take/playTick remain the repository implementation.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createContext } from '../../../../../src/hapa/rules/context.js';
import { initializeMatch, createManifest, stateFingerprint } from '../../../../../src/hapa/rules/state.js';
import { beginCount, validatePlan, resolveTick } from '../../../../../src/hapa/rules/match.js';
import { fingerprint } from '../../../../../src/hapa/rules/encoding.js';
import { PhaseAgreement, agreementPolicy } from '../../../../../src/hapa/protocol/agreement.js';
import { profileById, DEFAULT_PROFILE_ID } from '../../../../../fixtures/hapa/profiles.js';
import { CATALOG } from '../../../../../fixtures/hapa/content.js';
import { launchURL, resolveLaunch } from '../../../../../src/hapa/presentation/dev-preset.js';

const source = readFileSync(new URL('../../../../../src/hapa/protocol/peer.js', import.meta.url), 'utf8');
const cls = source.slice(source.indexOf('export class Peer')).replace('export class Peer', 'class Peer');
const Peer = new Function('beginCount', 'stateFingerprint', 'agreementPolicy', 'PhaseAgreement', 'validatePlan', 'resolveTick', `${cls}\nreturn Peer;`)(beginCount, stateFingerprint, agreementPolicy, PhaseAgreement, validatePlan, resolveTick);
const profile = profileById(DEFAULT_PROFILE_ID);
const results = { snapshot: '2d8a5ff2a1c5686101b3dc3c2c8e0cee33c6df4f', profile: DEFAULT_PROFILE_ID, execution: 'In-process exact Peer class; real _take/playTick, rules and PhaseAgreement; no Hypercore socket or signature verification', peer: [] };

async function peerCase(label, transform = records => records, expectedError = null) {
  const manifest = createManifest({ matchId: `r09-${label}`, profile, catalog: CATALOG, seed: 1 });
  const peer = new Peer({ seat: 'A', manifest, controller: { plan: () => [], choose: () => ({ pass: true }) } });
  peer.state = initializeMatch(manifest); peer.ctx = createContext(manifest);
  const shadow = initializeMatch(manifest), sctx = createContext(manifest);
  beginCount(shadow, sctx);
  const prior = stateFingerprint(shadow), burnId = Object.values(shadow.players.B.bank.minor).find(Boolean);
  const b2 = [{ type: 'burn', cardId: burnId }];
  assert.equal(validatePlan(shadow, sctx, 'B', b2).ok, true);
  const rec = (seq, type, payload, phaseId = 'plan') => ({ schemaVersion: 1, type, matchId: manifest.matchId, authorId: 'B', authorSequence: seq, count: 1, phaseId, priorStateHash: prior, payload });
  const gen = resolveTick(shadow, sctx, { A: [], B: validatePlan(shadow, sctx, 'B', b2).accepted });
  let step = gen.next(); while (!step.done) step = gen.next({ pass: true });
  const lockedPair = { A: fingerprint([]), B: fingerprint(b2) };
  peer.inbox.push(...transform([rec(1, 'plan', { planRevision: 1, commands: [] }), rec(2, 'plan', { planRevision: 2, commands: b2 }), rec(3, 'ready', { planRevision: 2, planHash: fingerprint(b2) }), rec(4, 'receipt', { stateHash: stateFingerprint(shadow), outcome: null, lockedPair }, 'receipt')]));
  const published = [];
  peer._publish = async function(type, count, phaseId, payload) {
    const record = { schemaVersion: 1, type, matchId: manifest.matchId, authorId: 'A', authorSequence: ++this.sequence, count, phaseId, priorStateHash: this.priorHash, payload };
    published.push(record); return record;
  };
  if (expectedError) {
    let error;
    try { await peer.playTick(); } catch (e) { error = e.message; }
    assert.match(error, expectedError);
    assert.equal(peer.receipts.length, 0);
    assert.notEqual(peer.state.cards[burnId].state, 'burned');
    results.peer.push({ case: label, passed: true, error, noReceiptOrBurn: true });
  } else {
    const out = await peer.playTick();
    assert.equal(out.count, 1);
    assert.equal(published.filter(r => r.type === 'ready').length, 1);
    assert.deepEqual(published.find(r => r.type === 'receipt').payload.lockedPair, lockedPair);
    assert.equal(peer.state.cards[burnId].state, 'burned');
    assert.equal(peer.receipts.length, 1);
    assert.equal(peer.receipts[0].agreed, true);
    assert.equal(peer.inbox.length, 0);
    results.peer.push({ case: label, passed: true, ownReadyCount: 1, agreedReceiptCount: 1, editedCardBurned: true, queued: 0 });
  }
}
await peerCase('edited-plan');
await peerCase('duplicate-plan', records => [records[0], structuredClone(records[0]), ...records.slice(1)]);
await peerCase('wrong-phase', records => records.map((r, i) => i === 1 ? { ...r, phaseId: 'other-phase' } : r), /another phase/);
await peerCase('wrong-match', records => records.map((r, i) => i === 1 ? { ...r, matchId: 'other-match' } : r), /another phase/);
await peerCase('wrong-prior-state', records => records.map((r, i) => i === 1 ? { ...r, priorStateHash: 'sha256:not-the-state' } : r), /prior state hash differs/);

// The unchanged agreement still refuses an own edit after Ready, holds the
// commitment through an opponent edit, and accepts an identical retransmission.
const ag = new PhaseAgreement({ matchId: 'freeze', count: 1, phaseId: 'plan', priorStateHash: 'sha256:prior', policy: agreementPolicy(profile) });
const r = (seat, n, type, payload) => ({ type, matchId: 'freeze', count: 1, phaseId: 'plan', priorStateHash: 'sha256:prior', authorId: seat, authorSequence: n, payload });
assert.equal(ag.receive('A', r('A', 1, 'plan', { planRevision: 1, commands: [] })).ok, true);
const readyA = r('A', 2, 'ready', ag.readyPayload('A'));
assert.equal(ag.receive('A', readyA).ok, true);
assert.match(ag.receive('A', r('A', 3, 'plan', { planRevision: 2, commands: [] })).error, /frozen/);
assert.equal(ag.receive('B', r('B', 1, 'plan', { planRevision: 1, commands: [] })).ok, true);
assert.equal(ag.receive('B', r('B', 2, 'plan', { planRevision: 2, commands: [] })).ok, true);
assert.equal(ag.current('A'), true);
assert.equal(ag.receive('B', r('B', 3, 'ready', ag.readyPayload('B'))).ok, true);
assert.deepEqual(ag.locked.revisions, { A: 1, B: 2 });
assert.equal(ag.receive('A', readyA).duplicate, true);
assert.match(ag.receive('B', r('B', 4, 'plan', { planRevision: 3, commands: [] })).error, /already locked/);
results.agreement = { passed: true, ownEditFrozen: true, opponentEditDoesNotRevoke: true, duplicateReadyNoEffect: true, lockedRevisionPair: ag.locked.revisions, postLockEditRefused: true };

const app = readFileSync(new URL('../../../../../src/hapa/presentation/app.js', import.meta.url), 'utf8');
const expression = app.match(/const url = (launchURL\([^\n]+\));/)[1];
const effective = { seats: { A: 'human', B: 'bot' }, seed: 1, profileId: DEFAULT_PROFILE_ID, fixture: null };
const link = new Function('c', 'launchURL', `return ${expression};`).call({ ctx: { profile } }, effective, launchURL);
const legacy = { a: 'bot', b: 'human', seed: 7, profile: 'hapa_open_10x9_v3_02' };
const opened = resolveLaunch(link.split('?')[1], legacy, { profileOk: id => !!profileById(id) });
assert.equal(opened.config.profileId, DEFAULT_PROFILE_ID);
assert.deepEqual(opened.config.seats, effective.seats);
assert.equal(opened.config.seed, 1);
assert.equal(opened.sources.profile, 'url');
const bare = resolveLaunch('autostart=1&a=human&b=bot&seed=1', legacy);
assert.equal(bare.config.profileId, legacy.profile);
results.launch = { passed: true, expression, copiedLink: link, withSavedLegacyPreset: opened.config, bareURLRetainsSavedProfile: bare.config.profileId };
console.log(JSON.stringify(results, null, 2));
