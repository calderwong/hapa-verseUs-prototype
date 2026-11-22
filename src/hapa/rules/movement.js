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

const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);

/** The node (territory) a party's route starts from: the next node when mid-edge. */
export function routeOrigin(state, ctx, party) {
  const { geo } = ctx;
  if (party.route.length && !atNode(ctx, party)) {
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
export function planRoute(ctx, mount, from, to) {
  const { geo, profile } = ctx;
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
      // two steps on the long axis, then one on the short axis
      const route = Math.abs(dr) === 2
        ? [{ column: from.column, row: from.row + sign(dr) }, { column: from.column, row: to.row }, { column: to.column, row: to.row }]
        : [{ column: from.column + sign(dc), row: from.row }, { column: to.column, row: from.row }, { column: to.column, row: to.row }];
      return { route, cost: profile.movement.knightRouteCost };
    }
    default:
      return { error: `unknown movement pattern ${pattern}` };
  }
}

/** Legal destinations of a party (for previews). */
export function legalDestinations(state, ctx, party) {
  if (!party.mount || !party.alive || party.retired) return [];
  const from = routeOrigin(state, ctx, party);
  const out = [];
  for (let c = 1; c <= ctx.geo.columns; c++) for (let r = 1; r <= ctx.geo.rows; r++) {
    const p = planRoute(ctx, party.mount, from, { column: c, row: r });
    if (p.route) out.push({ column: c, row: r, cost: p.cost });
  }
  return out;
}

/** Speed ratio of a party (Mount Speed; uphill modifiers belong to terrain). */
export function speedOf(ctx, party) {
  if (!party.mount) return [0, 1];
  return ctx.profile.movement.speeds[party.mount];
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
export function setDestination(state, ctx, events, party, target, cause) {
  const from = routeOrigin(state, ctx, party);
  const plan = planRoute(ctx, party.mount, from, target);
  if (plan.error) return { error: plan.error };
  const { geo } = ctx;
  const nodes = plan.route.map((n) => ({ ...n, ...geo.center(n.column, n.row) }));
  const head = from.midEdge ? [from.back ? { column: from.column, row: from.row, ...geo.center(from.column, from.row) } : party.route[0]] : [];
  party.route = [...head, ...nodes];
  party.destination = { column: target.column, row: target.row };
  if (party.state === 'idle' || party.state === 'arrived' || party.state === 'waiting_supply') party.state = 'moving';
  // an orthogonal first leg that differs from the facing takes one Tick to turn first
  const first = nodes[0];
  const start = from.midEdge ? party.route[0] : geo.center(from.column, from.row);
  const dx = first.x - start.x, dy = first.y - start.y;
  if (!from.midEdge && (!dx || !dy)) {
    const want = facingOf(dx, dy);
    if (want !== party.facing) {
      party.turn = { to: want, completeTick: state.tick + ctx.profile.movement.turnTicks - 1, reason: 'travel' };
      party.state = 'turning';
    }
  }
  emit(state, events, 'destination_set', { partyId: party.id, target: party.destination, route: party.route.map((n) => ({ column: n.column, row: n.row })), cost: plan.cost, turn: party.turn?.to ?? null, cause });
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
      const avail = supplyOf(p);
      if (avail <= 0) {
        p.state = 'waiting_supply';
        emit(state, events, 'travel_paused', { partyId: p.id, reason: 'no Supply', quantum: q, destination: p.destination });
        continue;
      }
      const node = p.route[0];
      const [num, den] = speedOf(ctx, p);
      const total = pitch * num + (p.moveRemainder ?? 0);
      let step = Math.floor(total / (Q * den));
      p.moveRemainder = total % (Q * den);
      const dx = node.x - p.x, dy = node.y - p.y;
      const along = Math.max(Math.abs(dx), Math.abs(dy));
      step = Math.min(step, along);
      // Supply limits distance: costPerPitch units per pitch of the larger axis displacement
      const affordable = Math.floor((avail * pitch) / costPerPitch);
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
      const near = others.filter((o) => o.id !== p.id && o !== mergeTarget && Math.abs(o.x - p.x) < reach && Math.abs(o.y - p.y) < reach);
      const ok = (s) => {
        const mine = bodiesAt(state, ctx, p, p.x + sx * s, p.y + sy * s, bodiesOf(p));
        for (const o of near) for (const b of bodiesOf(o)) for (const a of mine) if (interiorOverlap(a, b, U)) return false;
        return true;
      };
      let lo = 0, hi = pr.step;
      if (!ok(hi)) {
        while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (ok(mid)) lo = mid; else hi = mid - 1; }
        pr.step = lo;
        pr.blocked = true;
        if (!lo) p.blockedTick = state.tick;
      }
      pr.near = near;
    }
    // two movers closing on each other: if their new bodies overlap, both stay put this quantum
    for (let i = 0; i < proposals.length; i++) for (let j = i + 1; j < proposals.length; j++) {
      const a = proposals[i], b = proposals[j];
      const reach = 3 * U + a.step + b.step;
      if (Math.abs(a.p.x - b.p.x) >= reach || Math.abs(a.p.y - b.p.y) >= reach) continue;
      if (a.mergeTarget === b.p || b.mergeTarget === a.p) continue;
      const ba = bodiesAt(state, ctx, a.p, a.p.x + a.sx * a.step, a.p.y + a.sy * a.step, bodiesOf(a.p));
      const bb = bodiesAt(state, ctx, b.p, b.p.x + b.sx * b.step, b.p.y + b.sy * b.step, bodiesOf(b.p));
      if (ba.some((x) => bb.some((y) => interiorOverlap(x, y, U)))) { a.step = 0; b.step = 0; a.blocked = b.blocked = true; }
    }
    for (const pr of proposals) {
      const { p } = pr;
      if (pr.step > 0) {
        p.lastMovedTick = state.tick;
        p.x += pr.sx * pr.step;
        p.y += pr.sy * pr.step;
        const cost = Math.floor((pr.step * costPerPitch + (p.supplyRemainder ?? 0)) / pitch);
        p.supplyRemainder = (pr.step * costPerPitch + (p.supplyRemainder ?? 0)) % pitch;
        const spent = spendSupply(p, cost);
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
        if (pr.mergeTarget) {
          const r = mergeParties(state, ctx, events, p, pr.mergeTarget);
          if (r.error) emit(state, events, 'merge_failed', { partyId: p.id, pawnId: pr.mergeTarget.id, reason: r.error });
        }
        if (!p.route.length) {
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
