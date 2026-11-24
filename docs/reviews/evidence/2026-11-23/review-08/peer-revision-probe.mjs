// Review-only probe: execute the exact Peer class text; replace its Hypercore I/O
// with a verified-body inbox. Rules, profile and PhaseAgreement are actual source.
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createContext } from '../../../../../src/hapa/rules/context.js';
import { initializeMatch, createManifest, stateFingerprint } from '../../../../../src/hapa/rules/state.js';
import { beginCount, validatePlan, resolveTick } from '../../../../../src/hapa/rules/match.js';
import { fingerprint } from '../../../../../src/hapa/rules/encoding.js';
import { PhaseAgreement, agreementPolicy } from '../../../../../src/hapa/protocol/agreement.js';
import { profileById, DEFAULT_PROFILE_ID } from '../../../../../fixtures/hapa/profiles.js';
import { CATALOG } from '../../../../../fixtures/hapa/content.js';

const text = readFileSync(new URL('../../../../../src/hapa/protocol/peer.js', import.meta.url), 'utf8');
const body = text.slice(text.indexOf('export class Peer')).replace('export class Peer', 'class Peer');
const Peer = new Function('beginCount', 'stateFingerprint', 'agreementPolicy', 'PhaseAgreement', 'validatePlan', 'resolveTick', `${body}\nreturn Peer;`)(beginCount, stateFingerprint, agreementPolicy, PhaseAgreement, validatePlan, resolveTick);
const manifest = createManifest({ matchId: 'review-r08-peer-revision', profile: profileById(DEFAULT_PROFILE_ID), catalog: CATALOG, seed: 1 });
const state = initializeMatch(manifest), ctx = createContext(manifest);
const peer = new Peer({ seat: 'A', manifest, controller: { plan: () => [], choose: () => ({ pass: true }) } });
peer.state = state; peer.ctx = ctx;
const outgoing = [], consumed = [];
peer._publish = async function(type, count, phaseId, payload) {
  const r = { schemaVersion: 1, type, matchId: manifest.matchId, authorId: 'A', authorSequence: ++this.sequence, count, phaseId, priorStateHash: this.priorHash, payload };
  outgoing.push(r); return r;
};
// Simulate the ordered, already-verified remote log arriving: revision 1,
// revision 2, then B's sole Ready for revision 2. The second plan burns a real
// available opening Card, so this is an ordinary legal public edit.
peer._take = async function(pred) {
  if (!this.inbox.length && !consumed.length) {
    const rec = (seq, type, payload) => ({ schemaVersion: 1, type, matchId: manifest.matchId, authorId: 'B', authorSequence: seq, count: this.state.tick, phaseId: 'plan', priorStateHash: this.priorHash, payload });
    const commands = [{ type: 'burn', cardId: Object.values(this.state.players.B.bank.minor).find(Boolean) }];
    assert.equal(validatePlan(this.state, this.ctx, 'B', commands).ok, true);
    this.inbox.push(rec(1, 'plan', { planRevision: 1, commands: [] }), rec(2, 'plan', { planRevision: 2, commands }), rec(3, 'ready', { planRevision: 2, planHash: fingerprint(commands) }));
  }
  const i = this.inbox.findIndex(pred);
  assert.ok(i >= 0, 'probe has a matching record');
  const record = this.inbox.splice(i, 1)[0]; consumed.push(record); return record;
};
let failure;
try { await peer.playTick(); } catch (error) { failure = error.message; }
assert.match(failure, /Ready names its own revision 2, current is 1/);
assert.deepEqual(consumed.map(r => [r.type, r.payload.planRevision]), [['plan', 1], ['ready', 2]]);
assert.deepEqual(peer.inbox.map(r => [r.type, r.payload.planRevision]), [['plan', 2]]);
const control = new PhaseAgreement({ matchId: manifest.matchId, count: state.tick, phaseId: 'plan', priorStateHash: peer.priorHash, policy: agreementPolicy(manifest.profile) });
for (const r of outgoing) assert.equal(control.receive('A', r).ok, true);
for (const r of [consumed[0], peer.inbox[0], consumed[1]]) assert.equal(control.receive('B', r).ok, true);
assert.deepEqual(control.locked.revisions, { A: 1, B: 2 });
const result = { snapshot: 'f7c4f0f69afbc22458c400f01521e5b468f5f602', defaultProfile: DEFAULT_PROFILE_ID, execution: 'Exact Peer class source and real rules/PhaseAgreement; only transport publication/verified inbox replaced', error: failure, consumed: consumed.map(r => [r.type, r.payload.planRevision]), leftQueued: peer.inbox.map(r => [r.type, r.payload.planRevision]), ownReadyCount: outgoing.filter(r => r.type === 'ready').length, directAgreementControl: { locked: !!control.locked, revisions: control.locked.revisions } };
console.log(JSON.stringify(result, null, 2));
writeFileSync(new URL('peer-revision-results.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
