/**
 * Clock, territory income and the public banks (Master Requirements v3, Chapters 4–5; Appendix A
 * "Board time and visibility" and "Resource generation and storage").
 */
import { emit, COLORS } from './context.js';
import { SEATS, livingMembers } from './state.js';

// --- clock ------------------------------------------------------------------------------------

/** Highlighted global columns of a Tick (Ticks start at 1). */
export function activeColumnsAt(profile, tick) {
  const seq = profile.clock.activation;
  return [...seq[(tick - 1) % seq.length]];
}

/** Round label: Ticks 1–4 are the prologue; Round = 1 + completed nine-Tick intervals since 5. */
export function roundOf(profile, tick) {
  const p = profile.clock.prologueTicks;
  if (tick <= p) return { period: 'prologue', round: 0 };
  return { period: 'round', round: 1 + Math.floor((tick - p - 1) / profile.clock.roundLength) };
}

/** The next Tick (> after) at which a global column activates. */
export function nextActivation(profile, column, after) {
  for (let t = after + 1; t <= after + profile.clock.activation.length + 1; t++) if (activeColumnsAt(profile, t).includes(column)) return t;
  return null;
}

// --- territory --------------------------------------------------------------------------------

/** Geographic color(s) of a global territory: rows ≤ boundary use A's color, others B's; dual rows both. */
export function territoryColors(profile, column, row) {
  const c = profile.board.columnMap[column - 1];
  if (profile.board.dualRows.includes(row)) return c.colorA === c.colorB ? [c.colorA, c.colorB] : [c.colorA, c.colorB];
  return [row <= profile.board.geographyBoundary ? c.colorA : c.colorB];
}

/** A party anchor that can produce or block ground income: alive, grounded, exposed. */
export function groundAnchor(state, party) {
  if (!party.alive || party.retired) return false;
  if (!livingMembers(state, party).length) return false;
  if (party.movementMode !== 'ground') return false;
  return exposedAt(state, party);
}

/** Exposed-ground test (Chapter 9): flat terrain is always exposed; volume terrain checks roofs. */
export function exposedAt(state, party) {
  const t = state.terrain;
  if (t.kind === 'flat') return true;
  const key = (x, y, band) => `${x},${y},${band}`;
  const cx = Math.round(party.x / 1e6), cy = Math.round(party.y / 1e6);
  // any solid cell above the supporting position (to the top band) is a roof
  for (const band of [-3, -2, -1, 1, 2, 3]) {
    if (band <= party.band) continue;
    if (t.cells[key(cx, cy, band)]?.solid) return false;
  }
  return true;
}

/**
 * Frontier of one column for one seat: the furthest eligible friendly anchor strictly before the
 * first eligible enemy anchor scanning from home (by exact forward coordinate).
 */
export function frontier(state, ctx, seat, column) {
  const fwd = (p) => ctx.geo.forward(p.owner === seat ? seat : seat, p.y);
  const inColumn = Object.values(state.parties).filter((p) => p.region.column === column && groundAnchor(state, p));
  const enemies = inColumn.filter((p) => p.owner !== seat).sort((a, b) => fwd(a) - fwd(b) || (a.id < b.id ? -1 : 1));
  const blocker = enemies[0] ?? null;
  const friends = inColumn.filter((p) => p.owner === seat && (!blocker || fwd(p) < fwd(blocker)));
  friends.sort((a, b) => fwd(b) - fwd(a) || (a.id < b.id ? -1 : 1));
  const front = friends[0] ?? null;
  return { frontier: front, blocker };
}

/**
 * Compute what a column would mint for a seat from the current (completed) state.
 * @returns {null | { rank: number, supply: number, mana: Record<string, number>, pips: any[], frontierParty: string, frontierRow: number, blocker: string|null }}
 */
export function mintForecast(state, ctx, seat, column) {
  const { profile, geo, U } = ctx;
  const { frontier: front, blocker } = frontier(state, ctx, seat, column);
  if (!front) return null;
  const localRow = geo.toLocal(seat, column, front.region.row).row;
  const rank = Math.max(1, Math.min(profile.board.rankCap, localRow));
  const pips = [];
  for (let lr = 1; lr <= localRow; lr++) {
    const row = geo.toGlobal(seat, column, lr).row;
    if (!profile.board.manaRows.includes(row) && !profile.board.dualRows.includes(row)) continue;
    const colors = territoryColors(profile, column, row);
    for (const color of colors) {
      let amount = profile.resources.manaPerRow;
      const multipliers = [];
      for (const eff of Object.values(state.effects)) {
        if (eff.op === 'mint_row_multiplier' && eff.owner === seat && eff.row === row && eff.active) {
          amount *= eff.factor;
          multipliers.push(eff.id);
        }
      }
      pips.push({ row, color, amount, side: row <= profile.board.geographyBoundary ? 'A' : 'B', multipliers });
    }
  }
  const mana = {};
  for (const p of pips) mana[p.color] = (mana[p.color] ?? 0) + p.amount;
  return { rank, supply: rank * U, mana, pips, frontierParty: front.id, frontierRow: front.region.row, blocker: blocker?.id ?? null };
}

