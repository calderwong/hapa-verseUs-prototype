/**
 * Plain-language explanations of rule events (Master Requirements v3 Chapter 12: "This arrow deals
 * 1 Physical damage. Front Defense does not cover Above. Damage received: 1."). Text is built from
 * event fields; the rules decide, the words only describe.
 */
const U = 1e6;
const pts = (u) => { const v = u / U; return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''); };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const fmtMana = (m) => Object.entries(m ?? {}).filter(([, n]) => n).map(([c, n]) => `${n} ${cap(c)}`).join(' + ') || 'no Mana';

const ROLE = { swordsman: 'Swordsman', pikeman: 'Pikeman', archer: 'Archer', mage: 'Mage', priest: 'Priest', center: 'center' };
const ATTACK = { sword: 'sword', pike: 'pike', bow: 'arrow', bolt: 'magic bolt', smite: 'smite', blade: 'blade' };

/** Name a member for players: "A's Archer (C3 party, slot 7)". */
export function memberName(state, id) {
  const m = state.members[id];
  if (!m) return id;
  const p = state.parties[m.party] ?? state.parties[m.homeParty];
  const role = m.isCenter ? `${cap(p?.mount ?? 'center')}${m.commander ? ' (Commander)' : ''}` : ROLE[m.archetype] ?? m.archetype;
  return `${m.owner}'s ${role} (R${p?.region.row}C${p?.region.column} slot ${m.slot})`;
}
export function partyName(state, id) {
  const p = state.parties[id];
  if (!p) return id;
  const kind = p.mount ? cap(p.mount) : 'Pawn';
  return `${p.owner}'s ${kind}${p.commander ? ' (Commander)' : ''} at R${p.region.row}C${p.region.column}`;
}

const SUIT_GLYPH = { wands: '♣', pentacles: '✪', cups: '♥', swords: '♠', wildcard: '✱' };
/** Name a Card instance for players: "2♣ (C9)" — its rank, suit and the owner's home column. */
export function cardName(state, id) {
  const c = state.cards[id];
  return c ? `${c.owner}'s ${c.rank ?? ''}${SUIT_GLYPH[c.suit] ?? ''} (C${c.localColumn})` : id;
}

/** One hit in words. */
export function explainHit(state, h) {
  const src = h.kind === 'card' ? `Card ${cardName(state, h.cardId)}` : memberName(state, h.source);
  const what = h.kind === 'card' ? 'Card hit' : cap(ATTACK[h.attack] ?? h.attack);
  const ratio = h.ratio && h.ratio[0] !== h.ratio[1] ? ` × ${h.ratio[0]}/${h.ratio[1]}${h.pikeTransfer ? ' (Pike transfer)' : ' (charge)'}` : '';
  const protWords = h.protection ? `${cap(h.face)} ${cap(h.channel)} Defense ${h.protection}${(h.sources ?? []).length ? ` (${h.sources.map((s) => s.kind).join(', ')})` : ''}` : `No ${cap(h.channel)} Defense covers ${cap(h.face)}`;
  return `${what} from ${src}: ${h.power}${ratio} ${cap(h.channel)} from the ${cap(h.face)} on ${memberName(state, h.recipient)}. ${protWords}. Damage received: ${pts(h.damage)}.`;
}

