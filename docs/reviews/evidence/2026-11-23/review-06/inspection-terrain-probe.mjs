// Review-only probes against the checked-in implementation. No production files are changed.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const repo = process.argv[2] ? pathToFileURL(`${resolve(process.argv[2])}/`) : new URL('../../../../../', import.meta.url);
const [ { scenario }, { runTick }, { applyCardHit }, { memberFacts, partyFacts, partyLineProtection, healthAt }, { solidAt, surfaceBand, cellKey, workError, startWork, completeWork } ] = await Promise.all([
  import(new URL('fixtures/hapa/scenarios.js', repo)), import(new URL('src/hapa/rules/match.js', repo)),
  import(new URL('src/hapa/rules/combat.js', repo)), import(new URL('src/hapa/rules/inspection.js', repo)),
  import(new URL('src/hapa/rules/terrain.js', repo)),
]);

const clone = structuredClone, U = 1_000_000;
const evidence = { head: '53481b90f0909f16108b30b163acb69c8649d6ea', implementation: '95c88bf3dbb412df8388f99391ed293d5ae6ed44', scope: 'Headless actual-rules probes; no browser or visual acceptance claimed', cases: {} };

// Default profile: a living Mage's party ward must still apply in an earlier playback frame.
{
  const fx = scenario({ profileId: 'hapa_open_10x9_v3_02', parties: [
    { id: 'A.p', owner: 'A', mount: 'queen', column: 5, row: 5, slots: { 5: 'center', 2: 'swordsman' }, supply: 1 },
    { id: 'B.p', owner: 'B', mount: 'castle', column: 5, row: 6, slots: { 5: 'center', 2: 'mage', 8: 'archer' }, supply: 1 },
  ] });
  const { state, ctx } = fx;
  state.tick = 5; state.activeColumns = [5]; state.phase = 'planning';
  const before = clone(state);
  const priorArcher = memberFacts(before, ctx, 'B.p.s8');
  const { events } = runTick(state, ctx, { A: [{ type: 'set_destination', partyId: 'A.p', target: { column: 5, row: 6 } }], B: [] });
  const shownEvents = events.findIndex(e => e.type === 'contact');
  assert.equal(events[shownEvents].quantum, 250);
  const at = healthAt(before, events, shownEvents);
  const earlyArcher = memberFacts(state, ctx, 'B.p.s8', at);
  const earlyMage = memberFacts(state, ctx, 'B.p.s2', at);
  assert.equal(priorArcher.protection.magic.front.total, 1);
  assert.equal(earlyMage.alive, true);
  assert.equal(earlyArcher.protection.magic.front, undefined);
  assert.equal(partyFacts(before, ctx, 'B.p').living, 3);
  assert.equal(partyFacts(state, ctx, 'B.p').living, 2);
  evidence.cases.playback_ward = {
    profile: ctx.profile.id, events,
    shownEvents, beforeFirstContactQuantum: events[shownEvents].quantum, displayedMageAlive: earlyMage.alive, displayedMageHp: earlyMage.health.hp / U,
    expectedArcherMagicProtectionBeforeHit: priorArcher.protection.magic.front.total,
    actualArcherMagicProtectionBeforeHit: earlyArcher.protection.magic.front?.total ?? 0,
    expectedPartyLivingBeforeHit: 3, partyFactsLivingUsedByApp: partyFacts(state, ctx, 'B.p').living,
    conclusion: 'The earlier living Mage is paired with already-removed ward and final headcount. Only HP/alive is time-indexed.',
  };
}

// Existing pooled-health profile: current pool and maintenance headcount leak into an early frame.
{
  const fx = scenario({ profileId: 'hapa_open_10x9_v3_01_party_maintenance', parties: [{ id: 'B.p', owner: 'B', mount: 'castle', column: 5, row: 6, slots: { 5: 'center', 1: 'swordsman', 2: 'swordsman', 3: 'swordsman' } }] });
  const { state, ctx } = fx, before = clone(state), events = [];
  applyCardHit(state, ctx, events, { source: 'A.mount.C5', cardId: 'fixture.review.ember', recipientId: 'B.p.s5', channel: 'magic', power: 2, face: 'front' });
  const at = healthAt(before, events, 0);
  const f = memberFacts(state, ctx, 'B.p.s1', at);
  assert.equal(before.parties['B.p'].pool.hp, 15 * U);
  assert.equal(f.health.hp, 13 * U);
  assert.equal(f.alive, true);
  assert.equal(state.members['B.p.s1'].alive, false);
  evidence.cases.playback_pool = {
    profile: ctx.profile.id, events,
    shownEvents: 0, expectedPoolBeforeHit: 15, actualPoolBeforeHit: f.health.hp / U,
    displayedFirstRetainerAlive: f.alive, finalFirstRetainerAlive: state.members['B.p.s1'].alive,
    expectedPartyLivingBeforeHit: 4, partyFactsLivingUsedByApp: partyFacts(state, ctx, 'B.p').living,
    conclusion: 'memberFacts ignores the playback snapshot for party pools; partyFacts has no snapshot parameter.',
  };
}

