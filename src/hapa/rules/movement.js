/**
 * Parties, Mounts and movement (Master Requirements v3, Chapter 6; Appendix A "Starting army and
 * movement" and "Numeric precision and deterministic simulation").
 *
 * One destination per party; the Mount gives the legal endpoints and route, Supply the distance,
 * Speed the rate. Movement runs in integer quanta (1,000 per Tick); member bodies are swept every
 * quantum so a fast party cannot tunnel, and contact is recorded at the earliest quantum reaching it.
 */
import { emit } from './context.js';
import { slotOffset, facingOf } from './geometry.js';
import { livingMembers } from './state.js';
import { supplyOf, spendSupply } from './economy.js';
import { solidAt, cellOf, surfaceBand, routeTerrainError } from './terrain.js';

const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);

/**
 * Traversal (human feedback after response 08): `center_to_center_v1` — a step from one territory
 * center to the next is obstructed only by a friendly formation holding the territory being
 * entered (a Pawn the mover can absorb there is not an obstruction: it is absorbed on arrival).
 * Corner brushes from formations in neighbouring territories no longer stop a step. A Knight passes
 * through friendly-held territories and is stopped by a friendly holder only at its final node.
 * Enemy bodies still meet on contact for every Mount. Absent = v3 full body sweep (old manifests).
 */
export const traversalPolicy = (profile) => profile.movement.traversal ?? 'body_sweep_v3';
const centerToCenter = (profile) => traversalPolicy(profile) === 'center_to_center_v1';
/** Knight L paths: `either_l_v1` lets an order choose short-axis-first; absent = long axis first only. */
export const knightPathPolicy = (profile) => profile.movement.knightPaths ?? 'long_axis_first_v3';
export const KNIGHT_VIAS = ['long', 'short'];

/** The profile's recovery policy; absent means v3 nearest-node rerouting (old manifests). */
export const recoveryPolicy = (profile) => profile.movement.recovery ?? 'nearest_node_v3';
const reachableRecovery = (profile) => recoveryPolicy(profile) === 'reachable_segment_v1';

/**
 * The straight segment a mid-edge party stands on: the node ahead (its route head) and the node
 * behind (the territory it left along that segment — its bodies just swept it, so it can retrace
 * it). Null at a node, or when the anchor is not strictly between two adjacent centers.
 */
export function currentEdge(ctx, party) {
  if (!party.route?.length || atNode(ctx, party)) return null;
  const n = party.route[0], { geo } = ctx;
  const back = { column: n.column - sign(n.x - party.x), row: n.row - sign(n.y - party.y) };
  if (!geo.onBoard(back.column, back.row)) return null;
  const b = geo.center(back.column, back.row);
  const dx = n.x - b.x, dy = n.y - b.y, px = party.x - b.x, py = party.y - b.y;
  const dot = px * dx + py * dy;
  if (px * dy - py * dx !== 0 || dot <= 0 || dot >= dx * dx + dy * dy) return null;
  return { ahead: { column: n.column, row: n.row }, behind: back };
}

/**
 * The node (territory) a party's route starts from: the next node when mid-edge.
 * Under `reachable_segment_v1` a party blocked on its segment starts from the node behind it (the
 * one it can actually reach), never from the obstructed node ahead; both ends of the segment stay
 * direct destinations (`routeFromHere`).
 */
export function routeOrigin(state, ctx, party) {
  const { geo } = ctx;
  if (party.route.length && !atNode(ctx, party)) {
    const edge = reachableRecovery(ctx.profile) ? currentEdge(ctx, party) : null;
    if (edge) {
      const blocked = (party.blockedTick ?? -9) >= state.tick - 1;
      const o = blocked ? edge.behind : edge.ahead;
      return { column: o.column, row: o.row, midEdge: true, back: blocked, ahead: edge.ahead, behind: edge.behind };
    }
    // a party stopped mid-edge by an obstruction may reroute from its nearest node instead
    if ((party.blockedTick ?? -9) >= state.tick - 1) {
      const n = nearestNode(ctx, party);
      return { column: n.column, row: n.row, midEdge: true, back: true };
    }
    const n = party.route[0];
    return { column: n.column, row: n.row, midEdge: true };
  }
  const r = geo.region(party.x, party.y, party.region);
  return { column: r.column, row: r.row, midEdge: false };
}

/**
 * The one route from the party's present position to a target, shared by quotes, previews,
 * keyboard lists, bots, validation and execution: `path` is every node the anchor will pass
 * through (an unfinished edge first), `route` the Mount pattern's nodes after the origin.
 * Under `reachable_segment_v1` the two ends of the current segment are direct: retrace to the
 * territory it left, or finish the segment — "already there" needs actual arrival.
 * @returns {{ error?: string, from?: any, route?: {column:number,row:number}[], path?: any[], cost?: number, direct?: boolean }}
 */
