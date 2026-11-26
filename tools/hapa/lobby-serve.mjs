#!/usr/bin/env node
/**
 * npm run lobby:serve -- --data <abs dir> [--network public-alpha] [--name "Hapa Archive"] [--testnet host:port]
 *
 * The headless public result archive / directory (p2p-matchmaking-v1 §11): the same peer runtime in
 * the `archive` role. It joins the lobby, accepts submitted result bundles, verifies each one
 * independently, stores it durably and serves verified evidence to any observer — including while
 * both match authors are offline. It is not a referee, an identity authority or a relay, and it
 * never plays. Its identity lives in the given data root; keep that root on durable storage.
 */
import { resolve, isAbsolute } from 'node:path';
import { PeerRuntime } from '../../src/hapa/network/runtime.js';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const data = arg('data');
if (!data || !isAbsolute(data)) { console.error('--data <absolute directory> is required (the archive\'s durable root)'); process.exit(2); }
const bootstrap = arg('testnet') ? arg('testnet').split(',').map((hp) => { const [host, port] = hp.split(':'); return { host, port: Number(port) }; }) : undefined;
const out = (o) => process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), ...o })}\n`);
const rt = new PeerRuntime({ root: resolve(data), networkId: arg('network', 'public-alpha'), displayName: arg('name', 'Hapa Archive'), role: 'archive', bootstrap, host: 'lobby-serve',
  log: (s) => out({ log: s }), onEvent: (e) => { if (e.type === 'results' || e.kind === 'roster') out({ event: e.kind, key: e.key, status: e.status, peers: e.roster?.length }); } });
const st = await rt.open();
await rt.joinLobby({});
out({ serving: { fingerprint: st.player.fingerprint, player: st.player.participantId, transport: rt.lobby.swarm.keyPair.publicKey.toString('hex'), network: rt.networkId, results: rt.results.list({}).total } });
setInterval(() => out({ status: { peers: rt.lobby?.peers.size ?? 0, results: rt.results.list({}).total, transport: rt.lobby?.transport().state } }), 60_000).unref();
const stop = async () => { await rt.close(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
