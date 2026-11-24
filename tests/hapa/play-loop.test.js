// Human-feedback addendum 03 / review 07: reachable recovery after a friendly-body obstruction,
// clear diagonals, one shared route/clearance fact for bots, and one own-plan Ready per seat.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSession, createFixtureSession, openTick, closeTick, verifyReplay } from '../../src/hapa/rules/session.js';
import { profileById, DEFAULT_PROFILE_ID } from '../../fixtures/hapa/profiles.js';
import { CATALOG } from '../../fixtures/hapa/content.js';
import { scenario } from '../../fixtures/hapa/scenarios.js';
import { quoteRoute, routeFromHere, routeClearance, legalDestinations } from '../../src/hapa/rules/movement.js';
import { validatePlan } from '../../src/hapa/rules/match.js';
import { supplyOf } from '../../src/hapa/rules/economy.js';
import { validateProfile } from '../../src/hapa/rules/validate.js';
import { createManifest } from '../../src/hapa/rules/state.js';
import { HeuristicBot } from '../../src/hapa/controllers/heuristic-bot.js';
import { PhaseAgreement, agreementPolicy } from '../../src/hapa/protocol/agreement.js';
import { createDevIdentity, publicIdentity } from '../../src/hapa/protocol/messages.js';
import { Peer } from '../../src/hapa/protocol/peer.js';

const pass = () => ({ pass: true });
const move = (partyId, column, row) => ({ type: 'set_destination', partyId, target: { column, row } });
const Q = 'A.mount.C6';
// the reviewed half-step obstruction exists under v3_03's body sweep (v3_04 travels center to center)
const V303 = 'hapa_open_10x9_v3_03';

/** The review 07 opening: Tick 6 loads C6, C5 and C4 into A's Queen and sends it to R4C9. */
function blockedOpening(profileId) {
  const s = createSession({ matchId: `loop-${profileId}`, profile: profileById(profileId), catalog: CATALOG, seed: 1 });
  let r;
  for (let tick = 1; tick <= 6; tick++) {
    openTick(s);
    const plans = { A: [], B: [] };
    if (tick === 6) plans.A = [6, 5, 4].map((c) => ({ type: 'load_supply', cardId: s.state.players.A.bank.minor[String(c)], partyId: Q })).concat(move(Q, 9, 4));
    r = closeTick(s, plans, pass);
    assert.deepEqual(r.rejected, { A: [], B: [] });
  }
  return { s, r };
}
/** A branch at the Queen's next eligible activation (Tick 13). */
function atNextActivation(s) {
  const d = createFixtureSession({ manifest: s.manifest, ctx: s.ctx, state: structuredClone(s.state) }, { id: 'recovery', title: 'Recovery branch from legal Tick 7 state' });
  openTick(d);
  let blockedEvents = 0;
  while (!d.state.activeColumns.includes(6)) { blockedEvents += closeTick(d, { A: [], B: [] }, pass).events.filter((e) => e.type === 'travel_blocked').length; openTick(d); }
  return { d, blockedEvents };
}

test('v3_03 declares reachable recovery and own-plan Ready; the default carries both forward', () => {
  const p = profileById(V303);
  assert.equal(DEFAULT_PROFILE_ID, 'hapa_open_10x9_v3_05');
  assert.equal(profileById(DEFAULT_PROFILE_ID).movement.recovery, 'reachable_segment_v1');
  assert.equal(agreementPolicy(profileById(DEFAULT_PROFILE_ID)), 'own_plan_ready_v1');
  assert.equal(p.movement.recovery, 'reachable_segment_v1');
  assert.equal(agreementPolicy(p), 'own_plan_ready_v1');
  assert.equal(validateProfile(p, CATALOG).ok, true);
  for (const [path, bad] of [['movement', { ...p.movement, recovery: 'teleport' }], ['planning', { agreement: 'ack_twice' }]]) {
    const q = { ...JSON.parse(JSON.stringify(p)), [path]: bad };
    assert.equal(validateProfile(q, CATALOG).ok, false);
  }
  assert.equal(agreementPolicy(profileById('hapa_open_10x9_v3_02')), 'pair_acknowledgment_v3');
});

