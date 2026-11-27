/**
 * The online seat in the game page (p2p-matchmaking-v1 §8, §13; electron-desktop-v1 §3).
 *
 * The local peer runtime is the authority. This module only sends own-seat intents through the host
 * bridge (`window.hapaDesktop`, the sandboxed preload) and turns runtime events into what the
 * existing table already knows how to show: the opponent's public plan, Ready, the locked pair, the
 * recorded choices and the agreed receipt. The page replays the locked pair for presentation and
 * checks its result against the agreed hash; it never advances a Tick on its own.
 */
import { h } from './dom.js';
import { createContext } from '../rules/context.js';
import { initializeMatch, stateFingerprint } from '../rules/state.js';
import { openTick, closeTick } from '../rules/session.js';
import { replayChooser } from '../rules/match.js';

/** The desktop host bridge, when the page runs inside the packaged app. */
export const desktopHost = () => (typeof window !== 'undefined' && window.hapaDesktop?.kind === 'electron' ? window.hapaDesktop : null);

const AVAIL_TEXT = { available: 'Available', busy: 'Busy', joining: 'Joining a match', 'in-match': 'In a match', reconnecting: 'Reconnecting', offline: 'Offline' };
/** A verified record in words: W–L–D, the bucket it belongs to, and the win rate with its denominator. */
export function recordText(r) {
  if (!r || !r.bucket) return 'no verified matches yet';
  const rate = r.decisive ? `${Math.round((r.winRate ?? 0) * 100)}% of ${r.decisive} decisive` : 'win rate —';
  return `${r.wins}–${r.losses}–${r.draws} ${r.bucket.replace(/-/g, ' ')} · ${rate}${r.disputed ? ` · ${r.disputed} disputed` : ''}`;
}
const AVAIL_GLYPH = { available: '●', busy: '◐', joining: '◌', 'in-match': '⚔', reconnecting: '↻', offline: '○' };

export class OnlineClient {
  constructor(host) {
    this.host = host;
    this.listeners = new Set();
    this.match = null; // the bound match's projection
    this.projections = new Map(); // matchId → projection, recorded from the first event (closes the snapshot/subscription race)
    this.off = host.onEvent((e) => this._event(e));
  }

  call(op, args = {}) { return this.host.call(op, args); }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  _projection(matchId) {
    let m = this.projections.get(matchId);
    if (!m) {
      // retained per Tick (review 17, R17-04): locked pairs, choices, agreed receipts and the
      // opponent's latest public plan/Ready, so a view that is behind still shows them when it catches up
      m = { matchId, seat: null, locked: new Map(), choices: new Map(), agreed: new Map(), remote: new Map(), own: new Map(), waiters: new Set(), status: 'active', connection: 'waiting', seq: 0 };
      this.projections.set(matchId, m);
      if (this.projections.size > 4) this.projections.delete(this.projections.keys().next().value);
    }
    return m;
  }

  /** Bind the view to one match, merging the snapshot with anything already received. */
  bind(snapshot) {
    const m = this._projection(snapshot.matchId);
    m.seat = snapshot.seat;
    // ordering (review 18, R18-04): a snapshot replaces the status only if it is not older than the
    // last status event received — same authority generation with an equal or later sequence. A
    // snapshot from another generation may update an active match, but never erases an observed
    // dispute or completion (both are terminal at the authority and kept in its durable record).
    const at = m.statusAt;
    const newer = !at || (snapshot.boot && snapshot.boot === at.boot ? (snapshot.seq ?? 0) >= at.seq : !TERMINAL.has(m.status));
    if (newer) { Object.assign(m, { status: snapshot.status, connection: snapshot.connection, disputed: snapshot.disputed ?? null }); if (snapshot.boot) m.statusAt = { boot: snapshot.boot, seq: snapshot.seq ?? 0 }; }
    const cur = snapshot.current;
    if (cur?.locked && !m.locked.has(cur.count)) m.locked.set(cur.count, cur.locked);
    for (const [i, c] of (cur?.choices ?? []).entries()) if (!m.choices.has(`${cur.count}:${i}`)) m.choices.set(`${cur.count}:${i}`, c);
    if (cur?.remote) this._remote(m, cur.count, cur.remote.revision, cur.remote.commands, cur.remote.ready);
    this.match = m;
    return m;
  }

