// Response 10: review 08's actual-rules diagnostics re-run against the repair, asserting the
// corrected invariants (member conservation, unique slots, permission = allocation, bot Knight
// eligibility, peer edit sequence). Writes nothing; run from the repository root:
//   node docs/reviews/evidence/2026-11-24/response-10/acceptance-probe.mjs
import assert from 'node:assert/strict';
import { createSession, createFixtureSession, openTick, closeTick, verifyReplay } from '../../../../../src/hapa/rules/session.js';
import { DEFAULT_PROFILE_ID, profileById } from '../../../../../fixtures/hapa/profiles.js';
import { CATALOG } from '../../../../../fixtures/hapa/content.js';
import { scenario } from '../../../../../fixtures/hapa/scenarios.js';
import { routeFromHere, routeClearance } from '../../../../../src/hapa/rules/movement.js';
import { validatePlan, beginCount, resolveTick } from '../../../../../src/hapa/rules/match.js';
import { supplyOf } from '../../../../../src/hapa/rules/economy.js';
import { killMember } from '../../../../../src/hapa/rules/combat.js';
import { HeuristicBot } from '../../../../../src/hapa/controllers/heuristic-bot.js';
import { createManifest, initializeMatch, stateFingerprint } from '../../../../../src/hapa/rules/state.js';
import { createContext } from '../../../../../src/hapa/rules/context.js';
import { fingerprint } from '../../../../../src/hapa/rules/encoding.js';
import { Peer } from '../../../../../src/hapa/protocol/peer.js';

const pass = () => ({ pass: true });
const move = (id, column, row, extra = {}) => [{ type: 'set_destination', partyId: id, target: { column, row }, ...extra }];
const commanders = [
  { id: 'A.commander', owner: 'A', column: 1, row: 1, mount: 'commander', commander: true, slots: { 5: 'center' } },
  { id: 'B.commander', owner: 'B', column: 9, row: 10, mount: 'commander', commander: true, slots: { 5: 'center' } },
];
const fixture = (id, parties, profileId = DEFAULT_PROFILE_ID) => createFixtureSession(scenario({ matchId: id, profileId, keep: [], parties: [...parties, ...commanders] }), { id, title: 'Response 10 diagnostic fixture' });
const activate = (s, col) => { openTick(s); while (!s.state.activeColumns.includes(col)) { closeTick(s, { A: [], B: [] }, pass); openTick(s); } };
const composition = (s, id) => { const p = s.state.parties[id]; const owned = Object.values(s.state.members).filter((m) => m.alive && m.party === id).map((m) => m.id).sort(); const slotted = Object.entries(p.slots).filter(([, m]) => m && s.state.members[m].alive).map(([k, m]) => `${k}:${m}`); return { ownedAlive: owned.length, referenced: slotted.length, slots: slotted }; };
const out = { defaultProfile: DEFAULT_PROFILE_ID, kind: 'actual headless rules (peer: exact Peer class, in-process verified inbox; no Hypercore transport)' };

for (const profileId of [DEFAULT_PROFILE_ID, 'hapa_open_10x9_v3_06']) {
  const m = fixture(`r10-two-${profileId}`, [
    { id: 'A.q', owner: 'A', column: 3, row: 4, mount: 'queen', supply: 3, slots: { 5: 'center' } },
    { id: 'A.p1', owner: 'A', column: 3, row: 5, slots: { 1: 'swordsman', 2: 'swordsman' } },
    { id: 'A.p2', owner: 'A', column: 3, row: 6, slots: { 1: 'swordsman', 2: 'swordsman' } },
  ], profileId);
  activate(m, 3);
  const ev = [...closeTick(m, { A: move('A.q', 3, 7), B: [] }, pass).events];
  for (let i = 0; i < 2; i++) { openTick(m); ev.push(...closeTick(m, { A: [], B: [] }, pass).events); }
  (out.successivePawns ??= {})[profileId] = { ...composition(m, 'A.q'), assignments: ev.filter((e) => e.type === 'parties_merged').map((e) => e.moved.map((x) => `${x.from}->${x.to}`)), replay: verifyReplay(m.replay).ok };
}
assert.deepEqual([out.successivePawns[DEFAULT_PROFILE_ID].ownedAlive, out.successivePawns[DEFAULT_PROFILE_ID].referenced], [5, 5]);

