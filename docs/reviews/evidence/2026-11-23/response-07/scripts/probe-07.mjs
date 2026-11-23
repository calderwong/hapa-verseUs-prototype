#!/usr/bin/env node
// Response 07: the review 06 diagnostic cases rerun against the corrected read model and scenery.
// Review 06's own probes (evidence/2026-11-23/review-06/) assert the old defects and are kept
// unchanged; this script states the corrected expectations. Prints JSON.
//   node docs/reviews/evidence/2026-11-23/response-07/scripts/probe-07.mjs [repo root]
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const repo = process.argv[2] ? pathToFileURL(`${resolve(process.argv[2])}/`) : new URL('../../../../../../', import.meta.url);
const [{ scenario }, { runTick }, { applyCardHit }, I, T] = await Promise.all([
  import(new URL('fixtures/hapa/scenarios.js', repo)), import(new URL('src/hapa/rules/match.js', repo)),
  import(new URL('src/hapa/rules/combat.js', repo)), import(new URL('src/hapa/rules/inspection.js', repo)), import(new URL('src/hapa/rules/terrain.js', repo)),
]);
const U = 1_000_000, out = { scope: 'Headless actual-rules probes on the corrected code; browser journeys are in the regression contract 4 report', cases: {} };

{ // default profile: the ward provider dies at contact (review case)
  const fx = scenario({ profileId: 'hapa_open_10x9_v3_02', parties: [
    { id: 'A.p', owner: 'A', mount: 'queen', column: 5, row: 5, slots: { 5: 'center', 2: 'swordsman' }, supply: 1 },
    { id: 'B.p', owner: 'B', mount: 'castle', column: 5, row: 6, slots: { 5: 'center', 2: 'mage', 8: 'archer' }, supply: 1 } ] });
  const { state, ctx } = fx; state.tick = 5; state.activeColumns = [5]; state.phase = 'planning';
  const before = structuredClone(state), moments = []; ctx.observeEvents = (s) => moments.push(I.momentSlice(s));
  const { events } = runTick(state, ctx, { A: [{ type: 'set_destination', partyId: 'A.p', target: { column: 5, row: 6 } }], B: [] });
  const contact = events.findIndex((e) => e.type === 'contact'), died = events.findIndex((e) => e.type === 'member_died' && e.memberId === 'B.p.s2');
  const at = (n) => { const S = I.stateAt(before, moments, n, state); return { mageAlive: I.memberFacts(S, ctx, 'B.p.s2').alive, mageHp: I.memberFacts(S, ctx, 'B.p.s2').health.hp / U, archerWard: I.memberFacts(S, ctx, 'B.p.s8').protection.magic.front?.total ?? 0, living: I.partyFacts(S, ctx, 'B.p').living }; };
  const r = { contactQuantum: events[contact].quantum, beforeContact: at(contact), justBeforeDeath: at(died), afterDeath: at(died + 1), final: at(events.length) };
  assert.deepEqual(r.beforeContact, { mageAlive: true, mageHp: 3, archerWard: 1, living: 3 });
  assert.deepEqual([r.afterDeath.mageAlive, r.afterDeath.archerWard, r.afterDeath.living], [false, 0, 2]);
  out.cases.playback_ward = { ...r, conclusion: 'Body, ward and headcount come from the same displayed moment; they change together at the displayed death.' };
}
{ // pooled health
  const fx = scenario({ profileId: 'hapa_open_10x9_v3_01_party_maintenance', parties: [{ id: 'B.p', owner: 'B', mount: 'castle', column: 5, row: 6, slots: { 5: 'center', 1: 'swordsman', 2: 'swordsman', 3: 'swordsman' } }] });
  const { state, ctx } = fx, before = structuredClone(state), events = [], moments = [];
  Object.defineProperty(events, 'observe', { value: (s) => moments.push(I.momentSlice(s)) });
  applyCardHit(state, ctx, events, { source: 'A.mount.C5', cardId: 'fixture.review.ember', recipientId: 'B.p.s5', channel: 'magic', power: 2, face: 'front' });
  const S0 = I.stateAt(before, moments, 0, state);
  out.cases.playback_pool = { shownEvents: 0, pool: I.memberFacts(S0, ctx, 'B.p.s1').health.hp / U, retainerAlive: I.memberFacts(S0, ctx, 'B.p.s1').alive, living: I.partyFacts(S0, ctx, 'B.p').living, finalPool: state.parties['B.p'].pool.hp / U, finalLiving: I.partyFacts(state, ctx, 'B.p').living };
  assert.deepEqual([out.cases.playback_pool.pool, out.cases.playback_pool.living], [15, 4]);
}
{ // line defense scope
  const slots = { 5: 'center', 1: 'swordsman', 2: 'swordsman', 3: 'swordsman' };
  const fx = scenario({ profileId: 'hapa_open_10x9_v3_01_line_attacker', parties: [{ id: 'A.q', owner: 'A', mount: 'queen', column: 5, row: 5, slots, supply: 0.25 }, { id: 'B.q', owner: 'B', mount: 'queen', column: 5, row: 6, slots, supply: 3 }] });
  const { state, ctx } = fx; state.tick = 5; state.activeColumns = [5]; state.phase = 'planning';
  const contribution = I.memberFacts(state, ctx, 'A.q.s2').protection.physical.front.total, line = I.linePreview(state, ctx, 'A.q', 'physical', 'front');
  const ex = runTick(state, ctx, { A: [{ type: 'set_destination', partyId: 'A.q', target: { column: 5, row: 6 } }], B: [] }).events.find((e) => e.type === 'exchange');
  const applied = [...new Set(ex.hits.filter((h) => h.attack === 'sword').map((h) => h.protection))];
  out.cases.line_defense = { contributionLabel: contribution, frontLinePreview: line.total, actualExchangeProtection: applied };
  assert.deepEqual([contribution, line.total, applied], [1, 3, [3]]);
}
{ // scenery invalidation on an existing filled cube, and per-height cutaway visibility
  const source = await readFile(new URL('src/hapa/presentation/territory-diorama.js', repo), 'utf8');
  const cls = source.replace(/^import .*;$/gm, '').replace('export class TerritoryDiorama', 'class TerritoryDiorama').replace(/^export (function|const)/gm, '$1');
  class Group { constructor() { this.children = []; this.visible = true; } add(o) { this.children.push(o); } traverse(fn) { fn(this); for (const o of this.children) fn(o); } clear() { this.children = []; } }
  const TD = new Function('THREE', 'brushRng', 'solidAt', 'surfaceBand', 'territoryColors', `${cls}\nreturn TerritoryDiorama;`)({ Group }, null, T.solidAt, T.surfaceBand, null);
  const fx = scenario({ profileId: 'hapa_open_10x9_v3_02', parties: [{ id: 'A.worker', owner: 'A', mount: 'castle', column: 5, row: 5, slots: { 5: 'center' } }] });
  const { state, ctx } = fx, P = state.parties['A.worker'], m = state.members['A.worker.s5'];
  state.tick = 5; state.activeColumns = [5]; state.phase = 'planning'; P.band = m.band = -1; state.terrain.kind = 'volume';
  const cx = Math.round(P.x / U), cy = Math.round(P.y / U), target = { x: cx + 1, y: cy, band: -1 };
  state.terrain.cells[T.cellKey(cx, cy, -1)] = { solid: false, material: 'earth' };
  state.terrain.cells[T.cellKey(cx + 1, cy, -1)] = { solid: true, material: 'earth' };
  const d = new TD(new Group(), ctx, null, { S: 1.5, bandY: (b) => b });
  let builds = 0, lastOpen = null;
  d._territory = (s, col, row, main) => { builds++; if (main) lastOpen = !T.solidAt(s.terrain, target.x, target.y, target.band); };
  d.sync(state, P.region); const b0 = builds;
  const ev = []; T.startWork(state, ctx, ev, 'A', { type: 'begin_work', partyId: P.id, work: 'excavate', target }); T.completeWork(state, ctx, ev);
  d.sync(state, P.region);
  out.cases.terrain_rebuild = { entriesBefore: 2, entriesAfter: Object.keys(state.terrain.cells).length, rebuiltAfterDig: builds > b0, builtMaskOpen: lastOpen };
  assert.deepEqual([out.cases.terrain_rebuild.rebuiltAfterDig, lastOpen], [true, true]);
  const h = new TD(new Group(), { geo: {} }, null, { S: 1.5, bandY: (b) => b });
  h.opacity = 1; h.mats = [{ opacity: 1, visible: true, userData: { surface: 3 } }, { opacity: 1, visible: true, userData: { surface: 1 } }];
  h.update(1, 1, 1);
  out.cases.hill_cutaway = { cutaway: 1, hillDressing: { surface: 3, visible: h.mats[0].visible, opacity: h.mats[0].opacity }, flatDressing: { surface: 1, visible: h.mats[1].visible } };
  assert.deepEqual([h.mats[0].visible, h.mats[1].visible], [false, true]);
}
console.log(JSON.stringify(out, null, 2));
