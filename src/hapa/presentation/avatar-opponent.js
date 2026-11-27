/**
 * The Avatar opponent's social presence (Milestone A; human-feedback addendum 05; review 10).
 *
 * One participant binding per match epoch: seat ↔ Avatar identity ↔ renderer package ↔ permitted
 * Voice Card ↔ controller. Everything social goes through its owner, Harbor (renderer package,
 * RedPlayer puppet, voiced utterances via Builder Voice Cards); this module never changes game state.
 *
 * The body is not drawn here. Harbor's RedPlayer renders into an offscreen canvas (`this.canvas`),
 * and the scene attachment (seated-avatar.js) shows it seated across the table. This module owns the
 * small social layer in front of it:
 *  - a nameplate button: pointer and keyboard; it opens the conversation;
 *  - a caption of at most two lines;
 *  - Sound on, Mute voice and Stop;
 *  - a conversation panel built once. Speech, loading and captions update text nodes in place, so a
 *    typed draft, its selection and focus survive every performer update (R10-02).
 * Technical binding details live behind "Who is playing", not in the default scene.
 *
 * Lifecycle and fencing: every utterance carries this match's epoch and a request ID. A new match,
 * a different opponent, Stop, mute or dispose cancels the pending Harbor request and the playing
 * audio at once. An obsolete callback for an old operation is ignored. A malformed reply to the
 * *current* operation finishes that operation with a caption-only fallback. Voice preparation has a
 * finite deadline. At most one line speaks and one waits, and a stale line expires. Music ducking
 * follows the player's actual playback events.
 */
import { h } from './dom.js';
import { answer, MODES } from './reactions.js';
import { FramedRedPlayer } from './red-bridge.js';

