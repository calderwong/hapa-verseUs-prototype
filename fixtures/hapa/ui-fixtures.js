/**
 * Labeled diagnostic fixtures playable in the battlefield (Master Requirements v3 ch.14: a fixture
 * "can directly create a specified combat or resource state without pretending that it emerged
 * from ordinary play. Label it as a fixture."). Each returns { manifest, ctx, state } positioned
 * just before the Tick that shows the behaviour; the session records the fixture's initial state
 * so its replay still verifies.
 */
import { scenario } from './scenarios.js';
import { setDestination } from '../../src/hapa/rules/movement.js';
import { raiseTerritory, cellKey } from '../../src/hapa/rules/terrain.js';

const U = 1_000_000;
const sturdy = (state) => { for (const m of Object.values(state.members)) if (m.archetype !== 'center') { m.hp = 20 * U; m.maxHp = 20 * U; } };

export const UI_FIXTURES = {
  corner: {
    title: 'Corner helper',
    description: 'A holds C4–C6 on R5. B\'s Queen closes on the middle Castle in Tick 5; the neighbours\' corner Swordsmen step into the contact strip to flank it.',
    build() {
      const fx = scenario({ matchId: 'fixture-corner', parties: [
        { id: 'A.left', owner: 'A', mount: 'castle', column: 4, row: 5, slots: { 5: 'center', 3: 'swordsman', 1: 'swordsman', 7: 'archer' }, supply: 1 },
        { id: 'A.mid', owner: 'A', mount: 'castle', column: 5, row: 5, slots: { 5: 'center', 1: 'swordsman', 2: 'swordsman', 3: 'swordsman', 8: 'priest' }, supply: 2 },
        { id: 'A.right', owner: 'A', mount: 'castle', column: 6, row: 5, slots: { 5: 'center', 1: 'swordsman', 3: 'swordsman', 9: 'archer' }, supply: 1 },
        { id: 'B.queen', owner: 'B', mount: 'queen', column: 5, row: 6, slots: { 5: 'center', 1: 'swordsman', 2: 'swordsman', 3: 'swordsman', 4: 'pikeman', 6: 'pikeman' }, supply: 0.25 },
      ] });
      sturdy(fx.state);
      fx.state.tick = 4; fx.state.phase = 'resolved';
      setDestination(fx.state, fx.ctx, [], fx.state.parties['B.queen'], { column: 5, row: 5 }, { command: 'fixture' });
      return fx;
    },
  },
  contact_turn: {
    title: 'Turning in contact',
    description: 'A\'s Castle is about to be engaged from the north. A turn to face E keeps its touching Swordsman in contact (legal); a turn to W would pull it out (refused, old formation kept).',
    build() {
      const fx = scenario({ matchId: 'fixture-contact-turn', parties: [
        { id: 'A.p', owner: 'A', mount: 'castle', column: 5, row: 5, slots: { 5: 'center', 1: 'swordsman' }, supply: 1 },
        { id: 'B.q', owner: 'B', mount: 'queen', column: 5, row: 6, slots: { 5: 'center', 1: 'swordsman', 2: 'swordsman', 3: 'swordsman' }, supply: 0.25 },
      ] });
      sturdy(fx.state);
      fx.state.tick = 4; fx.state.phase = 'resolved';
      setDestination(fx.state, fx.ctx, [], fx.state.parties['B.q'], { column: 5, row: 5 }, { command: 'fixture' });
      return fx;
    },
  },
};


UI_FIXTURES.terrain = {
  title: 'Hill, pit, tunnel and flyer',
  description: 'A\'s Archers hold a ramped hill (R5C3); B has a party in an open pit (R6C5) and one in a roofed tunnel (R6C7); A has a flyer (R4C7). Step layers with [ and ].',
  build() {
    const fx = scenario({ matchId: 'fixture-terrain', parties: [
      { id: 'A.hill', owner: 'A', mount: 'castle', column: 3, row: 5, slots: { 5: 'center', 7: 'archer', 8: 'archer', 9: 'archer', 2: 'swordsman' }, supply: 2 },
      { id: 'A.fly', owner: 'A', mount: 'queen', column: 7, row: 4, slots: { 5: 'center', 2: 'swordsman' }, supply: 1 },
      { id: 'B.pit', owner: 'B', mount: 'castle', column: 5, row: 6, slots: { 5: 'center', 2: 'swordsman' } },
      { id: 'B.tunnel', owner: 'B', mount: 'castle', column: 7, row: 6, slots: { 5: 'center', 2: 'pikeman' } },
      { id: 'B.walk', owner: 'B', mount: 'knight', column: 3, row: 7, slots: { 5: 'center', 1: 'swordsman', 3: 'swordsman' }, supply: 1 },
    ] });
    const s = fx.state, ctx = fx.ctx;
    raiseTerritory(s, ctx, 3, 5, 1, [{ column: 3, row: 4 }, { column: 3, row: 6 }]);
    const sink = (pid, band, open) => {
      const P = s.parties[pid];
      P.band = band;
      for (const id of Object.values(P.slots)) if (id) {
        const m = s.members[id];
        m.band = band;
        const x = Math.round(m.x / U), y = Math.round(m.y / U);
        for (let b = band; b <= -1; b++) if (open || b === band) s.terrain.cells[cellKey(x, y, b)] = { solid: false, material: 'air' };
      }
      s.terrain.kind = 'volume';
    };
    sink('B.pit', -1, true);
    sink('B.tunnel', -2, false);
    const F = s.parties['A.fly'];
    F.movementMode = 'air'; F.band = 2;
    for (const id of Object.values(F.slots)) if (id) s.members[id].band = 2;
    s.tick = 4; s.phase = 'resolved';
    return fx;
  },
};