test('the blocked Queen names its friendly obstruction once and keeps its destination and Supply', () => {
  const { s, r } = blockedOpening(V303);
  const q = s.state.parties[Q];
  assert.deepEqual([q.x / s.ctx.U, q.y / s.ctx.U, supplyOf(q) / s.ctx.U], [24, 4, 5.5]);
  assert.deepEqual(q.destination, { column: 9, row: 4 });
  const blocked = r.events.filter((e) => e.type === 'travel_blocked');
  assert.equal(blocked.length, 1);
  assert.equal(blocked[0].by, 'A.pawn.C6');
  assert.deepEqual(blocked[0].at, { column: 6, row: 2 });
  // the preview had the same answer before the order was given
  const fresh = createSession({ matchId: 'pre', profile: profileById(V303), catalog: CATALOG, seed: 1 });
  for (let t = 1; t <= 6; t++) { openTick(fresh); if (t < 6) closeTick(fresh, { A: [], B: [] }, pass); }
  const p0 = fresh.state.parties[Q];
  const c = routeClearance(fresh.state, fresh.ctx, p0, routeFromHere(fresh.state, fresh.ctx, p0, { column: 9, row: 4 }).path);
  assert.equal(c.clear, false);
  assert.equal(c.friendly, true);
  assert.equal(c.partyId, 'A.pawn.C6');
  assert.equal(c.along / fresh.ctx.U, 2);
  // waiting Ticks do not repeat the message
  const { blockedEvents } = atNextActivation(s);
  assert.equal(blockedEvents, 0);
  assert.equal(verifyReplay(s.replay).ok, true);
});

test('recovery: return to the start, merge with the Pawn, or finish the segment — real fractional quote and debit', () => {
  const { s } = blockedOpening(V303);
  // return to R1C6 (the territory it left; its region identity does not hide it)
  {
    const { d } = atNextActivation(s);
    const p = d.state.parties[Q];
    assert.ok(legalDestinations(d.state, d.ctx, p).some((x) => x.column === 6 && x.row === 1));
    const q = quoteRoute(d.state, d.ctx, p, { column: 6, row: 1 });
    assert.deepEqual([q.required / d.ctx.U, q.path], [0.5, [{ column: 6, row: 1 }]]);
    assert.equal(routeClearance(d.state, d.ctx, p, routeFromHere(d.state, d.ctx, p, { column: 6, row: 1 }).path).clear, true);
    const r = closeTick(d, { A: [move(Q, 6, 1)], B: [] }, pass);
    assert.deepEqual(r.rejected, { A: [], B: [] });
    assert.deepEqual([p.x / d.ctx.U, p.y / d.ctx.U, supplyOf(p) / d.ctx.U, p.state], [22, 2, 5, 'idle']);
    assert.equal(verifyReplay(d.replay).ok, true);
  }
  // merge into the Pawn at R2C6: back through the clear segment, then one orthogonal step
  {
    const { d } = atNextActivation(s);
    const p = d.state.parties[Q];
    const q = quoteRoute(d.state, d.ctx, p, { column: 6, row: 2 });
    assert.deepEqual([q.required / d.ctx.U, q.path], [1.5, [{ column: 6, row: 1 }, { column: 6, row: 2 }]]);
    assert.equal(validatePlan(d.state, d.ctx, 'A', [move(Q, 6, 2)]).ok, true);
    closeTick(d, { A: [move(Q, 6, 2)], B: [] }, pass);
    for (let i = 0; i < 2 && !d.state.parties['A.pawn.C6'].retired; i++) { openTick(d); closeTick(d, { A: [], B: [] }, pass); }
    assert.equal(d.state.parties['A.pawn.C6'].retired, true);
    assert.equal(supplyOf(p) / d.ctx.U, 4);
    assert.equal(verifyReplay(d.replay).ok, true);
  }
  // finishing the segment is not "already there"; it is quoted for its real half step
  {
    const { d } = atNextActivation(s);
    const q = quoteRoute(d.state, d.ctx, d.state.parties[Q], { column: 7, row: 2 });
    assert.equal(q.error, undefined);
    assert.equal(q.required / d.ctx.U, 0.5);
  }
});

