/**
 * Contextual definitions (human-feedback addendum 01 §8; review 04, R4-05).
 *
 * One versioned registry of the mechanical terms the interface shows. Each entry has its canonical
 * label and aliases, a short plain meaning, its source in the requirements, related terms, and an
 * optional current-state example computed from shared rules selectors (never a model call, never a
 * duplicated formula). Terms render as `<dfn class="term">`: hovering or focusing one shows its
 * meaning and what it means here as a true tooltip (role="tooltip", non-interactive, dismissible
 * with Escape, kept open while hovered). Definitions stay one level deep: related terms are listed
 * as words, not nested popups.
 */
import { h } from './dom.js';

export const GLOSSARY_VERSION = 'hapa-versus-glossary/1 (rules 0.2.0, Master Requirements v3 + addendum 01)';

const U = 1e6;
const pts = (u) => { const v = u / U; return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''); };

/** @type {Record<string, { label: string, aliases?: string[], short: string, source: string, related?: string[], example?: (x: any) => string|null }>} */
export const TERMS = {
  minor: { label: 'Minor Arcana', aliases: ['Supply Card', 'Card'], short: 'A public Card minted from a column each active Tick. One instance has three possible uses — Supply for a party, Burn for Mana, or its attached ability — and is consumed by whichever you choose.', source: 'Master v3 ch.5 · addendum §4', related: ['supply', 'burn', 'ability'] },
  major: { label: 'Major Arcana', short: 'A Card held in the Major bank that carries a maintained or one-time effect rather than Supply.', source: 'Master v3 ch.10', related: ['enchantment'] },
  enchantment: { label: 'row Enchantment', short: 'A placed effect on one board row (for example Row Mana Double). It is maintained in the row bank, not an available Supply Card.', source: 'Master v3 ch.10', related: ['mana'] },
  supply: { label: 'Supply', aliases: ['movement allowance'], short: 'A party\'s movement allowance: each step of travel spends it. Under this profile a new destination needs its whole route funded by held Supply plus loads planned earlier in your plan.', source: 'Master v3 ch.6 · addendum HF-04 · profile v3_02', related: ['speed', 'route', 'funded'],
    example: (x) => (x.party ? `This party holds ${pts(x.held ?? 0)}${x.planned ? ` + ${pts(x.planned)} planned` : ''}${x.need != null ? `; the selected route needs ${pts(x.need)}` : ''}.` : null) },
  funded: { label: 'funded route', short: 'A destination is funded when the Supply the party will have (held plus earlier planned loads) covers the whole remaining route, including an unfinished edge. Nothing is prepaid: travel spends the actual distance.', source: 'addendum HF-04 · docs/rules/profile-hapa_open_10x9_v3_02.md', related: ['supply', 'speed'] },
  speed: { label: 'Speed', short: 'How far a Mount travels per Tick (its rate). It does not set the range: Supply does. A Castle with 2 Supply can choose a two-step destination that takes two Ticks.', source: 'Master v3 ch.6', related: ['supply', 'route'],
    example: (x) => (x.speed ? `${x.speed} per Tick${x.uphill ? ' (halved while climbing)' : ''}.` : null) },
  route: { label: 'route', aliases: ['destination'], short: 'The path the Mount\'s pattern gives to the one destination a party holds. A new destination replaces the old one; there are no waypoints.', source: 'Master v3 ch.6', related: ['speed', 'funded'] },
  mana: { label: 'Mana', short: 'Colored resource in your basin, gained by burning Cards. Spells and abilities spend exact colors; Rainbow can stand in for any color when a payment assigns it.', source: 'Master v3 ch.5 · addendum §7', related: ['burn', 'rainbow', 'firepit'],
    example: (x) => (x.pool ? `Now: ${x.pool}.` : null) },
  rainbow: { label: 'Rainbow', short: 'Mana that can pay any one color requirement. It stays Rainbow until a payment assigns it; one unit pays one requirement.', source: 'Master v3 ch.5 (payment policy)', related: ['mana'] },
  burn: { label: 'Burn', short: 'Consume a Card in your Fire Pit for its Mana. A Card with no Mana can still be burned — it gives 0 and is simply consumed.', source: 'Master v3 ch.5 · addendum §7', related: ['mana', 'firepit'] },
  firepit: { label: 'Fire Pit', aliases: ['Mana basin'], short: 'Each owner\'s pit on the board frame where Cards are burned; the basin beside it shows that owner\'s actual Mana pool and, separately, what its current plan projects.', source: 'addendum §7', related: ['burn', 'mana'] },
  ability: { label: 'ability', aliases: ['Spell', 'Skill'], short: 'The effect attached to a Card. Using it consumes the Card and pays its exact Mana cost; Spells can be answered in a response window.', source: 'Master v3 ch.10–11', related: ['response', 'mana'] },
  rank: { label: 'rank', short: 'The Card\'s number. In this profile its Supply equals its rank.', source: 'Master v3 ch.5 (supplyCurve rank)' },
  suit: { label: 'suit', short: 'Wands, Pentacles, Cups or Swords (Wildcard in the centre column): the column family that minted the Card.', source: 'Master v3 ch.5' },
  alignment: { label: 'alignment', aliases: ['territory color'], short: 'A territory\'s Mana color. Cards minted from a column carry Mana from the colored Mana rows its frontier reached.', source: 'Master v3 ch.4–5', related: ['mana', 'frontier'] },
  mount: { label: 'Mount', short: 'A party\'s movement piece (Castle, Knight, Bishop, King, Queen, Commander). It sets the destination pattern and Speed; an unmounted Pawn cannot move on its own.', source: 'Master v3 ch.6', related: ['party', 'speed'] },
  party: { label: 'party', aliases: ['formation'], short: 'Up to nine members on a 3×3 formation around its centre. It moves, fights and receives Supply as one unit.', source: 'Master v3 ch.6–7', related: ['member', 'facing'] },
  member: { label: 'member', short: 'One body in a party: its role (Swordsman, Pikeman, Archer, Mage, Priest, or the Mount) sets its attacks and Defense.', source: 'Master v3 ch.7–8' },
  capacity: { label: 'capacity', short: 'A party holds at most nine members; merging a Pawn into a Mount fills the formation.', source: 'Master v3 ch.6' },
  health: { label: 'health', aliases: ['HP'], short: 'A member falls at 0 health; the Commander\'s fall ends the match.', source: 'Master v3 ch.8' },
  physical: { label: 'Physical', short: 'Sword, pike and arrow damage; reduced by Physical Defense on the face it hits.', source: 'Master v3 ch.8', related: ['defense'] },
  magic: { label: 'Magic', short: 'Spell and bolt damage; reduced by Magic Defense on the face it hits.', source: 'Master v3 ch.8', related: ['defense'] },
  defense: { label: 'Defense', short: 'Protection on a member face (Front, Side, Rear, Above) against one channel. It subtracts from each hit on that face.', source: 'Master v3 ch.8' },
  range: { label: 'range', short: 'How many territories away a ranged attack or ability reaches; height changes ranged range.', source: 'Master v3 ch.8' },
  facing: { label: 'facing', short: 'The world direction the formation\'s front points (N, E, S, W) — not the camera\'s. Turning takes a Tick.', source: 'Master v3 ch.7', related: ['contact'] },
  contact: { label: 'contact', short: 'Members touching across the contact strip between territories. Engaged parties exchange hits each Tick and cannot travel until one retreats or falls.', source: 'Master v3 ch.7–8' },
  tick: { label: 'Tick', short: 'One turn: mint, plan, agree (Ready), resolve. Movement and combat run in 1,000 quanta inside a Tick.', source: 'Master v3 ch.3' },
  round: { label: 'Round', short: 'Nine Ticks after the four-Tick Prologue; the active columns cycle once per Round.', source: 'Master v3 ch.3' },
  active: { label: 'active column', short: 'A column whose parties may take new move, formation or work orders this Tick, and which mints a Card. Supply can reach any party at any time while your plan is editable.', source: 'Master v3 ch.3 · actions.commandEligibility' },
  band: { label: 'band', aliases: ['height', 'layer'], short: 'One of six occupied heights: +1/+2/+3 above ground, −1/−2/−3 below. Ground 0 is the boundary, not a layer.', source: 'Design Companion ch.3–4', related: ['exposure', 'roof'] },
  exposure: { label: 'exposure', short: 'Whether a party stands open to the sky. Exposed ground parties count for income and blocking; a roofed tunnel party does not.', source: 'Master v3 ch.4 · terrain', related: ['roof', 'income'],
    example: (x) => (x.standing ? `Here: ${x.standing}.` : null) },
  roof: { label: 'roof', short: 'Solid cubes above a dug passage. A cutaway view hides them visually; it does not change the rules.', source: 'Design Companion ch.4' },
  frontier: { label: 'frontier', short: 'The farthest exposed row a column\'s parties hold; it decides that column\'s next Card and its Mana.', source: 'Master v3 ch.4–5', related: ['income'] },
  income: { label: 'income', short: 'What a column mints each active Tick from its frontier; enemy parties can block it.', source: 'Master v3 ch.4–5', related: ['frontier', 'blocking'] },
  blocking: { label: 'blocking', short: 'An exposed enemy party in a column cuts that column\'s frontier short.', source: 'Master v3 ch.4' },
  planned: { label: 'planned', short: 'An order in your public plan for this Tick. Nothing happens until both players are Ready and the Tick resolves.', source: 'Master v3 ch.16', related: ['ready'] },
  accepted: { label: 'accepted', short: 'An order the rules executed when the Tick resolved (or a destination still being travelled).', source: 'Master v3 ch.16' },
  reserved: { label: 'reserved', short: 'A Card set aside for a pending use; it cannot be used twice.', source: 'Master v3 ch.5' },
  replaced: { label: 'replaced', short: 'A newer mint took this Card\'s bank slot; the old instance is history and keeps its own identity.', source: 'Master v3 ch.5 (replace_on_mint)' },
  ready: { label: 'Ready', short: 'Freezes your plan for this Tick and acknowledges the current pair of plans. There is no Unready.', source: 'Master v3 ch.16', related: ['frozen', 'stale'] },
  frozen: { label: 'frozen', short: 'Your plan after Ready: it cannot change until the next Tick.', source: 'Master v3 ch.16' },
  stale: { label: 'stale acknowledgment', short: 'The opponent changed its plan after your Ready. Review the changes and Acknowledge; your own orders stay frozen.', source: 'Master v3 ch.16' },
  response: { label: 'response window', short: 'A public pause when a Spell is announced: the opponent may answer with a response Card or Pass. The last effect in resolves first.', source: 'Master v3 ch.11 (public_stack_v1)', related: ['pass'] },
  pass: { label: 'Pass', short: 'Decline to respond. When both players pass in turn, the top effect resolves.', source: 'Master v3 ch.11' },
  commander: { label: 'Commander', short: 'The crowned centre piece with a star. If it falls, its player loses; it is distinct from an ordinary King and from the Capital square.', source: 'Master v3 Terminal conditions', related: ['capital'] },
  capital: { label: 'Capital', short: 'The home centre square: an enemy party centre entering it ends the match.', source: 'Master v3 Terminal conditions' },
  pawn: { label: 'Pawn', short: 'An unmounted party. It stores Supply but cannot move until a Mount merges with it.', source: 'Master v3 ch.6' },
};

