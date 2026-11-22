/**
 * Card drag-and-drop (Master Requirements v3 ch.12; Design Companion ch.9–10): pick up one of your
 * unplayed hand cards — from the hand ribbon or its bank slot on the board — carry it over the
 * field and drop it.
 *   - over one of your formations: Supply (the formation lights up; a tooltip shows the Supply
 *     before and after and how far it would carry the party);
 *   - over the Mana pool panel: Burn for its Mana;
 *   - anywhere else: the card slides back to its slot.
 * A drop only plans the command (the same validated command as the buttons); the rules apply it
 * when the Tick resolves. A short pick-up threshold keeps a plain click as "select".
 */
import * as THREE from 'three';

const THRESHOLD = 6; // px before a press becomes a drag
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export class CardDrag {
  /**
   * @param {any} app the VersusApp
   * @param {{ drawCard: Function, pts: (u: number) => string, fmtMana: Function, supplyOf: Function, partyName: Function, legalDestinations: Function }} helpers
   */
  constructor(app, helpers) {
    this.app = app;
    this.h = helpers;
    this.drag = null;
    this._move = (e) => this._onMove(e);
    this._up = (e) => this._onUp(e);
    this._key = (e) => { if (e.code === 'Escape' && this.drag) this._cancel(); };
  }

  /** Can this card be picked up by the viewing player now? */
  canLift(card) {
    const a = this.app;
    return !!card && !a.playback && !a.state.outcome && card.owner === a.viewSeat && a.seats[card.owner] === 'human' && card.state === 'available' && !a._plannedCardIds(card.owner).has(card.id);
  }

  /** Press on a card (ribbon tile or bank tile). `origin` is the screen rect the card returns to. */
  press(e, card, origin) {
    if (!this.canLift(card) || e.button !== 0) return false;
    this.drag = { card, x0: e.clientX, y0: e.clientY, live: false, origin, target: null, el: null, tip: null };
    window.addEventListener('pointermove', this._move);
    window.addEventListener('pointerup', this._up);
    window.addEventListener('keydown', this._key);
    return true;
  }

  get active() { return !!this.drag?.live; }

  _lift() {
    const d = this.drag, a = this.app;
    d.live = true;
    a.dragging = true;
    a.view.setCardLifted(d.card.id, true);
    const face = this.h.drawCard(d.card, a.state, 240, 320);
    face.className = 'drag-card-face';
    d.el = document.createElement('div');
    d.el.className = 'drag-card';
    d.el.append(face);
    d.tip = document.createElement('div');
    d.tip.className = 'drag-tip';
    document.body.append(d.el, d.tip);
    document.body.classList.add('card-dragging');
    a.sound?.play('open', { volume: 0.4 });
  }

  _place(x, y, tilt = 0) {
    const d = this.drag;
    // over a target the card shrinks and lifts above the pointer so the formation stays visible
    const over = !!d.target?.party;
    d.el.style.transform = over
      ? `translate(${x - 48}px, ${y - 150}px) rotate(${tilt * 0.5}deg) scale(0.6)`
      : `translate(${x - 48}px, ${y - 70}px) rotate(${tilt}deg) scale(1)`;
    d.el.style.opacity = over ? '0.92' : '1';
    d.tip.style.transform = `translate(${x + 28}px, ${y + 16}px)`;
  }

  _onMove(e) {
    const d = this.drag;
    if (!d) return;
    if (!d.live) {
      if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < THRESHOLD) return;
      this._lift();
    }
    const tilt = Math.max(-12, Math.min(12, (e.clientX - (d.lastX ?? e.clientX)) * 0.8));
    d.lastX = e.clientX;
    const t = this._targetAt(e);
    if ((t?.key ?? null) !== (d.target?.key ?? null)) {
      d.target = t;
      if (t?.valid) this.app.sound?.play('blip', { volume: 0.35 });
      this._showTarget(t);
    }
    this._place(e.clientX, e.clientY, tilt);
  }

  /** What lies under the pointer: a formation on the board, the Mana pool panel, or nothing. */
  _targetAt(e) {
    const a = this.app, s = a.state, card = this.drag.card;
    const under = document.elementFromPoint(e.clientX, e.clientY);
    if (under?.closest?.('#resources')) {
      const mana = Object.values(card.mana ?? {}).reduce((n, v) => n + v, 0);
      return { key: 'burn', kind: 'burn', valid: mana > 0, reason: mana ? null : 'This card carries no Mana — burning it gives nothing.' };
    }
    const canvas = a.engine.renderer.domElement;
    if (under !== canvas) return null;
    const pick = a._rayFrom(e);
    const p = pick?.party;
    if (!p || !p.alive || p.retired) return pick?.territory ? { key: `ground:${pick.territory.column},${pick.territory.row}`, kind: 'none', valid: false, reason: 'Drop the card on one of your formations to Supply it.' } : null;
    if (p.owner !== card.owner) return { key: p.id, kind: 'supply', party: p, valid: false, reason: 'Supply only goes to your own parties.' };
    return { key: p.id, kind: 'supply', party: p, valid: true };
  }

  _showTarget(t) {
    const a = this.app, d = this.drag, { pts, supplyOf, partyName } = this.h;
    a.view.dropHighlight(a.state, t?.party ?? null, !!t?.valid);
    document.getElementById('resources')?.classList.toggle('drop-burn', t?.kind === 'burn' && t.valid);
    document.getElementById('resources')?.classList.toggle('drop-bad', t?.kind === 'burn' && !t.valid);
    d.el.classList.toggle('over-valid', !!t?.valid);
    d.el.classList.toggle('over-invalid', !!t && !t.valid);
    const tip = d.tip;
    tip.replaceChildren();
    if (!t) { tip.hidden = true; return; }
    tip.hidden = false;
    const line = (cls, text) => { const el = document.createElement('div'); el.className = cls; el.textContent = text; tip.append(el); };
    if (!t.valid) { line('tip-bad', t.reason); return; }
    const card = d.card;
    if (t.kind === 'burn') {
      line('tip-head', `Burn for ${this.h.fmtMana(card.mana)}`);
      line('tip-dim', 'Mana goes to your pool for this Tick and expires at its end.');
      line('tip-dim', `Gives up: Supply ${pts(card.supply)} and its ability.`);
      return;
    }
    const p = t.party;
    const have = supplyOf(p), plan = a._plannedSupply(p), add = card.supply;
    line('tip-head', `+${pts(add)} Supply → ${partyName(a.state, p.id)}`);
    line('tip-num', `Supply ${pts(have)}${plan ? ` (+${pts(plan)} planned)` : ''}  →  ${pts(have + plan + add)}`);
    const steps = Math.floor((have + plan + add) / a.ctx.U);
    if (!p.mount) line('tip-dim', 'A Pawn stores Supply; it moves once a Mount joins it.');
    else if (p.mountLost) line('tip-dim', 'This party lost its mount and cannot travel.');
    else line('tip-dim', `Enough for ${steps} step${steps === 1 ? '' : 's'} of travel${p.destination ? ` toward R${p.destination.row}C${p.destination.column}` : ''}.`);
    if (!a.state.activeColumns.includes(p.region.column)) line('tip-dim', `C${p.region.column} is not active — Supply still arrives; new move orders wait for activation.`);
    const def = a.ctx.catalog.cards[card.abilityId];
    line('tip-dim', `Gives up: ${Object.keys(card.mana ?? {}).length ? this.h.fmtMana(card.mana) + ' and ' : ''}${def?.title ?? 'its ability'}.`);
    line('tip-note', 'Lands when the Tick resolves.');
  }

  _onUp(e) {
    const d = this.drag;
    this._unlisten();
    if (!d) return;
    if (!d.live) { this.drag = null; return; } // a click: the tile's own handler selects it
    const t = this._targetAt(e);
    const a = this.app;
    let ok = false;
    if (t?.valid && t.kind === 'supply') ok = a._addCommand(d.card.owner, { type: 'load_supply', cardId: d.card.id, partyId: t.party.id });
    else if (t?.valid && t.kind === 'burn') ok = a._addCommand(d.card.owner, { type: 'burn', cardId: d.card.id });
    a.view.dropHighlight(a.state, null, false);
    document.getElementById('resources')?.classList.remove('drop-burn', 'drop-bad');
    d.tip.remove();
    if (ok) this._land(d, t, e); else this._return(d, t);
  }

  /** A successful drop: the card flies into the formation (or the pool) and bursts. */
  _land(d, t, e) {
    const a = this.app, { pts } = this.h;
    let to;
    if (t.kind === 'supply') {
      const w = a.view.toWorld(t.party.x, t.party.y);
      to = this._screenOf(w);
    } else {
      const r = document.getElementById('resources').getBoundingClientRect();
      to = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    const fly = reduced() ? 0 : 320;
    d.el.style.transition = `transform ${fly}ms cubic-bezier(.5,-0.2,.7,1), opacity ${fly}ms ease-in`;
    d.el.style.transform = `translate(${to.x - 48}px, ${to.y - 70}px) rotate(0deg) scale(0.25)`;
    d.el.style.opacity = '0.2';
    setTimeout(() => {
      d.el.remove();
      document.body.classList.remove('card-dragging');
      a.dragging = false;
      if (t.kind === 'supply') {
        const w = a.view.toWorld(t.party.x, t.party.y);
        a.view.fx.supply(w, `+${pts(d.card.supply)} Supply`);
        a.sound?.play('coin', { volume: 0.7 });
        a.selected = { kind: 'party', id: t.party.id };
        a._toast(`+${pts(d.card.supply)} Supply planned for ${this.h.partyName(a.state, t.party.id)} — it lands when the Tick resolves`);
      } else {
        a.sound?.play('chime', { volume: 0.6 });
        document.getElementById('resources')?.classList.add('flash');
        setTimeout(() => document.getElementById('resources')?.classList.remove('flash'), 700);
        a._toast(`Burn planned: +${this.h.fmtMana(d.card.mana)} this Tick`);
      }
      a._renderAll();
      this.drag = null;
    }, fly);
  }

  /** An invalid or empty drop: the card slides back to its slot. */
  _return(d, t) {
    const a = this.app;
    if (t && !t.valid) { a._toast(t.reason, true); a.sound?.play('cancel', { volume: 0.5 }); }
    const o = d.origin;
    const back = reduced() ? 0 : 260;
    d.el.style.transition = `transform ${back}ms ease-out, opacity ${back}ms ease-out`;
    d.el.style.transform = `translate(${o.x - 48}px, ${o.y - 70}px) rotate(0deg) scale(0.6)`;
    d.el.style.opacity = '0';
    setTimeout(() => {
      d.el.remove();
      document.body.classList.remove('card-dragging');
      a.view.setCardLifted(d.card.id, false);
      a.dragging = false;
      this.drag = null;
    }, back);
  }

  _cancel() { const d = this.drag; this._unlisten(); if (!d) return; if (!d.live) { this.drag = null; return; } this.app.view.dropHighlight(this.app.state, null, false); d.tip.remove(); this._return(d, null); }

  _unlisten() {
    window.removeEventListener('pointermove', this._move);
    window.removeEventListener('pointerup', this._up);
    window.removeEventListener('keydown', this._key);
  }

  _screenOf(world) {
    const a = this.app;
    const v = new THREE.Vector3(world.x, world.y + 0.6, world.z).project(a.engine.camera);
    const r = a.engine.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  }
}
