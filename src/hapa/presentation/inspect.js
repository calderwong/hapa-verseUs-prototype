/**
 * Contextual inspection on the board (human-feedback addendum 01, §3; review 04, R4-01).
 *
 * One controller for every inspectable thing — Cards in the real banks, parties, members, Mana
 * basins / Fire Pits, events — with separate states that never imply each other:
 *   - hover (transient): opens after a deliberate pause, follows scanning quickly once a view is
 *     open, and stays while the pointer is over the source, the leader corridor or the view;
 *   - keyboard focus (transient): opens at once for the focused navigator entry or board object;
 *   - pinned: one subject chosen by click / tap / Enter; it stays until unpinned or dismissed;
 *   - compare: a transient view beside the pinned one (one at a time).
 * Hover never selects, orders, moves the camera or takes focus. Escape closes the top layer and
 * suppresses that subject until the pointer leaves it. Views are nonmodal regions (their content is
 * interactive); pure term definitions use the glossary's tooltip instead.
 *
 * Subjects are keyed by match generation, kind and stable instance id — never a bank slot — so a
 * replaced Card or a merged party cannot inherit a pinned view: the builder decides what an id now
 * is (history / merged-into) and the view says so.
 */
import { h } from './dom.js';

/** Tunable initial timings from the addendum (ms). */
export const TIMING = { enter: 150, scan: 60, exit: 250 };

/**
 * @typedef {{ kind: 'card'|'party'|'member'|'event'|'basin', id: string, event?: any }} Subject
 */
export class InspectController {
  /**
   * @param {{ host: HTMLElement, generation: () => number, build: (s: Subject) => ({ title: string, tag?: string, node: Node } | null),
   *           project: (s: Subject) => ({ x: number, y: number } | null), onPin?: (s: Subject|null) => void }} o
   */
  constructor({ host, generation, build, project, onPin, reserved = () => ({ left: 0, right: 0 }) }) {
    Object.assign(this, { host, generation, build, project, onPin, reserved });
    this.shown = { transient: null, pinned: null }; // { subject, key, el, pos }
    this.pendingHover = null;
    this.timer = null;
    this.exitTimer = null;
    this.suppressed = null;
    this.suspended = false;
    this.pointerInView = false;
    this.leaders = h('div', { class: 'peek-leaders', 'aria-hidden': 'true' });
    host.append(this.leaders);
  }

  key(s) { return s ? `${this.generation()}:${s.kind}:${s.id}` : null; }

  /** Pointer over a board object (or nothing). Applies the entry / scan / exit timings. */
  hover(subject) {
    if (this.suspended) return;
    const k = this.key(subject);
    if (k && k === this.suppressed) return;
    if (!k) { this.suppressed = null; this._scheduleHide(); return; }
    if (this.suppressed && this.suppressed !== k) this.suppressed = null;
    const cur = this.shown.transient;
    if (cur?.key === k || this.shown.pinned?.key === k) { clearTimeout(this.exitTimer); this.exitTimer = null; clearTimeout(this.timer); this.pendingHover = null; return; }
    if (this.pendingHover === k) return;
    clearTimeout(this.timer);
    this.pendingHover = k;
    const delay = cur ? TIMING.scan : TIMING.enter;
    this.timer = setTimeout(() => { this.pendingHover = null; if (!this.suspended) this._show('transient', subject, 'hover'); }, delay);
  }

  /** Keyboard focus on an object's named control: inspect at once, without moving focus. */
  focusSubject(subject) {
    if (this.suspended || this.shown.pinned?.key === this.key(subject)) return;
    clearTimeout(this.timer); this.pendingHover = null;
    this._show('transient', subject, 'focus');
  }

  blurSubject() { this._scheduleHide(); }

  /** Pin a subject (click / tap / Enter). `focusInto` moves the keyboard into the view. */
  pin(subject, { focusInto = false, opener = null } = {}) {
    clearTimeout(this.timer); this.pendingHover = null;
    this._hide('transient');
    this._show('pinned', subject, 'pin');
    this.opener = opener;
    this.onPin?.(subject);
    if (focusInto) this.shown.pinned?.el.querySelector('.peek-title')?.focus();
  }