const STALE_MS = 35000; // a prepared line older than this is not played
const PREPARE_MS = 30000; // the voice preparation deadline (the owner takes ~9–10 s per line)
const PUPPET_URL = ['', 'puppet', 'red-player.mjs'].join('/');
const KEY = 'hapa-versus.opponent-settings.v1';
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    this.current = null; // { line, requestId, controller, job, state }
    this.pending = null;
    this.log = []; // shown lines (conversation history, session only)
    this._said = new Map(); // text → last time offered (repeat filter), for every kind of line
    this.disposed = false;
    this.speaking = false;
    this.caption = '';
    // the owner renders here; the scene samples it (never shown as a DOM portrait)
    this.canvas = document.createElement('canvas');
    this.canvas.width = 673; this.canvas.height = 841;
    this.el = this._build();
    o.host.append(this.el);
    this._render();
  }

  // --- binding ------------------------------------------------------------------------------

  /** Whether the owner's renderer is still missing (text-only); a retry may restore it. */
  get unbound() { return !this.disposed && !this.player; }

  /**
   * Resolve and pin the exact identity, renderer package and Voice Card; mount the puppet.
   * Idempotent and fenced (review 18, R18-01): one attempt at a time; an attempt superseded by a new
   * match, dispose or a newer attempt releases what it loaded; once a player is bound, further calls
   * do nothing, so a retry can never seat a second performer.
   * @returns {Promise<boolean>} whether the renderer is bound after this call
   */
  attach() {
    if (this.disposed) return Promise.resolve(false);
    if (this.player) return Promise.resolve(true);
    if (this._attaching) return this._attaching;
    const gen = this._attachGen = (this._attachGen ?? 0) + 1;
    this.attempts = (this.attempts ?? 0) + 1;
    this.binding.status = 'binding';
    this._render();
    this._attaching = this._attach(gen).finally(() => { if (this._attachGen === gen) this._attaching = null; });
    return this._attaching;
  }

  /** A player-requested retry ("Try again"): an immediate attempt. */
  retry() { this.dispatchEvent(new CustomEvent('retry')); return this.attach(); }

  /** The owner renderer: Harbor's module on an http(s) page; the loopback frame bridge in the desktop app. */
  async _makePlayer() {
    if (location.protocol === 'app:') return new FramedRedPlayer(this.canvas);
    const { RedPlayer } = await import(/* @vite-ignore */ PUPPET_URL); // served by Harbor (the renderer owner), not bundled
    return new RedPlayer(this.canvas, { packageURL: '/v1/avatar-package', audioURL: (p) => p });
  }

  async _attach(gen) {
    const epoch = this.epoch;
    const live = () => !this.disposed && epoch === this.epoch && gen === this._attachGen;
    let player = null;
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
        this.binding.voice = card && voices.provider?.ready ? { cardId: card.id, label: card.title, provider: 'omnivoice', owner: 'hapa-avatar-builder' } : null;
      } catch (e) { this.binding.voice = null; this.voiceError = e.message; }
      if (!live()) return false;
      player = await this._makePlayer();
      await player.load();
      if (!live() || this.player) { player.dispose(); return !!this.player; } // superseded while loading
      this.player = player;
      this.bindingError = null;
      this.player.reduced = reducedMotion();
      this.player.addEventListener('playback', (e) => this._onPlayback(e.detail));
      if (this.voiceVolume != null) this.player.audio.volume = this.voiceVolume;
      this.binding.status = this.binding.voice ? 'ready' : 'ready-text-only';
      this.dispatchEvent(new CustomEvent('rendering', { detail: { canvas: this.canvas } }));
      this._render();
      return true;
    } catch (e) {
      try { if (player && player !== this.player) player.dispose(); } catch { /* released */ } // a failed load releases its renderer
      if (!live()) return false;
      this.binding.status = 'text-only';
      this.bindingError = e.message;
      console.warn(`[versus] Avatar opponent in text-only mode: ${e.message}`);
      this._render();
      return false;
    }
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
    // never the same words twice within a minute (a sparse opponent, not a ticker); a direct answer is always given
    const now = performance.now();
    if (line.kind !== 'question' && this._said.has(line.text) && now - this._said.get(line.text) < 60000) return false;
    this._said.set(line.text, now);
    const item = { line, at: now, epoch: this.epoch };
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
    const live = () => !this.disposed && item.epoch === this.epoch && this.current === cur; // still the current operation
    cur.deadline = setTimeout(() => controller.abort(Object.assign(Error('voice preparation took too long'), { code: 'deadline' })), PREPARE_MS);
    try {
      cur.state = 'preparing-voice';
      this.player.activity = 'preparing-speech';
      this._render();
      const r = await fetch('/v1/utterance', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId: 'versus-opponent', avatarId: this.avatarId, voiceCardId: this.binding.voice.cardId, speak: true, plan: line.plan, requestId, sessionId: this.sessionId, epoch: item.epoch }) });
      const job = await r.json().catch(() => null);
      clearTimeout(cur.deadline);
      if (!live()) return; // obsolete callback: a newer line, Stop, reset or dispose owns the opponent now
      if (!r.ok || !job) throw Error(job?.error || `utterance ${r.status}`);
      // the current operation must get back exactly what it asked for: anything else is malformed
      if (job.id !== requestId || job.epoch !== item.epoch) throw Error('utterance reply does not match this request');
      if (job.performer?.avatarId !== this.avatarId || job.performer?.package?.revision !== this.binding.renderer?.revision || job.voice?.cardId !== this.binding.voice.cardId) throw Error('utterance identity does not match the bound Avatar');
      if (performance.now() - item.at > STALE_MS) { this._receipt(job.id, 'cancelled', 0); this._done(cur); return; }
      cur.job = job;
      cur.state = 'speaking';
      this.lastVoice = { requestId, preparationMs: job.preparationMs, voiceReceipt: job.voiceReceipt, at: new Date().toISOString() };
      await this.player.play({ id: job.id, plan: job.plan, audio: job.audio });
    } catch (e) {
      clearTimeout(cur.deadline);
      if (!live()) return;
      // a failed, late or malformed preparation of the current line: cancel it, keep the caption, move on
      if (controller.signal.aborted) fetch('/v1/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId }) }).catch(() => {});
      this.voiceError = controller.signal.reason?.message ?? e.message;
      if (this.player) this.player.activity = 'idle';
      cur.state = 'caption';
      this._finishSoon(cur, 3500);
      this._render();
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

  _finishSoon(cur, ms) { clearTimeout(cur.timer); cur.timer = setTimeout(() => this._done(cur), ms); }

  _done(cur) {
    if (this.current !== cur) return;
    clearTimeout(cur.timer); clearTimeout(cur.deadline);
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
      clearTimeout(cur.timer); clearTimeout(cur.deadline);
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

  /**
   * Open or close the conversation (nameplate, figure or keyboard). Collapsing keeps the draft, its
   * selection and the history's scroll for reopening; `quiet` (another panel took the room, R13-04)
   * leaves keyboard focus where the player put it.
   */
  toggleConversation(open = !this.expanded, { quiet = false } = {}) {
    if (!!open === !!this.expanded) return;
    if (!open && this.ui) this._logScroll = this.ui.log.scrollTop;
    this.expanded = open;
    this._render();
    if (open && this._logScroll != null && this.ui) this.ui.log.scrollTop = this._logScroll;
    if (!quiet) { if (open) this.ui.input.focus({ preventScroll: true }); else this.ui.name.focus({ preventScroll: true }); }
    this.dispatchEvent(new CustomEvent('expanded', { detail: { open: !!open } }));
  }

  // --- view (built once; updates touch only the nodes that change) -------------------------------

  _build() {
    const u = this.ui = {};
    const el = h('aside', { class: 'opp-social', role: 'complementary', 'aria-label': 'Your opponent' });
    u.name = h('button', { class: 'opp-name', 'aria-expanded': 'false', title: 'Talk with your opponent (conversation, voice and talk settings)', onclick: () => this.toggleConversation() }, h('span', { class: 'opp-light', 'aria-hidden': 'true' }), h('span', { class: 'opp-label' }));
    u.caption = h('p', { class: 'opp-caption', role: 'status', 'aria-live': 'polite' });
    u.sound = h('button', { class: 'opp-sound', title: 'Let your opponent speak and play the table music (browsers need one click before sound)', onclick: () => this.enableSound() }, '🔈 Sound on');
    u.mute = h('button', { title: "Mute only the opponent's voice (captions stay)", onclick: () => { this.settings.voice = !this.settings.voice; if (!this.settings.voice) this.stop(); this._save(); this._render(); } });
    u.stop = h('button', { title: 'Stop speaking now', onclick: () => this.stop() }, 'Stop');
    // the owner renderer is not answering: say so on the plate and offer an immediate retry (R18-01)
    u.retry = h('button', { class: 'opp-retry', title: "Red's figure and voice come from Harbor on this computer, which is not answering. Try again now (it also retries by itself).", onclick: () => this.retry() }, 'Show Red');
    u.controls = h('div', { class: 'opp-controls' }, u.retry, u.sound, u.mute, u.stop);
    u.log = h('div', { class: 'opp-log', 'aria-live': 'off' });
    u.input = h('input', { type: 'text', maxlength: 200, placeholder: 'Ask about a move or the music…', 'aria-label': 'Ask your opponent',
      onkeydown: (e) => { e.stopPropagation(); if (e.key === 'Escape') { this.toggleConversation(false); return; } if (e.key === 'Enter' && u.input.value.trim()) { const q = u.input.value.trim(); u.input.value = ''; this.ask(q); } } });
    u.modes = Object.fromEntries(['quiet', 'normal', 'talkative'].map((m) => [m, h('button', { onclick: () => { this.settings.mode = m; this._save(); this._render(); } }, m[0].toUpperCase() + m.slice(1))]));
    u.captions = h('input', { type: 'checkbox', onchange: (e) => { this.settings.captions = e.target.checked; this._save(); this._render(); } });
    u.details = h('div', { class: 'opp-details' });
    u.panel = h('section', { class: 'opp-panel', 'aria-label': 'Conversation with your opponent', hidden: true },
      u.log, u.input,
      h('div', { class: 'opp-row' }, 'Talk: ', ...Object.values(u.modes), h('label', {}, u.captions, ' captions')),
      h('details', { class: 'opp-binding' }, h('summary', {}, 'Who is playing'), u.details));
    el.append(h('div', { class: 'opp-head' }, u.name, u.controls), u.caption, u.panel);
    return el;
  }

  _render() {
    if (this.disposed || !this.ui) return;
    const u = this.ui, b = this.binding, s = this.settings;
    this.el.classList.toggle('speaking', this.speaking);
    this.el.classList.toggle('unbound', !this.player);
    u.retry.hidden = !!this.player || !this.bindingError;
    u.retry.textContent = b.status === 'binding' ? 'Connecting…' : 'Show Red';
    this.el.classList.toggle('expanded', !!this.expanded);
    u.name.setAttribute('aria-expanded', String(!!this.expanded));
    u.name.querySelector('.opp-label').textContent = `${b.avatar.label}${this.current?.state === 'preparing-voice' ? ' …' : ''}`;
    u.caption.textContent = s.captions ? this.caption || '' : '';
    u.caption.hidden = !s.captions || !this.caption;
    u.sound.hidden = s.sound;
    u.mute.hidden = !s.sound;
    u.mute.textContent = s.voice ? 'Mute voice' : 'Voice muted';
    u.mute.setAttribute('aria-pressed', String(!s.voice));
    u.stop.hidden = !this.current;
    u.panel.hidden = !this.expanded;
    if (!this.expanded) return;
    // only the history and labels change; the input element and its draft are never replaced
    const shown = this.log.slice(-8);
    const key = shown.map((m) => m.at ?? m.text).join('|') + shown.length;
    if (key !== this._logKey) { this._logKey = key; u.log.replaceChildren(...shown.map((m) => h('p', { class: m.who === 'you' ? 'you' : 'them' }, h('b', {}, `${m.who}: `), m.text))); u.log.scrollTop = u.log.scrollHeight; this._logScroll = null; }
    for (const [m, btn] of Object.entries(u.modes)) btn.setAttribute('aria-pressed', String(s.mode === m));
    u.captions.checked = s.captions;
    const detail = [
      `${b.avatar.label} (${b.avatar.id}) plays seat ${b.seat}. Moves: ${this.controller.label}.`,
      b.renderer && this.player ? `Renderer ${b.renderer.packageId} ${b.renderer.revision} (${b.renderer.renderer}) via Harbor${location.protocol === 'app:' ? ' (desktop renderer frame)' : ''}.` : `Renderer unavailable${this.bindingError ? `: ${this.bindingError}` : ''}; the seat shows an empty chair. ${this.nextRetry ? `Trying again ${this.nextRetry}.` : ''} (attempt ${this.attempts ?? 0})`,
      b.voice ? `Voice: ${b.voice.label} (Builder Voice Card, ${b.voice.provider}).` : `Voice unavailable${this.voiceError ? `: ${this.voiceError}` : ''}; captions only.`,
      this.lastVoice ? `Last voice: prepared in ${(this.lastVoice.preparationMs / 1000).toFixed(1)} s${this.lastVoice.playbackStartedAt ? ', played' : ''}.` : null,
      this.voiceError && b.voice ? `Last voice problem: ${this.voiceError}.` : null,
      `Match epoch ${this.epoch} · session ${this.sessionId.slice(0, 24)}`,
    ].filter(Boolean).join('\n');
    if (u.details.textContent !== detail) u.details.textContent = detail;
  }
}
