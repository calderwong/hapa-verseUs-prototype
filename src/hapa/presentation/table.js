/**
 * The social table around one match (Milestones A–B): the Avatar opponent's presence and the shared
 * soundtrack. It observes only what the viewer has been shown and never changes game state; the
 * match runs the same with or without it (and when any owner is unavailable). One instance per
 * match epoch; New match, a different opponent, or closing the page disposes it and fences its
 * late work.
 */
import { h } from './dom.js';
import { AvatarOpponent } from './avatar-opponent.js';
import { Soundtrack } from './soundtrack.js';
import { greeting, reactionsTo, resultLine, keptLine } from './reactions.js';

/** A party as the opponent says it: its piece, no seat letter or grid code. */
export function spokenParty(state, id) {
  const p = state.parties?.[id];
  if (!p) return 'party';
  return p.mount ? p.mount[0].toUpperCase() + p.mount.slice(1) : 'Pawn';
}

export class Table {
  /**
   * @param {{ world: HTMLElement, sessionId: string, epoch: number, avatarSeat: 'A'|'B', humanSeat: 'A'|'B', avatarId: string, controller: any, songIds: string[], partyLabel: (id: string) => string }} o
   */
  constructor(o) {
    this.o = o;
    this.epoch = o.epoch;
    this.el = h('div', { class: 'table-dock' });
    o.world.append(this.el);
    this.opponent = new AvatarOpponent({ host: this.el, seat: o.avatarSeat, avatarId: o.avatarId, sessionId: o.sessionId, epoch: o.epoch, controller: o.controller });
    this.music = new Soundtrack({ host: this.el, sessionId: o.sessionId, epoch: o.epoch, listener: { library: 'cj', seat: o.humanSeat, label: 'You' }, controller: true });
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

  dispose() {
    this.epoch = -1;
    this.opponent.dispose();
    this.music.dispose();
    this.el.remove();
  }
}
