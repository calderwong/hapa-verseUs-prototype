/**
 * Party and member inspection read models (human-feedback addendum 02, HF2-04/HF2-05; review 05,
 * R5-04). Pure selectors over the authoritative state and the same combat functions the rules use,
 * so a label, a tooltip and an exchange can never disagree:
 *   - health in the form the profile uses (each member, or the shared party pool);
 *   - base attack definitions, and a target-dependent ranged preview from `rangedShot`, labelled
 *     as a preview with its context;
 *   - protection per channel and face from `individualProtection` (base + applied layers with
 *     their named sources), and in line-defense profiles the shared line value over the members a
 *     hit would reach, labelled as such;
 *   - consequential conditions and the party's collective facts (Mount, Supply held, facing,
 *     destination, band, shared pool) once, not per member.
 *   - one displayed moment (review 06, R6-03): during playback every fact is read from the state
 *     recorded right after the last event shown (`momentSlice` / `stateAt`), so a ward, a
 *     headcount, a pool and a body never come from different moments.
 * Values stay in fixed point (ctx.U); presentation formats them. No DOM, no wall clock.
 */
import { individualProtection, lineProtection, rangedShot, faceFrom } from './combat.js';
import { livingMembers } from './state.js';
import { supplyOf } from './economy.js';
import { exposed } from './terrain.js';

export const CHANNELS = ['physical', 'magic'];
export const FACES = ['front', 'left', 'right', 'rear', 'above', 'below'];

/**
 * Facts for one member.
 * @param {{ hp?: Record<string, number>, alive?: Record<string, boolean> }} [at] a presentation
 *   snapshot (e.g. playback before later hits land); omitted → the current authoritative state
 */
export function memberFacts(state, ctx, id, at = null) {
  const m = state.members[id];
  if (!m) return null;
  const def = ctx.catalog.archetypes[m.archetype] ?? {};
  const party = state.parties[m.party];
  const home = state.parties[m.homeParty ?? m.party];
  const pooled = ctx.profile.combat.health === 'party_pool' && party?.pool;
  const hp = at?.hp?.[id] ?? m.hp;
  const alive = at?.alive?.[id] ?? m.alive;
  const health = pooled
    ? { mode: 'party_pool', hp: party.pool.hp, max: party.pool.max, partyId: party.id }
    : { mode: 'member', hp, max: m.maxHp };
  const cfg = ctx.profile.combat.ranged;
  const attacks = (def.attacks ?? []).map((a) => ({ id: a.id, kind: a.kind, hits: a.hits ?? 1, power: a.power, channel: a.channel, range: a.kind === 'ranged' ? a.range ?? cfg.baseRange : null, elevationAware: !!a.elevation, needsArc: !!a.needsArc, charge: !!a.charge, face: a.face ?? null }));
  const protection = {};
  for (const channel of CHANNELS) {
    protection[channel] = {};
    for (const face of FACES) {
      const r = individualProtection(state, ctx, m, channel, face);
      const own = r.sources.filter((s) => s.source === m.id && s.scope !== 'party');
      const base = own.reduce((n, s) => n + s.amount, 0);
      if (r.total || base) protection[channel][face] = { base, total: r.total, sources: r.sources };
    }
  }
  const conditions = [];
  if (!alive) conditions.push('fallen');
  if (m.isCenter) conditions.push('center');
  if (m.commander) conditions.push('commander');
  if (m.helperAway) conditions.push(m.helperAway.kind === 'corner' ? 'helping_corner' : 'breach_advanced');
  if (party?.state === 'engaged') conditions.push('engaged');
  if (m.equipment?.torso) conditions.push('equipped');
  return {
    id, role: m.isCenter ? 'center' : m.archetype, mount: m.isCenter ? party?.mount ?? null : null, title: def.title ?? m.archetype,
    owner: m.owner, slot: m.slot, partyId: m.party, homePartyId: home?.id ?? m.party, alive, health, attacks, protection,
    protectionMode: ctx.profile.combat.protection, conditions,
  };
}

/**
 * Line-defense preview (line profiles; review 06, R6-04): the applied value of a hit that reaches
 * one edge of the formation — by default the front row (slots 1–3), the line a frontal contact
 * reaches — from the rules' own `lineProtection`. A member's own value is only its contribution.
 * @returns {{ face: string, slots: number[], members: string[], total: number, sources: any[] } | null}
 */
export function linePreview(state, ctx, partyId, channel, face = 'front') {
  const p = state.parties[partyId];
  if (!p) return null;
  const slots = face === 'front' ? [1, 2, 3] : face === 'rear' ? [7, 8, 9] : null;
  const members = slots ? slots.map((n) => state.members[p.slots[String(n)]]).filter((m) => m?.alive) : livingMembers(state, p);
  if (!members.length) return null;
  const r = lineProtection(state, ctx, p, members, channel, face);
  return { face, slots: slots ?? [], members: members.map((m) => m.id), total: r.total, sources: r.sources };
}

/**
 * The enemy parties a member's ranged attack could actually reach, in the rules' own order
 * (active engagements of its party, nearest first, within the shot's range and not blocked),
 * each with its preview. Ranged volleys only go to engaged parties; none means no preview target.
 */
