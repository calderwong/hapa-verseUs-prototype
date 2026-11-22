/**
 * Match manifest and initial state (Master Requirements v3, Chapters 2–3 and 6; Appendices A–B).
 *
 * The state is a plain canonical-safe object: integers, strings, booleans, null, arrays and
 * objects only, so it can be fingerprinted, saved, replayed and compared between peers. IDs are
 * derived from seat, local column and slot (e.g. `A.mount.C1`, `A.C1.s5`), never from randomness.
 */
import { fingerprint, clone } from './encoding.js';
import { Geometry, slotOffset } from './geometry.js';
import { validateProfile, validateContent } from './validate.js';

export const SEATS = /** @type {const} */ (['A', 'B']);
export const other = (seat) => (seat === 'A' ? 'B' : 'A');

/**
 * Build a manifest: the complete agreement both participants accept before play.
 * @param {{ matchId: string, profile: any, catalog: any, participants?: Record<string, any>, controllers?: Record<string, any>, decks?: Record<string, any>, seed?: number }} o
 */
export function createManifest(o) {
  const p = validateProfile(o.profile, o.catalog);
  if (!p.ok) throw new Error(`profile invalid: ${p.errors.join('; ')}`);
  const c = validateContent(o.catalog);
  if (!c.ok) throw new Error(`content invalid: ${c.errors.join('; ')}`);
  const participants = o.participants ?? {
    A: { participantId: 'dev:participant-a', identityKind: 'local_development_identity', label: 'Player A' },
    B: { participantId: 'dev:participant-b', identityKind: 'local_development_identity', label: 'Player B' },
  };
  const controllers = o.controllers ?? { A: { type: 'human', revision: '1' }, B: { type: 'human', revision: '1' } };
  return {
    schemaVersion: 1,
    matchId: o.matchId,
    protocol: 'public_protocol_v1',
    rulesVersion: o.profile.rulesVersion,
    visibility: 'public',
    profile: o.profile,
    profileFingerprint: fingerprint(o.profile),
    catalog: o.catalog,
    catalogFingerprint: fingerprint(o.catalog),
    participants,
    controllers,
    decks: o.decks ?? { A: { majors: o.profile.cards.majors, bindings: o.profile.cards.bindings }, B: { majors: o.profile.cards.majors, bindings: o.profile.cards.bindings } },
    randomStream: { algorithm: 'xorshift32_v1', seed: o.seed ?? 0x9e3779b9 },
  };
}

/**
 * initializeMatch: board, parties, members, banks, resources and the initial state.
 * @param {any} manifest
 */