  _remote(m, count, revision, commands, ready) {
    const prev = m.remote.get(count);
    if (!prev || revision > prev.revision || (revision === prev.revision && ready && !prev.ready)) m.remote.set(count, { revision, commands, ready: !!ready || !!prev?.ready });
    for (const k of m.remote.keys()) if (k < count - 3) m.remote.delete(k); // bounded
  }

  _event(e) {
    if (e.type === 'match' && e.matchId) {
      const m = this._projection(e.matchId);
      if (['connection', 'disputed', 'complete'].includes(e.kind) && e.boot) {
        // an event older than the status already held (same generation, lower sequence) does not move it
        if (m.statusAt && m.statusAt.boot === e.boot && e.seq < m.statusAt.seq) { for (const fn of this.listeners) { try { fn(e); } catch (err) { console.error(err); } } return; }
        m.statusAt = { boot: e.boot, seq: e.seq };
      }
      if (e.kind === 'locked') m.locked.set(e.count, { plans: e.plans, hashes: e.hashes });
      else if (e.kind === 'choice') m.choices.set(`${e.count}:${e.index}`, { seat: e.seat, choiceId: e.choiceId, answer: e.answer });
      else if (e.kind === 'tickAgreed') m.agreed.set(e.count, { hash: e.hash, outcome: e.outcome });
      else if (e.kind === 'remotePlan') this._remote(m, e.count, e.revision, e.commands, false);
      else if (e.kind === 'remoteReady') this._remote(m, e.count, e.revision, e.commands, true);
      // this seat's own Ready outcome as the authority settled it (R18-02), kept per Tick
      else if (e.kind === 'ownCommitted') m.own.set(e.count, { state: 'committed', commitment: { commands: e.commands, revision: e.revision, hash: e.hash } });
      else if (e.kind === 'ownRefused') { if (m.own.get(e.count)?.state !== 'committed') m.own.set(e.count, { state: 'refused', reason: e.reason, code: e.code, intent: e.intent }); }
      else if (e.kind === 'connection') m.connection = e.state;
      else if (e.kind === 'disputed') { m.status = 'disputed'; m.disputed = e.reason; }
      else if (e.kind === 'complete') m.status = 'complete';
      for (const w of [...m.waiters]) w();
    }
    for (const fn of this.listeners) { try { fn(e); } catch (err) { console.error(err); } }
  }

  _wait(pred) {
    const m = this.match;
    return new Promise((resolve, reject) => {
      const check = () => {
        if (this.match !== m) { m.waiters.delete(check); reject(Object.assign(new Error('match replaced'), { code: 'REPLACED' })); return; }
        if (m.status === 'disputed') { m.waiters.delete(check); reject(Object.assign(new Error(`disputed: ${m.disputed}`), { code: 'DISPUTED' })); return; }
        const v = pred(m);
        if (v) { m.waiters.delete(check); resolve(v); }
      };
      m.waiters.add(check);
      check();
    });
  }

  waitLocked(count) { return this._wait((m) => m.locked.get(count)); }
  waitChoice(count, index) { return this._wait((m) => m.choices.get(`${count}:${index}`)); }
  waitAgreed(count) { return this._wait((m) => m.agreed.get(count)); }

  draft(count, commands) { return this.call('match.draft', { matchId: this.match.matchId, count, commands }); }
  ready(count, commands) { return this.call('match.ready', { matchId: this.match.matchId, count, commands, requestId: `${this.match.matchId}:${count}:ready` }); }
  choice(count, choiceId, answer) { return this.call('match.choice', { matchId: this.match.matchId, count, choiceId, answer }); }

  /** What the authority has recorded for one of this seat's choices (after a failed or lost reply). */
  async recordedChoice(count, index, choiceId) {
    const known = this.match?.choices.get(`${count}:${index}`);
    if (known?.choiceId === choiceId) return known;
    const snap = await this.call('match.get').catch(() => null);
    if (!snap || snap.matchId !== this.match?.matchId) return null;
    const c = snap.current?.count === count ? snap.current.choices?.[index] : null;
    return c?.choiceId === choiceId ? c : null;
  }

