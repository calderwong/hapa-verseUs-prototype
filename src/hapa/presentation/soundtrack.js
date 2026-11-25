/**
 * The table soundtrack (Milestones A and B, docs/integrations/IMPLEMENTATION_CHECKPOINT.md).
 *
 * Each participant contributes a selected snapshot of whole recordings from their own Music
 * Library owner (Hapa Song Registry). The table queue alternates whole tracks between the
 * contributions and is shared: one explicit queue controller (the host seat) may advance it, and
 * every change bumps its revision. Volume, mute and whether to listen at all are local to each
 * listener and never touch the queue. The listener's own library node fetches every entry, its own
 * or a peer's, by the exact offer (recording + asset digest), so media bytes and transfer state
 * stay with the music owner and never enter game records.
 *
 * Keep (Milestone B) asks the listener's library to save the reference durably and start verified
 * retention of exactly the heard asset; the states shown are the owner's own, never optimistic.
 * Music never blocks a Tick: every failure leaves the match playable and says so in the strip.
 */
import { h } from './dom.js';

const KEY = 'hapa-versus.music-settings.v1';
const STATE_LABEL = {
  saving: 'Saving…',
  'saved-downloading': 'Saved · downloading',
  'saved-waiting-source': 'Saved · waiting for source',
  'saved-reference-only': 'Saved · reference only',
  verifying: 'Verifying…',
  'available-offline': 'Available offline',
  'download-failed-reference-saved': 'Download failed · reference saved',
};
const TERMINAL = new Set(['available-offline', 'saved-reference-only', 'download-failed-reference-saved']);

function loadSettings() {
  const d = { volume: 0.55, muted: false, listening: true };
  try { return { ...d, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return d; }
}

async function call(url, body) {
  const r = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw Error(j.error || j.message || `${url} ${r.status}`); }
  return r;
}

/** Interleave whole tracks from each contribution, opponent first (it brought them to the table). */
export function alternate(lists) {
  const out = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length) out.push(l[i]);
  return out;
}

export class Soundtrack extends EventTarget {
  /**
   * @param {{ host: HTMLElement, sessionId: string, epoch: number, listener: { library: string, seat: string, label: string }, controller: boolean }} o
   */
  constructor(o) {
    super();
    Object.assign(this, { host: o.host, sessionId: o.sessionId, epoch: o.epoch, listener: o.listener, isController: o.controller });
    this.settings = loadSettings();
    this.queue = { revision: 0, controllerSeat: o.listener.seat, entries: [], index: -1 };
    this.contributions = [];
    this.keeps = new Map(); // assetId → { state, acquisitionId, error }
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.addEventListener('ended', () => this._advance('ended'));
    this.audio.addEventListener('error', () => this._fail('playback failed'));
    this.audio.addEventListener('playing', () => { this.status = 'playing'; this._render(); });
    this.duck = 1;
    this.disposed = false;
    this.el = h('div', { class: 'np-strip', role: 'region', 'aria-label': 'Now playing' });
    o.host.append(this.el);
    this._render();
  }

  /**
   * Build the queue from contribution snapshots, one per participant library.
   * @param {{ library: string, songIds?: string[], participant: any, max?: number }[]} parts
   */
  async prepare(parts) {
    const epoch = this.epoch;
    this.status = 'preparing';
    this._render();
    const lists = [];
    for (const p of parts) {
      try {
        let ids = p.songIds;
        if (!ids) ids = (await (await call(`/music/${p.library}/songs`)).json()).songs.slice(0, p.max ?? 3).map((s) => s.id);
        if (!ids.length) continue;
        const snap = await (await call(`/music/${p.library}/contributions`, { songIds: ids, participant: p.participant })).json();
        if (epoch !== this.epoch) return;
        this.contributions.push({ library: p.library, participant: p.participant, snapshot: snap });
        lists.push(snap.entries.map((e) => ({ ...e, playlistId: snap.playlistId, playlistRevision: snap.revision, contributor: snap.contributor, fromLibrary: p.library, own: p.library === this.listener.library })));
      } catch (e) {
        this.errors = [...(this.errors ?? []), `${p.participant?.label ?? p.library}: ${e.message}`];
        console.warn(`[versus] music contribution unavailable (${p.library}): ${e.message}`);
      }
    }
    if (epoch !== this.epoch) return;
    this.queue.entries = alternate(lists).map((e, i) => ({ ...e, queueEntryId: `q${i + 1}:${e.entryId}`, assetId: e.offer.manifest.files[0].assetId }));
    this.queue.revision = 1;
    this.status = this.queue.entries.length ? 'ready' : 'unavailable';
    this._render();
    return this.queue;
  }

