/**
 * The Avatar opponent's table presence (Milestone A, docs/integrations/IMPLEMENTATION_CHECKPOINT.md).
 *
 * One participant binding per match epoch: seat ↔ Avatar identity ↔ renderer package ↔ permitted
 * Voice Card ↔ controller. Everything social goes through its owner, Harbor (renderer package,
 * RedPlayer puppet, voiced utterances via Builder Voice Cards); this module never changes game
 * state. It is a compact perch in the opponent's corner: portrait, name, speaking light, a short
 * caption, and on deliberate click a conversation panel (text, controller identity, controls).
 *
 * Lifecycle and fencing: every utterance carries this match's epoch and a request ID. A new match,
 * a different opponent, Stop, mute or dispose cancels the pending Harbor request and the playing
 * audio at once, and a late reply for an old epoch is dropped. At most one line speaks and one
 * waits; a stale line expires. Voice failure leaves the caption; renderer failure leaves a text
 * portrait. Music ducking follows the player's actual playback events, not generation.
 */
import { h } from './dom.js';
import { answer, MODES } from './reactions.js';

const STALE_MS = 35000;
const PUPPET_URL = ['', 'puppet', 'red-player.mjs'].join('/');
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const KEY = 'hapa-versus.opponent-settings.v1';

export const OPPONENT_AVATARS = { 'red-reaper': { label: 'Red', voice: 'Red · natural' } };

/** Local, per-browser social settings (never game state). */
function loadSettings() {
  const d = { mode: 'normal', voice: true, sound: false, captions: true };
  try { return { ...d, ...JSON.parse(localStorage.getItem(KEY) || '{}'), sound: false }; } catch { return d; }
}

