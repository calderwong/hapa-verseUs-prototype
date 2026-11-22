/**
 * Formations, contact and damage (Master Requirements v3, Chapters 7–8; Appendix A "Contact and
 * combat settings" and "The four required combat demonstrations").
 *
 * Every hit stays separate; protection acts per hit by incoming face and channel; an exchange is
 * computed from one snapshot and applied together, so a member killed in it still delivers its
 * simultaneous attacks. Four independent choices shape the result: hit structure, protection
 * aggregation (individual | line), allocation authority (attacker | defender) and health
 * representation (member | party_pool).
 */
import { emit } from './context.js';
import { FACINGS } from './geometry.js';
import { livingMembers, other } from './state.js';
import { touchingPairs, contactTolerance, engagementBetween } from './movement.js';

const FRONT_SLOTS = [1, 2, 3], SIDE_SLOTS = [4, 6], REAR_SLOTS = [7, 8, 9];

/** Incoming face on a member of a party facing `facing` from a source at (sx, sy). */
export function faceFrom(facing, from, to) {
  const f = FACINGS[facing];
  const vx = from.x - to.x, vy = from.y - to.y;
  const fwd = vx * f.fx + vy * f.fy;
  const right = vx * f.rx + vy * f.ry;
  if (Math.abs(fwd) >= Math.abs(right)) return fwd >= 0 ? 'front' : 'rear';
  return right >= 0 ? 'right' : 'left';
}

const archetype = (ctx, m) => ctx.catalog.archetypes[m.archetype];

/** Protection contributions a member carries (archetype + equipment). */
function memberProtections(state, ctx, m) {
  const list = [...(archetype(ctx, m).protections ?? [])];
  const torso = m.equipment?.torso ? state.items[m.equipment.torso] : null;
  if (torso) list.push(...(ctx.catalog.items[torso.definition]?.protections ?? []));
  return list;
}

const covers = (p, channel, face) => p.channel === channel && (p.faces === 'all' || p.faces.includes(face));

/** Explicitly party-wide protections (e.g. the Mage's ward) and Card effects, once per hit. */
function partyWide(state, ctx, party, channel, face, sources) {
  let total = 0;
  for (const m of livingMembers(state, party)) {
    for (const p of memberProtections(state, ctx, m)) if (p.scope === 'party' && covers(p, channel, face)) { total += p.amount; sources.push({ source: m.id, kind: p.id, amount: p.amount, scope: 'party' }); }
  }
  for (const eff of Object.values(state.effects)) {
    if (!eff.active || eff.op !== 'protection_modifier' || eff.owner !== party.owner) continue;
    if (!covers({ channel: eff.channel, faces: eff.faces }, channel, face)) continue;
    const applies = eff.scope === 'bound_party' ? eff.boundParty === party.id : eff.scope === 'column_parties' ? party.region.column === eff.column : false;
    if (applies) { total += eff.amount; sources.push({ source: eff.id, kind: eff.definition, amount: eff.amount, scope: eff.scope }); }
  }
  return total;
}

/** Individual protection of a recipient against one hit. */
export function individualProtection(state, ctx, m, channel, face) {
  const sources = [];
  let total = 0;
  for (const p of memberProtections(state, ctx, m)) if (p.scope !== 'party' && covers(p, channel, face)) { total += p.amount; sources.push({ source: m.id, kind: p.id, amount: p.amount, scope: 'individual' }); }
  total += partyWide(state, ctx, state.parties[m.party], channel, face, sources);
  return { total, sources };
}

/** Shared line protection: each eligible contribution on the attacked line once, plus party-wide. */
function lineProtection(state, ctx, party, lineMembers, channel, face) {
  const sources = [];
  let total = 0;
  for (const m of lineMembers) for (const p of memberProtections(state, ctx, m)) if (p.scope === 'line' && covers(p, channel, face)) { total += p.amount; sources.push({ source: m.id, kind: p.id, amount: p.amount, scope: 'line' }); }
  total += partyWide(state, ctx, party, channel, face, sources);
  return { total, sources };
}

/** Residual damage (health units) of a hit: floor of exact ratio, never negative. */
export const residual = (U, power, ratio, prot) => Math.max(0, Math.floor((power * U * ratio[0] - prot * U * ratio[1]) / ratio[1]));

const bySlotThenId = (a, b) => a.slot - b.slot || (a.id < b.id ? -1 : 1);

/**
 * Gather the hits of an exchange batch from one snapshot.
 * @param {{ engagement: any, first: boolean }[]} batch
 */