export function routeFromHere(state, ctx, party, target, via = null) {
  const { geo } = ctx;
  const from = routeOrigin(state, ctx, party);
  if (from.behind && target) {
    for (const [end, other] of [[from.behind, from.ahead], [from.ahead, from.behind]]) {
      if (target.column !== end.column || target.row !== end.row) continue;
      const e = routeTerrainError(state, party, other, [end]);
      if (e) return { error: e };
      return { from, route: [{ column: end.column, row: end.row }], path: [{ column: end.column, row: end.row, ...geo.center(end.column, end.row) }], cost: 0, direct: true };
    }
  }
  const plan = planPartyRoute(state, ctx, party, from, target, via);
  if (plan.error) return plan;
  const nodes = plan.route.map((n) => ({ ...n, ...geo.center(n.column, n.row) }));
  const head = from.midEdge ? [from.back ? { column: from.column, row: from.row, ...geo.center(from.column, from.row) } : party.route[0]] : [];
  return { from, route: plan.route, path: [...head, ...nodes], cost: plan.cost };
}

/** The territory center nearest a party's anchor (ties toward lower coordinates). */
export function nearestNode(ctx, party) {
  const P = ctx.geo.pitch, U = ctx.U;
  const idx = (v) => Math.max(1, Math.round((v + 2 * U) / P));
  const column = Math.min(ctx.geo.columns, idx(party.x)), row = Math.min(ctx.geo.rows, idx(party.y));
  return { column, row, ...ctx.geo.center(column, row) };
}

export function atNode(ctx, party) {
  const { geo } = ctx;
  const r = geo.region(party.x, party.y, party.region);
  const c = geo.center(r.column, r.row);
  return c.x === party.x && c.y === party.y;
}

/**
 * Route (list of territory nodes after the origin) to a target for a Mount pattern, or an error.
 * @returns {{ route?: {column:number,row:number}[], cost?: number, error?: string }}
 */
export function planRoute(ctx, mount, from, to, via = null) {
  const { geo, profile } = ctx;
  if (via != null) {
    if (!KNIGHT_VIAS.includes(via)) return { error: `unknown Knight path "${via}"` };
    if (profile.movement.patterns[mount] !== 'knight_l') return { error: 'only a Knight chooses between two L paths' };
    if (via === 'short' && knightPathPolicy(profile) !== 'either_l_v1') return { error: 'this profile has one Knight path: two steps on the long axis, then one' };
  }
  if (!geo.onBoard(to.column, to.row)) return { error: 'the destination is off the board' };
  const dc = to.column - from.column, dr = to.row - from.row;
  if (!dc && !dr) return { error: 'the party is already there' };
  const pattern = profile.movement.patterns[mount];
  const line = (sc, sr, n) => Array.from({ length: n }, (_, i) => ({ column: from.column + sc * (i + 1), row: from.row + sr * (i + 1) }));
  switch (pattern) {
    case 'orthogonal_line':
      if (dc && dr) return { error: `a ${mount} moves along one row or one column` };
      return { route: line(sign(dc), sign(dr), Math.abs(dc) + Math.abs(dr)), cost: Math.abs(dc) + Math.abs(dr) };
    case 'diagonal_line':
      if (Math.abs(dc) !== Math.abs(dr)) return { error: `a ${mount} moves along a diagonal` };
      return { route: line(sign(dc), sign(dr), Math.abs(dc)), cost: Math.abs(dc) };
    case 'any_line':
      if (dc && dr && Math.abs(dc) !== Math.abs(dr)) return { error: `a ${mount} moves along a row, column or diagonal` };
      return { route: line(sign(dc), sign(dr), Math.max(Math.abs(dc), Math.abs(dr))), cost: Math.max(Math.abs(dc), Math.abs(dr)) };
    case 'adjacent':
      if (Math.max(Math.abs(dc), Math.abs(dr)) !== 1) return { error: `a ${mount} moves one adjacent square` };
      return { route: [{ column: to.column, row: to.row }], cost: 1 };
    case 'knight_l': {
      const ok = (Math.abs(dc) === 1 && Math.abs(dr) === 2) || (Math.abs(dc) === 2 && Math.abs(dr) === 1);
      if (!ok) return { error: 'a Knight moves to an L endpoint (two then one)' };
      // long: two steps on the long axis, then one on the short axis; short (either_l_v1): the
      // one short-axis step first, then the two long-axis steps
      const route = via === 'short'
        ? (Math.abs(dr) === 2
          ? [{ column: to.column, row: from.row }, { column: to.column, row: from.row + sign(dr) }, { column: to.column, row: to.row }]
          : [{ column: from.column, row: to.row }, { column: from.column + sign(dc), row: to.row }, { column: to.column, row: to.row }])
        : (Math.abs(dr) === 2
          ? [{ column: from.column, row: from.row + sign(dr) }, { column: from.column, row: to.row }, { column: to.column, row: to.row }]
          : [{ column: from.column + sign(dc), row: from.row }, { column: to.column, row: from.row }, { column: to.column, row: to.row }]);
      return { route, cost: profile.movement.knightRouteCost };
    }
    default:
      return { error: `unknown movement pattern ${pattern}` };
  }
}

