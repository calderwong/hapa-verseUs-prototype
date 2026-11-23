/**
 * The shared rules API (Master Requirements v3, Chapter 15 "The shared rules module and its
 * interfaces"; Appendix B "Commands and responses").
 *
 *   beginCount(state, ctx)              → mint from the completed prior state; planning opens
 *   validatePlan(state, ctx, seat, cmds) → legal commands or specific errors
 *   resolveTick(state, ctx, plans)       → generator: yields public choice requests (responses,
 *                                          allocations), returns the Tick's events
 *   runTick(state, ctx, plans, choose)   → drives resolveTick with a synchronous chooser
 *
 * Pure with respect to its inputs: no wall clock, no Math.random, no DOM. The same manifest,
 * plans and choices give the same state on every peer, bot and replay.
 */
import { emit } from './context.js';
import { clone } from './encoding.js';
import { SEATS, other, livingMembers } from './state.js';
import { activeColumnsAt, roundOf, mintAndClear, planPayment, supplyOf } from './economy.js';
import { setDestination, simulateMovement, placeMembers, planRoute, planPartyRoute, routeOrigin, touchingPairs, contactTolerance, rearrangementError, engagementBetween, fundingError } from './movement.js';
import { resolveExchange, openEngagements, checkVictory, refreshEngagements, applyCardHit, killMember, applyBreaches, applyCornerHelpers, returnHelpers } from './combat.js';
import { workError, startWork, completeWork } from './terrain.js';

// --- the Tick boundary ------------------------------------------------------------------------

/** Start the next Count: active columns, mint + replacement + pool clearing in one transaction. */
export function beginCount(state, ctx) {
  const events = [];
  if (state.outcome) return events;
  state.tick += 1;
  state.phase = 'minting';
  state.activeColumns = activeColumnsAt(ctx.profile, state.tick);
  const r = roundOf(ctx.profile, state.tick);
  emit(state, events, 'tick_started', { activeColumns: state.activeColumns, period: r.period, round: r.round });
  mintAndClear(state, ctx, events);
  state.phase = 'planning';
  return events;
}

// --- commands ---------------------------------------------------------------------------------

const UNIT_ORDERS = ['set_destination', 'change_formation', 'retreat'];

/** Why a command cannot execute now (or null). Resource admin is allowed in any column/state. */
export function commandError(state, ctx, seat, cmd) {
  const P = cmd.partyId ? state.parties[cmd.partyId] : null;
  const card = cmd.cardId ? state.cards[cmd.cardId] : null;
  const needCard = () => {
    if (!card) return 'unknown card';
    if (card.owner !== seat) return 'that card belongs to the opponent';
    if (card.state !== 'available') return `that card is no longer available (${card.state})`;
    if (state.players[seat].bank.minor[String(card.column)] !== card.id) return 'that card is not in its bank slot';
    return null;
  };
  const needParty = (p) => {
    if (!p) return 'unknown party';
    if (p.owner !== seat) return 'that party belongs to the opponent';
    if (p.retired) return `that party merged into ${p.mergedInto}`;
    if (!p.alive) return 'that party has been defeated';
    return null;
  };
  switch (cmd.type) {
    case 'load_supply': return needCard() ?? needParty(P);
    case 'burn': return needCard();
    case 'set_destination': {
      const e = needParty(P);
      if (e) return e;
      if (!P.mount) return 'an unmounted Pawn party has no ordinary movement until a Mount joins it';
      if (P.mountLost) return 'this party lost its mount and cannot travel';
      if (!state.activeColumns.includes(P.region.column)) return `column C${P.region.column} is not active this Tick`;
      if (!cmd.target) return 'no destination';
      const plan = planPartyRoute(state, ctx, P, routeOrigin(state, ctx, P), cmd.target);
      // full_route_funded_v1: the whole remaining route must be funded now (addendum HF-04)
      return plan.error ?? fundingError(state, ctx, P, cmd.target);
    }
    case 'change_formation': {
      const e = needParty(P);
      if (e) return e;
      if (!['N', 'S', 'E', 'W'].includes(cmd.facing)) return 'facing must be N, S, E or W';
      if (!state.activeColumns.includes(P.region.column)) return `column C${P.region.column} is not active this Tick`;
      if (P.formationChange || P.turn) return 'a rearrangement is already in progress';
      // while engaged it may be requested; combat keeps the old arrangement until completion
      return null;
    }
    case 'retreat': {
      const e = needParty(P);
      if (e) return e;
      if (P.state !== 'engaged') return 'only an engaged party can retreat';
      if (!P.mount || P.mountLost) return 'retreat needs a movement capability';
      if (supplyOf(P) <= 0) return 'retreat needs positive Supply';
      if (!state.activeColumns.includes(P.region.column)) return `column C${P.region.column} is not active this Tick`;
      const plan = planPartyRoute(state, ctx, P, routeOrigin(state, ctx, P), cmd.target ?? {});
      return plan.error ?? fundingError(state, ctx, P, cmd.target);
    }
    case 'play_ability': return abilityError(state, ctx, seat, cmd, 'ordinary_action');
    case 'begin_work': return workError(state, ctx, seat, cmd);
    case 'concede': return null;
    default: return `unknown command type ${cmd.type}`;
  }
}

