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
import { layeredValue } from './effects.js';
import { FACINGS, slotOffset } from './geometry.js';
import { livingMembers, other } from './state.js';
import { touchingPairs, contactTolerance, engagementBetween, placeMembers as placeAll } from './movement.js';

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

/**
 * Party-scope layers for one hit: the members' explicitly party-wide protections (the Mage's ward)
 * and Card effects. Each applies once per hit calculation, not once per contributing member.
 */
function partyLayers(state, ctx, party, channel, face) {
  const layers = [];
  for (const m of livingMembers(state, party)) {
    for (const p of memberProtections(state, ctx, m)) if (p.scope === 'party' && covers(p, channel, face)) layers.push({ id: `${m.id}:${p.id}`, stage: 'add', value: p.amount, source: m.id, kind: p.id, scope: 'party' });
  }
  for (const eff of Object.values(state.effects)) {
    if (!eff.active || eff.op !== 'protection_modifier' || eff.owner !== party.owner) continue;
    if (!covers({ channel: eff.channel, faces: eff.faces }, channel, face)) continue;
    const applies = eff.scope === 'bound_party' ? eff.boundParty === party.id : eff.scope === 'column_parties' ? party.region.column === eff.column : false;
    if (applies) layers.push({ id: eff.id, stage: eff.stage ?? 'add', value: eff.amount, ratio: eff.ratio, min: eff.min, max: eff.max, createdSeq: eff.createdSeq ?? 0, dependsOn: eff.dependsOn, source: eff.id, kind: eff.definition, scope: eff.scope });
  }
  return layers;
}

/** Base contributions, then the layered stages; sources list every contribution that applied. */
function protectionTotal(base, baseSources, layers) {
  const { value, steps } = layeredValue(base, [...layers, { id: '~floor', stage: 'limit', min: 0 }]);
  const sources = [...baseSources];
  for (const l of layers) {
    const st = steps.find((x) => x.id === l.id);
    sources.push({ source: l.source, kind: l.kind, amount: st ? st.after - st.before : 0, scope: l.scope, stage: l.stage });
  }
  return { total: value, sources };
}

/** Individual protection of a recipient against one hit. */
export function individualProtection(state, ctx, m, channel, face) {
  const sources = [];
  let total = 0;
  for (const p of memberProtections(state, ctx, m)) if (p.scope !== 'party' && covers(p, channel, face)) { total += p.amount; sources.push({ source: m.id, kind: p.id, amount: p.amount, scope: 'individual' }); }
  // party protection follows membership, even for a helper standing in another party's strip
  return protectionTotal(total, sources, partyLayers(state, ctx, state.parties[m.party], channel, face));
}

/** Shared line protection: each eligible contribution on the attacked line once, plus party layers. */
function lineProtection(state, ctx, party, lineMembers, channel, face) {
  const sources = [];
  let total = 0;
  for (const m of lineMembers) for (const p of memberProtections(state, ctx, m)) if (p.scope === 'line' && covers(p, channel, face)) { total += p.amount; sources.push({ source: m.id, kind: p.id, amount: p.amount, scope: 'line' }); }
  return protectionTotal(total, sources, partyLayers(state, ctx, party, channel, face));
}

/** Residual damage (health units) of a hit: floor of exact ratio, never negative. */
export const residual = (U, power, ratio, prot) => Math.max(0, Math.floor((power * U * ratio[0] - prot * U * ratio[1]) / ratio[1]));

const bySlotThenId = (a, b) => a.slot - b.slot || (a.id < b.id ? -1 : 1);

/** The seat that allocates a hit under the profile (attacker or defender). */
function allocatorSeat(state, ctx, h) {
  return ctx.profile.combat.allocation === 'attacker' ? state.parties[h.sourceParty].owner : state.parties[h.defParty].owner;
}

/**
 * Recipient order under the allocating seat's recorded standing policy (Chapter 7: "use a
 * player's recorded standing policy to automate it"). Policies live in the manifest, so every
 * peer and replay applies the same choice:
 *   slot_order   — the Appendix A fixture: slots 1–9, then member id
 *   center_first — put damage on the center first (sacrifice it to preserve retainers)
 *   protect_ranged — Archers, Mages and Priests last
 */