  /**
   * The authority's outcome for this seat's Ready on a Tick (review 18, R18-02), after a failed, lost
   * or late reply: `committed` (with the exact commitment), `committing` (an append is still in
   * flight: keep the intent frozen), `refused` (the authority recorded that it did not commit) or
   * `none` (nothing committed and nothing in flight). An event already received wins over a query.
   * @returns {Promise<{ state: 'committed'|'committing'|'refused'|'none'|'unknown', commitment?: any, reason?: string }>}
   */
  async readyOutcome(count) {
    const known = this.match?.own.get(count);
    if (known?.state === 'committed') return known;
    let snap;
    try { snap = await this.call('match.get'); } catch (e) { return { state: 'unknown', reason: e.message }; }
    if (!snap || snap.matchId !== this.match?.matchId) return { state: 'unknown', reason: 'the match is not open' };
    const again = this.match?.own.get(count);
    if (again?.state === 'committed') return again;
    const cur = snap.current;
    if (cur?.count === count) {
      if (cur.own.ready) return { state: 'committed', commitment: { commands: cur.own.commands, revision: cur.ownReady?.revision ?? cur.own.revision, hash: cur.ownReady?.hash ?? null } };
      if (cur.readyState === 'committing') return { state: 'committing' };
      if (cur.readyState === 'refused') return { state: 'refused', reason: cur.readyRefused?.reason ?? 'the Ready was refused' };
      return { state: 'none' };
    }
    const done = snap.history?.find((t) => t.tick === count);
    if (done) return { state: 'committed', commitment: { commands: done.plans[snap.seat], revision: null, hash: null, resolved: true } };
    return { state: 'unknown', reason: 'that Tick is not open' };
  }

  /** Resolve when any event touches the bound match, or after `ms` (an event-or-poll wait). */
  nudge(ms) {
    const m = this.match;
    return new Promise((resolve) => {
      if (!m) { resolve(); return; }
      const t = setTimeout(done, ms);
      function done() { clearTimeout(t); m.waiters.delete(done); resolve(); }
      m.waiters.add(done);
    });
  }

  /** The authority's durable Ready for a Tick, if any (after a failed or lost Ready reply). */
  async committedReady(count) {
    const snap = await this.call('match.get').catch(() => null);
    if (!snap || snap.matchId !== this.match?.matchId) return null;
    if (snap.current?.count === count && snap.current.own.ready) return { commands: snap.current.own.commands, revision: snap.current.ownReady?.revision ?? snap.current.own.revision, hash: snap.current.ownReady?.hash ?? null };
    const done = snap.history?.find((t) => t.tick === count);
    return done ? { commands: done.plans[snap.seat], revision: null, hash: null, resolved: true } : null;
  }
}

const TERMINAL = new Set(['disputed', 'complete']);

/** A session object for the existing table, built from the agreed manifest (no new authority). */
export function sessionFromManifest(manifest) {
  const ctx = createContext(manifest);
  const state = initializeMatch(manifest);
  return { manifest, ctx, state, events: [], replay: { schemaVersion: 1, kind: 'hapa-versus-replay', manifest, initialFingerprint: stateFingerprint(state), ticks: [] } };
}

/** Fast-forward a reattached view through the agreed history (presentation replay, verified per Tick). */
export function replayHistory(session, history) {
  for (const t of history) {
    openTick(session);
    closeTick(session, t.plans, replayChooser(t.choices));
    if (stateFingerprint(session.state) !== t.fingerprint) throw new Error(`reattach replay differs at Tick ${t.tick}`);
  }
}

/**
 * The Play online section of the setup sheet: join, availability, players, challenges.
 * @param {any} app the VersusApp
 */