/** A route for a party on the current terrain: the Mount pattern, then ground connections. */
export function planPartyRoute(state, ctx, party, from, to, via = null) {
  const plan = planRoute(ctx, party.mount, from, to, via);
  if (plan.error) return plan;
  const e = routeTerrainError(state, party, from, plan.route);
  return e ? { error: e } : plan;
}

// --- Supply-funded destinations (human-feedback addendum 01, HF-04) ----------------------------

/** The profile's destination policy; absent means v3 partial-Supply travel (old manifests). */
export const destinationPolicy = (profile) => profile.movement.destinationFunding ?? 'partial_supply_v3';
/** The profile's debit policy; absent means v3: stepCost per pitch for every Mount. */
export const debitPolicy = (profile) => profile.movement.debit ?? 'step_cost_per_pitch_v3';

/**
 * Supply price per coordinate unit of travel, as an integer ratio [num, den]. Under
 * `route_price_v1` a Knight's L (three pitches) costs exactly knightRouteCost; otherwise every
 * pitch costs stepCost. Both are identical at baseline prices.
 */
export function pricePerUnit(ctx, party) {
  const { profile, U } = ctx;
  const pitch = ctx.geo.pitch;
  if (debitPolicy(profile) === 'route_price_v1' && profile.movement.patterns[party.mount] === 'knight_l') return [profile.movement.knightRouteCost * U, 3 * pitch];
  return [profile.movement.stepCost * U, pitch];
}

/**
 * The one exact route-and-funding quote (shared by highlights, previews, keyboard lists, bots,
 * validation, peers and replay): the actual path from the party's present position — finishing
 * (or backing out of) an unfinished edge — then the Mount route; its distance; and the Supply
 * that distance debits under the profile's price, including the carried fixed-point remainder.
 * `held` is the party's Supply in the given state (a validation scratch state already includes
 * earlier planned loads).
 * @returns {{ error?: string, route?: {column:number,row:number}[], distance?: number, required?: number, held?: number, funded?: boolean, shortfall?: number }}
 */
export function quoteRoute(state, ctx, party, target, via = null) {
  const plan = routeFromHere(state, ctx, party, target, via);
  if (plan.error) return { error: plan.error };
  let distance = 0, x = party.x, y = party.y;
  for (const p of plan.path) { distance += Math.max(Math.abs(p.x - x), Math.abs(p.y - y)); x = p.x; y = p.y; }
  const [num, den] = pricePerUnit(ctx, party);
  const required = Math.floor((distance * num + (party.supplyRemainder ?? 0)) / den);
  const held = supplyOf(party);
  return { route: plan.route, path: plan.path.map((n) => ({ column: n.column, row: n.row })), direct: !!plan.direct, distance, required, held, funded: held >= required, shortfall: Math.max(0, required - held) };
}

/**
 * Why a new voluntary destination is not funded under the profile's policy, or null. Legacy v3
 * profiles never refuse for Supply (the route may pause and resume). Free pursuit and Card-defined
 * movement do not come through here.
 */
export function fundingError(state, ctx, party, target, via = null) {
  if (destinationPolicy(ctx.profile) !== 'full_route_funded_v1') return null;
  const q = quoteRoute(state, ctx, party, target, via);
  if (q.error) return q.error;
  if (q.funded) return null;
  const f = (u) => { const v = u / ctx.U; return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, '').replace(/[.]$/, ''); };
  return `not enough Supply for the whole route: it needs ${f(q.required)}, the party has ${f(q.held)} (counting earlier planned loads)`;
}

/** Legal destinations of a party (for previews). */
export function legalDestinations(state, ctx, party) {
  if (!party.mount || !party.alive || party.retired) return [];
  const out = [];
  const either = knightPathPolicy(ctx.profile) === 'either_l_v1' && ctx.profile.movement.patterns[party.mount] === 'knight_l';
  for (let c = 1; c <= ctx.geo.columns; c++) for (let r = 1; r <= ctx.geo.rows; r++) {
    const t = { column: c, row: r };
    if (destinationHeldError(state, ctx, party, t)) continue; // center_to_center_v1: not a place to stop
    if (either) {
      // each endpoint once, with every legal L path (`via` is the first legal one)
      const vias = KNIGHT_VIAS.filter((v) => routeFromHere(state, ctx, party, t, v).route);
      if (!vias.length) continue;
      const p = routeFromHere(state, ctx, party, t, vias[0]);
      out.push({ column: c, row: r, cost: p.cost, via: vias[0], vias, ...(p.direct ? { direct: true } : {}) });
      continue;
    }
    const p = routeFromHere(state, ctx, party, t);
    if (p.route) out.push({ column: c, row: r, cost: p.cost, ...(p.direct ? { direct: true } : {}) });
  }
  return out;
}

/**
 * Every legal destination with its funding quote, for the policy in force: `funded` is always true
 * under v3 partial-Supply travel. Unlimited — presentation filters, never truncates.
 */