export const ALLOCATION_POLICIES = ['slot_order', 'center_first', 'protect_ranged'];
function orderRecipients(ctx, seat, members) {
  const policy = ctx.manifest.allocationPolicies?.[seat] ?? 'slot_order';
  const ranged = (m) => ['archer', 'mage', 'priest'].includes(m.archetype);
  const key = policy === 'center_first' ? (m) => (m.isCenter ? 0 : 1) : policy === 'protect_ranged' ? (m) => (ranged(m) ? 1 : 0) : () => 0;
  return [...members].sort((a, b) => key(a) - key(b) || bySlotThenId(a, b));
}

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
      const legal = orderRecipients(ctx, allocatorSeat(state, ctx, h), livingMembers(state, def));
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
      const legal = orderRecipients(ctx, allocatorSeat(state, ctx, list[0]), lineMembers.length ? lineMembers : livingMembers(state, def));
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
    emit(state, events, 'engagement_ended', { engagementId: E.id, a: E.a, b: E.b, startTick: E.startTick, support: E.support ? E.support.helped : undefined });
    if (E.support) returnHelpers(state, ctx, events, E, 'support_ended');
    for (const p of [P, Q]) {
      if (!p?.alive || p.retired) continue;
      if (Object.values(state.engagements).some((x) => x.active && (x.a === p.id || x.b === p.id))) continue;
      if (recallBreaches(state, p)) placeAll(state, ctx, p);
      p.state = p.route.length && p.mount && !p.mountLost ? 'moving' : 'idle';
    }
  }
  // a living helper whose return was blocked tries again once its support has ended
  for (const m of Object.values(state.members)) {
    if (!m.alive || m.helperAway?.kind !== 'corner' || !m.helperAway.pendingReturn) continue;
    if (Object.values(state.engagements).some((x) => x.active && x.support?.helpers.includes(m.id))) continue;
    returnHelper(state, ctx, events, m, 'retry');
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

/**
 * Breach (Appendix A "Breach"): at the start of a later Tick, a member that touches a vacated
 * enemy slot square may advance one local slot into it — without moving its party anchor or
 * spending Supply. One member per vacancy, one slot per member, no cascade within the Tick.
 */
export function applyBreaches(state, ctx, events) {
  const U = ctx.U;
  const tol = contactTolerance(ctx);
  const moved = new Set();
  for (const E of Object.values(state.engagements)) {
    if (!E.active) continue;
    for (const [P, Q] of [[state.parties[E.a], state.parties[E.b]], [state.parties[E.b], state.parties[E.a]]]) {
      if (!P?.alive || !Q?.alive) continue;
      const bodies = Object.values(state.members).filter((m) => m.alive);
      for (let slot = 1; slot <= 9; slot++) {
        const id = Q.slots[String(slot)];
        if (!id || state.members[id].alive) continue; // only a casualty's slot is a breach vacancy
        const off = slotOffsetOf(Q, slot);
        const vx = Q.x + off.dx * U, vy = Q.y + off.dy * U;
        if (bodies.some((b) => Math.abs(b.x - vx) < U && Math.abs(b.y - vy) < U)) continue; // occupied
        const cand = livingMembers(state, P).filter((m) => !moved.has(m.id) && !m.isCenter
          && ((Math.abs(m.x - vx) <= U + tol && Math.abs(m.y - vy) < U - tol) || (Math.abs(m.y - vy) <= U + tol && Math.abs(m.x - vx) < U - tol))
          && (archetype(ctx, m).attacks ?? []).some((a) => a.kind === 'melee'))
          .sort(bySlotThenId)[0];
        if (!cand) continue;
        moved.add(cand.id);
        const from = { x: cand.x, y: cand.y };
        cand.x = vx; cand.y = vy;
        cand.helperAway = { kind: 'breach', intoParty: Q.id, intoSlot: slot, tick: state.tick };
        bodies.push(cand);
        emit(state, events, 'breach_advanced', { memberId: cand.id, partyId: P.id, intoParty: Q.id, intoSlot: slot, from, to: { x: vx, y: vy } });
      }
    }
  }
}

function slotOffsetOf(party, slot) {
  const row = Math.floor((slot - 1) / 3), col = (slot - 1) % 3;
  const lx = col - 1, ly = 1 - row;
  const f = FACINGS[party.facing];
  return { dx: lx * f.rx + ly * f.fx, dy: lx * f.ry + ly * f.fy };
}

/** Members that breached return to their slots when their party's engagements end. */
export function recallBreaches(state, party) {
  let any = false;
  for (const m of livingMembers(state, party)) if (m.helperAway?.kind === 'breach') { m.helperAway = null; any = true; }
  return any;
}

// --- corner support ---------------------------------------------------------------------------

const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * Corner support (Chapter 7 "Contact lines corners and breaches"; Appendix A "Corner support").
 * During engagement setup an eligible corner member of a friendly neighbouring party steps at most
 * one local member width into an unblocked contact-strip position where it touches an enemy of
 * the engagement face to face. Zero simulation time, zero party Supply; its party anchor does not
 * move. It keeps its home party, home slot and its one identity and health record.
 *
 * The helper's contact is recorded as its own contact line: a support engagement between the
 * helper's home party and the enemy, carrying `support: { helped, engagement, helpers }`. So its
 * hits and the hits it receives use the ordinary exchange (damage debits the home party, party
 * protection follows membership), its home party's ranged members may support it, and a retreat
 * by its home party sacrifices it like any own touching member.
 *
 * Eligible: a living non-center melee member, not already away and not touching any enemy, of a
 * friendly party that is idle, waiting for Supply or engaged (not travelling, turning or
 * changing formation), whose anchor is within one board step of the supported party.
 *
 * @param {any[] | null} engagements the engagements being set up (default: every active one)
 * @returns {any[]} support engagements created (they join the caller's exchange batch)
 */
export function applyCornerHelpers(state, ctx, events, engagements = null, quantum = 0) {
  const cfg = ctx.profile.combat.cornerSupport;
  if (!cfg?.enabled) return [];
  const U = ctx.U, tol = contactTolerance(ctx), pitch = ctx.geo.pitch;
  const created = [];
  const list = (engagements ?? Object.values(state.engagements)).filter((E) => E.active && !E.support).sort(byId);
  for (const E of list) {
    for (const [P, Q] of [[state.parties[E.a], state.parties[E.b]], [state.parties[E.b], state.parties[E.a]]]) {
      if (!P?.alive || !Q?.alive || P.retired || Q.retired) continue;
      const enemies = livingMembers(state, Q).sort(bySlotThenId);
      if (!enemies.length) continue;
      const neighbors = Object.values(state.parties).filter((N) => N !== P && N.owner === P.owner && N.alive && !N.retired
        && ['idle', 'waiting_supply', 'engaged'].includes(N.state) && !N.turn && !N.formationChange
        && Math.abs(N.x - P.x) <= pitch + tol && Math.abs(N.y - P.y) <= pitch + tol).sort(byId);
      for (const N of neighbors) {
        const direct = engagementBetween(state, N.id, Q.id);
        if (direct && !direct.support) continue; // already fighting that enemy itself
        const foes = Object.values(state.members).filter((b) => b.alive && b.owner !== N.owner);
        for (const h of livingMembers(state, N).sort(bySlotThenId)) {
          if (h.isCenter || h.helperAway) continue;
          if (!(archetype(ctx, h).attacks ?? []).some((a) => a.kind === 'melee')) continue;
          if (foes.some((f) => Math.abs(f.x - h.x) <= U + tol && Math.abs(f.y - h.y) <= U + tol && !(Math.abs(f.x - h.x) > U && Math.abs(f.y - h.y) > U))) continue;
          const spot = cornerSpot(state, U, h, enemies);
          if (!spot) continue;
          const from = { x: h.x, y: h.y };
          h.x = spot.x; h.y = spot.y;
          let S = engagementBetween(state, N.id, Q.id);
          if (!S) {
            state.engagementSeq = (state.engagementSeq ?? 0) + 1;
            S = {
              id: `E${state.tick}.${state.engagementSeq}`, a: N.id, b: Q.id, active: true,
              attacker: null, defender: null, mutual: true, approach: { [N.id]: null, [Q.id]: null },
              startTick: state.tick, startQuantum: quantum, lastExchangeTick: 0,
              support: { helped: P.id, engagement: E.id, helpers: [] },
            };
            state.engagements[S.id] = S;
            created.push(S);
          }
          S.support.helpers.push(h.id);
          h.helperAway = { kind: 'corner', helps: P.id, against: Q.id, engagement: S.id, tick: state.tick };
          if (N.state !== 'engaged') N.state = 'engaged';
          emit(state, events, 'helper_stepped', { memberId: h.id, partyId: N.id, homeSlot: h.slot, helps: P.id, against: Q.id, touches: spot.touches, engagementId: S.id, supportOf: E.id, from, to: { x: spot.x, y: spot.y }, supplyCost: 0, quantum });
        }
      }
    }
  }
  return created;
}

/** The nearest unblocked face-contact position within one local step, or null. */
function cornerSpot(state, U, h, enemies) {
  const bodies = Object.values(state.members).filter((b) => b.alive && b.id !== h.id);
  let best = null;
  for (const e of enemies) {
    for (const [sx, sy] of SIDES) {
      const x = e.x + sx * U, y = e.y + sy * U;
      const step = Math.max(Math.abs(x - h.x), Math.abs(y - h.y));
      if (step === 0 || step > U) continue;
      if (bodies.some((b) => Math.abs(b.x - x) < U && Math.abs(b.y - y) < U)) continue; // a blocked helper cannot occupy another body
      const manhattan = Math.abs(x - h.x) + Math.abs(y - h.y);
      if (!best || step < best.step || (step === best.step && manhattan < best.manhattan)) best = { x, y, step, manhattan, touches: e.id };
    }
  }
  return best;
}

/** Living helpers of a support engagement go back to their own formations (never resurrected). */
export function returnHelpers(state, ctx, events, S, cause) {
  for (const id of S.support?.helpers ?? []) {
    const m = state.members[id];
    if (m?.alive && m.helperAway?.kind === 'corner') returnHelper(state, ctx, events, m, cause);
  }
}

/**
 * Return one helper to its reserved home slot; if that is blocked, the nearest legal vacant
 * home-party slot (then lowest number); if none, it stays where it legally stands with a pending
 * return. It is never duplicated, overlapped or killed for want of a place.
 */
export function returnHelper(state, ctx, events, m, cause) {
  const U = ctx.U;
  const N = state.parties[m.party];
  const bodies = Object.values(state.members).filter((b) => b.alive && b.id !== m.id);
  const free = (p) => !bodies.some((b) => Math.abs(b.x - p.x) < U && Math.abs(b.y - p.y) < U);
  const at = (slot) => { const off = slotOffset(slot, N.facing); return { x: N.x + off.dx * U, y: N.y + off.dy * U }; };
  const from = { x: m.x, y: m.y };
  let slot = m.slot, pos = at(slot);
  if (!free(pos)) {
    const vacant = [1, 2, 3, 4, 6, 7, 8, 9].filter((s) => s !== m.slot && !state.members[N.slots[String(s)]]?.alive)
      .map((s) => ({ s, p: at(s) })).filter((v) => free(v.p))
      .sort((a, b) => Math.max(Math.abs(a.p.x - m.x), Math.abs(a.p.y - m.y)) - Math.max(Math.abs(b.p.x - m.x), Math.abs(b.p.y - m.y)) || a.s - b.s);
    if (!vacant.length) {
      if (!m.helperAway.pendingReturn) emit(state, events, 'helper_return_pending', { memberId: m.id, partyId: N.id, homeSlot: m.slot, cause });
      m.helperAway = { ...m.helperAway, pendingReturn: true };
      return false;
    }
    if (N.slots[String(m.slot)] === m.id) N.slots[String(m.slot)] = null;
    slot = vacant[0].s; pos = vacant[0].p;
    N.slots[String(slot)] = m.id;
    m.slot = slot;
  }
  m.x = pos.x; m.y = pos.y;
  m.helperAway = null;
  emit(state, events, 'helper_returned', { memberId: m.id, partyId: N.id, slot, homeSlot: m.homeSlot, cause, from, to: pos });
  return true;
}