export function rangedTargets(state, ctx, memberId, attackId) {
  const m = state.members[memberId], P = state.parties[m?.party];
  const atk = (ctx.catalog.archetypes[m?.archetype]?.attacks ?? []).find((a) => a.id === attackId);
  if (!m || !P || !atk || atk.kind !== 'ranged') return [];
  const pitch = ctx.geo.pitch;
  return Object.values(state.engagements ?? {}).filter((E) => E.active && (E.a === P.id || E.b === P.id))
    .map((E) => state.parties[E.a === P.id ? E.b : E.a]).filter((q) => q?.alive)
    .map((q) => ({ q, d: Math.max(Math.abs(q.x - P.x), Math.abs(q.y - P.y)) }))
    .sort((a, b) => a.d - b.d || (a.q.id < b.q.id ? -1 : 1))
    .map(({ q, d }) => ({ ...rangedPreview(state, ctx, memberId, attackId, q.id), distance: d, inRange: d <= rangedShot(state, ctx, m, P, atk, q).range * pitch }));
}

/** The shared line value of a party against a hit reaching all its living members (line profiles). */
export function partyLineProtection(state, ctx, partyId, channel, face) {
  const p = state.parties[partyId];
  return p ? lineProtection(state, ctx, p, livingMembers(state, p), channel, face) : null;
}

/** Facts shown once per party: identity, membership, collective resources and position. */
export function partyFacts(state, ctx, partyId) {
  const p = state.parties[partyId];
  if (!p) return null;
  const slots = {};
  for (let s = 1; s <= 9; s++) { const id = p.slots[String(s)]; slots[s] = id ? { id, alive: !!state.members[id]?.alive, away: !!state.members[id]?.helperAway } : null; }
  return {
    id: p.id, owner: p.owner, mount: p.mount ?? null, commander: !!p.commander, mountLost: !!p.mountLost, retired: !!p.retired, mergedInto: p.mergedInto ?? null,
    state: p.state, facing: p.facing, region: p.region, band: p.band ?? 1, movementMode: p.movementMode ?? 'ground', exposed: exposed(state, ctx, p),
    supply: supplyOf(p), destination: p.destination ?? null, pool: p.pool ? { hp: p.pool.hp, max: p.pool.max } : null,
    slots, living: livingMembers(state, p).length, centerEmpty: !p.slots['5'] || !state.members[p.slots['5']]?.alive,
  };
}

/**
 * A target-dependent ranged preview (a preview, not a result): the attack's range and power
 * against one enemy party at its height, from the rules' own `rangedShot`, and the face it would
 * strike on that party.
 */
export function rangedPreview(state, ctx, memberId, attackId, enemyPartyId) {
  const m = state.members[memberId], P = state.parties[m?.party], enemy = state.parties[enemyPartyId];
  const atk = (ctx.catalog.archetypes[m?.archetype]?.attacks ?? []).find((a) => a.id === attackId);
  if (!m || !P || !enemy || !atk || atk.kind !== 'ranged') return null;
  const shot = rangedShot(state, ctx, m, P, atk, enemy);
  const face = atk.face === 'above' ? 'above' : shot.vertical ?? faceFrom(enemy.facing, { x: m.x, y: m.y }, { x: enemy.x, y: enemy.y });
  return { ...shot, basePower: atk.power, baseRange: atk.range ?? ctx.profile.combat.ranged.baseRange, face, target: enemyPartyId, preview: true };
}

/** The parts of the state inspection reads, copied (for one recorded playback moment). */
export function momentSlice(state) {
  return structuredClone({ members: state.members, parties: state.parties, effects: state.effects, engagements: state.engagements, terrain: state.terrain, tasks: state.tasks, items: state.items });
}

/**
 * The state as of the last event shown (review 06, R6-03): `moments[n - 1]` is the slice
 * recorded right after event n; nothing shown is the state before the Tick; everything shown is
 * the accepted state. A read model only — the authoritative state is never changed.
 * @param {any} before state before the Tick @param {any[]} moments one slice per event
 * @param {number} shown events displayed so far @param {any} final the accepted state
 */
export function stateAt(before, moments, shown, final) {
  if (shown <= 0 || !moments?.length) return shown > 0 && final ? final : before;
  if (shown >= moments.length) return final ?? { ...before, ...moments.at(-1) };
  return { ...before, ...moments[shown - 1] };
}

/**
 * Presentation-time health during playback (R5-04; superseded for display by `stateAt`, which
 * also carries wards, membership and pools): the state before resolution plus only the
 * damage and deaths of events already shown. Keyed by member id.
 */
export function healthAt(before, events, shownCount) {
  const hp = {}, alive = {};
  for (const m of Object.values(before.members)) { hp[m.id] = m.hp; alive[m.id] = m.alive; }
  for (const e of events.slice(0, shownCount)) {
    const hits = e.type === 'exchange' ? e.hits : e.type === 'card_damage' ? [e] : [];
    for (const h of hits) if (h.recipient in hp && h.damage) hp[h.recipient] = Math.max(0, hp[h.recipient] - h.damage);
    if (e.type === 'member_died') alive[e.memberId] = false;
  }
  return { hp, alive };
}
