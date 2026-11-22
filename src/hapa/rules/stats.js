/**
 * Statistics and history projections (Master Requirements v3, Chapters 13 and 16). A projection
 * reads identified events; applying the same event twice has no second effect (idempotence by
 * event id).
 */
import { fingerprint } from './encoding.js';

/** Summary of a match's events for reports. */
export function summarize(events, state) {
  const s = {
    firstEngagementTick: null, mints: { A: 0, B: 0 }, replacedUnused: { A: 0, B: 0 }, supplyLoaded: { A: 0, B: 0 },
    manaBurned: { A: 0, B: 0 }, manaExpired: { A: 0, B: 0 }, casts: {}, damage: { physical: 0, magic: 0 }, damageByFace: {},
    casualties: { A: 0, B: 0 }, merges: 0, engagements: 0, rejected: 0,
  };
  const ownerOf = (memberId) => state.members[memberId]?.owner;
  for (const e of events) {
    switch (e.type) {
      case 'card_minted': s.mints[e.seat]++; if (e.retired) s.replacedUnused[e.seat]++; break;
      case 'supply_loaded': s.supplyLoaded[e.seat] += e.units / 1e6; break;
      case 'card_burned': s.manaBurned[e.seat] += Object.values(e.mana).reduce((a, b) => a + b, 0); break;
      case 'mana_expired': s.manaExpired[e.seat] += Object.values(e.mana).reduce((a, b) => a + b, 0); break;
      case 'ability_announced': case 'response_announced': s.casts[e.title] = (s.casts[e.title] ?? 0) + 1; break;
      case 'exchange':
        for (const h of e.hits) { s.damage[h.channel] += h.damage / 1e6; s.damageByFace[h.face] = (s.damageByFace[h.face] ?? 0) + h.damage / 1e6; }
        break;
      case 'card_damage': s.damage[e.channel] += e.damage / 1e6; break;
      case 'member_died': s.casualties[ownerOf(e.memberId)]++; break;
      case 'parties_merged': s.merges++; break;
      case 'contact': s.engagements++; if (s.firstEngagementTick === null) s.firstEngagementTick = e.tick; break;
      case 'command_rejected': s.rejected++; break;
      default: break;
    }
  }
  return s;
}

/**
 * Idempotent history store (Master Requirements v3 ch.13): events keyed by their stable id and
 * matches keyed by match id. Importing a replay, or a peer's copy of the same events, a second time
 * changes nothing; a repeated experiment is a different match id and is labeled as a repeat.
 */
export class HistoryStore {
  constructor() { this.events = new Map(); this.items = new Map(); this.kills = new Map(); this.matches = new Map(); this.catalogs = new Map(); }
  /** @param {any[]} events */
  append(events) {
    let added = 0;
    for (const e of events) {
      if (this.events.has(e.id)) continue;
      this.events.set(e.id, e);
      added++;
      if (e.type === 'member_died') this.kills.set(e.memberId, e.id);
      if (e.type === 'item_crafted' || e.type === 'deposit_extracted') this.items.set(e.itemId, e.id);
    }
    return added;
  }

  /**
   * Register a match's public agreement and outcome once, then its events.
   * @param {{ manifest: any, events: any[], outcome?: any, experimentId?: string|null }} m
   */
  importMatch({ manifest, events, outcome = null, experimentId = null }) {
    if (!this.matches.has(manifest.matchId)) {
      this.catalogs.set(manifest.catalogFingerprint, manifest.catalog);
      const used = (seat) => [...new Set([...Object.values(manifest.decks?.[seat]?.bindings ?? {}), ...Object.values(manifest.decks?.[seat]?.majors ?? {})])].sort();
      this.matches.set(manifest.matchId, {
        matchId: manifest.matchId, profileId: manifest.profile.id, profileFingerprint: manifest.profileFingerprint,
        rows: manifest.profile.board.rows, seed: manifest.randomStream?.seed ?? null,
        controllers: { A: manifest.controllers.A.type, B: manifest.controllers.B.type },
        participants: { A: manifest.participants.A.participantId, B: manifest.participants.B.participantId },
        decks: { A: fingerprint(manifest.decks?.A ?? null), B: fingerprint(manifest.decks?.B ?? null) },
        definitions: { A: used('A'), B: used('B') },
        catalogFingerprint: manifest.catalogFingerprint,
        outcome, experimentId,
      });
    }
    return this.append(events);
  }
  get size() { return this.events.size; }
}