export function quotedDestinations(state, ctx, party) {
  const strict = destinationPolicy(ctx.profile) === 'full_route_funded_v1';
  return legalDestinations(state, ctx, party).map((d) => {
    const q = quoteRoute(state, ctx, party, d, d.via ?? null);
    return { ...d, required: q.required, held: q.held, shortfall: q.shortfall, funded: strict ? q.funded : true };
  });
}

/**
 * Actual Speed ratio of a party: its Mount Speed, halved (profile `uphillSpeed`) while its current
 * leg climbs to a higher surface. Charge uses this actual Speed.
 */
export function speedOf(ctx, party, state = null) {
  if (!party.mount) return [0, 1];
  const base = ctx.profile.movement.speeds[party.mount];
  const node = party.route?.[0];
  if (!state || !node || party.movementMode === 'air') return base;
  if (surfaceBand(state.terrain, node.column, node.row) <= party.band) return base;
  const up = ctx.profile.movement.uphillSpeed ?? [1, 1];
  return [base[0] * up[0], base[1] * up[1]];
}

/** Member world position from its party anchor and slot. */
export function placeMembers(state, ctx, party) {
  const U = ctx.U;
  for (const id of Object.values(party.slots)) {
    if (!id) continue;
    const m = state.members[id];
    if (m.helperAway) continue;
    const off = slotOffset(m.slot, party.facing);
    m.x = party.x + off.dx * U;
    m.y = party.y + off.dy * U;
  }
}

/**
 * Accept a destination: replaces any previous one (no waypoints). Mid-edge, the current edge is
 * finished first and the new route is validated from that next node.
 */
export function setDestination(state, ctx, events, party, target, cause, via = null) {
  const plan = routeFromHere(state, ctx, party, target, via);
  if (plan.error) return { error: plan.error };
  const { geo } = ctx;
  const { from } = plan;
  const nodes = plan.route.map((n) => ({ ...n, ...geo.center(n.column, n.row) }));
  party.route = plan.path;
  party.destination = { column: target.column, row: target.row };
  if (reachableRecovery(ctx.profile)) party.blockedBy = null;
  if (party.state === 'idle' || party.state === 'arrived' || party.state === 'waiting_supply') party.state = 'moving';
  // an orthogonal first leg that differs from the facing takes one Tick to turn first
  const first = nodes[0];
  const start = geo.center(from.column, from.row);
  const dx = first.x - start.x, dy = first.y - start.y;
  if (!from.midEdge && (!dx || !dy)) {
    const want = facingOf(dx, dy);
    if (want !== party.facing) {
      party.turn = { to: want, completeTick: state.tick + ctx.profile.movement.turnTicks - 1, reason: 'travel' };
      party.state = 'turning';
    }
  }
  emit(state, events, 'destination_set', { partyId: party.id, target: party.destination, route: party.route.map((n) => ({ column: n.column, row: n.row })), cost: plan.cost, turn: party.turn?.to ?? null, cause, ...(via ? { via } : {}) });
  return { ok: true };
}

/** Merge a mounted party with a friendly unmounted Pawn at a route node (atomic). */
export function mergeParties(state, ctx, events, mounted, pawn) {
  const moved = [];
  for (let s = 1; s <= 9; s++) {
    const id = pawn.slots[String(s)];
    if (!id || !state.members[id].alive) continue;
    let slot = s;
    if (mounted.slots[String(s)]) {
      slot = 0;
      for (let t = 1; t <= 9; t++) if (t !== 5 && !mounted.slots[String(t)]) { slot = t; break; }
      if (!slot) return { error: 'over capacity' };
    }
    moved.push([id, s, slot]);
  }
  for (const [id, from, slot] of moved) {
    const m = state.members[id];
    mounted.slots[String(slot)] = id;
    pawn.slots[String(from)] = null;
    m.party = mounted.id;
    m.homeParty = mounted.id;
    m.slot = slot;
    m.homeSlot = slot;
  }
  for (const portion of pawn.supply) mounted.supply.push(portion);
  pawn.supply = [];
  if (mounted.pool && pawn.pool) {
    mounted.pool.hp += pawn.pool.hp;
    mounted.pool.max += pawn.pool.max;
    pawn.pool.hp = 0;
  }
  pawn.retired = true;
  pawn.mergeClaim = null;
  pawn.alive = false;
  pawn.state = 'retired';
  pawn.mergedInto = mounted.id;
  placeMembers(state, ctx, mounted);
  emit(state, events, 'parties_merged', { partyId: mounted.id, retired: pawn.id, members: livingMembers(state, mounted).map((m) => m.id), moved: moved.map(([id, from, to]) => ({ memberId: id, from, to })), supply: supplyOf(mounted) });
  return { ok: true };
}

/** Does formation `o` hold the territory of node `n` (its anchor is there or its region is that territory)? */
const holds = (o, n) => (o.x === n.x && o.y === n.y) || (o.region.column === n.column && o.region.row === n.row);

/**
 * Center-to-center obstruction rule shared by the simulation and the route preview: may friendly
 * formation `o` stop `p`'s step toward node `n`? Enemies always count (body contact).
 */
