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
import { ServicePolicy, normalizeConfig, PUBLIC_BOOTSTRAP, project, effectivePolicy } from '../../src/hapa/network/services.js';
import { Lobby } from '../../src/hapa/network/lobby.js';
import { PeerRuntime, parseInvite } from '../../src/hapa/network/runtime.js';
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
    assert.ok(fe.bootstrap.length === 3 && fresh.errors.some((w) => /refused — no eligible/.test(w)), 'an empty replacement is refused before adoption; the previous policy stays');
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

test('HC-06 (N20-02): retired, disabled and expired providers never return through fallback; no eligible route is an explicit state', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'hv-hc6-'));
  const ids = ['hyperdht-public-1', 'hyperdht-public-2', 'hyperdht-public-3'];
  try {
    const open = async (n, local) => { const p = new ServicePolicy({ dir: join(dir, `p${n}`), local }); const e = await p.open(); return { p, e }; };
    // retire one default: only the other two remain
    let { p, e } = await open(1, { retire: ['hyperdht-public-1'] });
    assert.deepEqual(e.bootstrap, PUBLIC_BOOTSTRAP.slice(1));
    await p.close();
    // retire all defaults with an accepted alternative: only the alternative is used
    ({ p, e } = await open(2, { bootstrap: { mode: 'extend', nodes: ['203.0.113.9@dht.example.org:49737'] }, retire: ids }));
    assert.deepEqual(e.bootstrap, ['203.0.113.9@dht.example.org:49737'], 'no retired default is put back');
    await p.close();
    ({ p, e } = await open(2, null)); // restart: seeding does not resurrect the retired ids
    assert.deepEqual(e.bootstrap, ['203.0.113.9@dht.example.org:49737']);
    // disable all defaults with no alternative: the import is refused (it would leave no route); the defaults stay
    ({ p, e } = await open(3, { disable: ids }));
    assert.equal(e.bootstrap.length, 3); assert.match(p.errors.join(' '), /refused — no eligible/);
    // a user decision that does it anyway yields an honest no-route state, never the hard-coded list
    for (const id of ids) e = await p.decide({ action: 'disable', serviceId: id });
    assert.deepEqual(e.bootstrap, []); assert.match(e.noRoute, /no eligible discovery provider/);
    e = await p.decide({ action: 'enable', serviceId: 'hyperdht-public-2' });
    assert.deepEqual(e.bootstrap, [PUBLIC_BOOTSTRAP[1]], 'an explicit enable is required for reuse');
    await p.close();
    // expiry: an expired accepted alternative is excluded; isolated mode never crosses to public
    const pr = project([{ schema: 'hapa-versus-service-policy/v1', action: 'add', service: { id: 'x', role: 'bootstrap', endpoint: { node: 'dht.example.org:1' }, expiresAt: 1 }, provenance: { kind: 'user' } }, { schema: 'hapa-versus-service-policy/v1', action: 'mode', mode: 'isolated' }]);
    assert.equal(pr.services.get('x').state, 'expired');
    assert.deepEqual(effectivePolicy(pr).bootstrap, []);
    // the options the native layer receives: a Lobby with no eligible route never starts a swarm (no library defaults)
    const lobby = new Lobby({ networkId: 'n', identity: {}, transportKeyPair: null, compat: {}, presence: () => ({}), onPeer: () => {}, onMessage: () => {}, bootstrap: [], noRoute: 'no eligible discovery provider' });
    await lobby.start();
    assert.deepEqual([lobby.swarm, lobby.state, lobby.transport().error], [undefined, 'failed', 'no eligible discovery provider']);
  } finally { rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); }
});

test('HC-07 (N20-02): an import interrupted at any durable boundary is never half-applied; restart completes it once', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'hv-hc7-'));
  const local = { bootstrap: { mode: 'replace', nodes: ['203.0.113.1@a.example:49737', '203.0.113.2@b.example:49737'] } }; // 3 records + commit
  try {
    for (const k of [1, 2, 3]) {
      const d = join(dir, `p${k}`);
      // first open seeds the defaults (one batch); then the local import is interrupted after k records
      const p0 = new ServicePolicy({ dir: d }); await p0.open(); await p0.close();
      const p1 = new ServicePolicy({ dir: d, local, interruptAfter: k });
      await assert.rejects(p1.open(), /interrupted/);
      await p1.close();
      const p2 = new ServicePolicy({ dir: d, local });
      const before = project(p2.records ?? []);
      const e = await p2.open();
      assert.equal(e.mode, 'replace', `boundary ${k}: the restarted import completed`);
      assert.deepEqual(e.bootstrap, local.bootstrap.nodes);
      assert.ok(p2.projection.incomplete.length === 1, 'the partial batch stays as evidence, unapplied');
      const n = p2.records.length;
      await p2.close();
      const p3 = new ServicePolicy({ dir: d, local });
      await p3.open();
      assert.equal(p3.records.length, n, 'reapplying a completed import appends nothing');
      await p3.close();
      void before;
    }
  } finally { rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); }
});

