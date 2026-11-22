/**
 * Signed application records (Master Requirements v3 Appendix B "Shared encoding identity and
 * fingerprints"). The signed bytes are the UTF-8 prefix `HAPA-VERSUS MESSAGE v1\n` followed by
 * the canonical body; the detached Ed25519 signature is lowercase hex outside the body. A valid
 * signature does not make an illegal move legal: the rules still validate the payload.
 *
 * Node-only (hypercore-crypto / sodium). Fixture identities are local development identities, not
 * verified Hapa DIDs.
 */
import crypto from 'hypercore-crypto';
import b4a from 'b4a';
import { canonicalize, utf8 } from '../rules/encoding.js';

const PREFIX = 'HAPA-VERSUS MESSAGE v1\n';
const BODY_FIELDS = ['schemaVersion', 'type', 'matchId', 'authorId', 'signingKeyId', 'authorSequence', 'count', 'phaseId', 'priorStateHash', 'payload'];

/** A local development identity (fresh Ed25519 key pair from secure randomness). */
export function createDevIdentity(label) {
  const kp = crypto.keyPair();
  const publicKey = b4a.toString(kp.publicKey, 'hex');
  return {
    participantId: `dev:${label}:${publicKey.slice(0, 16)}`,
    identityKind: 'local_development_identity',
    label,
    signingKeyId: `ed25519:${publicKey}`,
    publicKey,
    secretKey: b4a.toString(kp.secretKey, 'hex'),
  };
}

/** Public part of an identity (what the other peer and the manifest see). */
export const publicIdentity = (id) => ({ participantId: id.participantId, identityKind: id.identityKind, label: id.label, signingKeyId: id.signingKeyId, publicKey: id.publicKey });

const signingBytes = (body) => utf8(PREFIX + canonicalize(body));

/** Build and sign a record. */
export function signRecord(identity, fields) {
  const body = { schemaVersion: 1, authorId: identity.participantId, signingKeyId: identity.signingKeyId, ...fields };
  for (const f of BODY_FIELDS) if (body[f] === undefined) throw new Error(`record missing ${f}`);
  const sig = crypto.sign(b4a.from(signingBytes(body)), b4a.from(identity.secretKey, 'hex'));
  return { body, signature: b4a.toString(sig, 'hex') };
}

/** Verify identity binding and signature; returns the body or throws. */
export function verifyRecord(record, expected) {
  const { body, signature } = record;
  if (!body || typeof signature !== 'string' || !/^[0-9a-f]{128}$/.test(signature)) throw new Error('malformed record');
  if (body.authorId !== expected.participantId || body.signingKeyId !== expected.signingKeyId) throw new Error('identity binding mismatch');
  const ok = crypto.verify(b4a.from(signingBytes(body)), b4a.from(signature, 'hex'), b4a.from(expected.publicKey, 'hex'));
  if (!ok) throw new Error('bad signature');
  return body;
}
