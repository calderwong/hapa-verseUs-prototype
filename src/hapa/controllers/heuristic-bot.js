/**
 * A simple heuristic controller (Master Requirements v3, Chapter 16 "Automation and balance
 * experiments"). It sees the same public state as a human, returns ordinary commands and choice
 * answers, and cannot write HP, summon resources or bypass the validator.
 *
 * Policy (deterministic; ties broken by its own xorshift32 stream, separate from game state):
 *  1. Mounts join their Pawn first, then advance toward the enemy Capital, attacking what they meet.
 *  2. Ember Strike when an enemy member is adjacent and Red can be paid (burning Red cards).
 *  3. Remaining cards load Supply into the mounted parties that need it most.
 *  4. Counter an opposing Spell with Blue Denial when Blue can be paid.
 */
import { xorshift32 } from '../rules/encoding.js';
import { legalDestinations, routeOrigin, planRoute } from '../rules/movement.js';
import { supplyOf, planPayment } from '../rules/economy.js';
import { other } from '../rules/state.js';

const living = (state, p) => Object.values(p.slots).filter((id) => id && state.members[id].alive).map((id) => state.members[id]);

export class HeuristicBot {
  /** @param {{ seat: 'A'|'B', seed?: number, aggression?: number, id?: string }} o */
  constructor(o) {
    this.seat = o.seat;
    this.type = 'bot';
    this.id = o.id ?? `heuristic-bot/${o.seat}`;
    this.revision = 'heuristic-bot/0.1.0';
    this.rng = (o.seed ?? 12345) >>> 0 || 1;
    this.aggression = o.aggression ?? 3; // rows advanced per order
  }

  rand() { this.rng = xorshift32(this.rng); return this.rng / 0x100000000; }

