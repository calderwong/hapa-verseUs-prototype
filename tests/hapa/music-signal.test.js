/**
 * The measured music frame (Addendum 12 HF12-02): fast onsets, the slow swell and the fine texture
 * are separate; silence, pause, blocked and unavailable analysis are told apart; a seek, a new
 * generation or a hidden-tab gap never fires a stale onset; and no tempo is ever invented.
 *
 * The actual MusicSignal with only the analyser controlled: a synthetic byte spectrum (512 bins at
 * 48 kHz, ≈46.9 Hz per bin) is written into getByteFrequencyData. No audio, browser or owner song.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MusicSignal, METHOD } from '../../src/hapa/presentation/music-signal.js';

const HZ = 24000 / 512;
const bin = (f) => Math.round(f / HZ);
/** A controlled analyser: `spec(t)` returns { low, mid, high } byte levels at song time t. */
function rig(spec) {
  const s = new MusicSignal();
  let t = 0;
  s.ctx = { state: 'running', sampleRate: 48000 };
  s.bins = new Uint8Array(512);
  s.analyser = { getByteFrequencyData(b) { const v = spec(t); b.fill(0); for (let i = 1; i < 512; i++) { const f = i * HZ; b[i] = f < 180 ? v.low : f < 2500 ? v.mid : f < 9000 ? v.high : 0; } } };
  const base = { itemKey: 'song-1', generation: 1, playing: true, listening: true, muted: false, duration: 200, status: 'playing' };
  const run = (secs, o = {}, dt = 1 / 60) => { const n = Math.round(secs / dt); let f; for (let i = 0; i < n; i++) { t += dt; f = s.sample(dt, { ...base, time: t, ...o }); } return f; };
  return { s, run, at: () => t, setT: (v) => { t = v; } };
}
const kick = (period, steady = { low: 60, mid: 90, high: 70 }) => (t) => ({ ...steady, low: (t % period) < 0.06 ? 230 : steady.low });

test('HF12-02: low-band onsets are counted one per kick, with strength; no tempo is claimed', () => {
  const r = rig(kick(0.5));
  r.run(1.5); // warm-up: envelopes and the adaptive threshold settle
  const c0 = r.s.frame.onsetCount;
  const f = r.run(8);
  const n = f.onsetCount - c0;
  assert.ok(n >= 15 && n <= 17, `16 kicks in 8 s → ${n} onsets`);
  assert.ok(f.onsetStrength > 0 && f.onsetStrength <= 1);
  assert.equal(f.version, 2);
  assert.equal(f.state, 'following');
  assert.equal(f.bpm, null); assert.equal(f.beatPhase, null);
  assert.equal(METHOD.tempo, 'not measured');
  assert.match(METHOD.onset, /not a detected beat/);
  assert.match(METHOD.level, /not time-domain RMS/);
});

test('HF12-02: a steady passage gives a swell but no onsets; high-band flicker is texture, not onsets', () => {
  const steady = rig(() => ({ low: 120, mid: 140, high: 90 }));
  steady.run(1.5);
  const c0 = steady.s.frame.onsetCount;
  const f = steady.run(5);
  assert.equal(f.onsetCount - c0, 0, 'no transient → no onset');
  assert.equal(f.state, 'following');
  // a flickering high band moves high01 quickly while the low band (and so onsets) stays put
  const hi = rig((t) => ({ low: 80, mid: 100, high: Math.floor(t * 4) % 2 ? 220 : 40 }));
  hi.run(1.5);
  const h0 = hi.s.frame.onsetCount;
  let lo = 1, up = 0;
  for (let i = 0; i < 60; i++) { const g = hi.run(1 / 30); lo = Math.min(lo, g.high01); up = Math.max(up, g.high01); }
  assert.equal(hi.s.frame.onsetCount - h0, 0, 'high-band flicker fires no onset');
  assert.ok(up - lo > 0.4, `high01 follows the texture (range ${(up - lo).toFixed(2)})`);
  // the swell is slower than the low band: after a sudden step, low01 leads energy01
  const step = rig((t) => (t < 3 ? { low: 30, mid: 30, high: 30 } : { low: 200, mid: 200, high: 200 }));
  step.run(3.2);
  const g = step.run(0.15);
  assert.ok(g.low01 > g.energy01 + 0.2, `fast low ${g.low01.toFixed(2)} leads slow swell ${g.energy01.toFixed(2)}`);
});

test('HF12-02: silence, pause, blocked and unavailable are distinct and quiet', () => {
  const r = rig(() => ({ low: 0, mid: 0, high: 0 }));
  let f = r.run(2);
  assert.equal(f.state, 'silence');
  assert.equal(f.onsetCount, 0);
  assert.ok(f.energy01 < 0.01);
  const k = rig(kick(0.5));
  k.run(3);
  f = k.run(1.5, { playing: false, status: 'paused' });
  const c = f.onsetCount;
  assert.equal(f.state, 'paused');
  assert.equal(f.onset01, 0, 'the pulse released');
  // the soundtrack drops its live item while paused: the state still says paused, not idle
  assert.equal(k.run(0.2, { itemKey: null, generation: -1, playing: false, status: 'paused' }).state, 'paused');
  assert.ok(f.energy01 < k.s.frame.energy01 + 1e-9 && f.low01 < 0.05, 'released toward neutral');
  f = k.run(1, { playing: false, status: 'paused' });
  assert.equal(f.onsetCount, c, 'no onsets while paused');
  // blocked (no song started), and analysis that is not running
  const b = rig(kick(0.5));
  assert.equal(b.run(0.5, { itemKey: null, generation: -1, playing: false, status: 'blocked' }).state, 'blocked');
  assert.equal(b.run(0.5, { itemKey: null, generation: -1, playing: false, status: 'ready' }).state, 'idle');
  const u = rig(kick(0.5));
  u.s.ctx.state = 'suspended';
  f = u.run(2);
  assert.deepEqual([f.state, f.analysis, f.onsetCount, f.energy01], ['unavailable', 'unavailable', 0, 0]);
});

test('HF12-02: a seek, a new generation or a hidden-tab gap resets and never replays an onset', () => {
  const r = rig(kick(0.5));
  r.run(3);
  // a hidden tab: one long frame (dt 5 s) while the song advanced; it is clamped, compared to nothing
  const before = r.s.frame.onsetCount;
  r.setT(r.at() + 5);
  let f = r.s.sample(5, { itemKey: 'song-1', generation: 1, playing: true, listening: true, muted: false, duration: 200, status: 'playing', time: r.at() });
  assert.equal(f.onsetCount, before, 'nothing replayed for the hidden time');
  assert.ok(f.energy01 < 0.05, 'the jump reset the envelopes (a discontinuity is not a crescendo)');
  assert.ok(f.resets > 1, 'the reset is visible to the scene (it drops in-flight pulses)');
  // a new generation (Next, replay, Return): neutral, then warming again before any onset fires
  r.run(2);
  const c = r.s.frame.onsetCount;
  f = r.run(0.3, { itemKey: 'song-2', generation: 2 });
  assert.equal(f.onsetCount, c, 'warm-up after a source change fires nothing');
  assert.equal(f.itemKey, 'song-2'); assert.equal(f.generation, 2);
  f = r.run(3, { itemKey: 'song-2', generation: 2 });
  assert.ok(f.onsetCount > c, 'onsets follow the new song once warm');
});
