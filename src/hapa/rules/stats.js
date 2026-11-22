/**
 * Statistics and history projections (Master Requirements v3, Chapters 13 and 16). A projection
 * reads identified events; applying the same event twice has no second effect (idempotence by
 * event id).
 */

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
 * Idempotent history projection: a store keyed by event id; importing a replay or a peer's copy
 * of the same events twice changes nothing.
 */
export class HistoryStore {
  constructor() { this.events = new Map(); this.items = new Map(); this.kills = new Map(); }
  /** @param {any[]} events */
  append(events) {
    let added = 0;
    for (const e of events) {
      if (this.events.has(e.id)) continue;
      this.events.set(e.id, e);
      added++;
      if (e.type === 'member_died') this.kills.set(e.memberId, e.id);
      if (e.type === 'item_crafted') this.items.set(e.itemId, e.id);
    }
    return added;
  }
  get size() { return this.events.size; }
}
