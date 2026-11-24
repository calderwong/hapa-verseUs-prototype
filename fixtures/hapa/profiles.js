/**
 * Match profiles (Master Requirements v3, Chapter 14 and Appendix A).
 *
 * `hapa_open_10x9_v3_01` is the complete starting experiment: every value below is an editable
 * engineering fixture, not an approved balance choice. Variants change only named fields (see
 * `PROFILE_VARIANTS`); a match stores the fully expanded profile and its fingerprint.
 *
 * Units: positions, Supply and HP are integers at `geometry.scale` (1,000,000 per member width,
 * Supply point and HP); Speeds and multipliers are [numerator, denominator] ratios.
 */

/** Columns from A's side (B uses the same order in its own local view). */
export const COLUMN_MAP = Object.freeze([
  { column: 1, colorA: 'red', colorB: 'green', suit: 'wands', mount: 'castle' },
  { column: 2, colorA: 'purple', colorB: 'yellow', suit: 'pentacles', mount: 'knight' },
  { column: 3, colorA: 'blue', colorB: 'orange', suit: 'cups', mount: 'bishop' },
  { column: 4, colorA: 'black', colorB: 'white', suit: 'swords', mount: 'king' },
  { column: 5, colorA: 'rainbow', colorB: 'rainbow', suit: 'wildcard', mount: 'commander' },
  { column: 6, colorA: 'white', colorB: 'black', suit: 'swords', mount: 'queen' },
  { column: 7, colorA: 'orange', colorB: 'blue', suit: 'cups', mount: 'bishop' },
  { column: 8, colorA: 'yellow', colorB: 'purple', suit: 'pentacles', mount: 'knight' },
  { column: 9, colorA: 'green', colorB: 'red', suit: 'wands', mount: 'castle' },
]);

export const BASE_PROFILE = Object.freeze({
  schemaVersion: 1,
  id: 'hapa_open_10x9_v3_01',
  revision: 1,
  title: 'Open 10×9, public information, v3 fixture 01',
  rulesVersion: 'hapa-versus-rules/0.1.0',
  visibility: 'public',
  board: {
    columns: 9,
    rows: 10,
    mountRow: 1, // home-relative deployment rows
    pawnRow: 2,
    capitalColumn: 5, // local
    columnMap: COLUMN_MAP,
    /** global rows whose territory contributes Mana (deployment rows 1, 2, 9, 10 contribute zero) */
    manaRows: [3, 4, 5, 6, 7, 8],
    /** global rows contributing one of each paired color (none on the ten-row field) */
    dualRows: [],
    /** global rows ≤ this use the A-side color; higher rows the B-side color (dual rows both) */
    geographyBoundary: 5,
    rankCap: 10,
  },
  banks: { majorSlots: 9, minorSlots: 9, rowSlots: 10, replacement: 'replace_on_mint' },
  clock: {
    activation: [[1, 9], [2, 8], [3, 7], [4, 6], [5], [4, 6], [3, 7], [2, 8], [1, 9]],
    prologueTicks: 4,
    roundLength: 9,
  },
  resources: {
    generationLimit: 1,
    supplyCurve: 'rank',
    manaPerRow: 1,
    poolCarryover: false,
    supplySpendOrder: 'oldest_first',
    paymentPolicy: 'rainbow_only_then_exact_then_rainbow',
  },
  actions: {
    firstAction: 'A_on_odd_ticks',
    commandEligibility: 'party_center_column_at_planning',
    supplyTargets: 'any_owned_party_any_state',
  },
  geometry: {
    scale: 1000000,
    quantaPerTick: 1000,
    memberWidth: 1,
    territoryWidth: 3,
    contactGap: 1,
    pitch: 4,
  },
  movement: {
    speeds: { castle: [1, 1], bishop: [1, 1], queen: [1, 1], king: [1, 1], commander: [1, 1], knight: [2, 1] },
    patterns: { castle: 'orthogonal_line', bishop: 'diagonal_line', queen: 'any_line', king: 'adjacent', commander: 'adjacent', knight: 'knight_l' },
    stepCost: 1,
    knightRouteCost: 3,
    turnTicks: 1,
    knightBendTicks: 0,
    uphillSpeed: [1, 2],
    routeReplacement: 'finish_edge_then_reroute',
    friendlyObstruction: true,
    mergePlacement: 'mount_center_keep_nonconflicting_then_numeric',
    mountlessTravel: false,
  },
  combat: {
    preset: 'individual',
    hitStructure: 'separate_weapon_hits',
    protection: 'individual', // individual | line
    allocation: 'attacker', // attacker | defender (melee contacts are fixed in individual mode)
    health: 'member', // member | party_pool
    firstContactExchange: 'immediate',
    exchangeCadence: 'once_per_tick_at_movement_start',
    charge: { enabled: true, multiplier: 'approach_speed' },
    pike: { entrenchment: 'stationary_front', transfer: true },
    ranged: { policy: 'nearest_engagement', volleysPerTick: 1, baseRange: 2, elevation: { down: [1, 1], up: [-1, -1], minRange: 1, minPower: 0 } },
    cornerSupport: { enabled: true, supplyCost: 0 },
    breach: { maxSlots: 1 },
    retreat: { sameTimeExchangeFirst: true, followerSupplyCost: 0 },
    maintenance: { centerReserve: 6, retainerRequirement: 3, removalOrder: 'front_side_rear' },
    autoAllocation: 'slot_order_then_member_id',
  },
  roster: {
    pawn: { center: null, slots: { 1: 'swordsman', 2: 'swordsman', 3: 'swordsman', 7: 'archer', 9: 'archer' } },
    mount: { slots: { 4: 'pikeman', 6: 'mage', 8: 'priest' } },
    commanderColumn: 5,
  },
  cards: {
    responseProcedure: 'public_stack_v1',
    /** local column → attached ability for every rank 1–10 */
    bindings: {
      1: 'fixture.wheel_formation', 2: 'fixture.ember_strike', 3: 'fixture.blue_denial',
      4: 'fixture.wheel_formation', 5: 'fixture.row_mana_double', 6: 'fixture.ember_strike',
      7: 'fixture.blue_denial', 8: 'fixture.wheel_formation', 9: 'fixture.ember_strike',
    },
    fallback: 'fixture.resource_only',
    /** the opening places no Major Arcana (Appendix A: keeps the combat examples unmodified) */
    majors: {},
    refundOnCounter: false,
  },
  terrain: {
    bands: [-3, -2, -1, 1, 2, 3],
    opening: 'flat',
    deposits: [{ owner: 'A', localColumn: 1, localRow: 3, band: -3 }, { owner: 'B', localColumn: 1, localRow: 3, band: -3 }],
    uphillSpeed: [1, 2],
    workTicks: { excavate: 1, fill: 1, extract: 1, craft: 1, equip: 1 },
    recipe: { id: 'fixture.armor_recipe', inputs: { metal: 1 }, output: 'fixture.armor', ticks: 1 },
    crossMatchImport: false,
  },
  victory: { capitalCapture: true, commanderDeath: true, simultaneous: 'draw' },
  automation: { tickBudget: null },
});

