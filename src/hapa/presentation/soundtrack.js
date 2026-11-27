/**
 * The table soundtrack (Milestones A and B; Assignment 13 §3A–C, companion §2–§3).
 *
 * Each participant contributes a selected snapshot of whole recordings from their own Music
 * Library owner (Hapa Song Registry). The table mix alternates whole tracks between the
 * contributions. It is local to this browser: one queue controller (the host seat) may advance it,
 * and every change bumps its revision. There is no remote queue subscription or room clock, so this
 * is not synchronized listening between human clients (review 10, R10-06). The listener's own
 * library node fetches every entry by the exact offer (recording + asset digest), so media bytes
 * and transfer state stay with the music owner and never enter game records.
 *
 * One audible player, two explicit listening contexts (companion §2.4):
 *   - table mix: the contribution order with ordinary natural-end advancement;
 *   - local replay: Play on a Queue, Played or Kept row. The first switch bookmarks the table
 *     entry, its position and the listening intent once; the ordered list of that view's playable
 *     rows is captured for manual Previous/Next. A replay stops at the song's end. Return to table
 *     mix restores the bookmark. Nothing here changes the queue or another listener.
 * Every source attempt is fenced by its item and a per-request generation, Pause/not listening and
 * disposal (R10-03, R11-02), under the finite acquisition and start deadlines. The fence is checked
 * again immediately before the audio-play side effect, after any wait for the audio graph (R13-01).
 *
 * Transport is state-aware (R13-02): `primaryAction()` names what the main button will do (Pause a
 * playing or pending start; Play a ready, paused or recoverable selection; Play again a finished
 * table mix from zero or a finished replay), and `togglePlay()` performs exactly that action. A
 * browser activation block keeps the selected recording ('blocked') for one-gesture Play; only
 * unusable media is skipped. Previous follows a bounded chronology of actual playback starts
 * (R13-03), independent of the unique Played collection.
 *
 * Keep (HF6-03) changes saved state only: it never selects, seeks, pauses, restarts, re-gains or
 * navigates, and it announces nothing aloud. Its target is captured when pressed; a reply that
 * arrives after Next changes the saved state of that original encounter only. Played this match is
 * actual playback starting here; Kept is the listener owner's durable record (retained membership
 * plus saved discoveries), replayed by listener library + owner-returned libraryId.
 * Music never blocks a Tick: every failure leaves the match playable and says so.
 */
import { MusicSignal } from './music-signal.js';

