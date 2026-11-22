/**
 * Card renditions (HV-29; Master Requirements v3 ch.11 and ch.17 "presentation adapter"). An
 * optional, local-only art index written by `npm run art:sync` into the ignored
 * `public/renditions/` folder. Faces are looked up by Minor Arcana suit and rank; a card without a
 * face uses the procedural placeholder. Gameplay never reads this module.
 */
const loaded = { index: null, images: new Map() };

/** Load the index and preload its faces (bounded wait); safe when nothing was synced. */
export async function loadRenditions(base = import.meta.env?.BASE_URL ?? '/') {
  if (loaded.index) return loaded.index;
  try {
    const res = await fetch(`${base}renditions/index.json`, { cache: 'no-store' });
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) throw new Error('no renditions');
    loaded.index = await res.json();
  } catch {
    loaded.index = { entries: {}, source: null };
    return loaded.index;
  }
  const waits = Object.entries(loaded.index.entries).map(([key, e]) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { loaded.images.set(key, img); resolve(); };
    img.onerror = () => resolve(); // a missing face falls back to the placeholder
    img.src = `${base}renditions/${e.file}`;
  }));
  await Promise.race([Promise.all(waits), new Promise((r) => setTimeout(r, 2500))]);
  return loaded.index;
}

/** The rendition of a card, or null (placeholder). */
export function renditionFor(card) {
  if (!card || card.category === 'major' || !card.suit || !card.rank) return null;
  const key = `${card.suit}-${card.rank}`;
  const e = loaded.index?.entries?.[key];
  const img = loaded.images.get(key);
  if (!e || !img) return null;
  return { key, img, url: img.src, title: e.title, sourceCardId: e.sourceCardId, deck: loaded.index.source?.deck ?? 'local deck', owner: loaded.index.source?.owner ?? null };
}

/** Cover-fit an image into a rectangle of a 2D context. */
export function drawCover(g, img, x, y, w, h) {
  const r = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / r, sh = h / r;
  g.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}