test('v3_02 keeps its recorded nearest-node recovery (legacy dispatch)', () => {
  const { s } = blockedOpening('hapa_open_10x9_v3_02');
  const { d } = atNextActivation(s);
  const p = d.state.parties[Q];
  const before = [p.x, p.y];
  closeTick(d, { A: [move(Q, 6, 1)], B: [] }, pass);
  assert.deepEqual([p.x, p.y], before); // the reviewed defect, preserved for old matches
  assert.equal(p.blockedBy, undefined);
});

test('a clear Queen or Bishop crosses one diagonal territory in one Tick for one Supply', () => {
  for (const mount of ['queen', 'bishop']) {
    const d = createFixtureSession(scenario({ profileId: DEFAULT_PROFILE_ID, matchId: `clear-${mount}`, keep: [], parties: [
      { id: 'A.test', owner: 'A', column: 3, row: 4, mount, supply: 1, slots: { 4: 'pikeman', 5: 'center', 6: 'mage', 8: 'priest' } },
      { id: 'A.commander', owner: 'A', column: 1, row: 1, mount: 'commander', commander: true, slots: { 5: 'center' } },
      { id: 'B.commander', owner: 'B', column: 9, row: 10, mount: 'commander', commander: true, slots: { 5: 'center' } },
    ] }), { id: `clear-${mount}`, title: 'Clear flat diagonal' });
    openTick(d);
    while (!d.state.activeColumns.includes(3)) { closeTick(d, { A: [], B: [] }, pass); openTick(d); }
    const r = closeTick(d, { A: [move('A.test', 4, 5)], B: [] }, pass);
    assert.deepEqual(r.rejected, { A: [], B: [] });
    const p = d.state.parties['A.test'];
    assert.deepEqual([p.region, p.destination, supplyOf(p)], [{ column: 4, row: 5 }, null, 0]);
    assert.equal(verifyReplay(d.replay).ok, true);
  }
});

test('the bot does not order a route a friendly formation physically blocks', () => {
  const { s } = blockedOpening(V303);
  const { d } = atNextActivation(s);
  const bot = new HeuristicBot({ seat: 'A', seed: 3 });
  const cmds = bot.plan(d.state, d.ctx);
  const v = validatePlan(d.state, d.ctx, 'A', cmds);
  assert.equal(v.ok, true);
  for (const c of cmds.filter((x) => x.type === 'set_destination')) {
    const p = d.state.parties[c.partyId];
    const k = routeClearance(d.state, d.ctx, p, routeFromHere(d.state, d.ctx, p, c.target).path);
    assert.ok(k.clear || !k.friendly, `${c.partyId} → R${c.target.row}C${c.target.column} is blocked by ${k.partyId}`);
  }
});

const rec = (author, seq, type, payload) => ({ schemaVersion: 1, type, matchId: 'm', authorId: author, signingKeyId: 'k', authorSequence: seq, count: 1, phaseId: 'plan', priorStateHash: 'sha256:x', payload });

