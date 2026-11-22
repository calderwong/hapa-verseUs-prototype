/**
 * Layered characteristic calculation (Master Requirements v3, Chapter 10 "Effect families and
 * ordering"): read the base value, apply value-setting effects, add or subtract modifiers, apply
 * multipliers, then apply declared limits and rounding. Within a stage, explicit dependencies come
 * first, then creation order, then stable effect ID. Never JavaScript object iteration order.
 *
 * Values are integers in the characteristic's own unit (protection: points). Multipliers are
 * exact integer ratios [num, den]; the result is floored at the limit stage.
 */
export const STAGES = /** @type {const} */ (['set', 'add', 'multiply', 'limit']);

/**
 * @typedef {{ id: string, stage: 'set'|'add'|'multiply'|'limit', value?: number, ratio?: [number, number],
 *   min?: number, max?: number, createdSeq?: number, dependsOn?: string[], source?: string, kind?: string, scope?: string }} Layer
 */

/** Stable order: stage, then dependencies within the stage, then creation order, then ID. */
export function orderLayers(layers) {
  const base = [...layers].sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage)
    || (a.createdSeq ?? 0) - (b.createdSeq ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const out = [];
  for (const stage of STAGES) {
    const pending = base.filter((l) => l.stage === stage);
    const done = new Set();
    while (pending.length) {
      const i = pending.findIndex((l) => (l.dependsOn ?? []).every((d) => done.has(d) || !pending.some((p) => p.id === d)));
      const next = pending.splice(i < 0 ? 0 : i, 1)[0]; // a dependency cycle falls back to stable order
      done.add(next.id);
      out.push(next);
    }
  }
  return out;
}

/**
 * @param {number} base
 * @param {Layer[]} layers
 * @returns {{ value: number, steps: { id: string, stage: string, before: number, after: number }[] }}
 */
export function layeredValue(base, layers) {
  let num = base, den = 1;
  const steps = [];
  for (const l of orderLayers(layers)) {
    const before = Math.floor(num / den);
    if (l.stage === 'set') { num = l.value ?? 0; den = 1; }
    else if (l.stage === 'add') num += (l.value ?? 0) * den;
    else if (l.stage === 'multiply') { const [n, d] = l.ratio ?? [1, 1]; num *= n; den *= d; }
    else if (l.stage === 'limit') {
      let v = Math.floor(num / den);
      if (l.min !== undefined) v = Math.max(l.min, v);
      if (l.max !== undefined) v = Math.min(l.max, v);
      num = v; den = 1;
    }
    steps.push({ id: l.id, stage: l.stage, before, after: Math.floor(num / den) });
  }
  return { value: Math.max(0, Math.floor(num / den)), steps };
}
