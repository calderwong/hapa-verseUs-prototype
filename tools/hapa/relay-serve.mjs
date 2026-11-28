#!/usr/bin/env node
/**
 * A native blind relay for Hapa Versus (N19-03; friend-test-and-resilient-connectivity-v1 §4).
 *
 * It forwards already-encrypted Noise streams between two peers whose direct holepunch failed. It
 * holds no game, identity or history authority, retains nothing and cannot read the traffic. Anyone
 * (a friend, a community member, a third-party VPS) may run one; players adopt it as a typed `relay`
 * service (publicKey, optional published endpoint) in their network configuration.
 *
 *   node tools/hapa/relay-serve.mjs [--seed <64-hex seed file>] [--testnet host:port,...] [--port <udp>] [--public]
 *
 * Prints {"relay": {"publicKey": ...}} once listening. Also importable: `startRelay({ bootstrap })`.
 */
import DHT from 'hyperdht';
import { Server as RelayServer } from 'blind-relay';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import b4a from 'b4a';
import { pathToFileURL } from 'node:url';

/**
 * @param {{ bootstrap?: any[], seed?: Buffer, port?: number, publicAddress?: boolean }} [o]
 * @returns {Promise<{ publicKey: string, endpoint: () => string|null, close: () => Promise<void>, stats: any }>}
 */
export async function startRelay(o = {}) {
  // publicAddress: the operator states the relay runs on a routable public address, so its DHT starts as
  // OPEN (not firewalled) — peers behind NATs can then reach it without holepunching. Without it the DHT
  // detects reachability itself, which takes time and may never conclude in an isolated test network.
  const dht = new DHT({ ...(o.bootstrap ? { bootstrap: o.bootstrap } : {}), ...(o.port ? { port: o.port } : {}), ...(o.publicAddress ? { firewalled: false, ephemeral: false } : {}) });
  const relay = new RelayServer({ createStream: (opts) => dht.createRawStream({ ...opts, framed: true }) });
  const server = dht.createServer({ shareLocalAddress: false }, (socket) => {
    const session = relay.accept(socket, { id: socket.remotePublicKey });
    session.on('error', () => {});
  });
  const keyPair = DHT.keyPair(o.seed ?? randomBytes(32));
  await server.listen(keyPair);
  return {
    publicKey: b4a.toString(keyPair.publicKey, 'hex'),
    endpoint: () => { const a = dht.localAddress?.(); return a ? `${a.host}:${a.port}` : null; },
    stats: relay.stats,
    close: async () => { await relay.close().catch(() => {}); await server.close().catch(() => {}); await dht.destroy().catch(() => {}); },
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : null; };
  let seed;
  if (arg('seed')) {
    if (!existsSync(arg('seed'))) writeFileSync(arg('seed'), randomBytes(32).toString('hex'), { mode: 0o600 });
    seed = Buffer.from(readFileSync(arg('seed'), 'utf8').trim(), 'hex');
  }
  const bootstrap = arg('testnet') ? arg('testnet').split(',').map((hp) => { const [host, port] = hp.split(':'); return { host, port: Number(port) }; }) : undefined;
  const r = await startRelay({ bootstrap, seed, port: arg('port') ? Number(arg('port')) : undefined, publicAddress: process.argv.includes('--public') });
  console.log(JSON.stringify({ relay: { publicKey: r.publicKey, endpoint: r.endpoint() } }));
  // --stats <file>: what the relay itself observed (sessions, pairings, streams), rewritten every 2 s
  if (arg('stats')) setInterval(() => { try { writeFileSync(arg('stats'), JSON.stringify({ at: new Date().toISOString(), sessions: { ...r.stats.sessions, active: r.stats.sessions.active }, pairings: r.stats.pairings, streams: r.stats.streams })); } catch { /* best effort */ } }, 2000);
  for (const s of ['SIGINT', 'SIGTERM']) process.on(s, async () => { await r.close(); process.exit(0); });
}
