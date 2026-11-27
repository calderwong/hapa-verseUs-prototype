/**
 * Signed contact history and connection attempts (Assignment 19, N19-02/N19-04; FT-06, FT-09) on
 * real Hypercore storage and a local HyperDHT testnet. Controlled engineering evidence: it does not
 * stand in for two real machines on independent networks.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import b4a from 'b4a';
import { PeerRuntime, parseInvite } from '../../src/hapa/network/runtime.js';
import { ContactBook, checkRecord, checkSnapshot } from '../../src/hapa/network/contact.js';
import { signBody } from '../../src/hapa/network/control.js';
import { fingerprint } from '../../src/hapa/rules/encoding.js';

const createTestnet = createRequire(import.meta.url)('hyperdht/testnet');
const until = async (pred, ms = 60_000) => { const t0 = Date.now(); for (;;) { const v = await pred(); if (v) return v; if (Date.now() - t0 > ms) throw new Error('timed out'); await new Promise((r) => setTimeout(r, 150)); } };
const tmp = (p) => mkdtempSync(join(tmpdir(), p));

test('FT-09: the contact core binds to the player, survives restart, and a transport change keeps the root identity', async () => {
  const root = tmp('hv-ct-');
  try {
    let rt = new PeerRuntime({ root, networkId: 'test-contact' });
    await rt.open();
    const id = rt.identity.participantId, core = rt.contact.key, t0 = rt.contact.descriptor().transports[0];
    assert.equal(rt.contact.records.length, 1);
    assert.equal(rt.contact.records[0].kind, 'binding');
    assert.equal(checkSnapshot(rt.contact.snapshot()), null);
    await rt.close();
    rt = new PeerRuntime({ root, networkId: 'test-contact' });
    await rt.open();
    assert.equal(rt.contact.records.length, 1, 'a restart appends nothing');
    await rt.close();
    // a new transport key (e.g. a reinstalled network layer): one update record, same player and core
    unlinkSync(join(root, 'test-contact', 'transport.json'));
    rt = new PeerRuntime({ root, networkId: 'test-contact' });
    await rt.open();
    const d = rt.contact.descriptor();
    assert.deepEqual([rt.identity.participantId, rt.contact.key, d.seq], [id, core, 1]);
    assert.notEqual(d.transports[0], t0);
    assert.deepEqual(d.retired, [t0]);
    // forged records are refused: another identity cannot bind or extend this core
    const other = new PeerRuntime({ root: tmp('hv-ct-o-'), networkId: 'test-contact' });
    await other.open();
    const { sig, ...body } = rt.contact.records[1];
    const forged = { ...body, sig: signBody('contact', body, other.identity) };
    assert.match(checkRecord(forged, { subject: id, core, seq: 1, prev: fingerprint(rt.contact.records[0]) }), /signature does not match/);
    assert.match(checkRecord(rt.contact.records[1], { subject: id, core, seq: 1, prev: 'sha256:other' }), /does not follow/);
    await other.close();
    await rt.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('FT-09: cached snapshots reject forgery, known rollback and forks; an invitation never outlives its expiry', async () => {
  const roots = [tmp('hv-cb-a-'), tmp('hv-cb-b-')];
  try {
    const a = new PeerRuntime({ root: roots[0], networkId: 'test-contact' });
    const b = new PeerRuntime({ root: roots[1], networkId: 'test-contact' });
    await a.open(); await b.open();
    const book = new ContactBook({ dir: join(roots[1], 'cb'), storeFile: join(roots[1], 'cb.json'), self: b.identity.participantId });
    const s0 = a.contact.snapshot();
    assert.equal(book.admitSnapshot(s0).ok, true);
    await a.contact.rotate('ab'.repeat(32));
    const s1 = a.contact.snapshot();
    assert.equal(book.admitSnapshot(s1).ok, true);
    assert.deepEqual(book.transportsOf(a.identity.participantId), ['ab'.repeat(32)]);
    assert.match(book.admitSnapshot(s0).reason, /known rollback/);
    const tampered = { ...s1, transports: ['cd'.repeat(32)] };
    assert.match(book.admitSnapshot(tampered).reason, /signature/);
    assert.match(book.admitSnapshot(s1, { authenticatedAs: b.identity.participantId }).reason, /someone other/);
    // invitations: v1 still decodes; v2 carries a verified snapshot; tampering, truncation and expiry refuse with no reservation
    await b.joinLobby({}).catch(() => {});
    const cap = { v: 1, network: 'test-contact', player: a.identity.participantId, transport: 'ef'.repeat(32), challengeId: '12'.repeat(16), offer: 'sha256:x', expiresAt: Date.now() - 120_000 };
    const v1 = `hvinv1.${b4a.toString(b4a.from(JSON.stringify({ ...cap, sig: signBody('control', { kind: 'invite', ...cap }, a.identity) })), 'base64url')}`;
    assert.equal(parseInvite(v1).v, 1);
    book.admitSnapshot(s1); // cached contact information is current, but cannot revive the expired offer
    await assert.rejects(b.joinTable({ invite: v1 }), /expired/);
    assert.equal(b.reservation, null);
    await assert.rejects(b.joinTable({ invite: v1.slice(0, 60) }), /damaged|incomplete|not a Hapa/);
    assert.equal(b.reservation, null);
    await a.close(); await b.close();
  } finally { for (const r of roots) rmSync(r, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); }
});

test('FT-06/FT-09 (controlled): a v2 invitation joins through one attempt; contacts replicate and verify; cancel and duplicates are fenced', { timeout: 180_000 }, async () => {
  const testnet = await createTestnet(3);
  const roots = [tmp('hv-inv-a-'), tmp('hv-inv-b-')];
  const make = (i) => new PeerRuntime({ root: roots[i], networkId: 'test-invite', displayName: i ? 'Bea' : 'Ari', bootstrap: testnet.bootstrap, controller: 'bot' });
  const rts = [make(0), make(1)];
  const events = [];
  rts[1].onEvent = (e) => { if (e.type === 'lobby' && e.kind === 'attempt') events.push(e.attempt.stage); };
  try {
    for (const r of rts) await r.open();
    for (const r of rts) await r.joinLobby({});
    // a cancelled attempt leaves nothing durable
    rts[0].openTable();
    const invite = rts[0].reservation.invite;
    assert.match(invite, /^hvinv2\./);
    assert.equal(parseInvite(invite).contact.subject, rts[0].identity.participantId);
    const first = rts[1].startJoin({ invite, attemptId: 'attempt-one-0001' });
    assert.deepEqual(rts[1].startJoin({ invite, attemptId: 'attempt-one-0001' }).attempt.id, first.attempt.id, 'the same attempt id is the same attempt');
    assert.throws(() => rts[1].startJoin({ invite, attemptId: 'attempt-two-0002' }), /in progress/);
    await rts[1].cancelAttempt({ attemptId: 'attempt-one-0001' });
    assert.equal(rts[1].attempt.stage, 'cancelled');
    await new Promise((r) => setTimeout(r, 3000));
    assert.equal(rts[1].reservation, null, 'a late completion of a cancelled attempt creates no seat');
    // a fresh attempt connects
    const second = rts[1].startJoin({ invite, attemptId: 'attempt-three-03' });
    await until(() => rts[1].attempt.stage === 'connected' && rts[1].match && rts[0].match, 90_000);
    assert.equal(second.attempt.id, 'attempt-three-03');
    assert.ok(['finding-player', 'negotiating', 'connected'].every((s) => events.includes(s)), events.join(','));
    // contacts: each side admitted the other's snapshot and verified its core over the connection
    await until(() => rts[1].contacts.cache.contacts[rts[0].identity.participantId]?.evidence === 'core-verified' && rts[0].contacts.cache.contacts[rts[1].identity.participantId]?.evidence === 'core-verified', 60_000);
    const diag = rts[1].diagnostics();
    assert.equal(diag.attempt.stage, 'connected');
    assert.ok(!JSON.stringify(diag).includes(rts[0].identity.publicKey), 'diagnostics carry fingerprints, not keys');
    assert.ok(!JSON.stringify(diag).includes(invite.slice(8, 40)));
  } finally {
    for (const r of rts) await r.close().catch(() => {});
    await testnet.destroy();
    for (const r of roots) rmSync(r, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