  /** Commands for this Tick's public plan. */
  plan(state, ctx) {
    const seat = this.seat;
    const { geo, profile } = ctx;
    const cmds = [];
    const mine = Object.values(state.parties).filter((p) => p.owner === seat && p.alive && !p.retired);
    const enemies = Object.values(state.parties).filter((p) => p.owner !== seat && p.alive && !p.retired);
    const capital = geo.toGlobal(other(seat), profile.board.capitalColumn, 1);
    const fwd = (row) => geo.toLocal(seat, 1, row).row; // home-relative row
    const bank = Object.values(state.players[seat].bank.minor).filter(Boolean).map((id) => state.cards[id]);
    const used = new Set();
    const routed = new Set();

    // 1. destinations for mounted parties in active columns
    for (const p of mine) {
      if (!p.mount || p.mountLost || p.state === 'engaged' || p.state === 'turning') continue;
      if (!state.activeColumns.includes(p.region.column)) continue;
      const stuck = p.route.length && p.state === 'moving' && (p.lastMovedTick ?? 0) < state.tick - 1;
      if (p.route.length && p.destination && !stuck) { routed.add(p.id); continue; }
      if (p.commander && enemies.some((e) => Math.max(Math.abs(e.region.column - p.region.column), Math.abs(e.region.row - p.region.row)) > 2)) continue; // the Commander holds the Capital
      const options = legalDestinations(state, ctx, p);
      if (!options.length) continue;
      const size = living(state, p).length;
      const pawns = mine.filter((q) => !q.mount && size + living(state, q).length <= 9);
      const at = (c, r) => Object.values(state.parties).find((q) => q.alive && !q.retired && q.region.column === c && q.region.row === r);
      const from = routeOrigin(state, ctx, p);
      let best = null;
      for (const o of options) {
        const occupant = at(o.column, o.row);
        if (occupant && occupant.owner === seat && (occupant.mount || !pawns.includes(occupant))) continue; // friendly obstruction
        const route = planRoute(ctx, p.mount, from, o).route ?? [];
        // a friendly party blocking an intermediate node (other than a Pawn to join) makes it a poor route
        const blocker = route.slice(0, -1).map((n) => at(n.column, n.row)).find((q) => q && q.owner === seat && !pawns.includes(q));
        if (blocker) continue;
        let score = 0;
        if (route.some((n) => pawns.some((q) => q.region.column === n.column && q.region.row === n.row))) score += 100; // join a Pawn on the way
        const gain = fwd(o.row) - fwd(p.region.row);
        if (gain < 0) continue;
        score += Math.min(gain, this.aggression) * 10 - Math.max(0, gain - this.aggression) * 6;
        const dCap = Math.max(Math.abs(o.column - capital.column), Math.abs(o.row - capital.row));
        score += (12 - dCap) * 2;
        if (occupant && occupant.owner !== seat) score += 25; // attack
        score -= o.cost * 2;
        score += this.rand();
        if (!best || score > best.score) best = { o, score };
      }
      if (best && best.score > 0) {
        cmds.push({ type: 'set_destination', partyId: p.id, target: { column: best.o.column, row: best.o.row } });
        routed.add(p.id);
      }
    }

    // 2. Ember Strike on an adjacent enemy member
    const pool = { ...state.players[seat].pool };
    for (const c of bank) {
      if (c.abilityId !== 'fixture.ember_strike' || used.has(c.id)) continue;
      const actor = mine.find((p) => state.activeColumns.includes(p.region.column) && enemies.some((e) => adjacent(e, p)));
      if (!actor) continue;
      const enemy = enemies.find((e) => adjacent(e, actor));
      const target = living(state, enemy).sort((a, b) => a.hp - b.hp || a.slot - b.slot)[0];
      if (!target) continue;
      const burns = [];
      const pay = { ...pool };
      for (const b of bank) {
        if (planPayment(pay, { red: 2 })) break;
        if (b.id === c.id || used.has(b.id) || !(b.mana.red || b.mana.rainbow)) continue;
        burns.push(b.id);
        for (const [k, n] of Object.entries(b.mana)) pay[k] = (pay[k] ?? 0) + n;
      }
      if (!planPayment(pay, { red: 2 })) continue;
      for (const id of burns) { cmds.push({ type: 'burn', cardId: id }); used.add(id); }
      Object.assign(pool, planPayment(pay, { red: 2 }).remaining);
      cmds.push({ type: 'play_ability', cardId: c.id, actorPartyId: actor.id, target: { memberId: target.id } });
      used.add(c.id);
    }

    // 3. Supply for the mounted parties that need it (keep Blue Denial cards for responses)
    const needers = mine.filter((p) => p.mount && !p.mountLost && (routed.has(p.id) || p.state === 'waiting_supply' || !p.commander))
      .map((p) => ({ p, need: (routed.has(p.id) ? 4 : 1) - supplyOf(p) / ctx.U }))
      .filter((x) => x.need > 0);
    for (const c of bank) {
      if (used.has(c.id)) continue;
      if (c.abilityId === 'fixture.blue_denial' && (c.mana.blue ?? 0) + (pool.blue ?? 0) >= 0 && this.rand() < 0.5) continue;
      needers.sort((a, b) => b.need - a.need || Math.abs(a.p.region.column - c.column) - Math.abs(b.p.region.column - c.column));
      const x = needers[0];
      if (!x) break;
      cmds.push({ type: 'load_supply', cardId: c.id, partyId: x.p.id });
      used.add(c.id);
      x.need -= c.supply / ctx.U;
      if (x.need <= 0) needers.shift();
    }
    return cmds;
  }

  /** Answer a public choice request. */
  choose(request, state, ctx) {
    if (request.kind !== 'response' || request.seat !== this.seat) return { pass: true };
    const top = request.stack[request.stack.length - 1];
    if (!top || top.seat === this.seat || top.countered) return { pass: true };
    const seat = this.seat;
    const bank = Object.values(state.players[seat].bank.minor).filter(Boolean).map((id) => state.cards[id]);
    const denial = bank.find((c) => c.abilityId === 'fixture.blue_denial');
    if (!denial) return { pass: true };
    const pool = { ...state.players[seat].pool };
    const burns = [];
    for (const b of bank) {
      if (planPayment(pool, { blue: 2 })) break;
      if (b.id === denial.id || !(b.mana.blue || b.mana.rainbow)) continue;
      burns.push(b.id);
      for (const [k, n] of Object.entries(b.mana)) pool[k] = (pool[k] ?? 0) + n;
    }
    if (!planPayment(pool, { blue: 2 })) return { pass: true };
    const actor = Object.values(state.parties).find((p) => p.owner === seat && p.alive && !p.retired);
    return { cardId: denial.id, actorPartyId: actor.id, target: { stackId: top.id }, burns };
  }
}

function adjacent(a, b) {
  const d = Math.max(Math.abs(a.region.column - b.region.column), Math.abs(a.region.row - b.region.row));
  return d === 1 && a.band === b.band;
}

