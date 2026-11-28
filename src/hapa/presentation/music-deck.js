/**
 * The compact listening deck and the Music drawer (Assignment 13 §3A, companion §2.1–§2.3).
 *
 * The deck is built once and patched: every control keeps its slot, focus and hit target while
 * titles, Saving…, Paused or errors change (stable geometry is a functional requirement). State
 * changes use aria-disabled rather than `disabled`, so a focused control never loses focus. The
 * drawer's Queue / Played this match / Kept views are browsing only: opening, filtering or
 * switching tabs never changes playback. Play on a row is the one explicit request to hear it.
 * Save and error changes are announced once through a polite live region; time is never announced.
 */
import { h } from './dom.js';
import { STATE_LABEL, creditLine } from './soundtrack.js';

const fmt = (s) => { if (!Number.isFinite(s) || s < 0) return '–:––'; const m = Math.floor(s / 60), x = Math.floor(s % 60); return `${m}:${String(x).padStart(2, '0')}`; };
const lower = (s) => String(s ?? '').toLowerCase();
const VIEW_LABEL = { queue: 'Queue', played: 'Played this match', kept: 'Kept', recent: 'Recently heard' };
const PLAY_LABEL = { pause: 'Pause music', play: 'Play music', 'play-again': 'Play again from the start', 'replay-again': 'Play again', none: 'Nothing to play yet' };

/** Introduction text from owner introduction records (who brought it, where), never its creator. */
function introLine(intros) {
  if (!intros?.length) return 'Introduction not recorded';
  const who = [...new Set(intros.map((i) => i.introducer?.label).filter(Boolean))];
  const n = intros.length;
  return `Introduced by ${who.join(', ') || 'an unnamed participant'}${n > 1 ? ` · ${n} introductions` : ''}`;
}

