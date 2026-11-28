/**
 * The social table around one match (Milestones A–B; addendum 05): the Avatar opponent seated
 * across the table, its small social layer, and the table soundtrack (a local queue in this browser:
 * two library processes, not synchronized listening between clients). It observes only what the viewer has been shown and never changes game state; the
 * match runs the same with or without it (and when any owner is unavailable). One instance per
 * match epoch; New match, a different opponent, or closing the page disposes it and fences its
 * late work.
 */
import { h } from './dom.js';
import { shortName, soundOf } from './roster.js';
import { AvatarOpponent } from './avatar-opponent.js';
import { Soundtrack } from './soundtrack.js';
import { MusicDeck } from './music-deck.js';
import { SeatedAvatar } from './seated-avatar.js';
import * as THREE from 'three';
import { greeting, reactionsTo, resultLine } from './reactions.js';

/** A party as the opponent says it: its piece, no seat letter or grid code. */
export function spokenParty(state, id) {
  const p = state.parties?.[id];
  if (!p) return 'party';
  return p.mount ? p.mount[0].toUpperCase() + p.mount.slice(1) : 'Pawn';
}

export class Table {
  /**
   * @param {{ world: HTMLElement, scene?: { root: any, board: { w: number, h: number, S: number } }, sessionId: string, epoch: number, avatarSeat: 'A'|'B', humanSeat: 'A'|'B', avatarId: string, controller: any, songIds: string[], partyLabel: (id: string) => string, onLayout?: () => void, onPanel?: (which: 'music'|'talk') => void }} o
   */
  constructor(o) {
    this.o = o;
    this.epoch = o.epoch;
    // the social layer follows the seated figure; music has its own strip (addendum 05 §4.3)
    this.el = h('div', { class: 'table-social' });
    this.musicEl = h('div', { class: 'table-music' });
    this.name = o.avatarId ? shortName(o.avatarId) : (o.opponentLabel ?? 'Opponent');
    this.hit = h('button', { class: 'opp-hit', tabindex: '-1', 'aria-hidden': 'true', title: `Talk with ${this.name}`, onclick: () => this.opponent.toggleConversation() });
    o.world.append(this.hit, this.el, this.musicEl);
    // the social surfaces own their gestures (R11-01): selecting draft text, scrolling the history or
    // dragging a slider never pans, orbits or zooms the board behind them (the inspection view's rule)
    for (const el of [this.el, this.musicEl]) for (const t of ['pointerdown', 'wheel', 'contextmenu']) el.addEventListener(t, (e) => e.stopPropagation());
    // the actual rendered size of the layer (collapsed nameplate or expanded conversation)
    this._size = { w: 0, h: 0 };
    this._music = { w: 0, h: 0 };
    this._ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
      this._size = { w: this.el.offsetWidth, h: this.el.offsetHeight };
      this._music = { w: this.musicEl.offsetWidth, h: this.musicEl.offsetHeight };
    }) : null;
    this._ro?.observe(this.el); this._ro?.observe(this.musicEl);
    // a remote human (review 16, R16-07) gets a neutral nameplate: the local music stays, but no Avatar
    // speaks, reacts or plays for a stranger
    this.opponent = o.avatarId ? new AvatarOpponent({ host: this.el, seat: o.avatarSeat, avatarId: o.avatarId, sessionId: o.sessionId, epoch: o.epoch, controller: o.controller }) : new RemoteOpponent({ host: this.el, label: o.opponentLabel ?? 'Opponent' });
    this.seated = o.scene && o.avatarId ? new SeatedAvatar({ root: o.scene.root, board: o.scene.board, seat: o.avatarSeat, label: this.name, light: o.light }) : null;
    this.opponent.addEventListener('rendering', (e) => this.seated?.setSource(e.detail.canvas));
    this.opponent.addEventListener('retry', () => { clearTimeout(this._retryTimer); this.retryOwners({ manual: true }); });
    this.music = new Soundtrack({ sessionId: o.sessionId, epoch: o.epoch, listener: { library: 'cj', seat: o.humanSeat, label: 'You' }, controller: true });
    this.deck = new MusicDeck(this.music, this.musicEl, { onLayout: () => o.onLayout?.(), onOpen: () => o.onPanel?.('music') });
    // an expanded side panel may need the others to collapse at compact widths (R13-04; the app decides)
    this.opponent.addEventListener('expanded', (e) => { if (e.detail.open) o.onPanel?.('talk'); });
    this._deckPlace = 'default';
    // an independently requested conversation keeps the voice policy (music ducks under speech);
    // Keep is visual only (HF6-03): it says nothing aloud, so it never ducks the music
    this.opponent.addEventListener('speaking', (e) => this.music.setDucked(e.detail.speaking));
    this.firstContactSeen = false;
    // the human's one deliberate sound gesture starts voice and music together
    this._origEnable = this.opponent.enableSound.bind(this.opponent);
    this.opponent.enableSound = async () => { await this._origEnable(); this.music.start(); };
  }

  async start() {
    const epoch = this.epoch;
    // online, only the local listener's own library contributes (no Avatar library, no remote audio)
    // the figure's own music library, if its roster entry has one (only Red's exists); otherwise your library plays
    const own = soundOf(this.o.avatarId).music;
    const sources = own
      ? [{ library: own, participant: { seat: this.o.avatarSeat, avatarId: this.o.avatarId, label: shortName(this.o.avatarId) }, max: 3 }, ...(this.o.songIds?.length ? [{ library: 'cj', songIds: this.o.songIds, participant: { seat: this.o.humanSeat, label: 'You' } }] : [])]
      : [{ library: 'cj', participant: { seat: this.o.humanSeat, label: 'You' }, ...(this.o.songIds?.length ? { songIds: this.o.songIds } : { max: 4 }) }];
    const [, queue] = await Promise.all([this.opponent.attach(), this.music.prepare(sources)]);
    if (epoch !== this.epoch) return;
    this._scheduleOwnerRetry();
    if (!this.o.avatarId) return;
    const redTracks = queue?.entries.filter((e) => e.fromLibrary === 'red').length ?? 0;
    this.opponent.say(greeting({ name: this.name, contributedTracks: redTracks }));
  }

  /**
   * Owner recovery (review 18, R18-01): while Red's renderer or a music contribution is missing,
   * retry with a bounded backoff (4 s doubling to 60 s, then every 60 s) for the life of this match.
   * "Show Red" retries at once. Every attempt is fenced by this table's epoch and the owners' own
   * one-attempt-at-a-time guards, so nothing is seated or queued twice.
   */
  _scheduleOwnerRetry(reset = false) {
    clearTimeout(this._retryTimer);
    if (this.epoch < 0) return;
    const missing = (this.opponent.unbound ?? false) || !!this.music.missing?.length;
    if (!missing) { this._retryDelay = 0; this.opponent.nextRetry = null; return; }
    this._retryDelay = reset || !this._retryDelay ? 4000 : Math.min(60000, this._retryDelay * 2);
    const at = Date.now() + this._retryDelay;
    this.opponent.nextRetry = `in ${Math.round(this._retryDelay / 1000)} s`;
    this.opponent._render?.();
    this._retryTimer = setTimeout(() => { if (Date.now() >= at - 50) this.retryOwners(); }, this._retryDelay);
  }

  async retryOwners({ manual = false } = {}) {
    const epoch = this.epoch;
    if (epoch < 0) return;
    const hadRed = !this.opponent.unbound;
    await Promise.all([this.opponent.unbound ? this.opponent.attach() : null, this.music.retryMissing()]);
    if (epoch !== this.epoch) return;
    // Red arrived late: the Home composition now includes the seated figure
    if (!hadRed && !this.opponent.unbound) this.o.onRendering?.();
    this._scheduleOwnerRetry(manual);
  }

  /** Events the playback just revealed to the viewer. */
  shown(fresh) {
    if (!this.o.avatarId) return;
    const lines = reactionsTo(fresh, { seat: this.o.avatarSeat, partyLabel: this.o.partyLabel, firstContactSeen: this.firstContactSeen });
    if (fresh.some((e) => e.type === 'contact')) this.firstContactSeen = true;
    if (lines[0]) this.opponent.say(lines[0]);
  }

  /** The opponent's accepted orders this Tick (displayed public plan text). */
  orders(texts) { this.opponent.lastOrders = texts; }

  result(outcome) { if (!this.o.avatarId) return; const l = resultLine(outcome, this.o.avatarSeat); if (l) this.opponent.say(l); }

  /** Home fit points: the seated head and shoulders (empty without a seated figure). */
  homePoints() { return this.seated ? this.seated.homePoints() : []; }

  /**
   * Per frame: the seated figure's view policy and texture, then the social layer. Near the figure
   * at Home the nameplate and caption sit beside the face (above the table edge, clear of the banks);
   * when the figure is turned away, faded or out of view they dock in the corner caption region.
   */
  update(camera, rect) {
    // the free game area: inside the world, clear of open drawers (the app's --free-l/--free-r)
    const ws = this.o.world.style, px = (v) => parseFloat(ws.getPropertyValue(v)) || 0;
    const box = { l: px('--free-l') + 8, r: rect.width - px('--free-r') - 8, t: 8, b: rect.height - 8 };
    const open = !!this.opponent.expanded;
    this.el.classList.toggle('open', open);
    // the layer never exceeds the free area; an expanded conversation shrinks its history first,
    // so the question field, settings and the nameplate (collapse) stay reachable (R11-01)
    const maxW = `${Math.max(160, Math.floor(box.r - box.l))}px`;
    if (this._maxW !== maxW) { this._maxW = maxW; this.el.style.setProperty('--soc-max-w', maxW); }
    const size = this._ro ? this._size : { w: this.el.offsetWidth, h: this.el.offsetHeight };
    const drawerOpen = this.musicEl.classList.contains('drawer-open');
    let on = false, x = 0, y = 0, r = 0;
    if (this.seated) {
      this.seated.update(camera);
      const vis = this.seated.visibility;
      const f = this.seated.faceWorld().project(camera);
      on = vis > 0.35 && f.z < 1 && Math.abs(f.x) < 0.9 && f.y < 0.95 && f.y > -0.6;
      if (on) {
        x = (f.x + 1) / 2 * rect.width; y = (1 - f.y) / 2 * rect.height;
        // the projected head size: the figure's width at the face depth
        const edge = this.seated.faceWorld().add(new THREE.Vector3(this.seated.bodyW * 0.22, 0, 0)).project(camera);
        r = Math.max(24, Math.abs((edge.x - f.x) / 2 * rect.width));
      }
    }
    this.hit.hidden = !on;
    // the Music deck: placed from both reserved edges (R13-04) and kept clear of the face when closed
    const deck = this._placeDeck(rect, { on, x, y, r }, drawerOpen);
    // the social layer stays below the deck where they share columns; an open drawer is reserved out
    // of the free area itself (the app's --free-r), so nothing goes under it
    const belowMusic = drawerOpen ? box.t : deck.b + 6;
    const underDeck = (l, w) => !drawerOpen && l < deck.r && l + w > deck.l;
    // nor under the camera pad (top left) when a narrow free band pushes it there
    const underPad = (l, w) => this._pad && l < this._pad.r && l + w > this._pad.l;
    // beside the face: right of it, else left of it; an expanded panel that fits neither side docks
    // both edges of either candidate must lie in the free area (R12-01): a face panned toward an
    // open drawer cannot leave a panel's unchecked edge behind that drawer
    let left = null;
    if (on) {
      const fits = (l) => l >= box.l && l + size.w <= box.r;
      const right = x + r * 1.6, other = x - r * 1.6 - size.w;
      if (fits(right)) left = right;
      else if (fits(other)) left = other;
      else if (!open && size.w <= box.r - box.l) left = Math.max(box.l, Math.min(right, box.r - size.w));
    }
    const docked = left === null;
    this.el.classList.toggle('docked', docked);
    const lx = docked ? box.r - size.w : left;
    const t0 = Math.max(underDeck(lx, size.w) ? Math.max(box.t, belowMusic) : box.t, underPad(lx, size.w) ? this._pad.b : box.t);
    const top = docked ? t0 : Math.max(t0, Math.min(y - r * 0.9, box.b - size.h));
    const maxH = `${Math.max(120, Math.floor(box.b - t0))}px`;
    if (this._maxH !== maxH) { this._maxH = maxH; this.el.style.setProperty('--soc-max-h', maxH); }
    // the open Music drawer scrolls within the world's height below the deck
    const npMax = `${Math.max(140, Math.floor(rect.height - 16 - (this.deck.deck.offsetHeight || 70) - 10))}px`;
    if (this._npMax !== npMax) { this._npMax = npMax; this.musicEl.style.setProperty('--np-max-h', npMax); }
    if (on) this.hit.style.cssText = `left:${x - r}px;top:${y - r * 1.25}px;width:${2 * r}px;height:${2.5 * r}px`;
    if (docked) { this.el.style.left = ''; this.el.style.top = `${t0}px`; }
    else { this.el.style.left = `${left}px`; this.el.style.top = `${top}px`; }
  }

  /**
   * Place the Music deck inside the band between the left reservation (--free-l) and the other
   * drawers on the right (--music-r), sized from both edges so it can never extend past either
   * (R13-04). While the drawer is closed, the deck avoids the opponent's face at Home: the
   * top-right corner when that is clear, else a compact slot beside the face or below the camera
   * pad. The current placement is kept while it stays clear (no flicker while the camera moves).
   * @returns {{ l: number, t: number, r: number, b: number }} the deck's rectangle in world px
   */
  _placeDeck(rect, face, drawerOpen) {
    const ws = this.o.world.style, px = (v) => parseFloat(ws.getPropertyValue(v)) || 0;
    const L = px('--free-l') + 8, R = rect.width - 8 - px('--music-r');
    const H = this.deck.deck.offsetHeight || 112, MIN = 272, FULL = 440;
    const pad = this.o.world.querySelector('.cam-pad'), pr = pad && !pad.hidden ? pad.getBoundingClientRect() : null, wr = this.o.world.getBoundingClientRect();
    const padR = pr ? pr.right - wr.left + 8 : L, padB = pr ? pr.bottom - wr.top + 6 : 8;
    this._pad = pr ? { l: pr.left - wr.left, r: padR, b: padB } : null;
    // the face region (eyes to chin, with a little air), from the projected head size
    const fb = face.on ? { l: face.x - face.r * 0.8, r: face.x + face.r * 0.8, t: face.y - face.r * 1.3, b: face.y + face.r * 0.7 } : null;
    const cand = {
      default: () => { const w = Math.min(FULL, R - L); return { l: R - w, t: 8, w }; },
      right: () => fb && { l: Math.max(L, fb.r + 8), t: 8, w: Math.min(FULL, R - Math.max(L, fb.r + 8)) },
      left: () => fb && { l: Math.max(L, padR), t: 8, w: Math.min(FULL, fb.l - 8 - Math.max(L, padR)) },
      below: () => fb && { l: L, t: padB, w: Math.min(FULL, Math.min(R, fb.l - 8) - L) },
    };
    const clear = (c, m = 0) => c && c.w >= MIN && (!fb || c.l + c.w + m <= fb.l || c.l - m >= fb.r || c.t + H + m <= fb.t || c.t - m >= fb.b);
    let place = 'default';
    if (!drawerOpen && fb) {
      const cur = this._deckPlace;
      // prefer the corner when it is clearly free; otherwise keep the current slot while it stays clear
      if (clear(cand.default(), 24)) place = 'default';
      else if (cur !== 'default' && clear(cand[cur]())) place = cur;
      else place = ['default', 'right', 'left', 'below'].find((k) => clear(cand[k]())) ?? 'default';
    }
    this._deckPlace = place;
    const c = cand[place]();
    const w = Math.max(Math.min(MIN, R - L), c.w);
    const st = this.musicEl.style, l = `${Math.round(c.l)}px`, t = `${Math.round(c.t)}px`, wd = `${Math.round(w)}px`;
    if (st.left !== l) st.left = l;
    if (st.top !== t) st.top = t;
    if (st.width !== wd) st.width = wd;
    this.musicEl.classList.toggle('compact', w < 400);
    this.musicEl.dataset.place = place;
    return { l: c.l, t: c.t, r: c.l + w, b: c.t + H };
  }

  dispose() {
    this.epoch = -1;
    clearTimeout(this._retryTimer);
    this.seated?.dispose();
    this._ro?.disconnect();
    this.hit.remove();
    this.musicEl.remove();
    this.opponent.dispose();
    this.music.dispose();
    this.deck.dispose();
    this.el.remove();
  }
}

/**
 * The opponent's place at the table when the opponent is a remote person: their actual name on a
 * neutral nameplate and the one sound gesture the local music needs. It never speaks or reacts.
 */
class RemoteOpponent extends EventTarget {
  constructor({ host, label }) {
    super();
    this.expanded = false;
    this.lastOrders = [];
    this.el = h('aside', { class: 'opp-social remote', role: 'complementary', 'aria-label': 'Your opponent' },
      h('div', { class: 'opp-name remote-plate' }, h('span', { class: 'opp-light on', 'aria-hidden': 'true' }), h('span', { class: 'opp-label' }, label), h('span', { class: 'dim small' }, ' · online')),
      this.sound = h('button', { class: 'opp-sound', title: 'Play your table music (browsers need one click before sound)', onclick: () => this.enableSound() }, '🔈 Music on'));
    host.append(this.el);
  }
  async attach() {}
  async enableSound() { this.sound.hidden = true; }
  toggleConversation() {}
  say() {}
  dispose() { this.el.remove(); }
}

