/**
 * Signed contact history (Assignment 19, N19-04; friend-test-and-resilient-connectivity-v1 §6).
 *
 * Values kept distinct: the player/root key (`hv1:<key>`, the authority), the contact-core key (the
 * authenticated history to retrieve), the core's discovery key (a topic, not a verification key),
 * the transport key (a dialable native endpoint the player authorizes) and providers (replaceable).
 *
 * The contact core is one persistent single-writer Hypercore in native storage. Every record is
 * canonical JSON signed by the root key under the dedicated `contact` domain: the first record binds
 * the core to the player; each later one carries `seq` and the hash of the previous record. The
 * current descriptor (eligible transports, retired ones, record sources) is a projection of that
 * verified history. A transport-key change appends a record; the `hv1` identity never changes.
 *
 * A snapshot is a compact root-signed statement of the current descriptor plus the core length it
 * was taken at. It authorizes its content and gives an initial dial path (it travels inside a v2
 * invitation). It is NOT proof that the referenced core checkpoint was fetched and verified: those
 * evidence states are recorded separately (`snapshot` vs `core-verified`). Freshness is "last
 * verified here"; nothing here can know about a revocation it has not seen. Contact freshness never
 * extends an invitation, challenge or reservation, whose own expiry still decides.
 *
 * Cached knowledge of other players rejects forged bindings, a known rollback (an older sequence or
 * a shorter verified core) and unexpected forks (same sequence, different content; a rewritten core).
 */
import Hypercore from 'hypercore';
import b4a from 'b4a';
import { join } from 'node:path';
import { signBody, verifyBody, keyOfPlayer } from './control.js';
import { fingerprint } from '../rules/encoding.js';
import { readJson, writeJsonAtomic } from './store.js';
import { fingerprintOf } from './identity.js';

export const CONTACT_SCHEMA = 'hapa-versus-contact/v1';
export const SNAPSHOT_SCHEMA = 'hapa-versus-contact-snapshot/v1';
const MAX_TRANSPORTS = 4, MAX_RECORDS = 512, MAX_CACHED = 256;
const hex64 = (v) => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);

/** Verify one contact record against its subject and position (no chain context). */
export function checkRecord(rec, { subject, core, seq, prev }) {
  if (!rec || rec.schema !== CONTACT_SCHEMA) return 'not a contact record';
  const { sig, ...body } = rec;
  const pk = keyOfPlayer(body.subject);
  if (!pk || body.subject !== subject) return 'the record names another player';
  if (body.core !== core) return 'the record is bound to another contact core';
  if (body.seq !== seq) return `unexpected sequence ${body.seq} (expected ${seq})`;
  if ((body.prev ?? null) !== (prev ?? null)) return 'the record does not follow the previous one';
  if (body.kind !== (seq === 0 ? 'binding' : 'update')) return 'the first record must bind the core';
  if (!Array.isArray(body.transports) || !body.transports.length || body.transports.length > MAX_TRANSPORTS || !body.transports.every(hex64)) return 'bad transports';
  if (!Array.isArray(body.retired ?? []) || !(body.retired ?? []).every(hex64)) return 'bad retired list';
  if (!verifyBody('contact', body, sig, pk)) return 'the record signature does not match its player';
  return null;
}

/** Verify a snapshot capsule (signature and bounds); returns an error string or null. */
export function checkSnapshot(s) {
  if (!s || s.schema !== SNAPSHOT_SCHEMA) return 'not a contact snapshot';
  const { sig, ...body } = s;
  const pk = keyOfPlayer(body.subject);
  if (!pk) return 'bad subject';
  if (!hex64(body.core) || !Number.isSafeInteger(body.seq) || body.seq < 0 || !Number.isSafeInteger(body.length) || body.length < 1) return 'incomplete snapshot';
  if (!Array.isArray(body.transports) || !body.transports.length || body.transports.length > MAX_TRANSPORTS || !body.transports.every(hex64)) return 'bad transports';
  if (!verifyBody('contact', { kind: 'snapshot', ...body }, sig, pk)) return 'the snapshot signature does not match its player';
  return null;
}

/** This player's own contact core (single writer). */
export class OwnContact {
  /** @param {{ dir: string, identity: any, transport: string, log?: (s: string) => void }} o */
  constructor(o) { this.o = o; this.log = o.log ?? (() => {}); }

