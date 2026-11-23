// Review 03, R3-01: an offered response must have a payment the rules can actually make. The shared
// quote (economy.quotePayment) is what the response panel and the ability tool use; it must agree
// with planPayment and with actual resolution, counting each Rainbow unit once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quotePayment, manaShortfall, planPayment } from '../../src/hapa/rules/economy.js';
import { UI_FIXTURES } from '../../fixtures/hapa/ui-fixtures.js';
import { createFixtureSession, openTick } from '../../src/hapa/rules/session.js';
import { resolveTick, validatePlan } from '../../src/hapa/rules/match.js';
import { validateContent } from '../../src/hapa/rules/validate.js';
import { deriveDefinition } from '../../src/hapa/adapters/content.js';

test('one Rainbow cannot pay Red + Blue; two can; a colored Card plus Rainbow pays only the missing part', () => {
  const cost = { red: 1, blue: 1 };
  assert.equal(manaShortfall({ rainbow: 1 }, cost), 1);
  assert.equal(quotePayment({ rainbow: 1 }, cost, []).payment, null);
  assert.ok(quotePayment({ rainbow: 2 }, cost, []).payment);
  const q = quotePayment({ rainbow: 1 }, cost, [{ id: 'green', mana: { green: 3 } }, { id: 'blue', mana: { blue: 1 } }]);
  assert.deepEqual(q.burns, ['blue'], 'burns only the Card that covers a missing color');
  assert.deepEqual(q.payment.assigned, [{ requirement: 'red', color: 'rainbow', amount: 1 }, { requirement: 'blue', color: 'blue', amount: 1 }]);
  // every quote agrees with planPayment on its final pool
  for (const pool of [{}, { rainbow: 1 }, { red: 1 }, { rainbow: 3 }, { blue: 2, rainbow: 1 }]) {
    for (const c of [cost, { blue: 2 }, { rainbow_only: 1, red: 1 }]) {
      const r = quotePayment(pool, c, []);
      assert.equal(!!r.payment, !!planPayment(pool, c), JSON.stringify({ pool, c }));
    }
  }
});

/** The review's diagnostic: Blue Denial derived to cost Red + Blue, B holding only Rainbow. */
function mixedDenial(pool) {
  const fx = UI_FIXTURES.response.build();
  fx.ctx.catalog = structuredClone(fx.ctx.catalog);
  const def = deriveDefinition(fx.ctx.catalog.cards['fixture.blue_denial'], { title: 'Review Mixed Denial', cost: { consumeSourceInstance: true, mana: { red: 1, blue: 1 } } }, { id: 'review-probe', kind: 'human' });
  fx.ctx.catalog.cards[def.id] = def;
  assert.equal(validateContent(fx.ctx.catalog).ok, true);
  fx.state.cards['B.deny'].abilityId = def.id;
  fx.state.cards['B.deny'].ability = `${def.id}@${def.revision}`;
  fx.state.players.B.bank.minor['6'] = null;
  fx.state.cards['B.blue'].state = 'burned';
  const session = createFixtureSession(fx, { id: 'payment', title: 'Mixed-cost response diagnostic' });
  openTick(session);
  session.state.players.B.pool = { ...pool };
  return { session, def };
}

for (const [rainbow, expectCounter] of [[1, false], [2, true]]) {
  test(`mixed-cost counter with ${rainbow} Rainbow: offered only when payable, and resolution agrees`, () => {
    const { session, def } = mixedDenial({ rainbow });
    const { state, ctx } = session;
    const planA = validatePlan(state, ctx, 'A', [{ type: 'play_ability', cardId: 'A.ember', actorPartyId: 'A.c', target: { memberId: 'B.c.s2' }, burns: ['A.red'] }]);
    const gen = resolveTick(state, ctx, { A: planA.accepted, B: [] });
    let step = gen.next();
    assert.equal(step.value.seat, 'B');
    const quote = quotePayment({ ...state.players.B.pool }, def.cost.mana, []);
    assert.equal(!!quote.payment, expectCounter, 'the quote offers the counter exactly when payable');
    if (expectCounter) {
      const top = step.value.stack.at(-1);
      step = gen.next({ cardId: 'B.deny', actorPartyId: 'B.c', target: { stackId: top.id }, burns: quote.burns });
    }
    while (!step.done) step = gen.next({ pass: true });
    const events = step.value;
    assert.equal(events.some((e) => e.type === 'counter_applied'), expectCounter);
    assert.equal(events.some((e) => e.type === 'command_rejected' && e.seat === 'B'), false, 'no offered response is rejected');
    assert.equal(events.filter((e) => e.type === 'card_damage').length, expectCounter ? 0 : 1);
    if (expectCounter) assert.deepEqual(state.players.B.pool, {}, 'both Rainbow spent, nothing else');
  });
}

test('the ordinary Blue Denial counter is paid by burning the 2-Blue Card and replays', () => {
  const fx = UI_FIXTURES.response.build();
  const session = createFixtureSession(fx, { id: 'response', title: 'Spell and response window' });
  openTick(session);
  const { state, ctx } = session;
  const planA = validatePlan(state, ctx, 'A', [{ type: 'play_ability', cardId: 'A.ember', actorPartyId: 'A.c', target: { memberId: 'B.c.s2' }, burns: ['A.red'] }]);
  const gen = resolveTick(state, ctx, { A: planA.accepted, B: [] });
  let step = gen.next();
  const def = ctx.catalog.cards['fixture.blue_denial'];
  const cands = Object.values(state.players.B.bank.minor).filter(Boolean).map((id) => state.cards[id]).filter((c) => c.id !== 'B.deny' && c.state === 'available');
  const quote = quotePayment({ ...state.players.B.pool }, def.cost.mana, cands);
  assert.deepEqual(quote.burns, ['B.blue']);
  const choices = [{ cardId: 'B.deny', actorPartyId: 'B.c', target: { stackId: step.value.stack.at(-1).id }, burns: quote.burns }];
  step = gen.next(choices[0]);
  while (!step.done) { choices.push({ pass: true }); step = gen.next({ pass: true }); }
  assert.ok(step.value.some((e) => e.type === 'counter_applied'));
  assert.ok(step.value.some((e) => e.type === 'card_burned' && e.cardId === 'B.blue' && e.cause === 'payment'));
});
