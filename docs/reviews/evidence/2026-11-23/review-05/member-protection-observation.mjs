// Observation against pinned prototype b747d118 / implementation fc6df0d.
// Run from the repository root:
// node docs/reviews/evidence/2026-11-23/review-05/member-protection-observation.mjs
import { scenario } from '../../../../../fixtures/hapa/scenarios.js';
import { individualProtection } from '../../../../../src/hapa/rules/combat.js';
const fx = scenario({ profileId: 'hapa_open_10x9_v3_02', majors: { 3: 'fixture.bound_standard' }, keep: ['A.mount.C5', 'B.mount.C5', 'A.mount.C3'], parties: [] });
const p = fx.state.parties['A.mount.C3'];
const m = fx.state.members[Object.values(p.slots).find((id) => id && fx.state.members[id].isCenter)];
console.log(JSON.stringify({
  member: m.id,
  profile: fx.ctx.profile.id,
  combat: fx.ctx.profile.combat,
  archetype: m.archetype,
  rawPanelProtection: fx.ctx.catalog.archetypes[m.archetype].protections,
  actualFrontPhysical: individualProtection(fx.state, fx.ctx, m, 'physical', 'front'),
}, null, 2));
