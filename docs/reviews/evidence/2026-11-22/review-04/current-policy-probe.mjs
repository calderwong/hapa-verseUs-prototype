// Historical current-policy observation for implementation
// 164b8dfe46d2b6b8ec0975cc8f53ea5428770230 (also unchanged in a388bcf9).
// A zero exit means the older unfunded-endpoint behavior was reproduced.
// This is NOT a failure of the old specification: v3 permits partial travel,
// retaining the destination and receiving more Supply later. A zero-Supply
// order may be stored by this implementation but cannot begin paid travel.
// Do not add this historical probe as a permanent regression acceptance test
// for CJ's newly selected, Supply-funded endpoint policy.
// No browser, UI appearance, rendering or live-game behavior is exercised.
//
// Intended repository location:
// docs/reviews/evidence/2026-11-22/review-04/current-policy-probe.mjs
// Run there with no argument, or pass an isolated pinned repository root:
// node path/to/current-policy-probe.mjs /path/to/reviewed-checkout

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = process.argv[2]
  ? path.resolve(process.argv[2])
  : fileURLToPath(new URL('../../../../../', import.meta.url));

// Pin the relevant directly exercised fixture and rule files. The parent
// review records acquisition/identity of the rest of this source snapshot.
const expectedBlobs = {
  'fixtures/hapa/scenarios.js': '71e3208c1b2992e3632a758227123370db8c8262',
  'src/hapa/rules/match.js': 'a914479934f1631cebfa6b655cdec8180a086959',
  'src/hapa/rules/movement.js': '58a42a77b1f9a223bcd25467a64b5fca117cc9dd',
  'src/hapa/rules/economy.js': '83aea68bdf0e6cba4212839afba6eb5f286c2b16',
};
for (const [relative, expected] of Object.entries(expectedBlobs)) {
  const data = fs.readFileSync(path.join(repoRoot, relative));
  const actual = crypto.createHash('sha1')
    .update(`blob ${data.length}\0`).update(data).digest('hex');
  assert.equal(actual, expected, `Historical source mismatch: ${relative}`);
}

const load = relative => import(pathToFileURL(path.join(repoRoot, relative)).href);
const [
  { scenario },
  { beginCount, validatePlan },
  { legalDestinations, planPartyRoute, routeOrigin },
  { supplyOf },
] = await Promise.all([
  load('fixtures/hapa/scenarios.js'),
  load('src/hapa/rules/match.js'),
  load('src/hapa/rules/movement.js'),
  load('src/hapa/rules/economy.js'),
]);

function probe(mount, column, row, supply, target, tickBefore = 0) {
  const fx = scenario({ parties: [{
    id: 'A.probe', owner: 'A', mount, column, row,
    slots: { 5: 'center' }, supply,
  }] });
  // These are explicitly prepared diagnostic states, not claimed play traces.
  // Tick 1 activates C1/C9; Tick 2 activates C2/C8 for the Knight example.
  fx.state.tick = tickBefore;
  beginCount(fx.state, fx.ctx);
  const party = fx.state.parties['A.probe'];
  const route = planPartyRoute(
    fx.state, fx.ctx, party, routeOrigin(fx.state, fx.ctx, party), target,
  );
  const command = { type: 'set_destination', partyId: party.id, target };
  const validation = validatePlan(fx.state, fx.ctx, 'A', [command]);
  const offered = legalDestinations(fx.state, fx.ctx, party)
    .some(d => d.column === target.column && d.row === target.row);
  return {
    mount, from: { column, row }, supply: supplyOf(party) / fx.ctx.U,
    target, routeCostSteps: route.cost, offered,
    accepted: validation.ok, errors: validation.errors,
  };
}

const cases = [
  probe('castle', 1, 3, 0, { column: 1, row: 7 }),
  probe('castle', 1, 3, 2, { column: 1, row: 7 }),
  probe('knight', 2, 2, 2, { column: 3, row: 4 }, 1),
];
assert.deepEqual(cases.map(c => c.routeCostSteps), [4, 4, 3]);
assert.equal(cases.every(c => c.offered && c.accepted && c.errors.length === 0), true);
assert.equal(cases.every(c => c.supply < c.routeCostSteps), true);

console.log(JSON.stringify({
  implementationCommit: '164b8dfe46d2b6b8ec0975cc8f53ea5428770230',
  scope: 'Read-only current-policy observation using real route/validation modules; no browser. Current implementation does not require a fully funded endpoint.',
  cases,
}, null, 2));