export class AvatarOpponent extends EventTarget {
  /**
   * @param {{ host: HTMLElement, seat: 'A'|'B', avatarId: string, sessionId: string, epoch: number, controller: { kind: string, revision: string, label: string } }} o
   */
  constructor(o) {
    super();
    Object.assign(this, { host: o.host, seat: o.seat, avatarId: o.avatarId, sessionId: String(o.sessionId).replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 80), epoch: o.epoch, controller: o.controller });
    this.settings = loadSettings();
    this.binding = { seat: o.seat, sessionId: o.sessionId, epoch: o.epoch, avatar: { id: o.avatarId, label: OPPONENT_AVATARS[o.avatarId]?.label ?? o.avatarId }, renderer: null, voice: null, controller: o.controller, status: 'binding' };
    this.current = null; // { line, requestId, controller, job }
    this.pending = null;
    this.log = []; // shown lines (conversation history, session only)
    this.disposed = false;
    this.speaking = false;
    this.el = this._build();
    o.host.append(this.el);
  }

  // --- binding ------------------------------------------------------------------------------

  /** Resolve and pin the exact identity, renderer package and Voice Card; mount the puppet. */
  async attach() {
    const epoch = this.epoch;
    try {
      const [caps, performer] = await Promise.all([this._get('/capabilities'), this._get('/v1/performer')]);
      if (performer.avatarId !== this.avatarId) throw Error(`Harbor's admitted Avatar is ${performer.avatarId}, not ${this.avatarId}`);
      if (!caps.avatarPackage?.available) throw Error(caps.avatarPackage?.reason || 'renderer package unavailable');
      if (!caps.operations?.includes('utterance')) throw Error('Harbor has no utterance operation');
      this.binding.avatar.identityRevision = `${performer.puppetRevision}#${performer.revision}`;
      this.binding.renderer = { owner: 'hapa-harbor-storefront', packageId: caps.avatarPackage.id, revision: caps.avatarPackage.revision, renderer: caps.avatarPackage.renderer, integrity: caps.avatarPackage.integrity };
      try {
        const voices = await this._get(`/v1/cms/voices/${encodeURIComponent(this.avatarId)}`);
        const want = OPPONENT_AVATARS[this.avatarId]?.voice;
        const card = (voices.cards || []).find((c) => c.title === want) ?? voices.cards?.[0];
        if (card && voices.provider?.ready) this.binding.voice = { cardId: card.id, label: card.title, provider: 'omnivoice', owner: 'hapa-avatar-builder' };
        else this.binding.voice = null;
      } catch (e) { this.binding.voice = null; this.voiceError = e.message; }
      if (epoch !== this.epoch || this.disposed) return;
      const { RedPlayer } = await import(/* @vite-ignore */ PUPPET_URL); // served by Harbor (the renderer owner), not bundled
      const canvas = this.el.querySelector('canvas');
      const player = new RedPlayer(canvas, { packageURL: '/v1/avatar-package', audioURL: (p) => p });
      await player.load();
      if (epoch !== this.epoch || this.disposed) { player.dispose(); return; }
      this.player = player;
      this.player.reduced = reducedMotion();
      this.player.addEventListener('playback', (e) => this._onPlayback(e.detail));
      this.binding.status = this.binding.voice ? 'ready' : 'ready-text-only';
    } catch (e) {
      this.binding.status = 'text-only';
      this.bindingError = e.message;
      console.warn(`[versus] Avatar opponent in text-only mode: ${e.message}`);
    }
    this._render();
  }

  async _get(url) {
    const r = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Error(j.error || `${url} ${r.status}`);
    return j;
  }

  // --- speaking -------------------------------------------------------------------------------

  /** Offer a line. Mode filters it; it may replace the waiting line; it never queues more than one. */
  say(line) {
    if (this.disposed || !line) return false;
    if (!MODES[this.settings.mode]?.has(line.kind)) return false;
    // never the same words twice in a row within a minute (a sparse opponent, not a ticker)
    const now = performance.now();
    if (line.kind !== 'question' && (this._said ??= new Map()).has(line.text) && now - this._said.get(line.text) < 60000) return false;
    this._said.set(line.text, now);
    const item = { line, at: performance.now(), epoch: this.epoch };
    if (this.current) {
      if (line.kind === 'question' || line.priority > this.current.line.priority + 2) { this.stop({ keepCaption: false }); this._start(item); return true; }
      if (!this.pending || line.priority >= this.pending.line.priority) this.pending = item;
      return true;
    }
    this._start(item);
    return true;
  }

  ask(question) {
    this.log.push({ who: 'you', text: question });
    return this.say(answer(question, { lastOrders: this.lastOrders ?? [], controller: this.controller.label }));
  }

  async _start(item) {
    const { line } = item;
    const requestId = crypto.randomUUID();
    const controller = new AbortController();
    const cur = this.current = { line, requestId, controller, job: null, state: 'caption' };
    this.lastLine = { line, at: performance.now() };
    if (!item.replay) this.log.push({ who: this.binding.avatar.label, text: line.text, kind: line.kind, at: new Date().toISOString() });
    this.caption = line.text;
    this._render();
    const voiced = this.settings.sound && this.settings.voice && this.binding.voice && this.player;
    if (!voiced) { this._finishSoon(cur, 4500); return; }
    try {
      cur.state = 'preparing-voice';
      this.player.activity = 'preparing-speech';
      this._render();
      const r = await fetch('/v1/utterance', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId: 'versus-opponent', avatarId: this.avatarId, voiceCardId: this.binding.voice.cardId, speak: true, plan: line.plan, requestId, sessionId: this.sessionId, epoch: item.epoch }) });
      const job = await r.json();
      if (!r.ok) throw Error(job.error || `utterance ${r.status}`);
      // fencing: a reply for another match, an old request or another Avatar never plays
      if (this.disposed || item.epoch !== this.epoch || this.current !== cur || job.epoch !== this.epoch || job.id !== requestId) return;
      if (job.performer?.avatarId !== this.avatarId || job.performer?.package?.revision !== this.binding.renderer?.revision || job.voice?.cardId !== this.binding.voice.cardId) throw Error('utterance identity does not match the bound Avatar');
      if (performance.now() - item.at > STALE_MS) { this._receipt(job.id, 'cancelled', 0); this._done(cur); return; }
      cur.job = job;
      cur.state = 'speaking';
      this.lastVoice = { requestId, preparationMs: job.preparationMs, voiceReceipt: job.voiceReceipt, at: new Date().toISOString() };
      await this.player.play({ id: job.id, plan: job.plan, audio: job.audio });
    } catch (e) {
      if (controller.signal.aborted || this.current !== cur) return;
      this.voiceError = e.message;
      this._finishSoon(cur, 3500);
    }
  }

  _onPlayback({ status, audioTime = 0, id }) {
    const cur = this.current;
    if (!cur?.job || (id && id !== cur.job.id)) return;
    if (['started', 'ended', 'cancelled', 'failed'].includes(status)) this._receipt(cur.job.id, status, audioTime);
    if (status === 'started') { this.lastVoice.playbackStartedAt = new Date().toISOString(); this._setSpeaking(true); }
    if (['ended', 'cancelled', 'failed'].includes(status)) { this._setSpeaking(false); this._done(cur); }
  }

  _receipt(id, status, audioTime) { fetch('/v1/receipt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status, audioTime: audioTime || 0 }) }).catch(() => {}); }

  _setSpeaking(on) {
    if (this.speaking === on) return;
    this.speaking = on;
    this.dispatchEvent(new CustomEvent('speaking', { detail: { speaking: on } }));
    this._render();
  }

  _finishSoon(cur, ms) { cur.timer = setTimeout(() => this._done(cur), ms); }

  _done(cur) {
    if (this.current !== cur) return;
    clearTimeout(cur.timer);
    this.current = null;
    if (this.player) this.player.activity = 'idle';
    const next = this.pending;
    this.pending = null;
    if (next && next.epoch === this.epoch && performance.now() - next.at < STALE_MS) this._start(next);
    else this._render();
  }

  /** Stop speaking now: cancel the Harbor request, stop the audio, drop the waiting line. */
  stop({ keepCaption = true } = {}) {
    const cur = this.current;
    this.pending = null;
    if (cur) {
      this.current = null;
      clearTimeout(cur.timer);
      cur.controller.abort();
      fetch('/v1/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: cur.requestId }) }).catch(() => {});
      if (cur.job) this._receipt(cur.job.id, 'cancelled', this.player?.audio?.currentTime || 0);
    }
    this.player?.stop();
    if (this.player) this.player.activity = 'idle';
    this._setSpeaking(false);
    if (!keepCaption) this.caption = '';
    this._render();
  }

  /** The human enabled sound (one deliberate gesture; browser autoplay rules). */
  async enableSound() {
    this.settings.sound = true;
    try { await this.player?.unlock(); } catch { /* text continues */ }
    this._save();
    // the line on screen was caption-only before this gesture: give it its voice if still fresh
    const last = this.lastLine;
    if (last && performance.now() - last.at < 20000 && (!this.current || this.current.state === 'caption')) {
      if (this.current) { clearTimeout(this.current.timer); this.current = null; }
      this._start({ line: last.line, at: performance.now(), epoch: this.epoch, replay: true });
      return;
    }
    this._render();
  }

  setVoiceVolume(v) { this.voiceVolume = v; if (this.player?.audio) this.player.audio.volume = v; }

  dispose() {
    this.stop({ keepCaption: false });
    this.disposed = true;
    this.epoch = -1;
    this.player?.dispose();
    this.player = null;
    this.el.remove();
  }

  _save() { try { localStorage.setItem(KEY, JSON.stringify({ mode: this.settings.mode, voice: this.settings.voice, captions: this.settings.captions })); } catch { /* storage unavailable */ } }

  // --- view -----------------------------------------------------------------------------------

  _build() {
    const el = h('aside', { class: 'opp-perch', role: 'complementary', 'aria-label': 'Opponent' });
    el.append(
      h('button', { class: 'opp-portrait', 'aria-label': 'Open conversation with your opponent', onclick: () => { this.expanded = !this.expanded; this._render(); } },
        h('canvas', { width: 673, height: 841, 'aria-hidden': 'true' }), h('span', { class: 'opp-light', 'aria-hidden': 'true' })),
      h('div', { class: 'opp-side' }, h('b', { class: 'opp-name' }), h('p', { class: 'opp-caption', role: 'status', 'aria-live': 'polite' }), h('div', { class: 'opp-controls' })),
      h('section', { class: 'opp-panel', hidden: true }));
    return el;
  }

  _render() {
    if (this.disposed) return;
    const el = this.el, b = this.binding;
    el.classList.toggle('speaking', this.speaking);
    el.classList.toggle('expanded', !!this.expanded);
    el.querySelector('.opp-name').textContent = `${b.avatar.label}${this.current?.state === 'preparing-voice' ? ' · …' : ''}`;
    const cap = el.querySelector('.opp-caption');
    cap.textContent = this.settings.captions ? this.caption || '' : '';
    cap.hidden = !this.settings.captions || !this.caption;
    const ctl = el.querySelector('.opp-controls');
    ctl.replaceChildren(...[
      !this.settings.sound ? h('button', { class: 'opp-sound', onclick: () => this.enableSound(), title: 'Let your opponent speak (browsers need one click before sound)' }, '🔈 Sound on') : null,
      this.settings.sound ? h('button', { 'aria-pressed': String(!this.settings.voice), title: 'Mute only the opponent\'s voice (captions stay)', onclick: () => { this.settings.voice = !this.settings.voice; if (!this.settings.voice) this.stop(); this._save(); this._render(); } }, this.settings.voice ? 'Mute voice' : 'Voice muted') : null,
      this.current ? h('button', { onclick: () => this.stop(), title: 'Stop speaking now (X)' }, 'Stop') : null,
    ].filter(Boolean));
    const panel = el.querySelector('.opp-panel');
    panel.hidden = !this.expanded;
    if (!this.expanded) return;
    const input = h('input', { type: 'text', maxlength: 200, placeholder: 'Ask about a move or the music…', 'aria-label': 'Ask your opponent', onkeydown: (e) => { e.stopPropagation(); if (e.key === 'Enter' && input.value.trim()) { this.ask(input.value.trim()); input.value = ''; this._render(); } } });
    panel.replaceChildren(
      h('div', { class: 'opp-log' }, ...this.log.slice(-8).map((m) => h('p', { class: m.who === 'you' ? 'you' : 'them' }, h('b', {}, `${m.who}: `), m.text))),
      input,
      h('div', { class: 'opp-row' }, 'Talk: ', ...['quiet', 'normal', 'talkative'].map((m) => h('button', { 'aria-pressed': String(this.settings.mode === m), onclick: () => { this.settings.mode = m; this._save(); this._render(); } }, m[0].toUpperCase() + m.slice(1))),
        h('label', {}, h('input', { type: 'checkbox', checked: this.settings.captions, onchange: (e) => { this.settings.captions = e.target.checked; this._save(); this._render(); } }), ' captions')),
      h('details', { class: 'opp-binding' }, h('summary', {}, 'Who is playing'),
        h('p', {}, `${b.avatar.label} (${b.avatar.id}) plays seat ${b.seat}. Moves: ${this.controller.label}.`),
        h('p', { class: 'dim' }, b.renderer ? `Renderer ${b.renderer.packageId} ${b.renderer.revision} (${b.renderer.renderer}) via Harbor.` : `Renderer unavailable${this.bindingError ? `: ${this.bindingError}` : ''}.`),
        h('p', { class: 'dim' }, b.voice ? `Voice: ${b.voice.label} (Builder Voice Card, ${b.voice.provider}).` : `Voice unavailable${this.voiceError ? `: ${this.voiceError}` : ''}; captions only.`),
        this.lastVoice ? h('p', { class: 'dim' }, `Last voice: prepared in ${(this.lastVoice.preparationMs / 1000).toFixed(1)} s${this.lastVoice.playbackStartedAt ? ', played' : ''}.`) : null,
        h('p', { class: 'dim' }, `Match epoch ${this.epoch} · session ${this.sessionId.slice(0, 24)}`)));
    input.focus({ preventScroll: true });
  }
}
