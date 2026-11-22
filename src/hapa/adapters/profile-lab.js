/**
 * Rules and experiment lab (Master Requirements v3 ch.12 "Rules and experiment panel", ch.14
 * "Use one base starting profile and derive alternatives by changing named fields"): edit a copy
 * of a profile field by field (each with a description, units and legal values), get a new
 * revision with a stable id and content fingerprint, compare any two profiles, and run a batch
 * of bot matches. A match records the exact revision it used; it never picks up a later edit.
 */
import { fingerprint, clone } from '../rules/encoding.js';
import { validateProfile } from '../rules/validate.js';
import { createSession, playMatch, verifyReplay } from '../rules/session.js';
import { summarize } from '../rules/stats.js';
import { HeuristicBot } from '../controllers/heuristic-bot.js';

/** Editable fields: meaning, units and legal values. */
export const PROFILE_FIELDS = [
  { path: 'combat.protection', label: 'Protection aggregation', kind: 'enum', values: ['individual', 'line'], description: 'individual: each recipient uses its own shields; line: eligible shields on the attacked line are summed once and apply to every hit on it.' },
  { path: 'combat.allocation', label: 'Allocation authority', kind: 'enum', values: ['attacker', 'defender'], description: 'Who assigns hits that are not fixed by direct melee contact.' },
  { path: 'combat.health', label: 'Health representation', kind: 'enum', values: ['member', 'party_pool'], description: 'member: each member has its own HP; party_pool: one pool per party with maintenance removals.' },
  { path: 'combat.charge.enabled', label: 'Charge impact', kind: 'bool', description: 'The first exchange of an approaching party multiplies charge-capable attacks by its actual approach Speed.' },
  { path: 'combat.pike.transfer', label: 'Pike transfer', kind: 'bool', description: 'A stationary entrenched Pikeman facing a charge takes the charger\'s multiplier for its own impact.' },
  { path: 'combat.cornerSupport.enabled', label: 'Corner helpers', kind: 'bool', description: 'A neighbour\'s corner member may step into the contact strip to help (zero time and Supply).' },
  { path: 'combat.ranged.baseRange', label: 'Ranged base range', kind: 'int', min: 1, max: 4, units: 'board steps (Chebyshev)', description: 'Range of a level ranged volley before elevation adjustments.' },
  { path: 'combat.maintenance.centerReserve', label: 'Pool center reserve', kind: 'int', min: 0, max: 12, units: 'HP', description: 'Party-pool HP kept for the center before any retainer is maintained.' },
  { path: 'combat.maintenance.retainerRequirement', label: 'Pool HP per retainer', kind: 'int', min: 1, max: 9, units: 'HP', description: 'Pool HP needed to keep each retainer above the center reserve.' },
  { path: 'movement.speeds.knight', label: 'Knight Speed', kind: 'ratio', units: 'steps per Tick (num/den)', description: 'Board steps a Knight crosses per Tick; also its charge multiplier.' },
  { path: 'movement.knightRouteCost', label: 'Knight route cost', kind: 'int', min: 1, max: 6, units: 'Supply', description: 'Supply a Knight needs for one L route.' },
  { path: 'movement.turnTicks', label: 'Turn / rearrangement time', kind: 'int', min: 1, max: 3, units: 'Ticks', description: 'How long an ordinary facing or formation change takes.' },
  { path: 'movement.uphillSpeed', label: 'Uphill Speed multiplier', kind: 'ratio', units: 'ratio', description: 'Multiplier on Speed (and Supply per quantum) while climbing a ramp.' },
];

const get = (o, path) => path.split('.').reduce((v, k) => (v == null ? v : v[k]), o);
const set = (o, path, value) => { const ks = path.split('.'); const last = ks.pop(); ks.reduce((v, k) => (v[k] ??= {}), o)[last] = value; };

/** Field-level legality (before the whole-profile validator). */
export function fieldError(field, value) {
  switch (field.kind) {
    case 'enum': return field.values.includes(value) ? null : `${field.label}: "${value}" is not one of ${field.values.join(', ')}`;
    case 'bool': return typeof value === 'boolean' ? null : `${field.label}: must be true or false`;
    case 'int': return Number.isInteger(value) && value >= field.min && value <= field.max ? null : `${field.label}: an integer ${field.min}–${field.max}`;
    case 'ratio': return Array.isArray(value) && value.length === 2 && value.every((n) => Number.isInteger(n) && n > 0) ? null : `${field.label}: two positive integers`;
    default: return null;
  }
}

