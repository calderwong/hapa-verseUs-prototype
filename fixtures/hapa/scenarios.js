/**
 * Prepared diagnostic scenarios (Master Requirements v3, Chapter 14: "A diagnostic fixture can
 * directly create a specified combat or resource state without pretending that it emerged from
 * ordinary play. Label it as a fixture."). Each builder returns { manifest, ctx, state }.
 */
import { createManifest, initializeMatch } from '../../src/hapa/rules/state.js';
import { createContext } from '../../src/hapa/rules/context.js';
import { placeMembers } from '../../src/hapa/rules/movement.js';
import { profileById, BASE_PROFILE } from './profiles.js';
import { CATALOG } from './content.js';

/** The ordinary opening for a profile. */
export function opening(profileId = BASE_PROFILE.id, opts = {}) {
  const profile = profileById(profileId);
  if (opts.majors) profile.cards.majors = opts.majors;
  const manifest = createManifest({ matchId: opts.matchId ?? `fixture-${profileId}`, profile, catalog: CATALOG, controllers: opts.controllers });
  const state = initializeMatch(manifest);
  return { manifest, ctx: createContext(manifest), state };
}

/**
 * A sparse custom arrangement on an otherwise empty board (both Commanders kept unless dropped).
 * @param {{ profileId?: string, keep?: string[], parties: Array<{ id: string, owner: 'A'|'B', mount?: string|null, column: number, row: number, facing?: string, slots: Record<number,string>, supply?: number, commander?: boolean }> }} spec
 */
export function scenario(spec) {
  const base = opening(spec.profileId ?? BASE_PROFILE.id, { matchId: spec.matchId ?? 'fixture-scenario', majors: spec.majors });
  const { state, ctx } = base;
  const keep = new Set(spec.keep ?? ['A.mount.C5', 'B.mount.C5']);
  for (const id of Object.keys(state.parties)) {
    if (keep.has(id)) continue;
    for (const mid of Object.values(state.parties[id].slots)) if (mid) delete state.members[mid];
    delete state.parties[id];
  }
  const U = ctx.U;
  for (const p of spec.parties) {
    const c = ctx.geo.center(p.column, p.row);
    const slots = {};
    for (let s = 1; s <= 9; s++) slots[String(s)] = null;
    let poolMax = 0;
    for (const [slot, role] of Object.entries(p.slots)) {
      const arch = ctx.catalog.archetypes[role];
      const id = `${p.id}.s${slot}`;
      state.members[id] = {
        id, owner: p.owner, party: p.id, homeParty: p.id, archetype: role, definition: `${arch.id}@${arch.revision}`,
        slot: Number(slot), homeSlot: Number(slot), x: 0, y: 0, band: 1, hp: arch.hp * U, maxHp: arch.hp * U, alive: true,
        equipment: { torso: null }, isCenter: role === 'center', commander: role === 'center' && !!p.commander, lastVolleyTick: 0,
      };
      slots[slot] = id;
      poolMax += arch.poolCapacity * U;
    }
    state.parties[p.id] = {
      id: p.id, owner: p.owner, kind: p.mount ? 'mount' : 'pawn', localColumn: 0, mount: p.mount ?? null, commander: !!p.commander,
      slots, x: c.x, y: c.y, band: 1, movementMode: 'ground', region: { column: p.column, row: p.row },
      facing: p.facing ?? (p.owner === 'A' ? 'N' : 'S'), supply: p.supply ? [{ cardId: `fixture.supply.${p.id}`, units: p.supply * U, suit: 'fixture', column: p.column }] : [],
      supplyRemainder: 0, destination: null, route: [], edge: null, turn: null, state: 'idle', formationChange: null,
      pool: ctx.profile.combat.health === 'party_pool' ? { hp: poolMax, max: poolMax } : null, alive: true, retired: false, approach: null,
    };
    placeMembers(state, ctx, state.parties[p.id]);
  }
  return base;
}

/** A full formation: center plus the given retainer roles by slot. */
export const formation = (center, retainers) => ({ ...(center ? { 5: center } : {}), ...retainers });

/** The mirrored Queen example: Queen in 5, three Swordsmen in front, three Archers in the rear. */
export const MIRRORED_QUEEN = formation('center', { 1: 'swordsman', 2: 'swordsman', 3: 'swordsman', 7: 'archer', 8: 'archer', 9: 'archer' });
