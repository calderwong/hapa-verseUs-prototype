// HV-40 — history, statistics and creator projections (Master Requirements v3 ch.13; ch.11
// "Preserve authorship through reuse"; ch.16 "Mining and crafting history").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, playMatch, verifyReplay } from '../../src/hapa/rules/session.js';
import { HistoryStore, matchReport, combatCredit, creatorStats, itemHistory, questProgress } from '../../src/hapa/rules/stats.js';
import { beginCount, runTick } from '../../src/hapa/rules/match.js';
import { placeDeposit, cellKey } from '../../src/hapa/rules/terrain.js';
import { deriveDefinition } from '../../src/hapa/adapters/content.js';
import { clone } from '../../src/hapa/rules/encoding.js';
import { HeuristicBot } from '../../src/hapa/controllers/heuristic-bot.js';
import { profileById, BASE_PROFILE } from '../../fixtures/hapa/profiles.js';
import { CATALOG } from '../../fixtures/hapa/content.js';
import { scenario } from '../../fixtures/hapa/scenarios.js';

const U = 1_000_000;
const botMatch = (seed, budget, matchId = `h-${seed}`) => {
  const s = createSession({ matchId, profile: profileById(BASE_PROFILE.id), catalog: CATALOG, seed, controllers: { A: { type: 'bot', revision: 'heuristic-bot/0.1.0' }, B: { type: 'bot', revision: 'heuristic-bot/0.1.0' } } });
  const outcome = playMatch(s, { A: new HeuristicBot({ seat: 'A', seed: seed * 2 + 1 }), B: new HeuristicBot({ seat: 'B', seed: seed * 2 + 2 }) }, { tickBudget: budget });
  return { s, outcome };
};

test('matches and events import once; reports split by profile, controllers, deck and seed', () => {
  const a = botMatch(2, 40), b = botMatch(3, 20);
  const store = new HistoryStore();
  for (const { s, outcome } of [a, b]) store.importMatch({ manifest: s.manifest, events: s.events, outcome });
  const n = store.size;
  // a reconnect retransmits; a replay is imported again: nothing changes
  for (const { s, outcome } of [a, b]) assert.equal(store.importMatch({ manifest: JSON.parse(JSON.stringify(s.manifest)), events: JSON.parse(JSON.stringify(s.events)), outcome }), 0);
  assert.equal(store.size, n);
  assert.equal(store.matches.size, 2);
  const r = matchReport(store)[BASE_PROFILE.id];
  assert.equal(r.matches, 2);
  assert.deepEqual(r.byControllers, { 'bot-bot': 2 });
  assert.deepEqual(r.seeds.sort(), [2, 3]);
  // the replay recomputes the same events, so importing it adds nothing either
  const replayed = [];
  verifyReplay(JSON.parse(JSON.stringify(a.s.replay)), { onEvents: (e) => replayed.push(...e) });
  assert.equal(store.importMatch({ manifest: a.s.manifest, events: replayed, outcome: a.outcome }), 0);
});

test('combat credit keeps raw, prevented and actual damage apart, by deliverer and by Card', () => {
  const { s, outcome } = botMatch(2, 40);
  const store = new HistoryStore();
  store.importMatch({ manifest: s.manifest, events: s.events, outcome });
  const c = combatCredit(store);
  for (const row of Object.values(c.byArchetype)) {
    assert.ok(row.raw >= row.damage);
    assert.equal(Math.round((row.raw - row.prevented - row.damage) * 1e6), 0); // no overlap or loss
  }
  assert.ok(c.byArchetype.swordsman.hits > 0);
  assert.ok(Object.keys(c.prevention).some((k) => k.startsWith('line:') || k.startsWith('individual:')));
});

