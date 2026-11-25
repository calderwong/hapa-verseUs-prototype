/**
 * The table soundtrack (Milestones A and B, docs/integrations/IMPLEMENTATION_CHECKPOINT.md).
 *
 * Each participant contributes a selected snapshot of whole recordings from their own Music
 * Library owner (Hapa Song Registry). The table queue alternates whole tracks between the
 * contributions. It is local to this browser: one queue controller (the host seat) may advance it,
 * and every change bumps its revision. There is no remote queue subscription or room clock yet, so
 * this is not synchronized listening between human clients (review 10, R10-06). Volume, mute and whether to listen at all are local to each
 * listener and never touch the queue. The listener's own library node fetches every entry, its own
 * or a peer's, by the exact offer (recording + asset digest), so media bytes and transfer state
 * stay with the music owner and never enter game records.
 *
 * Keep (Milestone B) asks the listener's library to save the reference durably and start verified
 * retention of exactly the offered asset of that queue entry. It records whether it was actually heard
 * here; the states shown are the owner's own, never optimistic.
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
const RETRYABLE = new Set(['keep-failed', 'download-failed-reference-saved']);
const ACQUIRE_MS = 20000, START_MS = 8000; // bounded waits for a track's bytes and its first sound

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
    // Keep is per encounter (this queue entry and its introducer), not per byte asset: the owner
    // stores identical bytes once and records each introduction as its own discovery (R10-04)
    this.keeps = new Map(); // queueEntryId → owner state | { state: 'saving' | 'keep-failed' }
    // playback identity (R10-03): the selected entry, the audio actually loaded (fenced by a
    // per-request generation, never by array index alone) and what was actually heard
    this.playGen = 0;
    this.active = null; // { gen, entry, url }
    this.heard = new Map(); // queueEntryId → ISO time the audio really started
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.addEventListener('ended', () => { if (this.active?.gen === this.playGen) this._advance('ended'); });
    this.audio.addEventListener('error', () => { if (this.active?.gen === this.playGen && this.audio.getAttribute('src')) this._fail(this.active.entry, 'playback failed'); });
    this.audio.addEventListener('playing', () => {
      const a = this.active;
      if (!a || a.gen !== this.playGen || a.entry !== this.now) return;
      if (!this.heard.has(a.entry.queueEntryId)) this.heard.set(a.entry.queueEntryId, new Date().toISOString());
      this.status = 'playing';
      this._render();
    });
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
  start() { if (this.queue.index < 0 && this.queue.entries.length) this._select(0); else if (this.settings.listening) this._resume(); }

  get now() { return this.queue.entries[this.queue.index] ?? null; }

  /** Stop and release whatever audio is loaded, and fence any pending acquisition. */
  _detach() {
    this.playGen++;
    this._pending?.abort();
    this._pending = null;
    this.audio.pause();
    if (this.audio.getAttribute('src')) { this.audio.removeAttribute('src'); this.audio.load(); }
    if (this.active?.url) URL.revokeObjectURL(this.active.url);
    this.active = null;
  }

  /** A committed switch: the old song stops at once, so it can never play under the new title. */
  _select(i) {
    if (!this.queue.entries[i] || this.disposed) return;
    this._detach();
    this.queue.index = i;
    this.status = 'loading';
    this.error = null;
    this._render();
    if (this.settings.listening) this._load();
  }

  async _load() {
    const gen = this.playGen, entry = this.now;
    if (!entry) return;
    const ctl = this._pending = new AbortController();
    const timer = setTimeout(() => ctl.abort(Object.assign(Error('the track took too long to arrive'), { code: 'deadline' })), ACQUIRE_MS);
    let url = null;
    try {
      // the listener's own library fetches exactly this offered asset (its own, or over the peer link)
      const r = await fetch(`/music/${this.listener.library}/audio`, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offer: entry.offer }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw Error(j.error || `audio ${r.status}`); }
      const blob = await r.blob();
      clearTimeout(timer);
      // a replaced selection, Not listening or disposal while this was in flight: drop the bytes
      if (gen !== this.playGen || !this.settings.listening || this.disposed || this.now !== entry) return;
      url = URL.createObjectURL(blob);
      this.active = { gen, entry, url, bytes: blob.size };
      this.audio.src = url;
      this._applyVolume();
      await Promise.race([this.audio.play(), new Promise((_, no) => setTimeout(() => no(Error('playback did not start')), START_MS))]);
      if (gen !== this.playGen) return;
      this.lastPlayback = { queueEntryId: entry.queueEntryId, assetId: entry.assetId, bytes: blob.size, startedAt: new Date().toISOString() };
      this.dispatchEvent(new CustomEvent('track', { detail: entry }));
    } catch (e) {
      clearTimeout(timer);
      if (gen !== this.playGen || this.disposed) return; // superseded, not failed
      this._fail(entry, ctl.signal.reason?.message ?? e.message);
    } finally { if (this._pending === ctl) this._pending = null; }
  }

  /**
   * One finite failure policy: the queue controller moves past an unusable entry once; a listener
   * who is not the controller just reports it. There is no retry chain.
   */
  _fail(entry, msg) {
    this.status = 'failed';
    this.error = msg;
    console.warn(`[versus] music: ${msg}`);
    this._render();
    if (!this.isController || !entry || entry.skipped || entry !== this.now) return;
    entry.skipped = true;
    setTimeout(() => { if (this.now === entry && !this.disposed) this._advance('skip-unusable'); }, 1500);
  }

  _advance(reason) {
    if (this.queue.index + 1 >= this.queue.entries.length) { this._detach(); this.status = 'finished'; this._render(); return; }
    this.queue.revision++;
    this.queue.lastChange = { reason, by: reason === 'next' ? this.listener.seat : reason, revision: this.queue.revision };
    this._select(this.queue.index + 1);
  }

  /** Queue controller only: skip to the next track of this table's (local) queue. */
  next() { if (this.isController) this._advance('next'); }

  // --- local listener controls (never change the queue) ----------------------------------------
  setVolume(v) { this.settings.volume = Math.max(0, Math.min(1, v)); this._applyVolume(); this._save(); }
  toggleMute() { this.settings.muted = !this.settings.muted; this._applyVolume(); this._save(); this._render(); }
  toggleListening() {
    this.settings.listening = !this.settings.listening;
    this._save();
    if (!this.settings.listening) {
      // opting out also cancels an acquisition in flight, so it cannot start playing afterwards
      this._pending?.abort(); this._pending = null;
      this.playGen++;
      this.audio.pause();
    } else this._resume();
    this._render();
  }

  /** Resume the selected entry: its own loaded audio if that is what is loaded, otherwise fetch it. */
  _resume() {
    if (!this.now) return;
    if (this.active && this.active.entry === this.now && this.audio.getAttribute('src')) {
      this.active.gen = ++this.playGen;
      this.audio.play().catch((e) => this._fail(this.now, e.message));
    } else this._select(this.queue.index);
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

  /**
   * Keep the current (or given) entry: saved reference first, then verified retention. Keyed by the
   * encounter, so a second introducer of the same bytes is recorded too; a repeated click on the
   * same encounter is idempotent, and both failure states retry through the owner's idempotent Keep.
   * `heardAt` is only the time the audio really started here; an unheard save says so.
   */
  async keep(entry = this.now) {
    if (!entry || entry.own) return null;
    const k = this.keeps.get(entry.queueEntryId);
    if (k && !RETRYABLE.has(k.state)) return k;
    this.keeps.set(entry.queueEntryId, { state: 'saving' });
    this._render();
    const heardAt = this.heard.get(entry.queueEntryId) ?? null;
    try {
      const st = await (await call(`/music/${this.listener.library}/keep`, {
        offer: entry.offer,
        // who introduced it (the participant at this table) is recorded apart from who made it
        // (the offer's own credits, which the owner imports unchanged)
        discovery: { app: 'hapa-versus', sessionId: this.sessionId, playlistId: entry.playlistId, queueRevision: this.queue.revision, entryId: entry.queueEntryId, heardAt,
          introducer: entry.contributor.participant?.avatarId ? { kind: 'avatar', id: entry.contributor.participant.avatarId, label: entry.contributor.participant.label } : { kind: 'participant', id: entry.contributor.nodeId, label: entry.contributor.participant?.label ?? entry.contributor.label } },
      })).json();
      this.keeps.set(entry.queueEntryId, { ...st, heard: !!heardAt });
      if (!k) this.dispatchEvent(new CustomEvent('kept', { detail: { entry, state: st, heard: !!heardAt } })); // the reference is durably saved now
      this._poll(entry.queueEntryId, st.acquisitionId);
      this._render();
      return st;
    } catch (e) {
      this.keeps.set(entry.queueEntryId, { state: 'keep-failed', error: e.message });
      this._render();
      return null;
    }
  }

  async _poll(key, acq) {
    for (let i = 0; i < 600 && !this.disposed; i++) {
      const cur = this.keeps.get(key);
      if (!cur || TERMINAL.has(cur.state) || cur.acquisitionId !== acq) return;
      await new Promise((r) => setTimeout(r, i < 20 ? 500 : 2000));
      try {
        const st = await (await call(`/music/${this.listener.library}/keep/${acq}`)).json();
        if (this.keeps.get(key)?.acquisitionId !== acq) return;
        this.keeps.set(key, { ...st, heard: cur.heard });
        this._render();
      } catch { /* the owner is restarting; keep polling */ }
    }
  }

  dispose() {
    this.disposed = true;
    this.epoch = -1;
    clearInterval(this._duckTimer);
    this._detach();
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
    const k = e ? this.keeps.get(e.queueEntryId) : null;
    const unheard = e && !this.heard.has(e.queueEntryId) ? ' (not heard yet: saved as unheard)' : '';
    const keepBtn = !e ? null : e.own ? h('span', { class: 'dim', title: 'This recording is from your own library' }, 'yours')
      : !k ? h('button', { class: 'np-keep', title: `Save this song to your library: a saved reference first, then a verified copy${unheard}`, onclick: () => this.keep() }, '♡ Keep')
        : RETRYABLE.has(k.state) ? h('span', { class: 'np-kept' }, h('span', { class: `np-kept ${k.state}`, title: k.error?.message ?? k.error ?? '' }, k.state === 'keep-failed' ? 'Keep failed' : STATE_LABEL[k.state]), ' ', h('button', { class: 'np-keep', title: 'Try again (the library keeps one record of this encounter)', onclick: () => this.keep() }, 'Retry'))
          : h('span', { class: `np-kept ${k.state}`, title: k.heard === false ? 'Saved without having been heard here' : '' }, `${STATE_LABEL[k.state] ?? k.state}${k.heard === false ? ' · unheard' : ''}`);
    const label = this.status === 'preparing' ? 'Gathering tracks…' : this.status === 'unavailable' ? 'Music unavailable — the match plays without it' : this.status === 'failed' ? `Music paused: ${this.error}` : this.status === 'finished' ? 'Queue finished' : !e ? 'Music ready' : null;
    this.el.replaceChildren(...[
      h('span', { class: 'np-icon', 'aria-hidden': 'true' }, '♪'),
      e && !label ? h('span', { class: 'np-title' }, h('b', {}, e.title), h('small', {}, ` · ${e.own ? 'your track' : `from ${e.contributor.label}`} · ${credit(e.credits)}`)) : h('span', { class: 'np-title dim' }, label ?? ''),
      e && (this.status === 'loading' || !s.listening) ? h('span', { class: 'dim' }, s.listening ? 'loading…' : 'not listening') : null,
      keepBtn,
      h('button', { 'aria-pressed': String(!s.listening), title: 'Listen to the table music on this device (does not change the queue)', onclick: () => this.toggleListening() }, s.listening ? 'Listening' : 'Not listening'),
      h('button', { 'aria-label': s.muted ? 'Music muted' : 'Mute music', 'aria-pressed': String(s.muted), title: 'Music volume on this device only', onclick: () => this.toggleMute() }, s.muted ? '🔇' : '♫'),
      h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: s.volume, 'aria-label': 'Music volume (this device)', oninput: (ev) => this.setVolume(Number(ev.target.value)) }),
      h('button', { 'aria-expanded': String(!!this.showEncounters), title: 'Songs you kept (from your library\'s own record)', onclick: () => this.toggleEncounters() }, 'Kept'),
      this.isController && e ? h('button', { title: `Next track in this table's queue (local to this browser; queue revision ${this.queue.revision})`, onclick: () => this.next() }, 'Next ⏭') : null,
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
