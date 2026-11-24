/**
 * The actual formation as the composition view (human-feedback addendum 02, HF2-04/HF2-06/HF2-07;
 * reviews 05 and 06, R5-03 and R6-01; addendum 03, HF3-05). For one intentionally inspected party,
 * a compact label sits beside each visible member's real body: symbols and exact values in a fixed
 * order (member-glyphs.js) — role and health, then attack, range and protection when the on-screen
 * space allows. Each symbol is a real hit area: hovering it (after a short dwell), or tapping it,
 * shows that symbol's definition and current value in one small tooltip; Escape dismisses it. The
 * label body stays pointer-transparent, so board and camera gestures around the symbols keep
 * working, and wheel events over a symbol still reach the camera. Opening one member (hover, a tap on its body, or
 * its button in the inspection bar) never expands that label over its neighbours: the full
 * explanation goes to one reading panel placed in measured free space beside the formation, joined
 * to its member by a leader line and a highlighted label. The party's collective facts appear once,
 * also placed clear of the formation, the reading panel and the docked controls.
 *
 * Space is measured, not guessed: the projected size of one member width and of one formation row
 * at the party's real height decides the detail level (hysteresis and a settling interval), and
 * every placed element uses its real rendered rectangle at the current text size. Labels are
 * upright DOM text outside the world post-processing and carry `pointer-events: none` (wheel and
 * camera gestures pass through). Text and DOM are rebuilt only when their facts change (a complete
 * signature); positions follow the displayed bodies every frame.
 */
import { h } from './dom.js';

/** Projected px per member width that enter / leave each level (hysteresis), and the settle time. */
export const LEVELS = { identity: { enter: 64, exit: 54 }, combat: { enter: 112, exit: 100 } };
/** Projected px between formation rows needed before a level's lines fit without covering a row. */
export const ROW_PX = { identity: 34, combat: 80 };
const TIP_DWELL = 220, TIP_LINGER = 160;
const SETTLE_MS = 140;
const GAP = 14, EDGE = 8;

/**
 * @param {number} [k] text scale (root font size / 16): larger text needs proportionally more room
 *   per member, so at 200% text the labels wait for twice the projected space (R6-01)
 */
export function levelFor(prev, pxPerMember, rowPx = Infinity, k = 1, rowNeed = ROW_PX.identity * k, combatNeed = ROW_PX.combat * k) {
  const { identity, combat } = LEVELS;
  // the vertical room between rows caps the level: a label must fit between rows (its measured
  // height, with a little hysteresis), and a fuller label that would cover the next row waits
  const idRow = prev === 'none' ? rowNeed : rowNeed * 0.92;
  const coRow = prev === 'combat' ? combatNeed * 0.92 : combatNeed;
  const cap = rowPx >= coRow ? 'combat' : rowPx >= idRow ? 'identity' : 'none';
  pxPerMember /= k;
  const lv = levelFor0(prev, pxPerMember, identity, combat);
  const order = ['none', 'identity', 'combat'];
  return order[Math.min(order.indexOf(lv), order.indexOf(cap))];
}

function levelFor0(prev, pxPerMember, identity, combat) {
  if (prev === 'combat') return pxPerMember < combat.exit ? (pxPerMember < identity.exit ? 'none' : 'identity') : 'combat';
  if (prev === 'identity') return pxPerMember >= combat.enter ? 'combat' : pxPerMember < identity.exit ? 'none' : 'identity';
  return pxPerMember >= combat.enter ? 'combat' : pxPerMember >= identity.enter ? 'identity' : 'none';
}

/**
 * The definition registry for the inspected party: every member's current symbols, whether or
 * not its on-body label is drawn (roofed, off screen, too small) — the inspection bar's keyboard
 * and touch route needs them all (review 08, R8-04). Rebuilt from the current facts each update.
 * @param {Array<{ id: string, chips?: Array<{ key: string }> }>} members
 * @returns {Map<string, any>} `${memberId}|${chipKey}` → chip
 */
