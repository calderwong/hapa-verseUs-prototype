/**
 * Packaged-app smoke and journey automation (evidence only). Loaded by desktop/main.mjs only when
 * HAPA_VERSUS_SMOKE_OUT names an absolute directory, and writes only there.
 *
 *  - `local`  : a rendered local human/bot match, native store/transport/bridge checks.
 *  - `online` : the real lobby and table UI driven by DOM clicks — automatic discovery, Challenge (or Accept),
 *               a planned order and Ready each Tick, response choices — against another peer, with
 *               each Tick's view replay compared to the runtime's agreed receipt. Optional renderer
 *               reload mid-match (HAPA_VERSUS_SMOKE_RELOAD_AT=<tick>).
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function runSmoke(o) {
  mkdirSync(o.out, { recursive: true });
  o.win.webContents.on('console-message', (e) => { if (o.consoleLines.length < 120 && (e.level === 'warning' || e.level === 'error')) o.consoleLines.push(`${e.level}: ${String(e.message).slice(0, 300)}`); });
  const result = o.script === 'online' ? await online(o) : o.script === 'observe' ? await observe(o) : o.script === 'lifecycle' ? await lifecycle(o) : o.script === 'red' ? await red(o) : o.script === 'avatar' ? await avatar(o) : await local(o);
  writeFileSync(join(o.out, 'smoke.json'), JSON.stringify({ ...result, console: o.consoleLines }, null, 1));
  o.app.quit();
}

const js = (o, code) => o.win.webContents.executeJavaScript(code);
async function shot(o, name) { const img = await o.win.webContents.capturePage(); writeFileSync(join(o.out, `${name}.png`), img.toPNG()); return name; }
async function until(o, code, ms = 60_000, every = 400) {
  const t0 = Date.now();
  for (;;) {
    const v = await js(o, code).catch(() => null);
    if (v) return v;
    if (Date.now() - t0 > ms) return null;
    await sleep(every);
  }
}
async function loaded(o) { if (o.win.webContents.isLoading()) await new Promise((r) => o.win.webContents.once('did-finish-load', r)); }

/**
 * `lifecycle` (R18-05 / N20-06): observe the peer worker's generations under a staged late or
 * never-ready start (HAPA_VERSUS_PEER_STARTUP_MS / _DELAY_MS / _DELAY_GENS set by the caller): the
 * retired generation is replaced or the bounded failure is reported, the page shows it, and once
 * ready a runtime call succeeds on the current generation.
 */
async function lifecycle(o) {
  const t0 = Date.now(), states = [];
  let last = null;
  while (Date.now() - t0 < 120_000) {
    const cur = `${o.peer.state}#${o.peer.gen}`;
    if (cur !== last) { states.push({ t: Date.now() - t0, state: o.peer.state, gen: o.peer.gen, error: o.peer.error ?? null }); last = cur; }
    if (o.peer.state === 'ready' || (o.peer.state === 'failed' && !o.peer.proc)) break;
    await sleep(100);
  }
  await loaded(o);
  const page = await until(o, `(async () => { const s = await window.hapaDesktop.host('peerStatus'); return s ? JSON.stringify(s) : null; })()`, 10_000);
  let call = null;
  if (o.peer.state === 'ready') call = await o.callPeer('getStatus', {}, 10_000).then((s) => ({ ok: true, runtime: s.runtime, fingerprint: s.player?.fingerprint })).catch((e) => ({ ok: false, error: e.message }));
  return { ok: o.peer.state === 'ready' ? !!call?.ok : o.peer.state === 'failed', script: 'lifecycle', states, final: o.peer.state, pageSees: page ? JSON.parse(page) : null, call, about: o.about() };
}

/**
 * `red` (R18-01 / N20-07): the installed default Avatar. Starts the default local match (Red seated for
 * the bot seat) and waits for the owner renderer — Harbor's player inside the loopback renderer frame —
 * to bind and draw; records the package identity, the frame, one performer, and a Home capture.
 * Needs userData/owners.json naming a running Harbor; without it, records the truthful fallback.
 */