  /** Begin (after the human's sound gesture). */
  start() { if (this.queue.index < 0 && this.queue.entries.length) this._playAt(0); else if (this.settings.listening) this.audio.play().catch(() => {}); }

  get now() { return this.queue.entries[this.queue.index] ?? null; }

  async _playAt(i) {
    const epoch = this.epoch;
    const entry = this.queue.entries[i];
    if (!entry || this.disposed) return;
    this.queue.index = i;
    this.status = 'loading';
    this._render();
    if (!this.settings.listening) return; // the queue advances; this listener chose not to hear it
    try {
      // the listener's own library fetches exactly this offered asset (its own, or over the peer link)
      const r = await call(`/music/${this.listener.library}/audio`, { offer: entry.offer });
      const blob = await r.blob();
      if (epoch !== this.epoch || this.queue.index !== i || this.disposed) return;
      if (this.url) URL.revokeObjectURL(this.url);
      this.url = URL.createObjectURL(blob);
      this.audio.src = this.url;
      this._applyVolume();
      await this.audio.play();
      this.lastPlayback = { queueEntryId: entry.queueEntryId, assetId: entry.assetId, bytes: blob.size, startedAt: new Date().toISOString() };
      this.dispatchEvent(new CustomEvent('track', { detail: entry }));
    } catch (e) {
      if (epoch !== this.epoch) return;
      this._fail(e.message);
    }
  }

  _fail(msg) {
    this.status = 'failed';
    this.error = msg;
    console.warn(`[versus] music: ${msg}`);
    this._render();
  }

  _advance(reason) {
    if (this.queue.index + 1 >= this.queue.entries.length) { this.status = 'finished'; this._render(); return; }
    this.queue.revision++;
    this.queue.lastChange = { reason, by: reason === 'next' ? this.listener.seat : 'track-ended', revision: this.queue.revision };
    this._playAt(this.queue.index + 1);
  }

  /** Shared queue control: only the queue controller may skip. */
  next() { if (this.isController) this._advance('next'); }

  // --- local listener controls (never change the queue) ----------------------------------------
  setVolume(v) { this.settings.volume = Math.max(0, Math.min(1, v)); this._applyVolume(); this._save(); }
  toggleMute() { this.settings.muted = !this.settings.muted; this._applyVolume(); this._save(); this._render(); }
  toggleListening() {
    this.settings.listening = !this.settings.listening;
    this._save();
    if (!this.settings.listening) this.audio.pause();
    else if (this.now) { if (this.audio.src) this.audio.play().catch(() => {}); else this._playAt(this.queue.index); }
    this._render();
  }

  /** Lower the music while the opponent's voice is actually playing. */
  setDucked(on) {
    const target = on ? 0.28 : 1;
    clearInterval(this._duckTimer);
    this._duckTimer = setInterval(() => {
      this.duck += (target - this.duck) * 0.35;
      if (Math.abs(target - this.duck) < 0.02) { this.duck = target; clearInterval(this._duckTimer); }
      this._applyVolume();
    }, 40);
  }

  _applyVolume() { this.audio.volume = this.settings.muted ? 0 : this.settings.volume * this.duck; }
  _save() { try { localStorage.setItem(KEY, JSON.stringify(this.settings)); } catch { /* storage unavailable */ } }

  // --- Keep (Milestone B) ---------------------------------------------------------------------

  /** Keep the current (or given) entry: saved reference first, then verified retention. */
  async keep(entry = this.now) {
    if (!entry || entry.own) return null;
    const k = this.keeps.get(entry.assetId);
    if (k && k.state !== 'download-failed-reference-saved') return k;
    this.keeps.set(entry.assetId, { state: 'saving' });
    this._render();
    try {
      const st = await (await call(`/music/${this.listener.library}/keep`, {
        offer: entry.offer,
        // who introduced it (the participant at this table) is recorded apart from who made it
        // (the offer's own credits, which the owner imports unchanged)
        discovery: { app: 'hapa-versus', sessionId: this.sessionId, playlistId: entry.playlistId, queueRevision: this.queue.revision, entryId: entry.entryId, heardAt: new Date().toISOString(),
          introducer: entry.contributor.participant?.avatarId ? { kind: 'avatar', id: entry.contributor.participant.avatarId, label: entry.contributor.participant.label } : { kind: 'participant', id: entry.contributor.nodeId, label: entry.contributor.participant?.label ?? entry.contributor.label } },
      })).json();
      this.keeps.set(entry.assetId, st);
      this.dispatchEvent(new CustomEvent('kept', { detail: { entry, state: st } })); // the reference is durably saved now
      this._poll(entry.assetId, st.acquisitionId);
      this._render();
      return st;
    } catch (e) {
      this.keeps.set(entry.assetId, { state: 'keep-failed', error: e.message });
      this._render();
      return null;
    }
  }

