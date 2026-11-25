/**
 * The social table around one match (Milestones A–B; addendum 05): the Avatar opponent seated
 * across the table, its small social layer, and the table soundtrack (a local queue in this browser:
 * two library processes, not synchronized listening between clients). It observes only what the viewer has been shown and never changes game state; the
 * match runs the same with or without it (and when any owner is unavailable). One instance per
 * match epoch; New match, a different opponent, or closing the page disposes it and fences its
 * late work.
 */
import { h } from './dom.js';
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
   * @param {{ world: HTMLElement, scene?: { root: any, board: { w: number, h: number, S: number } }, sessionId: string, epoch: number, avatarSeat: 'A'|'B', humanSeat: 'A'|'B', avatarId: string, controller: any, songIds: string[], partyLabel: (id: string) => string, onLayout?: () => void }} o
   */
  constructor(o) {
    this.o = o;
    this.epoch = o.epoch;
    // the social layer follows the seated figure; music has its own strip (addendum 05 §4.3)
    this.el = h('div', { class: 'table-social' });
    this.musicEl = h('div', { class: 'table-music' });
    this.hit = h('button', { class: 'opp-hit', tabindex: '-1', 'aria-hidden': 'true', title: 'Talk with Red', onclick: () => this.opponent.toggleConversation() });
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
    this.opponent = new AvatarOpponent({ host: this.el, seat: o.avatarSeat, avatarId: o.avatarId, sessionId: o.sessionId, epoch: o.epoch, controller: o.controller });
    this.seated = o.scene ? new SeatedAvatar({ root: o.scene.root, board: o.scene.board, seat: o.avatarSeat, label: 'Red' }) : null;
    this.opponent.addEventListener('rendering', (e) => this.seated?.setSource(e.detail.canvas));
    this.music = new Soundtrack({ sessionId: o.sessionId, epoch: o.epoch, listener: { library: 'cj', seat: o.humanSeat, label: 'You' }, controller: true });
    this.deck = new MusicDeck(this.music, this.musicEl, { onLayout: () => o.onLayout?.() });
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
    const [, queue] = await Promise.all([
      this.opponent.attach(),
      this.music.prepare([
        { library: 'red', participant: { seat: this.o.avatarSeat, avatarId: this.o.avatarId, label: 'Red' }, max: 3 },
        ...(this.o.songIds?.length ? [{ library: 'cj', songIds: this.o.songIds, participant: { seat: this.o.humanSeat, label: 'You' } }] : []),
      ]),
    ]);
    if (epoch !== this.epoch) return;
    const redTracks = queue?.entries.filter((e) => e.fromLibrary === 'red').length ?? 0;
    this.opponent.say(greeting({ name: 'Red', contributedTracks: redTracks }));
  }

  /** Events the playback just revealed to the viewer. */
  shown(fresh) {
    const lines = reactionsTo(fresh, { seat: this.o.avatarSeat, partyLabel: this.o.partyLabel, firstContactSeen: this.firstContactSeen });
    if (fresh.some((e) => e.type === 'contact')) this.firstContactSeen = true;
    if (lines[0]) this.opponent.say(lines[0]);
  }

  /** The opponent's accepted orders this Tick (displayed public plan text). */
  orders(texts) { this.opponent.lastOrders = texts; }

  result(outcome) { const l = resultLine(outcome, this.o.avatarSeat); if (l) this.opponent.say(l); }

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
    const music = this._ro ? this._music : { w: this.musicEl.offsetWidth, h: this.musicEl.offsetHeight };
    // the closed deck holds the top-right corner; the social layer stays below it there. An open Music
    // drawer is reserved out of the free area itself (the app's --free-r), so nothing goes under it
    const drawerOpen = this.musicEl.classList.contains('drawer-open');
    const belowMusic = drawerOpen ? box.t : 8 + music.h + 6, musicLeft = drawerOpen ? box.r + 1 : box.r - music.w;
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
    const t0 = docked || left + size.w > musicLeft ? Math.max(box.t, belowMusic) : box.t;
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

  dispose() {
    this.epoch = -1;
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
