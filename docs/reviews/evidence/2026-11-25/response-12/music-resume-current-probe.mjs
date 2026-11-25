/**
 * Response 12 companion to Review 11's music-resume probe (same fixture, copied unchanged): the
 * cases a still-current resume must still reach, and disposal.
 *
 * Usage: node --experimental-vm-modules <this-file> <repository-root>
 *
 * Reads the actual src/hapa/presentation/soundtrack.js. No browser, network or owner process;
 * timers are advanced by hand. A deterministic lifecycle witness, not a browser timing test.
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
    setTimeout: clock.set, clearTimeout: clock.clear, clearInterval: () => {},
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
    _render() {}, _save() {}, el: { remove() {} },
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


async function run(name, act) {
  const f = await fixture();
  const s = f.soundtrack;
  s.toggleListening(); // Not listening -> Listening -> actual _resume(); A's play is pending
  const pending = f.snapshot();
  const steps = await act(f, s);
  return { case: name, pending, ...steps, warnings: f.warnings, interceptedAcquisitions: f.fetches.map((r) => r.offer.fixture), networkRequests: 0 };
}

const cases = [
  await run('current resume rejected', async (f, s) => {
    s.audio.attempts[0].reject(Object.assign(new Error('fixture: NotAllowedError'), { name: 'NotAllowedError' }));
    await flush();
    const afterRejection = f.snapshot();
    const firedSkipTimer = await f.clock.fireOne(1500);
    return { afterRejection, firedSkipTimer, afterSkip: f.snapshot(),
      pass: afterRejection.status === 'failed' && afterRejection.skipped.includes('A') && firedSkipTimer && f.snapshot().selected === 'B' };
  }),
  await run('current resume never starts (finite start policy)', async (f, s) => {
    const firedStartDeadline = await f.clock.fireOne(8000);
    const afterDeadline = f.snapshot();
    const firedSkipTimer = await f.clock.fireOne(1500);
    return { firedStartDeadline, afterDeadline, firedSkipTimer, afterSkip: f.snapshot(),
      pass: firedStartDeadline && afterDeadline.status === 'failed' && afterDeadline.error === 'playback did not start' && afterDeadline.skipped.includes('A') && f.snapshot().selected === 'B' };
  }),
  await run('current resume starts', async (f, s) => {
    s.audio.attempts[0].resolve();
    await flush();
    const afterStart = f.snapshot();
    return { afterStart, pass: afterStart.status === 'playing' && !afterStart.skipped.length && afterStart.scheduledMs.length === 0 };
  }),
  await run('disposed during a pending resume, then rejected', async (f, s) => {
    s.dispose();
    s.audio.attempts[0].reject(Object.assign(new Error('fixture: AbortError'), { name: 'AbortError' }));
    await flush();
    const afterRejection = f.snapshot();
    return { afterRejection, pass: afterRejection.status === 'playing' && !afterRejection.skipped.length && afterRejection.scheduledMs.length === 0 && f.warnings.length === 0 };
  }),
];
console.log(JSON.stringify({
  schema: 'hapa.versus.response12.resume-current-probe.v1',
  source: { path: 'src/hapa/presentation/soundtrack.js', gitBlobSha: blob },
  method: 'Review 11 fixture: actual module in a local VM; controlled pending Audio.play; manual timers; UI and network fixtures.',
  limitation: 'Deterministic lifecycle witness, not a browser timing or owner integration test.',
  cases,
  allPass: cases.every((c) => c.pass),
}, null, 2));
