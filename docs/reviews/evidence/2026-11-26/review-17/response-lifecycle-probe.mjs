// Bounded source-method orchestration diagnostics. No browser, native storage or network is run.
// Run from the checkout root, or pass its root as the first argument. Results go to stdout.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(process.argv[2] ?? '.');
const read = p => readFileSync(resolve(root, p), 'utf8');
const matchSource = read('src/hapa/network/online-match.js');
const appSource = read('src/hapa/presentation/app.js');
const runtimeSource = read('src/hapa/network/runtime.js');
function method(source, start, end, context = {}) {
  const a = source.indexOf(start);
  assert.ok(a >= 0, start);
  const b = source.indexOf(end, a + start.length);
  assert.ok(b > a, end);
  return vm.runInNewContext(`({${source.slice(a, b)}})`, context);
}

// 1. A real choice method rejects an injected journal append; the real renderer orchestration
// continues its generator and presentation despite the rejection.
let authorityResolved = false, rendererAdvanced = false, playbackStarted = false, appendCalls = 0;
const req = { seat: 'A', choiceId: 'fixture-response-1' };
const authority = {
  matchId: 'fixture-match', seat: 'A',
  current: { count: 7, choices: [], pendingChoice: { req, index: 0, requestHash: 'fixture-request', resolve: () => { authorityResolved = true; } } },
  async _publish() { appendCalls++; throw Object.assign(new Error('injected journal append failure'), { code: 'EIO' }); },
};
const choice = method(matchSource, '  async choice(args) {', '\n  /** Everything').choice;
const notes = [];
const renderer = {
  state: { tick: 7 }, ctx: {}, session: { events: [], replay: { ticks: [] } }, generation: 1, tickEvents: [],
  onlineMatch: { seat: 'A', choices: new Map(), locked: new Map([[7, { plans: { A: [], B: [] } }]]) },
  online: { choice: (count, choiceId, answer) => choice.call(authority, { matchId: authority.matchId, count, choiceId, answer }) },
  async _askResponse() { return { pass: true }; },
  _toast(message) { notes.push(message); },
  async _play() { playbackStarted = true; },
};
const resolveAgreed = method(appSource, '  async _resolveAgreed() {', '\n  /** Release the current match', {
  clone: structuredClone,
  validatePlan: (state, ctx, seat, commands) => ({ accepted: commands }),
  snapshot: () => ({}), momentSlice: () => ({}), stateFingerprint: () => 'fixture-state', hostMessage: e => e.message,
  resolveTick: function* () { yield req; rendererAdvanced = true; return []; },
})._resolveAgreed;
const rendererReturned = await resolveAgreed.call(renderer);
let retryError = null;
try { await choice.call(authority, { matchId: authority.matchId, count: 7, choiceId: req.choiceId, answer: { pass: true } }); }
catch (e) { retryError = { code: e.code, message: e.message }; }
assert.equal(authority.current.pendingChoice, null);
assert.equal(authorityResolved, false);
assert.equal(rendererAdvanced, true);
assert.equal(playbackStarted, true);
assert.equal(retryError.code, 'NO_CHOICE');
const responseBoundary = { injectedFault: 'choice journal append rejects', appendCalls, pendingChoiceAfterFailure: authority.current.pendingChoice, authorityResolverCalled: authorityResolved, retryError, rendererAdvanced, playbackStarted, rendererReturned, toast: notes[0] };

// 2. Real runtime lifecycle methods replace completed match objects, but only the newest is closed.
const opened = [], saved = [], closed = [];
class FakeOnlineMatch {
  constructor(o) { this.o = o; this.matchId = o.session.descriptor.matchId; this.seat = o.session.seat; this.opponent = { participantId: 'opponent', label: 'Opponent' }; this.status = 'opening'; }
  async open() { this.status = 'active'; opened.push(this.matchId); }
  async close() { this.closed = true; closed.push(this.matchId); }
}
const openMatch = method(runtimeSource, '  async _openMatch(session) {', '\n  /** Reopen an active match', { verifyBody: () => true, OnlineMatch: FakeOnlineMatch })._openMatch;
const onComplete = method(runtimeSource, '  _onComplete(m) {', '\n  // --- results:')._onComplete;
const closeRuntime = method(runtimeSource, '  async close() {', '\n}', { clearInterval: () => {} }).close;
const runtime = {
  state: 'open', controllerKind: 'human', identity: {}, store: { path: (...xs) => xs.join('/'), release() {} },
  emit() {}, log() {}, _reserve() {}, async _saveResult(m) { saved.push(m.matchId); },
};
const authorities = [];
for (let i = 1; i <= 3; i++) {
  const session = { seat: 'A', descriptor: { matchId: `fixture-match-${i}`, players: { A: { publicKey: 'a' }, B: { publicKey: 'b' } } }, sigs: { A: 'a', B: 'b' } };
  const m = await openMatch.call(runtime, session); authorities.push(m);
  m.status = 'complete'; onComplete.call(runtime, m);
  await Promise.resolve();
}
const beforeShutdown = [...closed];
await closeRuntime.call(runtime);
assert.equal(beforeShutdown.length, 0);
assert.deepEqual(closed, ['fixture-match-3']);
const completedAuthorityLifecycle = { model: 'Fake authority/storage handles measure calls from unchanged PeerRuntime methods; no native resources allocated.', opened, saved, closeCallsBeforeShutdown: beforeShutdown, closeCallsAfterShutdown: closed, replacedAuthoritiesNeverClosed: authorities.filter(m => !m.closed).map(m => m.matchId) };

const out = { reviewBaseline: 'd113216c8473cf8fc1809e7720cd7a09ad76fa6b', node: process.version, method: 'Exact source methods evaluated with explicit stubs around storage, signatures, rules generator and presentation. Tests orchestration only; no browser, native Hypercore, network, frame timing or resource measurement.', responseBoundary, completedAuthorityLifecycle };
console.log(JSON.stringify(out, null, 2));