export class MusicDeck {
  /** @param {import('./soundtrack.js').Soundtrack} music @param {HTMLElement} host @param {{ onLayout?: () => void }} [o] */
  constructor(music, host, o = {}) {
    this.m = music;
    this.o = o;
    this.open = false;
    this.tab = 'queue';
    this.filter = '';
    this._sig = null;
    const btn = (cls, label, onclick, text = '') => h('button', { class: `np-btn ${cls}`, type: 'button', 'aria-label': label, title: label, onclick: (e) => { if (e.currentTarget.getAttribute('aria-disabled') === 'true') return; onclick(e); } }, text);
    // identity row
    this.mark = h('span', { class: 'np-mark', 'aria-hidden': 'true' }, '♪');
    this.titleEl = h('b', { class: 'np-title' });
    this.subEl = h('span', { class: 'np-sub' });
    this.ctxBadge = h('span', { class: 'np-ctx-badge' }, 'Replay');
    this.returnBtn = btn('np-return', 'Return to table mix', () => this.m.returnToTable(), '↩ Table mix');
    this.ctxSlot = h('span', { class: 'np-ctx' }, this.ctxBadge, this.returnBtn);
    // transport row: fixed slots
    this.prevBtn = btn('np-prev', 'Previous', () => this.m.previous(), '⏮');
    this.playBtn = btn('np-play', 'Play music', () => this.m.togglePlay(), '▶');
    this.nextBtn = btn('np-next', 'Next', () => this.m.next(), '⏭');
    this.seek = h('input', { class: 'np-seek', type: 'range', min: 0, max: 1, step: 0.1, value: 0, 'aria-label': 'Song position' });
    this.seek.addEventListener('pointerdown', () => { this._seeking = true; });
    this.seek.addEventListener('change', () => { this._seeking = false; this.m.seek(Number(this.seek.value)); });
    this.seek.addEventListener('blur', () => { this._seeking = false; });
    this.timeEl = h('span', { class: 'np-time', 'aria-hidden': 'true' }, '–:–– / –:––');
    this.keepIcon = h('span', { class: 'np-bm', 'aria-hidden': 'true' });
    this.keepLabel = h('span', { class: 'np-keep-label' }, 'Keep');
    this.keepBtn = h('button', { class: 'np-btn np-keep', type: 'button', 'aria-label': 'Keep this song', onclick: (e) => { if (e.currentTarget.getAttribute('aria-disabled') === 'true') return; this.m.keep(this.m.keepTarget()?.item); } }, this.keepIcon, this.keepLabel);
    this.muteBtn = btn('np-mute', 'Mute music', () => this.m.toggleMute(), '♫');
    this.vol = h('input', { class: 'np-vol', type: 'range', min: 0, max: 1, step: 0.05, value: music.settings.volume, 'aria-label': 'Music volume (this device)', oninput: (ev) => this.m.setVolume(Number(ev.target.value)) });
    this.musicBtn = btn('np-open', 'Open music', () => this.toggle(), 'Music ▾');
    this.musicBtn.setAttribute('aria-expanded', 'false');
    // reserved status line + a polite live region for saves and errors only
    this.stateEl = h('span', { class: 'np-state' });
    this.live = h('span', { class: 'sr-only', 'aria-live': 'polite' });
    this.deck = h('div', { class: 'np-deck', role: 'region', 'aria-label': 'Music' },
      h('div', { class: 'np-id' }, this.mark, h('span', { class: 'np-text' }, this.titleEl, this.subEl), this.ctxSlot, this.timeEl),
      this.seek,
      h('div', { class: 'np-tr' }, this.prevBtn, this.playBtn, this.nextBtn, this.keepBtn, h('span', { class: 'np-gap' }), this.muteBtn, this.vol, this.musicBtn),
      h('div', { class: 'np-status' }, this.stateEl, this.live));
    // drawer
    this.tabs = Object.fromEntries([['queue', 'Queue'], ['played', 'Played this match'], ['kept', 'Kept']].map(([k, label]) => [k, h('button', { class: 'np-tab', type: 'button', role: 'tab', 'aria-selected': 'false', onclick: () => this.setTab(k) }, label)]));
    this.filterEl = h('input', { class: 'np-filter', type: 'search', placeholder: 'Filter by title or creator', 'aria-label': 'Filter songs by title or creator', oninput: (ev) => { this.filter = ev.target.value; this._renderList(true); } });
    this.listEl = h('div', { class: 'np-list', role: 'list' });
    this.emptyEl = h('p', { class: 'np-empty dim' });
    const radio = (v, label) => h('label', { class: 'np-opt' }, h('input', { type: 'radio', name: `np-resp-${music.sessionId}`, value: v, onchange: () => this.m.setResponse(v) }), label);
    this.respRadios = [radio('off', 'Off'), radio('subtle', 'Subtle'), radio('expressive', 'Expressive')];
    this.stillBox = h('input', { type: 'checkbox', onchange: (ev) => this.m.setStill(ev.target.checked) });
    // what the scene is following now (HF12-04): a compact line, live meters only in Signal
    this.sceneState = h('span', { class: 'np-scene-state dim small' });
    const meter = (name, tip) => { const bar = h('span', { class: 'np-meter-bar' }); return { bar, el: h('span', { class: 'np-meter', title: tip }, h('span', { class: 'np-meter-name' }, name), h('span', { class: 'np-meter-track', 'aria-hidden': 'true' }, bar)) }; };
    this.meters = { onset: meter('Onset', 'A measured low-band rise (not a detected beat): pulses on the rail, rings on the terrace'), low: meter('Low', 'Low band 40–180 Hz: the rail line\'s level'), swell: meter('Swell', 'Slow broad energy: the lanterns and their pools'), high: meter('High', 'High band 2.5–9 kHz: fine twinkles and water shimmer') };
    this.signalEl = h('details', { class: 'np-signal' }, h('summary', { class: 'small' }, 'Signal'),
      h('div', { class: 'np-meters' }, ...Object.values(this.meters).map((x) => x.el)),
      h('p', { class: 'dim small' }, 'Measured live from this song\'s music player, before your volume and mute (your voice and game sounds are not included). Onsets are low-band rises, not detected beats; no tempo is measured.'));
    this.settingsEl = h('div', { class: 'np-settings', title: 'Mute lowers the sound only; the scene can still respond to a playing song. Off or Still calms the scene without stopping the music.' },
      h('span', { class: 'np-set-label' }, 'Scene response'), h('span', { class: 'np-seg', role: 'radiogroup', 'aria-label': 'Scene response to music' }, ...this.respRadios),
      h('label', { class: 'np-opt' }, this.stillBox, 'Still atmosphere'),
      h('p', { class: 'np-help dim small' }, 'Expressive: pulses run round the rail and rings cross the terrace with the song; Subtle is gentler. Off or Still calms the scene; the music keeps playing.'),
      this.sceneState, this.signalEl);
    this.drawer = h('div', { class: 'np-drawer', hidden: true },
      h('div', { class: 'np-tabs', role: 'tablist', 'aria-label': 'Music collections' }, ...Object.values(this.tabs)),
      this.filterEl, this.listEl, this.emptyEl, this.settingsEl);
    host.append(this.deck, this.drawer);
    for (const ev of ['change', 'announce']) music.addEventListener(ev, (e) => this._onChange(e));
    music.addEventListener('time', () => this._patchTime());
    this.patch();
  }

