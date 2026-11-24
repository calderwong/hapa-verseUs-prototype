/**
 * The close-inspection member vocabulary (human-feedback addendum 03, HF3-05; review 07, R7-04):
 * one small local glyph dictionary and one canonical definition registry. Every visible member is
 * read in a fixed order — role, health, attack (channel · hits × power), range or melee contact,
 * protection (channel shield · value · covered faces), conditions — with exact values. Words come
 * only when a player asks a particular symbol (hover, focus, tap): its definition and current value.
 *
 * Rules of the language:
 *  - shape carries meaning and survives grayscale: a blade is Physical, a four-point spark is
 *    Magic, a shield is protection, an arrow is range, two touching blocks are melee contact;
 *  - channel tints (steel for Physical, violet for Magic) never reuse the seat colors (blue A,
 *    red B), and Mana alignment is not drawn here at all (members carry no alignment data);
 *  - `2×1` (two hits of 1) is never written as one hit of 2; zero protection is shown as an empty
 *    shield with 0, never as a missing chip;
 *  - the face diagram is drawn relative to the formation's real front (the caller rotates it to
 *    the on-screen direction of that front), never screen-up.
 * Facts come from the shared read model (rules/inspection.js) at the displayed moment; nothing here
 * calculates combat. Presentation only.
 */
import { GLYPH_PATHS } from './pieces.js';

const svg = (body, cls = '') => `<svg class="mg ${cls}" viewBox="0 0 16 16" aria-hidden="true" focusable="false">${body}</svg>`;

/** Glyph bodies in a 16 × 16 box. `currentColor` takes the chip's tint. */
const BODY = {
  heart: '<path d="M8 14.2 2.2 8.4C.6 6.8.8 4.2 2.6 3c1.7-1.1 3.9-.6 5.4 1.3C9.5 2.4 11.7 1.9 13.4 3c1.8 1.2 2 3.8.4 5.4Z" fill="currentColor"/>',
  // Physical: a solid diagonal blade with a guard
  physical: '<path d="M14.6 1.4 14.6 4 7.4 11.2 4.8 8.6 12 1.4Z" fill="currentColor"/><path d="M3.2 8.4 7.6 12.8 6.6 13.8 2.2 9.4Z M2.6 12.2 3.8 13.4 2 15.2.8 14Z" fill="currentColor"/>',
  // Magic: a four-point spark
  magic: '<path d="M8 .6 9.7 6.3 15.4 8 9.7 9.7 8 15.4 6.3 9.7.6 8 6.3 6.3Z" fill="currentColor"/>',
  range: '<path d="M1 7h9.5v2H1Z" fill="currentColor"/><path d="M9.5 3.4 15.2 8 9.5 12.6Z" fill="currentColor"/><path d="M1 5.5 3 8 1 10.5" stroke="currentColor" stroke-width="1.3" fill="none"/>',
  melee: '<rect x="1" y="4" width="6.5" height="8" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="8.5" y="4" width="6.5" height="8" fill="currentColor"/>',
  shield: '<path d="M8 .8 14.4 2.9V8c0 3.6-2.6 6-6.4 7.4C4.2 14 1.6 11.6 1.6 8V2.9Z" fill="currentColor" opacity=".28"/><path d="M8 .8 14.4 2.9V8c0 3.6-2.6 6-6.4 7.4C4.2 14 1.6 11.6 1.6 8V2.9Z" fill="none" stroke="currentColor" stroke-width="1.4"/>',
  star: '<path d="M8 .8 10.1 5.6 15.2 6.1 11.3 9.5 12.5 14.6 8 11.9 3.5 14.6 4.7 9.5.8 6.1 5.9 5.6Z" fill="currentColor"/>',
  engaged: '<path d="M2 2 14 14M14 2 2 14" stroke="currentColor" stroke-width="2.2"/>',
  fallen: '<path d="M7 1h2v4h4v2H9v8H7V7H3V5h4Z" fill="currentColor" opacity=".9"/>',
  helping: '<path d="M8 1 15 8 8 15 1 8Z" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  breach: '<path d="M8 1.5 15 14.5H1Z" fill="currentColor"/>',
  equipped: '<path d="M3 2h10l1 4-2 1v7H4V7L2 6Z" fill="currentColor"/>',
  // roles (drawn inside a round token so they never read as channel marks)
  swordsman: '<path d="M7.2 1h1.6v8.6H7.2Z M4.6 9.6h6.8v1.5H4.6Z M7.3 11.1h1.4v3.4H7.3Z" fill="currentColor"/>',
  pikeman: '<path d="M8 .6 10 4.6H8.8V15.4H7.2V4.6H6Z" fill="currentColor"/>',
  archer: '<path d="M5 1.2C11.5 4 11.5 12 5 14.8" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M5 1.2V14.8" stroke="currentColor" stroke-width=".9"/><path d="M3 8h9" stroke="currentColor" stroke-width="1.1"/>',
  mage: '<path d="M8 .8 12.2 11.6H3.8Z" fill="currentColor"/><path d="M1.8 11.6h12.4v1.8H1.8Z" fill="currentColor"/>',
  priest: '<path d="M7 1h2v4h4.4v2H9v8.4H7V7H2.6V5H7Z" fill="currentColor"/>',
};

