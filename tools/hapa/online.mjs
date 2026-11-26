#!/usr/bin/env node
/**
 * Headless online peer (Assignment 16: headless operation is a supported path).
 *
 *   node tools/hapa/online.mjs --data <abs dir> [--name Kai] [--network public-alpha] [--bot]
 *        [--auto-accept] [--challenge <name or fingerprint>] [--testnet <host:port,...>] [--quiet]
 *
 * Runs the same PeerRuntime the desktop app hosts. A `--bot` peer declares the heuristic bot as
 * its controller (shown to opponents); without it, the peer is a human seat that a UI must drive.
 * Prints one JSON line per event to stdout and a final RESULT line when a match completes.
 */
import { resolve, isAbsolute } from 'node:path';
import { PeerRuntime } from '../../src/hapa/network/runtime.js';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const flag = (n) => process.argv.includes(`--${n}`);
const data = arg('data');
if (!data || !isAbsolute(data)) { console.error('--data <absolute directory> is required (a test identity root; never a player store you did not create)'); process.exit(2); }
const bootstrap = arg('testnet') ? arg('testnet').split(',').map((hp) => { const [host, port] = hp.split(':'); return { host, port: Number(port) }; }) : undefined;
const out = (o) => process.stdout.write(`${JSON.stringify(o)}\n`);
const quiet = flag('quiet');

const rt = new PeerRuntime({
  root: resolve(data), networkId: arg('network', 'public-alpha'), displayName: arg('name'), controller: flag('bot') ? 'bot' : 'human', autoAccept: flag('auto-accept'), bootstrap, host: 'headless',
  relayThrough: arg('relay'), forceRelay: flag('force-relay'), archives: arg('archive') ? [JSON.parse(arg('archive'))] : [], relayEndpoints: arg('relay-endpoint') ? [arg('relay-endpoint')] : [],
  log: (s) => { if (!quiet) out({ log: s }); },
  onEvent: (e) => {
    if (!quiet || e.kind === 'opened' || e.kind === 'complete' || e.kind === 'disputed' || e.kind === 'challengeReceived' || e.kind === 'challengeDeclined') out({ event: e.kind, ...(e.type === 'match' ? { matchId: e.matchId, count: e.count, hash: e.hash?.slice(7, 19), reason: e.reason, outcome: e.outcome } : { from: e.from, reason: e.reason }) });
    if (e.type === 'match' && e.kind === 'complete') out({ RESULT: { matchId: e.matchId, outcome: e.outcome, finalHash: e.finalHash, ticks: e.ticks, me: rt.identity.label } });
    // exit once the result is saved locally and archived (or after a bounded wait when no archive is reachable)
    if (e.type === 'match' && e.kind === 'resultSaved') { out({ SAVED: { status: e.status, key: e.key, record: e.record?.buckets } }); if (flag('exit-on-complete')) setTimeout(async () => { await rt.close(); process.exit(0); }, 20_000); }
    if (e.type === 'match' && e.kind === 'resultArchived') { out({ ARCHIVED: { by: e.by, status: e.status } }); if (flag('exit-on-complete')) setTimeout(async () => { await rt.close(); process.exit(0); }, 1500); }
    if (e.type === 'match' && e.kind === 'disputed') { out({ DISPUTED: e.reason }); }
    if (e.type === 'match' && e.kind === 'opened') out({ PATHS: (rt.lobby?.roster() ?? []).map((r) => ({ label: r.label, path: r.path })) });
  },
});
const st = await rt.open();
out({ ready: { fingerprint: st.player.fingerprint, label: st.player.label, controller: rt.controllerKind, launch: st.launch.index, resumed: st.match } });
await rt.joinLobby({});
// --observe: a fresh observer that pulls verified evidence from a connected archive and prints records
if (flag('observe')) {
  const t0 = Date.now();
  const tick = async () => {
    const archives = (rt.lobby?.roster() ?? []).filter((r) => r.role === 'archive');
    if (!archives.length) { if (Date.now() - t0 > 180_000) { out({ error: 'no archive reachable after 180 s' }); process.exit(3); } return setTimeout(tick, 1000); }
    const first = await rt.syncResults({});
    const again = await rt.syncResults({});
    const list = rt.results.list({});
    const ids = new Map();
    for (const it of list.items) for (const s of ['A', 'B']) ids.set(it.players[s].participantId, it.players[s].label);
    out({ OBSERVED: { archives: archives.map((a) => a.label), firstSync: first, secondSync: again, results: list.total, profiles: [...ids].map(([id, label]) => ({ label, fingerprint: id.slice(4, 8) + '-' + id.slice(8, 12), ...rt.results.stats(id) })) } });
    if (flag('exit-on-complete')) { await rt.close(); process.exit(0); }
  };
  setTimeout(tick, 1000);
}
if (flag('open-table')) { const v = rt.openTable(); out({ INVITE: v.reservation.invite }); }
if (arg('join-invite')) { setTimeout(() => rt.joinTable({ invite: arg('join-invite') }).then(() => out({ joined: true })).catch((e) => out({ joinError: e.message })), 2000); }
const target = arg('challenge');
if (target) {
  const t0 = Date.now();
  const tryChallenge = async () => {
    const v = rt.lobbyView();
    const p = v.roster.find((r) => (r.label === target || r.fingerprint === target) && r.availability === 'available' && r.compatible);
    if (p) { out({ challenging: p.label, afterMs: Date.now() - t0 }); try { rt.challenge({ playerId: p.playerId }); } catch (e) { out({ challengeError: e.message }); setTimeout(tryChallenge, 2000); } return; }
    if (Date.now() - t0 > 180_000) { out({ error: `no available player ${target} after 180 s` }); process.exit(3); }
    setTimeout(tryChallenge, 1000);
  };
  if (!rt.match) tryChallenge();
}
process.on('SIGINT', async () => { await rt.close(); process.exit(0); });
process.on('SIGTERM', async () => { await rt.close(); process.exit(0); });
