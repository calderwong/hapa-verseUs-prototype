/**
 * Signed control messages (p2p-matchmaking-v1 §6–7, §12): HELLO authentication, challenges and the
 * jointly signed session descriptor. Each kind has its own signing domain, separate from match
 * records (`HAPA-VERSUS MESSAGE v1`), so a signature can never be replayed across kinds.
 */
import crypto from 'hypercore-crypto';
import b4a from 'b4a';
import { canonicalize, utf8, parseStrict } from '../rules/encoding.js';

export const DOMAINS = {
  hello: 'HAPA-VERSUS HELLO v1\n',
  control: 'HAPA-VERSUS CONTROL v1\n',
  session: 'HAPA-VERSUS SESSION v1\n',
  result: 'HAPA-VERSUS RESULT v1\n',
  profile: 'HAPA-VERSUS PROFILE v1\n',
};
export const MAX_FRAME = 64 * 1024;
export const MAX_START_FRAME = 2 * 1024 * 1024;

const bytes = (domain, body) => b4a.from(utf8(DOMAINS[domain] + canonicalize(body)));

/** Sign a body under a domain with an identity's secret key; returns lowercase hex. */
export function signBody(domain, body, identity) {
  return b4a.toString(crypto.sign(bytes(domain, body), b4a.from(identity.secretKey, 'hex')), 'hex');
}

/** Verify a detached signature under a domain against a hex public key. */
export function verifyBody(domain, body, signature, publicKeyHex) {
  if (typeof signature !== 'string' || !/^[0-9a-f]{128}$/.test(signature)) return false;
  if (typeof publicKeyHex !== 'string' || !/^[0-9a-f]{64}$/.test(publicKeyHex)) return false;
  try { return crypto.verify(bytes(domain, body), b4a.from(signature, 'hex'), b4a.from(publicKeyHex, 'hex')); } catch { return false; }
}

/** The public key of a canonical player id (`hv1:<hex>`), or null. */
export function keyOfPlayer(playerId) {
  const m = typeof playerId === 'string' && playerId.match(/^hv1:([0-9a-f]{64})$/);
  return m ? m[1] : null;
}

/** Encode one control frame (canonical JSON), refusing oversize frames before sending. */
export function encodeFrame(msg, max = MAX_FRAME) {
  const s = canonicalize(msg);
  if (s.length > max) throw new Error(`control frame of ${s.length} bytes exceeds ${max}`);
  return b4a.from(s);
}

/** Decode one received control frame with strict canonical parsing and a size bound. */
export function decodeFrame(buf, max = MAX_START_FRAME) {
  if (!buf || buf.byteLength > max) throw new Error('oversize control frame');
  const msg = parseStrict(b4a.toString(buf));
  if (!msg || typeof msg !== 'object' || Array.isArray(msg) || typeof msg.t !== 'string') throw new Error('malformed control frame');
  return msg;
}

export const randomHex = (n) => b4a.toString(crypto.randomBytes(n), 'hex');