export const glyph = (name, cls = '') => svg(BODY[name] ?? BODY.helping, cls);
export const channelGlyph = (channel) => glyph(channel === 'magic' ? 'magic' : 'physical', channel === 'magic' ? 'ch-magic' : 'ch-physical');
/** A shield marked with its channel, readable in grayscale. */
export const shieldGlyph = (channel, empty = false) => svg(`${empty ? BODY.shield.replace('opacity=".28"', 'opacity="0"') : BODY.shield}<g transform="translate(4.5 4.2) scale(.44)">${BODY[channel === 'magic' ? 'magic' : 'physical']}</g>`, `shield ${channel === 'magic' ? 'ch-magic' : 'ch-physical'}${empty ? ' empty' : ''}`);
/** The Mount's actual chess glyph (the authored outlines the board standards use). */
export function mountGlyph(piece) {
  const d = GLYPH_PATHS[piece] ?? GLYPH_PATHS.pawn;
  return `<svg class="mg mount" viewBox="0 0 100 120" aria-hidden="true" focusable="false"><path d="${d}" fill="currentColor" stroke="rgba(0,0,0,.55)" stroke-width="5"/></svg>`;
}
export const roleGlyph = (f) => (f.role === 'center' ? mountGlyph(f.conditions.includes('commander') ? 'commander' : f.mount ?? 'pawn') : glyph(f.role, 'role'));

/**
 * Covered faces drawn on a little member square: the four sides with their front at the top of
 * the diagram (the caller rotates it so that top matches the formation's front on screen); a dot
 * in the middle when the top/bottom (above/below) are covered as well.
 */
export function faceDiagram(faces) {
  const on = (f) => faces.includes(f);
  const side = (f, d) => `<path d="${d}" stroke="currentColor" stroke-width="${on(f) ? 2.6 : 0.9}" opacity="${on(f) ? 1 : 0.45}" fill="none"/>`;
  return `<svg class="mface" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><g class="mface-rot">${side('front', 'M2 1.5h8')}${side('rear', 'M2 10.5h8')}${side('left', 'M1.5 2v8')}${side('right', 'M10.5 2v8')}${on('above') || on('below') ? '<circle cx="6" cy="6" r="1.4" fill="currentColor"/>' : ''}<path d="M5 3.4 6 2.4 7 3.4" stroke="currentColor" stroke-width=".8" fill="none" opacity=".7"/></g></svg>`;
}

const cap = (x) => (x ? x[0].toUpperCase() + x.slice(1) : x);
const FACES = ['front', 'left', 'right', 'rear', 'above', 'below'];
const CH = { physical: 'Physical', magic: 'Magic' };
const ROLE = { swordsman: 'Swordsman', pikeman: 'Pikeman', archer: 'Archer', mage: 'Mage', priest: 'Priest' };
const ROW = (slot) => (slot <= 3 ? 'front row' : slot <= 6 ? 'middle row' : 'rear row');
const listWords = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
const faceWords = (faces) => (faces.length === 6 ? 'all six faces' : faces.length === 4 && !faces.includes('above') && !faces.includes('below') ? 'all four sides' : `the ${listWords(faces)} face${faces.length > 1 ? 's' : ''}`);