function defOf(ctx, card) {
  return ctx.catalog.cards[card.abilityId];
}

/** Legality of an attached ability (ordinary action or response). */
function abilityError(state, ctx, seat, cmd, timing) {
  const card = state.cards[cmd.cardId];
  if (!card) return 'unknown card';
  if (card.owner !== seat) return 'that card belongs to the opponent';
  if (card.state !== 'available') return `that card is no longer available (${card.state})`;
  const def = defOf(ctx, card);
  if (!def || def.category === 'resource') return 'this card has no attached ability';
  if (timing === 'ordinary_action' && def.timing !== 'ordinary_action') return `${def.title} can only be used as a ${def.timing.replace('_', ' ')}`;
  if (timing === 'response' && def.timing !== 'response') return `${def.title} is not a response`;
  const actor = state.parties[cmd.actorPartyId];
  if (!actor || actor.owner !== seat || !actor.alive || actor.retired) return 'choose a living friendly party as the source';
  if (def.actor?.activeColumnRequired && !state.activeColumns.includes(actor.region.column)) return `the source party's column C${actor.region.column} is not active`;
  const burns = cmd.burns ?? [];
  if (burns.includes(card.id)) return 'a card cannot pay its own cost by burning itself';
  const pool = { ...state.players[seat].pool };
  for (const id of burns) {
    const b = state.cards[id];
    if (!b || b.owner !== seat || b.state !== 'available') return `burn ${id}: card not available`;
    for (const [c, n] of Object.entries(b.mana)) pool[c] = (pool[c] ?? 0) + n;
  }
  if (!planPayment(pool, def.cost?.mana ?? {})) return `cannot pay ${fmtMana(def.cost.mana)} from the Mana pool`;
  // targets
  const op = def.operations?.[0];
  if (op?.type === 'damage') {
    const m = state.members[cmd.target?.memberId];
    if (!m || !m.alive || m.owner === seat) return 'choose a living enemy member';
    const tp = state.parties[m.party];
    const d = Math.max(Math.abs(tp.region.column - actor.region.column), Math.abs(tp.region.row - actor.region.row));
    if (def.target.adjacentTerritories === 'eight_neighbors' && d !== 1) return 'the target must be in one of the eight adjacent territories';
    if (def.target.sameHeight && m.band !== actor.band) return 'the target must be at the same height';
  }
  if (op?.type === 'counter') {
    const entry = state.stack.find((e) => e.id === cmd.target?.stackId);
    if (!entry) return 'choose a pending Spell to counter';
    if (!entry.counterable) return 'that Spell cannot be countered';
  }
  if (op?.type === 'place_row_enchantment') {
    const row = cmd.target?.row;
    if (!row || !ctx.geo.onBoard(1, row)) return 'choose a row';
    if (state.players[seat].bank.rows[String(row)]) return 'that row slot is occupied';
    const enemyHalf = seat === 'A' ? row > ctx.profile.board.geographyBoundary : row <= ctx.profile.board.geographyBoundary;
    const mana = ctx.profile.board.manaRows.includes(row) || ctx.profile.board.dualRows.includes(row);
    if (!enemyHalf || !mana) return 'Row Mana Double needs an enemy-half Mana row';
  }
  if (op?.type === 'formation_immediate') {
    if (!['N', 'S', 'E', 'W'].includes(cmd.target?.facing)) return 'choose a facing';
    // Wheel Formation changes duration only: contact restrictions are checked when it resolves
  }
  return null;
}

