// Milestone C (docs/integrations/IMPLEMENTATION_CHECKPOINT.md): the host side of model-assisted
// decisions. The Harness is stubbed (fetch); the rules, the heuristic fallback and admission are real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, openTick } from '../../src/hapa/rules/session.js';
import { profileById, DEFAULT_PROFILE_ID } from '../../fixtures/hapa/profiles.js';
import { CATALOG } from '../../fixtures/hapa/content.js';
import { HeuristicBot } from '../../src/hapa/controllers/heuristic-bot.js';
import { ModelDecider } from '../../src/hapa/controllers/model-decider.js';
import { validatePlan } from '../../src/hapa/rules/match.js';
import { canonicalize } from '../../src/hapa/rules/encoding.js';

/** A match at a Tick where seat B has destination choices, and a minimal host. */
function table() {
  const session = createSession({ matchId: 'model-test-1', profile: profileById(DEFAULT_PROFILE_ID), catalog: CATALOG, seed: 1 });
  openTick(session);
  const app = { session, ctx: session.ctx, generation: 1, get state() { return session.state; } };
  return { app, bot: new HeuristicBot({ seat: 'B', seed: 4 }) };
}

/** Stub the Harness: `reply(request)` returns { proposal, receipt } or throws; `delay` in ms. */
function harness(reply, { delay = 0 } = {}) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, body });
    if (url.endsWith('/game-decision-cancel')) return { ok: true, status: 200, json: async () => ({ cancelled: true }) };
    if (delay) await new Promise((r) => setTimeout(r, delay));
    const out = reply(body.request);
    return { ok: true, status: 200, json: async () => out };
  };
  return calls;
}
const receiptFor = (request, outcome = 'proposal') => ({ request_id: request.ref.request_id, input_hash: request.ref.input_hash, outcome });
const firstChoice = (request) => ({ choices: [{ decision: 'd1', option: request.decisions[0].options.at(-1).key }], remark: '' });

test('options() is side-effect free: the heuristic plan is unchanged by asking for its shortlist', () => {
  const { app, bot } = table();
  const twin = new HeuristicBot({ seat: 'B', seed: 4 });
  const opts = bot.options(app.state, app.ctx);
  assert.ok(opts.length > 0, 'seat B has a destination decision at Tick 1');
  assert.equal(canonicalize(bot.plan(app.state, app.ctx)), canonicalize(twin.plan(app.state, app.ctx)));
});

test('an admitted proposal: one request, an immutable bound packet, and a plan the shared validator accepts', async () => {
  const { app, bot } = table();
  const calls = harness((req) => ({ proposal: firstChoice(req), receipt: receiptFor(req) }));
  const d = new ModelDecider({ seat: 'B', avatarId: 'red-reaper', identityRevision: 'red-v1.0' });
  const out = await d.plan(app, bot);
  assert.equal(out.source, 'model');
  assert.equal(calls.filter((c) => c.url.endsWith('/game-decision')).length, 1);
  const req = calls[0].body.request;
  assert.deepEqual(Object.keys(req.ref).sort(), ['avatar_id', 'avatar_identity_revision', 'choice_id', 'controller_binding_revision', 'decision_state_hash', 'input_hash', 'kind', 'match_id', 'phase_id', 'request_id', 'seat', 'session_epoch', 'tick']);
  assert.equal(req.ref.match_id, 'model-test-1');
  assert.equal(req.ref.session_epoch, 1);
  assert.equal(calls[0].body.deadline_ms, 5000);
  assert.ok(!('memory' in req.view) && !('history' in req.view));
  assert.deepEqual(validatePlan(app.state, app.ctx, 'B', out.commands).errors, []);
  assert.ok(d.consumed.has(req.ref.request_id));
  assert.equal(out.receipt.outcome, 'admitted');
});