function friendlyObstacle(ctx, p, o, n, final) {
  if (o.owner !== p.owner) return true;
  if (!centerToCenter(ctx.profile)) return true;
  if (!holds(o, n)) return false;
  return !(ctx.profile.movement.patterns[p.mount] === 'knight_l' && !final);
}

/**
 * center_to_center_v1: a destination held by another friendly formation is refused unless it is a
 * Pawn this party can absorb there. Null when allowed (or under older traversal policies).
 */
export function destinationHeldError(state, ctx, party, target) {
  if (!centerToCenter(ctx.profile) || !target) return null;
  const holder = Object.values(state.parties).find((o) => o.id !== party.id && o.alive && !o.retired && o.owner === party.owner && o.region.column === target.column && o.region.row === target.row);
  if (!holder || mergeCandidate(state, party, holder)) return null;
  return `your ${holder.mount ?? (holder.commander ? 'Commander' : 'Pawn')} already holds R${target.row}C${target.column}${!holder.mount ? ' and this party cannot absorb it (at most nine members)' : ''}`;
}

/** Is a friendly Pawn a merge candidate for a mounted party? */
function mergeCandidate(state, mounted, pawn) {
  if (pawn.owner !== mounted.owner || pawn.mount || pawn.retired || !pawn.alive || !mounted.mount) return false;
  const total = livingMembers(state, mounted).length + livingMembers(state, pawn).length;
  return total <= 9;
}

// --- body sweep -------------------------------------------------------------------------------

/** Bodies of a party at a hypothetical anchor. */
function bodiesAt(state, ctx, party, ax, ay, living = livingMembers(state, party)) {
  const U = ctx.U;
  return living.map((m) => {
    if (m.helperAway) return { id: m.id, x: m.x, y: m.y };
    const off = slotOffset(m.slot, party.facing);
    return { id: m.id, x: ax + off.dx * U, y: ay + off.dy * U };
  });
}

const interiorOverlap = (a, b, U) => Math.abs(a.x - b.x) < U && Math.abs(a.y - b.y) < U;

/**
 * Simulate one Tick of movement in quanta. Calls `onContact(batch)` with every new enemy contact
 * found at the same quantum (the caller runs the immediate exchange and victory check) and
 * returns early if the match ends.
 */
