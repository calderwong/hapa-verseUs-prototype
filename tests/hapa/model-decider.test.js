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