  unpin({ restoreFocus = true } = {}) {
    if (!this.shown.pinned) return;
    this._hide('pinned');
    this.onPin?.(null);
    if (restoreFocus && this.opener?.isConnected) this.opener.focus();
    this.opener = null;
  }

  /** Escape: close the top contextual layer; returns whether anything closed. */
  dismissTop() {
    if (this.shown.transient) { this.suppressed = this.shown.transient.key; this._hide('transient'); return true; }
    if (this.shown.pinned) { this.suppressed = this.shown.pinned.key; this.unpin(); return true; }
    return false;
  }

  /** Card drag, camera drag, targeting: no unrelated inspection changes meanwhile. */
  setSuspended(on) {
    this.suspended = on;
    if (on) { clearTimeout(this.timer); this.pendingHover = null; this._hide('transient'); }
  }

  /** A new match: nothing from the old one survives. */
  reset() {
    clearTimeout(this.timer); clearTimeout(this.exitTimer);
    this.pendingHover = null; this.suppressed = null;
    this._hide('transient'); this._hide('pinned');
  }

  /** State changed: rebuild the shown views' content from current state (same subjects). */
  refresh() {
    for (const slot of ['pinned', 'transient']) {
      const v = this.shown[slot];
      if (!v) continue;
      if (v.key.split(':')[0] !== String(this.generation())) { this._hide(slot); continue; }
      const focusedInside = v.el.contains(document.activeElement) ? (document.activeElement.getAttribute('aria-label') || document.activeElement.textContent || '').trim() : null;
      const built = this.build(v.subject);
      if (!built) { if (slot === 'transient') this._hide(slot); else this._fill(v, { title: 'No longer available', node: h('p', { class: 'dim' }, 'This record is no longer on the board.') }); continue; }
      this._fill(v, built);
      if (focusedInside) [...v.el.querySelectorAll('button, [tabindex="0"], summary')].find((e) => (e.getAttribute('aria-label') || e.textContent || '').trim() === focusedInside)?.focus({ preventScroll: true });
    }
  }

  /** Per frame: keep each view's leader on its moving world anchor (views themselves stay put). */
  update() {
    const lines = [];
    for (const slot of ['pinned', 'transient']) {
      const v = this.shown[slot];
      if (!v) continue;
      const a = this.project(v.subject);
      if (!a) continue;
      const r = v.el.getBoundingClientRect(), host = this.host.getBoundingClientRect();
      const bx = Math.min(Math.max(a.x, r.left - host.left), r.right - host.left), by = Math.min(Math.max(a.y, r.top - host.top), r.bottom - host.top);
      const len = Math.hypot(bx - a.x, by - a.y);
      if (len < 4) continue;
      lines.push({ a, len, ang: Math.atan2(by - a.y, bx - a.x) });
    }
    while (this.leaders.children.length < lines.length) this.leaders.append(h('i'));
    [...this.leaders.children].forEach((el, i) => {
      const l = lines[i];
      el.hidden = !l;
      if (l) el.style.cssText = `left:${l.a.x}px;top:${l.a.y}px;width:${l.len}px;transform:rotate(${l.ang}rad)`;
    });
  }

  /** Re-place the shown views (a drawer opened or closed, the viewport changed). */
  relayout() { for (const slot of ['pinned', 'transient']) if (this.shown[slot]) this._place(this.shown[slot], slot); }

  get pinnedSubject() { return this.shown.pinned?.subject ?? null; }
  get transientSubject() { return this.shown.transient?.subject ?? null; }

  // --- internals --------------------------------------------------------------------------------
  _scheduleHide() {
    clearTimeout(this.timer); this.pendingHover = null;
    if (!this.shown.transient || this.exitTimer) return;
    this.exitTimer = setTimeout(() => { this.exitTimer = null; if (!this.pointerInView) this._hide('transient'); }, TIMING.exit);
  }