/** Every leaf path whose value differs between two profiles (stable order). */
export function profileDiff(a, b) {
  const out = [];
  const walk = (x, y, path) => {
    const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
    if (isObj(x) && isObj(y)) {
      for (const k of [...new Set([...Object.keys(x), ...Object.keys(y)])].sort()) walk(x[k], y[k], path ? `${path}.${k}` : k);
      return;
    }
    if (fingerprint(x ?? null) !== fingerprint(y ?? null)) out.push({ path, from: x ?? null, to: y ?? null });
  };
  walk(a, b, '');
  return out.filter((d) => !['id', 'title', 'revisionOf', 'changes'].includes(d.path));
}

/**
 * A new profile revision from `base` with `edits` ({ path: value }). Deterministic: the same base
 * and edits give the same id and fingerprint.
 * @returns {{ ok: boolean, errors: string[], profile?: any, fingerprint?: string, diff?: any[] }}
 */
export function editProfile(base, edits, { title, catalog } = {}) {
  const errors = [];
  const next = clone(base);
  for (const [path, value] of Object.entries(edits)) {
    const field = PROFILE_FIELDS.find((f) => f.path === path);
    if (!field) { errors.push(`${path} is not an editable field`); continue; }
    const e = fieldError(field, value);
    if (e) errors.push(e); else set(next, path, clone(value));
  }
  const diff = profileDiff(base, next);
  if (!diff.length) errors.push('no field changed');
  if (errors.length) return { ok: false, errors };
  const baseFp = fingerprint(base);
  next.revisionOf = { id: base.id, fingerprint: baseFp };
  next.changes = diff.map((d) => d.path);
  delete next.id; delete next.title;
  const fp = fingerprint(next);
  next.id = `${base.id}~${fp.slice(7, 15)}`;
  next.title = title ?? `${base.title ?? base.id} — ${diff.map((d) => `${d.path.split('.').pop()} ${JSON.stringify(d.to)}`).join(', ')}`;
  const v = validateProfile(next, catalog);
  if (!v.ok) return { ok: false, errors: v.errors };
  return { ok: true, errors: [], profile: next, fingerprint: fingerprint(next), diff };
}

/**
 * Run one bot-vs-bot match of a batch (seats alternate by seed) and summarize it.
 * @returns {{ seed: number, outcome: any, tick: number, summary: any, replay: any, replayVerified: boolean }}
 */
export function runBatchMatch(profile, catalog, seed, ticks) {
  const swap = seed % 2 === 0;
  const session = createSession({ matchId: `lab-${profile.id}-${seed}`, profile, catalog, seed,
    controllers: { A: { type: 'bot', revision: 'heuristic-bot/0.1.0' }, B: { type: 'bot', revision: 'heuristic-bot/0.1.0' } } });
  const bots = { A: new HeuristicBot({ seat: 'A', seed: seed * 2 + (swap ? 2 : 1) }), B: new HeuristicBot({ seat: 'B', seed: seed * 2 + (swap ? 1 : 2) }) };
  const outcome = playMatch(session, bots, { tickBudget: ticks });
  const replayVerified = verifyReplay(JSON.parse(JSON.stringify(session.replay))).ok;
  return { seed, outcome, tick: session.state.tick, summary: summarize(session.events, session.state), replay: session.replay, replayVerified };
}

/** Aggregate batch rows by outcome. */
export function batchSummary(rows) {
  const won = rows.filter((r) => r.outcome.result === 'win');
  const mean = (a) => (a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : null);
  return {
    runs: rows.length, winsA: won.filter((r) => r.outcome.winner === 'A').length, winsB: won.filter((r) => r.outcome.winner === 'B').length,
    draws: rows.filter((r) => r.outcome.result === 'draw').length, unfinished: rows.filter((r) => r.outcome.result === 'unfinished').length,
    meanOutcomeTick: mean(won.map((r) => r.outcome.tick)), meanFirstContact: mean(rows.map((r) => r.summary.firstEngagementTick).filter(Boolean)),
    casualties: { A: rows.reduce((n, r) => n + r.summary.casualties.A, 0), B: rows.reduce((n, r) => n + r.summary.casualties.B, 0) },
    allReplaysVerified: rows.every((r) => r.replayVerified),
  };
}
