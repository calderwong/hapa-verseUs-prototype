#!/usr/bin/env node
/**
 * A native blind relay for Hapa Versus (N19-03; friend-test-and-resilient-connectivity-v1 §4).
 *
 * It forwards already-encrypted Noise streams between two peers whose direct holepunch failed. It
 * holds no game, identity or history authority, retains nothing and cannot read the traffic. Anyone
 * (a friend, a community member, a third-party VPS) may run one; players adopt it as a typed `relay`
 * service (publicKey, optional published endpoint) in their network configuration.
 *
 *   node tools/hapa/relay-serve.mjs [--seed <64-hex seed file>] [--testnet host:port,...] [--port <udp>]
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
 * @param {{ bootstrap?: any[], seed?: Buffer, port?: number }} [o]
 * @returns {Promise<{ publicKey: string, endpoint: () => string|null, close: () => Promise<void>, stats: any }>}
 */
export async function startRelay(o = {}) {
  const dht = new DHT({ ...(o.bootstrap ? { bootstrap: o.bootstrap } : {}), ...(o.port ? { port: o.port } : {}) });
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
  const r = await startRelay({ bootstrap, seed, port: arg('port') ? Number(arg('port')) : undefined });
  console.log(JSON.stringify({ relay: { publicKey: r.publicKey, endpoint: r.endpoint() } }));
  for (const s of ['SIGINT', 'SIGTERM']) process.on(s, async () => { await r.close(); process.exit(0); });
}
