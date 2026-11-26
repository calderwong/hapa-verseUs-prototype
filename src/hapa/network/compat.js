/**
 * What two peers must share to play (p2p-matchmaking-v1 §7): the online wrapper version, the
 * bundled default preset (profile, catalog, decks) and the exact rules implementation. Presentation
 * files, art and docs are outside the fingerprint, so a UI-only change never blocks play; any change
 * to the rules or the bundled content does.
 *
 * Node-only: the implementation fingerprint hashes the shipped rule sources (inside ASAR in the
 * packaged app, from the checkout otherwise).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { createManifest, initializeMatch, stateFingerprint } from '../rules/state.js';
import { fingerprint } from '../rules/encoding.js';
import { profileById, DEFAULT_PROFILE_ID } from '../../../fixtures/hapa/profiles.js';
import { CATALOG } from '../../../fixtures/hapa/content.js';

/** v2: terminal attestations bind authenticated feed prefixes (review 16, R16-01). v1 peers are incompatible. */
export const ONLINE_PROTOCOL = 'hapa-versus-online/v2';
export const LOBBY_PROTOCOL = 'hapa-versus-lobby/v1';

const HERE = dirname(fileURLToPath(import.meta.url));
const RULES_DIR = join(HERE, '..', 'rules');
const CONTENT_FILES = [join(HERE, '..', '..', '..', 'fixtures', 'hapa', 'profiles.js'), join(HERE, '..', '..', '..', 'fixtures', 'hapa', 'content.js')];

let implCache = null;
/** sha256 over the rule sources and bundled content files, in sorted name order. */
export function rulesImplementation() {
  if (implCache) return implCache;
  const h = createHash('sha256');
  const files = readdirSync(RULES_DIR).filter((f) => f.endsWith('.js')).sort().map((f) => join(RULES_DIR, f)).concat(CONTENT_FILES);
  for (const f of files) { h.update(f.slice(f.lastIndexOf('hapa'))); h.update('\0'); h.update(readFileSync(f)); h.update('\0'); }
  implCache = `sha256:${h.digest('hex')}`;
  return implCache;
}

/** The single bundled preset of public alpha. */
export function bundledPreset() {
  const profile = profileById(DEFAULT_PROFILE_ID);
  return { profileId: profile.id, rulesVersion: profile.rulesVersion, profileFingerprint: fingerprint(profile), catalogFingerprint: fingerprint(CATALOG) };
}

/** The compatibility identity peers compare before a challenge (exact match required). */
export function compatibility() {
  const p = bundledPreset();
  const c = { online: ONLINE_PROTOCOL, protocol: 'public_protocol_v1', profileId: p.profileId, rulesVersion: p.rulesVersion, profileFingerprint: p.profileFingerprint, catalogFingerprint: p.catalogFingerprint, rulesImplementation: rulesImplementation() };
  return { ...c, id: fingerprint(c) };
}

/**
 * Build the match manifest from the bundled preset (the coordinator's job; seat A = challenger).
 * @param {{ matchId: string, seed: number, players: { A: any, B: any }, controllers: { A: any, B: any } }} o
 */
export function presetManifest(o) {
  const profile = profileById(DEFAULT_PROFILE_ID);
  return createManifest({ matchId: o.matchId, profile, catalog: CATALOG, seed: o.seed, participants: o.players, controllers: o.controllers });
}

/** Does a received manifest use exactly this peer's bundled preset and the agreed players? */
export function manifestError(manifest, expect) {
  const p = bundledPreset();
  if (!manifest || typeof manifest !== 'object') return 'no manifest';
  if (manifest.protocol !== 'public_protocol_v1') return `unsupported protocol ${manifest.protocol}`;
  if (manifest.matchId !== expect.matchId) return 'manifest is for another match';
  if (fingerprint(manifest.profile) !== p.profileFingerprint || manifest.profileFingerprint !== p.profileFingerprint) return 'manifest profile differs from the bundled preset';
  if (fingerprint(manifest.catalog) !== p.catalogFingerprint || manifest.catalogFingerprint !== p.catalogFingerprint) return 'manifest catalog differs from the bundled preset';
  const decks = { majors: manifest.profile.cards.majors, bindings: manifest.profile.cards.bindings };
  for (const s of ['A', 'B']) if (fingerprint(manifest.decks?.[s]) !== fingerprint(decks)) return `seat ${s} deck differs from the bundled preset`;
  for (const s of ['A', 'B']) {
    const m = manifest.participants?.[s], e = expect.players[s];
    if (!m || m.participantId !== e.participantId || m.publicKey !== e.publicKey || m.signingKeyId !== e.signingKeyId) return `seat ${s} participant differs from the agreed player`;
  }
  if (!Number.isSafeInteger(manifest.randomStream?.seed) || manifest.randomStream.algorithm !== 'xorshift32_v1') return 'unsupported random stream';
  return null;
}

export const initialStateHash = (manifest) => stateFingerprint(initializeMatch(manifest));