/** A short line for the event strip, or null to omit. */
export function eventLine(state, e) {
  switch (e.type) {
    case 'tick_started': return `Tick ${e.tick} · ${e.period === 'prologue' ? 'Prologue' : `Round ${e.round}`} · active ${e.activeColumns.map((c) => `C${c}`).join(' & ')}`;
    case 'card_minted': return `${e.seat} minted ${e.rank} of ${cap(e.suit)} in C${e.column}: Supply ${pts(e.supply)}, ${fmtMana(e.mana)}${e.retired ? ` (replaced ${e.retired})` : ''}`;
    case 'mint_skipped': return null;
    case 'mana_expired': return `${e.seat}'s unspent ${fmtMana(e.mana)} expired at the Tick boundary`;
    case 'supply_loaded': return `${e.seat} loaded ${pts(e.units)} Supply from ${cardName(state, e.cardId)} into ${partyName(state, e.partyId)} (now ${pts(e.total)})`;
    case 'card_burned': return `${e.seat} burned ${cardName(state, e.cardId)} for ${fmtMana(e.mana)}`;
    case 'destination_set': return `${partyName(state, e.partyId)} → R${e.target.row}C${e.target.column} (${e.cost ? `${e.cost} Supply` : 'along its current segment'}${e.turn ? `, turns ${e.turn} first` : ''})`;
    case 'travel_blocked': return `${partyName(state, e.partyId)} stopped: ${partyName(state, e.by)} blocks its path (destination and Supply kept)`;
    case 'parties_merged': return `${partyName(state, e.partyId)} merged with ${state.parties[e.retired] ? `its ${state.parties[e.retired].mount ? cap(state.parties[e.retired].mount) : 'Pawn'}` : e.retired}: ${e.members.length} members, Supply ${pts(e.supply)}`;
    case 'destination_reached': return `${partyName(state, e.partyId)} arrived`;
    case 'travel_paused': return `${partyName(state, e.partyId)} paused: ${e.reason}`;
    case 'contact': return `Contact at quantum ${e.quantum}: ${partyName(state, e.a)} meets ${partyName(state, e.b)}${e.mutual ? ' (mutual)' : ` — attacker ${e.attacker?.split('.').slice(0, 1)}`}`;
    case 'exchange': {
      const dmg = e.hits.reduce((a, h) => a + h.damage, 0);
      return `Exchange (${e.cause.replace('_', ' ')}): ${e.hits.length} hits, ${pts(dmg)} damage — inspect for each hit`;
    }
    case 'member_died': return `${memberName(state, e.memberId)} fell (${e.reason.replace('_', ' ')})`;
    case 'pool_damaged': return `${partyName(state, e.partyId)} pool −${pts(e.damage)} → ${pts(e.hp)}/${pts(e.max)}`;
    case 'maintenance_removed': return `Maintenance: pool supports ${e.allowedRetainers} retainers; removed ${e.removed.length}`;
    case 'engagement_ended': return `Engagement ${e.engagementId} ended`;
    case 'ability_announced': return `${e.seat} announced ${e.title}`;
    case 'response_announced': return `${e.seat} responded with ${e.title}`;
    case 'passed': return `${e.seat} passed`;
    case 'counter_applied': return `${e.countered} was countered`;
    case 'ability_countered': return `${e.title} was countered (costs stay spent)`;
    case 'card_damage': return explainHit(state, e);
    case 'ability_resolved': return `${e.title} resolved`;
    case 'ability_fizzled': return `Ability fizzled: ${e.reason}`;
    case 'enchantment_placed': return `${e.seat} placed a row Enchantment on R${e.row}`;
    case 'formation_changed': return `${partyName(state, e.partyId)} now faces ${e.facing}`;
    case 'turn_failed': case 'formation_change_failed': return `${partyName(state, e.partyId)} could not turn to ${e.facing}: ${e.reason}${e.memberId ? ` (${memberName(state, e.memberId)})` : ''}; it keeps facing ${e.kept}`;
    case 'command_rejected': return `${e.seat}'s ${e.command.type.replace('_', ' ')} rejected: ${e.reason}`;
    case 'retreated': return `${partyName(state, e.partyId)} retreated, losing ${e.lost.length} touching members${e.helpersReturned?.length ? `; ${e.helpersReturned.length} neighbouring helper${e.helpersReturned.length > 1 ? 's' : ''} returned home alive` : ''}`;
    case 'helper_stepped': return `${memberName(state, e.memberId)} stepped into the contact strip to help ${partyName(state, e.helps)} against ${partyName(state, e.against)} (no time, no Supply)`;
    case 'helper_returned': return `${memberName(state, e.memberId)} returned to ${partyName(state, e.partyId)}${e.slot !== e.homeSlot ? ` (slot ${e.slot}; its home slot was blocked)` : ''}`;
    case 'helper_return_pending': return `${memberName(state, e.memberId)} cannot return yet: no free slot in ${partyName(state, e.partyId)}`;
    case 'breach_advanced': return `${memberName(state, e.memberId)} advanced one slot into ${partyName(state, e.intoParty)}'s gap (slot ${e.intoSlot})`;
    case 'match_ended': return e.result === 'draw' ? 'The match is a draw' : `${e.winner} wins — ${e.reasons.map((r) => `${r.seat}: ${r.reason.replace('_', ' ')}`).join('; ')}`;
    case 'conceded': return `${e.seat} conceded`;
    default: return null;
  }
}