const fmtMana = (m) => Object.entries(m).map(([c, n]) => `${n} ${c}`).join(' + ') || 'nothing';

/**
 * validatePlan: check a seat's plan in declared order against a scratch copy (later commands see
 * the effect of earlier ones, e.g. a burn before a cast). Returns accepted commands and errors.
 */
export function validatePlan(state, ctx, seat, commands) {
  const scratch = clone(state);
  const sink = [];
  const accepted = [];
  const errors = [];
  commands.forEach((cmd, index) => {
    const e = commandError(scratch, ctx, seat, cmd);
    if (e) { errors.push({ index, type: cmd.type, error: e }); return; }
    accepted.push(cmd);
    execute(scratch, ctx, sink, seat, cmd, { dryRun: true });
  });
  return { ok: errors.length === 0, accepted, errors };
}

/**
 * The plan's projected effect on a scratch state (presentation forecasts: held-plus-planned Supply,
 * funded ranges, the Mana pool after this plan's burns and payments). Same order and checks as
 * validatePlan; the real state is untouched. A projection, not a promise: the opponent's plan and
 * responses can still change the outcome.
 */
export function projectPlan(state, ctx, seat, commands) {
  const scratch = clone(state);
  const sink = [];
  const accepted = [];
  const errors = [];
  commands.forEach((cmd, index) => {
    const e = commandError(scratch, ctx, seat, cmd);
    if (e) { errors.push({ index, type: cmd.type, error: e }); return; }
    accepted.push(cmd);
    execute(scratch, ctx, sink, seat, cmd, { dryRun: true });
  });
  return { ok: errors.length === 0, accepted, errors, state: scratch, events: sink };
}

/** Pay a colored cost: burns first, then the planned assignment. */
function pay(state, ctx, events, seat, card, burns, cost) {
  for (const id of burns ?? []) burnCard(state, events, seat, state.cards[id], 'payment');
  const pool = state.players[seat].pool;
  const plan = planPayment(pool, cost ?? {});
  state.players[seat].pool = Object.fromEntries(Object.entries(plan.remaining).filter(([, n]) => n > 0));
  emit(state, events, 'mana_paid', { seat, cardId: card.id, cost, assigned: plan.assigned });
}

function burnCard(state, events, seat, card, cause) {
  card.state = 'burned';
  state.players[seat].bank.minor[String(card.column)] = null;
  const pool = state.players[seat].pool;
  for (const [c, n] of Object.entries(card.mana)) pool[c] = (pool[c] ?? 0) + n;
  emit(state, events, 'card_burned', { seat, cardId: card.id, mana: card.mana, pool: { ...pool }, cause });
}