const KEY = 'hapa-versus.music-settings.v1';
export const STATE_LABEL = {
  saving: 'Saving…',
  'saved-downloading': 'Saving audio…',
  'saved-waiting-source': 'Waiting for the source',
  'saved-reference-only': 'Reference only',
  'saved-paused': 'Saving audio paused',
  verifying: 'Verifying audio…',
  'available-offline': 'Available offline',
  'download-failed-reference-saved': 'Audio download failed · reference saved',
  'keep-failed': 'Keep failed',
};
const TERMINAL = new Set(['available-offline', 'saved-reference-only', 'download-failed-reference-saved']);
const RETRYABLE = new Set(['keep-failed', 'download-failed-reference-saved']);
const ACQUIRE_MS = 20000, START_MS = 8000; // bounded waits for a track's bytes and its first sound
const RESTART_S = 3; // Previous restarts the song after this much has played
const HISTORY_MAX = 64; // bounded listening chronology (actual playback starts)
/** A browser/device activation block: the recording is fine, the page needs a user gesture. */
const blocked = (msg) => Object.assign(Error(msg), { code: 'blocked' });
/** The owner's retained address (its route matches a literal colon; %3A does not match). */
export const RETAINED_ID = /^retained:[a-f0-9]{24}$/;

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function loadSettings() {
  const d = { volume: 0.55, muted: false, listening: true, response: 'subtle', still: null };
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

/** Who made it, from the recording's own credits; the storing or introducing party is not the creator. */
export function creditLine(c) {
  const who = c?.creators?.length ? c.creators.join(', ') : null;
  return who ? `by ${who}` : c?.generator?.name ? `made with ${c.generator.name}` : 'Creator not stated';
}

/** A queue entry as a playable item (an exact current-session offer). */
function offerItem(e) {
  return { key: e.queueEntryId, kind: 'offer', entry: e, title: e.title, durationSeconds: e.durationSeconds ?? null, version: e.offer?.manifest?.recording?.version ?? null,
    credits: e.credits, assetId: e.assetId, recordingId: e.recordingId, own: e.own, introducer: e.own ? 'You' : (e.contributor.participant?.label ?? e.contributor.label), source: e.contributor.label };
}

/** A retained membership as a playable item (listener library + owner-returned libraryId). */
export function retainedItem(r, library) {
  return { key: `${library}/${r.libraryId}`, kind: 'retained', library, libraryId: r.libraryId, title: r.title, durationSeconds: r.durationSeconds ?? null, version: r.version ?? null,
    credits: r.credits, assetId: r.assetId, recordingId: r.recordingId, receiptId: r.receiptId, retainedAt: r.retainedAt, introductions: r.introductions ?? [], source: r.source?.issuer?.label ?? null };
}

export class Soundtrack extends EventTarget {
  /**
   * @param {{ sessionId: string, epoch: number, listener: { library: string, seat: string, label: string }, controller: boolean }} o
   */
  constructor(o) {
    super();
    Object.assign(this, { sessionId: o.sessionId, epoch: o.epoch, listener: o.listener, isController: o.controller });
    this.settings = loadSettings();
    this.queue = { revision: 0, controllerSeat: o.listener.seat, entries: [], index: -1 };
    this.contributions = [];
    // Keep is per encounter (this queue entry and its introducer), not per byte asset: the owner
    // stores identical bytes once and records each introduction as its own discovery (R10-04)
    this.keeps = new Map(); // queueEntryId → owner state | { state: 'saving' | 'keep-failed' }
    this.mode = 'table'; // 'table' | 'replay'
    this.replay = null; // { list: item[], view, item, ended }
    this.bookmark = null; // { entry, index, time, listening }
    this.tablePos = 0; // the table entry's position when it was last detached
    this.played = []; // { item, firstAt, lastAt, plays } in the order playback first started
    this.history = []; // actual playback starts, oldest first (bounded; consecutive repeats merged)
    this.retained = null; // the owner's retained membership (array) once read
    this.encounters = null;
    this.transport = []; // developer diagnostics: causal transport reasons, most recent last
    this.playGen = 0;
    this.active = null; // { gen, item, url, owned, bytes, started }
    this.heard = new Map(); // queueEntryId → ISO time the audio really started
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.signal = new MusicSignal();
    this.audio.addEventListener('ended', () => { if (this.active?.gen === this.playGen) this._ended(); });
    this.audio.addEventListener('error', () => { if (this.active?.gen === this.playGen && this.audio.getAttribute('src')) this._fail(this.active.item, 'playback failed'); });
    this.audio.addEventListener('playing', () => {
      const a = this.active;
      if (!a || a.gen !== this.playGen || a.item !== this.now) return;
      if (!a.started) { a.started = true; this._markPlayed(a.item); }
      if (a.item.kind === 'offer' && !this.heard.has(a.item.key)) this.heard.set(a.item.key, new Date().toISOString());
      this.status = 'playing';
      this._changed('status');
    });
    this.audio.addEventListener('pause', () => this._changed('status'));
    this.audio.addEventListener('timeupdate', () => this.dispatchEvent(new Event('time')));
    this.audio.addEventListener('loadedmetadata', () => this.dispatchEvent(new Event('time')));
    this.duck = 1;
    this.disposed = false;
    this.status = 'idle';
  }

  /** Effective atmosphere preference: Still follows reduced motion until the player chooses. */
  get still() { return this.settings.still ?? reducedMotion(); }

  _changed(what) { if (!this.disposed) this.dispatchEvent(new CustomEvent('change', { detail: { what } })); }

  _log(reason, from, to) {
    this.transport.push({ at: new Date().toISOString(), reason, context: this.mode, from: from?.key ?? null, to: to?.key ?? null, gen: this.playGen });
    if (this.transport.length > 60) this.transport.shift();
  }

  /**
   * Build the queue from contribution snapshots, one per participant library.
   * @param {{ library: string, songIds?: string[], participant: any, max?: number }[]} parts
   */
  async prepare(parts) {
    const epoch = this.epoch;
    this.status = 'preparing';
    this._changed('status');
    this.refreshKept().catch(() => {}); // the durable library, independent of this match's queue
    const lists = [];
    this.missing = [];
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
        this.missing.push(p);
        console.warn(`[versus] music contribution unavailable (${p.library}): ${e.message}`);
      }
    }
    if (epoch !== this.epoch) return;
    this.queue.entries = alternate(lists).map((e, i) => ({ ...e, queueEntryId: `q${i + 1}:${e.entryId}`, assetId: e.offer.manifest.files[0].assetId }));
    for (const e of this.queue.entries) e.item = offerItem(e);
    this.queue.revision = 1;
    this.status = this.queue.entries.length ? 'ready' : 'unavailable';
    this._changed('queue');
    return this.queue;
  }

  /**
   * Retry the contributions whose library did not answer at setup (review 18, R18-01). A late
   * contribution is appended after the queue as it stands, so nothing playing or already played
   * moves; the queue revision advances once. Fenced by the match epoch; one retry at a time.
   * @returns {Promise<boolean>} whether every contribution is now present
   */
  async retryMissing() {
    if (this.disposed || !this.missing?.length) return !this.missing?.length;
    if (this._retrying) return this._retrying;
    const epoch = this.epoch;
    this._retrying = (async () => {
      const still = [];
      for (const p of this.missing) {
        try {
          let ids = p.songIds;
          if (!ids) ids = (await (await call(`/music/${p.library}/songs`)).json()).songs.slice(0, p.max ?? 3).map((s) => s.id);
          if (!ids.length) continue;
          const snap = await (await call(`/music/${p.library}/contributions`, { songIds: ids, participant: p.participant })).json();
          if (epoch !== this.epoch || this.disposed) return false;
          this.contributions.push({ library: p.library, participant: p.participant, snapshot: snap });
          const base = this.queue.entries.length;
          const add = snap.entries.map((e, i) => ({ ...e, playlistId: snap.playlistId, playlistRevision: snap.revision, contributor: snap.contributor, fromLibrary: p.library, own: p.library === this.listener.library, queueEntryId: `q${base + i + 1}:${e.entryId}`, assetId: e.offer.manifest.files[0].assetId }));
          for (const e of add) e.item = offerItem(e);
          this.queue.entries.push(...add);
          this.queue.revision++;
          this.errors = (this.errors ?? []).filter((x) => !x.startsWith(`${p.participant?.label ?? p.library}:`));
        } catch { still.push(p); }
      }
      if (epoch !== this.epoch || this.disposed) return false;
      this.missing = still;
      if (this.queue.entries.length && this.status === 'unavailable') this.status = 'ready';
      this._changed('queue');
      return !still.length;
    })().finally(() => { this._retrying = null; });
    return this._retrying;
  }

  /** Begin (after the human's sound gesture). */
  start() {
    this._attachSignal();
    if (this.queue.index < 0 && this.queue.entries.length) this._select(0, 'start');
    else if (this.settings.listening) this._resume();
  }

  _attachSignal() { if (this.signal.attach(this.audio)) { this._applyVolume(); this.signal.resume(); } }

  /** The table mix's current entry. */
  get tableEntry() { return this.queue.entries[this.queue.index] ?? null; }

  /** The item the player has selected now (table entry or local replay). */
  get now() { return this.mode === 'replay' ? this.replay?.item ?? null : this.tableEntry?.item ?? null; }

  /** Stop and release whatever audio is loaded, and fence any pending acquisition. */
  _detach() {
    if (this.mode === 'table' && this.active?.item === this.tableEntry?.item && this.audio.getAttribute('src')) this.tablePos = this.audio.currentTime || 0;
    this.playGen++;
    this._pending?.abort();
    this._pending = null;
    clearTimeout(this._skipTimer);
    this.audio.pause();
    if (this.audio.getAttribute('src')) { this.audio.removeAttribute('src'); this.audio.load(); }
    if (this.active?.owned) URL.revokeObjectURL(this.active.url);
    this.active = null;
  }

  /** A committed table switch: the old song stops at once, so it can never play under the new title. */
  _select(i, reason, at = 0) {
    if (!this.queue.entries[i] || this.disposed) return;
    const from = this.now;
    this._detach();
    this.mode = 'table';
    this.replay = null;
    this.queue.index = i;
    this.tablePos = at;
    this.status = 'loading';
    this.error = null;
    if (!this.settings.listening) this.status = 'paused';
    this._log(reason, from, this.now);
    this._changed('select');
    if (this.settings.listening) this._load(at);
  }

  /** Play one local item through the same player (replay context). */
  _selectReplay(item, list, view, reason) {
    if (this.disposed || !item) return;
    const from = this.now;
    // bookmark the table mix once, at the first switch away from it; never overwrite it here
    if (this.mode === 'table') {
      const e = this.tableEntry;
      const pos = this.active?.item === e?.item && this.audio.getAttribute('src') ? this.audio.currentTime : this.tablePos;
      this.bookmark = e ? { entry: e, index: this.queue.index, time: pos || 0, listening: this.settings.listening } : { entry: null, index: -1, time: 0, listening: this.settings.listening };
    }
    this._detach();
    this.mode = 'replay';
    this.replay = { list, view, item, ended: false };
    this.status = 'loading';
    this.error = null;
    this._log(reason, from, item);
    // Play is an explicit request to hear this item
    if (!this.settings.listening) { this.settings.listening = true; this._save(); }
    this._changed('select');
    this._load(0);
  }

  async _load(at = 0) {
    const gen = this.playGen, item = this.now;
    if (!item) return;
    const ctl = this._pending = new AbortController();
    const timer = setTimeout(() => ctl.abort(Object.assign(Error('the track took too long to arrive'), { code: 'deadline' })), ACQUIRE_MS);
    try {
      let url, owned = false, bytes = null;
      if (item.kind === 'offer') {
        // the listener's own library fetches exactly this offered asset (its own, or over the peer link)
        const r = await fetch(`/music/${this.listener.library}/audio`, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offer: item.entry.offer }) });
        if (!r.ok) { const j = await r.json().catch(() => ({})); throw Error(j.error || `audio ${r.status}`); }
        const blob = await r.blob();
        if (!this._current(gen, item)) return; // replaced, paused or disposed while in flight: drop the bytes
        url = URL.createObjectURL(blob); owned = true; bytes = blob.size;
      } else {
        // retained bytes, re-verified by the listener's owner on every read; the source peer may be gone
        if (!RETAINED_ID.test(item.libraryId)) throw Error('not a retained library address');
        url = `/music/${item.library}/retained/${item.libraryId}/audio`;
      }
      clearTimeout(timer);
      this.active = { gen, item, url, owned, bytes, started: false };
      this.audio.src = url;
      this._applyVolume();
      if (at > 0) {
        await new Promise((res) => { if (this.audio.readyState >= 1) return res(); const t = setTimeout(res, START_MS); this.audio.addEventListener('loadedmetadata', () => { clearTimeout(t); res(); }, { once: true }); });
        if (!this._current(gen, item)) return;
        const d = this.audio.duration;
        this.audio.currentTime = Math.max(0, Number.isFinite(d) ? Math.min(at, Math.max(0, d - 0.5)) : at);
      }
      if (!(await this._play(gen, item))) return; // superseded before the play side effect
      if (!this._current(gen, item)) return;
      this.lastPlayback = { key: item.key, kind: item.kind, assetId: item.assetId, bytes, startedAt: new Date().toISOString() };
      this.dispatchEvent(new CustomEvent('track', { detail: item }));
    } catch (e) {
      clearTimeout(timer);
      if (!this._current(gen, item)) return; // superseded, opted out or disposed: not failed
      if (e.code === 'blocked') this._block(item, e.message);
      else this._fail(item, ctl.signal.reason?.message ?? e.message);
    } finally { if (this._pending === ctl) this._pending = null; }
  }

  /** Is this attempt (generation and item) still the one the listener wants to hear? */
  _current(gen, item) { return gen === this.playGen && !this.disposed && this.settings.listening && this.now === item; }

  /**
   * Start the loaded audio for exactly this attempt under the finite start policy (START_MS).
   * The attempt (generation + item, listening intent, disposal) is validated before waiting for the
   * audio graph and again immediately before `audio.play()`: a Pause, new selection or disposal
   * during the wait abandons it quietly (resolves false) and the stale start can never sound
   * (R13-01). A browser activation refusal is classified as 'blocked', not as unusable media.
   */
  async _play(gen, item) {
    if (!this._current(gen, item)) return false;
    if (!(await this.signal.resume())) {
      if (!this._current(gen, item)) return false;
      throw blocked('Sound is waiting for your press: press Play to start');
    }
    if (!this._current(gen, item)) return false;
    let timer;
    try {
      const started = this.audio.play();
      await Promise.race([Promise.resolve(started).catch((e) => { throw e?.name === 'NotAllowedError' ? blocked('The browser is holding sound until you press Play') : e; }),
        new Promise((_, no) => { timer = setTimeout(() => no(Error('playback did not start')), START_MS); })]);
    } finally { clearTimeout(timer); }
    return true;
  }

  /** An activation block: keep this recording selected and wait for one gesture (never skipped). */
  _block(item, msg) {
    this.status = 'blocked';
    this.error = msg;
    this._log('blocked', item, item);
    this._changed('status');
  }

  /**
   * One finite failure policy. In the table mix the queue controller moves past an unusable entry
   * once; a listener who is not the controller just reports it. A replay item that cannot play is a
   * truthful terminal state with navigation still usable. There is no retry chain.
   */
  _fail(item, msg) {
    if (this.status === 'failed' && this.error === msg && this._failed === item) return;
    this._failed = item;
    this.status = 'failed';
    this.error = msg;
    console.warn(`[versus] music: ${msg}`);
    this._changed('status');
    if (this.mode !== 'table' || !this.isController || !item?.entry || item.entry.skipped || item !== this.now) return;
    item.entry.skipped = true;
    clearTimeout(this._skipTimer);
    this._skipTimer = setTimeout(() => { if (this.now === item && this.status === 'failed' && !this.disposed) this._advance('skip-unusable'); }, 1500);
  }

  /** Natural completion: the table mix continues; a local replay stops at its song's end. */
  _ended() {
    if (this.mode === 'replay') {
      this.replay.ended = true;
      this.status = 'replay-ended';
      this._log('replay-ended', this.now, null);
      this._changed('status');
      return;
    }
    this._advance('ended');
  }

  _advance(reason) {
    if (this.queue.index + 1 >= this.queue.entries.length) { this._detach(); this.status = 'finished'; this._log(reason, this.now, null); this._changed('status'); return; }
    this.queue.revision++;
    this.queue.lastChange = { reason, by: reason === 'next' ? this.listener.seat : reason, revision: this.queue.revision };
    this._select(this.queue.index + 1, reason);
  }

  _markPlayed(item) {
    const now = new Date().toISOString();
    // the chronology records actual starts only (browsing, saving or acquiring never reach here)
    if (this.history.at(-1)?.item !== item) { this.history.push({ item, at: now }); if (this.history.length > HISTORY_MAX) this.history.shift(); }
    const p = this.played.find((x) => x.item.key === item.key);
    if (p) { p.lastAt = now; p.plays++; } else this.played.push({ item, firstAt: now, lastAt: now, plays: 1 });
    this._changed('played');
  }

  // --- transport (local to this listener) ------------------------------------------------------

  /** What Previous / Next would do now, with a reason when unavailable. */
  nav() {
    const t = this.audio.currentTime || 0;
    if (this.mode === 'replay') {
      const { list, item } = this.replay;
      const i = list.indexOf(item);
      return {
        prev: t > RESTART_S && this.active?.item === item ? { ok: true, does: 'restart' } : i > 0 ? { ok: true, does: 'previous' } : { ok: false, why: 'No earlier song in this list' },
        next: i >= 0 && i + 1 < list.length ? { ok: true, does: 'next' } : { ok: false, why: 'No later song in this list' },
      };
    }
    const cur = this.tableEntry?.item;
    const earlier = this.history.some((x) => x.item !== cur);
    return {
      prev: cur && t > RESTART_S && this.active?.item === cur ? { ok: true, does: 'restart' } : earlier ? { ok: true, does: 'replay-earlier' } : { ok: false, why: 'Nothing earlier has played in this match' },
      next: !this.isController ? { ok: false, why: 'Only the table host advances the table mix' } : this.queue.index + 1 < this.queue.entries.length ? { ok: true, does: 'next' } : { ok: false, why: 'This is the last song in the table mix' },
    };
  }

  previous() {
    const n = this.nav().prev;
    if (!n.ok) return;
    if (n.does === 'restart') { this.audio.currentTime = 0; this._log('restart', this.now, this.now); return; }
    if (n.does === 'previous') { const { list, item, view } = this.replay; this._selectReplay(list[list.indexOf(item) - 1], list, view, 'replay-previous'); return; }
    // the most recently heard other recording (R13-03), opened as a local replay whose list is the
    // recent listening order (each recording at its latest occurrence, oldest first), so a further
    // Previous walks back through what was actually heard
    const cur = this.tableEntry?.item;
    const list = this.recentItems();
    const target = [...list].reverse().find((x) => x !== cur);
    this._selectReplay(target, list, 'recent', 'previous-earlier');
  }

  /** Recordings by their latest actual playback start, oldest first (distinct; from the chronology). */
  recentItems() {
    const seen = new Set(), out = [];
    for (let i = this.history.length - 1; i >= 0; i--) { const it = this.history[i].item; if (!seen.has(it)) { seen.add(it); out.unshift(it); } }
    return out;
  }

  /** Next: the table mix advances (queue controller only); a replay moves along its captured list. */
  next() {
    const n = this.nav().next;
    if (!n.ok) return;
    if (this.mode === 'replay') { const { list, item, view } = this.replay; this._selectReplay(list[list.indexOf(item) + 1], list, view, 'replay-next'); return; }
    this._advance('next');
  }

  /**
   * Play a row locally. `list` is the ordered playable rows of that view at this moment.
   * @param {any} item @param {any[]} list @param {'queue'|'played'|'kept'} view
   */
  playItem(item, list, view) {
    this._attachSignal();
    if (this.mode === 'replay' && this.replay.item === item && !this.replay.ended && this.status !== 'failed') { if (this.primaryAction() !== 'pause') this.play(); return; }
    this._selectReplay(item, list.includes(item) ? list : [item], view, 'replay-select');
  }

  /** Play again after a replay finished (same item, same list). */
  replayAgain() { if (this.mode === 'replay') this._selectReplay(this.replay.item, this.replay.list, this.replay.view, 'replay-again'); }

  /** Return to table mix: the bookmarked entry, position (clamped) and listening intent. */
  returnToTable() {
    if (this.mode !== 'replay') return { ok: true };
    const b = this.bookmark;
    const e = b?.entry;
    const from = this.now;
    if (!e || !this.queue.entries.includes(e) || e.skipped) {
      // never start an unrelated song silently: leave the choice to the listener
      this._detach();
      this.mode = 'table';
      this.replay = null;
      this.bookmark = null;
      this.status = 'paused';
      this.error = !this.queue.entries.length ? 'The table mix is unavailable; play a song from Kept or Played' : e ? 'The table song you left could not play; choose one from Queue' : 'The table mix had not started; choose a song from Queue';
      this._log('return-unavailable', from, null);
      this._changed('select');
      return { ok: false, why: this.error };
    }
    this.settings.listening = b.listening;
    this._save();
    this.bookmark = null;
    this._select(b.index, 'return', b.time);
    return { ok: true };
  }

  seek(t) {
    if (!this.active || !Number.isFinite(t)) return;
    const d = this.audio.duration;
    this.audio.currentTime = Math.max(0, Number.isFinite(d) ? Math.min(t, d - 0.05) : t);
  }

  // --- local listener controls (never change the queue) ----------------------------------------
  setVolume(v) { this.settings.volume = Math.max(0, Math.min(1, v)); this._applyVolume(); this._save(); this._changed('volume'); }
  toggleMute() { this.settings.muted = !this.settings.muted; this._applyVolume(); this._save(); this._changed('volume'); }
  setResponse(mode) { if (['off', 'subtle', 'expressive'].includes(mode)) { this.settings.response = mode; this._save(); this._changed('response'); } }
  setStill(on) { this.settings.still = !!on; this._save(); this._changed('response'); }

  /**
   * What the main transport button does now (R13-02). The label, accessible name and the action
   * come from this one answer, never from the persisted intent alone:
   *   'pause'        — a song is playing or its start is pending (listening);
   *   'replay-again' — a local replay reached its end (the deliberate replay-end stop);
   *   'play-again'   — the table mix finished: the last table song restarts from zero;
   *   'play'         — ready, paused, blocked by the browser, or a recoverable failure (retry);
   *   'none'         — nothing can play.
   */
  primaryAction() {
    if (this.mode === 'replay' && this.replay?.ended) return 'replay-again';
    if (this.status === 'finished') return this.tableEntry ? 'play-again' : 'none';
    const pending = this.status === 'loading', playing = this.status === 'playing' && !this.audio.paused;
    if (this.settings.listening && this.now && (pending || playing)) return 'pause';
    return this.now || this.queue.entries.length ? 'play' : 'none';
  }

  /** The main button: performs exactly the action `primaryAction()` names. */
  togglePlay() {
    this._attachSignal();
    const a = this.primaryAction();
    if (a === 'pause') this.pause();
    else if (a !== 'none') this.play();
  }

  /** Pause: keeps the position and fences any acquisition or start in flight (intent off here). */
  pause() {
    this.settings.listening = false;
    this._save();
    this._pending?.abort(); this._pending = null;
    clearTimeout(this._skipTimer);
    this.playGen++;
    this.audio.pause();
    this.status = 'paused';
    this._log('pause', this.now, this.now);
    this._changed('status');
  }

  /**
   * Play: one press starts or resumes the selected recording; retries a recoverable failure or a
   * browser activation block on the same recording; restarts a finished table song from zero.
   */
  play() {
    this._attachSignal();
    const a = this.primaryAction();
    if (a === 'replay-again') { this.replayAgain(); return; }
    this.settings.listening = true;
    this._save();
    if (a === 'play-again') { this._select(this.queue.index, 'play-again', 0); return; }
    const item = this.now;
    if (!item) { if (this.queue.entries.length) this._select(Math.max(0, this.queue.index), 'start'); return; }
    if (this.status === 'failed') {
      // a recoverable failure: the same recording again (the pending skip is cancelled)
      clearTimeout(this._skipTimer);
      if (item.entry) item.entry.skipped = false;
      this.error = null;
      if (this.mode === 'replay') this._selectReplay(item, this.replay.list, this.replay.view, 'retry');
      else this._select(this.queue.index, 'retry', this.tablePos);
      return;
    }
    this._resume();
    this._changed('status');
  }

  /** Back-compatible name for the device listening switch. */
  toggleListening() { this.togglePlay(); }

  /** Resume the selected item: its own loaded audio if that is what is loaded, otherwise fetch it. */
  _resume() {
    const item = this.now;
    if (!item) return;
    if (this.active && this.active.item === item && this.audio.getAttribute('src')) {
      // this attempt is bound to its item and generation (R11-02): a late result after Next, Pause
      // or disposal is ignored; only a still-current attempt can fail its own item
      const gen = this.active.gen = ++this.playGen;
      this.status = 'loading';
      this.error = null;
      this._play(gen, item).catch((e) => { if (!this._current(gen, item)) return; if (e.code === 'blocked') this._block(item, e.message); else this._fail(item, e.message); });
    } else if (this.mode === 'replay') { this.status = 'loading'; this._load(0); }
    else this._select(this.queue.index, 'resume', this.tablePos);
  }

  /** Lower the music while the opponent's voice is actually playing (an independently requested conversation). */
  setDucked(on) {
    const target = on ? 0.28 : 1;
    clearInterval(this._duckTimer);
    this._duckTimer = setInterval(() => {
      this.duck += (target - this.duck) * 0.35;
      if (Math.abs(target - this.duck) < 0.02) { this.duck = target; clearInterval(this._duckTimer); }
      this._applyVolume();
    }, 40);
  }

  /** One owner of effective gain: the graph's gain once attached, otherwise the element's volume. */
  _applyVolume() {
    const v = this.settings.muted ? 0 : this.settings.volume * this.duck;
    if (this.signal.gain) { this.audio.volume = 1; this.signal.setGain(v); } else this.audio.volume = v;
  }

  _save() { try { localStorage.setItem(KEY, JSON.stringify(this.settings)); } catch { /* storage unavailable */ } }

  /** The read-only music frame for the setting (companion §6.2); bound to the exact active item. */
  sample(dt, opts) {
    const a = this.active;
    const live = !!a && a.gen === this.playGen && a.item === this.now;
    const playing = live && this.status === 'playing' && !this.audio.paused && !this.audio.ended;
    return this.signal.sample(dt, { itemKey: live ? a.item.key : null, assetId: live ? a.item.assetId : null, recordingId: live ? a.item.recordingId : null, generation: live ? a.gen : -1,
      playing, listening: this.settings.listening, muted: this.settings.muted, time: this.audio.currentTime || 0, duration: this.audio.duration }, opts);
  }

  // --- Keep (HF6-03) -----------------------------------------------------------------------------

  /** The encounter a Keep press targets: the current offer item (captured at activation). */
  keepTarget(item = this.now) { return item?.kind === 'offer' && !item.entry.own ? item.entry : null; }

  /** Is this exact recording already retained in the listener's library? (by asset, not title) */
  isRetained(assetId) { return !!this.retained?.some((r) => r.assetId === assetId); }

  /**
   * Keep an encounter: saved reference first, then verified retention. Keyed by the encounter, so a
   * second introducer of the same bytes is recorded too (the owner does not download them twice); a
   * repeated press on the same encounter is idempotent and never deletes. Failures retry through
   * the owner's idempotent Keep. `heardAt` is only the time the audio really started here.
   * Nothing here touches the audio element, the selection, the gain or the view's navigation.
   */
  async keep(item = this.now) {
    const entry = this.keepTarget(item);
    if (!entry) return null;
    const key = entry.queueEntryId;
    const k = this.keeps.get(key);
    if (k && !RETRYABLE.has(k.state)) return k; // in flight or already kept
    this.keeps.set(key, { state: 'saving' });
    this._changed('keep');
    const heardAt = this.heard.get(key) ?? null;
    try {
      const st = await (await call(`/music/${this.listener.library}/keep`, {
        offer: entry.offer,
        // who introduced it (the participant at this table) is recorded apart from who made it
        // (the offer's own credits, which the owner imports unchanged)
        discovery: { app: 'hapa-versus', sessionId: this.sessionId, playlistId: entry.playlistId, queueRevision: this.queue.revision, entryId: key, heardAt,
          introducer: entry.contributor.participant?.avatarId ? { kind: 'avatar', id: entry.contributor.participant.avatarId, label: entry.contributor.participant.label } : { kind: 'participant', id: entry.contributor.nodeId, label: entry.contributor.participant?.label ?? entry.contributor.label } },
      })).json();
      if (this.disposed) return st;
      this.keeps.set(key, { ...st, heard: !!heardAt, durable: true });
      this._announce(`Kept “${entry.title}”${st.state === 'available-offline' ? ' · available offline' : ''}`);
      this._changed('keep');
      if (TERMINAL.has(st.state)) this.refreshKept().catch(() => {});
      else this._poll(key, st.acquisitionId);
      return st;
    } catch (e) {
      if (this.disposed) return null;
      this.keeps.set(key, { state: 'keep-failed', error: e.message });
      this._announce(`Keep failed: ${e.message}. Playback continues.`);
      this._changed('keep');
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
        if (this.disposed || this.keeps.get(key)?.acquisitionId !== acq) return;
        this.keeps.set(key, { ...st, heard: cur.heard, durable: true });
        if (st.state === 'available-offline') this._announce('Available offline');
        this._changed('keep');
        if (TERMINAL.has(st.state)) { this.refreshKept().catch(() => {}); return; }
      } catch { /* the owner is restarting; keep polling */ }
    }
  }

  /** A polite one-time announcement for save / error changes (the deck renders it in a live region). */
  _announce(text) { this.announcement = { text, at: Date.now() }; this.dispatchEvent(new CustomEvent('announce', { detail: text })); }

  /** Read the durable library: retained membership and saved discoveries (data only; no playback). */
  async refreshKept() {
    const epoch = this.epoch, lib = this.listener.library;
    const [ret, enc] = await Promise.allSettled([call(`/music/${lib}/retained`).then((r) => r.json()), call(`/music/${lib}/encounters`).then((r) => r.json())]);
    if (epoch !== this.epoch || this.disposed) return;
    if (ret.status === 'fulfilled') this.retained = (ret.value.entries ?? []).filter((r) => RETAINED_ID.test(r.libraryId));
    if (enc.status === 'fulfilled') this.encounters = enc.value.encounters ?? [];
    this.keptError = ret.status === 'rejected' ? ret.reason.message : null;
    this._changed('kept');
  }

  /**
   * The Kept rows: one per exact retained asset (its membership aggregates introductions), then
   * saved discoveries whose audio is not retained, grouped by exact asset. Similar titles stay apart.
   */
  keptRows() {
    const lib = this.listener.library;
    const rows = [];
    this._keptItems ??= new Map();
    const itemFor = (r) => { let it = this._keptItems.get(r.libraryId); if (!it) { it = retainedItem(r, lib); this._keptItems.set(r.libraryId, it); } return it; };
    const retainedAssets = new Set();
    for (const r of [...(this.retained ?? [])].sort((a, b) => String(b.retainedAt).localeCompare(String(a.retainedAt)))) {
      retainedAssets.add(r.assetId);
      rows.push({ key: r.libraryId, item: itemFor(r), availability: 'available-offline', introductions: r.introductions ?? [] });
    }
    const byAsset = new Map();
    for (const d of this.encounters ?? []) {
      if (retainedAssets.has(d.assetId)) continue;
      const g = byAsset.get(d.assetId) ?? { key: d.assetId, discoveries: [] };
      g.discoveries.push(d); byAsset.set(d.assetId, g);
    }
    for (const g of [...byAsset.values()].sort((a, b) => String(b.discoveries.at(-1).savedAt).localeCompare(String(a.discoveries.at(-1).savedAt)))) {
      const d = g.discoveries.at(-1);
      // a current-session offer of the exact same asset can still be played while its source is here
      const live = this.queue.entries.find((e) => e.assetId === d.assetId && !e.skipped);
      rows.push({ key: g.key, item: live?.item ?? null, availability: d.acquisition?.state ?? 'unavailable', title: d.title, credits: d.credits, assetId: d.assetId, recordingId: d.recordingId,
        introductions: g.discoveries.map((x) => ({ discoveryId: x.discoveryId, introducer: x.introducer, encounter: x.encounter })), liveOffer: !!live });
    }
    return rows;
  }

  /** Played this match, in the order playback first started. */
  playedRows() { return this.played.map((p) => ({ key: p.item.key, item: p.item, plays: p.plays, lastAt: p.lastAt })); }

  /** The table mix in contribution order. */
  queueRows() { return this.queue.entries.map((e, i) => ({ key: e.queueEntryId, item: e.item, index: i, skipped: !!e.skipped })); }

  /** Developer diagnostics: recent transport changes with cause, item and generation. */
  diagnostics() { return { mode: this.mode, status: this.status, action: this.primaryAction(), gen: this.playGen, now: this.now?.key ?? null, tableIndex: this.queue.index, history: this.history.map((x) => x.item.key), bookmark: this.bookmark ? { entry: this.bookmark.entry?.queueEntryId ?? null, time: this.bookmark.time, listening: this.bookmark.listening } : null, transport: [...this.transport] }; }

  dispose() {
    this.disposed = true;
    this.epoch = -1;
    clearInterval(this._duckTimer);
    this._detach();
    this.signal.dispose();
  }
}