test('invalid output never plays: unknown keys, a repeated decision and a mismatched receipt fall back', async () => {
  for (const [name, reply] of [
    ['unknown option', (req) => ({ proposal: { choices: [{ decision: 'd1', option: 'o99' }], remark: '' }, receipt: receiptFor(req) })],
    ['repeated decision', (req) => ({ proposal: { choices: [{ decision: 'd1', option: 'hold' }, { decision: 'd1', option: 'o1' }], remark: '' }, receipt: receiptFor(req) })],
    ['mismatched receipt', (req) => ({ proposal: firstChoice(req), receipt: { ...receiptFor(req), request_id: 'someone-else' } })],
    ['no proposal', (req) => ({ proposal: null, receipt: receiptFor(req, 'invalid_output') })],
  ]) {
    const { app, bot } = table();
    const fallback = new HeuristicBot({ seat: 'B', seed: 4 }).plan(app.state, app.ctx);
    harness(reply);
    const d = new ModelDecider({ seat: 'B', avatarId: 'red-reaper', identityRevision: 'red-v1.0' });
    const out = await d.plan(app, bot);
    assert.equal(out.source, 'fallback', name);
    assert.match(out.receipt.outcome, /^rejected-/, name);
    assert.equal(canonicalize(out.commands), canonicalize(fallback), `${name}: exactly the stored heuristic plan`);
  }
});

test('late: the host deadline plays the fallback, cancels, and a later reply is receipted and ignored', async () => {
  const { app, bot } = table();
  const calls = harness((req) => ({ proposal: firstChoice(req), receipt: receiptFor(req) }), { delay: 200 });
  const d = new ModelDecider({ seat: 'B', avatarId: 'red-reaper', identityRevision: 'red-v1.0', deadlines: { plan: 60 } });
  const out = await d.plan(app, bot);
  assert.equal(out.source, 'fallback');
  assert.equal(out.receipt.outcome, 'deadline-fallback');
  assert.ok(calls.some((c) => c.url.endsWith('/game-decision-cancel')));
  await new Promise((r) => setTimeout(r, 300));
  assert.ok(d.receipts.some((r) => r.outcome === 'late-ignored'));
  assert.equal(d.consumed.size, 0, 'a late reply is never consumed');
});

test('unavailable: a Harness that cannot be reached plays the fallback', async () => {
  const { app, bot } = table();
  globalThis.fetch = async () => { throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }); };
  const d = new ModelDecider({ seat: 'B', avatarId: 'red-reaper', identityRevision: 'red-v1.0' });
  const out = await d.plan(app, bot);
  assert.equal(out.source, 'fallback');
  assert.equal(out.receipt.outcome, 'unavailable-fallback');
});

test('stale and duplicate: a reset during the request, or a consumed request, is fenced out', async () => {
  const { app, bot } = table();
  harness((req) => { app.generation = 2; return { proposal: firstChoice(req), receipt: receiptFor(req) }; });
  const d = new ModelDecider({ seat: 'B', avatarId: 'red-reaper', identityRevision: 'red-v1.0' });
  const out = await d.plan(app, bot);
  assert.equal(out.receipt.outcome, 'rejected-stale-epoch');
  const t2 = table();
  let seen = null;
  harness((req) => { seen = req; return { proposal: firstChoice(req), receipt: receiptFor(req) }; });
  const d2 = new ModelDecider({ seat: 'B', avatarId: 'red-reaper', identityRevision: 'red-v1.0' });
  await d2.plan(t2.app, t2.bot);
  assert.equal(d2._fenced(t2.app, seen, 1, (await import('../../src/hapa/rules/state.js')).stateFingerprint(t2.app.state)), 'duplicate');
});

// --- review 10, R10-05 witnesses (admission correctness, not playing strength) -------------------
import { closeTick } from '../../src/hapa/rules/session.js';
import { responseOptions } from '../../src/hapa/rules/match.js';

test('joint selections that cannot all be funded are not admitted: the stored fallback plays with a reason', async () => {
  const { app, bot } = table();
  for (let t = 1; t <= 6; t++) { const p = bot.plan(app.state, app.ctx); closeTick(app.session, { A: [], B: p }, (r) => (r.seat === 'B' ? bot.choose(r, app.state, app.ctx) : { pass: true })); openTick(app.session); }
  harness((req) => ({ proposal: { choices: [{ decision: 'd1', option: 'o3' }, { decision: 'd2', option: 'o1' }], remark: '' }, receipt: receiptFor(req) }));
  const fallback = new HeuristicBot({ seat: 'B', seed: 4 });
  fallback.rng = bot.rng;
  const expected = fallback.plan(app.state, app.ctx);
  const d = new ModelDecider({ seat: 'B', avatarId: 'red-reaper', identityRevision: 'red-v1.0' });
  const out = await d.plan(app, bot);
  assert.equal(out.source, 'fallback');
  assert.equal(out.receipt.outcome, 'rejected-unfulfilled-choice');
  assert.equal(canonicalize(out.commands), canonicalize(expected));
});