export function definitionRegistry(members) {
  const reg = new Map();
  for (const mm of members ?? []) for (const c of mm.chips ?? []) reg.set(`${mm.id}|${c.key}`, c);
  return reg;
}

/** The text a definition shows (used to tell whether an open definition is stale). */
const tipText = (c) => `${c.title}|${c.value}|${c.text}`;

/** @typedef {{ x: number, y: number, w: number, h: number }} Rect */
export const overlaps = (a, b) => !!a && !!b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const union = (rs) => { const v = rs.filter(Boolean); if (!v.length) return null; const x0 = Math.min(...v.map((r) => r.x)), y0 = Math.min(...v.map((r) => r.y)); return { x: x0, y: y0, w: Math.max(...v.map((r) => r.x + r.w)) - x0, h: Math.max(...v.map((r) => r.y + r.h)) - y0 }; };
const clampRect = (r, W, H) => ({ ...r, x: Math.max(EDGE, Math.min(W - EDGE - r.w, r.x)), y: Math.max(EDGE, Math.min(H - EDGE - r.h, r.y)) });
const inside = (r, W, H) => r.x >= EDGE - 0.5 && r.y >= EDGE - 0.5 && r.x + r.w <= W - EDGE + 0.5 && r.y + r.h <= H - EDGE + 0.5;

/**
 * Place a box of size w×h beside `around` without covering it or any `avoid` rectangle, preferring
 * `prefer` (the previous side, for stability), then right, left, above, below; `anchorY` centers
 * the side placements on a point (the member being read). Returns the rect and side, or null.
 */
export function placeBeside(w, h, around, avoid, W, H, { prefer = null, anchorY = null } = {}) {
  const cy = anchorY ?? around.y + around.h / 2, cx = around.x + around.w / 2;
  const at = {
    right: { x: around.x + around.w + GAP, y: cy - h / 2 },
    left: { x: around.x - GAP - w, y: cy - h / 2 },
    above: { x: cx - w / 2, y: around.y - GAP - h },
    below: { x: cx - w / 2, y: around.y + around.h + GAP },
  };
  const order = [...new Set([prefer, 'right', 'left', 'above', 'below'].filter(Boolean))];
  for (const side of order) {
    const r = { ...at[side], w, h };
    // slide along the side to stay on screen, but never across the formation
    if (side === 'right' || side === 'left') r.y = Math.max(EDGE, Math.min(H - EDGE - h, r.y));
    else r.x = Math.max(EDGE, Math.min(W - EDGE - w, r.x));
    if (!inside(r, W, H) || overlaps(r, around) || avoid.some((a) => overlaps(r, a))) continue;
    return { rect: r, side };
  }
  return null;
}

/** Free spans of [lo, hi] once the given blocked intervals are removed, longest first. */
function freeSpans(lo, hi, blocked) {
  const out = [];
  let at = lo;
  for (const [a, b] of blocked.filter(([a, b]) => b > lo && a < hi).sort((x, y) => x[0] - y[0])) { if (a > at) out.push([at, a]); at = Math.max(at, b); }
  if (at < hi) out.push([at, hi]);
  return out.sort((x, y) => (y[1] - y[0]) - (x[1] - x[0]));
}

/**
 * When the natural box fits on no side, the largest free region beside the formation (right, left,
 * above or below it, minus the docked controls) that can hold at least `min`: the box is limited to
 * that region and scrolls. Text is never shrunk and the formation is never covered (R6-01).
 */
