/**
 * Packaged-app smoke and journey automation (evidence only). Loaded by desktop/main.mjs only when
 * HAPA_VERSUS_SMOKE_OUT names an absolute directory, and writes only there.
 *
 *  - `local`  : a rendered local human/bot match, native store/transport/bridge checks.
 *  - `online` : the real lobby and table UI driven by DOM clicks — Join lobby, Challenge (or Accept),
 *               a planned order and Ready each Tick, response choices — against another peer, with
 *               each Tick's view replay compared to the runtime's agreed receipt. Optional renderer
 *               reload mid-match (HAPA_VERSUS_SMOKE_RELOAD_AT=<tick>).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function runSmoke(o) {
  mkdirSync(o.out, { recursive: true });
  o.win.webContents.on('console-message', (e) => { if (o.consoleLines.length < 120 && (e.level === 'warning' || e.level === 'error')) o.consoleLines.push(`${e.level}: ${String(e.message).slice(0, 300)}`); });
  const result = o.script === 'online' ? await online(o) : o.script === 'observe' ? await observe(o) : await local(o);
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
    const joinBtn = await until(o, `(() => { const b = [...document.querySelectorAll('.online-panel button')].find(b => b.textContent === 'Join lobby'); return b ? true : !!document.querySelector('.online-me'); })()`, 30_000);
    await js(o, `(() => { const i = document.querySelector('.online-panel input[type=text]'); const b = [...document.querySelectorAll('.online-panel button')].find(b => b.textContent === 'Join lobby'); if (i && b) { i.value = ${JSON.stringify(name)}; i.dispatchEvent(new Event('input')); b.click(); return 'clicked'; } return 'already'; })()`);
    note({ step: 'join', joinBtn: !!joinBtn });
    await until(o, `!!document.querySelector('.online-me')`, 30_000);
    await shot(o, '01-lobby');
    if (opponent) {
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
  return { ok: viewMatchesAgreed && !!snap?.outcome, script: 'online', ms: Date.now() - t0, about: o.about(), me: status.player?.fingerprint, seat: snap?.seat, opponent: snap?.opponent?.label, outcome: snap?.outcome, finalHash: snap?.finalHash, ticksAgreed: agreed.length, viewMatchesAgreed, readyClicks: ticks.length, choicesAnswered: choices, readyAckMs: summarize(ticks.map((t) => t.readyAckMs)), reloaded, feeds: snap?.feeds, ticks: ticks.slice(0, 40), log };
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
  await until(o, `!!document.querySelector('.online-panel')`, 30_000);
  await js(o, `(() => { const i = document.querySelector('.online-panel input[type=text]'); const b = [...document.querySelectorAll('.online-panel button')].find(b => b.textContent === 'Join lobby'); if (i && b) { i.value = ${JSON.stringify(process.env.HAPA_VERSUS_SMOKE_NAME || 'Olu')}; i.dispatchEvent(new Event('input')); b.click(); } })()`);
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

