/**
 * Review 11 diagnostic packaged from the executed pinned-source witness.
 * Usage: node <this-file> <repository-root>
 * Fetch is stubbed. No live model, owner or browser request.
 * Results beside this file are the original run; reruns report current module bytes.
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = process.argv[2];
if (!root) throw new Error('Pass the repository root as the sole argument.');
const source = (path) => pathToFileURL(resolve(root, path)).href;
const { createSession, openTick } = await import(source('src/hapa/rules/session.js'));
const { profileById, DEFAULT_PROFILE_ID } = await import(source('fixtures/hapa/profiles.js'));
const { CATALOG } = await import(source('fixtures/hapa/content.js'));
const { HeuristicBot } = await import(source('src/hapa/controllers/heuristic-bot.js'));
const { ModelDecider } = await import(source('src/hapa/controllers/model-decider.js'));
const moduleBytes = await readFile(resolve(root, 'src/hapa/controllers/model-decider.js'));
const currentModuleBlob = createHash('sha1').update(`blob ${moduleBytes.length}\0`).update(moduleBytes).digest('hex');

const unhandledErrors = [];
const onUnhandled = (error) => unhandledErrors.push(error?.message ?? String(error));
process.on('unhandledRejection', onUnhandled);
const calls = [];
globalThis.fetch = async (url, init) => {
  calls.push({ url, requestId: JSON.parse(init.body).request?.ref.request_id ?? null });
  return { ok: true, status: 200, json: async () => null };
};
const session = createSession({ matchId: 'review11-null-response', profile: profileById(DEFAULT_PROFILE_ID), catalog: CATALOG, seed: 1 });
openTick(session);
const app = { session, ctx: session.ctx, generation: 1, get state() { return session.state; } };
const bot = new HeuristicBot({ seat: 'B', seed: 4 });
const deadlineMs = 20, guardMs = 150;
const decider = new ModelDecider({ seat: 'B', avatarId: 'red-reaper', identityRevision: 'red-v1.0', deadlines: { plan: deadlineMs } });
const pending = decider.plan(app, bot);
const observed = await Promise.race([
  pending.then((out) => ({ settled: true, rejected: false, source: out.source, outcome: out.receipt?.outcome }), (error) => ({ settled: true, rejected: true, error: error?.message ?? String(error) })),
  new Promise((resolve) => setTimeout(() => resolve({ settled: false }), guardMs)),
]);
const result = {
  reviewBaselineCommit: '7d4a96bd753f8b0e79ac46e3ad0c1e206e54ea36',
  sourceUnderTest: { modulePath: 'src/hapa/controllers/model-decider.js', gitBlobSha: currentModuleBlob },
  environment: 'headless source-only; fetch stubbed; no services, model, or browser',
  case: 'HTTP 200 with parsed JSON null',
  deadlineMs, guardMs, observed, unhandledErrors,
  requestCount: calls.filter((c) => c.url.endsWith('/game-decision')).length,
  cancellationCount: calls.filter((c) => c.url.endsWith('/game-decision-cancel')).length,
  receipts: decider.receipts,
  remainingInflightHandles: decider.inflight?.size ?? 0,
  remainingSettlementHandles: decider._settle?.size ?? 0,
};
decider.dispose();
process.removeListener('unhandledRejection', onUnhandled);
console.log(JSON.stringify(result, null, 2));