/** One canonical definition per kind of fact (the registry the glossary and tooltips share). */
export const FACT_DEFS = {
  role: { title: 'Role', text: 'Which kind of member this is and where it stands in the 3 × 3 formation.' },
  mount: { title: 'Mount', text: 'The party center: its chess piece sets how the whole formation moves. It is a body like any member.' },
  health: { title: 'Health', text: 'Current and maximum hit points. At 0 the member falls.' },
  pool: { title: 'Shared health', text: 'This profile pools health per party: every member draws from one total.' },
  attack: { title: 'Attack', text: 'Hits × power, in its channel. Each hit is resolved separately against the protection of the face it reaches.' },
  range: { title: 'Range', text: 'How far a volley reaches, in territories, against a party this formation is engaged with.' },
  melee: { title: 'Melee contact', text: 'Strikes only bodies it touches.' },
  shield: { title: 'Protection', text: 'Reduces each hit of its channel on the faces it covers. Other faces meet 0.' },
  noshield: { title: 'No protection', text: 'Known zero: every face meets the full power of each hit.' },
  commander: { title: 'Commander', text: 'If the Commander falls, its side loses the match.' },
  engaged: { title: 'Engaged', text: 'In contact with an enemy party: it exchanges blows each Tick and cannot take an ordinary destination.' },
  fallen: { title: 'Fallen', text: 'This member has died; its body no longer fights or blocks.' },
  helping_corner: { title: 'Helping a corner', text: 'Away in a neighbouring contact strip, fighting for another party.' },
  breach_advanced: { title: 'Advanced into a gap', text: 'Stepped into an enemy formation\'s gap after a breach.' },
  equipped: { title: 'Equipped', text: 'Wears crafted equipment that changes its protection.' },
};

/**
 * The chips for one member, in the fixed order, with exact values and their explanation.
 * @param {any} f member facts (rules/inspection.memberFacts)
 * @param {{ pts: (u:number)=>string, sources?: (src:any)=>string, mount?: string|null, line?: boolean, targets?: any[] }} o
 * @returns {Array<{ key: string, kind: string, icon: string, value: string, cls: string, label: string, title: string, text: string }>}
 */
