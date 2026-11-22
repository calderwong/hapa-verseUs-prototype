/**
 * Content adapter (Master Requirements v3 ch.11 "Creating decks and sharing content" and ch.16
 * "Proposed adapter · Content"): portable bundles of complete playable definitions, verified by
 * content hash; derivatives and revisions that keep creator lineage; generated rules wording.
 *
 * Local implementation: a bundle is canonical JSON a peer can send before play. The recipient
 * checks every definition's hash and that it can execute every required operation (unsupported
 * ones are named before play), then merges into a *new* local catalog — a running match keeps the
 * catalog object and fingerprint it agreed at setup. Cosmetic assets are references only; a
 * missing rendition uses the placeholder, missing behavior is an error.
 */
import { fingerprint, clone, canonicalize } from '../rules/encoding.js';
import { validateContent } from '../rules/validate.js';
import { COLORS } from '../rules/context.js';

export const BUNDLE_KIND = 'hapa-versus-content-bundle';
export const definitionHash = (def) => fingerprint(def);

/**
 * @param {any} catalog local catalog
 * @param {string[]} ids Card definition ids to include
 * @param {{ exporter: { id: string, kind: string, label?: string } }} o
 */
export function exportBundle(catalog, ids, { exporter }) {
  const defs = [...new Set(ids)].sort().map((id) => {
    const d = catalog.cards[id];
    if (!d) throw new Error(`no definition ${id} in the local catalog`);
    return d;
  });
  const operations = {};
  for (const d of defs) for (const op of d.operations ?? []) operations[op.type] = catalog.operations[op.type]?.version ?? 1;
  const definitions = defs.map((definition) => ({ hash: definitionHash(definition), definition }));
  return {
    schemaVersion: 1, kind: BUNDLE_KIND, exporter,
    operations, definitions,
    assets: defs.flatMap((d) => (d.assets ?? []).map((a) => ({ definition: d.id, ...a }))),
    bundleHash: fingerprint(definitions.map((e) => e.hash)),
  };
}

/** Serialize a bundle as canonical bytes (the same bytes on every machine). */
export const bundleText = (bundle) => canonicalize(bundle);

/**
 * Verify a received bundle against the local catalog. Never mutates `catalog`.
 * @returns {{ ok: boolean, errors: string[], catalog: any, received: any[] }}
 */