/** Execute one accepted command now (actions revalidate at execution; rejected ones pay nothing). */
function execute(state, ctx, events, seat, cmd, opts = {}) {
  const err = commandError(state, ctx, seat, cmd);
  if (err) {
    emit(state, events, 'command_rejected', { seat, command: cmd, reason: err });
    return { error: err };
  }
  const P = cmd.partyId ? state.parties[cmd.partyId] : null;
  const card = cmd.cardId ? state.cards[cmd.cardId] : null;
  switch (cmd.type) {
    case 'load_supply':
      card.state = 'supply';
      state.players[seat].bank.minor[String(card.column)] = null;
      P.supply.push({ cardId: card.id, units: card.supply, suit: card.suit, column: card.column });
      if (P.state === 'waiting_supply' && P.route.length) P.state = 'moving';
      emit(state, events, 'supply_loaded', { seat, cardId: card.id, partyId: P.id, units: card.supply, total: supplyOf(P), partyState: P.state });
      return { ok: true };
    case 'burn':
      burnCard(state, events, seat, card, 'burn');
      return { ok: true };
    case 'set_destination':
      return setDestination(state, ctx, events, P, cmd.target, { seat, command: 'set_destination' });
    case 'change_formation':
      P.formationChange = { facing: cmd.facing, completeTick: state.tick + ctx.profile.movement.turnTicks - 1 };
      P.state = P.state === 'moving' ? 'turning' : P.state;
      emit(state, events, 'formation_change_started', { partyId: P.id, facing: cmd.facing, completesAtEndOfTick: P.formationChange.completeTick });
      return { ok: true };
    case 'retreat':
      state.pendingRetreats = [...(state.pendingRetreats ?? []), { seat, partyId: P.id, target: cmd.target }];
      emit(state, events, 'retreat_ordered', { partyId: P.id, target: cmd.target });
      return { ok: true };
    case 'begin_work':
      startWork(state, ctx, events, seat, cmd);
      return { ok: true };
    case 'concede':
      state.players[seat].conceded = true;
      emit(state, events, 'conceded', { seat });
      return { ok: true };
    case 'play_ability': {
      const def = defOf(ctx, card);
      card.state = 'played';
      state.players[seat].bank.minor[String(card.column)] = null;
      pay(state, ctx, events, seat, card, cmd.burns, def.cost?.mana);
      state.stackSeq = (state.stackSeq ?? 0) + 1;
      const entry = { id: `S${state.tick}.${state.stackSeq}`, seat, cardId: card.id, definition: `${def.id}@${def.revision}`, defId: def.id, actorPartyId: cmd.actorPartyId, target: cmd.target ?? null, counterable: !!def.counterable, countered: false };
      emit(state, events, 'ability_announced', { seat, stackId: entry.id, cardId: card.id, title: def.title, definition: `${def.id}@${def.revision}`, creator: def.lineage?.creator?.id ?? null, category: def.category, target: entry.target, actorPartyId: entry.actorPartyId, dryRun: !!opts.dryRun });
      if (def.category === 'spell' || def.category === 'enchantment') return { spell: entry };
      resolveEntry(state, ctx, events, entry); // Skills resolve at once (not on the stack)
      return { ok: true };
    }
    default:
      return { error: 'unknown command' };
  }
}