async function red(o) {
  const t0 = Date.now();
  await loaded(o);
  await js(o, `window.__versus?.startMatch ? true : false`);
  const bound = await until(o, `(() => { const op = window.__versus?.table?.opponent; return op && (op.player || (op.attempts >= 1 && op.binding.status === 'text-only' && op.bindingError)) ? JSON.stringify({ player: !!op.player, status: op.binding.status, renderer: op.binding.renderer, error: op.bindingError ?? null, frames: document.querySelectorAll('iframe.red-frame').length, performers: document.querySelectorAll('.opp-social').length, drawn: !!window.__versus.table.seated?._hasFrame }) : null; })()`, 90_000, 500);
  await sleep(3000);
  const after = await js(o, `JSON.stringify({ drawn: !!window.__versus?.table?.seated?._hasFrame, visibility: window.__versus?.table?.seated?.visibility ?? null })`);
  await shot(o, 'red-home');
  const r = bound ? JSON.parse(bound) : null;
  return { ok: !!r?.player && JSON.parse(after).drawn, script: 'red', seconds: (Date.now() - t0) / 1000, binding: r, after: JSON.parse(after), origin: await js(o, 'location.origin'), about: o.about() };
}

/**
 * `avatar` (Review 20 V20-C / N22-04): the installed default Avatar through an owner outage and
 * recovery in ONE match, driven with tools/hapa/desktop-avatar-journey.mjs (which starts Harbor when
 * signalled). Records the owner-absent state, the recovery (same match, one performer, the frame, a
 * drawn figure), Home, orbit 45°/90° and a close framing, then presses Ready once to show legal play
 * continues. Needs a visible window: hidden windows are throttled by Chromium and the owner frame
 * does not load in reasonable time.
 */
async function avatar(o) {
  const t0 = Date.now(), log = [];
  const note = (x) => log.push({ t: Date.now() - t0, ...x });
  const signal = process.env.HAPA_VERSUS_SMOKE_SIGNAL;
  await loaded(o);
  const st = () => js(o, `JSON.stringify((() => { const v = window.__versus, op = v?.table?.opponent; return { gen: v?.generation, tick: v?.state?.tick, player: !!op?.player, status: op?.binding?.status ?? null, error: op?.bindingError ?? null, attempts: op?.attempts ?? 0, retryVisible: !!document.querySelector('.opp-retry:not([hidden])'), performers: document.querySelectorAll('.opp-social').length, frames: document.querySelectorAll('iframe.red-frame').length, drawn: !!v?.table?.seated?._hasFrame, visibility: v?.table?.seated?.visibility ?? null, renderer: op?.binding?.renderer ?? null }; })())`).then(JSON.parse);
  const absent = await until(o, `(() => { const op = window.__versus?.table?.opponent; return op && op.binding.status === 'text-only' && op.bindingError ? true : null; })()`, 60_000, 300);
  await sleep(1500);
  const a = await st(); note({ step: 'owner-absent', ...a }); await shot(o, 'b1-owner-absent-home');
  if (!absent) return { ok: false, script: 'avatar', error: 'the owner-absent state was not observed (is Harbor already running?)', log };
  if (signal) writeFileSync(signal, 'absent');
  // the owner comes back; the table's own retry (or Show Red) restores Red in the same match
  let back = await until(o, `!!window.__versus?.table?.opponent?.player`, 30_000, 300);
  if (!back) { await js(o, `document.querySelector('.opp-retry')?.click()`); note({ step: 'pressed Show Red' }); back = await until(o, `!!window.__versus?.table?.opponent?.player`, 60_000, 300); }
  await until(o, `!!window.__versus?.table?.seated?._hasFrame`, 20_000, 300);
  await js(o, `window.__versus.cam.home()`); await sleep(2500);
  const r = await st(); note({ step: 'recovered', ...r }); await shot(o, 'b2-recovered-home');
  await js(o, `window.__versus.cam.rotate(45)`); await sleep(2500); note({ step: 'orbit-45', ...(await st()) }); await shot(o, 'b3-orbit-45');
  await js(o, `window.__versus.cam.rotate(45)`); await sleep(2500); note({ step: 'orbit-90', ...(await st()) }); await shot(o, 'b4-orbit-90');
  // close: head and shoulders framed from the human's side, outside the figure's near-fade distance
  await js(o, `(() => { const v = window.__versus, c = v.cam, f = v.table.seated.faceWorld(); c.home(); c.atHome = false; c.goal.focus.set(f.x, f.y - 4, f.z); c.goal.distance = 78; c.goal.pitch = 10 * Math.PI / 180; })()`); await sleep(3000);
  note({ step: 'close', ...(await st()) }); await shot(o, 'b5-close');
  await js(o, `window.__versus.cam.home()`); await sleep(1500);
  // legal play continues in the same match
  const tick0 = (await st()).tick;
  await js(o, `window.__versus._pressReady()`);
  const advanced = await until(o, `window.__versus?.state?.tick > ${tick0} && !window.__versus.playback ? window.__versus.state.tick : null`, 60_000, 300);
  await sleep(1500);
  const f = await st(); note({ step: 'after-ready', ...f }); await shot(o, 'b6-after-ready');
  const sameMatch = a.gen === r.gen && r.gen === f.gen;
  return { ok: !!back && r.player && r.drawn && r.performers === 1 && r.frames === (o.win.webContents.getURL().startsWith('app:') ? 1 : 0) && sameMatch && !!advanced, script: 'avatar', sameMatch, tickBefore: tick0, tickAfter: advanced, log, about: o.about() };
}

