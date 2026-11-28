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
 *  - Thor / The Oranginal (`avatar-39`, a cat): Mesh Avatar package `thor-feline-assisted` 2026-11-17.1,
 *    renderer `feline-forward-mesh-r1`, status candidate.
 *
 * Three separate controls, kept separate: **Use in my roster** (a local preference; new entries start
 * off, Red on), **Play this game** (one Avatar for the bot seat of a new local match; only entries whose
 * figure an owner actually serves can be chosen), and **Available online** (an explicit host opt-in —
 * not supported yet, so shown disabled). Two seats, one authority per seat; the moves come from the
 * declared controller (the heuristic bot), never from the figure.
 */
export const ROSTER = [
  { id: 'red-reaper', label: 'Red', aliases: [], species: 'human', owner: 'Harbor', package: { id: 'red-pose-art', revision: '2026-11-02.1', source: 'Mesh Avatar pin a6fc511' }, renderer: '2D mesh over pose art', served: 'harbor', defaultOn: true },
  { id: 'avatar-8', label: 'Falka', aliases: ['Mimi'], aliasSource: 'Avatar Builder echo cast registry (user-authorized aliases)', species: 'human', owner: 'Mesh Avatar', package: { id: 'falka-human-assisted', revision: '2026-11-17.1' }, renderer: '2D forward mesh (human-connected-forward-mesh-r1), candidate', served: null },
  { id: 'avatar-46', label: 'Leo / The Dig-Lamp', aliases: [], species: 'dog', owner: 'Mesh Avatar', package: { id: 'leo-canine-assisted', revision: '2026-11-17.1' }, renderer: '2D forward mesh (canine-forward-mesh-r1), candidate', served: null },
  { id: 'avatar-39', label: 'Thor / The Oranginal', aliases: [], species: 'cat', owner: 'Mesh Avatar', package: { id: 'thor-feline-assisted', revision: '2026-11-17.1' }, renderer: '2D forward mesh (feline-forward-mesh-r1), candidate', served: null },
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
  if (!enabled[entry.id]) return { ok: false, why: 'turn on "Use in my roster" first' };
  return { ok: true };
}
