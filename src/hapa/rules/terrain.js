/**
 * Terrain volume, work, mining, crafting and equipment (Master Requirements v3 Chapter 9;
 * Appendix A "Terrain work and equipment settings").
 *
 * Cells are member-width cubes keyed `x,y,band` over the six occupied bands (−3…−1, +1…+3).
 * Unlisted cells follow the default: solid earth below the surface, empty space above. A party
 * anchor is exposed when no solid cell lies above its supporting position. Work tasks take whole
 * Ticks of simulation time, reserve their targets and record every output with provenance.
 */
import { emit } from './context.js';
import { livingMembers } from './state.js';

export const BANDS = [-3, -2, -1, 1, 2, 3];
export const cellKey = (x, y, band) => `${x},${y},${band}`;

/** Is the cube at (x, y, band) solid? */
export function solidAt(terrain, x, y, band) {
  const c = terrain.cells[cellKey(x, y, band)];
  if (c) return !!c.solid;
  return terrain.kind !== 'flat' && band < 0 ? true : band < 0;
}

/** Member-width integer coordinates of a rules position. */
export const cellOf = (U, v) => Math.round(v / U);

/** Exposed ground: no solid cube above the anchor's supporting position (the floor is not a roof). */
export function exposed(state, ctx, party) {
  const x = cellOf(ctx.U, party.x), y = cellOf(ctx.U, party.y);
  for (const band of BANDS) if (band > party.band && solidAt(state.terrain, x, y, band)) return false;
  return true;
}

// --- surface heights, ramps and cliffs (Appendix A "Ground travel") ------------------------------

/** Standing band of a territory's surface: +1 on flat ground, raised by a hill's height. */
export const surfaceBand = (terrain, column, row) => 1 + (terrain.hills?.[`${column},${row}`] ?? 0);

const rampKey = (a, b) => [`${a.column},${a.row}`, `${b.column},${b.row}`].sort().join('>');

/** Is there an explicit one-band ramp link between two adjacent territories? */
export const rampLinked = (terrain, a, b) => !!terrain.ramps?.[rampKey(a, b)];

/** Why a ground step between adjacent territories is impossible, or null when connected. */
export function groundStepError(terrain, a, b) {
  const ha = surfaceBand(terrain, a.column, a.row), hb = surfaceBand(terrain, b.column, b.row);
  if (ha === hb) return null;
  if (Math.abs(ha - hb) > 1) return `a vertical cliff between R${a.row}C${a.column} and R${b.row}C${b.column} has no ordinary connection`;
  if (!rampLinked(terrain, a, b)) return `no ramp links R${a.row}C${a.column} and R${b.row}C${b.column} (a one-band cliff)`;
  return null;
}

/** The first impossible ground step on a route from `from`, or null. Flyers are not ground travel. */
export function routeTerrainError(state, party, from, route) {
  if (party.movementMode === 'air') return null;
  let prev = from;
  for (const n of route) {
    const e = groundStepError(state.terrain, prev, n);
    if (e) return e;
    prev = n;
  }
  return null;
}

/**
 * Fixture terrain: raise a territory by `height` bands (solid cubes under its 3×3 member squares)
 * and optionally link ramps to neighbours. Parties standing there move up to the new surface.
 */
export function raiseTerritory(state, ctx, column, row, height, rampsTo = []) {
  const t = state.terrain;
  t.kind = 'volume';
  t.hills = { ...(t.hills ?? {}), [`${column},${row}`]: height };
  const c = ctx.geo.center(column, row), U = ctx.U;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let b = 1; b <= height; b++) {
    t.cells[cellKey(cellOf(U, c.x) + dx, cellOf(U, c.y) + dy, b)] = { solid: true, material: 'earth', hill: true };
  }
  for (const n of rampsTo) t.ramps = { ...(t.ramps ?? {}), [rampKey({ column, row }, n)]: true };
  for (const p of Object.values(state.parties)) {
    if (!p.alive || p.region.column !== column || p.region.row !== row || p.movementMode === 'air') continue;
    p.band = 1 + height;
    for (const id of Object.values(p.slots)) if (id && state.members[id]) state.members[id].band = p.band;
  }
}

const occupied = (state, ctx, x, y, band) => Object.values(state.members).some((m) => m.alive && cellOf(ctx.U, m.x) === x && cellOf(ctx.U, m.y) === y && m.band === band);
const faceAdjacent = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(BANDS.indexOf(a.band) - BANDS.indexOf(b.band)) === 1;