  async _poll(assetId, acq) {
    for (let i = 0; i < 600 && !this.disposed; i++) {
      const cur = this.keeps.get(assetId);
      if (!cur || TERMINAL.has(cur.state)) return;
      await new Promise((r) => setTimeout(r, i < 20 ? 500 : 2000));
      try {
        const st = await (await call(`/music/${this.listener.library}/keep/${acq}`)).json();
        this.keeps.set(assetId, st);
        this._render();
      } catch { /* the owner is restarting; keep polling */ }
    }
  }

  dispose() {
    this.disposed = true;
    this.epoch = -1;
    clearInterval(this._duckTimer);
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    if (this.url) URL.revokeObjectURL(this.url);
    this.el.remove();
  }

  // --- view -----------------------------------------------------------------------------------

  _render() {
    if (this.disposed) return;
    const e = this.now, s = this.settings;
    const credit = (c) => {
      const who = c?.creators?.length ? c.creators.join(', ') : null;
      return who ? `by ${who}` : c?.generator?.name ? `made with ${c.generator.name}` : 'creator not stated';
    };
    const k = e ? this.keeps.get(e.assetId) : null;
    const keepBtn = !e ? null : e.own ? h('span', { class: 'dim', title: 'This recording is from your own library' }, 'yours')
      : !k || k.state === 'keep-failed' ? h('button', { class: 'np-keep', title: 'Save this song to your library (a saved reference first, then a verified copy)', onclick: () => this.keep() }, k?.state === 'keep-failed' ? 'Keep (retry)' : '♡ Keep')
        : h('span', { class: `np-kept ${k.state}`, title: k.reason || '' }, STATE_LABEL[k.state] ?? k.state);
    const label = this.status === 'preparing' ? 'Gathering tracks…' : this.status === 'unavailable' ? 'Music unavailable — the match plays without it' : this.status === 'failed' ? `Music paused: ${this.error}` : this.status === 'finished' ? 'Queue finished' : !e ? 'Music ready' : null;
    this.el.replaceChildren(...[
      h('span', { class: 'np-icon', 'aria-hidden': 'true' }, '♪'),
      e && !label ? h('span', { class: 'np-title' }, h('b', {}, e.title), h('small', {}, ` · ${e.own ? 'your track' : `from ${e.contributor.label}`} · ${credit(e.credits)}`)) : h('span', { class: 'np-title dim' }, label ?? ''),
      e && this.status === 'loading' ? h('span', { class: 'dim' }, s.listening ? 'loading…' : 'not listening') : null,
      keepBtn,
      h('button', { 'aria-pressed': String(!s.listening), title: 'Listen to the table music on this device (does not change the queue)', onclick: () => this.toggleListening() }, s.listening ? 'Listening' : 'Not listening'),
      h('button', { 'aria-label': s.muted ? 'Music muted' : 'Mute music', 'aria-pressed': String(s.muted), title: 'Music volume on this device only', onclick: () => this.toggleMute() }, s.muted ? '🔇' : '♫'),
      h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: s.volume, 'aria-label': 'Music volume (this device)', oninput: (ev) => this.setVolume(Number(ev.target.value)) }),
      h('button', { 'aria-expanded': String(!!this.showEncounters), title: 'Songs you kept (from your library\'s own record)', onclick: () => this.toggleEncounters() }, 'Kept'),
      this.isController && e ? h('button', { title: `Shared: skip to the next track for everyone at the table (queue revision ${this.queue.revision})`, onclick: () => this.next() }, 'Next ⏭') : null,
      this.showEncounters ? h('div', { class: 'np-encounters' }, this.encounters == null ? h('span', { class: 'dim' }, 'Loading…') : !this.encounters.length ? h('span', { class: 'dim' }, 'Nothing kept yet.')
        : this.encounters.slice(-6).reverse().map((d) => h('div', {}, h('b', {}, d.title ?? d.recordingId), h('small', { class: 'dim' }, ` · introduced by ${d.introducer?.label ?? 'unknown'}${d.encounter?.app ? ` in ${d.encounter.app}` : ''} · ${STATE_LABEL[d.acquisition?.state] ?? d.acquisition?.state ?? 'reference saved'}`)))) : null,
    ].filter(Boolean));
  }

  /** The optional Songs encountered list: what this listener kept, as the library records it. */
  async toggleEncounters() {
    this.showEncounters = !this.showEncounters;
    this.encounters = null;
    this._render();
    if (!this.showEncounters) return;
    try { this.encounters = (await (await call(`/music/${this.listener.library}/encounters`)).json()).encounters; } catch (e) { this.encounters = []; this.error = e.message; }
    this._render();
  }
}