  toggle(force) {
    const open = force ?? !this.open;
    if (open === this.open) return;
    // a collapsed drawer keeps its tab, filter and list scroll for when it reopens (R13-04)
    if (!open) this._listScroll = this.listEl.scrollTop;
    this.open = open;
    this.drawer.hidden = !this.open;
    this.musicBtn.setAttribute('aria-expanded', String(this.open));
    this.musicBtn.textContent = this.open ? 'Music ▴' : 'Music ▾';
    this.deck.parentElement?.classList.toggle('drawer-open', this.open);
    if (this.open && this.tab === 'kept') this.m.refreshKept().catch(() => {});
    this._renderList(true);
    if (this.open && this._listScroll != null) {
      // restore once the reopened drawer has its final height (the deck may have moved slots)
      const want = this._listScroll;
      this.listEl.scrollTop = want;
      requestAnimationFrame(() => requestAnimationFrame(() => { if (this.open && this.listEl.scrollTop !== want) this.listEl.scrollTop = want; }));
    }
    if (this.open) this.o.onOpen?.();
    this.o.onLayout?.();
  }

  setTab(k) {
    this.tab = k;
    if (k === 'kept') this.m.refreshKept().catch(() => {});
    this._renderList(true);
  }

  _onChange(e) {
    if (e.type === 'announce') { this.live.textContent = ''; requestAnimationFrame(() => { this.live.textContent = e.detail; }); return; }
    this.patch();
  }