/** The working center of a party (work actor). */
function center(state, party) {
  const id = party.slots['5'];
  const m = id && state.members[id];
  return m?.alive ? m : null;
}

/** Why a begin_work command cannot start (or null). */
export function workError(state, ctx, seat, cmd) {
  const P = state.parties[cmd.partyId];
  if (!P || P.owner !== seat || !P.alive || P.retired) return 'choose a living friendly party';
  const c = center(state, P);
  if (!c) return 'work needs a living center';
  if (!state.activeColumns.includes(P.region.column)) return `column C${P.region.column} is not active`;
  if (P.state !== 'idle') return 'the party must be stationary';
  if (Object.values(state.tasks).some((t) => t.actor === P.id && t.status === 'running')) return 'one work task at a time';
  const here = { x: cellOf(ctx.U, c.x), y: cellOf(ctx.U, c.y), band: c.band };
  const t = cmd.target ?? {};
  switch (cmd.work) {
    case 'excavate': case 'fill': {
      if (!faceAdjacent(here, t)) return 'the cube must share a face with the worker';
      if (occupied(state, ctx, t.x, t.y, t.band)) return 'the cube is occupied';
      const solid = solidAt(state.terrain, t.x, t.y, t.band);
      if (cmd.work === 'excavate') {
        if (!solid) return 'that cube is already empty';
        if (state.terrain.cells[cellKey(t.x, t.y, t.band)]?.deposit) return 'deposits are extracted, not excavated';
        if (occupied(state, ctx, t.x, t.y, BANDS[BANDS.indexOf(t.band) + 1])) return 'that cube supports a member';
      } else if (solid) return 'that cube is already solid';
      return null;
    }
    case 'extract': {
      const cell = state.terrain.cells[cellKey(t.x, t.y, t.band)];
      if (!cell?.deposit) return 'no deposit there';
      if (!faceAdjacent(here, t)) return 'stand face-adjacent to the deposit';
      const d = state.terrain.deposits[cell.deposit];
      if (d.extracted) return 'that deposit is exhausted';
      if (d.reservedBy) return 'that deposit is reserved by another task';
      return null;
    }
    case 'craft': {
      const metal = state.players[seat].inventory.map((id) => state.items[id]).find((i) => i.definition === 'fixture.metal' && i.state === 'available');
      return metal ? null : 'no Metal in the match inventory';
    }
    case 'equip': {
      const item = state.items[cmd.itemId];
      if (!item || item.owner !== seat || item.state !== 'available') return 'choose an available owned armor item';
      const m = state.members[cmd.memberId];
      if (!m?.alive || m.party !== P.id) return 'choose a living member of this party';
      return null;
    }
    default: return `unknown work ${cmd.work}`;
  }
}

/** Start a task: reserve or consume inputs now; it completes at the end of its last Tick. */
export function startWork(state, ctx, events, seat, cmd) {
  const P = state.parties[cmd.partyId];
  state.taskSeq = (state.taskSeq ?? 0) + 1;
  const id = `W${state.tick}.${state.taskSeq}`;
  const ticks = ctx.profile.terrain.workTicks[cmd.work] ?? 1;
  const task = { id, actor: P.id, owner: seat, kind: cmd.work, target: cmd.target ?? null, itemId: cmd.itemId ?? null, memberId: cmd.memberId ?? null, startTick: state.tick, completeTick: state.tick + ticks - 1, status: 'running', consumed: [] };
  if (cmd.work === 'extract') {
    const dep = state.terrain.cells[cellKey(cmd.target.x, cmd.target.y, cmd.target.band)].deposit;
    state.terrain.deposits[dep].reservedBy = id;
    task.deposit = dep;
  }
  if (cmd.work === 'craft') {
    const inv = state.players[seat].inventory;
    const metal = inv.map((i) => state.items[i]).find((i) => i.definition === 'fixture.metal' && i.state === 'available');
    metal.state = 'consumed';
    metal.consumedBy = id;
    state.players[seat].inventory = inv.filter((i) => i !== metal.id);
    task.consumed.push(metal.id);
    emit(state, events, 'item_consumed', { itemId: metal.id, taskId: id, recipe: `${ctx.profile.terrain.recipe.id}@1` });
  }
  if (cmd.work === 'equip') state.items[cmd.itemId].reservedBy = id;
  state.tasks[id] = task;
  emit(state, events, 'work_started', { taskId: id, partyId: P.id, kind: cmd.work, target: task.target, completesAtEndOfTick: task.completeTick });
}