/** A Card for a fixture bank slot (keyed by global column, as minting does). */
const fixtureCard = (s, id, owner, column, abilityId, supply = 2, mana = {}) => {
  s.cards[id] = { id, owner, column, localColumn: column, tick: s.tick, suit: 'fixture', rank: supply, supply: supply * U, mana, pips: [], ability: `${abilityId}@1`, abilityId, state: 'available' };
  s.players[owner].bank.minor[String(column)] = id;
};

UI_FIXTURES.response = {
  title: 'Spell and response window',
  description: 'Tick 9 (C1 active). A can cast Ember Strike (C2 bank, paid by burning its 2-Red C4 card) from its C1 Castle at B\'s Swordsman next door; B holds Blue Denial (C7) and a 2-Blue card (C6), A a second Denial (C3). Two humans: A plans the Spell and both Ready; B then gets a public response window.',
  build() {
    const fx = scenario({ matchId: 'fixture-response', parties: [
      { id: 'A.c', owner: 'A', mount: 'castle', column: 1, row: 4, slots: { 5: 'center' } },
      { id: 'B.c', owner: 'B', mount: 'castle', column: 1, row: 5, slots: { 5: 'center', 2: 'swordsman' } },
      { id: 'B.far', owner: 'B', mount: 'castle', column: 7, row: 9, slots: { 5: 'center' } },
    ] });
    const s = fx.state;
    s.tick = 8; s.phase = 'resolved';
    fixtureCard(s, 'A.ember', 'A', 2, 'fixture.ember_strike');
    fixtureCard(s, 'A.deny', 'A', 3, 'fixture.blue_denial');
    fixtureCard(s, 'B.deny', 'B', 7, 'fixture.blue_denial');
    // Mana for the Tick comes from burning a public card (pools expire at the Tick boundary)
    fixtureCard(s, 'A.red', 'A', 4, 'fixture.ember_strike', 2, { red: 2 });
    fixtureCard(s, 'B.blue', 'B', 6, 'fixture.ember_strike', 2, { blue: 2 });
    return fx;
  },
};

/**
 * Presentation picking diagnostic: two occupants share one horizontal territory on different
 * bands (a flyer at +3 above a party in a roofed tunnel at −2) beside a raised hill. It exists to
 * check selection and overlays against visible height; it makes no claim that ordinary movement
 * reaches this arrangement.
 */
UI_FIXTURES.stacked = {
  title: 'Stacked heights (picking check)',
  description: 'R6C5: A\'s flyer (+3) directly above B\'s roofed tunnel party (−2). R5C3: A\'s Archers on a hill (+2). R6C3: B on open ground. R7C7: B deep in a roofed gallery (−3). Click each and read the selected band; step layers with [ and ].',
  build() {
    const fx = scenario({ matchId: 'fixture-stacked', parties: [
      { id: 'A.fly', owner: 'A', mount: 'queen', column: 5, row: 6, slots: { 5: 'center', 2: 'swordsman' }, supply: 1 },
      { id: 'B.tunnel', owner: 'B', mount: 'castle', column: 5, row: 6, slots: { 5: 'center', 2: 'pikeman' } },
      { id: 'A.hill', owner: 'A', mount: 'castle', column: 3, row: 5, slots: { 5: 'center', 7: 'archer', 8: 'archer', 9: 'archer' }, supply: 1 },
      { id: 'B.walk', owner: 'B', mount: 'knight', column: 3, row: 6, slots: { 5: 'center', 1: 'swordsman', 3: 'swordsman' }, supply: 1 },
      { id: 'B.deep', owner: 'B', mount: 'castle', column: 7, row: 7, slots: { 5: 'center', 2: 'swordsman', 8: 'archer' } },
    ] });
    const s = fx.state, ctx = fx.ctx;
    raiseTerritory(s, ctx, 3, 5, 1, [{ column: 3, row: 4 }]);
    for (const [pid, band] of [['B.tunnel', -2], ['B.deep', -3]]) {
      const T = s.parties[pid];
      T.band = band;
      for (const id of Object.values(T.slots)) if (id) {
        const m = s.members[id]; m.band = band;
        s.terrain.cells[cellKey(Math.round(m.x / U), Math.round(m.y / U), band)] = { solid: false, material: 'air' };
      }
    }
    s.terrain.kind = 'volume';
    const F = s.parties['A.fly'];
    F.movementMode = 'air'; F.band = 3;
    for (const id of Object.values(F.slots)) if (id) s.members[id].band = 3;
    s.tick = 4; s.phase = 'resolved';
    return fx;
  },
};
