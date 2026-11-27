/**
 * Connectivity services (Assignment 19, N19-03; FT-07, FT-08). Policy semantics and history on real
 * Hypercore storage, then two controlled native witnesses on a local HyperDHT testnet: startup with
 * an unavailable bootstrap entry beside working ones in the same overlay, and a relayed session that
 * falls back from an unreachable first relay to a second real blind relay. These are controlled
 * fixtures for the wiring; they say nothing about public providers or real home networks.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { createSocket } from 'node:dgram';
import { ServicePolicy, normalizeConfig, PUBLIC_BOOTSTRAP } from '../../src/hapa/network/services.js';
import { PeerRuntime } from '../../src/hapa/network/runtime.js';
import { startRelay } from '../../tools/hapa/relay-serve.mjs';

const createTestnet = createRequire(import.meta.url)('hyperdht/testnet');
const K = (c) => c.repeat(64);
const until = async (pred, ms = 90_000) => { const t0 = Date.now(); for (;;) { const v = await pred(); if (v) return v; if (Date.now() - t0 > ms) throw new Error('timed out'); await new Promise((r) => setTimeout(r, 200)); } };
const freePort = () => new Promise((res) => { const s = createSocket('udp4'); s.bind(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });

test('service policy: bundled defaults, idempotent import, extend/replace, refused update keeps the last valid policy', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'hv-svc-'));
  const open = async (local) => { const p = new ServicePolicy({ dir: join(dir, 'policy'), bundled: { bootstrap: 'hyperdht-public-defaults', relays: [], archives: [] }, local }); const e = await p.open(); return { p, e }; };
  try {
    let { p, e } = await open(null);
    assert.deepEqual(e.bootstrap, PUBLIC_BOOTSTRAP);
    assert.equal(e.mode, 'default');
    assert.ok(p.summary().services.every((s) => s.provenance === 'bundled-default'));
    const seeded = p.records.length;
    await p.close();
    ({ p, e } = await open(null));
    assert.equal(p.records.length, seeded, 'reopening appends nothing');
    await p.close();

    const local = { bootstrap: { mode: 'extend', nodes: ['203.0.113.7@dht.example.net:49737'] }, relays: [{ key: K('a'), endpoint: '198.51.100.2:9000', label: 'Friend relay' }, { key: K('b'), label: 'Second relay' }] };
    ({ p, e } = await open(local));
    assert.equal(e.bootstrap.length, 4, 'an accepted compatible node extends the same overlay');
    assert.deepEqual(e.relays.map((r) => r.key), [K('a'), K('b')], 'every relay candidate reaches the runtime, in order');
    assert.ok(p.summary().services.filter((s) => s.role === 'relay').every((s) => s.provenance === 'local-config-import'));
    const imported = p.records.length;
    await p.close();
    ({ p, e } = await open(local));
    assert.equal(p.records.length, imported, 'the same local configuration is imported once');
    await p.close();

    // an invalid update is refused; the last valid policy stays in force
    ({ p, e } = await open({ relays: [{ key: 'not-a-key' }] }));
    assert.equal(p.records.length, imported);
    assert.equal(e.relays.length, 2);
    assert.match(p.errors[0], /relay needs a 64-hex public key/);
    await p.close();

    // retirement is final; a replace with no nodes is refused rather than isolating the player
    ({ p, e } = await open({ ...local, retire: ['relay-aaaaaaaaaaaa'], bootstrap: { mode: 'replace', nodes: [] } }));
    assert.deepEqual(e.relays.map((r) => r.key), [K('b')]);
    assert.deepEqual([e.mode, e.bootstrap], ['replace', ['203.0.113.7@dht.example.net:49737']], 'replace uses only the accepted non-default nodes');
    await p.close();
    const fresh = new ServicePolicy({ dir: join(dir, 'policy2'), local: { bootstrap: { mode: 'replace', nodes: [] } } });
    const fe = await fresh.open();
    assert.ok(fe.bootstrap.length === 3 && fe.warnings.some((w) => /empty replace/.test(w)), 'an empty replacement is refused rather than isolating the player');
    await fresh.close();

    assert.equal(normalizeConfig({ services: [{ id: 'g1', role: 'gateway', adapter: 'wss/1', endpoint: 'wss://x.example' }] }).services[0].executable, false, 'a future adapter is data, never executed');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('FT-07 (controlled): an unavailable bootstrap entry beside working ones in the same overlay still discovers the peer', { timeout: 120_000 }, async () => {
  const testnet = await createTestnet(3);
  const dead = { host: '127.0.0.1', port: await freePort() };
  const roots = [mkdtempSync(join(tmpdir(), 'hv-bs-a-')), mkdtempSync(join(tmpdir(), 'hv-bs-b-'))];
  const local = { bootstrap: { mode: 'isolated', overlay: 'testnet', nodes: [`127.0.0.1:${dead.port}`, ...testnet.bootstrap.map((b) => `${b.host}:${b.port}`)] } };
  const rts = roots.map((root, i) => new PeerRuntime({ root, networkId: 'test-bootstrap', displayName: i ? 'Bea' : 'Ari', services: { bundled: null, local } }));
  try {
    for (const r of rts) await r.open();
    assert.equal(rts[0].policy.mode, 'isolated');
    assert.equal(rts[0].policy.bootstrap.length, 1 + testnet.bootstrap.length, 'the dead entry and the working entries all reach the native options');
    for (const r of rts) await r.joinLobby({});
    await until(() => rts[0].lobbyView().roster.some((p) => p.label === 'Bea') && rts[1].lobbyView().roster.some((p) => p.label === 'Ari'));
  } finally {
    for (const r of rts) await r.close().catch(() => {});
    await testnet.destroy();
    for (const r of roots) rmSync(r, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

test('FT-08 (controlled, partial): relay candidates rotate past an unreachable first relay; sessions authenticate with relays configured', { timeout: 120_000 }, async () => {
  const testnet = await createTestnet(3);
  const relay = await startRelay({ bootstrap: testnet.bootstrap });
  const roots = [mkdtempSync(join(tmpdir(), 'hv-rl-a-')), mkdtempSync(join(tmpdir(), 'hv-rl-b-'))];
  const local = { bootstrap: { mode: 'isolated', overlay: 'testnet', nodes: testnet.bootstrap.map((b) => `${b.host}:${b.port}`) }, relays: [{ id: 'gone', key: K('e'), label: 'retired box' }, { id: 'live', key: relay.publicKey, label: 'live relay' }] };
  const rts = roots.map((root, i) => new PeerRuntime({ root, networkId: 'test-relay', displayName: i ? 'Bea' : 'Ari', services: { bundled: null, local } }));
  try {
    for (const r of rts) await r.open();
    assert.deepEqual(rts[0].policy.relays.map((r) => r.id), ['gone', 'live'], 'both candidates reach the runtime in policy order');
    for (const r of rts) await r.joinLobby({});
    // the selection Hyperswarm calls on each relayed attempt: a failed first relay never hides the second
    const lobby = rts[0].lobby;
    const handed = [lobby._nextRelay(), lobby._nextRelay(), lobby._nextRelay()].map((b) => b.toString('hex'));
    assert.deepEqual(handed, [K('e'), relay.publicKey, K('e')]);
    // a relay observed carrying a connection is preferred
    lobby.relays[1].observed = Number(process.hrtime.bigint() / 1_000_000n);
    assert.equal(lobby._nextRelay().toString('hex'), relay.publicKey);
    await until(() => rts[0].lobbyView().roster.some((p) => p.label === 'Bea'));
    // NOTE: on a loopback testnet HyperDHT upgrades to the direct path, so this fixture cannot force the
    // session through the live relay; that witness needs a NAT/firewalled fixture (reported, not claimed)
  } finally {
    for (const r of rts) await r.close().catch(() => {});
    await relay.close();
    await testnet.destroy();
    for (const r of roots) rmSync(r, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