export function fitBeside(natural, min, around, avoid, W, H, anchorY = null) {
  const regions = [
    { side: 'right', x0: around.x + around.w + GAP, x1: W - EDGE, y0: EDGE, y1: H - EDGE, vertical: true },
    { side: 'left', x0: EDGE, x1: around.x - GAP, y0: EDGE, y1: H - EDGE, vertical: true },
    { side: 'above', x0: EDGE, x1: W - EDGE, y0: EDGE, y1: around.y - GAP, vertical: false },
    { side: 'below', x0: EDGE, x1: W - EDGE, y0: around.y + around.h + GAP, y1: H - EDGE, vertical: false },
  ];
  let best = null;
  for (const g of regions) {
    if (g.x1 - g.x0 < min.w || g.y1 - g.y0 < min.h) continue;
    if (g.vertical) {
      const w = Math.min(natural.w, g.x1 - g.x0);
      const x = g.side === 'right' ? g.x0 : g.x1 - w;
      const blocked = avoid.filter((a) => a.x < x + w && x < a.x + a.w).map((a) => [a.y - 4, a.y + a.h + 4]);
      for (const [lo, hi] of freeSpans(g.y0, g.y1, blocked)) {
        const h = Math.min(natural.h, hi - lo);
        if (h < min.h) continue;
        const cy = anchorY ?? around.y + around.h / 2;
        const r = { x, y: Math.max(lo, Math.min(hi - h, cy - h / 2)), w, h };
        if (!best || r.w * r.h > best.rect.w * best.rect.h) best = { rect: r, side: g.side };
        break;
      }
    } else {
      const h = Math.min(natural.h, g.y1 - g.y0);
      const y = g.side === 'above' ? g.y1 - h : g.y0;
      const blocked = avoid.filter((a) => a.y < y + h && y < a.y + a.h).map((a) => [a.x - 4, a.x + a.w + 4]);
      for (const [lo, hi] of freeSpans(g.x0, g.x1, blocked)) {
        const w = Math.min(natural.w, hi - lo);
        if (w < min.w) continue;
        const cx = around.x + around.w / 2;
        const r = { x: Math.max(lo, Math.min(hi - w, cx - w / 2)), y, w, h };
        if (!best || r.w * r.h > best.rect.w * best.rect.h) best = { rect: r, side: g.side };
        break;
      }
    }
  }
  return best;
}

export class MemberLabels {
  /** @param {HTMLElement} host the world element */
  constructor(host) {
    this.host = host;
    this.root = h('div', { class: 'mlabels', 'aria-hidden': 'true' });
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('class', 'mleader');
    this.leader = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    this.svg.append(this.leader);
    this.partyEl = h('div', { class: 'mparty' });
    this.root.append(this.svg, this.partyEl);
    // the reading panel is real content (not aria-hidden): the inspection bar's member buttons
    // describe themselves with it, so keyboard and touch reach the same explanation
    this.reading = h('section', { class: 'mreading', id: 'member-reading', role: 'region', 'aria-label': 'Member explanation' });
    this.reading.hidden = true;
    // one definition tooltip for the symbol being asked about (pointer, tap or keyboard focus)
    this.tip = h('div', { class: 'mtip', id: 'member-tip', role: 'tooltip' });
    this.tip.hidden = true;
    this.chips = new Map(); // `${memberId}|${key}` → chip definition
    host.append(this.root, this.reading, this.tip);
    this._bindTips();
    this.els = new Map();
    this.sizes = new Map();
    this.level = 'none';
    this.pending = null;
    this.keys = new Map();
    this.layout = null;
  }

  _bindTips() {
    const chipOf = (t) => t?.closest?.('.mfact');
    this.root.addEventListener('pointerover', (e) => {
      const c = chipOf(e.target);
      if (!c) return;
      clearTimeout(this._tipHide);
      clearTimeout(this._tipShow);
      if (this.tipFor === c.dataset.ref) return;
      this._tipShow = setTimeout(() => this.showTip(c.dataset.ref, c), this.tip.hidden ? TIP_DWELL : 60);
    });
    this.root.addEventListener('pointerout', (e) => {
      const c = chipOf(e.target);
      if (!c || c.contains(e.relatedTarget)) return;
      clearTimeout(this._tipShow);
      if (e.relatedTarget && this.tip.contains(e.relatedTarget)) return;
      this._tipHide = setTimeout(() => { if (!this.tipPinned) this.hideTip(); }, TIP_LINGER);
    });
    // a deliberate tap/click shows the definition at once and keeps it until dismissed
    this.root.addEventListener('click', (e) => { const c = chipOf(e.target); if (!c) return; e.stopPropagation(); clearTimeout(this._tipShow); this.showTip(c.dataset.ref, c, { pinned: true }); });
    this.tip.addEventListener('pointerenter', () => clearTimeout(this._tipHide));
    this.tip.addEventListener('pointerleave', () => { if (!this.tipPinned) this._tipHide = setTimeout(() => this.hideTip(), TIP_LINGER); });
  }

