/**
 * Profile and content validation (Master Requirements v3, Chapters 10, 11 and 14).
 *
 * The validator checks completeness and consistency, never strategic quality: it rejects unknown
 * policies, missing operations, duplicate IDs, negative movement costs and impossible slots, and
 * accepts any legal values even when they may prove unbalanced.
 */

const ENUMS = {
  'combat.protection': ['individual', 'line'],
  'combat.allocation': ['attacker', 'defender'],
  'combat.health': ['member', 'party_pool'],
  'cards.responseProcedure': ['public_stack_v1'],
  'banks.replacement': ['replace_on_mint'],
  'actions.firstAction': ['A_on_odd_ticks'],
  'visibility': ['public'],
};
/**
 * Policies a profile may name; absence means the v3 behavior (old manifests carry no such field and
 * must replay unchanged). An unknown value is rejected rather than silently treated as legacy.
 */
const OPTIONAL_ENUMS = {
  'movement.destinationFunding': ['partial_supply_v3', 'full_route_funded_v1'],
  'movement.debit': ['step_cost_per_pitch_v3', 'route_price_v1'],
};
const MOUNTS = ['castle', 'bishop', 'queen', 'king', 'commander', 'knight'];
const ROLES = ['swordsman', 'pikeman', 'archer', 'mage', 'priest'];

const get = (o, path) => path.split('.').reduce((v, k) => (v == null ? v : v[k]), o);
const isRatio = (r) => Array.isArray(r) && r.length === 2 && r.every(Number.isSafeInteger) && r[1] > 0;

/**
 * @param {any} p expanded profile
 * @param {any} catalog content catalog
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateProfile(p, catalog) {
  const errors = [];
  const err = (m) => errors.push(m);
  if (p?.schemaVersion !== 1) err('schemaVersion must be 1');
  if (typeof p?.id !== 'string' || !p.id) err('profile id required');
  for (const [path, allowed] of Object.entries(ENUMS)) {
    const v = get(p, path);
    if (!allowed.includes(v)) err(`unknown ${path} policy "${v}" (supported: ${allowed.join(', ')})`);
  }
  for (const [path, allowed] of Object.entries(OPTIONAL_ENUMS)) {
    const v = get(p, path);
    if (v !== undefined && !allowed.includes(v)) err(`unknown ${path} policy "${v}" (supported: ${allowed.join(', ')})`);
  }
  const b = p.board ?? {};
  if (b.columns !== 9) err('board.columns must be 9 in this rules version');
  if (![9, 10, 11].includes(b.rows)) err(`board.rows ${b.rows} unsupported (9, 10 or 11)`);
  for (const r of [...(b.manaRows ?? []), ...(b.dualRows ?? [])]) if (!Number.isInteger(r) || r < 1 || r > b.rows) err(`Mana row ${r} is off the board`);
  if (!Array.isArray(b.columnMap) || b.columnMap.length !== 9) err('board.columnMap needs nine columns');
  else for (const c of b.columnMap) if (!MOUNTS.includes(c.mount)) err(`column ${c.column}: unknown mount "${c.mount}"`);
  if (!(b.rankCap >= 1)) err('board.rankCap must be at least 1');
  const act = p.clock?.activation;
  if (!Array.isArray(act) || !act.length) err('clock.activation required');
  else for (const cols of act) for (const c of cols) if (!(c >= 1 && c <= 9)) err(`activation names column ${c}`);
  const mv = p.movement ?? {};
  for (const m of MOUNTS) {
    if (!isRatio(mv.speeds?.[m])) err(`movement.speeds.${m} must be a [num, den] ratio`);
    else if (mv.speeds[m][0] < 0) err(`movement.speeds.${m} is negative`);
  }
  if (!(mv.stepCost >= 0)) err('negative ordinary movement cost');
  if (!(mv.knightRouteCost >= 0)) err('negative Knight route cost');
  const g = p.geometry ?? {};
  if (!(Number.isSafeInteger(g.scale) && g.scale > 0)) err('geometry.scale must be a positive safe integer');
  if (!(Number.isSafeInteger(g.quantaPerTick) && g.quantaPerTick > 0)) err('geometry.quantaPerTick must be positive');
  if (g.pitch !== g.territoryWidth + g.contactGap) err('geometry.pitch must equal territoryWidth + contactGap');
  for (const kind of ['pawn', 'mount']) {
    const slots = p.roster?.[kind]?.slots ?? {};
    for (const [slot, role] of Object.entries(slots)) {
      const n = Number(slot);
      if (!(n >= 1 && n <= 9) || n === 5) err(`roster.${kind}: impossible slot ${slot}`);
      if (!ROLES.includes(role)) err(`roster.${kind}: unknown role "${role}"`);
    }
  }
  const m = p.combat?.maintenance ?? {};
  if (!(m.centerReserve >= 0 && m.retainerRequirement > 0)) err('combat.maintenance needs centerReserve ≥ 0 and retainerRequirement > 0');
  for (const [col, def] of Object.entries(p.cards?.bindings ?? {})) {
    if (!catalog?.cards?.[def]) err(`cards.bindings[${col}] names missing definition "${def}"`);
  }
  if (!catalog?.cards?.[p.cards?.fallback]) err(`cards.fallback names missing definition "${p.cards?.fallback}"`);
  for (const [col, def] of Object.entries(p.cards?.majors ?? {})) if (!catalog?.cards?.[def]) err(`cards.majors[${col}] names missing definition "${def}"`);
  if (catalog) {
    const recipe = p.terrain?.recipe;
    if (!recipe?.id || !recipe.output || !recipe.inputs) err('terrain.recipe needs id, inputs and output');
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Content validation: every Card uses only installed operations, has its targeting fields and a
 * creator; IDs are unique. Unsupported operations are named before play.
 * @param {any} catalog
 */
export function validateContent(catalog) {
  const errors = [];
  const seen = new Set();
  const ops = catalog.operations ?? {};
  for (const group of ['archetypes', 'cards', 'items']) {
    for (const [key, def] of Object.entries(catalog[group] ?? {})) {
      if (seen.has(def.id)) errors.push(`duplicate definition id ${def.id}`);
      seen.add(def.id);
      if (!def.lineage?.creator?.id) errors.push(`${def.id}: missing creator`);
      if (group === 'cards') {
        if (key !== def.id) errors.push(`${def.id}: catalog key "${key}" differs from its id`);
        for (const op of def.operations ?? []) {
          if (!ops[op.type]) errors.push(`${def.id}: unsupported operation "${op.type}"`);
        }
        if (def.category === 'spell' && !def.target) errors.push(`${def.id}: a Spell needs a target selector`);
        if (def.cost?.mana) for (const [c, n] of Object.entries(def.cost.mana)) if (!(Number.isInteger(n) && n >= 0)) errors.push(`${def.id}: bad ${c} cost`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}