function gatherHits(state, ctx, batch) {
  const tol = contactTolerance(ctx);
  const hits = [];
  const pikeBoost = {};
  for (const { engagement: E, first } of batch) {
    const P = state.parties[E.a], Q = state.parties[E.b];
    for (const [att, def] of [[P, Q], [Q, P]]) {
      const pairs = touchingPairs(state, ctx, att, def, tol);
      const byAttacker = new Map();
      for (const pr of pairs) {
        const am = state.members[pr.a], tm = state.members[pr.b];
        const myFace = faceFrom(att.facing, tm, am);
        const list = byAttacker.get(am.id) ?? new Map();
        const cands = list.get(myFace) ?? [];
        cands.push({ tm, kind: pr.kind });
        list.set(myFace, cands);
        byAttacker.set(am.id, list);
      }
      for (const [amId, faces] of byAttacker) {
        const am = state.members[amId];
        const melee = (archetype(ctx, am).attacks ?? []).filter((a) => a.kind === 'melee');
        if (!melee.length) continue;
        for (const [, cands] of faces) {
          cands.sort((x, y) => (x.kind === y.kind ? 0 : x.kind === 'face' ? -1 : 1) || bySlotThenId(x.tm, y.tm));
          const tm = cands[0].tm;
          const inFace = faceFrom(def.facing, am, tm);
          for (const atk of melee) {
            let ratio = [1, 1];
            const approaching = first && (E.mutual || E.attacker === att.id) && atk.charge && ctx.profile.combat.charge.enabled;
            if (approaching && E.approach[att.id]) ratio = [...E.approach[att.id]];
            // a stationary entrenched Pike facing the charge takes the multiplier for its own impact
            if (ratio[0] > ratio[1] && ctx.profile.combat.pike.transfer && archetype(ctx, tm).traits?.includes('pike_entrench') && inFace === 'front' && !E.approach[def.id] && !def.turn) {
              pikeBoost[`${tm.id}>${am.id}`] = ratio;
              ratio = [1, 1];
            }
            for (let h = 0; h < atk.hits; h++) {
              hits.push({ kind: 'melee', engagement: E.id, source: am.id, sourceParty: att.id, attack: atk.id, channel: atk.channel, power: atk.power, ratio, defParty: def.id, fixed: tm.id, face: inFace, line: `${def.id}:${inFace}` });
            }
          }
        }
      }
    }
  }
  // the Pike's impact uses the transferred multiplier
  for (const h of hits) {
    const boost = pikeBoost[`${h.source}>${h.fixed}`];
    if (boost) { h.ratio = boost; h.pikeTransfer = true; }
  }
  // ranged support: one volley per member per Tick, from parties in this batch's engagements
  const involved = new Set(batch.flatMap(({ engagement: E }) => [E.a, E.b]));
  const pitch = ctx.geo.pitch;
  for (const pid of [...involved].sort()) {
    const P = state.parties[pid];
    if (!P?.alive) continue;
    const enemies = Object.values(state.engagements).filter((E) => E.active && (E.a === pid || E.b === pid))
      .map((E) => ({ E, enemy: state.parties[E.a === pid ? E.b : E.a] }))
      .filter(({ enemy }) => enemy?.alive)
      .map((x) => ({ ...x, d: Math.max(Math.abs(x.enemy.x - P.x), Math.abs(x.enemy.y - P.y)) }))
      .sort((a, b) => a.d - b.d || (a.E.id < b.E.id ? -1 : 1));
    for (const m of livingMembers(state, P).sort(bySlotThenId)) {
      const ranged = (archetype(ctx, m).attacks ?? []).filter((a) => a.kind === 'ranged');
      if (!ranged.length || m.lastVolleyTick === state.tick) continue;
      for (const atk of ranged) {
        const range = atk.range ?? ctx.profile.combat.ranged.baseRange;
        const target = enemies.find(({ d }) => d <= range * pitch);
        if (!target) continue;
        m.lastVolleyTick = state.tick;
        for (let h = 0; h < atk.hits; h++) {
          const face = atk.face === 'above' ? 'above' : faceFrom(target.enemy.facing, m, target.enemy);
          hits.push({ kind: 'ranged', engagement: target.E.id, source: m.id, sourceParty: P.id, attack: atk.id, channel: atk.channel, power: atk.power, ratio: [1, 1], defParty: target.enemy.id, fixed: null, face, line: `${target.enemy.id}:${face}` });
        }
      }
    }
  }
  return hits;
}