/** Apply a resolved ability's operations; targets are rechecked here. */
function resolveEntry(state, ctx, events, entry) {
  const def = ctx.catalog.cards[entry.defId];
  if (entry.countered) {
    emit(state, events, 'ability_countered', { stackId: entry.id, cardId: entry.cardId, title: def.title });
    return;
  }
  const actor = state.parties[entry.actorPartyId];
  for (const op of def.operations) {
    if (op.type === 'damage') {
      const m = state.members[entry.target?.memberId];
      if (!m?.alive) { emit(state, events, 'ability_fizzled', { stackId: entry.id, reason: 'target no longer legal' }); return; }
      for (let i = 0; i < op.hits; i++) applyCardHit(state, ctx, events, { source: entry.actorPartyId, cardId: entry.cardId, recipientId: m.id, channel: op.channel, power: op.power, face: op.incomingFace });
    } else if (op.type === 'counter') {
      const target = state.stack.find((e) => e.id === entry.target?.stackId);
      if (target && target.counterable) { target.countered = true; emit(state, events, 'counter_applied', { stackId: entry.id, countered: target.id }); }
      else emit(state, events, 'ability_fizzled', { stackId: entry.id, reason: 'no counterable target remains' });
    } else if (op.type === 'formation_immediate') {
      if (!actor?.alive) { emit(state, events, 'ability_fizzled', { stackId: entry.id, reason: 'actor gone' }); return; }
      const legal = rearrangementError(state, ctx, actor, entry.target.facing);
      if (!legal.ok) { emit(state, events, 'formation_change_failed', { partyId: actor.id, facing: entry.target.facing, kept: actor.facing, blockedBy: legal.blockedBy ?? null, memberId: legal.memberId ?? null, reason: legal.reason, cause: entry.cardId }); return; }
      actor.facing = entry.target.facing;
      actor.formationChange = null;
      placeMembers(state, ctx, actor);
      emit(state, events, 'formation_changed', { partyId: actor.id, facing: actor.facing, cause: entry.cardId, immediate: true });
      rebuildContacts(state, ctx, events, actor);
    } else if (op.type === 'place_row_enchantment') {
      const row = entry.target.row;
      state.players[entry.seat].bank.rows[String(row)] = entry.cardId;
      state.cards[entry.cardId].state = 'placed';
      const effId = `F.${entry.cardId}`;
      const mult = def.operations.find((o) => o.type === 'mint_row_multiplier');
      state.effects[effId] = { id: effId, definition: entry.definition, source: entry.cardId, owner: entry.seat, op: 'mint_row_multiplier', row, factor: mult?.factor ?? 2, active: true, createdSeq: (state.effectSeq = (state.effectSeq ?? 0) + 1) };
      emit(state, events, 'enchantment_placed', { seat: entry.seat, cardId: entry.cardId, row, effectId: effId });
    }
  }
  emit(state, events, 'ability_resolved', { stackId: entry.id, cardId: entry.cardId, title: def.title });
}

/** Response options for a seat: available response cards and the pending Spells they may target. */
export function responseOptions(state, ctx, seat) {
  const cards = Object.values(state.players[seat].bank.minor).filter(Boolean).map((id) => state.cards[id])
    .filter((c) => ctx.catalog.cards[c.abilityId]?.timing === 'response');
  return { cards: cards.map((c) => c.id), targets: state.stack.filter((e) => e.counterable && !e.countered).map((e) => e.id) };
}

/**
 * public_stack_v1: the opponent responds first; a response passes priority to the other player;
 * two consecutive passes resolve the top; afterwards the Tick's first-action player has priority.
 */
function* runStack(state, ctx, events, entry, firstSeat) {
  state.stack.push(entry);
  let priority = other(entry.seat);
  let passes = 0;
  state.phase = 'responding';
  while (state.stack.length) {
    state.choiceSeq = (state.choiceSeq ?? 0) + 1;
    const request = { kind: 'response', choiceId: `C${state.tick}.${state.choiceSeq}`, seat: priority, stack: state.stack.map((e) => ({ id: e.id, seat: e.seat, defId: e.defId, target: e.target, countered: e.countered })), options: responseOptions(state, ctx, priority) };
    state.pending = request;
    const answer = (yield request) ?? { pass: true };
    state.pending = null;
    let responded = false;
    if (!answer.pass) {
      const cmd = { type: 'play_ability', cardId: answer.cardId, actorPartyId: answer.actorPartyId, target: answer.target, burns: answer.burns };
      const err = abilityError(state, ctx, priority, cmd, 'response');
      if (err) emit(state, events, 'command_rejected', { seat: priority, command: cmd, reason: err, choiceId: request.choiceId });
      else {
        const card = state.cards[cmd.cardId];
        const def = defOf(ctx, card);
        card.state = 'played';
        state.players[priority].bank.minor[String(card.column)] = null;
        pay(state, ctx, events, priority, card, cmd.burns, def.cost?.mana);
        state.stackSeq = (state.stackSeq ?? 0) + 1;
        const resp = { id: `S${state.tick}.${state.stackSeq}`, seat: priority, cardId: card.id, definition: `${def.id}@${def.revision}`, defId: def.id, actorPartyId: cmd.actorPartyId, target: cmd.target, counterable: !!def.counterable, countered: false };
        state.stack.push(resp);
        emit(state, events, 'response_announced', { seat: priority, stackId: resp.id, cardId: card.id, title: def.title, definition: `${def.id}@${def.revision}`, creator: def.lineage?.creator?.id ?? null, target: resp.target, choiceId: request.choiceId });
        responded = true;
      }
    }
    if (responded) { passes = 0; priority = other(priority); continue; }
    emit(state, events, 'passed', { seat: priority, choiceId: request.choiceId });
    passes += 1;
    if (passes >= 2) {
      const top = state.stack.pop();
      resolveEntry(state, ctx, events, top);
      passes = 0;
      priority = firstSeat;
      if (checkVictory(state, ctx, events)) { state.stack = []; break; }
    } else priority = other(priority);
  }
  state.phase = 'resolving';
}