test('creator use is separate from combat credit; uses by another identity are counted once', () => {
  const creator = { id: 'dev:creator-b', kind: 'local_development_identity' };
  const lance = deriveDefinition(CATALOG.cards['fixture.ember_strike'], { title: 'Ember Lance', operations: [{ type: 'damage', hits: 1, power: 3, channel: 'magic', incomingFace: 'front' }] }, creator);
  const catalog = clone(CATALOG); catalog.cards[lance.id] = lance;
  const decks = { A: { majors: {}, bindings: { ...BASE_PROFILE.cards.bindings } }, B: { majors: {}, bindings: { ...BASE_PROFILE.cards.bindings, 2: lance.id } } };
  const fx = scenario({ matchId: 'creator-use', catalog, decks, parties: [
    { id: 'A.t', owner: 'A', mount: 'castle', column: 5, row: 5, slots: { 5: 'center', 2: 'swordsman' } },
    { id: 'B.c', owner: 'B', mount: 'castle', column: 5, row: 6, slots: { 5: 'center' } },
  ] });
  const s = fx.state;
  s.tick = 4;
  const events = beginCount(s, fx.ctx);
  s.cards['B.lance'] = { id: 'B.lance', owner: 'B', column: 5, localColumn: 5, tick: 5, suit: 'wands', rank: 5, supply: 5 * U, mana: {}, pips: [], ability: `${lance.id}@1`, abilityId: lance.id, state: 'available' };
  s.players.B.bank.minor['5'] = 'B.lance';
  s.players.B.pool = { red: 2 };
  s.members['A.t.s2'].hp = 10 * U;
  events.push(...runTick(s, fx.ctx, { A: [], B: [{ type: 'play_ability', cardId: 'B.lance', actorPartyId: 'B.c', target: { memberId: 'A.t.s2' } }] }).events);
  const store = new HistoryStore();
  store.importMatch({ manifest: fx.manifest, events });
  store.importMatch({ manifest: fx.manifest, events }); // both peers submit the same events
  const cs = creatorStats(store);
  assert.equal(cs['dev:creator-b'].definitionsCreated, 1);
  assert.equal(cs['dev:creator-b'].matchesAppeared, 1);
  assert.equal(cs['dev:creator-b'].uses, 1);
  assert.equal(cs['dev:creator-b'].usesByOthers, 1); // used by participant dev:participant-b
  assert.deepEqual(cs['dev:creator-b'].byController, { human: 1 });
  // the Card's damage is combat credit for the Card, not for its creator
  const credit = combatCredit(store);
  assert.equal(credit.byCard[`${lance.id}@1`].hits, 1);
  assert.equal(credit.byCard[`${lance.id}@1`].raw, 3);
  // a repeated experiment run is labeled, not counted as another independent match
  const fx2 = { ...fx, manifest: { ...fx.manifest, matchId: 'creator-use-run-2' } };
  store.importMatch({ manifest: fx2.manifest, events: [], experimentId: 'exp-1' });
  assert.equal(creatorStats(store)['dev:creator-b'].matchesAppeared, 1);
  assert.equal(creatorStats(store)['dev:creator-b'].experimentRuns, 1);
});

test('mining and crafting history and a quest are projections: re-import awards nothing twice', () => {
  const fx = scenario({ matchId: 'terrain_work_v3_01', parties: [{ id: 'A.worker', owner: 'A', mount: 'castle', column: 1, row: 3, slots: { 5: 'center' } }] });
  const s = fx.state;
  s.parties['A.worker'].band = -3; s.members['A.worker.s5'].band = -3;
  s.terrain.kind = 'volume';
  for (const b of [-3, -2, -1]) s.terrain.cells[cellKey(2, 10, b)] = { solid: false, material: 'air' };
  placeDeposit(s, 'deposit.A.C1.R3', 3, 10, -3);
  s.tick = 8;
  const events = [];
  const step = (A = []) => { events.push(...beginCount(s, fx.ctx)); events.push(...runTick(s, fx.ctx, { A, B: [] }).events); };
  step([{ type: 'begin_work', partyId: 'A.worker', work: 'extract', target: { x: 3, y: 10, band: -3 } }]);
  step([{ type: 'begin_work', partyId: 'A.worker', work: 'craft' }]);
  const store = new HistoryStore();
  store.importMatch({ manifest: fx.manifest, events });
  store.importMatch({ manifest: fx.manifest, events });
  const items = itemHistory(store);
  assert.deepEqual(items.map((i) => i.kind).sort(), ['crafted', 'extracted']);
  assert.equal(items.filter((i) => i.kind === 'extracted').length, 1);
  const crafted = items.find((i) => i.kind === 'crafted');
  assert.deepEqual(crafted.inputs, [items.find((i) => i.kind === 'extracted').itemId]);
  const [q] = questProgress(store, [{ id: 'first-craft', version: 1, kind: 'mine_and_craft', threshold: 1 }]);
  assert.deepEqual([q.progress, q.complete, q.version], [1, true, 1]);
});
