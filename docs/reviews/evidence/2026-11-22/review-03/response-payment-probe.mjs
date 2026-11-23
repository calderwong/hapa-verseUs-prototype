// Historical review reproduction for 164b8dfe46d2b6b8ec0975cc8f53ea5428770230.
// Intentionally expects the pre-fix defect; not a permanent regression test.
// Executes extracted app controller methods with real rules and minimal presentation adapters.
// No browser rendering or focus-navigation observation is claimed.
// From the repository: node docs/reviews/evidence/2026-11-22/review-03/response-payment-probe.mjs
// Optional argument points to a separate snapshot of the reviewed repository.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import path from 'node:path';
import * as nodeUrl from 'node:url';

const repoRoot = process.argv[2] ? path.resolve(process.argv[2]) : nodeUrl.fileURLToPath(new URL('../../../../../', import.meta.url));
const load = rel => import(nodeUrl.pathToFileURL(path.join(repoRoot, rel)).href);
const [{ UI_FIXTURES }, { createFixtureSession, openTick }, { resolveTick, responseOptions, validatePlan }, { planPayment }, { validateContent }, { deriveDefinition }] = await Promise.all([
  load('fixtures/hapa/ui-fixtures.js'),
  load('src/hapa/rules/session.js'),
  load('src/hapa/rules/match.js'),
  load('src/hapa/rules/economy.js'),
  load('src/hapa/rules/validate.js'),
  load('src/hapa/adapters/content.js'),
]);

const appPath = path.join(repoRoot, 'src/hapa/presentation/app.js');
const source = fs.readFileSync(appPath, 'utf8');
const blob = crypto.createHash('sha1').update(`blob ${Buffer.byteLength(source)}\0`).update(source).digest('hex');
assert.equal(blob, 'a95383d275d7133e16022767c97227174241355a', 'Historical probe requires the reviewed app bytes');
// Git blob pins the controller methods extracted below.
const method = name => {
  const start = source.indexOf(`  ${name}(`);
  assert.ok(start >= 0, `source method ${name} exists`);
  const end = source.indexOf('\n  }', start) + '\n  }'.length;
  assert.ok(end > start);
  return source.slice(start, end);
};
const h = (tag, props = {}, ...children) => ({ tag, props, children: children.flat(Infinity).filter(x => x !== null && x !== undefined) });
const descendants = node => node && typeof node === 'object' ? [node, ...(node.children ?? []).flatMap(descendants)] : [];

function runCase(label, cost, pool) {
  const fx = UI_FIXTURES.response.build();
  // A legal diagnostic derivative, using the existing content adapter. Change only its cost.
  fx.ctx.catalog = structuredClone(fx.ctx.catalog);
  const def = deriveDefinition(fx.ctx.catalog.cards['fixture.blue_denial'], {
    title: 'Review Mixed Denial', cost: { consumeSourceInstance: true, mana: cost },
  }, { id: 'review-probe', kind: 'human' });
  fx.ctx.catalog.cards[def.id] = def;
  assert.equal(validateContent(fx.ctx.catalog).ok, true);
  fx.state.cards['B.deny'].abilityId = def.id;
  fx.state.cards['B.deny'].ability = `${def.id}@${def.revision}`;
  // Remove the fixture's separate Blue payment card. No other B card can cover the deficit.
  fx.state.players.B.bank.minor['6'] = null;
  fx.state.cards['B.blue'].state = 'burned';
  const session = createFixtureSession(fx, { id: 'review-payment', title: 'Review payment diagnostic' });
  openTick(session);
  session.state.players.B.pool = { ...pool }; // labeled diagnostic state, after tick-boundary clearing
  const acceptedA = validatePlan(session.state, session.ctx, 'A', [{ type: 'play_ability', cardId: 'A.ember', actorPartyId: 'A.c', target: { memberId: 'B.c.s2' }, burns: ['A.red'] }]);
  assert.equal(acceptedA.errors.length, 0);
  const gen = resolveTick(session.state, session.ctx, { A: acceptedA.accepted, B: [] });
  let step = gen.next();
  assert.equal(step.value.seat, 'B');
  let answer = null;
  const C = vm.runInNewContext(`(class Probe { ${method('_responsePanel')}\n${method('_autoBurnsNow')} })`, {
    h, responseOptions, activeCatalog: session.ctx.catalog,
    memberName: (_s, id) => id,
    cardShort: (_s, id) => id,
    fmtMana: mana => Object.entries(mana).map(([c, n]) => `${n} ${c}`).join(' + '),
  });
  const ui = new C();
  Object.assign(ui, {
    state: session.state, ctx: session.ctx,
    pendingChoice: { req: step.value, resolve: a => { answer = a; } },
    _plannedCardIds: () => new Set(), _renderAll: () => {},
  });
  const panel = ui._responsePanel();
  const button = descendants(panel).find(n => n.tag === 'button' && n.children.join('').startsWith(def.title));
  assert.ok(button);
  const exactPayment = planPayment(pool, cost);
  if (!button.props.disabled) button.props.onclick();
  const choiceId = step.value.choiceId;
  step = gen.next(answer ?? { pass: true });
  while (!step.done) step = gen.next({ pass: true });
  const events = step.value;
  return {
    label, cost, pool, contentValidation: 'accepted',
    responseButtonEnabled: !button.props.disabled,
    rulesCanPay: !!exactPayment,
    suggestedBurns: answer?.burns ?? null,
    matchingEvents: events.filter(e => e.choiceId === choiceId).map(e => ({ type: e.type, reason: e.reason ?? null })),
    damageResolved: events.some(e => e.type === 'card_damage'),
    counterApplied: events.some(e => e.type === 'counter_applied'),
  };
}
const cases = [
  runCase('Mixed cost, one Rainbow (defect)', { red: 1, blue: 1 }, { rainbow: 1 }),
  runCase('Mixed cost, two Rainbow (control)', { red: 1, blue: 1 }, { rainbow: 2 }),
  runCase('Original single-color cost (control)', { blue: 2 }, { blue: 2 }),
];
assert.equal(cases[0].responseButtonEnabled, true);
assert.equal(cases[0].rulesCanPay, false);
assert.deepEqual(cases[0].matchingEvents.map(e => e.type), ['command_rejected', 'passed']);
assert.equal(cases[0].damageResolved, true);
assert.equal(cases[1].rulesCanPay, true);
assert.equal(cases[1].counterApplied, true);
assert.equal(cases[2].counterApplied, true);
console.log(JSON.stringify({
  pin: '164b8dfe46d2b6b8ec0975cc8f53ea5428770230', appBlob: blob,
  scope: 'Actual extracted controller methods + actual rules; minimal DOM-tree stub; no browser rendering',
  cases,
}, null, 2));