test('malformed and empty proposals use the exact stored fallback, with a receipt', async () => {
  for (const [proposal, outcome] of [[{ remark: '' }, 'rejected-malformed'], [{ choices: { decision: 'd1', option: 'hold' }, remark: '' }, 'rejected-malformed'], [{ choices: [], remark: '' }, 'abstained']]) {
    const { app, bot } = table();
    const expected = new HeuristicBot({ seat: 'B', seed: 4 }).plan(app.state, app.ctx);
    harness((req) => ({ proposal, receipt: receiptFor(req) }));
    const d = new ModelDecider({ seat: 'B', avatarId: 'red-reaper', identityRevision: 'red-v1.0' });
    const out = await d.plan(app, bot);
    assert.equal(out.receipt.outcome, outcome);
    assert.equal(canonicalize(out.commands), canonicalize(expected));
  }
});

/** A prepared response window where B holds a payable Blue Denial (diagnostic state, as in the review probe). */
function responseTable() {
  const { app, bot } = table();
  const cardId = Object.values(app.state.players.B.bank.minor).find(Boolean);
  app.state.cards[cardId].abilityId = 'fixture.blue_denial';
  app.state.players.B.pool = { blue: 2 };
  app.state.phase = 'responding';
  app.state.stack = [{ id: 'S1.1', seat: 'A', defId: 'fixture.ember_strike', counterable: true, countered: false, target: {} }];
  const req = { kind: 'response', seat: 'B', choiceId: 'C1.1', stack: app.state.stack.map((x) => ({ ...x })), options: responseOptions(app.state, app.ctx, 'B') };
  return { app, bot, req, counter: bot.choose(req, app.state, app.ctx) };
}

test('responses are bound like plans: input digest, exactly one recognized choice, prepared fallback otherwise', async () => {
  const cases = [
    [(req) => ({ proposal: { choices: [{ decision: 'd1', option: 'pass' }], remark: '' }, receipt: { ...receiptFor(req), input_hash: '0'.repeat(64) } }), 'rejected-mismatched-receipt', false],
    [(req) => ({ proposal: { choices: [{ decision: 'd1', option: 'pass' }, { decision: 'd1', option: 'counter' }], remark: '' }, receipt: receiptFor(req) }), 'rejected-malformed', false],
    [(req) => ({ proposal: { choices: [], remark: '' }, receipt: receiptFor(req) }), 'rejected-invalid-choice', false],
    [(req) => ({ proposal: { choices: [{ decision: 'd1', option: 'pass' }], remark: '' }, receipt: receiptFor(req) }), 'admitted', true],
  ];
  for (const [reply, outcome, passes] of cases) {
    const { app, bot, req, counter } = responseTable();
    assert.ok(!counter.pass, 'the prepared state offers a counter');
    harness(reply);
    const d = new ModelDecider({ seat: 'B', avatarId: 'red-reaper', identityRevision: 'red-v1.0' });
    const answer = await d.respond(app, bot, req);
    assert.equal(d.receipts.at(-1).outcome, outcome);
    if (passes) assert.deepEqual(answer, { pass: true });
    else assert.deepEqual(answer, counter, 'the prepared counter (fallback)');
  }
});

test('dispose cancels an outstanding request at once; the result is the stored fallback, never admitted', async () => {
  const { app, bot } = table();
  const calls = harness((req) => ({ proposal: firstChoice(req), receipt: receiptFor(req) }), { delay: 400 });
  const d = new ModelDecider({ seat: 'B', avatarId: 'red-reaper', identityRevision: 'red-v1.0' });
  const pending = d.plan(app, bot);
  await new Promise((r) => setTimeout(r, 30));
  d.dispose();
  const out = await pending;
  assert.equal(out.source, 'fallback');
  assert.equal(out.receipt.outcome, 'cancelled-fallback');
  assert.ok(calls.some((c) => c.url.endsWith('/game-decision-cancel')));
});