async function local(o) {
  const t0 = Date.now();
  const status = await o.peer.ready;
  const transport = await o.callPeer('probeTransport', {}, 30_000);
  await loaded(o);
  const page = await until(o, `(() => { const v = window.__versus; const s = v?.session?.state; const canvas = document.querySelector('canvas'); return s && canvas ? { tick: s.tick, phase: s.phase, parties: Object.values(s.parties).filter(p => p.alive).length, seats: v.seats ?? null, canvas: [canvas.width, canvas.height], bridge: typeof window.hapaDesktop, bridgeKeys: window.hapaDesktop ? Object.keys(window.hapaDesktop) : [], nodeInPage: typeof require !== 'undefined' || typeof process !== 'undefined', origin: location.origin, title: document.title } : null; })()`, 30_000);
  await sleep(2500);
  await shot(o, 'local-match');
  const bridge = await js(o, `window.hapaDesktop.call('getStatus').then(s => ({ ok: true, state: s.state, launch: s.launch, fingerprint: s.player?.fingerprint, hasSecret: JSON.stringify(s).includes('secretKey') })).catch(e => ({ ok: false, error: e.message }))`);
  const refused = await js(o, `window.hapaDesktop.call('deleteEverything').then(() => 'accepted').catch(e => e.message)`);
  const owners = await js(o, `Promise.all(['/capabilities','/music/cj/songs?q=x','/harness/game-status'].map(u => fetch(u).then(r => r.status).catch(e => 'error ' + e.message)))`);
  const table = await until(o, `(() => { const t = window.__versus?.table; const b = t?.opponent?.binding ?? t?.avatar?.binding ?? null; const m = window.__versus?.table?.music ?? window.__versus?.table?.soundtrack; return t ? { avatarStatus: b?.status ?? null, renderer: b?.renderer?.packageId ?? null, voice: !!b?.voice, music: m?.status ?? m?.state ?? null } : { none: true }; })()`, 20_000, 1000);
  return { ok: !!(page && status.launch && transport.destroyed && bridge.ok && !bridge.hasSecret), script: 'local', table, ms: Date.now() - t0, about: o.about(), dataInsideBundle: o.stateRoot().startsWith(o.appRoot), status: { state: status.state, launch: status.launch, createdIdentity: status.createdIdentity, versions: status.versions, fingerprint: status.player?.fingerprint }, transport, page, bridge, refusedUnknownOp: refused, ownerRoutes: owners };
}