  /** Show one symbol's definition and current value beside `anchor` (a chip or a bar button). */
  showTip(ref, anchor, { pinned = false } = {}) {
    const c = this.chips.get(ref);
    if (!c || !anchor) return false;
    this.tipFor = ref; this.tipPinned = pinned; this.tipShown = tipText(c); this.tipAnchor = anchor;
    this.tip.replaceChildren(h('div', { class: 'mt-head' }, h('b', {}, c.title), c.value ? h('span', { class: 'mt-val' }, ` ${c.value}`) : null), h('div', {}, c.text));
    this.tip.hidden = false;
    const host = this.host.getBoundingClientRect(), a = anchor.getBoundingClientRect();
    const w = this.tip.offsetWidth, hh = this.tip.offsetHeight, W = this.host.clientWidth, H = this.host.clientHeight;
    let x = a.left - host.left + a.width / 2 - w / 2, y = a.top - host.top - hh - 6;
    if (y < EDGE) y = a.bottom - host.top + 6;
    x = Math.max(EDGE, Math.min(W - EDGE - w, x)); y = Math.max(EDGE, Math.min(H - EDGE - hh, y));
    this.tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    for (const el of this.root.querySelectorAll('.mfact.asked')) el.classList.remove('asked');
    if (anchor.classList?.contains('mfact')) anchor.classList.add('asked');
    else this.root.querySelector(`.mfact[data-ref="${CSS.escape(ref)}"]`)?.classList.add('asked');
    return true;
  }

  hideTip() {
    clearTimeout(this._tipShow); clearTimeout(this._tipHide);
    if (this.tip.hidden) return false;
    this.tip.hidden = true; this.tipFor = null; this.tipPinned = false; this.tipShown = null; this.tipAnchor = null;
    for (const el of this.root.querySelectorAll('.mfact.asked')) el.classList.remove('asked');
    return true;
  }

  /** The on-body chip element for a fact, when that member's label shows it now. */
  chipEl(ref) { return this.root.querySelector(`.mlabel:not([hidden]) .mfact[data-ref="${CSS.escape(ref)}"]`); }

  /** Remove every label (no subject, new match, playback start). */
  clear() {
    for (const el of this.els.values()) el.remove();
    this.els.clear(); this.keys.clear(); this.sizes.clear();
    this.partyEl.hidden = true;
    this.reading.hidden = true; this.readingKey = null; this.readingSide = null;
    this.leader.setAttribute('visibility', 'hidden');
    this.level = 'none'; this.pending = null;
    this.subject = null; this.partyKey = null; this.partySide = null;
    this.layout = null; this.labelH = null; this.combatH = null;
    this.chips.clear(); this.hideTip();
  }

  _size(id, el, key) {
    const s = this.sizes.get(id);
    if (s?.key === key) return s;
    const r = { key, w: el.offsetWidth, h: el.offsetHeight };
    this.sizes.set(id, r);
    return r;
  }

  /** Measured sizes depend on the text size: drop them when the root font size changes. */
  _checkTextScale() {
    const fs = getComputedStyle(document.documentElement).fontSize;
    if (fs !== this.fontSize) { this.fontSize = fs; this.sizes.clear(); this.readingKey = null; this.partyKey = null; this.keys.clear(); this.labelH = null; this.combatH = null; }
  }