export function simulateMovement(state, ctx, events, onContact) {
  const { U, profile } = ctx;
  const Q = profile.geometry.quantaPerTick;
  const pitch = ctx.geo.pitch;
  const costPerPitch = profile.movement.stepCost * U;
  const tol = contactTolerance(ctx); // two quanta at Speed 2
  const parties = () => Object.values(state.parties).filter((p) => p.alive && !p.retired);
  const spentThisTick = {};

  const movers = () => {
    const engaged = new Set();
    for (const e of Object.values(state.engagements)) if (e.active) { engaged.add(e.a); engaged.add(e.b); }
    return parties().filter((p) => p.state === 'moving' && p.route.length && !engaged.has(p.id));
  };
  if (!movers().length) return;

  for (let q = 1; q <= Q; q++) {
    const list = movers();
    if (!list.length) break;
    const proposals = [];
    for (const p of list) {
      const free = !!p.freeFollow; // following a withdrawing defender costs no Supply
      const avail = free ? Number.MAX_SAFE_INTEGER : supplyOf(p);
      const priced = !free && debitPolicy(profile) === 'route_price_v1';
      if (avail <= 0 && !priced) {
        p.state = 'waiting_supply';
        emit(state, events, 'travel_paused', { partyId: p.id, reason: 'no Supply', quantum: q, destination: p.destination });
        continue;
      }
      const node = p.route[0];
      const [num, den] = speedOf(ctx, p, state);
      const total = pitch * num + (p.moveRemainder ?? 0);
      let step = Math.floor(total / (Q * den));
      p.moveRemainder = total % (Q * den);
      const dx = node.x - p.x, dy = node.y - p.y;
      const along = Math.max(Math.abs(dx), Math.abs(dy));
      step = Math.min(step, along);
      // Supply limits distance: costPerPitch units per pitch of the larger axis displacement.
      // route_price_v1: the exact largest step whose debit (with the carried remainder) fits the
      // Supply held, so a funded route always arrives (no fixed-point stall short of the node).
      let affordable;
      if (priced) { const [pn, pd] = pricePerUnit(ctx, p); affordable = Math.floor(((avail + 1) * pd - 1 - (p.supplyRemainder ?? 0)) / pn); }
      else affordable = Math.floor((avail * pitch) / costPerPitch);
      step = Math.min(step, affordable);
      if (step <= 0) {
        p.state = 'waiting_supply';
        emit(state, events, 'travel_paused', { partyId: p.id, reason: 'no Supply', quantum: q, destination: p.destination });
        continue;
      }
      proposals.push({ p, node, sx: sign(dx), sy: sign(dy), step });
    }
    // sweep each proposal against every other party's current bodies (order independent)
    const others = parties();
    const bodies = new Map();
    const bodiesOf = (o) => { let b = bodies.get(o.id); if (!b) { b = livingMembers(state, o); bodies.set(o.id, b); } return b; };
    const contacts = [];
    // merge claims: a Pawn assembles with one mount at a time; an earlier claim stands, and
    // simultaneous new claims both stop (no hidden right of way)
    for (const pr of proposals) {
      const cand = others.find((o) => o.id !== pr.p.id && o.x === pr.node.x && o.y === pr.node.y && mergeCandidate(state, pr.p, o));
      pr.mergeTarget = cand ?? null;
    }
    for (const pr of proposals) {
      const t = pr.mergeTarget;
      if (!t) continue;
      const claimant = t.mergeClaim && state.parties[t.mergeClaim];
      const claimValid = claimant && claimant.alive && !claimant.retired && claimant.route[0]?.x === t.x && claimant.route[0]?.y === t.y;
      if (claimValid && t.mergeClaim !== pr.p.id) { pr.mergeTarget = null; continue; }
      if (!claimValid) {
        const rivals = proposals.filter((o) => o !== pr && o.mergeTarget === t);
        if (rivals.length) { pr.mergeTarget = null; continue; }
        t.mergeClaim = pr.p.id;
      }
    }
    for (const pr of proposals) {
      const { p, sx, sy } = pr;
      const mergeTarget = pr.mergeTarget;
      // member bodies can only meet when anchors are within 3 member widths on both axes
      const reach = 3 * U + pr.step + tol;
      const final = p.route.length === 1;
      const near = others.filter((o) => o.id !== p.id && o !== mergeTarget && Math.abs(o.x - p.x) < reach && Math.abs(o.y - p.y) < reach);
      // center_to_center_v1: friendly bodies obstruct only when they hold the territory entered
      const solid = near.filter((o) => friendlyObstacle(ctx, p, o, pr.node, final));
      const hit = (s) => {
        const mine = bodiesAt(state, ctx, p, p.x + sx * s, p.y + sy * s, bodiesOf(p));
        for (const o of solid) for (const b of bodiesOf(o)) for (const a of mine) if (interiorOverlap(a, b, U)) return { o, b, a };
        return null;
      };
      const ok = (s) => !hit(s);
      let lo = 0, hi = pr.step;
      if (!ok(hi)) {
        while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (ok(mid)) lo = mid; else hi = mid - 1; }
        pr.step = lo;
        pr.blocked = true;
        if (!lo) {
          p.blockedTick = state.tick;
          // reachable_segment_v1: name the first obstruction once per episode (not every quantum)
          const by = reachableRecovery(profile) ? hit(1) : null;
          if (by && p.blockedBy?.partyId !== by.o.id) {
            p.blockedBy = { partyId: by.o.id, memberId: by.b.id, moverId: by.a.id, region: { column: by.o.region.column, row: by.o.region.row }, tick: state.tick };
            emit(state, events, 'travel_blocked', { partyId: p.id, by: by.o.id, byOwner: by.o.owner, blockerMember: by.b.id, member: by.a.id, at: p.blockedBy.region, quantum: q, destination: p.destination });
          }
        }
      }
      pr.near = near;
    }
    // two movers closing on each other: if their new bodies overlap, both stay put this quantum
    for (let i = 0; i < proposals.length; i++) for (let j = i + 1; j < proposals.length; j++) {
      const a = proposals[i], b = proposals[j];
      const reach = 3 * U + a.step + b.step;
      if (Math.abs(a.p.x - b.p.x) >= reach || Math.abs(a.p.y - b.p.y) >= reach) continue;
      if (a.mergeTarget === b.p || b.mergeTarget === a.p) continue;
      // center_to_center_v1: two friendly movers conflict only over the same territory
      if (centerToCenter(profile) && a.p.owner === b.p.owner && !(a.node.column === b.node.column && a.node.row === b.node.row) && !holds(b.p, a.node) && !holds(a.p, b.node)) continue;
      const ba = bodiesAt(state, ctx, a.p, a.p.x + a.sx * a.step, a.p.y + a.sy * a.step, bodiesOf(a.p));
      const bb = bodiesAt(state, ctx, b.p, b.p.x + b.sx * b.step, b.p.y + b.sy * b.step, bodiesOf(b.p));
      if (ba.some((x) => bb.some((y) => interiorOverlap(x, y, U)))) { a.step = 0; b.step = 0; a.blocked = b.blocked = true; }
    }
    for (const pr of proposals) {
      const { p } = pr;
      if (pr.step > 0) {
        p.lastMovedTick = state.tick;
        if (p.blockedBy) p.blockedBy = null;
        p.x += pr.sx * pr.step;
        p.y += pr.sy * pr.step;
        const [pn, pd] = debitPolicy(profile) === 'route_price_v1' ? pricePerUnit(ctx, p) : [costPerPitch, pitch];
        const cost = p.freeFollow ? 0 : Math.floor((pr.step * pn + (p.supplyRemainder ?? 0)) / pd);
        if (!p.freeFollow) p.supplyRemainder = (pr.step * pn + (p.supplyRemainder ?? 0)) % pd;
        const spent = cost ? spendSupply(p, cost) : [];
        const acc = (spentThisTick[p.id] ??= { units: 0, portions: {} });
        acc.units += cost;
        for (const s of spent) acc.portions[s.cardId] = (acc.portions[s.cardId] ?? 0) + s.units;
        const prevRegion = p.region;
        p.region = ctx.geo.region(p.x, p.y, p.region);
        placeMembers(state, ctx, p);
        if (prevRegion.column !== p.region.column || prevRegion.row !== p.region.row) {
          emit(state, events, 'region_entered', { partyId: p.id, from: prevRegion, to: p.region, quantum: q });
        }
      }
      // arrival at a node
      if (p.x === pr.node.x && p.y === pr.node.y) {
        p.route.shift();
        if (p.movementMode !== 'air') {
          const band = surfaceBand(state.terrain, pr.node.column, pr.node.row);
          if (band !== p.band) {
            emit(state, events, 'elevation_changed', { partyId: p.id, from: p.band, to: band, at: { column: pr.node.column, row: pr.node.row }, quantum: q });
            p.band = band;
            for (const id of Object.values(p.slots)) if (id && state.members[id]?.alive && !state.members[id].helperAway) state.members[id].band = band;
          }
        }
        if (pr.mergeTarget) {
          const r = mergeParties(state, ctx, events, p, pr.mergeTarget);
          if (r.error) emit(state, events, 'merge_failed', { partyId: p.id, pawnId: pr.mergeTarget.id, reason: r.error });
        }
        if (!p.route.length) {
          p.freeFollow = null;
          p.state = 'idle';
          emit(state, events, 'destination_reached', { partyId: p.id, at: p.destination, quantum: q });
          p.destination = null;
        }
      }
    }
    // contacts with enemies after this quantum (touching within tolerance)
    for (const pr of proposals) {
      const { p } = pr;
      if (!p.alive) continue;
      for (const o of pr.near) {
        if (o.owner === p.owner || !o.alive) continue;
        if (Math.abs(o.x - p.x) > 3 * U + tol || Math.abs(o.y - p.y) > 3 * U + tol) continue;
        if (engagementBetween(state, p.id, o.id)) continue;
        // exact touching for an unobstructed sweep; a reverted head-on pair keeps the tolerance
        const pairs = touchingPairs(state, ctx, p, o, pr.blocked ? tol : 0);
        if (pairs.length) contacts.push({ mover: p, other: o, quantum: q, pairs });
      }
    }
    if (contacts.length) {
      const stop = onContact(contacts, q);
      ctx.trace?.(state, q, events);
      if (stop) break;
    } else ctx.trace?.(state, q, events);
    // a blocked mover facing a friendly obstruction simply waits this quantum
  }
  for (const [partyId, s] of Object.entries(spentThisTick)) emit(state, events, 'supply_spent', { partyId, units: s.units, portions: s.portions, remaining: supplyOf(state.parties[partyId]) });
}