/**
 * Resolve one simultaneous exchange batch. Returns the damage records.
 * @param {{ engagement: any, first: boolean }[]} batch
 */
export function resolveExchange(state, ctx, events, batch, cause) {
  const { U, profile } = ctx;
  const mode = profile.combat;
  const hits = gatherHits(state, ctx, batch);
  if (!hits.length) {
    for (const { engagement } of batch) engagement.lastExchangeTick = state.tick;
    return [];
  }
  const projected = {};
  const hpOf = (m) => projected[m.id] ?? m.hp;
  const records = [];
  const pool = {};

  const assign = (h, recipient, prot, sources, damage) => {
    records.push({ ...h, recipient: recipient.id, protection: prot, protectionSources: sources, damage, allocator: allocatorOf(h) });
    if (mode.health === 'party_pool') pool[recipient.homeParty] = (pool[recipient.homeParty] ?? 0) + damage;
    else projected[recipient.id] = hpOf(recipient) - damage;
  };
  const allocatorOf = (h) => (h.fixed && mode.protection === 'individual' ? 'contact' : mode.allocation === 'attacker' ? state.parties[h.sourceParty].owner : state.parties[h.defParty].owner);

  if (mode.protection === 'individual') {
    // fixed melee contacts first, then ranged hits assigned raw before protection
    for (const h of hits.filter((x) => x.fixed)) {
      const r = state.members[h.fixed];
      const { total, sources } = individualProtection(state, ctx, r, h.channel, h.face);
      assign(h, r, total, sources, residual(U, h.power, h.ratio, total));
    }
    for (const h of hits.filter((x) => !x.fixed)) {
      const def = state.parties[h.defParty];
      const legal = livingMembers(state, def).sort(bySlotThenId);
      if (!legal.length) continue;
      let r = legal.find((m) => mode.health === 'party_pool' || hpOf(m) > 0) ?? legal[0];
      const face = h.face === 'above' ? 'above' : faceFrom(def.facing, state.members[h.source], r);
      const { total, sources } = individualProtection(state, ctx, r, h.channel, face);
      assign({ ...h, face }, r, total, sources, residual(U, h.power, h.ratio, total));
    }
  } else {
    // shared protection per line scope; residual assigned within that scope
    const scopes = new Map();
    for (const h of hits) {
      const list = scopes.get(h.line) ?? [];
      list.push(h);
      scopes.set(h.line, list);
    }
    for (const [line, list] of [...scopes].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      const def = state.parties[list[0].defParty];
      const face = list[0].face;
      const lineMembers = face === 'above' || list.every((h) => !h.fixed)
        ? livingMembers(state, def)
        : [...new Set(list.filter((h) => h.fixed).map((h) => h.fixed))].map((id) => state.members[id]).filter((m) => m.alive);
      const legal = (lineMembers.length ? lineMembers : livingMembers(state, def)).sort(bySlotThenId);
      const { total, sources } = lineProtection(state, ctx, def, legal, list[0].channel, face);
      for (const h of list) {
        let left = residual(U, h.power, h.ratio, total);
        const pre = left;
        if (mode.health === 'party_pool') {
          const r = h.fixed ? state.members[h.fixed] : legal[0];
          if (r) assign(h, r, total, sources, left);
          continue;
        }
        if (!left) { assign(h, legal[0], total, sources, 0); continue; }
        for (const r of legal) {
          if (left <= 0) break;
          const room = Math.max(0, hpOf(r));
          if (!room) continue;
          const take = Math.min(room, left);
          assign(h, r, total, sources, take);
          left -= take;
        }
        if (left > 0) assign(h, legal[0], total, sources, left); // overkill stays in this scope
        void pre;
      }
      void line;
    }
  }

  // apply together
  const died = [];
  if (mode.health === 'party_pool') {
    for (const [pid, dmg] of Object.entries(pool)) {
      const P = state.parties[pid];
      if (!P.pool) continue;
      P.pool.hp -= dmg;
      emit(state, events, 'pool_damaged', { partyId: pid, damage: dmg, hp: P.pool.hp, max: P.pool.max });
    }
  } else {
    for (const [mid, hp] of Object.entries(projected)) state.members[mid].hp = hp;
  }
  emit(state, events, 'exchange', {
    cause, engagements: batch.map((b) => b.engagement.id), first: batch.map((b) => b.first),
    mode: { protection: mode.protection, allocation: mode.allocation, health: mode.health },
    hits: records.map((r) => ({ kind: r.kind, source: r.source, attack: r.attack, recipient: r.recipient, channel: r.channel, face: r.face, power: r.power, ratio: r.ratio, protection: r.protection, sources: r.protectionSources, damage: r.damage, allocator: r.allocator, pikeTransfer: !!r.pikeTransfer, line: r.line })),
  });
  if (mode.health === 'party_pool') {
    for (const pid of Object.keys(pool)) maintain(state, ctx, events, state.parties[pid], died);
  } else {
    for (const m of Object.values(state.members)) if (m.alive && m.hp <= 0 && projected[m.id] !== undefined) { killMember(state, ctx, events, m, 'damage'); died.push(m.id); }
  }
  for (const { engagement } of batch) engagement.lastExchangeTick = state.tick;
  refreshEngagements(state, ctx, events);
  return records;
}