{
  const base = scenario({ matchId: 'r10-dead', profileId: DEFAULT_PROFILE_ID, keep: [], parties: [
    { id: 'A.q', owner: 'A', column: 3, row: 4, mount: 'queen', supply: 1, slots: { 1: 'swordsman', 2: 'swordsman', 3: 'swordsman', 4: 'pikeman', 5: 'center', 6: 'mage', 7: 'archer', 8: 'priest', 9: 'archer' } },
    { id: 'A.p', owner: 'A', column: 3, row: 5, slots: { 1: 'swordsman', 2: 'swordsman', 3: 'swordsman', 7: 'archer' } }, ...commanders] });
  for (const slot of [1, 2, 3, 4]) killMember(base.state, base.ctx, [], base.state.members[`A.q.s${slot}`], 'diagnostic casualty');
  const d = createFixtureSession(base, { id: 'r10-dead', title: 'Survivors absorb a Pawn' });
  activate(d, 3);
  const r = closeTick(d, { A: move('A.q', 3, 5), B: [] }, pass);
  out.casualtyRefill = { ...composition(d, 'A.q'), mergeFailed: r.events.filter((e) => e.type === 'merge_failed').length, pawnRetired: d.state.parties['A.p'].retired, assignment: r.events.find((e) => e.type === 'parties_merged')?.moved.map((x) => `${x.from}->${x.to}`), supply: supplyOf(d.state.parties['A.q']) / d.ctx.U, replay: verifyReplay(d.replay).ok };
  assert.deepEqual([out.casualtyRefill.ownedAlive, out.casualtyRefill.referenced, out.casualtyRefill.mergeFailed, out.casualtyRefill.pawnRetired], [9, 9, 0, true]);
}
{
  const q = createSession({ matchId: 'r10-open', profile: profileById(DEFAULT_PROFILE_ID), catalog: CATALOG, seed: 1 });
  for (let tick = 1; tick <= 6; tick++) { openTick(q); closeTick(q, { A: tick === 6 ? [6, 5, 4].map((c) => ({ type: 'load_supply', cardId: q.state.players.A.bank.minor[c], partyId: 'A.mount.C6' })).concat(move('A.mount.C6', 9, 4)) : [], B: [] }, pass); }
  const p = q.state.parties['A.mount.C6'];
  out.openingQueen = { region: `R${p.region.row}C${p.region.column}`, atCenter: p.x === q.ctx.geo.center(7, 2).x && p.y === q.ctx.geo.center(7, 2).y, supply: supplyOf(p) / q.ctx.U, pawnAbsorbed: !!q.state.parties['A.pawn.C7'].retired, ...composition(q, p.id), replay: verifyReplay(q.replay).ok };
}
{
  const b = fixture('r10-bot', [
    { id: 'A.k', owner: 'A', column: 3, row: 4, mount: 'knight', supply: 3, slots: { 5: 'center' } },
    ...[[3, 5], [3, 6], [4, 4], [2, 4]].map(([column, row], i) => ({ id: `A.h${i}`, owner: 'A', column, row, mount: 'castle', slots: { 5: 'center' } }))]);
  activate(b, 3);
  const k = b.state.parties['A.k'];
  const cmds = new HeuristicBot({ seat: 'A', seed: 1 }).plan(b.state, b.ctx);
  const order = cmds.find((c) => c.type === 'set_destination' && c.partyId === 'A.k');
  const path = order ? routeFromHere(b.state, b.ctx, k, order.target, order.via ?? null) : null;
  out.botKnight = { order, route: path?.route.map((n) => `R${n.row}C${n.column}`), clear: path ? routeClearance(b.state, b.ctx, k, path.path).clear : null, valid: validatePlan(b.state, b.ctx, 'A', cmds).ok };
  assert.ok(order && out.botKnight.clear && out.botKnight.valid);
}
{
  const manifest = createManifest({ matchId: 'r10-peer-edit', profile: profileById(DEFAULT_PROFILE_ID), catalog: CATALOG, seed: 1 });
  const peer = new Peer({ seat: 'A', manifest, controller: { plan: () => [], choose: () => ({ pass: true }) } });
  peer.state = initializeMatch(manifest); peer.ctx = createContext(manifest);
  const shadow = initializeMatch(manifest), sctx = createContext(manifest); beginCount(shadow, sctx);
  const prior = stateFingerprint(shadow), b2 = [{ type: 'burn', cardId: Object.values(shadow.players.B.bank.minor).find(Boolean) }];
  const g = resolveTick(shadow, sctx, { A: [], B: validatePlan(shadow, sctx, 'B', b2).accepted }); let st = g.next(); while (!st.done) st = g.next({ pass: true });
  const rec = (seq, type, payload) => ({ schemaVersion: 1, type, matchId: manifest.matchId, authorId: 'B', authorSequence: seq, count: 1, phaseId: 'plan', priorStateHash: prior, payload });
  peer.inbox.push(rec(1, 'plan', { planRevision: 1, commands: [] }), rec(2, 'plan', { planRevision: 2, commands: b2 }), rec(3, 'ready', { planRevision: 2, planHash: fingerprint(b2) }), rec(4, 'receipt', { stateHash: stateFingerprint(shadow), outcome: null, lockedPair: { A: fingerprint([]), B: fingerprint(b2) } }));
  const published = [];
  peer._publish = async function (type, count, phaseId, payload) { published.push({ type, payload }); return { schemaVersion: 1, type, matchId: manifest.matchId, authorId: 'A', authorSequence: ++this.sequence, count, phaseId, priorStateHash: this.priorHash, payload }; };
  await peer.playTick();
  out.peerEdit = { remoteSequence: ['plan r1', 'plan r2', 'ready r2'], ownReadies: published.filter((r) => r.type === 'ready').length, lockedPairInReceipt: published.find((r) => r.type === 'receipt').payload.lockedPair, receipts: peer.receipts, bBurnResolved: peer.state.cards[b2[0].cardId].state === 'burned', leftQueued: peer.inbox.length };
  assert.ok(out.peerEdit.receipts[0].agreed && out.peerEdit.bBurnResolved && out.peerEdit.leftQueued === 0);
}
console.log(JSON.stringify(out, null, 2));