/**
 * Known clearance of a route (reachable recovery previews, keyboard lists and bots — never an
 * authoritative outcome): the party's bodies swept along `path` from its present anchor against
 * every other formation where it stands now. The first body met is reported with the segment, the
 * point and the distance travelled before it; a friendly Pawn the party would join at a node is not
 * an obstruction (it merges there). Others may move during the Tick, so this is "known now".
 * @returns {{ clear: true } | { clear: false, friendly: boolean, partyId: string, memberId: string, moverId: string, region: {column:number,row:number}, at: {x:number,y:number}, along: number, segment: number }}
 */
export function routeClearance(state, ctx, party, path) {
  const U = ctx.U;
  const mine = livingMembers(state, party).filter((m) => !m.helperAway).map((m) => ({ id: m.id, off: slotOffset(m.slot, party.facing) }));
  const others = Object.values(state.parties).filter((o) => o.id !== party.id && o.alive && !o.retired);
  const gone = new Set();
  let size = livingMembers(state, party).length;
  let x = party.x, y = party.y, along = 0;
  for (let i = 0; i < (path ?? []).length; i++) {
    const n = path[i];
    const dx = n.x - x, dy = n.y - y;
    // a Pawn joins only while the absorbed total stays within nine members
    const join = others.find((o) => !gone.has(o.id) && o.x === n.x && o.y === n.y && mergeCandidate(state, party, o) && size + livingMembers(state, o).length <= 9);
    let best = null;
    const final = i === path.length - 1;
    for (const o of others) {
      if (gone.has(o.id) || o === join) continue;
      if (!friendlyObstacle(ctx, party, o, n, final)) continue;
      if (Math.min(Math.abs(o.x - x), Math.abs(o.x - n.x)) > 3 * U + Math.abs(dx) || Math.min(Math.abs(o.y - y), Math.abs(o.y - n.y)) > 3 * U + Math.abs(dy)) continue;
      for (const b of livingMembers(state, o)) for (const a of mine) {
        const t = sweepEntry(x + a.off.dx * U, y + a.off.dy * U, dx, dy, b.x, b.y, U);
        if (t !== null && (!best || t < best.t)) best = { t, o, b, a };
      }
    }
    if (best) {
      const len = Math.max(Math.abs(dx), Math.abs(dy));
      return { clear: false, friendly: best.o.owner === party.owner, partyId: best.o.id, memberId: best.b.id, moverId: best.a.id, owner: best.o.owner,
        region: { column: best.o.region.column, row: best.o.region.row }, at: { x: x + dx * best.t, y: y + dy * best.t }, along: along + len * best.t, segment: i };
    }
    along += Math.max(Math.abs(dx), Math.abs(dy));
    x = n.x; y = n.y;
    if (join) { gone.add(join.id); size += livingMembers(state, join).length; }
  }
  return { clear: true };
}

