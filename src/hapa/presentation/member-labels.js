/**
 * The actual formation as the composition view (human-feedback addendum 02, HF2-04/HF2-06/HF2-07;
 * review 05, R5-03). For one intentionally inspected party, a passive label sits beside each
 * visible member's real body — role first, then true health, then a concise combat summary when the
 * on-screen space allows; one hovered member expands to its full breakdown. The party's collective
 * facts (Mount, Supply, facing, destination, height/exposure, shared pool) appear once at its edge.
 *
 * Space is measured, not guessed: the projected size of one member width at the party's real
 * height decides the detail level, with entry/exit hysteresis and a settling interval. Labels are
 * upright DOM text outside the world post-processing, carry `pointer-events: none` (wheel and
 * camera gestures pass through), and keep a stable side per member. Strings are rebuilt only when
 * their facts change; positions follow the displayed bodies every frame.
 */
import { h } from './dom.js';

/** Projected px per member width that enter / leave each level (hysteresis), and the settle time. */
export const LEVELS = { identity: { enter: 64, exit: 54 }, combat: { enter: 150, exit: 135 } };
/** Projected px between formation rows needed before a level's lines fit without covering a row. */
export const ROW_PX = { identity: 34, combat: 120 };
const SETTLE_MS = 140;

export function levelFor(prev, pxPerMember, rowPx = Infinity) {
  const { identity, combat } = LEVELS;
  // the vertical room between rows caps the level: a summary that would cover the next row waits
  const cap = rowPx >= ROW_PX.combat ? 'combat' : rowPx >= ROW_PX.identity ? 'identity' : 'none';
  const lv = levelFor0(prev, pxPerMember, identity, combat);
  const order = ['none', 'identity', 'combat'];
  return order[Math.min(order.indexOf(lv), order.indexOf(cap))];
}

function levelFor0(prev, pxPerMember, identity, combat) {
  if (prev === 'combat') return pxPerMember < combat.exit ? (pxPerMember < identity.exit ? 'none' : 'identity') : 'combat';
  if (prev === 'identity') return pxPerMember >= combat.enter ? 'combat' : pxPerMember < identity.exit ? 'none' : 'identity';
  return pxPerMember >= combat.enter ? 'combat' : pxPerMember >= identity.enter ? 'identity' : 'none';
}

export class MemberLabels {
  /** @param {HTMLElement} host the world element */
  constructor(host) {
    this.host = host;
    this.root = h('div', { class: 'mlabels', 'aria-hidden': 'true' });
    this.partyEl = h('div', { class: 'mparty' });
    this.root.append(this.partyEl);
    host.append(this.root);
    this.els = new Map();
    this.level = 'none';
    this.pending = null;
    this.keys = new Map();
  }

  /** Remove every label (no subject, new match, playback start). */
  clear() {
    for (const el of this.els.values()) el.remove();
    this.els.clear(); this.keys.clear();
    this.partyEl.hidden = true;
    this.level = 'none'; this.pending = null;
    this.subject = null;
  }

  /**
   * Per frame.
   * @param {{ partyId: string, members: Array<{ id: string, anchor: {x:number,y:number}|null, visible: boolean, text: { role: string, health: string, healthPct: number|null, combat: string, detail: Node|null, key: string } }>,
   *          party: { anchor: {x:number,y:number}|null, lines: string[], key: string, note?: string|null }, pxPerMember: number, expanded: string|null } | null} m
   */
  update(m, now = performance.now()) {
    if (!m) { if (this.subject) this.clear(); return 'none'; }
    if (this.subject !== m.partyId) { this.clear(); this.subject = m.partyId; }
    // detail level from measured space, with hysteresis and a short settling interval
    const want = levelFor(this.level, m.pxPerMember, m.rowPx);
    if (want !== this.level) {
      if (!this.pending || this.pending.level !== want) this.pending = { level: want, since: now };
      else if (now - this.pending.since >= SETTLE_MS) { this.level = want; this.pending = null; }
    } else this.pending = null;
    const W = this.host.clientWidth, H = this.host.clientHeight;
    const seen = new Set();
    for (const mm of m.members) {
      const show = this.level !== 'none' && mm.visible && mm.anchor && mm.anchor.x >= 0 && mm.anchor.x <= W && mm.anchor.y >= 0 && mm.anchor.y <= H;
      let el = this.els.get(mm.id);
      if (!show) { if (el) el.hidden = true; continue; }
      seen.add(mm.id);
      if (!el) { el = h('div', { class: 'mlabel' }); this.els.set(mm.id, el); this.root.append(el); }
      const expanded = m.expanded === mm.id;
      const key = `${this.level}|${expanded}|${mm.text.key}`;
      if (this.keys.get(mm.id) !== key) {
        this.keys.set(mm.id, key);
        el.className = `mlabel${expanded ? ' expanded' : ''}`;
        const hp = mm.text.healthPct;
        el.replaceChildren(...[
          h('b', {}, mm.text.role),
          h('div', { class: 'mhp' }, hp != null ? h('i', { style: `width:${Math.round(hp * 100)}%` }) : null, h('span', {}, mm.text.health)),
          this.level === 'combat' || expanded ? h('div', { class: 'mcombat' }, mm.text.combat) : null,
          expanded && mm.text.detail ? h('div', { class: 'mdetail' }, mm.text.detail) : null,
        ].filter(Boolean));
      }
      el.hidden = false;
      // stable side: above the head, centered on the body
      el.style.transform = `translate(${Math.round(mm.anchor.x)}px, ${Math.round(mm.anchor.y)}px) translate(-50%, -100%)`;
      el.style.zIndex = expanded ? 3 : 2;
      el.style.maxWidth = expanded ? '280px' : `${Math.max(100, Math.round(m.pxPerMember * 0.96))}px`;
    }
    for (const [id, el] of this.els) if (!seen.has(id)) el.hidden = true;
    // collective facts once, at the party's edge
    const pa = m.party.anchor;
    this.partyEl.hidden = !pa;
    if (pa) {
      if (this.partyKey !== `${m.party.key}|${this.level}`) { this.partyKey = `${m.party.key}|${this.level}`; this.partyEl.replaceChildren(...[...m.party.lines.map((t, i) => h(i ? 'div' : 'b', {}, t)), m.party.note ? h('div', { class: 'warn' }, m.party.note) : null, this.level === 'none' ? h('div', { class: 'dim' }, 'Closer to read each member') : this.level === 'identity' ? h('div', { class: 'dim' }, 'Hover a member for its combat facts') : null].filter(Boolean)); }
      // at the formation's side edge, clear of the members and of the command bar below
      this.partyEl.style.transform = `translate(${Math.round(pa.x)}px, ${Math.round(pa.y)}px) translate(0, -50%)`;
    }
    return this.level;
  }
}
