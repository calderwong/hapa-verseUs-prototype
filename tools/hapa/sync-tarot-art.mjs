#!/usr/bin/env node
/**
 * Optional card-art sync (HV-29): link Minor Arcana faces from the Hapa Tarot Deck owned by Hapa
 * Avatar Builder into this checkout's ignored `public/renditions/` folder. Read-only on the
 * owner's store; media stays with its owner (links, not copies, unless a face is an inline data
 * URI). Rules never depend on art: a missing face falls back to the procedural placeholder.
 *
 *   npm run art:sync -- [--store path/to/tarot-store.json] [--deck hapa-tarot] [--copy]
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, symlinkSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join, extname, resolve } from 'node:path';
import { homedir } from 'node:os';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const DEFAULT_STORE = join(homedir(), 'Documents/Codex/2026-06-10/files-mentioned-by-the-user-screenshot/outputs/hapa-avatar-builder/data/tarot-store.json');
const storePath = resolve(arg('store', process.env.HAPA_TAROT_STORE ?? DEFAULT_STORE));
const deckId = arg('deck', 'hapa-tarot');
const copy = process.argv.includes('--copy');
const out = resolve('public/renditions');

if (!existsSync(storePath)) {
  console.log(JSON.stringify({ ok: false, reason: `no tarot store at ${storePath}; the game uses procedural placeholders` }, null, 1));
  process.exit(0);
}
const store = JSON.parse(readFileSync(storePath, 'utf8'));
const deck = store.decks.find((d) => d.id === deckId);
if (!deck) throw new Error(`deck ${deckId} not found in ${storePath}`);
const byId = new Map(store.cards.map((c) => [c.id, c]));
const RANKS = ['ace', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const SUITS = ['wands', 'cups', 'swords', 'pentacles'];
const mediaRoot = join(dirname(storePath), 'media');

/** Local file behind a card face URI, or null. */
function sourceOf(uri) {
  if (!uri) return null;
  if (uri.startsWith('/media/')) return join(mediaRoot, decodeURIComponent(uri.slice('/media/'.length)));
  if (uri.startsWith('/api/local-file?')) return new URLSearchParams(uri.split('?')[1]).get('path');
  return null;
}

rmSync(join(out, 'tarot'), { recursive: true, force: true });
mkdirSync(join(out, 'tarot'), { recursive: true });
const entries = {};
const skipped = [];
for (const id of deck.cardIds) {
  const c = byId.get(id);
  if (!c) continue;
  const m = /^\s*(\w+)\s+of\.?\s+(\w+)\s*$/i.exec(c.title.replace(/\s+/g, ' '));
  if (!m) continue;
  const rank = RANKS.indexOf(m[1].toLowerCase()) + 1;
  const suit = m[2].toLowerCase();
  if (rank < 1 || !SUITS.includes(suit)) continue; // court cards have no rank in this profile
  const key = `${suit}-${rank}`;
  if (entries[key]) continue; // the deck's first face for a rank and suit
  const uri = c.asset?.uri ?? '';
  const file = `tarot/${key}${extname(sourceOf(uri) ?? '') || '.png'}`;
  if (uri.startsWith('data:image/')) {
    const [head, body] = uri.split(',');
    const ext = head.includes('svg') ? '.svg' : head.includes('jpeg') ? '.jpg' : '.png';
    const data = head.includes(';base64') ? Buffer.from(body, 'base64') : Buffer.from(decodeURIComponent(body));
    writeFileSync(join(out, `tarot/${key}${ext}`), data);
    entries[key] = { suit, rank, file: `tarot/${key}${ext}`, sourceCardId: c.id, title: c.title };
    continue;
  }
  const src = sourceOf(uri);
  if (!src || !existsSync(src)) { skipped.push({ key, title: c.title, reason: src ? 'face file missing' : 'no local face' }); continue; }
  (copy ? copyFileSync : symlinkSync)(src, join(out, file));
  entries[key] = { suit, rank, file, sourceCardId: c.id, title: c.title };
}
const index = {
  schemaVersion: 1, kind: 'hapa-versus-renditions',
  source: { owner: 'hapa-avatar-builder', deck: deck.title, deckId, store: 'tarot-store.json (read-only)' },
  note: 'Local presentation only: faces stay with their owner and this folder is ignored by git. Gameplay never reads it.',
  entries,
};
writeFileSync(join(out, 'index.json'), JSON.stringify(index, null, 1));
console.log(JSON.stringify({ ok: true, deck: deck.title, linked: Object.keys(entries).length, of: 40, missing: SUITS.flatMap((s) => RANKS.map((_, i) => `${s}-${i + 1}`)).filter((k) => !entries[k]), skipped, mode: copy ? 'copy' : 'symlink' }, null, 1));