async function online(o) {
  const t0 = Date.now();
  const name = process.env.HAPA_VERSUS_SMOKE_NAME || 'Desk';
  const opponent = process.env.HAPA_VERSUS_SMOKE_OPPONENT || null; // challenge this player; otherwise accept
  const maxTicks = Number(process.env.HAPA_VERSUS_SMOKE_TICKS || 400);
  const reloadAt = Number(process.env.HAPA_VERSUS_SMOKE_RELOAD_AT || 0);
  // a bounded journey ends through the existing concession order (an editable-plan order resolved by
  // an agreed Tick), so a long heuristic stalemate cannot hold the evidence run open
  const concedeAfter = Number(process.env.HAPA_VERSUS_SMOKE_CONCEDE_AFTER || 0);
  const status = await o.peer.ready;
  await loaded(o);
  const log = [];
  const note = (x) => { log.push({ t: Date.now() - t0, ...x }); };
  // 1. the lobby: join with a name (real input + click), unless already joined/resumed
  // a relaunch into an active match reattaches on its own; wait for that instead of racing the setup sheet
  const active = (await o.callPeer('getStatus', {}, 10_000).catch(() => null))?.match;
  const resumed = active ? await until(o, `!!window.__versus?.onlineMatch`, 60_000) : await until(o, `!!document.querySelector('.online-panel')`, 30_000);
  const inMatch = await js(o, `!!window.__versus?.onlineMatch`);
  if (!inMatch) {
    // Play online starts discovery by itself (Assignment 19); the display name is set through the
    // same renderer operation the name field uses, before the roster sees it
    if (name) await o.callPeer('setDisplayName', { name }, 10_000).catch(() => null);
    const joinBtn = await until(o, `!!document.querySelector('.online-me')`, 45_000);
    note({ step: 'join', auto: !!joinBtn });
    await until(o, `!!document.querySelector('.online-me')`, 30_000);
    await shot(o, '01-lobby');
    const inviteOut = process.env.HAPA_VERSUS_SMOKE_INVITE_OUT, inviteIn = process.env.HAPA_VERSUS_SMOKE_INVITE_IN;
    if (inviteOut && isAbsolute(inviteOut)) {
      // host: Open a table, Copy invitation (the real buttons), hand the copied text over through a file
      await until(o, `!![...document.querySelectorAll('.online-panel button')].find(b => b.textContent === 'Open a table' && !b.disabled)`, 60_000);
      await js(o, `[...document.querySelectorAll('.online-panel button')].find(b => b.textContent === 'Open a table').click()`);
      const code = await until(o, `(async () => { const b = [...document.querySelectorAll('.online-panel button')].find(b => b.textContent === 'Copy invitation'); if (!b) return null; b.click(); await new Promise(r => setTimeout(r, 300)); return (await window.hapaDesktop.call('lobby.list')).reservation?.invite ?? null; })()`, 30_000);
      writeFileSync(inviteOut, String(code));
      note({ step: 'invitationCopied', version: String(code).slice(0, 6) });
    } else if (inviteIn && isAbsolute(inviteIn)) {
      // joiner: paste the invitation and press Join by invitation; then follow the attempt stages
      let text = null;
      for (let i = 0; i < 240 && !text; i++) { try { text = readFileSync(inviteIn, 'utf8').trim() || null; } catch { /* not yet */ } if (!text) await sleep(500); }
      if (!text) return { ok: false, script: 'online', error: 'no invitation arrived', log };
      await js(o, `(() => { const i = [...document.querySelectorAll('.online-panel input[type=text]')].find(x => /invitation/.test(x.placeholder)); i.value = ${JSON.stringify(text)}; i.dispatchEvent(new Event('input')); [...document.querySelectorAll('.online-panel button')].find(b => b.textContent === 'Join by invitation').click(); })()`);
      const stages = [];
      const t1 = Date.now();
      while (Date.now() - t1 < 120_000) { const st = await js(o, `window.__versus?.onlineMatch ? 'opened' : document.querySelector('.online-panel .attempt')?.className.split(' ').pop() ?? null`); if (st && stages.at(-1) !== st) stages.push(st); if (st === 'opened' || st === 'failed') break; await sleep(250); }
      note({ step: 'joinedByInvitation', stages });
      if (stages.at(-1) === 'failed') return { ok: false, script: 'online', error: 'invitation attempt failed', log };
    } else if (opponent) {
      const seen = await until(o, `(() => { const li = [...document.querySelectorAll('.roster-online li')].find(li => li.querySelector('.who b')?.textContent === ${JSON.stringify(opponent)}); const b = li && [...li.querySelectorAll('button')].find((x) => x.textContent === 'Challenge'); return b && !b.disabled ? true : null; })()`, 180_000, 500);
      note({ step: 'opponentSeen', ok: !!seen });
      if (!seen) return { ok: false, script: 'online', error: `opponent ${opponent} not available`, log };
      await shot(o, '02-roster');
      await js(o, `[...[...document.querySelectorAll('.roster-online li')].find(li => li.querySelector('.who b')?.textContent === ${JSON.stringify(opponent)}).querySelectorAll('button')].find((x) => x.textContent === 'Challenge').click()`);
      note({ step: 'challenged' });
    } else {
      const got = await until(o, `!!document.querySelector('.challenge-in button.primary')`, 240_000, 500);
      note({ step: 'challengeReceived', ok: !!got });
      if (!got) return { ok: false, script: 'online', error: 'no challenge arrived', log };
      await shot(o, '02-challenge-received');
      await js(o, `document.querySelector('.challenge-in button.primary').click()`);
      note({ step: 'accepted' });
    }
  } else note({ step: 'resumedMatch', resumed: !!resumed });
  // 2. the table
  const opened = await until(o, `(() => { const v = window.__versus; return v?.onlineMatch && v.session?.state ? { seat: v.onlineMatch.seat, opponent: v.onlineMatch.opponentLabel, tick: v.state.tick, seats: v.seats } : null; })()`, 60_000);
  note({ step: 'tableOpen', ...opened });
  if (!opened) return { ok: false, script: 'online', error: 'match never opened', log };
  await sleep(1500);
  await shot(o, '03-table');
  // local music during online play (R16-07): the deck is present without an Avatar; the one sound
  // gesture starts it when a music owner is configured
  const musicBefore = await js(o, `(() => { const v = window.__versus; return { deck: !!document.querySelector('.table-music'), status: v.table?.music?.status ?? null, remotePlate: document.querySelector('.opp-social.remote .opp-label')?.textContent ?? null, avatar: !!document.querySelector('.opp-social:not(.remote)') }; })()`);
  await js(o, `document.querySelector('.opp-social.remote .opp-sound')?.click()`);
  await sleep(4000);
  const music = { before: musicBefore, after: await js(o, `(() => { const m = window.__versus.table?.music; return m ? { status: m.status, now: m.current?.title ?? m.nowPlaying?.title ?? null, action: m.primaryAction?.() ?? null } : null; })()`) };
  const ticks = [];
  let reloaded = false, lastTick = 0, choices = 0, stalls = 0;
  for (;;) {
    const s = await js(o, `(() => { const v = window.__versus; if (!v?.state) return null; const b = document.querySelector('.ready-big'); const resp = document.querySelector('.response button:not(:disabled)'); return { tick: v.state.tick, outcome: v.state.outcome ?? null, canReady: !!(b && !b.disabled && !b.hidden && v._can(v.viewSeat).ready), label: b?.textContent ?? '', response: !!resp, resolving: !!(v.resolving || v.playback), result: !!document.querySelector('.card-sheet.result'), replayTicks: v.session.replay.ticks.length, lastFp: v.session.replay.ticks.at(-1)?.fingerprint ?? null }; })()`).catch(() => null);
    if (!s) { await sleep(500); continue; }
    if (s.result || s.outcome) { note({ step: 'result', outcome: s.outcome }); break; }
    if (s.response) { await js(o, `document.querySelector('.response button:not(:disabled)').click()`); choices++; note({ step: 'choice', tick: s.tick }); await sleep(300); continue; }
    if (s.tick !== lastTick && s.canReady) {
      if (reloadAt && !reloaded && s.tick === reloadAt) {
        reloaded = true;
        note({ step: 'reload', tick: s.tick });
        o.win.webContents.reload();
        await sleep(1500); await loaded(o);
        const back = await until(o, `(() => { const v = window.__versus; return v?.onlineMatch && v.state ? { tick: v.state.tick, replayTicks: v.session.replay.ticks.length } : null; })()`, 60_000);
        note({ step: 'reattached', ...back });
        await shot(o, '05-after-reload');
        continue;
      }
      // a real plan edit (heuristic suggestion entered as an ordinary plan revision), then the Ready button
      let planned = await js(o, `window.__versus._devPlanWithBot()`).catch((e) => `error ${e.message}`);
      if (concedeAfter && ticks.length >= concedeAfter) { planned = await js(o, `window.__versus._addCommand(window.__versus.viewSeat, { type: 'concede' }) ? 'concede' : 'concede refused'`); note({ step: 'concede', tick: s.tick }); }
      await sleep(250);
      const t1 = Date.now();
      await js(o, `document.querySelector('.ready-big').click()`);
      const committed = await until(o, `(() => { const v = window.__versus; return v._can(v.viewSeat).current ? document.querySelector('.ready-big')?.textContent : null; })()`, 20_000, 30);
      ticks.push({ tick: s.tick, planned, readyAckMs: Date.now() - t1, label: committed });
      if (s.tick === 2) await shot(o, '04-ready-waiting');
      lastTick = s.tick;
      stalls = 0;
      if (ticks.length >= maxTicks) break;
      continue;
    }
    stalls++;
    if (stalls > 600) { note({ step: 'stalled', s }); break; }
    await sleep(200);
  }
  await sleep(1500);
  await shot(o, '06-result');
  const snap = await o.callPeer('match.get', {}, 10_000).catch((e) => ({ error: e.message }));
  const page = await js(o, `(() => { const v = window.__versus; return { replay: v.session.replay.ticks.map(t => t.fingerprint), outcome: v.state.outcome ?? null }; })()`);
  const agreed = (snap?.history ?? []).map((t) => t.fingerprint);
  const viewMatchesAgreed = agreed.length > 0 && page.replay.length === agreed.length && page.replay.every((f, i) => f === agreed[i]);
  return { ok: viewMatchesAgreed && !!snap?.outcome, script: 'online', ms: Date.now() - t0, about: o.about(), me: status.player?.fingerprint, seat: snap?.seat, opponent: snap?.opponent?.label, outcome: snap?.outcome, finalHash: snap?.finalHash, ticksAgreed: agreed.length, viewMatchesAgreed, readyClicks: ticks.length, choicesAnswered: choices, readyAckMs: summarize(ticks.map((t) => t.readyAckMs)), reloaded, music, feeds: snap?.feeds, ticks: ticks.slice(0, 40), log };
}