/** Interleave the two public plans: A first on odd Ticks, B on even; drain the remaining queue. */
export function orderActions(tick, plans) {
  const first = tick % 2 === 1 ? 'A' : 'B';
  const q = { A: [...(plans.A ?? [])], B: [...(plans.B ?? [])] };
  const out = [];
  let turn = first;
  while (q.A.length || q.B.length) {
    if (q[turn].length) out.push({ seat: turn, cmd: q[turn].shift() });
    turn = other(turn);
  }
  return { first, order: out };
}

/**
 * Resolve the agreed plans for this Tick and simulate it. Yields choice requests; returns events.
 * @param {{A: any[], B: any[]}} plans
 */
export function* resolveTick(state, ctx, plans) {
  const events = [];
  if (state.outcome) return events;
  state.phase = 'resolving';
  emit(state, events, 'plans_locked', { plans: { A: plans.A ?? [], B: plans.B ?? [] } });
  const { first, order } = orderActions(state.tick, plans);
  for (const { seat, cmd } of order) {
    if (state.outcome) break;
    const r = execute(state, ctx, events, seat, cmd);
    if (r.spell) yield* runStack(state, ctx, events, r.spell, first);
    if (checkVictory(state, ctx, events)) break;
  }
  if (!state.outcome) simulateTick(state, ctx, events);
  if (!state.outcome) finishTick(state, ctx, events);
  state.phase = state.outcome ? 'ended' : 'resolved';
  return events;
}

/** Movement and combat for one Tick: scheduled exchanges, retreats, then swept travel. */
function simulateTick(state, ctx, events) {
  state.phase = 'simulating';
  // breach: a member next to a casualty's vacated slot may step one slot in (no cascade)
  applyBreaches(state, ctx, events);
  // corner support for engagements whose neighbours became eligible since setup
  applyCornerHelpers(state, ctx, events);
  // existing engagements exchange once at the start of the movement phase
  const scheduled = Object.values(state.engagements).filter((E) => E.active && E.lastExchangeTick < state.tick).map((engagement) => ({ engagement, first: false }));
  if (scheduled.length) {
    resolveExchange(state, ctx, events, scheduled, 'scheduled');
    if (checkVictory(state, ctx, events)) return;
  }
  applyRetreats(state, ctx, events);
  if (checkVictory(state, ctx, events)) return;
  simulateMovement(state, ctx, events, (contacts, quantum) => {
    const batch = openEngagements(state, ctx, events, contacts, quantum);
    // engagement setup: eligible corner helpers step in at zero time and join the first exchange
    for (const S of applyCornerHelpers(state, ctx, events, batch.map((b) => b.engagement), quantum)) batch.push({ engagement: S, first: true });
    if (batch.length && ctx.profile.combat.firstContactExchange === 'immediate') resolveExchange(state, ctx, events, batch, 'first_contact');
    return !!checkVictory(state, ctx, events);
  });
  if (!state.outcome) checkVictory(state, ctx, events);
}