test('own-plan Ready: A Ready, B edits, B Ready locks the final pair with one commitment per seat', () => {
  const ag = new PhaseAgreement({ matchId: 'm', count: 1, phaseId: 'plan', priorStateHash: 'sha256:x', policy: 'own_plan_ready_v1' });
  ag.receive('A', rec('a', 1, 'plan', { planRevision: 1, commands: [{ type: 'burn', cardId: 'x' }] }));
  ag.receive('B', rec('b', 1, 'plan', { planRevision: 1, commands: [] }));
  assert.equal(ag.receive('A', rec('a', 2, 'ready', ag.readyPayload('A'))).locked, null);
  ag.receive('B', rec('b', 2, 'plan', { planRevision: 2, commands: [{ type: 'concede' }] }));
  assert.equal(ag.stale('A'), false);
  assert.equal(ag.current('A'), true);
  const l = ag.receive('B', rec('b', 3, 'ready', ag.readyPayload('B')));
  assert.deepEqual(l.locked.B, [{ type: 'concede' }]);
  assert.deepEqual(l.locked.revisions, { A: 1, B: 2 });
  // the own plan is frozen, a second Ready and later messages have no effect
  assert.equal(ag.receive('A', rec('a', 3, 'plan', { planRevision: 2, commands: [] })).ok, false);
  assert.equal(ag.receive('A', rec('a', 4, 'ready', ag.readyPayload('A'))).ok, false);
  assert.equal(ag.receive('A', rec('a', 2, 'ready', { planRevision: 1, planHash: ag.plans.A.hash })).duplicate, true);
});

test('own-plan Ready refuses a Ready naming another revision; unknown policies are refused', () => {
  const ag = new PhaseAgreement({ matchId: 'm', count: 1, phaseId: 'plan', priorStateHash: 'sha256:x', policy: 'own_plan_ready_v1' });
  ag.receive('A', rec('a', 1, 'plan', { planRevision: 1, commands: [] }));
  assert.equal(ag.receive('A', rec('a', 2, 'ready', { planRevision: 0, planHash: 'sha256:old' })).ok, false);
  assert.throws(() => new PhaseAgreement({ matchId: 'm', count: 1, phaseId: 'plan', priorStateHash: 'x', policy: 'read_receipt' }), /unknown agreement policy/);
  assert.throws(() => createManifest({ matchId: 'bad', profile: { ...profileById(DEFAULT_PROFILE_ID), planning: { agreement: 'read_receipt' } }, catalog: CATALOG, seed: 1 }));
});

test('two peers on the default profile commit own plans, bind the locked pair in receipts and agree', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'hapa-versus-own-ready-'));
  const idA = createDevIdentity('own-a'), idB = createDevIdentity('own-b');
  const manifest = createManifest({ matchId: 'own-ready', profile: profileById(DEFAULT_PROFILE_ID), catalog: CATALOG, seed: 3,
    participants: { A: publicIdentity(idA), B: publicIdentity(idB) },
    controllers: { A: { type: 'bot', revision: 'heuristic-bot/0.1.0' }, B: { type: 'bot', revision: 'heuristic-bot/0.1.0' } } });
  const pa = new Peer({ seat: 'A', identity: idA, opponent: publicIdentity(idB), storage: join(dir, 'A'), manifest: JSON.parse(JSON.stringify(manifest)), controller: new HeuristicBot({ seat: 'A', seed: 5 }) });
  const pb = new Peer({ seat: 'B', identity: idB, opponent: publicIdentity(idA), storage: join(dir, 'B'), manifest: JSON.parse(JSON.stringify(manifest)), controller: new HeuristicBot({ seat: 'B', seed: 6 }) });
  const [ka, kb] = await Promise.all([pa.open(), pb.open()]);
  await pa.attachRemote(kb); await pb.attachRemote(ka);
  const sa = pa.replicate(true), sb = pb.replicate(false);
  sa.pipe(sb).pipe(sa);
  for (let i = 0; i < 8; i++) await Promise.all([pa.playTick(), pb.playTick()]);
  assert.ok(pa.receipts.every((r) => r.agreed) && pb.receipts.every((r) => r.agreed));
  assert.equal(pa.receipts.at(-1).hash, pb.receipts.at(-1).hash);
  // exactly one Ready per seat per Tick in each log
  const readies = [];
  for (let i = 0; i < pa.own.length; i++) { const r = await pa.own.get(i); if (r.body.type === 'ready') readies.push(r.body.count); }
  assert.equal(readies.length, 8);
  assert.equal(new Set(readies).size, 8);
  await pa.close(); await pb.close();
  rmSync(dir, { recursive: true, force: true });
});
