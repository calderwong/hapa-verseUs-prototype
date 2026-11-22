/**
 * The local content catalog of this browser (HV-39): the bundled catalog plus Cards this viewer
 * authored or received, and the deck bindings chosen for the next match. Kept in localStorage as a
 * per-viewer convenience; a bundle export is the durable, shareable form. Every read tolerates a
 * blocked or empty storage and falls back to the bundled content.
 */
import { CATALOG } from '../../../fixtures/hapa/content.js';
import { clone } from '../rules/encoding.js';
import { validateContent } from '../rules/validate.js';

const KEY = 'hapa-versus.local-content.v1';

/** The viewer's development identity as a Card creator (never a verified Hapa DID). */
export const LOCAL_CREATOR = { id: 'dev:local-viewer', kind: 'local_development_identity', label: 'You (local development identity)' };

export function readStore() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (v && typeof v === 'object') return { cards: v.cards ?? {}, received: v.received ?? [], decks: v.decks ?? null };
  } catch { /* storage unavailable */ }
  return { cards: {}, received: [], decks: null };
}

export function writeStore(store) {
  try { localStorage.setItem(KEY, JSON.stringify(store)); return true; } catch { return false; }
}

/** Bundled catalog + stored Cards; a stored Card that no longer validates is left out. */
export function localCatalog() {
  const cat = clone(CATALOG);
  for (const [id, def] of Object.entries(readStore().cards)) {
    const trial = clone(cat);
    trial.cards[id] = def;
    if (validateContent(trial).ok) cat.cards[id] = def;
  }
  return cat;
}

/** Deck bindings for the next match, or undefined (profile defaults). */
export function localDecks(profile) {
  const d = readStore().decks;
  if (!d) return undefined;
  const cat = localCatalog();
  const seat = (s) => {
    const bindings = { ...profile.cards.bindings };
    for (const [lc, id] of Object.entries(d[s]?.bindings ?? {})) if (cat.cards[id]) bindings[lc] = id;
    return { majors: profile.cards.majors, bindings };
  };
  return { A: seat('A'), B: seat('B') };
}