/**
 * One Card-made hit (e.g. Ember Strike) on a chosen member: the recipient's own face/channel
 * protection plus party-wide effects; party-pool profiles debit the home pool, then maintain.
 */
export function applyCardHit(state, ctx, events, { source, cardId, recipientId, channel, power, face }) {
  const { U } = ctx;
  const r = state.members[recipientId];
  const { total, sources } = individualProtection(state, ctx, r, channel, face);
  const damage = residual(U, power, [1, 1], total);
  const rec = { kind: 'card', source, cardId, recipient: r.id, channel, face, power, ratio: [1, 1], protection: total, sources, damage };
  if (ctx.profile.combat.health === 'party_pool') {
    const P = state.parties[r.homeParty];
    P.pool.hp -= damage;
    emit(state, events, 'card_damage', rec);
    maintain(state, ctx, events, P);
  } else {
    r.hp -= damage;
    emit(state, events, 'card_damage', rec);
    if (r.hp <= 0) killMember(state, ctx, events, r, 'damage');
  }
  return rec;
}

/** Party-pool maintenance: keep only the retainers the pool supports beyond the center reserve. */
export function maintain(state, ctx, events, party, died = []) {
  const { U } = ctx;
  const mt = ctx.profile.combat.maintenance;
  const living = livingMembers(state, party);
  if (party.pool.hp <= 0) {
    for (const m of living) { killMember(state, ctx, events, m, 'pool_exhausted'); died.push(m.id); }
    return;
  }
  const center = living.find((m) => m.isCenter);
  const reserve = center ? mt.centerReserve * U : 0;
  const allowed = Math.floor(Math.max(0, party.pool.hp - reserve) / (mt.retainerRequirement * U));
  const retainers = living.filter((m) => !m.isCenter);
  const excess = retainers.length - allowed;
  if (excess <= 0) return;
  const rank = (m) => (FRONT_SLOTS.includes(m.slot) ? 0 : SIDE_SLOTS.includes(m.slot) ? 1 : REAR_SLOTS.includes(m.slot) ? 2 : 3);
  const order = retainers.sort((a, b) => rank(a) - rank(b) || a.slot - b.slot || (a.id < b.id ? -1 : 1));
  const removed = order.slice(0, excess);
  for (const m of removed) { killMember(state, ctx, events, m, 'maintenance'); died.push(m.id); }
  emit(state, events, 'maintenance_removed', { partyId: party.id, pool: party.pool.hp, allowedRetainers: allowed, removed: removed.map((m) => m.id) });
}

export function killMember(state, ctx, events, m, reason) {
  m.alive = false;
  m.hp = Math.min(m.hp, 0);
  const party = state.parties[m.party];
  emit(state, events, 'member_died', { memberId: m.id, partyId: m.party, archetype: m.archetype, slot: m.slot, reason, commander: !!m.commander });
  if (m.isCenter && party && !m.commander) {
    party.mountLost = true;
    if (party.state === 'moving') party.state = 'idle';
  }
  if (party && !livingMembers(state, party).length) {
    party.alive = false;
    party.state = 'defeated';
    emit(state, events, 'party_defeated', { partyId: party.id });
  }
}