function summarize(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return { n: s.length, median: s[Math.floor(s.length / 2)], p95: s[Math.min(s.length - 1, Math.floor(s.length * 0.95))], max: s.at(-1) };
}

/**
 * A fresh installed observer (R16-03): join the lobby through the UI, wait for the configured
 * archive, open Player records, then each player's Profile, and read what the ordinary UI shows.
 */
async function observe(o) {
  const t0 = Date.now();
  const status = await o.peer.ready;
  await loaded(o);
  // the panel renders its Join button once the lobby state arrives: wait for it before clicking
  await o.callPeer('setDisplayName', { name: process.env.HAPA_VERSUS_SMOKE_NAME || 'Olu' }, 10_000).catch(() => null);
  await until(o, `!!document.querySelector('.online-me')`, 45_000); // discovery starts by itself
  const archive = await until(o, `(() => { const p = [...document.querySelectorAll('.online-panel p')].find(p => /Result archive: .* connected/.test(p.textContent)); return p ? p.textContent : null; })()`, 120_000, 500);
  await shot(o, '01-observer-lobby');
  await js(o, `[...document.querySelectorAll('.online-panel button')].find(b => b.textContent === 'Player records').click()`);
  const records = await until(o, `(() => { const li = [...document.querySelectorAll('.record-view .roster-online li')]; return li.length ? li.map(l => l.textContent) : null; })()`, 60_000, 500);
  await shot(o, '02-player-records');
  const profiles = [];
  for (let i = 0; i < (records?.length ?? 0); i++) {
    await js(o, `[...document.querySelectorAll('.record-view .roster-online li')][${i}].querySelector('button').click()`);
    const text = await until(o, `(() => { const v = document.querySelector('.record-view'); return v && v.querySelector('h3') && !/Checking/.test(v.textContent) ? v.innerText : null; })()`, 60_000, 400);
    profiles.push(text);
    if (i === 0) await shot(o, '03-profile');
    await js(o, `[...document.querySelectorAll('.record-view button')].find(b => /Back to the lobby/.test(b.textContent)).click()`);
    await js(o, `[...document.querySelectorAll('.online-panel button')].find(b => b.textContent === 'Player records').click()`);
    await until(o, `document.querySelectorAll('.record-view .roster-online li').length > 0`, 30_000, 300);
  }
  return { ok: !!archive && profiles.length >= 2 && profiles.every((p) => /W–L–D/.test(p) && /Synced from/.test(p)), script: 'observe', ms: Date.now() - t0, about: o.about(), me: status.player?.fingerprint, archive, records, profiles };
}