export function onlinePanel(app) {
  const host = desktopHost();
  const box = h('section', { class: 'online-panel', 'aria-label': 'Play online' });
  if (!host) {
    box.append(h('h2', {}, 'Play online'), h('p', { class: 'dim small' }, 'Online play runs in the Hapa Versus desktop app, which hosts your player identity and peer connection. This browser page plays locally.'));
    return box;
  }
  const client = app.online ??= new OnlineClient(host);
  let view = null, busy = false, note = '';
  let sub = null; // { kind: 'profile', data } | { kind: 'records', data } — inline record views
  const openProfile = async (playerId, label) => {
    sub = { kind: 'profile', label, data: null }; draw();
    try { sub = { kind: 'profile', label, data: await client.call('profile.get', { playerId }) }; } catch (e) { sub = { kind: 'profile', label, error: hostMessage(e) }; }
    draw();
  };
  const openRecords = async () => {
    sub = { kind: 'records', data: null }; draw();
    try { sub = { kind: 'records', data: await client.call('directory.list') }; } catch (e) { sub = { kind: 'records', error: hostMessage(e) }; }
    draw();
  };
  const name = h('input', { type: 'text', maxlength: '32', 'aria-label': 'Your display name', placeholder: 'Your name' });
  const paste = h('input', { type: 'text', 'aria-label': 'Paste an invitation code', placeholder: 'Paste an invitation (hvinv1.…)' });
  const act = async (fn) => { if (busy) return; busy = true; draw(); try { view = await fn(); note = ''; } catch (e) { note = e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''); } busy = false; draw(); };
  // the peer service's own state (R18-05): a bounded failure is shown with an explicit Retry
  let peerState = null;
  const refresh = async () => {
    try { view = await client.call('lobby.list'); peerState = null; } catch (e) { note = hostMessage(e); peerState = await host.host('peerStatus').catch(() => null); }
    draw();
  };
  const draw = () => {
    if (!box.isConnected && view) return;
    const v = view;
    const rows = [];
    rows.push(h('h2', {}, 'Play online'));
    if (peerState && peerState.state !== 'ready') {
      rows.push(h('div', { class: 'warn', role: 'status' }, peerState.state === 'failed' ? `The game's peer service is not running: ${peerState.error ?? 'it stopped'}. Local play still works.` : `The game's peer service is ${peerState.state === 'restarting' ? 'restarting' : 'starting'}…`,
        peerState.state === 'failed' ? h('button', { disabled: busy, onclick: async () => { peerState = await host.host('restartPeer').catch(() => peerState); note = ''; draw(); setTimeout(refresh, 1500); } }, 'Start it again') : null));
      box.replaceChildren(...rows, note ? h('p', { class: 'dim small' }, note) : '');
      return;
    }
    if (sub) { box.replaceChildren(...rows, recordView(sub, { back: () => { sub = null; draw(); }, open: openProfile })); return; }
    if (!v?.joined) {
      if (v && !name.value) name.value = v.me.label;
      rows.push(h('p', { class: 'small' }, 'Join the public lobby to find players. Your name, availability and finished match evidence (moves, choices and result — never chat, voice or music) are shared with the lobby so anyone can verify records.'),
        h('div', { class: 'row' }, name, h('button', { class: 'primary', disabled: busy, onclick: () => act(() => client.call('lobby.join', { name: name.value })) }, 'Join lobby')));
    } else {
      const t = v.transport;
      const conn = t.state === 'online' ? `Connected · ${t.peers} player${t.peers === 1 ? '' : 's'} in view` : t.state === 'connecting' ? 'Connecting to the lobby…' : t.state === 'failed' ? `Lobby unreachable: ${t.error ?? 'network error'} — local play still works` : 'Offline';
      rows.push(h('div', { class: 'online-me row' },
        h('span', {}, h('b', {}, v.me.label), h('span', { class: 'dim small' }, ` · ${v.me.fingerprint}`)),
        h('span', { class: `avail ${v.me.availability}`, role: 'status' }, `${AVAIL_GLYPH[v.me.availability] ?? ''} ${AVAIL_TEXT[v.me.availability] ?? v.me.availability}`),
        v.me.manual === 'available' ? h('button', { disabled: busy, onclick: () => act(() => client.call('setAvailability', { availability: 'busy' })) }, 'Set Busy') : h('button', { disabled: busy, onclick: () => act(() => client.call('setAvailability', { availability: 'available' })) }, 'Set Available'),
        h('button', { class: 'linkish', disabled: busy, onclick: () => act(() => client.call('lobby.leave')) }, 'Leave lobby')),
        h('p', { class: 'dim small', role: 'status' }, conn));
      if (v.match && (v.match.status === 'active' || v.match.status === 'disputed')) rows.push(h('div', { class: 'row' },
        h('span', {}, v.match.status === 'disputed' ? `Your match against ${v.match.opponent} is paused: its records disagree.` : `Your match against ${v.match.opponent} is in progress.`),
        h('button', { class: 'primary', onclick: () => app.resumeOnline() }, v.match.status === 'disputed' ? 'View the match' : 'Return to the table'),
        v.match.status === 'disputed' || v.match.unstarted ? h('button', { disabled: busy, title: v.match.unstarted ? 'The other player has not started this match (no Tick has been agreed). Leaving keeps its record; it is not a concession and records no loss.' : undefined, onclick: () => { if (window.confirm(v.match.unstarted ? 'Leave this match? No Tick has been agreed; it stays recorded as unstarted. This is not a concession.' : 'Leave this match? It stays recorded as unfinished/disputed; this is not a concession.')) act(() => client.call('match.leave', { matchId: v.match.matchId }).then(() => client.call('lobby.list'))); } }, 'Leave this match') : null));
      for (const f of v.finishing ?? []) rows.push(h('p', { class: 'small', role: 'status' }, `Finishing your match against ${f.opponent}: waiting for their final record. It is retrieved when they or an archive are reachable; nothing is replayed and no result is assumed.`));
      const r = v.reservation;
      if (!r && v.me.availability === 'available') rows.push(h('div', { class: 'row' },
        h('button', { disabled: busy, title: 'Anyone compatible in the lobby (or holding your invitation) can take the other seat; hosting is your consent', onclick: () => act(() => client.call('table.open')) }, 'Open a table'),
        paste, h('button', { disabled: busy, onclick: () => act(() => client.call('invite.join', { code: paste.value.trim() })) }, 'Join by invitation')));
      if (r?.phase === 'open') rows.push(h('div', { class: 'row challenge-out' }, h('span', {}, 'Your table is open · the first compatible player to join takes the other seat'),
        h('button', { onclick: () => navigator.clipboard?.writeText(r.invite).then(() => { note = 'Invitation copied. It names your table and expires in 5 minutes; it does not get through firewalls by itself.'; draw(); }) }, 'Copy invitation'),
        h('button', { disabled: busy, onclick: () => act(() => client.call('table.close')) }, 'Close table')));
      if (r?.phase === 'offered') rows.push(h('div', { class: 'row challenge-out' }, h('span', {}, `Challenge sent to ${r.opponent} · waiting for an answer`), h('button', { disabled: busy, onclick: () => act(() => client.call('challenge.cancel', { challengeId: r.challengeId })) }, 'Cancel')));
      else if (r && r.phase !== 'active' && r.phase !== 'open') rows.push(r.stalled
        ? h('div', { class: 'row challenge-out', role: 'alert' },
          h('span', {}, `The match with ${r.opponent} has not started: ${r.otherLeft ? 'they left this attempt' : 'no progress from the other player'}.`),
          h('button', { disabled: busy, onclick: () => act(() => client.call('setup.retry', { challengeId: r.challengeId })) }, 'Retry'),
          h('button', { disabled: busy, onclick: () => act(() => client.call('setup.leave', { challengeId: r.challengeId })) }, 'Leave this attempt'))
        : h('p', { class: 'small', role: 'status' }, `Starting a match with ${r.opponent}…`));
      for (const x of v.incoming) rows.push(h('div', { class: 'row challenge-in', role: 'alert' },
        h('span', {}, h('b', {}, x.label), ` (${x.fingerprint}, ${x.controller === 'bot' ? 'declared bot' : 'human'}) challenges you · bundled ${v.compat.profileId}`),
        h('button', { class: 'primary', disabled: busy, onclick: () => act(() => client.call('challenge.respond', { challengeId: x.challengeId, accept: true })) }, 'Accept'),
        h('button', { disabled: busy, onclick: () => act(() => client.call('challenge.respond', { challengeId: x.challengeId, accept: false })) }, 'Decline')));
      const services = v.services ?? [];
      const up = services.filter((x) => x.connected), configured = services.filter((x) => x.configured);
      rows.push(h('p', { class: 'dim small' }, up.length ? `Result archive: ${up.map((a) => a.label).join(', ')} connected — finished matches are shared and verifiable while their players are offline.` : configured.length ? `Result archive ${configured.map((a) => a.label).join(', ')} is configured but not reachable now; results are saved here and shared later.` : 'No result archive connected: finished matches are saved on this computer and shared when an archive is reachable.'),
        h('div', { class: 'row' }, h('span', { class: 'small' }, h('b', {}, 'Your verified record (known here): '), recordText(v.record)),
          h('button', { class: 'linkish', onclick: () => openProfile(v.me.participantId, v.me.label) }, 'My profile'),
          h('button', { class: 'linkish', onclick: () => openRecords() }, 'Player records')));
      const players = v.roster.filter((p) => p.role !== 'archive');
      rows.push(players.length
        ? h('ul', { class: 'roster-online' }, ...players.map((p) => h('li', {},
          h('span', { class: `avail ${p.availability}`, title: AVAIL_TEXT[p.availability] }, AVAIL_GLYPH[p.availability] ?? '○'),
          h('span', { class: 'who' },
            h('span', { class: 'who-line' }, h('b', {}, p.label), ` · ${AVAIL_TEXT[p.availability] ?? p.availability}`),
            h('span', { class: 'who-line dim small' }, `${p.controller === 'bot' ? 'declared bot' : 'human'} · ${p.compatible ? recordText(p.record) : 'different rules build'}`)),
          h('button', { class: 'linkish', title: `Verified record and recent matches for ${p.label}`, onclick: () => openProfile(p.playerId, p.label) }, 'Profile'),
          p.table
            ? h('button', { disabled: busy || !p.compatible || !!r || v.me.availability !== 'available', title: `Take the open seat at ${p.label}'s table`, onclick: () => act(() => client.call('table.join', { playerId: p.playerId, challengeId: p.table })) }, 'Join table')
            : h('button', { disabled: busy || !p.compatible || p.availability !== 'available' || !!r || v.me.availability !== 'available', title: !p.compatible ? 'This player uses a different rules build' : p.availability !== 'available' ? `${p.label} is ${AVAIL_TEXT[p.availability]}` : `Challenge ${p.label} with the bundled preset`, onclick: () => act(() => client.call('challenge', { playerId: p.playerId })) }, 'Challenge'))))
        : h('p', { class: 'dim small' }, t.state === 'online' ? 'No other players found yet. The list updates as players join.' : 'Looking for players…'));
    }
    if (note) rows.push(h('p', { class: 'warn small', role: 'alert' }, note));
    box.replaceChildren(...rows);
  };
  const unsub = client.on((e) => {
    if (!box.isConnected) { unsub(); clearInterval(timer); return; }
    if (e.type === 'lobby') { if (e.kind === 'challengeDeclined') note = `${e.by} ${e.reason === 'busy' ? 'is busy' : e.reason === 'incompatible' ? 'uses a different rules build' : 'declined'}.`; if (e.kind === 'startFailed') note = `The match could not start: ${e.reason}`; if (e.kind === 'setupStalled') note = ''; refresh(); }
    if (e.type === 'match' && e.kind === 'opened') { unsub(); clearInterval(timer); app.resumeOnline(); }
  });
  const timer = setInterval(() => { if (!box.isConnected) { clearInterval(timer); unsub(); return; } refresh(); }, 3000);
  refresh();
  return box;
}