  /** Patch the deck in place (no subtree replacement). */
  patch() {
    const m = this.m, it = m.now, s = m.settings;
    const set = (el, t) => { if (el.textContent !== t) el.textContent = t; };
    const attr = (el, k, v) => { if (el.getAttribute(k) !== v) el.setAttribute(k, v); };
    // identity
    const preparing = m.status === 'preparing', unavailable = m.status === 'unavailable';
    set(this.titleEl, it ? it.title : preparing ? 'Gathering songs…' : unavailable ? 'Music unavailable' : m.status === 'finished' ? 'Table mix finished' : 'Music ready');
    attr(this.titleEl, 'title', it ? it.title : '');
    const sub = !it ? (unavailable ? 'The match plays without it' : m.queue.entries.length ? `${m.queue.entries.length} songs in the table mix` : '')
      : `${creditLine(it.credits)} · ${it.kind === 'retained' ? 'from your library' : it.own ? 'your track' : `from ${it.introducer}`}`;
    set(this.subEl, sub);
    attr(this.subEl, 'title', sub);
    const replay = m.mode === 'replay';
    this.ctxSlot.classList.toggle('on', replay);
    set(this.ctxBadge, 'Replay');
    attr(this.ctxBadge, 'title', replay ? `A local replay from ${VIEW_LABEL[m.replay.view] ?? 'Played this match'}; the table mix is bookmarked` : '');
    attr(this.returnBtn, 'aria-disabled', String(!replay));
    attr(this.returnBtn, 'tabindex', replay ? '0' : '-1');
    // transport
    const nav = m.nav();
    for (const [b, n, label] of [[this.prevBtn, nav.prev, 'Previous'], [this.nextBtn, nav.next, 'Next']]) {
      attr(b, 'aria-disabled', String(!n.ok));
      const t = n.ok ? (n.does === 'restart' ? `${label} (restart this song)` : n.does === 'replay-earlier' ? `${label}: replay the song played before` : label) : `${label} — ${n.why}`;
      attr(b, 'title', t); attr(b, 'aria-label', t);
    }
    // the main button shows, names and performs one action (R13-02): Soundtrack.primaryAction()
    const act = m.primaryAction();
    set(this.playBtn, act === 'pause' ? '⏸' : act === 'play-again' || act === 'replay-again' ? '↻' : '▶');
    const pl = PLAY_LABEL[act];
    attr(this.playBtn, 'aria-label', pl); attr(this.playBtn, 'title', pl);
    attr(this.playBtn, 'aria-disabled', String(act === 'none'));
    // Keep: one slot, fixed labels
    const target = m.keepTarget();
    const k = target ? m.keeps.get(target.queueEntryId) : null;
    let label = 'Keep', icon = 'out', dis = false, tip = 'Keep this song: save it to your library without changing playback';
    if (!it) { dis = true; tip = 'Nothing is playing'; }
    else if (it.kind === 'retained') { label = 'Kept ✓'; icon = 'full'; dis = true; tip = 'In your library (available offline)'; }
    else if (it.own) { label = 'Yours'; icon = 'full'; dis = true; tip = 'This recording is from your own library'; }
    else if (k?.state === 'saving') { label = 'Saving…'; icon = 'half'; dis = true; tip = 'Saving to your library; playback continues'; }
    else if (k && (k.state === 'keep-failed' || k.state === 'download-failed-reference-saved')) { label = 'Retry'; icon = k.state === 'keep-failed' ? 'out' : 'full'; tip = k.state === 'keep-failed' ? `Keep failed (${k.error ?? 'owner unavailable'}): try again` : 'The reference is saved but its audio did not download: try again'; }
    else if (k) { label = 'Kept ✓'; icon = 'full'; dis = true; tip = `Kept: ${STATE_LABEL[k.state] ?? k.state}${k.heard === false ? ' · saved before it was heard here' : ''}`; }
    else if (m.isRetained(it.assetId)) { icon = 'half'; tip = 'This exact recording is already in your library; Keep records this introduction (no second download)'; }
    set(this.keepLabel, label);
    this.keepIcon.className = `np-bm ${icon}`;
    attr(this.keepBtn, 'aria-disabled', String(dis));
    attr(this.keepBtn, 'title', tip); attr(this.keepBtn, 'aria-label', label === 'Keep' ? 'Keep this song' : `${label}: ${tip}`);
    attr(this.muteBtn, 'aria-pressed', String(s.muted));
    set(this.muteBtn, s.muted ? '🔇' : '♫');
    const ml = s.muted ? 'Unmute music' : 'Mute music';
    attr(this.muteBtn, 'aria-label', ml); attr(this.muteBtn, 'title', `${ml} (the song keeps playing)`);
    if (document.activeElement !== this.vol && Number(this.vol.value) !== s.volume) this.vol.value = String(s.volume);
    // status line (reserved height)
    set(this.stateEl, this._statusText(it, k));
    this.stateEl.className = `np-state ${m.status === 'failed' || m.status === 'blocked' || k?.state === 'keep-failed' ? 'warn' : ''}`;
    // response settings
    for (const r of this.respRadios) { const inp = r.querySelector('input'); inp.checked = inp.value === s.response; }
    this.stillBox.checked = m.still;
    this._patchTime();
    if (this.open) this._renderList(false);
  }