/** Open engagements for new contacts; returns the batch for an immediate first exchange. */
export function openEngagements(state, ctx, events, contacts, quantum) {
  const batch = [];
  for (const c of contacts) {
    const { mover: P, other: Q } = c;
    if (engagementBetween(state, P.id, Q.id)) continue;
    // approach along the contact normal decides attacker, defender or mutual
    const normal = dominant(Q.x - P.x, Q.y - P.y);
    const dir = (p) => {
      if (p.state !== 'moving' || !p.route.length) return { x: 0, y: 0 };
      return { x: Math.sign(p.route[0].x - p.x), y: Math.sign(p.route[0].y - p.y) };
    };
    const dp = dir(P), dq = dir(Q);
    const pApproach = dp.x * normal.x + dp.y * normal.y > 0;
    const qApproach = -(dq.x * normal.x + dq.y * normal.y) > 0;
    const speed = (p) => ctx.profile.movement.speeds[p.mount] ?? [1, 1];
    state.engagementSeq = (state.engagementSeq ?? 0) + 1;
    const id = `E${state.tick}.${state.engagementSeq}`;
    const mutual = pApproach && qApproach;
    const E = {
      id, a: P.id, b: Q.id, active: true,
      attacker: mutual ? null : pApproach ? P.id : qApproach ? Q.id : null,
      defender: mutual ? null : pApproach ? Q.id : qApproach ? P.id : null,
      mutual: mutual || (!pApproach && !qApproach),
      approach: { [P.id]: pApproach ? speed(P) : null, [Q.id]: qApproach ? speed(Q) : null },
      startTick: state.tick, startQuantum: quantum, lastExchangeTick: 0,
    };
    state.engagements[id] = E;
    for (const p of [P, Q]) if (p.state === 'moving' || p.state === 'idle' || p.state === 'waiting_supply') p.state = 'engaged';
    emit(state, events, 'contact', { engagementId: id, a: P.id, b: Q.id, attacker: E.attacker, defender: E.defender, mutual: E.mutual, quantum, approach: E.approach, pairs: c.pairs.length, anchors: { [P.id]: { x: P.x, y: P.y }, [Q.id]: { x: Q.x, y: Q.y } } });
    batch.push({ engagement: E, first: true });
  }
  return batch;
}

const dominant = (dx, dy) => (Math.abs(dy) >= Math.abs(dx) ? { x: 0, y: Math.sign(dy) } : { x: Math.sign(dx), y: 0 });

/** End engagements whose parties no longer touch; released parties resume travel. */
export function refreshEngagements(state, ctx, events) {
  const tol = contactTolerance(ctx);
  for (const E of Object.values(state.engagements)) {
    if (!E.active) continue;
    const P = state.parties[E.a], Q = state.parties[E.b];
    const still = P?.alive && Q?.alive && touchingPairs(state, ctx, P, Q, tol).length > 0;
    if (still) continue;
    E.active = false;
    delete state.engagements[E.id]; // the events keep its history
    emit(state, events, 'engagement_ended', { engagementId: E.id, a: E.a, b: E.b, startTick: E.startTick });
    for (const p of [P, Q]) {
      if (!p?.alive || p.retired) continue;
      if (Object.values(state.engagements).some((x) => x.active && (x.a === p.id || x.b === p.id))) continue;
      p.state = p.route.length && p.mount && !p.mountLost ? 'moving' : 'idle';
    }
  }
}

/** Victory after a simultaneous batch: Commander death or an enemy anchor in a Capital. */
export function checkVictory(state, ctx, events) {
  if (state.outcome) return state.outcome;
  const { profile, geo } = ctx;
  const losers = new Set();
  const reasons = [];
  for (const seat of ['A', 'B']) {
    const cmd = Object.values(state.members).find((m) => m.commander && m.owner === seat);
    if (profile.victory.commanderDeath && cmd && !cmd.alive) { losers.add(seat); reasons.push({ seat, reason: 'commander_died', memberId: cmd.id }); }
    const cap = geo.toGlobal(seat, profile.board.capitalColumn, 1);
    if (profile.victory.capitalCapture) {
      const intruder = Object.values(state.parties).find((p) => p.alive && !p.retired && p.owner !== seat && p.region.column === cap.column && p.region.row === cap.row);
      if (intruder) { losers.add(seat); reasons.push({ seat, reason: 'capital_captured', partyId: intruder.id, capital: cap }); }
    }
    if (state.players[seat].conceded) { losers.add(seat); reasons.push({ seat, reason: 'conceded' }); }
  }
  if (!losers.size) return null;
  const result = losers.size === 2 ? { result: 'draw' } : { result: 'win', winner: other([...losers][0]), loser: [...losers][0] };
  state.outcome = { ...result, tick: state.tick, reasons };
  state.phase = 'ended';
  emit(state, events, 'match_ended', state.outcome);
  return state.outcome;
}