/**
 * The boundary transaction of `beginCount`: mint every active column for both seats from the
 * completed prior state, replace occupied bank slots, and clear unspent pool Mana.
 */
export function mintAndClear(state, ctx, events) {
  const { profile, geo } = ctx;
  for (const seat of SEATS) {
    const pool = state.players[seat].pool;
    const left = Object.entries(pool).filter(([, n]) => n > 0);
    if (left.length && !profile.resources.poolCarryover) emit(state, events, 'mana_expired', { seat, mana: Object.fromEntries(left) });
    if (!profile.resources.poolCarryover) state.players[seat].pool = {};
  }
  for (const column of state.activeColumns) {
    for (const seat of SEATS) {
      const f = mintForecast(state, ctx, seat, column);
      if (!f) {
        emit(state, events, 'mint_skipped', { seat, column, reason: 'no eligible frontier' });
        continue;
      }
      const localColumn = geo.toLocal(seat, column, 1).column;
      const colInfo = profile.board.columnMap[column - 1];
      const ability = ctx.manifest.decks?.[seat]?.bindings?.[localColumn] ?? profile.cards.bindings[localColumn] ?? profile.cards.fallback;
      const def = ctx.catalog.cards[ability];
      const id = `${seat}.C${localColumn}.T${state.tick}.0`;
      const card = {
        id, owner: seat, column, localColumn, tick: state.tick, suit: colInfo.suit, rank: f.rank,
        supply: f.supply, mana: f.mana, pips: f.pips, ability: `${def.id}@${def.revision}`, abilityId: def.id,
        state: 'available', frontierParty: f.frontierParty, frontierRow: f.frontierRow, blocker: f.blocker,
      };
      const bank = state.players[seat].bank.minor;
      const old = bank[String(column)];
      if (old) {
        state.cards[old].state = 'replaced';
        state.cards[old].retiredBy = id;
      }
      state.cards[id] = card;
      bank[String(column)] = id;
      emit(state, events, 'card_minted', {
        seat, column, localColumn, cardId: id, retired: old ?? null, rank: f.rank, suit: colInfo.suit,
        supply: f.supply, mana: f.mana, pips: f.pips, frontierParty: f.frontierParty, frontierRow: f.frontierRow, blocker: f.blocker, ability: card.ability,
      });
    }
  }
}

// --- card uses and payment --------------------------------------------------------------------

/** Total Mana available in a pool. */
export const poolTotal = (pool) => Object.values(pool).reduce((a, b) => a + b, 0);

/**
 * Plan a payment of a colored cost from a pool: Rainbow-only first, then exact colors, then Rainbow
 * substitution. Returns the assignment or null when the pool cannot pay.
 * @param {Record<string, number>} pool
 * @param {Record<string, number>} cost e.g. { red: 2 } or { rainbow_only: 1 }
 */
export function planPayment(pool, cost) {
  const left = { ...pool };
  const assigned = [];
  const need = Object.entries(cost).filter(([, n]) => n > 0);
  // Rainbow-only requirements reserve Rainbow first
  for (const [color, n] of need) {
    if (color !== 'rainbow_only') continue;
    if ((left.rainbow ?? 0) < n) return null;
    left.rainbow -= n;
    assigned.push({ requirement: 'rainbow_only', color: 'rainbow', amount: n });
  }
  for (const [color, n] of need) {
    if (color === 'rainbow_only') continue;
    if (!COLORS.includes(color)) return null;
    const exact = Math.min(n, left[color] ?? 0);
    if (exact) { left[color] -= exact; assigned.push({ requirement: color, color, amount: exact }); }
    const rest = n - exact;
    if (rest > 0) {
      if ((left.rainbow ?? 0) < rest) return null;
      left.rainbow -= rest;
      assigned.push({ requirement: color, color: 'rainbow', amount: rest });
    }
  }
  return { assigned, remaining: left };
}

/** Supply units a party holds. */
export const supplyOf = (party) => party.supply.reduce((a, p) => a + p.units, 0);

/** Spend Supply units from the oldest loaded portions first; returns the portions spent. */
export function spendSupply(party, units) {
  const spent = [];
  let left = units;
  for (const portion of party.supply) {
    if (left <= 0) break;
    const take = Math.min(portion.units, left);
    portion.units -= take;
    left -= take;
    spent.push({ cardId: portion.cardId, units: take });
  }
  party.supply = party.supply.filter((p) => p.units > 0);
  return spent;
}