/** First fraction t of a straight sweep at which one body enters another's interior, or null. */
function sweepEntry(ax, ay, dx, dy, bx, by, U) {
  let lo = 0, hi = 1;
  for (const [a, d, b] of [[ax, dx, bx], [ay, dy, by]]) {
    if (d === 0) { if (Math.abs(a - b) >= U) return null; continue; }
    let t0 = (b - U - a) / d, t1 = (b + U - a) / d;
    if (t0 > t1) [t0, t1] = [t1, t0];
    lo = Math.max(lo, t0); hi = Math.min(hi, t1);
  }
  return lo < hi ? lo : null;
}

/** Swept-contact tolerance: conservative clamping may leave bodies up to two Speed-2 quanta apart. */
export const contactTolerance = (ctx) => 4 * (ctx.geo.pitch / ctx.profile.geometry.quantaPerTick);

/** Enemy member pairs touching (faces or corners) within a tolerance. */
export function touchingPairs(state, ctx, p, o, tol) {
  const U = ctx.U;
  const pairs = [];
  for (const a of livingMembers(state, p)) for (const b of livingMembers(state, o)) {
    const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
    if (dx <= U + tol && dy <= U + tol && !(dx > U && dy > U)) {
      // face contact when the bodies overlap on the other axis; otherwise a corner
      const face = dx < U - tol || dy < U - tol ? 'face' : 'corner';
      pairs.push({ a: a.id, b: b.id, kind: face });
    }
  }
  return pairs;
}

export function inEngagement(state, partyId) {
  return Object.values(state.engagements).some((e) => e.active && (e.a === partyId || e.b === partyId));
}

export function engagementBetween(state, a, b) {
  for (const e of Object.values(state.engagements)) if (e.active && ((e.a === a && e.b === b) || (e.a === b && e.b === a))) return e;
  return null;
}

/**
 * Would a party's members overlap another body's interior if it faced `facing`? (Rearrangements
 * recheck legality at completion; on failure the old arrangement stays.)
 */
export function arrangementBlocked(state, ctx, party, facing) {
  const U = ctx.U;
  const mine = livingMembers(state, party).map((m) => {
    const off = slotOffset(m.slot, facing);
    return { x: party.x + off.dx * U, y: party.y + off.dy * U };
  });
  for (const o of Object.values(state.parties)) {
    if (o === party || !o.alive || o.retired) continue;
    if (Math.abs(o.x - party.x) >= 3 * U || Math.abs(o.y - party.y) >= 3 * U) continue;
    for (const b of livingMembers(state, o)) for (const a of mine) if (interiorOverlap(a, b, U)) return o.id;
  }
  return null;
}

/**
 * Legality of a rearrangement to `facing` (Appendix A "Formation and facing"): each living member
 * exactly once with the center kept in slot 5 (a facing change preserves both), no overlap with
 * solid terrain or another body's interior, and — in this fixture — no member relocated out of
 * current hostile contact. Members away as helpers or breachers keep their pose.
 * @returns {{ ok: true } | { ok: false, reason: string, blockedBy?: string, memberId?: string }}
 */
export function rearrangementError(state, ctx, party, facing) {
  const U = ctx.U;
  const tol = contactTolerance(ctx);
  const blockedBy = arrangementBlocked(state, ctx, party, facing);
  if (blockedBy) return { ok: false, reason: 'a member would overlap another body', blockedBy };
  const enemies = Object.values(state.members).filter((b) => b.alive && b.owner !== party.owner);
  const touches = (x, y) => enemies.some((b) => { const dx = Math.abs(b.x - x), dy = Math.abs(b.y - y); return dx <= U + tol && dy <= U + tol && !(dx > U && dy > U); });
  for (const m of livingMembers(state, party)) {
    if (m.helperAway) continue;
    const off = slotOffset(m.slot, facing);
    const x = party.x + off.dx * U, y = party.y + off.dy * U;
    if (state.terrain.kind === 'volume' && solidAt(state.terrain, cellOf(U, x), cellOf(U, y), m.band)) return { ok: false, reason: 'a member would stand inside solid terrain', memberId: m.id };
    if (touches(m.x, m.y) && !touches(x, y)) return { ok: false, reason: 'an ordinary formation change cannot move a member out of hostile contact', memberId: m.id };
  }
  return { ok: true };
}
