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
  log: (s) => { if (!quiet) out({ log: s }); },
  onEvent: (e) => {
    if (!quiet || e.kind === 'opened' || e.kind === 'complete' || e.kind === 'disputed' || e.kind === 'challengeReceived' || e.kind === 'challengeDeclined') out({ event: e.kind, ...(e.type === 'match' ? { matchId: e.matchId, count: e.count, hash: e.hash?.slice(7, 19), reason: e.reason, outcome: e.outcome } : { from: e.from, reason: e.reason }) });
    if (e.type === 'match' && e.kind === 'complete') setTimeout(async () => { out({ RESULT: { matchId: e.matchId, outcome: e.outcome, finalHash: e.finalHash, ticks: e.ticks, me: rt.identity.label } }); if (flag('exit-on-complete')) { await rt.close(); process.exit(0); } }, 1500);
    if (e.type === 'match' && e.kind === 'disputed') { out({ DISPUTED: e.reason }); }
  },
});
const st = await rt.open();
out({ ready: { fingerprint: st.player.fingerprint, label: st.player.label, controller: rt.controllerKind, launch: st.launch.index, resumed: st.match } });
await rt.joinLobby({});
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