  async open() {
    this.core = new Hypercore(this.o.dir, { valueEncoding: 'json' });
    await this.core.ready();
    this.key = b4a.toString(this.core.key, 'hex');
    const subject = this.o.identity.participantId;
    this.records = [];
    let prev = null;
    for (let i = 0; i < Math.min(this.core.length, MAX_RECORDS); i++) {
      const rec = await this.core.get(i);
      const err = checkRecord(rec, { subject, core: this.key, seq: i, prev });
      if (err) throw new Error(`own contact history refused at ${i}: ${err}`);
      this.records.push(rec);
      prev = fingerprint(rec);
    }
    const cur = this.records.at(-1);
    if (!cur) await this._append({ kind: 'binding', transports: [this.o.transport], retired: [] });
    else if (!cur.transports.includes(this.o.transport)) await this._append({ kind: 'update', transports: [this.o.transport], retired: [...new Set([...(cur.retired ?? []), ...cur.transports])].slice(-8) });
    return this;
  }

  async _append(part) {
    const prev = this.records.at(-1);
    const body = { schema: CONTACT_SCHEMA, subject: this.o.identity.participantId, core: this.key, seq: this.records.length, prev: prev ? fingerprint(prev) : null, at: new Date().toISOString(), sources: ['peer-replication'], ...part };
    const rec = { ...body, sig: signBody('contact', body, this.o.identity) };
    await this.core.append(rec);
    this.records.push(rec);
  }

  /** Rotate to a new transport key: the player identity stays; the old key is retired. */
  async rotate(transport) { const cur = this.records.at(-1); if (cur.transports.includes(transport)) return; await this._append({ kind: 'update', transports: [transport], retired: [...new Set([...(cur.retired ?? []), ...cur.transports])].slice(-8) }); }

  descriptor() { const cur = this.records.at(-1); return { subject: cur.subject, core: this.key, seq: cur.seq, transports: cur.transports, retired: cur.retired ?? [] }; }

  /** A compact root-signed snapshot of the current descriptor (for invitations and the HELLO exchange). */
  snapshot() {
    const d = this.descriptor();
    const body = { schema: SNAPSHOT_SCHEMA, subject: d.subject, core: d.core, seq: d.seq, length: this.core.length, transports: d.transports, at: new Date().toISOString() };
    return { ...body, sig: signBody('contact', { kind: 'snapshot', ...body }, this.o.identity) };
  }

  async close() { await this.core?.close(); }
}

/**
 * Verified knowledge of other players' contact information: snapshots and core checkpoints, cached
 * in userData (a cache of verified public records; the authority is each player's own core).
 */
export class ContactBook {
  /** @param {{ dir: string, storeFile: string, self: string, log?: (s: string) => void }} o */
  constructor(o) { this.o = o; this.log = o.log ?? (() => {}); this.cache = readJson(o.storeFile, { contacts: {} }); this.cores = new Map(); this.rejected = []; }

  _save() {
    const ids = Object.keys(this.cache.contacts);
    if (ids.length > MAX_CACHED) for (const id of ids.sort((a, b) => (this.cache.contacts[a].lastVerified ?? '').localeCompare(this.cache.contacts[b].lastVerified ?? '')).slice(0, ids.length - MAX_CACHED)) delete this.cache.contacts[id];
    writeJsonAtomic(this.o.storeFile, this.cache);
  }
  _reject(subject, reason) { this.rejected.push({ subject: fingerprintOf(keyOfPlayer(subject) ?? ''), reason, at: new Date().toISOString() }); if (this.rejected.length > 20) this.rejected.shift(); return { ok: false, reason }; }