  /**
   * The scene's state and live meters (per frame from the app; written at most ~8 times a second and
   * only while the drawer is open). Nothing here is announced.
   * @param {any} f the music frame (or null)
   */
  signal(f, dt = 0) {
    if (!this.open) return;
    this._sigT = (this._sigT ?? 0) + dt;
    if (this._sigT < 0.12 && this._sigShown) return;
    this._sigT = 0; this._sigShown = true;
    const m = this.m, s = m.settings;
    const st = f?.state ?? 'idle';
    const text = m.still ? 'Still atmosphere: the scene is holding still; the music continues'
      : s.response === 'off' ? 'Response off: the scene keeps its quiet ambient life'
      : st === 'following' ? `Following this song · ${s.response === 'expressive' ? 'Expressive' : 'Subtle'}`
      : st === 'silence' ? 'Following this song · quiet passage'
      : st === 'paused' ? 'Paused: the scene is settling'
      : st === 'blocked' ? 'Waiting for Play: the browser holds the sound'
      : st === 'unavailable' ? 'Song analysis unavailable here: ambient motion only'
      : 'No song playing: ambient motion only';
    if (this.sceneState.textContent !== text) this.sceneState.textContent = text;
    if (!this.signalEl.open) return;
    const live = st === 'following' || st === 'silence';
    const v = { onset: live ? f.onset01 : 0, low: live ? f.low01 : 0, swell: live ? f.energy01 : 0, high: live ? f.high01 : 0 };
    for (const [k, x] of Object.entries(this.meters)) x.bar.style.width = `${Math.round(100 * Math.max(0, Math.min(1, v[k])))}%`;
  }

  _statusText(it, k) {
    const m = this.m;
    if (m.status === 'failed') return m.mode === 'replay' ? `Unavailable: ${m.error} · Play tries again` : `Could not play: ${m.error} · Play tries again`;
    if (m.status === 'blocked') return m.error ?? 'Press Play to start the sound';
    if (m.status === 'finished') return 'Table mix finished · Play again restarts the last song';
    if (m.error && m.status === 'paused') return m.error;
    if (m.status === 'loading') return 'Loading…';
    if (m.mode === 'replay' && m.replay.ended) return 'Replay finished · Play again or return to the table mix';
    if (m.status === 'paused' || (it && !m.settings.listening)) return 'Paused';
    if (k) {
      if (k.state === 'saving') return 'Saving…';
      if (k.state === 'keep-failed') return `Keep failed: ${k.error ?? 'owner unavailable'} · playback continues`;
      if (k.state === 'saved-downloading' && k.totalBlocks) return `Kept · saving audio ${Math.round((100 * (k.receivedBlocks ?? 0)) / k.totalBlocks)}%`;
      return `Kept · ${STATE_LABEL[k.state] ?? k.state}`;
    }
    if (it && it.kind === 'offer' && !it.own && m.isRetained(it.assetId)) return 'In your library · Keep saves this introduction';
    return '';
  }

  _patchTime() {
    const a = this.m.audio, live = !!this.m.active && this.m.active.item === this.m.now;
    const d = live && Number.isFinite(a.duration) ? a.duration : (this.m.now?.durationSeconds ?? NaN), t = live ? a.currentTime : 0;
    const txt = `${fmt(t)} / ${fmt(d)}`;
    if (this.timeEl.textContent !== txt) this.timeEl.textContent = txt;
    if (!this._seeking && document.activeElement !== this.seek) {
      const max = Number.isFinite(d) && d > 0 ? d : 1;
      if (this.seek.max !== String(max)) this.seek.max = String(max);
      this.seek.value = String(Math.min(t, max));
    }
    this.seek.setAttribute('aria-valuetext', `${fmt(t)} of ${fmt(d)}`);
    this.seek.setAttribute('aria-disabled', String(!live));
  }