/** Retreat: own members touching enemies die; borrowed helpers return; then ordinary travel. */
function applyRetreats(state, ctx, events) {
  const tol = contactTolerance(ctx);
  for (const r of state.pendingRetreats ?? []) {
    const P = state.parties[r.partyId];
    if (!P?.alive) continue;
    const touching = new Set();
    for (const E of Object.values(state.engagements)) {
      if (!E.active || (E.a !== P.id && E.b !== P.id)) continue;
      const Q = state.parties[E.a === P.id ? E.b : E.a];
      for (const pr of touchingPairs(state, ctx, P, Q, tol)) touching.add(pr.a);
    }
    const lost = [...touching].filter((id) => state.members[id].homeParty === P.id);
    for (const id of lost) killMember(state, ctx, events, state.members[id], 'retreat');
    // neighbours' helpers supporting the withdrawing party return home alive
    const returned = [];
    for (const S of Object.values(state.engagements)) {
      if (!S.active || S.support?.helped !== P.id) continue;
      for (const id of S.support.helpers) if (state.members[id]?.alive) returned.push(id);
      returnHelpers(state, ctx, events, S, 'supported_party_retreated');
    }
    emit(state, events, 'retreated', { partyId: P.id, lost, helpersReturned: returned, target: r.target });
    // the engagement's attacker follows a withdrawing defender into the vacated territory (0 Supply)
    for (const E of Object.values(state.engagements)) {
      if (!E.active || E.defender !== P.id || !E.attacker) continue;
      const A = state.parties[E.attacker];
      if (!A?.alive || !A.mount || A.mountLost) continue;
      const vacated = { column: P.region.column, row: P.region.row };
      const origin = routeOrigin(state, ctx, A);
      const onTheWay = origin.column === vacated.column && origin.row === vacated.row; // already heading there
      if (onTheWay || planPartyRoute(state, ctx, A, origin, vacated).route) {
        A.freeFollow = { column: vacated.column, row: vacated.row };
        A.pendingFollow = { ...vacated, continueRoute: onTheWay };
      }
    }
    for (const E of Object.values(state.engagements)) if (E.active && (E.a === P.id || E.b === P.id)) { const Q = state.parties[E.a === P.id ? E.b : E.a]; E.active = false; delete state.engagements[E.id]; if (E.support) returnHelpers(state, ctx, events, E, 'enemy_retreated'); if (Q?.alive && !Object.values(state.engagements).some((x) => x.active && (x.a === Q.id || x.b === Q.id))) Q.state = Q.route.length && Q.mount && !Q.mountLost ? 'moving' : 'idle'; emit(state, events, 'engagement_ended', { engagementId: E.id, a: E.a, b: E.b, cause: 'retreat' }); }
    if (P.alive && P.mount && !P.mountLost) {
      P.state = 'idle';
      setDestination(state, ctx, events, P, r.target, { seat: r.seat, command: 'retreat' });
      P.state = 'moving';
    }
  }
  state.pendingRetreats = [];
  refreshEngagements(state, ctx, events);
  for (const A of Object.values(state.parties)) {
    if (!A.pendingFollow || !A.alive) continue;
    const t = A.pendingFollow;
    A.pendingFollow = null;
    if (Object.values(state.engagements).some((x) => x.active && (x.a === A.id || x.b === A.id))) { A.freeFollow = null; continue; }
    A.state = 'idle';
    if (!t.continueRoute) setDestination(state, ctx, events, A, { column: t.column, row: t.row }, { command: 'follow' });
    A.state = 'moving';
    emit(state, events, 'follow_started', { partyId: A.id, target: { column: t.column, row: t.row }, supplyCost: 0 });
  }
}

/**
 * After a rearrangement: open any new enemy contact it made, without another ordinary exchange in
 * this Tick (its first exchange is the next scheduled one); `refreshEngagements` ends lost ones.
 */