  /**
   * Admit a signed snapshot (from an invitation or an authenticated peer). A newer sequence replaces
   * the cached one; an older one is a known rollback; the same sequence with other content is a fork.
   */
  admitSnapshot(s, { source = 'invitation', authenticatedAs = null } = {}) {
    const err = checkSnapshot(s);
    if (err) return this._reject(s?.subject, err);
    if (s.subject === this.o.self) return { ok: false, reason: 'own snapshot' };
    if (authenticatedAs && authenticatedAs !== s.subject) return this._reject(s.subject, 'the snapshot names someone other than the authenticated player');
    const c = this.cache.contacts[s.subject];
    if (c) {
      if (c.core !== s.core) return this._reject(s.subject, 'a different contact core for this player (unexpected fork)');
      if (s.seq < c.seq) return this._reject(s.subject, `known rollback: sequence ${s.seq} is older than ${c.seq}`);
      if (s.seq === c.seq && fingerprint(s.transports) !== fingerprint(c.transports)) return this._reject(s.subject, 'same sequence with different content (fork)');
      if (c.checkpoint && s.length < c.checkpoint.length && s.seq <= c.seq) return this._reject(s.subject, 'shorter than the verified core');
    }
    const retired = new Set(c?.retired ?? []);
    this.cache.contacts[s.subject] = { core: s.core, seq: s.seq, transports: s.transports.filter((t) => !retired.has(t) || s.seq > (c?.seq ?? -1)), retired: c?.retired ?? [], snapshot: s, checkpoint: c?.checkpoint ?? null, evidence: c?.checkpoint ? c.evidence : 'snapshot', source, lastVerified: new Date().toISOString() };
    this._save();
    return { ok: true };
  }

  /** Transports cached for a player (verified records only; retired keys excluded). */
  transportsOf(subject) { const c = this.cache.contacts[subject]; return c ? c.transports.filter((t) => !(c.retired ?? []).includes(t)) : []; }

  /**
   * Replicate a known player's contact core over an authenticated connection and verify it: the
   * binding names that core and player, every record is signed in sequence, and the core never moves
   * below the verified checkpoint or changes fork. Only then is the checkpoint advanced.
   */
  async follow(subject, conn) {
    const c = this.cache.contacts[subject];
    if (this.closed) return;
    if (!c || this.cores.has(subject)) { if (this.cores.has(subject)) this.cores.get(subject).replicate(conn); return; }
    const core = new Hypercore(join(this.o.dir, subject.slice(4, 20)), b4a.from(c.core, 'hex'), { valueEncoding: 'json' });
    await core.ready();
    if (this.closed) { await core.close(); return; }
    this.cores.set(subject, core);
    core.replicate(conn);
    core.on('truncate', (len, fork) => { const cc = this.cache.contacts[subject]; if (cc?.checkpoint && len < cc.checkpoint.length) { this._reject(subject, `contact core rewritten below the verified checkpoint (fork ${fork})`); cc.conflict = { len, fork, at: new Date().toISOString() }; this._save(); } });
    const verify = () => this.verifyCore(subject).catch((e) => this.log(`contact verify: ${e.message}`));
    core.on('append', verify);
    await core.update({ wait: false }).catch(() => {});
    verify();
  }

  async verifyCore(subject) {
    const core = this.cores.get(subject), c = this.cache.contacts[subject];
    if (!core || !c || !core.length) return null;
    if (c.checkpoint && (core.length < c.checkpoint.length || (c.checkpoint.fork !== undefined && core.fork !== c.checkpoint.fork))) return this._reject(subject, 'the contact core moved below its verified checkpoint or changed fork');
    let prev = null, last = null;
    const n = Math.min(core.length, MAX_RECORDS);
    for (let i = 0; i < n; i++) {
      const rec = await core.get(i, { timeout: 5000 }).catch(() => null);
      if (!rec) return null; // not yet replicated: keep the previous evidence state
      const err = checkRecord(rec, { subject, core: c.core, seq: i, prev });
      if (err) return this._reject(subject, `contact record ${i}: ${err}`);
      prev = fingerprint(rec); last = rec;
    }
    if (last.seq < c.seq) return this._reject(subject, 'the verified core is older than an accepted snapshot (rollback)');
    Object.assign(c, { seq: last.seq, transports: last.transports, retired: last.retired ?? [], checkpoint: { length: n, fork: core.fork, head: prev }, evidence: 'core-verified', lastVerified: new Date().toISOString() });
    this._save();
    return { ok: true, length: n };
  }

  /** Redacted view for diagnostics. */
  summary() { return { known: Object.keys(this.cache.contacts).length, coreVerified: Object.values(this.cache.contacts).filter((c) => c.evidence === 'core-verified').length, rejected: this.rejected.slice(-5) }; }

  async close() { this.closed = true; for (const c of this.cores.values()) await c.close().catch(() => {}); this.cores.clear(); }
}