  /**
   * Per frame.
   * @param {{ partyId: string,
   *   members: Array<{ id: string, anchor: {x:number,y:number}|null, foot?: {x:number,y:number}|null, visible: boolean, occluded?: boolean,
   *     text: { role: string, health: string, healthPct: number|null, combat: string, detail: (() => Node)|Node|null, key: string, where?: string } }>,
   *   party: { anchor: {x:number,y:number}|null, lines: string[], key: string, note?: string|null },
   *   pxPerMember: number, rowPx?: number, expanded: string|null, avoid?: Rect[] } | null} m
   */
  update(m, now = performance.now()) {
    if (!m) { if (this.subject) this.clear(); return 'none'; }
    if (this.subject !== m.partyId) { this.clear(); this.subject = m.partyId; }
    if (!this._scaleCheckAt || now - this._scaleCheckAt > 500) { this._scaleCheckAt = now; this._checkTextScale(); }
    // every member's current definitions, drawn or not; an open definition follows its source
    this.chips = definitionRegistry(m.members);
    if (this.tipFor) {
      const c = this.chips.get(this.tipFor);
      if (!c) this.hideTip();
      else if (tipText(c) !== this.tipShown) {
        const anchor = this.chipEl(this.tipFor) ?? (this.tipAnchor?.isConnected ? this.tipAnchor : null);
        if (anchor) this.showTip(this.tipFor, anchor, { pinned: this.tipPinned }); else this.hideTip();
      }
    }
    // detail level from measured space, with hysteresis and a short settling interval
    const k = (parseFloat(this.fontSize) || 16) / 16;
    const want = levelFor(this.level, m.pxPerMember, m.rowPx, k, (this.labelH ?? 36 * k) + 2, Math.max(ROW_PX.combat * k, (this.combatH ?? 0) + 2));
    if (m.frontDeg != null) this.root.style.setProperty('--front-rot', `${Math.round(m.frontDeg)}deg`);
    if (want !== this.level) {
      if (!this.pending || this.pending.level !== want) this.pending = { level: want, since: now };
      else if (now - this.pending.since >= SETTLE_MS) { this.level = want; this.pending = null; }
    } else this.pending = null;
    const W = this.host.clientWidth, H = this.host.clientHeight;
    const avoid = m.avoid ?? [];
    const seen = new Set(), labelRects = new Map(), bodyRects = [];
    // pass 1, writes only: content for changed labels (measuring here would force one layout per label)
    const shown = [];
    for (const mm of m.members) {
      const onScreen = mm.visible && mm.anchor && mm.anchor.x >= 0 && mm.anchor.x <= W && mm.anchor.y >= 0 && mm.anchor.y <= H;
      // the real body's screen extent (head anchor to feet), whether or not a label is shown
      if (onScreen) { const half = m.pxPerMember * 0.42, foot = mm.foot ?? { x: mm.anchor.x, y: mm.anchor.y + m.pxPerMember * 1.1 }; bodyRects.push({ x: mm.anchor.x - half, y: mm.anchor.y, w: half * 2, h: Math.max(8, foot.y - mm.anchor.y) }); }
      const show = this.level !== 'none' && onScreen;
      let el = this.els.get(mm.id);
      if (!show) { if (el) el.hidden = true; continue; }
      seen.add(mm.id);
      if (!el) { el = h('div', { class: 'mlabel' }); this.els.set(mm.id, el); this.root.append(el); }
      const expanded = m.expanded === mm.id, hovered = m.hovered === mm.id;
      // never wider than the space to the neighbouring member: labels sit side by side
      const maxW = `${Math.max(Math.round(58 * k), Math.round(m.pxPerMember - 4))}px`;
      const chips = mm.chips ?? [];
      const key = `${this.level}|${expanded}|${hovered}|${mm.occluded ? 1 : 0}|${mm.text.key}|${mm.text.healthPct}|${maxW}`;
      el.hidden = false;
      if (this.keys.get(mm.id) !== key) {
        this.keys.set(mm.id, key);
        el.className = `mlabel${expanded ? ' expanded' : ''}${hovered ? ' hovered' : ''}${mm.occluded ? ' occluded' : ''}`;
        const chip = (c) => { const sp = h('span', { class: `mfact ${c.cls}`, 'data-ref': `${mm.id}|${c.key}` }); sp.innerHTML = `${c.icon}${c.value ? `<b>${c.value}</b>` : ''}`; return sp; };
        const hp = mm.text.healthPct;
        const of = (kinds) => chips.filter((c) => kinds.includes(c.kind));
        const id = h('div', { class: 'mrow' }, ...of(['role']).map(chip), ...of(['health']).map((c) => { const sp = chip(c); if (hp != null) sp.append(h('i', { class: 'mbar', style: `width:${Math.round(hp * 100)}%` })); return sp; }));
        el.replaceChildren(...[
          id,
          this.level === 'combat' ? h('div', { class: 'mrow' }, ...of(['attack', 'range', 'melee']).map(chip)) : null,
          this.level === 'combat' ? h('div', { class: 'mrow' }, ...of(['shield', 'noshield', 'cond']).map(chip)) : null,
          mm.occluded ? h('div', { class: 'mocc' }, 'behind terrain') : null,
        ].filter(Boolean));
        el.style.maxWidth = maxW;
        if (this.tipFor?.startsWith(`${mm.id}|`)) this.hideTip(); // its chip was rebuilt
      }
      shown.push({ mm, el, key, expanded });
    }
    // pass 2, reads: sizes of changed labels in one layout; then positions (writes)
    for (const x of shown) x.size = this._size(x.mm.id, x.el, x.key);
    for (const { mm, el, size, expanded } of shown) {
      if (this.level === 'identity') this.labelH = Math.max(this.labelH ?? 0, size.h); // the real compact label height
      if (this.level === 'combat') this.combatH = Math.max(this.combatH ?? 0, size.h);
      // stable side: above the head, centered on the body
      el.style.transform = `translate(${Math.round(mm.anchor.x)}px, ${Math.round(mm.anchor.y)}px) translate(-50%, -100%)`;
      el.style.zIndex = expanded ? 3 : 2;
      labelRects.set(mm.id, { x: mm.anchor.x - size.w / 2, y: mm.anchor.y - size.h, w: size.w, h: size.h });
    }
    for (const [id, el] of this.els) if (!seen.has(id)) el.hidden = true;
    // the formation as the player sees it: every body and its compact label (nothing may cover it)
    const formation = union([...bodyRects, ...labelRects.values()]);
    // one deeper explanation, beside the formation (R6-01)
    const open = m.members.find((x) => x.id === m.expanded && x.visible && x.anchor);
    let readingRect = null;
    if (open && formation) {
      const rkey = `${open.text.key}|${open.text.where ?? ''}`;
      if (this.readingKey !== rkey) {
        this.readingKey = rkey;
        const d = typeof open.text.detail === 'function' ? open.text.detail() : open.text.detail;
        this.reading.replaceChildren(h('div', { class: 'mr-head' }, h('b', {}, open.text.role), h('span', {}, ` ${open.text.health}`), open.text.where ? h('span', { class: 'dim' }, ` · ${open.text.where}`) : null), h('div', { class: 'dim small' }, 'Sources and exceptions'), d ?? h('div', { class: 'dim' }, 'No further facts'));
        this.reading.hidden = false;
        this.reading.style.width = ''; this.reading.style.height = ''; this.reading.classList.remove('fitted');
        this.readingSize = { w: this.reading.offsetWidth, h: this.reading.offsetHeight };
      }
      this.reading.hidden = false;
      const { w, h: hh } = this.readingSize;
      const placed = placeBeside(w, hh, formation, avoid, W, H, { prefer: this.readingSide, anchorY: open.anchor.y });
      const rem = parseFloat(this.fontSize) || 16;
      const fitted = placed ? null : fitBeside({ w, h: hh }, { w: Math.min(w, 12 * rem), h: Math.min(hh, 5 * rem) }, formation, avoid, W, H, open.anchor.y);
      const sized = (r) => { const fit = r.w < w - 0.5 || r.h < hh - 0.5; this.reading.classList.toggle('fitted', fit); this.reading.style.width = fit ? `${Math.floor(r.w)}px` : ''; this.reading.style.height = fit ? `${Math.floor(r.h)}px` : ''; };
      if (placed) { readingRect = placed.rect; this.readingSide = placed.side; this.reading.classList.remove('docked'); sized(placed.rect); }
      else if (fitted) { readingRect = fitted.rect; this.readingSide = null; this.reading.classList.remove('docked'); sized(fitted.rect); }
      else {
        // no free side: an intentional docked reading view at the screen edge farther from the
        // formation (the command selection and controls stay as they are)
        const left = formation.x + formation.w / 2 > W / 2;
        readingRect = clampRect({ x: left ? EDGE : W - EDGE - w, y: 56, w, h: hh }, W, H);
        this.readingSide = null;
        this.reading.classList.add('docked');
        sized(readingRect);
      }
      this.reading.style.transform = `translate(${Math.round(readingRect.x)}px, ${Math.round(readingRect.y)}px)`;
      // the source cue: a leader from the highlighted label to the panel's nearest edge
      const lr = labelRects.get(open.id) ?? { x: open.anchor.x, y: open.anchor.y, w: 0, h: 0 };
      const from = { x: Math.max(lr.x, Math.min(lr.x + lr.w, readingRect.x + readingRect.w / 2)), y: Math.max(lr.y, Math.min(lr.y + lr.h, readingRect.y + readingRect.h / 2)) };
      const to = { x: Math.max(readingRect.x, Math.min(readingRect.x + readingRect.w, from.x)), y: Math.max(readingRect.y, Math.min(readingRect.y + readingRect.h, from.y)) };
      this.leader.setAttribute('x1', from.x); this.leader.setAttribute('y1', from.y);
      this.leader.setAttribute('x2', to.x); this.leader.setAttribute('y2', to.y);
      this.leader.setAttribute('visibility', 'visible');
    } else {
      this.reading.hidden = true; this.readingKey = null;
      this.leader.setAttribute('visibility', 'hidden');
    }
    // collective facts once, clear of the formation, the reading panel and the docked controls
    let partyRect = null;
    const pa = m.party.anchor;
    this.partyEl.hidden = !pa || !formation;
    if (pa && formation) {
      const pkey = `${m.party.key}|${this.level}`;
      if (this.partyKey !== pkey) {
        this.partyKey = pkey;
        this.partyEl.classList.remove('crowded'); // measure it shown
        this.partyEl.replaceChildren(...[...m.party.lines.map((t, i) => h(i ? 'div' : 'b', {}, t)), m.party.note ? h('div', { class: 'warn' }, m.party.note) : null, this.level === 'none' ? h('div', { class: 'dim' }, 'Closer to read each member') : this.level === 'identity' ? h('div', { class: 'dim' }, 'Closer for attack and protection · hover a symbol') : null].filter(Boolean));
        this.partySize = { w: this.partyEl.offsetWidth, h: this.partyEl.offsetHeight };
      }
      const { w, h: hh } = this.partySize;
      const placed = placeBeside(w, hh, formation, [...avoid, readingRect].filter(Boolean), W, H, { prefer: this.partySide });
      // with no free side it steps aside: the inspection bar carries the same collective facts
      partyRect = placed ? placed.rect : null;
      this.partySide = placed?.side ?? null;
      this.partyEl.classList.toggle('crowded', !placed);
      if (partyRect) this.partyEl.style.transform = `translate(${Math.round(partyRect.x)}px, ${Math.round(partyRect.y)}px)`;
    }
    this.layout = { W, H, level: this.level, formation, bodies: bodyRects, labels: Object.fromEntries(labelRects), reading: readingRect, party: partyRect, avoid, readingDocked: !!readingRect && this.reading.classList.contains('docked'), partyCrowded: this.partyEl.classList.contains('crowded') };
    return this.level;
  }
}