  // --- drawer list -------------------------------------------------------------------------------

  _rows() {
    const m = this.m;
    return this.tab === 'queue' ? m.queueRows() : this.tab === 'played' ? m.playedRows() : m.keptRows();
  }

  _visible(rows) {
    const q = lower(this.filter).trim();
    if (!q) return rows;
    return rows.filter((r) => { const it = r.item; const t = it?.title ?? r.title, c = creditLine(it?.credits ?? r.credits); return lower(`${t} ${c} ${(r.introductions ?? it?.introductions ?? []).map((i) => i.introducer?.label).join(' ')}`).includes(q); });
  }

  /** Rebuild rows only when their data changes; preserve scroll and the focused row action. */
  _renderList(force) {
    for (const [k, b] of Object.entries(this.tabs)) { b.setAttribute('aria-selected', String(k === this.tab)); b.classList.toggle('on', k === this.tab); }
    if (!this.open) return;
    const m = this.m;
    const rows = this._visible(this._rows());
    const now = m.now, tableItem = m.tableEntry?.item;
    const sig = JSON.stringify([this.tab, this.filter, now?.key, tableItem?.key, m.mode, m.status === 'failed' ? m.error : '', rows.map((r) => [r.key, r.availability, r.plays, r.skipped, r.item ? 1 : 0, (r.introductions ?? []).length]), m.retained?.length, m.keptError,
      this.tab !== 'kept' ? [...m.keeps.entries()].map(([q, v]) => `${q}:${v.state}`) : 0]);
    if (!force && sig === this._sig) return;
    this._sig = sig;
    const active = document.activeElement, focusKey = this.listEl.contains(active) ? active.closest('[data-key]')?.dataset.key : null, focusAct = active?.dataset?.act;
    const scroll = this.listEl.scrollTop || (force ? this._listScroll ?? 0 : 0);
    const openProv = new Set([...this.listEl.querySelectorAll('details[open]')].map((d) => d.closest('[data-key]')?.dataset.key));
    const playable = rows.filter((r) => r.item && !r.skipped).map((r) => r.item);
    this.listEl.replaceChildren(...rows.map((r) => this._row(r, playable, now, tableItem)));
    for (const k of openProv) { const d = k && this.listEl.querySelector(`[data-key="${CSS.escape(k)}"] details`); if (d) d.open = true; }
    this.listEl.scrollTop = scroll;
    if (focusKey) this.listEl.querySelector(`[data-key="${CSS.escape(focusKey)}"] [data-act="${focusAct ?? 'play'}"]`)?.focus({ preventScroll: true });
    const empty = !rows.length;
    this.emptyEl.hidden = !empty;
    if (empty) this.emptyEl.textContent = this.filter ? 'No songs match this filter.'
      : this.tab === 'played' ? 'No music has played in this match yet.'
        : this.tab === 'kept' ? (m.keptError ? `Your library could not be read: ${m.keptError}` : m.retained == null ? 'Reading your library…' : 'Nothing kept yet. Keep adds a song to your library and leaves playback alone.')
          : m.status === 'preparing' ? 'Gathering the table mix…' : 'The table mix is empty.';
  }

