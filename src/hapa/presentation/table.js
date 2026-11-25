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
import { SeatedAvatar } from './seated-avatar.js';
import * as THREE from 'three';
import { greeting, reactionsTo, resultLine, keptLine } from './reactions.js';

/** A party as the opponent says it: its piece, no seat letter or grid code. */
export function spokenParty(state, id) {
  const p = state.parties?.[id];
  if (!p) return 'party';
  return p.mount ? p.mount[0].toUpperCase() + p.mount.slice(1) : 'Pawn';
}

export class Table {
  /**
   * @param {{ world: HTMLElement, scene?: { root: any, board: { w: number, h: number, S: number } }, sessionId: string, epoch: number, avatarSeat: 'A'|'B', humanSeat: 'A'|'B', avatarId: string, controller: any, songIds: string[], partyLabel: (id: string) => string }} o
   */
  constructor(o) {
    this.o = o;
    this.epoch = o.epoch;
    // the social layer follows the seated figure; music has its own strip (addendum 05 §4.3)
    this.el = h('div', { class: 'table-social' });
    this.musicEl = h('div', { class: 'table-music' });
    this.hit = h('button', { class: 'opp-hit', tabindex: '-1', 'aria-hidden': 'true', title: 'Talk with Red', onclick: () => this.opponent.toggleConversation() });
    o.world.append(this.hit, this.el, this.musicEl);
    this.opponent = new AvatarOpponent({ host: this.el, seat: o.avatarSeat, avatarId: o.avatarId, sessionId: o.sessionId, epoch: o.epoch, controller: o.controller });
    this.seated = o.scene ? new SeatedAvatar({ root: o.scene.root, board: o.scene.board, seat: o.avatarSeat, label: 'Red' }) : null;
    this.opponent.addEventListener('rendering', (e) => this.seated?.setSource(e.detail.canvas));
    this.music = new Soundtrack({ host: this.musicEl, sessionId: o.sessionId, epoch: o.epoch, listener: { library: 'cj', seat: o.humanSeat, label: 'You' }, controller: true });
    this.opponent.addEventListener('speaking', (e) => this.music.setDucked(e.detail.speaking));
    this.music.addEventListener('kept', (e) => this.opponent.say(keptLine(e.detail.entry.title)));
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
    if (!this.seated) { this.el.classList.add('docked'); return; }
    this.seated.update(camera);
    const vis = this.seated.visibility;
    const f = this.seated.faceWorld().project(camera);
    const on = vis > 0.35 && f.z < 1 && Math.abs(f.x) < 0.9 && f.y < 0.95 && f.y > -0.6;
    this.el.classList.toggle('docked', !on);
    this.hit.hidden = !on;
    if (on) {
      const x = (f.x + 1) / 2 * rect.width, y = (1 - f.y) / 2 * rect.height;
      // the projected head size: the figure's width at the face depth
      const edge = this.seated.faceWorld().add(new THREE.Vector3(this.seated.bodyW * 0.22, 0, 0)).project(camera);
      const r = Math.max(24, Math.abs((edge.x - f.x) / 2 * rect.width));
      this.hit.style.cssText = `left:${x - r}px;top:${y - r * 1.25}px;width:${2 * r}px;height:${2.5 * r}px`;
      this.el.style.left = `${Math.min(rect.width - 260, x + r * 1.6)}px`;
      this.el.style.top = `${Math.max(8, y - r * 0.9)}px`;
    } else { this.el.style.left = ''; this.el.style.top = ''; }
  }

  dispose() {
    this.epoch = -1;
    this.seated?.dispose();
    this.hit.remove();
    this.musicEl.remove();
    this.opponent.dispose();
    this.music.dispose();
    this.el.remove();
  }
}