/** Look a term up by id, label or alias (case-insensitive). */
export function termOf(key) {
  if (TERMS[key]) return { id: key, ...TERMS[key] };
  const k = String(key).toLowerCase();
  for (const [id, t] of Object.entries(TERMS)) if (t.label.toLowerCase() === k || t.aliases?.some((a) => a.toLowerCase() === k)) return { id, ...t };
  return null;
}

let tip = null, owner = null, hideT = null;
function ensureTip() {
  if (tip) return tip;
  tip = h('div', { class: 'gloss-tip', role: 'tooltip', id: 'gloss-tip', hidden: true });
  tip.addEventListener('pointerenter', () => clearTimeout(hideT));
  tip.addEventListener('pointerleave', () => hide());
  document.body.append(tip);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !tip.hidden) { tip.hidden = true; e.stopPropagation(); } }, true);
  return tip;
}
function show(el) {
  const t = termOf(el.dataset.term);
  if (!t) return;
  clearTimeout(hideT);
  const box = ensureTip();
  const ex = el._example ? t.example?.(el._example) : null;
  box.replaceChildren(h('b', {}, t.label), t.aliases?.length ? h('span', { class: 'dim' }, ` (also: ${t.aliases.join(', ')})`) : null, h('div', {}, t.short), ex ? h('div', { class: 'gloss-ex' }, ex) : null,
    h('div', { class: 'gloss-src' }, `Source: ${t.source}${t.related?.length ? ` · related: ${t.related.map((r) => TERMS[r]?.label ?? r).join(', ')}` : ''}`));
  box.hidden = false;
  owner = el;
  el.setAttribute('aria-describedby', 'gloss-tip');
  const r = el.getBoundingClientRect(), w = Math.min(320, innerWidth - 16);
  box.style.width = `${w}px`;
  box.style.left = `${Math.max(8, Math.min(r.left, innerWidth - w - 8))}px`;
  const below = r.bottom + 6, hgt = box.offsetHeight;
  box.style.top = `${below + hgt < innerHeight - 8 ? below : Math.max(8, r.top - hgt - 6)}px`;
}
function hide(delay = 200) { clearTimeout(hideT); hideT = setTimeout(() => { if (tip) tip.hidden = true; owner?.removeAttribute('aria-describedby'); owner = null; }, delay); }

/**
 * A defined term in running text: `term('supply', 'Supply', { party, held, planned, need })`.
 * The example object feeds the entry's current-state sentence.
 */
export function term(id, text = null, example = null) {
  const t = TERMS[id];
  const el = h('dfn', { class: 'term', tabindex: '0', 'data-term': id }, text ?? t?.label ?? id);
  el._example = example;
  el.addEventListener('pointerenter', () => show(el));
  el.addEventListener('pointerleave', () => hide());
  el.addEventListener('focus', () => show(el));
  el.addEventListener('blur', () => hide(0));
  return el;
}

/** Close any open definition (e.g. when the view that held its term is removed). */
export function closeTerms() { if (tip) tip.hidden = true; }