export function factChips(f, o) {
  const { pts } = o;
  const out = [];
  const add = (key, kind, icon, value, cls, title, text) => out.push({ key, kind, icon, value, cls, title, text, label: `${title}${value ? ` ${value}` : ''}` });
  // role
  if (f.role === 'center') {
    const name = f.conditions.includes('commander') ? 'Commander' : f.mount ? cap(f.mount) : 'Center';
    add('role', 'role', roleGlyph(f), '', 'role', name, `${name}${f.mount ? ` — the party's Mount at the center (slot 5)` : ' — the party center (slot 5)'}. ${FACT_DEFS.mount.text}`);
  } else {
    const name = ROLE[f.role] ?? cap(f.title ?? f.role);
    add('role', 'role', roleGlyph(f), '', 'role', name, `${name} — a member in slot ${f.slot}, ${ROW(f.slot)}.`);
  }
  // health
  const hp = `${pts(f.health.hp)}/${pts(f.health.max)}`;
  if (f.health.mode === 'party_pool') add('health', 'health', glyph('heart', 'hp'), hp, 'hp pool', 'Shared health', `${hp}: the party's pool. ${FACT_DEFS.pool.text}`);
  else add('health', 'health', glyph('heart', 'hp'), hp, 'hp', 'Health', `${hp} — this member's own hit points. ${FACT_DEFS.health.text.split('. ')[1]}`);
  // attacks, each with its reach
  f.attacks.forEach((a, i) => {
    const hits = a.hits ?? 1;
    const value = `${hits}×${a.power}`;
    const each = hits > 1 ? `${hits} separate hits of ${a.power} ${CH[a.channel]} each (not one hit of ${hits * a.power})` : `one hit of ${a.power} ${CH[a.channel]}`;
    add(`attack:${i}`, 'attack', channelGlyph(a.channel), value, `atk ch-${a.channel}`, `${CH[a.channel]} ${a.kind === 'ranged' ? 'volley' : 'attack'}`, `${cap(String(a.id).replace(/_/g, ' '))}: ${each}. Each hit meets the ${CH[a.channel]} protection of the face it reaches.${a.charge ? ' It charges.' : ''}`);
    if (a.kind === 'ranged') {
      const t = (o.targets ?? []).find((x) => x.inRange && !x.blocked) ?? (o.targets ?? [])[0];
      const ctx = t ? ` Against the engaged party now: range ${t.range}${t.elevation && t.elevation !== 'level' ? ` (${t.elevation.replace('_', ' ')})` : ''}${t.blocked ? ', blocked: needs open sky' : t.inRange ? ', in range' : ', out of range'} — a preview.` : ' No engaged target now.';
      add(`range:${i}`, 'range', glyph('range', 'rng'), String(a.range), 'rng', 'Range', `Base range ${a.range}.${a.elevationAware ? ' Height changes it.' : ''}${a.needsArc ? ' Needs open sky (not under a roof).' : ''} ${FACT_DEFS.range.text}${ctx}`);
    } else add(`range:${i}`, 'melee', glyph('melee', 'rng'), '', 'rng melee', 'Melee', `${FACT_DEFS.melee.text}`);
  });
  // protection, grouped by channel, total and covered faces
  const groups = new Map();
  for (const channel of ['physical', 'magic']) for (const face of FACES) {
    const v = f.protection[channel]?.[face];
    if (!v) continue;
    const k = `${channel}|${v.total}|${v.base}`;
    if (!groups.has(k)) groups.set(k, { channel, total: v.total, base: v.base, sources: v.sources, faces: [] });
    groups.get(k).faces.push(face);
  }
  const line = !!o.line;
  if (!groups.size) add('shield:none', 'noshield', shieldGlyph('physical', true), '0', 'sh none', 'No protection', `${FACT_DEFS.noshield.text}`);
  let gi = 0;
  for (const g of groups.values()) {
    const from = (g.sources ?? []).filter((x) => x.amount).map((x) => `${x.amount} from ${o.sources ? o.sources(x) : x.kind}`);
    const scope = line ? `${CH[g.channel]} line contribution ${g.total}` : `${CH[g.channel]} protection ${g.total}`;
    add(`shield:${gi++}`, 'shield', shieldGlyph(g.channel) + faceDiagram(g.faces), String(g.total), `sh ch-${g.channel}`, line ? `${CH[g.channel]} contribution` : `${CH[g.channel]} protection`,
      `${scope} on ${faceWords(g.faces)}${g.faces.length < 6 ? '; other faces meet 0' : ''}.${from.length ? ` Sources: ${from.join(' + ')}.` : ''}${g.total !== g.base ? ` Its own value is ${g.base}; applied effects raise it to ${g.total}.` : ''}${line ? ' In this profile a hit meets the shared value of the line it reaches; this is the member\'s part of it.' : ''}`);
  }
  // conditions
  for (const c of f.conditions) {
    if (c === 'center') continue;
    const d = FACT_DEFS[c];
    if (!d) continue;
    const icon = { commander: 'star', engaged: 'engaged', fallen: 'fallen', helping_corner: 'helping', breach_advanced: 'breach', equipped: 'equipped' }[c];
    add(`cond:${c}`, 'cond', glyph(icon, `cond-${c}`), '', `cond cond-${c}`, d.title, d.text);
  }
  return out;
}

/** A compact text equivalent of the chips (the inspection bar when bodies cannot carry them). */
export const chipsText = (chips) => chips.filter((c) => c.kind !== 'role').map((c) => (c.kind === 'cond' ? c.title : `${c.title} ${c.value}`)).join(' · ');
