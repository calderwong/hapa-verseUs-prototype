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
const AVAIL_GLYPH = { available: '●', busy: '◐', joining: '◌', 'in-match': '⚔', reconnecting: '↻', offline: '○' };

export class OnlineClient {
  constructor(host) {
    this.host = host;
    this.listeners = new Set();
    this.match = null; // { matchId, seat, count queues }
    this.off = host.onEvent((e) => this._event(e));
  }

  call(op, args = {}) { return this.host.call(op, args); }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  /** Track one match: queues per Tick for locked pairs, choices and agreed receipts. */
  bind(snapshot) {
    const m = this.match = { matchId: snapshot.matchId, seat: snapshot.seat, locked: new Map(), choices: new Map(), agreed: new Map(), waiters: new Set(), remote: null, status: snapshot.status, connection: snapshot.connection };
    const cur = snapshot.current;
    if (cur?.locked) m.locked.set(cur.count, cur.locked);
    for (const [i, c] of (cur?.choices ?? []).entries()) m.choices.set(`${cur.count}:${i}`, c);
    return m;
  }

  _event(e) {
    const m = this.match;
    if (e.type === 'match' && m && e.matchId === m.matchId) {
      if (e.kind === 'locked') m.locked.set(e.count, { plans: e.plans, hashes: e.hashes });
      else if (e.kind === 'choice') m.choices.set(`${e.count}:${e.index}`, { seat: e.seat, choiceId: e.choiceId, answer: e.answer });
      else if (e.kind === 'tickAgreed') m.agreed.set(e.count, { hash: e.hash, outcome: e.outcome });
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
        if (this.match !== m) { m.waiters.delete(check); reject(new Error('match replaced')); return; }
        if (m.status === 'disputed') { m.waiters.delete(check); reject(new Error(`disputed: ${m.disputed}`)); return; }
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
}

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
  const name = h('input', { type: 'text', maxlength: '32', 'aria-label': 'Your display name', placeholder: 'Your name' });
  const act = async (fn) => { if (busy) return; busy = true; draw(); try { view = await fn(); note = ''; } catch (e) { note = e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''); } busy = false; draw(); };
  const refresh = async () => { try { view = await client.call('lobby.list'); } catch (e) { note = e.message; } draw(); };
  const draw = () => {
    if (!box.isConnected && view) return;
    const v = view;
    const rows = [];
    rows.push(h('h2', {}, 'Play online'));
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
      if (v.match && v.match.status === 'active') rows.push(h('div', { class: 'row' }, h('span', {}, `Your match against ${v.match.opponent} is in progress.`), h('button', { class: 'primary', onclick: () => app.resumeOnline() }, 'Return to the table')));
      const r = v.reservation;
      if (r?.phase === 'offered') rows.push(h('div', { class: 'row challenge-out' }, h('span', {}, `Challenge sent to ${r.opponent} · waiting for an answer`), h('button', { disabled: busy, onclick: () => act(() => client.call('challenge.cancel', { challengeId: r.challengeId })) }, 'Cancel')));
      else if (r && r.phase !== 'active') rows.push(h('p', { class: 'small', role: 'status' }, `Starting a match with ${r.opponent}…`));
      for (const x of v.incoming) rows.push(h('div', { class: 'row challenge-in', role: 'alert' },
        h('span', {}, h('b', {}, x.label), ` (${x.fingerprint}, ${x.controller === 'bot' ? 'declared bot' : 'human'}) challenges you · bundled ${v.compat.profileId}`),
        h('button', { class: 'primary', disabled: busy, onclick: () => act(() => client.call('challenge.respond', { challengeId: x.challengeId, accept: true })) }, 'Accept'),
        h('button', { disabled: busy, onclick: () => act(() => client.call('challenge.respond', { challengeId: x.challengeId, accept: false })) }, 'Decline')));
      const players = v.roster;
      rows.push(players.length
        ? h('ul', { class: 'roster-online' }, ...players.map((p) => h('li', {},
          h('span', { class: `avail ${p.availability}`, title: AVAIL_TEXT[p.availability] }, AVAIL_GLYPH[p.availability] ?? '○'),
          h('span', { class: 'who' }, h('b', {}, p.label), h('span', { class: 'dim small' }, ` ${p.fingerprint} · ${p.controller === 'bot' ? 'declared bot' : 'human'} · ${AVAIL_TEXT[p.availability] ?? p.availability}${p.compatible ? '' : ' · different rules build'}`)),
          h('button', { disabled: busy || !p.compatible || p.availability !== 'available' || !!r || v.me.availability !== 'available', title: !p.compatible ? 'This player uses a different rules build' : p.availability !== 'available' ? `${p.label} is ${AVAIL_TEXT[p.availability]}` : `Challenge ${p.label} with the bundled preset`, onclick: () => act(() => client.call('challenge', { playerId: p.playerId })) }, 'Challenge'))))
        : h('p', { class: 'dim small' }, t.state === 'online' ? 'No other players found yet. The list updates as players join.' : 'Looking for players…'));
    }
    if (note) rows.push(h('p', { class: 'warn small', role: 'alert' }, note));
    box.replaceChildren(...rows);
  };
  const unsub = client.on((e) => {
    if (!box.isConnected) { unsub(); clearInterval(timer); return; }
    if (e.type === 'lobby') { if (e.kind === 'challengeDeclined') note = `${e.by} ${e.reason === 'busy' ? 'is busy' : e.reason === 'incompatible' ? 'uses a different rules build' : 'declined'}.`; if (e.kind === 'startFailed') note = `The match could not start: ${e.reason}`; refresh(); }
    if (e.type === 'match' && e.kind === 'opened') { unsub(); clearInterval(timer); app.resumeOnline(); }
  });
  const timer = setInterval(() => { if (!box.isConnected) { clearInterval(timer); unsub(); return; } refresh(); }, 3000);
  refresh();
  return box;
}