export function initializeMatch(manifest) {
  const profile = manifest.profile;
  const catalog = manifest.catalog;
  const geo = new Geometry(profile);
  const U = geo.U;
  const state = {
    schemaVersion: 1,
    matchId: manifest.matchId,
    rulesVersion: manifest.rulesVersion,
    profileFingerprint: manifest.profileFingerprint,
    catalogFingerprint: manifest.catalogFingerprint,
    tick: 0,
    phase: 'setup',
    activeColumns: [],
    eventSeq: 0,
    cardSeq: 0,
    players: {},
    parties: {},
    members: {},
    cards: {},
    effects: {},
    engagements: {},
    stack: [],
    pending: null,
    terrain: { kind: 'flat', cells: {}, deposits: {} },
    tasks: {},
    items: {},
    outcome: null,
    rng: manifest.randomStream.seed >>> 0 || 1,
  };
  for (const seat of SEATS) {
    const minor = {};
    for (let c = 1; c <= profile.board.columns; c++) minor[String(c)] = null;
    state.players[seat] = {
      seat,
      participantId: manifest.participants[seat].participantId,
      pool: {},
      bank: { minor, major: {}, rows: {} },
      inventory: [],
      conceded: false,
    };
    const facing = geo.homeFacing(seat);
    for (let lc = 1; lc <= profile.board.columns; lc++) {
      const colInfo = profile.board.columnMap[lc - 1];
      const mountKind = colInfo.mount;
      const isCommander = lc === profile.roster.commanderColumn;
      for (const kind of ['mount', 'pawn']) {
        const localRow = kind === 'mount' ? profile.board.mountRow : profile.board.pawnRow;
        const g = geo.toGlobal(seat, lc, localRow);
        const anchor = geo.center(g.column, g.row);
        const partyId = `${seat}.${kind}.C${lc}`;
        const slots = {};
        for (let s = 1; s <= 9; s++) slots[String(s)] = null;
        const roster = profile.roster[kind].slots;
        const memberSlots = Object.entries(roster).map(([s, role]) => [Number(s), role]);
        if (kind === 'mount') memberSlots.push([5, 'center']);
        memberSlots.sort((a, b) => a[0] - b[0]);
        let poolMax = 0;
        for (const [slot, role] of memberSlots) {
          const arch = catalog.archetypes[role];
          const id = `${seat}.C${lc}.${kind === 'mount' ? 'm' : 'p'}${slot}`;
          const off = slotOffset(slot, facing);
          state.members[id] = {
            id, owner: seat, party: partyId, homeParty: partyId, archetype: role, definition: `${arch.id}@${arch.revision}`,
            slot, homeSlot: slot,
            x: anchor.x + off.dx * U, y: anchor.y + off.dy * U, band: 1,
            hp: arch.hp * U, maxHp: arch.hp * U, alive: true,
            equipment: { torso: null },
            isCenter: role === 'center', commander: role === 'center' && isCommander,
            lastVolleyTick: 0,
          };
          slots[String(slot)] = id;
          poolMax += arch.poolCapacity * U;
        }
        state.parties[partyId] = {
          id: partyId, owner: seat, kind, localColumn: lc,
          mount: kind === 'mount' ? mountKind : null,
          commander: kind === 'mount' && isCommander,
          slots,
          x: anchor.x, y: anchor.y, band: 1, movementMode: 'ground',
          region: { column: g.column, row: g.row },
          facing,
          supply: [], supplyRemainder: 0,
          destination: null, route: [], edge: null,
          turn: null,
          state: 'idle',
          formationChange: null,
          pool: profile.combat.health === 'party_pool' ? { hp: poolMax, max: poolMax } : null,
          alive: true, retired: false,
          approach: null,
        };
      }
    }
  }
  setupMajors(state, manifest, geo);
  state.phase = 'ready';
  return state;
}

/**
 * Major Arcana stay in their column reserve; each definition binds to the mount in front of it at
 * setup, to the column region, or both (Chapter 10 "Major Arcana location and effect binding").
 */
export function setupMajors(state, manifest, geo) {
  for (const seat of SEATS) {
    const majors = manifest.decks?.[seat]?.majors ?? {};
    for (const [lc, defId] of Object.entries(majors).sort((a, b) => Number(a[0]) - Number(b[0]))) {
      const def = manifest.catalog.cards[defId];
      const column = geo.toGlobal(seat, Number(lc), 1).column;
      const cardId = `${seat}.major.C${lc}`;
      state.players[seat].bank.major[lc] = cardId;
      state.cards[cardId] = { id: cardId, owner: seat, column, localColumn: Number(lc), ability: `${def.id}@${def.revision}`, abilityId: def.id, state: 'placed', category: 'major' };
      def.operations.forEach((op, i) => {
        if (op.type !== 'protection_modifier') return;
        const id = `F.${cardId}.${i}`;
        state.effects[id] = {
          id, definition: `${def.id}@${def.revision}`, source: cardId, owner: seat, op: op.type, active: true,
          channel: op.channel, faces: op.faces, amount: op.amount, scope: op.scope,
          boundParty: op.scope === 'bound_party' ? `${seat}.mount.C${lc}` : null,
          column: op.scope === 'column_parties' ? column : null,
        };
      });
    }
  }
}

/** Gameplay fingerprint of a state (all authoritative state; no presentation fields live here). */
export const stateFingerprint = (state) => fingerprint(state);

export const livingMembers = (state, party) => Object.values(party.slots).filter(Boolean).map((id) => state.members[id]).filter((m) => m?.alive);

/** Copy a state for a pure transition. */
export const copyState = clone;