export function loadBundle(bundle, catalog, { receivedFrom = null } = {}) {
  const errors = [];
  if (bundle?.schemaVersion !== 1 || bundle?.kind !== BUNDLE_KIND) return { ok: false, errors: ['not a Hapa Versus content bundle'], catalog, received: [] };
  for (const [type, version] of Object.entries(bundle.operations ?? {})) {
    const local = catalog.operations?.[type];
    if (!local) errors.push(`unsupported operation "${type}" (v${version}): this client cannot execute it`);
    else if (local.version < version) errors.push(`operation "${type}" needs v${version}; this client has v${local.version}`);
  }
  const next = clone(catalog);
  const received = [];
  for (const { hash, definition } of bundle.definitions ?? []) {
    const id = definition?.id ?? '(no id)';
    if (definitionHash(definition) !== hash) { errors.push(`${id}: content hash mismatch (the definition bytes changed after export)`); continue; }
    for (const op of definition.operations ?? []) if (!catalog.operations?.[op.type] && !errors.some((e) => e.includes(`"${op.type}"`))) errors.push(`${id}: unsupported operation "${op.type}"`);
    if (definition.wording === 'generated' && definition.text !== generateWording(definition)) errors.push(`${id}: its wording does not match its operations`);
    const existing = next.cards[id];
    if (existing && definitionHash(existing) !== hash) {
      if ((definition.revision ?? 0) <= (existing.revision ?? 0)) { errors.push(`${id}: conflicts with local revision ${existing.revision} (same or newer revision, different bytes)`); continue; }
    }
    next.cards[id] = definition;
    received.push({ id, revision: definition.revision, hash, creator: definition.lineage?.creator?.id ?? null, parents: definition.lineage?.parents ?? [], receivedFrom });
  }
  const v = validateContent(next);
  if (!v.ok) errors.push(...v.errors);
  return errors.length ? { ok: false, errors, catalog, received: [] } : { ok: true, errors: [], catalog: next, received };
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/**
 * A derivative: a new definition identity by `contributor`, naming its parent and keeping the
 * original creator in its ancestry. The wording is regenerated from the operations.
 */
export function deriveDefinition(base, edits, contributor) {
  const parentRef = { id: base.id, revision: base.revision, hash: definitionHash(base), creator: base.lineage?.creator ?? null };
  const def = {
    ...clone(base), ...clone(edits),
    id: edits.id ?? `${slug(contributor.id)}.${slug(edits.title ?? base.title)}`,
    revision: 1,
    wording: 'generated',
    lineage: {
      creator: contributor,
      parents: [parentRef],
      original: base.lineage?.original ?? parentRef,
      sourceHapaCard: base.lineage?.sourceHapaCard ?? null,
    },
  };
  def.text = generateWording(def);
  return def;
}

/** A new revision of the same definition identity; the previous revision becomes its parent. */
export function reviseDefinition(def, edits, contributor) {
  const prev = { id: def.id, revision: def.revision, hash: definitionHash(def), creator: def.lineage?.creator ?? null };
  const next = { ...clone(def), ...clone(edits), id: def.id, revision: def.revision + 1, wording: 'generated' };
  next.lineage = { ...clone(def.lineage), contributor, parents: [prev] };
  next.text = generateWording(next);
  return next;
}

const COLOR = (c) => c[0].toUpperCase() + c.slice(1);
const costText = (mana) => {
  // a fixed color order, so canonical (sorted-key) bytes and authored bytes read the same
  const order = (c) => { const i = COLORS.indexOf(c); return i < 0 ? COLORS.length : i; };
  const parts = Object.entries(mana ?? {}).filter(([, n]) => n > 0).sort((a, b) => order(a[0]) - order(b[0]) || (a[0] < b[0] ? -1 : 1)).map(([c, n]) => `${n} ${COLOR(c)}`);
  return parts.length ? ` and pay ${parts.join(' and ')}` : '';
};

/** Player-facing rules text generated from a definition's executable fields. */
export function generateWording(def) {
  const op = def.operations?.[0] ?? {};
  const consume = def.cost?.consumeSourceInstance ? `Consume this card${costText(def.cost?.mana)}.` : `Pay${costText(def.cost?.mana).replace(' and pay', '')}.`;
  const response = def.timing === 'response' ? 'Response: ' : '';
  const actor = def.actor?.activeColumnRequired ? 'A friendly party in an active column' : 'Any friendly party';
  let body;
  switch (op.type) {
    case 'damage': {
      const where = def.target?.adjacentTerritories === 'eight_neighbors' ? 'in any of the eight adjacent territories' : 'in range';
      body = `${actor} deals ${op.hits === 1 ? 'one' : op.hits} ${op.power}-point ${COLOR(op.channel)} hit${op.hits === 1 ? '' : 's'} from the ${COLOR(op.incomingFace)} to one enemy member ${where}${def.target?.sameHeight ? ' at the same height' : ''}.`;
      break;
    }
    case 'counter': body = 'Counter one pending counterable Spell. Any friendly party may act as the source, even outside active columns; no range limit.'; break;
    case 'formation_immediate': body = `${actor} changes to one legal formation and facing immediately instead of taking a Tick. It cannot move members out of hostile contact.`; break;
    case 'place_row_enchantment': body = 'Place it in an empty friendly row slot beside an enemy-half Mana row. While present, contributions from that row to your newly minted cards are doubled.'; break;
    case 'protection_modifier': body = `While this Card remains, add ${op.amount} ${COLOR(op.channel)} Defense on ${Array.isArray(op.faces) ? op.faces.join(', ') : op.faces} for ${op.scope === 'bound_party' ? 'the Mount bound to its column' : 'friendly parties whose center is in its column'}.`; break;
    default: body = (def.operations ?? []).map((o) => `Performs ${o.type.replace(/_/g, ' ')}.`).join(' ') || 'No ability: Supply or Mana only.';
  }
  return `${response}${consume} ${body}${def.counterable ? ' Counterable.' : ''}`.replace(/\s+/g, ' ').trim();
}