const hostMessage = (e) => String(e?.message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
const SYNC_TEXT = {
  'archive-unavailable': 'No archive reachable now — showing only results verified on this computer.',
  deferred: 'Not synced while your match is in progress — showing results verified on this computer.',
};

/** Inline profile / player-records views (R16-03): verified totals by bucket, recent games, honest sync state. */
function recordView(sub, { back, open }) {
  const box = h('div', { class: 'record-view' }, h('button', { class: 'linkish', onclick: back }, '← Back to the lobby'));
  const wrap = { append: (...kids) => box.append(...kids.filter((k) => k != null && k !== false)) }; // DOM append would print "null"
  const done = () => box;
  if (sub.error) { wrap.append(h('p', { class: 'warn small' }, sub.error)); return done(); }
  if (!sub.data) { wrap.append(h('p', { class: 'small', role: 'status' }, sub.kind === 'profile' ? `Checking ${sub.label ?? 'this player'}’s verified record…` : 'Looking up player records…')); return done(); }
  if (sub.kind === 'records') {
    const d = sub.data;
    wrap.append(h('h3', {}, 'Player records'),
      h('p', { class: 'dim small' }, d.deferred ? 'Archive lookup paused while your match is in progress.' : d.archives ? 'Players with verified matches known here or at the connected archive. They may be offline.' : 'No archive reachable now: players with verified matches on this computer.'),
      d.items.length ? h('ul', { class: 'roster-online' }, ...d.items.map((x) => h('li', {},
        h('span', { class: `avail ${x.availability}` }, x.connected ? '●' : '○'),
        h('span', { class: 'who' }, h('span', { class: 'who-line' }, h('b', {}, x.label), ` · ${x.connected ? AVAIL_TEXT[x.availability] ?? x.availability : 'not connected'}`), h('span', { class: 'who-line dim small' }, `${x.results} verified match${x.results === 1 ? '' : 'es'} · ${x.source}`)),
        h('button', { class: 'linkish', onclick: () => open(x.playerId, x.label) }, 'Profile')))) : h('p', { class: 'small' }, 'No verified matches are known yet.'));
    return done();
  }
  const d = sub.data;
  const names = (list) => list.map((s) => (typeof s === 'string' ? s : s.label)).join(', ');
  const failed = (d.sync.sources ?? []).filter((s) => typeof s === 'object' && s.state !== 'complete');
  const sync = d.sync.state === 'synced' ? `Synced from ${names(d.sync.sources)} just now${d.sync.refused ? ` · ${d.sync.refused} copy refused` : ''}.`
    : d.sync.state === 'partial' ? `Partly synced: ${names((d.sync.sources ?? []).filter((s) => s.state === 'complete'))} answered; ${failed.map((s) => `${s.label} ${s.state === 'failed' ? 'did not answer' : 'answered in part'}`).join(', ')}. These totals may be incomplete; open this again to retry.`
      : d.sync.state === 'archive-unavailable' && d.sync.error ? `No archive answered (${d.sync.error}) — showing only results verified on this computer. Open this again to retry.` : SYNC_TEXT[d.sync.state] ?? '';
  const buckets = Object.entries(d.stats.buckets);
  wrap.append(h('h3', {}, d.label ?? sub.label ?? 'Player'),
    h('p', { class: 'dim small' }, `Fingerprint ${d.fingerprint} · `, h('code', { title: d.playerId }, d.playerId.slice(0, 20) + '…')),
    h('p', { class: 'small', role: 'status' }, sync),
    buckets.length ? h('table', { class: 'result-stats' }, h('tr', {}, h('th', {}, 'Bucket'), h('th', {}, 'W–L–D'), h('th', {}, 'Win rate')),
      ...buckets.map(([k, b]) => h('tr', {}, h('td', {}, k.replace(/-/g, ' ')), h('td', {}, `${b.wins}–${b.losses}–${b.draws}`), h('td', {}, b.decisive ? `${Math.round(b.winRate * 100)}% of ${b.decisive}` : '—'))))
      : h('p', { class: 'small' }, d.checkedZero ? 'Checked: no verified matches at the connected archive or here.' : 'No verified matches known here yet.'),
    d.stats.disputed ? h('p', { class: 'small warn' }, `${d.stats.disputed} disputed match${d.stats.disputed > 1 ? 'es' : ''} excluded from totals.`) : null,
    d.recent.items.length ? h('div', {}, h('h4', {}, 'Recent verified matches'), h('ul', { class: 'recent-list' }, ...d.recent.items.map((it) => {
      const seat = it.players.A.participantId === d.playerId ? 'A' : 'B', opp = it.players[seat === 'A' ? 'B' : 'A'];
      const res = it.disputed ? 'disputed' : it.outcome.result === 'draw' ? 'draw' : it.outcome.winner === seat ? 'win' : 'loss';
      return h('li', {}, `${res} vs ${opp.label} · ${it.ticks} Ticks · ${it.bucket.replace(/-/g, ' ')}`);
    }))) : null);
  return done();
}