  _show(slot, subject, via) {
    const key = this.key(subject);
    const built = this.build(subject);
    if (!built) return;
    let v = this.shown[slot];
    if (v?.key === key) { this._fill(v, built); return; }
    if (v) this._hide(slot);
    const el = h('section', { class: `peek ${slot}`, role: 'region', 'aria-label': `${slot === 'pinned' ? 'Pinned' : 'Inspecting'}: ${built.title}` });
    el.addEventListener('pointerenter', () => { this.pointerInView = true; clearTimeout(this.exitTimer); this.exitTimer = null; });
    el.addEventListener('pointerleave', () => { this.pointerInView = false; if (slot === 'transient') this._scheduleHide(); });
    for (const t of ['pointerdown', 'wheel', 'contextmenu']) el.addEventListener(t, (e) => e.stopPropagation()); // nothing reaches the board behind the view
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); if (slot === 'pinned') this.unpin(); else this.dismissTop(); } });
    v = { subject, key, el, via, pos: null };
    this.shown[slot] = v;
    this._fill(v, built);
    this.host.append(el);
    this._place(v, slot);
  }

  _fill(v, built) {
    const pinned = v === this.shown.pinned;
    v.el.replaceChildren(
      h('header', { class: 'peek-head' },
        h('h3', { class: 'peek-title', tabindex: '-1' }, built.title),
        built.tag ? h('span', { class: 'peek-tag' }, built.tag) : null,
        pinned ? h('button', { class: 'peek-btn', 'aria-label': 'Unpin and close', title: 'Unpin (Esc)', onclick: () => this.unpin() }, '×')
          : h('button', { class: 'peek-btn', 'aria-label': `Pin ${built.title}`, title: 'Pin this view (click the object, or Enter)', onclick: () => this.pin(v.subject, { focusInto: true }) }, '📌')),
      h('div', { class: 'peek-body' }, built.node));
  }

  /** Place a new view beside its anchor, clamped to the visible host; then it stays put. */
  _place(v, slot) {
    const host = this.host.getBoundingClientRect();
    const W = v.el.offsetWidth, H = v.el.offsetHeight;
    const a = this.project(v.subject) ?? { x: host.width - W / 2 - 12, y: host.height / 2 };
    const pin = this.shown.pinned;
    const margin = 10, gap = 34;
    const res = this.reserved();
    const lo = margin + res.left, hi = host.width - margin - res.right;
    let x, y;
    if (slot === 'transient' && pin && pin !== v) {
      // compare: beside the pinned view, on whichever side has room
      const pr = pin.el.getBoundingClientRect();
      x = pr.right - host.left + 8 + W <= host.width - margin ? pr.right - host.left + 8 : pr.left - host.left - 8 - W;
      y = pr.top - host.top;
    } else {
      // outward: on the side of the anchor away from the middle of the view, so the view lies over
      // the frame and scenery rather than the field, with a short leader back to its source
      const outLeft = a.x < host.width / 2;
      if (outLeft) { x = Math.max(lo, a.x - gap - W); if (x + W > a.x - 6) x = a.x + gap; }
      else { x = Math.min(hi - W, a.x + gap); if (x < a.x + 6) x = a.x - gap - W; }
      y = a.y - Math.min(H / 2, 120);
    }
    x = Math.max(lo, Math.min(x, hi - W));
    y = Math.max(margin, Math.min(y, host.height - H - margin));
    v.el.style.left = `${Math.round(x)}px`;
    v.el.style.top = `${Math.round(y)}px`;
    v.el.style.maxHeight = `${Math.max(160, host.height - y - margin)}px`;
  }

  _hide(slot) {
    const v = this.shown[slot];
    if (!v) return;
    if (v.el.contains(document.activeElement) && slot === 'transient') document.activeElement.blur();
    v.el.remove();
    this.shown[slot] = null;
    if (slot === 'transient') this.pointerInView = false;
  }
}