function rebuildContacts(state, ctx, events, P) {
  const tol = contactTolerance(ctx), U = ctx.U;
  for (const Q of Object.values(state.parties).sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (!Q.alive || Q.retired || Q.owner === P.owner) continue;
    if (Math.abs(Q.x - P.x) > 3 * U + tol || Math.abs(Q.y - P.y) > 3 * U + tol) continue;
    if (engagementBetween(state, P.id, Q.id)) continue;
    const pairs = touchingPairs(state, ctx, P, Q, tol);
    if (!pairs.length) continue;
    state.engagementSeq = (state.engagementSeq ?? 0) + 1;
    const id = `E${state.tick}.${state.engagementSeq}`;
    state.engagements[id] = { id, a: P.id, b: Q.id, active: true, attacker: null, defender: null, mutual: true, approach: { [P.id]: null, [Q.id]: null }, startTick: state.tick, startQuantum: ctx.profile.geometry.quantaPerTick, lastExchangeTick: state.tick };
    for (const p of [P, Q]) if (['idle', 'waiting_supply', 'moving'].includes(p.state)) p.state = 'engaged';
    emit(state, events, 'contact', { engagementId: id, a: P.id, b: Q.id, attacker: null, defender: null, mutual: true, quantum: null, cause: 'rearrangement', pairs: pairs.length, anchors: { [P.id]: { x: P.x, y: P.y }, [Q.id]: { x: Q.x, y: Q.y } } });
  }
  refreshEngagements(state, ctx, events);
}

/** End of Tick: turns and formation changes complete; release the planning state. */
function finishTick(state, ctx, events) {
  for (const P of Object.values(state.parties)) {
    if (!P.alive || P.retired) continue;
    if (P.turn && P.turn.completeTick <= state.tick) {
      const legal = rearrangementError(state, ctx, P, P.turn.to);
      if (!legal.ok) emit(state, events, 'turn_failed', { partyId: P.id, facing: P.turn.to, kept: P.facing, blockedBy: legal.blockedBy ?? null, memberId: legal.memberId ?? null, reason: legal.reason });
      else { P.facing = P.turn.to; placeMembers(state, ctx, P); emit(state, events, 'turn_completed', { partyId: P.id, facing: P.facing }); rebuildContacts(state, ctx, events, P); }
      P.turn = null;
      if (P.state === 'turning') P.state = P.route.length ? 'moving' : 'idle';
    }
    if (P.formationChange && P.formationChange.completeTick <= state.tick) {
      const legal = rearrangementError(state, ctx, P, P.formationChange.facing);
      if (!legal.ok) emit(state, events, 'formation_change_failed', { partyId: P.id, facing: P.formationChange.facing, kept: P.facing, blockedBy: legal.blockedBy ?? null, memberId: legal.memberId ?? null, reason: legal.reason });
      else { P.facing = P.formationChange.facing; placeMembers(state, ctx, P); emit(state, events, 'formation_changed', { partyId: P.id, facing: P.facing, immediate: false }); rebuildContacts(state, ctx, events, P); }
      P.formationChange = null;
      if (P.state === 'turning') P.state = P.route.length ? 'moving' : 'idle';
    }
  }
  completeWork(state, ctx, events);
  refreshEngagements(state, ctx, events);
  emit(state, events, 'tick_finished', { parties: Object.values(state.parties).filter((p) => p.alive && !p.retired).length, members: Object.values(state.members).filter((m) => m.alive).length });
}

/**
 * Drive one Tick's resolution with a synchronous chooser (bots, tests, replay).
 * @param {(request: any) => any} choose
 * @returns {{ events: any[], choices: {request: any, answer: any}[] }}
 */
export function runTick(state, ctx, plans, choose = () => ({ pass: true })) {
  const gen = resolveTick(state, ctx, plans);
  const choices = [];
  let step = gen.next();
  while (!step.done) {
    const answer = choose(step.value) ?? { pass: true };
    choices.push({ request: step.value, answer });
    step = gen.next(answer);
  }
  return { events: step.value, choices };
}

/** A chooser that replays recorded answers in order (replay verification). */
export const replayChooser = (answers) => {
  let i = 0;
  return () => answers[i++] ?? { pass: true };
};

export { livingMembers, supplyOf };
export const unitOrder = (cmd) => UNIT_ORDERS.includes(cmd.type);