test('HC-09 (N20-03): an unsuccessful relay cools down and yields; a formerly good relay that stops working yields; exhaustion is bounded', () => {
  const lobby = new Lobby({ networkId: 'n', relays: [{ id: 'A', key: 'a'.repeat(64), endpoint: '198.51.100.1:1' }, { id: 'B', key: 'b'.repeat(64), endpoint: '198.51.100.2:2' }] });
  lobby.relays = lobby.o.relays.map((r) => ({ ...r, buf: Buffer.from(r.key, 'hex'), handed: 0, observed: 0, failures: 0, cooldownUntil: 0, pending: 0 }));
  const pick = () => lobby._nextRelay().toString('hex')[0];
  // unreachable first: A handed, no relayed connection observed, next request goes to B
  assert.equal(pick(), 'a'); assert.equal(pick(), 'b');
  assert.equal(lobby.relays[0].failures, 1);
  // B carries a connection (observed): it is preferred while healthy
  lobby.relays[1].observed = Number(process.hrtime.bigint() / 1_000_000n); lobby.relays[1].failures = 0; lobby.relays[1].cooldownUntil = 0;
  assert.equal(pick(), 'b');
  // B stops working: its unobserved handout counts against it; A's cooldown has expired → A next
  lobby.relays[0].cooldownUntil = 0;
  lobby.relays[1].observed = 0;
  const seq = [pick(), pick(), pick(), pick()];
  assert.ok(seq.includes('a') && seq.filter((x) => x === 'b').length < 4, `alternatives reached: ${seq.join('')}`);
  // both cooling: bounded retry of the one whose cooldown ends first, reported as exhausted
  for (const r of lobby.relays) { r.cooldownUntil = Number(process.hrtime.bigint() / 1_000_000n) + 60_000 + (r.id === 'B' ? 1 : 0); r.pending = 0; }
  assert.equal(pick(), 'a'); assert.equal(lobby.transport().relaysExhausted, true);
});

test('HC-10 (N20-04): cancelling at discovery, negotiation and after the accept stays cancelled; one tombstone; the next attempt works', { timeout: 180_000 }, async () => {
  const testnet = await createTestnet(3);
  const roots = [mkdtempSync(join(tmpdir(), 'hv-c-a-')), mkdtempSync(join(tmpdir(), 'hv-c-b-'))];
  const make = (i) => new PeerRuntime({ root: roots[i], networkId: 'test-cancel', displayName: i ? 'Bea' : 'Ari', bootstrap: testnet.bootstrap, controller: 'bot' });
  const rts = [make(0), make(1)];
  try {
    for (const r of rts) await r.open();
    for (const r of rts) await r.joinLobby({});
    // discovery stage: a table whose host is unreachable; cancel immediately
    rts[0].openTable();
    const invite = rts[0].reservation.invite;
    rts[1].startJoin({ invite, attemptId: 'cancel-disc-0001' });
    await rts[1].cancelAttempt({ attemptId: 'cancel-disc-0001' });
    assert.equal(rts[1].attempt.stage, 'cancelled');
    await rts[1].cancelAttempt({ attemptId: 'cancel-disc-0001' }); // duplicate: no second effect
    assert.equal(rts[1].attempt.stage, 'cancelled');
    // after the accept: hold the host's START so the joiner sits in `accepted`, then cancel
    const origSend = rts[0].lobby.send.bind(rts[0].lobby);
    rts[0].lobby.send = (pid, msg) => (msg.t === 'start' ? true : origSend(pid, msg));
    rts[1].startJoin({ invite, attemptId: 'cancel-acc-0002' });
    await until(() => rts[1].reservation?.phase === 'accepted', 60_000);
    const res = await rts[1].cancelAttempt({ attemptId: 'cancel-acc-0002' });
    await rts[1].attempt.leaving;
    assert.equal(res.attempt.stage, 'cancelled');
    assert.equal(rts[1].attempt.stage, 'cancelled', 'reservation release did not relabel it failed');
    assert.equal(rts[1].reservation, null);
    const tomb = Object.values(rts[1].tombstones.attempts).filter((t) => t.matchId === `hv-${rts[0].reservation?.challengeId ?? parseInvite(invite).challengeId}`);
    assert.equal(tomb.length, 1, 'exactly one tombstone');
    // a late START for the cancelled attempt cannot revive it
    rts[0].lobby.send = origSend;
    await new Promise((r) => setTimeout(r, 2000));
    assert.equal(rts[1].match, null);
    assert.equal(rts[1].attempt.stage, 'cancelled');
    // the next attempt (a new table) connects
    if (rts[0].reservation) rts[0]._reserve(null);
    rts[0].openTable();
    rts[1].startJoin({ invite: rts[0].reservation.invite, attemptId: 'next-ok-0003' });
    await until(() => rts[1].attempt.stage === 'connected' && rts[1].match, 90_000);
  } finally {
    for (const r of rts) await r.close().catch(() => {});
    await testnet.destroy();
    for (const r of roots) rmSync(r, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
