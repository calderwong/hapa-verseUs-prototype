#!/usr/bin/env node
/**
 * One peer of the network-namespace relay witness (Review 20 / N22-03; run by relay-netns-witness.sh).
 *
 *   node tools/hapa/relay-witness-peer.mjs <name> <bootstrap host:port> <live relay key> <live relay endpoint> <out.json> <expected peer count>
 *
 * A real PeerRuntime (Hypercore storage, Hyperswarm, HELLO/AUTH) in its own namespace. Its accepted
 * policy lists an unreachable first relay ("gone") and the live relay second; every connection is
 * relayed (forceRelay) and the namespace firewall drops peer-to-peer packets, so an authenticated
 * session can only exist if a relay carries it. Writes what it observed: authenticated players with the
 * observed path and the relay whose published endpoint the stream arrives from, and relay evidence.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PeerRuntime } from '../../src/hapa/network/runtime.js';

const [name, boot, liveKey, liveEp, out, expect, mode = 'fallback'] = process.argv.slice(2);
const local = {
  bootstrap: { mode: 'isolated', overlay: 'netns-witness', nodes: [boot] },
  // `single`: only the live relay (does relay carriage work in this topology?); `fallback`: an
  // unreachable relay first, the live relay second
  relays: [...(mode === 'single' ? [] : [{ id: 'gone', key: '7'.repeat(64), label: 'unreachable first relay' }]), { id: 'live', key: liveKey, endpoint: liveEp, label: 'second relay' }],
};
const rt = new PeerRuntime({ root: mkdtempSync(join(tmpdir(), `hv-netns-${name}-`)), networkId: `test-netns-relay-${mode}`, displayName: name, forceRelay: process.env.WITNESS_FORCE === '1', services: { bundled: null, local }, log: (s) => process.stderr.write(`[${name}] ${s}\n`) });
await rt.open();
await rt.joinLobby({});
// instrumentation (N23-03): which branch HyperDHT takes on each side, and why connections fail
const diag = { serverRelayCalls: 0, clientErrors: {}, serverRelayed: 0 };
const sw = rt.lobby.swarm;
if (sw) {
  const relayConn = sw.server._relayConnection?.bind(sw.server);
  if (relayConn) sw.server._relayConnection = (...a) => { diag.serverRelayCalls++; return relayConn(...a); };
  const dconnect = sw.dht.connect.bind(sw.dht);
  sw.dht.connect = (pk, o = {}) => { const c = dconnect(pk, o); c.on('error', (e) => { const k = e?.code ?? e?.message ?? 'error'; diag.clientErrors[k] = (diag.clientErrors[k] ?? 0) + 1; }); return c; };
}
const t0 = Date.now();
let roster = [];
while (Date.now() - t0 < 180_000) {
  roster = rt.lobbyView().roster;
  if (roster.length >= Number(expect)) break;
  await new Promise((r) => setTimeout(r, 500));
}
await new Promise((r) => setTimeout(r, 3000)); // let late upgrades or drops happen before recording
roster = rt.lobbyView().roster;
const dht = rt.lobby.swarm?.dht;
const transport = { ...rt.lobby.transport(), dhtNodes: dht?.nodes?.length ?? null, dhtHost: dht?.host ?? null, dhtPort: dht?.port ?? null, firewalled: dht?.firewalled ?? null, swarmPeers: rt.lobby.swarm?.peers?.size ?? null, connecting: rt.lobby.swarm?.connecting ?? null, stats: rt.lobby.swarm?.stats ?? null };
const result = { name, mode, diag, firewall: { firewalled: dht?.firewalled ?? null, randomized: dht?.randomized ?? null, remoteAddress: dht?.remoteAddress?.() ? 'known' : null }, transport, seconds: (Date.now() - t0) / 1000, roster: roster.map((p) => ({ label: p.label, fingerprint: p.fingerprint, path: p.path, relay: p.relay })), relays: rt.lobby.transport().relays, exhausted: rt.lobby.transport().relaysExhausted, policyRelays: rt.policy.relays.map((r) => r.id) };
result.ok = roster.length >= Number(expect) && roster.every((p) => p.path === 'relayed' && p.relay === 'live');
writeFileSync(out, JSON.stringify(result, null, 1));
console.log(JSON.stringify(result));
// stay connected briefly so the other peers can finish recording, then leave
await new Promise((r) => setTimeout(r, 15_000));
await rt.close();
process.exit(0);
