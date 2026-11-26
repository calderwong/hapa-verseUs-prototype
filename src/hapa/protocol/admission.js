/**
 * Remote match-record admission (Assignment 16 finding 5; p2p-matchmaking-v1 §8 "Record admission
 * and feed integrity"). Every record read from an opponent's feed passes here before it reaches an
 * agreement, a resolver or a queue: exact schema and type, this match, the agreed author and key,
 * the feed position as its sequence, a plausible Tick, bounded payload, then the signature.
 *
 * A valid signature does not make a move legal; the rules still validate the commands.
 */
import { verifyRecord } from './messages.js';
import { canonicalize, fingerprint } from '../rules/encoding.js';

export const RECORD_TYPES = ['plan', 'ready', 'choice', 'receipt', 'closing'];
export const MAX_RECORD_BYTES = 64 * 1024;
const FIELDS = ['schemaVersion', 'type', 'matchId', 'authorId', 'signingKeyId', 'authorSequence', 'count', 'phaseId', 'priorStateHash', 'payload'];

/**
 * @param {any} rec the stored record `{ body, signature }`
 * @param {{ matchId: string, author: any, index: number, maxCount: number }} expect
 * @returns {{ ok: true, body: any, digest: string } | { ok: false, error: string }}
 */
export function admitRecord(rec, expect) {
  try {
    if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return no('not a record');
    const keys = Object.keys(rec);
    if (keys.length !== 2 || !('body' in rec) || !('signature' in rec)) return no('unexpected record envelope');
    const b = rec.body;
    if (!b || typeof b !== 'object' || Array.isArray(b)) return no('no body');
    const extra = Object.keys(b).filter((k) => !FIELDS.includes(k));
    if (extra.length) return no(`unexpected fields ${extra.join(',')}`);
    if (b.schemaVersion !== 1) return no(`unsupported schema ${b.schemaVersion}`);
    if (!RECORD_TYPES.includes(b.type)) return no(`unknown record type ${String(b.type).slice(0, 24)}`);
    if (b.matchId !== expect.matchId) return no('record for another match');
    if (b.authorSequence !== expect.index + 1) return no(`sequence ${b.authorSequence} at feed position ${expect.index}`);
    if (!Number.isSafeInteger(b.count) || b.count < 1 || b.count > expect.maxCount) return no(`implausible Tick ${b.count}`);
    if (typeof b.phaseId !== 'string' || b.phaseId.length > 64) return no('bad phase');
    if (typeof b.priorStateHash !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(b.priorStateHash)) return no('bad prior state hash');
    if (!b.payload || typeof b.payload !== 'object' || Array.isArray(b.payload)) return no('bad payload');
    const size = canonicalize(rec.body).length;
    if (size > MAX_RECORD_BYTES) return no(`record of ${size} bytes exceeds ${MAX_RECORD_BYTES}`);
    const shape = payloadError(b);
    if (shape) return no(shape);
    verifyRecord(rec, expect.author); // identity binding and signature
    return { ok: true, body: b, digest: fingerprint(rec) };
  } catch (e) {
    return no(e.message);
  }
}

function payloadError(b) {
  const p = b.payload;
  switch (b.type) {
    case 'plan': return Number.isSafeInteger(p.planRevision) && p.planRevision > 0 && Array.isArray(p.commands) && p.commands.length <= 64 ? null : 'bad plan payload';
    case 'ready': return Number.isSafeInteger(p.planRevision) && typeof p.planHash === 'string' ? null : 'bad ready payload';
    case 'choice': return typeof p.choiceId === 'string' && Number.isSafeInteger(p.choiceIndex) && p.answer && typeof p.answer === 'object' && typeof p.requestHash === 'string' ? null : 'bad choice payload';
    case 'receipt': return typeof p.stateHash === 'string' && p.lockedPair && typeof p.lockedPair === 'object' ? null : 'bad receipt payload';
    case 'closing': {
      if (typeof p.finalHash !== 'string') return 'bad closing payload';
      if (p.v === undefined) return null; // online v1 closing (legacy records keep their meaning)
      const okPrefix = (x) => x && /^[0-9a-f]{64}$/.test(x.key ?? '') && Number.isSafeInteger(x.fork) && x.fork >= 0 && Number.isSafeInteger(x.length) && x.length >= 1 && /^[0-9a-f]{64}$/.test(x.root ?? '');
      return p.v === 2 && typeof p.descriptorHash === 'string' && p.prefixes && okPrefix(p.prefixes.A) && okPrefix(p.prefixes.B) ? null : 'bad terminal attestation';
    }
    default: return 'unknown type';
  }
}

const no = (error) => ({ ok: false, error });
