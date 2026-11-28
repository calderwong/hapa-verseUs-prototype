/**
 * The local Avatar roster (Addendum 11 / Assignment 21 — dependency-ready slice).
 *
 * Every entry is a small binding to identities resolved from the owners' own records; nothing is
 * invented from a name:
 *  - Red (`red-reaper`): Harbor serves the `red-pose-art` package (revision 2026-11-02.1, built from the
 *    Mesh Avatar pin a6fc511) — a 2D mesh over pose art. The supported default.
 *  - Falka (`avatar-8`), alias **Mimi**: Avatar Builder's echo cast registry lists "Mimi" among Falka's
 *    user-authorized aliases; Mesh Avatar package `falka-human-assisted` 2026-11-17.1, renderer
 *    `human-connected-forward-mesh-r1`, status candidate.
 *  - Leo / The Dig-Lamp (`avatar-46`, a dog): Mesh Avatar package `leo-canine-assisted` 2026-11-17.1,
 *    renderer `canine-forward-mesh-r1`, status candidate.
 *  Falka, Leo and Thor are served by Mesh Avatar's own player node (`/apps/player/falka|leo|thor/`, read-only,
 *  loopback 8860), forwarded to the game as `/mesh/apps/player/…`; the package file the owner serves
 *  is checked against these ids and revisions before the figure is seated (mesh-frame.js renders it).
 *  - Thor / The Oranginal (`avatar-39`, a cat): Mesh Avatar package `thor-feline-assisted` 2026-11-17.1,
 *    renderer `feline-forward-mesh-r1`, status candidate.
 *
 * Three separate controls, kept separate: **In my roster** (a local preference; new entries start
 * off, Red on), **Play this game** (one choice for the bot seat of a new local match — an Avatar whose
 * figure an owner actually serves and that is in the roster, or explicitly no figure), and **Available
 * online** (an explicit host opt-in — not supported yet, so shown disabled). Every way of choosing goes
 * through `selectAvatar`, and setup, reopen and Start reconcile a stored choice with `resolveChoice`
 * (Review 22 V22-02 / N24-02), so a selected entry always satisfies the roster policy. Two seats, one
 * authority per seat; the moves come from the declared controller (the heuristic bot), never from the
 * figure.
 */
export const ROSTER = [
  { id: 'red-reaper', label: 'Red', aliases: [], species: 'human', owner: 'Harbor', package: { id: 'red-pose-art', revision: '2026-11-02.1', source: 'Mesh Avatar pin a6fc511' }, renderer: '2D mesh over pose art', served: 'harbor', music: 'red', voice: true, defaultOn: true },
  { id: 'avatar-8', label: 'Falka', aliases: ['Mimi'], aliasSource: 'Avatar Builder echo cast registry (user-authorized aliases)', species: 'human', owner: 'Mesh Avatar', package: { id: 'falka-human-assisted', revision: '2026-11-17.1', file: 'falka-package.json' }, renderer: '2D forward mesh (human-connected-forward-mesh-r1), candidate', served: 'mesh', player: 'falka' },
  { id: 'avatar-46', label: 'Leo / The Dig-Lamp', aliases: [], species: 'dog', owner: 'Mesh Avatar', package: { id: 'leo-canine-assisted', revision: '2026-11-17.1', file: 'leo-package.json' }, renderer: '2D forward mesh (canine-forward-mesh-r1), candidate', served: 'mesh', player: 'leo' },
  { id: 'avatar-39', label: 'Thor / The Oranginal', aliases: [], species: 'cat', owner: 'Mesh Avatar', package: { id: 'thor-feline-assisted', revision: '2026-11-17.1', file: 'thor-package.json' }, renderer: '2D forward mesh (feline-forward-mesh-r1), candidate', served: 'mesh', player: 'thor' },
];

const KEY = 'hapa-versus.roster.v1';

/** Local roster preferences: which entries are in my roster (never game state, never shared). */
export function loadRoster() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}').enabled ?? {}; } catch { /* storage unavailable */ }
  return Object.fromEntries(ROSTER.map((e) => [e.id, typeof saved[e.id] === 'boolean' ? saved[e.id] : !!e.defaultOn]));
}
export function saveRoster(enabled) { try { localStorage.setItem(KEY, JSON.stringify({ enabled })); } catch { /* storage unavailable */ } }

/**
 * Whether an entry can be chosen for a game now, and why not. Only a figure an owner actually serves
 * qualifies; identity alone does not.
 * @returns {{ ok: boolean, why?: string }}
 */
export function playable(entry, enabled) {
  if (!entry.served) return { ok: false, why: `${entry.owner} has ${entry.label}'s package (${entry.package.id} ${entry.package.revision}), but no owner serves it to Versus yet` };
  if (!enabled[entry.id]) return { ok: false, why: 'turn on "In my roster" first' };
  return { ok: true };
}

/** The one selection operation for the bot seat's figure. `null` = explicitly no figure. */
export function selectAvatar(id, enabled) {
  if (id == null) return { ok: true, avatarId: null };
  const entry = ROSTER.find((e) => e.id === id);
  if (!entry) return { ok: false, avatarId: null, why: `no Avatar "${id}" in the roster` };
  const can = playable(entry, enabled);
  return can.ok ? { ok: true, avatarId: id } : { ok: false, avatarId: null, why: `${entry.label}: ${can.why}` };
}

/**
 * Reconcile a stored or handed-in choice with the roster (setup, reopen, Start). An ineligible choice
 * becomes "no figure" with the reason — never another figure, never a silent substitution.
 * @returns {{ avatarId: string|null, changed: boolean, why?: string }}
 */
export function resolveChoice(table, enabled) {
  const r = selectAvatar(table?.avatarId ?? null, enabled);
  return r.ok ? { avatarId: r.avatarId, changed: false } : { avatarId: null, changed: true, why: r.why };
}

/**
 * What the bot seat's figure brings to the table's sound, from its roster entry (Review 23 V23-02):
 * `music` names the Avatar's own music library (only Red's exists), `voice` whether its owner offers a
 * voice. No figure brings neither. Used for the table's music sources and the setup wording alike.
 * @returns {{ music: string|null, voice: boolean, name: string|null }}
 */
export function soundOf(id) {
  const e = entryOf(id);
  return { music: e?.music ?? null, voice: !!e?.voice, name: e ? shortName(id) : null };
}

/** The roster entry for an Avatar id (or undefined). */
export const entryOf = (id) => ROSTER.find((e) => e.id === id);
/** A short name for speech and the nameplate: "Leo / The Dig-Lamp" → "Leo". */
export const shortName = (id) => (entryOf(id)?.label ?? 'Opponent').split(' / ')[0];

/** Short status for a roster row; the package/renderer/revision detail lives in its Details disclosure. */
export function statusOf(entry, enabled) {
  if (!entry.served) return 'not served to Versus yet';
  return enabled[entry.id] ? `ready (figure from ${entry.owner})` : 'not in your roster';
}