/** Complete due tasks at the end of a Tick (targets rechecked; outputs get deterministic ids). */
export function completeWork(state, ctx, events) {
  for (const t of Object.values(state.tasks)) {
    if (t.status !== 'running' || t.completeTick > state.tick) continue;
    const P = state.parties[t.actor];
    if (!P?.alive || !center(state, P) || P.state !== 'idle') { cancelTask(state, events, t, 'actor moved or its center died'); continue; }
    const k = t.target ? cellKey(t.target.x, t.target.y, t.target.band) : null;
    if (t.kind === 'excavate' || t.kind === 'fill') {
      if (occupied(state, ctx, t.target.x, t.target.y, t.target.band)) { cancelTask(state, events, t, 'the cube became occupied'); continue; }
      const prior = state.terrain.cells[k];
      state.terrain.cells[k] = { ...(prior ?? {}), solid: t.kind === 'fill', material: 'earth' };
      if (state.terrain.kind === 'flat') state.terrain.kind = 'volume';
      emit(state, events, 'terrain_changed', { taskId: t.id, cell: t.target, solid: t.kind === 'fill', by: t.actor });
    } else if (t.kind === 'extract') {
      const dep = state.terrain.deposits[t.deposit];
      if (dep.extracted) { cancelTask(state, events, t, 'deposit already extracted'); continue; }
      dep.extracted = true;
      dep.reservedBy = null;
      state.terrain.cells[k] = { solid: false, material: 'exhausted', deposit: t.deposit };
      const itemId = `I.${t.id}.metal`;
      state.items[itemId] = { id: itemId, definition: 'fixture.metal', owner: t.owner, state: 'available', provenance: { deposit: t.deposit, task: t.id, extractor: t.actor, tick: state.tick } };
      state.players[t.owner].inventory.push(itemId);
      emit(state, events, 'deposit_extracted', { taskId: t.id, deposit: t.deposit, itemId, partyId: t.actor, location: t.target });
    } else if (t.kind === 'craft') {
      const itemId = `I.${t.id}.armor`;
      state.items[itemId] = { id: itemId, definition: 'fixture.armor', owner: t.owner, state: 'available', provenance: { recipe: `${ctx.profile.terrain.recipe.id}@1`, inputs: t.consumed, task: t.id, crafter: t.actor, tick: state.tick } };
      state.players[t.owner].inventory.push(itemId);
      emit(state, events, 'item_crafted', { taskId: t.id, itemId, recipe: `${ctx.profile.terrain.recipe.id}@1`, inputs: t.consumed, partyId: t.actor });
    } else if (t.kind === 'equip') {
      const m = state.members[t.memberId];
      const item = state.items[t.itemId];
      if (!m?.alive) { cancelTask(state, events, t, 'the wearer died'); continue; }
      const old = m.equipment.torso;
      if (old) { state.items[old].state = 'available'; state.items[old].wearer = null; state.players[t.owner].inventory.push(old); }
      m.equipment.torso = item.id;
      item.state = 'equipped';
      item.wearer = m.id;
      item.reservedBy = null;
      state.players[t.owner].inventory = state.players[t.owner].inventory.filter((i) => i !== item.id);
      emit(state, events, 'item_equipped', { taskId: t.id, itemId: item.id, memberId: m.id, replaced: old ?? null });
    }
    t.status = 'done';
  }
}

export function cancelTask(state, events, t, reason) {
  t.status = 'cancelled';
  if (t.deposit) state.terrain.deposits[t.deposit].reservedBy = null;
  if (t.itemId && state.items[t.itemId]) state.items[t.itemId].reservedBy = null;
  emit(state, events, 'work_cancelled', { taskId: t.id, reason, refunded: [] });
}

/** Place a deposit cube (setup / fixtures). */
export function placeDeposit(state, id, x, y, band) {
  state.terrain.deposits[id] = { id, x, y, band, material: 'fixture.metal', extracted: false, reservedBy: null };
  state.terrain.cells[cellKey(x, y, band)] = { solid: true, material: 'ore', deposit: id };
}

export { livingMembers };