// Actual exchange, not the inspection helper's own algorithm: three front shields stop swords.
{
  const slots = { 5: 'center', 1: 'swordsman', 2: 'swordsman', 3: 'swordsman' };
  const fx = scenario({ profileId: 'hapa_open_10x9_v3_01_line_attacker', parties: [
    { id: 'A.q', owner: 'A', mount: 'queen', column: 5, row: 5, slots, supply: 0.25 },
    { id: 'B.q', owner: 'B', mount: 'queen', column: 5, row: 6, slots, supply: 3 },
  ] });
  const { state, ctx } = fx;
  state.tick = 5; state.activeColumns = [5]; state.phase = 'planning';
  const initialMember = memberFacts(state, ctx, 'A.q.s2');
  const allMembersValue = partyLineProtection(state, ctx, 'A.q', 'physical', 'front');
  const r = runTick(state, ctx, { A: [{ type: 'set_destination', partyId: 'A.q', target: { column: 5, row: 6 } }], B: [] });
  const ex = r.events.find(e => e.type === 'exchange');
  const swords = ex.hits.filter(h => h.attack === 'sword');
  assert.ok(swords.length > 0);
  assert.ok(swords.every(h => h.protection === 3 && h.damage === 0));
  evidence.cases.line_defense = {
    profile: ctx.profile.id, memberLabelValue: initialMember.protection.physical.front.total,
    allMembersInspectionHelperValue: allMembersValue.total, actualAttackedFrontLineValue: 3,
    actualSwordHits: swords,
    conclusion: 'The label uses own contribution 1 as Def; the unused helper across all living members would return 4, while the actual front line has 3. A target line context is required for an applied value.',
  };
}

// Execute the checked-in diorama sync/update methods with drawing stubbed, since three is absent.
// The source itself provides the cache and visibility logic; the terrain mutations are real rules.
const source = await readFile(new URL('src/hapa/presentation/territory-diorama.js', repo), 'utf8');
const classSource = source.replace(/^import .*;$/gm, '').replace('export class TerritoryDiorama', 'class TerritoryDiorama');
class Group { constructor() { this.children = []; this.visible = true; } add(o) { this.children.push(o); } traverse(fn) { fn(this); for (const o of this.children) fn(o); } clear() { this.children = []; } }
const TerritoryDiorama = new Function('THREE', 'brushRng', 'solidAt', 'surfaceBand', 'territoryColors', `${classSource}\nreturn TerritoryDiorama;`)({ Group }, null, solidAt, surfaceBand, null);

{
  const fx = scenario({ profileId: 'hapa_open_10x9_v3_02', parties: [{ id: 'A.worker', owner: 'A', mount: 'castle', column: 5, row: 5, slots: { 5: 'center' } }] });
  const { state, ctx } = fx, p = state.parties['A.worker'], m = state.members['A.worker.s5'];
  state.tick = 5; state.activeColumns = [5]; state.phase = 'planning';
  p.band = m.band = -1;
  const cx = Math.round(p.x / U), cy = Math.round(p.y / U);
  state.terrain.kind = 'volume';
  state.terrain.cells[cellKey(cx, cy, -1)] = { solid: false, material: 'earth' };
  // An existing filled cube, representing a prior fill, not a newly introduced entry.
  state.terrain.cells[cellKey(cx + 1, cy, -1)] = { solid: true, material: 'earth' };
  const target = { x: cx + 1, y: cy, band: -1 };
  const d = new TerritoryDiorama(new Group(), ctx, null, { S: 1.5, bandY: b => b });
  let calls = 0, lastBuiltOpen;
  d._territory = (s, col, row, main) => { calls++; if (main) lastBuiltOpen = !solidAt(s.terrain, target.x, target.y, target.band); };
  d.sync(state, p.region);
  const cacheBefore = d.key, callsBefore = calls, cellsBefore = Object.keys(state.terrain.cells).length;
  const cmd = { type: 'begin_work', partyId: p.id, work: 'excavate', target };
  assert.equal(workError(state, ctx, 'A', cmd), null);
  const events = [];
  startWork(state, ctx, events, 'A', cmd); completeWork(state, ctx, events);
  assert.equal(solidAt(state.terrain, target.x, target.y, target.band), false);
  d.sync(state, p.region);
  assert.equal(calls, callsBefore);
  assert.equal(lastBuiltOpen, false);
  evidence.cases.terrain_rebuild = {
    method: 'Actual checked-in TerritoryDiorama.sync, geometry constructor stubbed; real workError/startWork/completeWork',
    events, target, cellsBefore, cellsAfter: Object.keys(state.terrain.cells).length,
    cacheBefore, cacheAfter: d.key, callsBefore, callsAfter: calls,
    expectedOpenAfterExcavation: true, lastBuiltOpenMask: lastBuiltOpen,
    conclusion: 'An excavated previously-filled surface cube does not invalidate the environment; existing opaque surface decal is retained over the newly open cell until another key component changes.',
  };
}

{
  const d = new TerritoryDiorama(new Group(), { geo: {} }, null, { S: 1.5, bandY: b => b });
  d.opacity = 1; d.mats = [{ opacity: 1, userData: {} }];
  d.update(1, 1, 1);
  evidence.cases.hill_cutaway = {
    method: 'Actual checked-in TerritoryDiorama.update with rendering stubbed; intended inspected hill stands on +2 and cutaway selects +1',
    cutawayBand: 1, hillSurfaceBand: 2, decorationOpacity: d.opacity, visible: d.group.visible,
    sourceContext: 'TerrainView.setCutaway makes a +2 hill translucent at +1; TerritoryDiorama.update only hides decoration for cutaway < 1.',
    conclusion: 'Source-level visibility mismatch: higher hill decoration stays fully opaque while the chosen cutaway is below that hill. Visual obstruction was not measured in a browser.',
  };
}

console.log(JSON.stringify(evidence, null, 2));