const sorted = (m) => [...m.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
const add = (o, k, n = 1) => { o[k] = (o[k] ?? 0) + n; };
const controllerKey = (m) => `${m.controllers.A}-${m.controllers.B}`;

/** Matches and outcomes by profile, controller pairing, deck revision and seed. */
export function matchReport(store) {
  const out = {};
  for (const m of store.matches.values()) {
    const p = (out[m.profileId] ??= { matches: 0, results: {}, byControllers: {}, byDeck: {}, seeds: [], experimentRuns: 0 });
    p.matches++;
    add(p.results, m.outcome?.result === 'win' ? `${m.outcome.winner} won` : m.outcome?.result ?? 'unfinished');
    add(p.byControllers, controllerKey(m));
    add(p.byDeck, `A ${m.decks.A.slice(7, 19)} / B ${m.decks.B.slice(7, 19)}`);
    if (m.seed !== null) p.seeds.push(m.seed);
    if (m.experimentId) p.experimentRuns++;
  }
  return out;
}

/**
 * Combat credit: who delivered damage (member archetype by its attack), what Cards dealt, and
 * whose protection prevented it — separate dimensions, never one score. Raw damage, prevented
 * damage and actual health loss stay separate.
 */
export function combatCredit(store) {
  const attackRole = {};
  for (const cat of store.catalogs.values()) for (const a of Object.values(cat.archetypes)) for (const atk of a.attacks ?? []) attackRole[atk.id] = a.role;
  const byArchetype = {}, byCard = {}, prevention = {};
  const cardDef = new Map();
  for (const e of sorted(store.events)) {
    if (e.type === 'ability_announced' || e.type === 'response_announced') cardDef.set(e.cardId, e.definition ?? e.title);
    const hits = e.type === 'exchange' ? e.hits : e.type === 'card_damage' ? [e] : [];
    for (const h of hits) {
      const raw = Math.floor((h.power * 1e6 * h.ratio[0]) / h.ratio[1]);
      const prevented = Math.min(raw, h.protection * 1e6);
      const row = h.kind === 'card'
        ? (byCard[cardDef.get(h.cardId) ?? h.cardId] ??= { hits: 0, raw: 0, prevented: 0, damage: 0 })
        : (byArchetype[attackRole[h.attack] ?? h.attack] ??= { hits: 0, raw: 0, prevented: 0, damage: 0 });
      row.hits++; row.raw += raw / 1e6; row.prevented += prevented / 1e6; row.damage += h.damage / 1e6;
      for (const src of h.sources ?? []) add(prevention, `${src.scope}:${src.kind}`, src.amount);
    }
  }
  return { byArchetype, byCard, prevention };
}

/**
 * Creator statistics (ch.11 "Preserve authorship through reuse"): definitions created, matches in
 * which a definition appeared, uses, and uses by another participating identity — by controller
 * type. Each event counts once; repeated experiment runs are labeled, not counted as new people.
 */
export function creatorStats(store) {
  const creatorOf = new Map();
  for (const cat of store.catalogs.values()) for (const d of Object.values(cat.cards)) creatorOf.set(d.id, d.lineage?.creator?.id ?? 'unknown');
  const out = {};
  const row = (c) => (out[c] ??= { definitionsCreated: new Set(), matchesAppeared: new Set(), experimentRuns: new Set(), uses: 0, usesByOthers: 0, byController: {} });
  for (const [id, c] of creatorOf) row(c).definitionsCreated.add(id);
  for (const m of store.matches.values()) {
    for (const seat of ['A', 'B']) for (const id of m.definitions[seat]) {
      const r = row(creatorOf.get(id) ?? 'unknown');
      (m.experimentId ? r.experimentRuns : r.matchesAppeared).add(m.matchId);
    }
  }
  for (const e of sorted(store.events)) {
    if (e.type !== 'ability_announced' && e.type !== 'response_announced') continue;
    const m = store.matches.get(e.id.slice(0, e.id.lastIndexOf(':')));
    const c = e.creator ?? creatorOf.get((e.definition ?? '').split('@')[0]) ?? 'unknown';
    const r = row(c);
    r.uses++;
    if (m && m.participants[e.seat] !== c) r.usesByOthers++;
    if (m) add(r.byController, m.controllers[e.seat]);
  }
  return Object.fromEntries(Object.entries(out).map(([c, r]) => [c, { definitionsCreated: r.definitionsCreated.size, matchesAppeared: r.matchesAppeared.size, experimentRuns: r.experimentRuns.size, uses: r.uses, usesByOthers: r.usesByOthers, byController: r.byController }]));
}

/** Mined and crafted items with provenance, once each. */
export function itemHistory(store) {
  const out = [];
  for (const [itemId, evId] of [...store.items].sort()) {
    const e = store.events.get(evId);
    out.push(e.type === 'deposit_extracted'
      ? { itemId, kind: 'extracted', deposit: e.deposit, by: e.partyId, event: e.id }
      : { itemId, kind: 'crafted', recipe: e.recipe, inputs: e.inputs, by: e.partyId, event: e.id });
  }
  return out;
}

/**
 * A progression policy is a projection over the same events (ch.13 "Make persistence a selectable
 * projection"). Quests carry their own id and version; changing the policy never rewrites history.
 * Kinds: member_damage {role, threshold} · definition_matches {definition, threshold} ·
 * received_ability_used {participant, threshold} · mine_and_craft {threshold}.
 */
export function questProgress(store, quests) {
  const credit = combatCredit(store);
  const matchesWith = (def) => [...store.matches.values()].filter((m) => [...m.definitions.A, ...m.definitions.B].includes(def)).length;
  const creatorOf = new Map();
  for (const cat of store.catalogs.values()) for (const d of Object.values(cat.cards)) creatorOf.set(d.id, d.lineage?.creator?.id);
  return quests.map((q) => {
    let progress = 0;
    if (q.kind === 'member_damage') progress = credit.byArchetype[q.role]?.damage ?? 0;
    else if (q.kind === 'definition_matches') progress = matchesWith(q.definition);
    else if (q.kind === 'received_ability_used') {
      for (const e of store.events.values()) {
        if (e.type !== 'ability_announced') continue;
        const m = store.matches.get(e.id.slice(0, e.id.lastIndexOf(':')));
        if (m?.participants[e.seat] === q.participant && e.creator && e.creator !== q.participant) progress++;
      }
    } else if (q.kind === 'mine_and_craft') {
      const mined = new Set([...store.events.values()].filter((e) => e.type === 'deposit_extracted').map((e) => e.itemId));
      progress = [...store.events.values()].filter((e) => e.type === 'item_crafted' && e.inputs?.some((i) => mined.has(i))).length;
    }
    return { id: q.id, version: q.version, kind: q.kind, progress, threshold: q.threshold, complete: progress >= q.threshold };
  });
}