/** Named field changes from the base profile. */
export const PROFILE_VARIANTS = Object.freeze({
  /**
   * The default for new matches from addendum 01 until addendum 03 (HF-04): a new or replaced voluntary
   * destination must have its whole remaining route funded by held Supply plus earlier planned
   * loads, and the debit follows each Mount's declared route price (a Knight L costs
   * knightRouteCost over its three pitches). Speed is still the rate; nothing is prepaid. The base
   * v3 profile keeps partial-Supply travel for its golden fixtures and old replays.
   */
  hapa_open_10x9_v3_02: {
    title: 'Open 10×9, v3 fixture 02 — Supply-funded destinations',
    revision: 1,
    rulesVersion: 'hapa-versus-rules/0.2.0',
    movement: { destinationFunding: 'full_route_funded_v1', debit: 'route_price_v1' },
  },
  /**
   * The default for new matches (human-feedback addendum 03, HF3-01/HF3-02). v3_02 plus:
   *  - reachable-segment recovery: a party stopped between centers can retrace its clear segment to
   *    the territory it left (or finish the segment) as a direct route, a blocked party reroutes from
   *    that previous node instead of the obstructed next one, and the first friendly obstruction is
   *    recorded once per episode (`travel_blocked`);
   *  - own-plan Ready: Ready commits the player's own exact plan once; the opponent's later edits do
   *    not revoke it, and the phase locks when both own plans are committed.
   * v3_02 keeps nearest-node recovery and pair acknowledgment for its matches and replays.
   */
  hapa_open_10x9_v3_03: {
    title: 'Open 10×9, v3 fixture 03 — one Ready, reachable recovery',
    revision: 1,
    rulesVersion: 'hapa-versus-rules/0.3.0',
    movement: { destinationFunding: 'full_route_funded_v1', debit: 'route_price_v1', recovery: 'reachable_segment_v1' },
    planning: { agreement: 'own_plan_ready_v1' },
  },
  hapa_open_9x9_v3_01: {
    title: 'Open 9×9 comparison',
    board: { rows: 9, manaRows: [3, 4, 5, 6, 7], dualRows: [5], geographyBoundary: 4, rankCap: 10 },
    banks: { rowSlots: 9 },
  },
  hapa_open_11x9_v3_01: {
    title: 'Open 11×9 comparison',
    board: { rows: 11, manaRows: [3, 4, 5, 6, 7, 8, 9], dualRows: [6], geographyBoundary: 5, rankCap: 10 },
    banks: { rowSlots: 11 },
  },
  hapa_open_10x9_v3_01_deploy_mana: {
    title: 'Open 10×9 with deployment-row Mana',
    board: { manaRows: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  },
  hapa_open_10x9_v3_01_line_attacker: {
    title: 'Shared line Defense, attacker allocation',
    combat: { preset: 'line_attacker', protection: 'line', allocation: 'attacker', health: 'member' },
  },
  hapa_open_10x9_v3_01_line_defender: {
    title: 'Shared line Defense, defender allocation',
    combat: { preset: 'line_defender', protection: 'line', allocation: 'defender', health: 'member' },
  },
  hapa_open_10x9_v3_01_party_maintenance: {
    title: 'Party health pool with member maintenance',
    combat: { preset: 'party_maintenance', protection: 'line', allocation: 'attacker', health: 'party_pool' },
  },
});

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

/** Deep merge: arrays and scalars replace; objects merge. */
export function mergeProfile(base, changes) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(changes)) out[k] = isObj(v) && isObj(base[k]) ? mergeProfile(base[k], v) : v;
  return out;
}

/** The fully expanded profile for an id (base or variant). */
export function profileById(id) {
  if (id === BASE_PROFILE.id) return JSON.parse(JSON.stringify(BASE_PROFILE));
  const v = PROFILE_VARIANTS[id];
  if (!v) throw new Error(`unknown profile ${id}`);
  return JSON.parse(JSON.stringify({ ...mergeProfile(BASE_PROFILE, v), id }));
}

export const PROFILE_IDS = [BASE_PROFILE.id, ...Object.keys(PROFILE_VARIANTS)];

/** The profile new local matches, bots and peer tools start with. */
export const DEFAULT_PROFILE_ID = 'hapa_open_10x9_v3_03';
