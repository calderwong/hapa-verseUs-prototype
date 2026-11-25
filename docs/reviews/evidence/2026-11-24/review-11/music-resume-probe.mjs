/**
 * Narrow deterministic probe of Soundtrack's resume rejection lifecycle.
 *
 * Usage:
 *   node --experimental-vm-modules resume-stale-rejection-probe.mjs /path/to/repository-root
 *
 * Reads the actual src/hapa/presentation/soundtrack.js at that root. No source rewrite,
 * browser, network, owner process or wall-clock timeout is used. DOM rendering and audio
 * are fixtures; real Soundtrack prototype methods handle resume, opt-out, Next and failure.
 * A held audio.play() promise is explicitly rejected after its attempt is superseded.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const root = process.argv[2];
if (!root) throw new Error('Pass the repository root as the sole argument.');
if (!vm.SourceTextModule) throw new Error('Run Node with --experimental-vm-modules.');
const sourcePath = resolve(root, 'src/hapa/presentation/soundtrack.js');
const sourceBytes = await readFile(sourcePath);
const source = sourceBytes.toString('utf8');
const blob = createHash('sha1').update(`blob ${sourceBytes.length}\0`).update(sourceBytes).digest('hex');
const reviewedBlob = '3b014bcb0b85c63f350a0c924c6793aeb5baa9be';

class Clock {
  next = 1;
  jobs = new Map();
  set = (fn, delay) => { const id = this.next++; this.jobs.set(id, { fn, delay }); return id; };
  clear = (id) => this.jobs.delete(id);
  async fireOne(delay) {
    const item = [...this.jobs].find(([, job]) => job.delay === delay);
    if (!item) return false;
    this.jobs.delete(item[0]);
    item[1].fn();
    await flush();
    return true;
  }
}

class HeldAudio {
  src = 'blob:fixture-A';
  paused = true;
  attempts = [];
  play() {
    this.paused = false;
    const attempt = { source: this.src };
    this.attempts.push(attempt);
    return new Promise((resolve, reject) => Object.assign(attempt, { resolve, reject }));
  }
  pause() { this.paused = true; }
  getAttribute(name) { return name === 'src' ? this.src || null : null; }
  removeAttribute(name) { if (name === 'src') this.src = ''; }
  load() { this.paused = true; }
}

function flush() { return new Promise((resolve) => setImmediate(resolve)); }

async function fixture() {
  const clock = new Clock(), warnings = [], fetches = [], revoked = [];
  const context = vm.createContext({
    EventTarget, AbortController,
    console: { warn: (line) => warnings.push(String(line)) },
    setTimeout: clock.set, clearTimeout: clock.clear,
    URL: { revokeObjectURL: (url) => revoked.push(url) },
    // Keep initial acquisition pending without performing a network request. Abort behaves
    // like fetch so superseding B also exercises _load's existing generation fence.
    fetch: (url, options) => {
      fetches.push({ url, offer: JSON.parse(options.body).offer });
      return new Promise((_, reject) => {
        if (options.signal.aborted) return reject(options.signal.reason);
        options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
      });
    },
  });
  const mod = new vm.SourceTextModule(source, { context, identifier: sourcePath });
  const dom = new vm.SyntheticModule(['h'], function () {
    this.setExport('h', () => { throw new Error('Unexpected DOM render in this probe.'); });
  }, { context, identifier: 'fixture:dom' });
  await mod.link((specifier) => {
    if (specifier !== './dom.js') throw new Error(`Unexpected dependency: ${specifier}`);
    return dom;
  });
  await mod.evaluate();

  // Bypass constructor-only DOM setup, leaving the actual playback methods untouched.
  const soundtrack = Object.create(mod.namespace.Soundtrack.prototype);
  const entries = ['A', 'B', 'C'].map((id) => ({ queueEntryId: id, title: id, offer: { fixture: id } }));
  Object.assign(soundtrack, {
    queue: { revision: 1, controllerSeat: 'A', entries, index: 0 },
    listener: { seat: 'A', library: 'fixture' },
    settings: { listening: false, muted: false, volume: 0.55 },
    playGen: 0, active: { gen: 0, entry: entries[0], url: 'blob:fixture-A' },
    audio: new HeldAudio(), status: 'playing', error: null,
    isController: true, disposed: false, _pending: null,
    _render() {}, _save() {},
  });
  const snapshot = () => ({
    selected: soundtrack.now.queueEntryId,
    revision: soundtrack.queue.revision,
    listening: soundtrack.settings.listening,
    status: soundtrack.status,
    error: soundtrack.error,
    active: soundtrack.active?.entry.queueEntryId ?? null,
    playGeneration: soundtrack.playGen,
    skipped: entries.filter((e) => e.skipped).map((e) => e.queueEntryId),
    paused: soundtrack.audio.paused,
    scheduledMs: [...clock.jobs.values()].map((job) => job.delay).sort((a, b) => a - b),
  });
  return { soundtrack, clock, warnings, fetches, revoked, snapshot };
}

async function probe(supersede) {
  const f = await fixture();
  const { soundtrack: s } = f;
  s.toggleListening(); // Not listening -> Listening -> actual _resume(); A's play stays pending.
  const pendingResume = f.snapshot();
  if (s.audio.attempts.length !== 1) throw new Error('Fixture did not start exactly one resume.');
  if (supersede === 'not-listening') s.toggleListening();
  else s.next(); // B acquisition stays pending in the network-disabled fixture.
  const afterSupersession = f.snapshot();
  const interruption = new Error('fixture: pending play interrupted after supersession');
  interruption.name = 'AbortError';
  s.audio.attempts[0].reject(interruption);
  await flush();
  const afterStaleRejection = f.snapshot();
  const firedSkipTimer = await f.clock.fireOne(1500);
  const afterSkip = f.snapshot();
  return {
    supersede,
    expected: 'A superseded resume rejection leaves the current status and queue unchanged.',
    pendingResume, afterSupersession, afterStaleRejection,
    firedSkipTimer, afterSkip,
    staleRejectionChangedStatus: afterSupersession.status !== afterStaleRejection.status,
    staleRejectionMarkedCurrentSkipped: afterStaleRejection.skipped.includes(afterSupersession.selected),
    staleRejectionAdvancedQueue: afterSkip.selected !== afterSupersession.selected,
    warnings: f.warnings,
    interceptedAcquisitions: f.fetches.map((request) => request.offer.fixture),
    networkRequests: 0,
  };
}

const cases = [await probe('not-listening'), await probe('next')];
console.log(JSON.stringify({
  schema: 'hapa.versus.review11.resume-stale-rejection-probe.v1',
  reviewBaselineCommit: '7d4a96bd753f8b0e79ac46e3ad0c1e206e54ea36',
  reviewBaselineImplementationCommit: 'bafc36f1e40c46ab69cd8b239e6014acbc1393df',
  source: { path: sourcePath, gitBlobSha: blob, reviewedGitBlobSha: reviewedBlob, matchesReviewedBlob: blob === reviewedBlob },
  method: 'Actual module in a local VM; controlled pending Audio.play rejection; manual 1500ms timer; UI and network fixtures.',
  limitation: 'Deterministic lifecycle reproduction, not a browser timing or owner integration test.',
  cases,
  reproduced: cases.every((c) => c.staleRejectionChangedStatus && c.staleRejectionMarkedCurrentSkipped && c.staleRejectionAdvancedQueue),
}, null, 2));
