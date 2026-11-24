// Response 09: CJ's opening cases after response 08 on the default profile (v3_04), actual headless rules.
// Run from this folder's repository: node docs/reviews/evidence/2026-11-23/response-09/opening-cases.mjs
import { createSession, openTick, closeTick, verifyReplay } from '../../../../../src/hapa/rules/session.js';
import { profileById, DEFAULT_PROFILE_ID } from '../../../../../fixtures/hapa/profiles.js';
import { CATALOG } from '../../../../../fixtures/hapa/content.js';
import { quoteRoute, routeFromHere, routeClearance } from '../../../../../src/hapa/rules/movement.js';
import { validatePlan } from '../../../../../src/hapa/rules/match.js';
import { supplyOf } from '../../../../../src/hapa/rules/economy.js';
const pass = () => ({ pass: true });
const where = (s, id) => { const p = s.state.parties[id]; return `${id} @(${p.x/1e6},${p.y/1e6}) R${p.region.row}C${p.region.column} supply ${supplyOf(p)/1e6} ${p.state} members ${Object.values(p.slots).filter(Boolean).length}`; };
function upTo(tick, plansAt) {
  const s = createSession({ matchId: 'cj', profile: profileById(DEFAULT_PROFILE_ID), catalog: CATALOG, seed: 1 });
  for (let t = 1; t <= tick; t++) { openTick(s); const A = plansAt[t]?.(s) ?? []; if (A.length) { const v = validatePlan(s.state, s.ctx, 'A', A); if (!v.ok) console.log('  invalid', JSON.stringify(v.errors)); } const r = closeTick(s, { A, B: [] }, pass); for (const e of r.events.filter((e) => ['parties_merged', 'travel_blocked', 'destination_reached', 'contact'].includes(e.type) && e.partyId?.startsWith('A'))) console.log(`  t${t} ${e.type} ${e.partyId} ${e.retired ?? e.by ?? ''}`); }
  return s;
}
const bank = (s) => Object.values(s.state.players.A.bank.minor).filter(Boolean);
console.log('Bishop R1C3 -> R5C7 at Tick 3 (C7 and C3 cards)');
let s = upTo(5, { 3: (s) => [...['7', '3'].map((c) => ({ type: 'load_supply', cardId: s.state.players.A.bank.minor[c], partyId: 'A.mount.C3' })), { type: 'set_destination', partyId: 'A.mount.C3', target: { column: 7, row: 5 } }] });
console.log(' ', where(s, 'A.mount.C3'), 'pawnC4 retired', !!s.state.parties['A.pawn.C4'].retired, 'replay', verifyReplay(s.replay).ok);
for (const [label, target, via] of [['R3C3 long', { column: 3, row: 3 }, 'long'], ['R3C3 short', { column: 3, row: 3 }, 'short'], ['R2C4 long', { column: 4, row: 2 }, 'long'], ['R2C4 short', { column: 4, row: 2 }, 'short'], ['R3C1 short', { column: 1, row: 3 }, 'short'], ['R3C1 long', { column: 1, row: 3 }, 'long']]) {
  console.log(`Knight R1C2 -> ${label}`);
  const t = upTo(4, { 2: (s) => [...bank(s).slice(0, 2).map((id) => ({ type: 'load_supply', cardId: id, partyId: 'A.mount.C2' })), { type: 'set_destination', partyId: 'A.mount.C2', target, via }] });
  const absorbed = ['A.pawn.C1', 'A.pawn.C2', 'A.pawn.C3', 'A.pawn.C4'].filter((id) => t.state.parties[id].retired);
  console.log(' ', where(t, 'A.mount.C2'), 'absorbed', absorbed.join(','), 'replay', verifyReplay(t.replay).ok);
}
