/**
 * Labeled diagnostic fixtures playable in the battlefield (Master Requirements v3 ch.14: a fixture
 * "can directly create a specified combat or resource state without pretending that it emerged
 * from ordinary play. Label it as a fixture."). Each returns { manifest, ctx, state } positioned
 * just before the Tick that shows the behaviour; the session records the fixture's initial state
 * so its replay still verifies.
 */
import { scenario } from './scenarios.js';
import { setDestination } from '../../src/hapa/rules/movement.js';

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
