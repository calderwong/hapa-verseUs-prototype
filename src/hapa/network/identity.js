/**
 * Persistent player identity (p2p-matchmaking-v1 §5). One Ed25519 signer per data root, created
 * once from secure randomness and reopened on every launch; never reset to repair an install.
 * The full public key is the durable player id; UI shows a short fingerprint.
 *
 * The secret key stays in this Node process. Nothing here is sent to the renderer.
 */
import crypto from 'hypercore-crypto';
import b4a from 'b4a';
import { readJson, writeJsonAtomic } from './store.js';

export const IDENTITY_KIND = 'hapa_versus_player_key_v1';

/** Canonical player id for a hex public key. */
export const playerIdOf = (publicKeyHex) => `hv1:${publicKeyHex}`;
export const fingerprintOf = (publicKeyHex) => `${publicKeyHex.slice(0, 4)}-${publicKeyHex.slice(4, 8)}-${publicKeyHex.slice(8, 12)}`;

/**
 * @param {{ path: (...p: string[]) => string }} store
 * @param {{ displayName?: string }} [o]
 */
export function openIdentity(store, o = {}) {
  const file = store.path('identity.json');
  let id = readJson(file);
  let created = false;
  if (!id) {
    const kp = crypto.keyPair();
    const publicKey = b4a.toString(kp.publicKey, 'hex');
    id = {
      identityKind: IDENTITY_KIND,
      participantId: playerIdOf(publicKey),
      signingKeyId: `ed25519:${publicKey}`,
      publicKey,
      secretKey: b4a.toString(kp.secretKey, 'hex'),
      label: sanitizeName(o.displayName) || `Player ${publicKey.slice(0, 4)}`,
      createdAt: new Date().toISOString(),
    };
    writeJsonAtomic(file, id);
    created = true;
  }
  if (id.identityKind !== IDENTITY_KIND || id.participantId !== playerIdOf(id.publicKey)) throw new Error('the stored player identity is not a supported Hapa Versus key');
  return { identity: id, created };
}

/** The public part (what peers, manifests and the renderer see). */
export const publicPlayer = (id) => ({ participantId: id.participantId, identityKind: id.identityKind, label: id.label, signingKeyId: id.signingKeyId, publicKey: id.publicKey });

/** Display names are plain text: trimmed, control characters removed, bounded. */
export function sanitizeName(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, '').trim().slice(0, 32);
}

export function renameIdentity(store, id, name) {
  const label = sanitizeName(name);
  if (!label) throw new Error('a display name needs at least one visible character');
  id.label = label;
  writeJsonAtomic(store.path('identity.json'), id);
  return label;
}