  _row(r, playable, now, tableItem) {
    const m = this.m, it = r.item;
    const title = it?.title ?? r.title ?? r.recordingId;
    const credits = it?.credits ?? r.credits;
    const intros = r.introductions ?? (it?.kind === 'retained' ? it.introductions : null);
    const isNow = !!(it && now && now.key === it.key), isTable = this.tab === 'queue' && it && tableItem === it;
    const marks = [isNow ? h('span', { class: 'np-chip now' }, m.mode === 'replay' ? 'Replaying' : 'Now playing') : null, isTable && m.mode === 'replay' ? h('span', { class: 'np-chip' }, 'Table position') : null];
    let avail = null;
    if (this.tab === 'kept') avail = r.availability === 'available-offline' ? h('span', { class: 'np-chip ok' }, 'Available offline')
      : h('span', { class: `np-chip ${r.availability === 'download-failed-reference-saved' ? 'warn' : ''}` }, `${STATE_LABEL[r.availability] ?? (r.availability === 'unavailable' ? 'Not available offline' : r.availability)}${r.liveOffer ? ' · playable from this table' : ''}`);
    else if (this.tab === 'queue') { const k = m.keeps.get(r.key); avail = r.skipped ? h('span', { class: 'np-chip warn' }, 'Could not play') : k ? h('span', { class: `np-chip ${k.state === 'keep-failed' ? 'warn' : ''}` }, k.state === 'saving' ? 'Saving…' : k.state === 'keep-failed' ? 'Keep failed' : 'Kept') : m.isRetained(it?.assetId) ? h('span', { class: 'np-chip' }, 'In your library') : null; }
    else if (r.plays > 1) avail = h('span', { class: 'np-chip' }, `${r.plays} plays`);
    // a failed save stays retryable after the song has changed, bound to that same encounter; never playback
    const kf = it?.kind === 'offer' ? m.keeps.get(it.key) : null;
    const retry = this.tab !== 'kept' && kf && (kf.state === 'keep-failed' || kf.state === 'download-failed-reference-saved')
      ? h('button', { class: 'np-btn np-rowplay', type: 'button', 'data-act': 'retry', 'aria-label': `Retry keeping ${title}`, title: 'Try the save again (playback is not changed)', onclick: () => m.keep(it) }, 'Retry keep') : null;
    const canPlay = !!it && !r.skipped;
    const act = canPlay ? h('button', { class: 'np-btn np-rowplay', type: 'button', 'data-act': 'play', 'aria-label': `${this.tab === 'played' ? 'Play again' : 'Play'}: ${title}`, title: 'Play here (the table mix is bookmarked)', onclick: () => m.playItem(it, playable, this.tab) }, this.tab === 'played' ? '↻ Play again' : '▶ Play')
      : h('span', { class: 'np-noplay dim', title: this.tab === 'kept' ? 'No verified local audio yet, and no current offer of this exact recording' : '' }, this.tab === 'kept' ? 'Not playable now' : '—');
    const id = it?.kind === 'retained' ? it : r;
    const prov = h('details', { class: 'np-prov' }, h('summary', { 'data-act': 'prov' }, 'Details'),
      h('dl', {},
        ...[['Recording', it?.recordingId ?? r.recordingId], ['Asset', it?.assetId ?? r.assetId], ['Library address', id.libraryId], ['Retention receipt', id.receiptId], ['Version', it?.version], ['Source', it?.source],
          ['Generator', credits?.generator ? `${credits.generator.name}${credits.generator.model ? ` (${credits.generator.model})` : ''}` : null], ['Style', credits?.style]]
          .filter(([, v]) => v).flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, String(v))]),
        ...(intros?.length ? [h('dt', {}, 'Introductions'), h('dd', {}, h('ul', {}, intros.map((i) => h('li', {}, `${i.introducer?.label ?? 'unnamed'}${i.encounter?.app ? ` in ${i.encounter.app}` : ''}${i.encounter?.heard === false ? ' (saved unheard)' : ''}`))))] : [])));
    return h('div', { class: `np-row${isNow ? ' now' : ''}`, role: 'listitem', 'data-key': r.key },
      h('div', { class: 'np-row-main' }, h('b', { title }, title), h('span', { class: 'np-dur' }, fmt(it?.durationSeconds ?? r.durationSeconds ?? NaN)), it?.version ? h('span', { class: 'np-chip' }, it.version) : null),
      h('div', { class: 'np-row-sub dim' }, `${creditLine(credits)} · ${intros ? introLine(intros) : it?.own ? 'your track' : it ? `introduced by ${it.introducer}` : ''}`),
      h('div', { class: 'np-row-foot' }, act, retry, ...marks, avail, prov));
  }

  dispose() { this.deck.remove(); this.drawer.remove(); }
}
