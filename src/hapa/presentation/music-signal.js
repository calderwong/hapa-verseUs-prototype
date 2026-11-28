/**
 * A read-only music signal for the setting (Assignment 13 §3E; companion §5–§6; Addendum 12 HF12-02).
 *
 * One optional analysis tap on the table's single music element: source → owned gain → speakers,
 * with a separate source → analyser branch. Red's voice and the game's sounds have their own
 * outputs and never enter this graph, so the signal is the music alone (a full-mix spectrum: no
 * claim about isolated instruments). The graph is created at most once for the element's lifetime,
 * after a user gesture; if it cannot be built before the element is attached, ordinary playback
 * continues without analysis. Once attached the audible path is kept even if analysis fails.
 *
 * The frame is bound to the exact active item and its playback generation and to the element's own
 * clock (`currentTime`), never to the game's Tick or Playback speed. It carries three separated
 * time scales (frame `version` 2):
 * - fast: `onset01` / `onsetCount` / `onsetStrength` — a rise in low-band spectral flux above its
 *   own adaptive threshold (a musical onset such as a kick or bass attack). Not a detected beat:
 *   there is no tempo, beat phase or bar here (`bpm` and `beatPhase` stay null), and `low01`;
 * - slow: `energy01` (0.9 s attack / 2.2 s release) and `mid01`, the swell;
 * - fine: `high01`, the high-band texture.
 * Levels are mean byte magnitudes of the analyser's spectrum in each band (not time-domain RMS),
 * normalized within this song's own recent range with a floor (silence cannot amplify noise into a
 * crescendo). A source change, a seek or a pause resets or releases them so no previous song's
 * response lingers; a hidden-tab gap never replays missed onsets. `state` says what the response is
 * following: `following`, `silence` (measured, too quiet to respond), `paused`, `blocked`, `idle`
 * (no song) or `unavailable` (playing, but analysis is not running). Nothing here can change a rule,
 * a camera or a target.
 */

const BIN_HZ_FFT = 1024;
const SAMPLE_S = 1 / 60; // analysis rate (at most one per render frame); onsets need frame-rate resolution
/** Bands in Hz. Low carries onsets (kick, bass attack); high is the fine texture. */
export const BANDS = { energy: [40, 6000], low: [40, 180], mid: [180, 2500], high: [2500, 9000], onset: [40, 250] };
/** The stated measurement method (published with the frame; companion §6.2, HF12-02). */
export const METHOD = Object.freeze({
  level: 'mean byte magnitude of the analyser spectrum per band (fftSize 1024), normalized to this song\'s recent range (the swell blends in half of the absolute level); not time-domain RMS',
  onset: 'positive low-band (40–250 Hz) spectral flux above an adaptive mean + deviation threshold, at most one per 110 ms; an onset, not a detected beat',
  tempo: 'not measured',
});
const ONSET_GAP = 0.11; // s between onsets (≈ a sixteenth at 136 BPM: no tempo is assumed from it)

/** Smoothed approach with separate attack and release times (seconds). */
const env = (cur, target, dt, attack, release) => cur + (target - cur) * (1 - Math.exp(-dt / (target > cur ? attack : release)));

export class MusicSignal {
  constructor() {
    this.ctx = null;
    this.gain = null;
    this.analyser = null;
    this.failed = false;
    this.bins = null;
    /** the reused frame (companion §6.2) */
    this.frame = { version: 2, method: METHOD, itemKey: null, assetId: null, recordingId: null, generation: -1, sourceTimeSeconds: 0, durationSeconds: 0, playing: false, listening: false, muted: false, analysis: 'unavailable', state: 'idle', resets: 0,
      energy01: 0, low01: 0, mid01: 0, high01: 0, accent01: 0, onset01: 0, onsetStrength: 0, onsetCount: 0, bpm: null, beatPhase: null };
    this._acc = 0;
    this._raw = { energy: 0, low: 0, mid: 0, high: 0 };
    this._norm = { energy: 0.25, low: 0.25, mid: 0.25, high: 0.25 }; // running peaks
    this._floor = { energy: 0, low: 0, mid: 0, high: 0 }; // running floors
    this._level = 0; // the last measured absolute full-mix level (silence check)
    this._avgLow = 0;
    this._prev = null; // the previous spectrum (onset flux)
    this._flux = { mean: 0, dev: 0, last: 0, rising: false, peak: 0.02, since: 99 };
    this._hadPrev = false;
    this._sinceAccent = 99;
    this._warm = 0;
    this._lastTime = 0;
  }

  /**
   * Route the element through one owned graph. Call from a user gesture. Returns true when the
   * element plays through the graph (its gain then owns the effective volume).
   * @param {HTMLAudioElement} audio
   */
  attach(audio) {
    if (this.ctx) return true;
    if (this.failed) return false;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) { this.failed = true; return false; }
    let ctx = null;
    try {
      ctx = new AC();
      const gain = ctx.createGain();
      gain.connect(ctx.destination); // the audible path exists before the element is rerouted
      const src = ctx.createMediaElementSource(audio);
      src.connect(gain);
      this.ctx = ctx; this.gain = gain; this.src = src;
    } catch (e) {
      // not attached: the element keeps its ordinary output
      try { ctx?.close(); } catch { /* nothing to release */ }
      this.failed = true;
      console.warn(`[versus] music analysis unavailable: ${e.message}`);
      return false;
    }
    try {
      const an = this.ctx.createAnalyser();
      an.fftSize = BIN_HZ_FFT;
      an.smoothingTimeConstant = 0.3; // light: onsets need transients; envelopes smooth below
      this.src.connect(an);
      this.analyser = an;
      this.bins = new Uint8Array(an.frequencyBinCount);
    } catch (e) { console.warn(`[versus] music analysis unavailable (playback continues): ${e.message}`); }
    return true;
  }

  /** Resume a suspended graph (inside a gesture); resolves to whether it is running. */
  async resume() {
    if (!this.ctx) return true;
    if (this.ctx.state === 'running') return true;
    try { await Promise.race([this.ctx.resume(), new Promise((r) => setTimeout(r, 1500))]); } catch { /* reported below */ }
    return this.ctx.state === 'running';
  }

  setGain(v) { if (this.gain) this.gain.gain.value = v; }

  /** Reset envelopes: a new item, a new generation or a discontinuity is not a musical impact. */
  reset() {
    const f = this.frame;
    f.resets = (f.resets ?? 0) + 1; // consumers drop in-flight transients when this changes (a seek)
    f.energy01 = f.low01 = f.mid01 = f.high01 = f.accent01 = f.onset01 = f.onsetStrength = 0;
    this._raw = { energy: 0, low: 0, mid: 0, high: 0 };
    this._norm = { energy: 0.25, low: 0.25, mid: 0.25, high: 0.25 };
    this._floor = { energy: 0, low: 0, mid: 0, high: 0 };
    this._level = 0;
    this._avgLow = 0;
    this._prev = null; this._hadPrev = false; // a discontinuity is not an onset
    this._flux = { mean: 0, dev: 0, last: 0, rising: false, peak: 0.02, since: 99 };
    this._sinceAccent = 0;
    this._warm = 0;
  }

  /**
   * One sample per render frame.
   * @param {number} dt presentation seconds (clamped; a hidden tab does not replay missed onsets)
   * @param {{ itemKey: string|null, assetId?: string|null, recordingId?: string|null, generation: number, playing: boolean, listening: boolean, muted: boolean, time: number, duration: number, status?: string }} s
   * @param {{ accentGap?: number }} [o]
   */
  sample(dt, s, o = {}) {
    const gap = (dt || 0) > 0.1; // a hidden tab or a stall: the spectrum before it is not comparable
    dt = Math.min(Math.max(dt || 0, 0), 0.1);
    const f = this.frame;
    if (s.itemKey !== f.itemKey || s.generation !== f.generation) { this.reset(); f.itemKey = s.itemKey; f.generation = s.generation; f.assetId = s.assetId ?? null; f.recordingId = s.recordingId ?? null; }
    else if (s.playing && Math.abs(s.time - this._lastTime) > 0.75 + dt * 2) this.reset(); // a seek
    if (gap) { this._prev = null; this._hadPrev = false; }
    this._lastTime = s.time;
    f.sourceTimeSeconds = s.time || 0;
    f.durationSeconds = Number.isFinite(s.duration) ? s.duration : 0;
    f.playing = s.playing; f.listening = s.listening; f.muted = s.muted;
    const measured = !!(this.analyser && this.ctx?.state === 'running');
    f.analysis = measured ? 'measured' : 'unavailable';
    this._sinceAccent += dt;
    this._flux.since += dt;
    let onset = 0;
    if (measured && s.playing) {
      this._acc += dt;
      if (this._acc >= SAMPLE_S - 1e-4) { const step = this._acc; this._acc = 0; onset = this._measure(step); }
      this._warm = Math.min(1, this._warm + dt / 0.6);
    } else {
      // paused, ended, not listening or unavailable: release toward neutral, never fabricate onsets
      this._raw = { energy: 0, low: 0, mid: 0, high: 0 };
      this._warm = 0; this._prev = null; this._hadPrev = false; this._acc = 0;
    }
    const w = this._warm;
    const silent = measured && s.playing && this._level < 0.012;
    f.state = s.status === 'blocked' ? 'blocked' : s.status === 'paused' || (s.itemKey && !s.playing) ? 'paused' : !s.itemKey ? 'idle' : !measured ? 'unavailable' : silent ? 'silence' : 'following';
    f.energy01 = env(f.energy01, this._raw.energy * w, dt, 0.9, 2.2);
    f.mid01 = env(f.mid01, this._raw.mid * w, dt, 0.35, 1.1);
    f.low01 = env(f.low01, this._raw.low * w, dt, 0.04, 0.3);
    f.high01 = env(f.high01, this._raw.high * w, dt, 0.06, 0.35);
    // the fast cue: a detected onset jumps to its strength and decays in ~0.35 s
    if (onset > 0 && w >= 1 && !silent) { f.onsetCount++; f.onsetStrength = onset; f.onset01 = Math.max(f.onset01, onset); }
    else f.onset01 = Math.max(0, f.onset01 - dt / 0.35);
    // a rare accent: the low band clearly above its own recent average, after a cooldown
    this._avgLow = env(this._avgLow, this._raw.low, dt, 1.6, 1.6);
    const ag = o.accentGap ?? 6;
    if (s.playing && w >= 1 && this._sinceAccent > ag && this._raw.low > 0.55 && this._raw.low > this._avgLow * 1.45) { f.accent01 = 1; this._sinceAccent = 0; }
    else f.accent01 = Math.max(0, f.accent01 - dt / 1.2);
    return f;
  }

  /**
   * Measure one spectrum. Returns an onset's strength (0 when none).
   * @param {number} step seconds since the previous measurement (time-based normalization)
   */
  _measure(step) {
    const an = this.analyser, b = this.bins;
    an.getByteFrequencyData(b);
    const hz = (this.ctx.sampleRate / 2) / b.length;
    const range = ([lo, hi]) => [Math.max(1, Math.floor(lo / hz)), Math.min(b.length - 1, Math.ceil(hi / hz))];
    const band = (r) => { const [i0, i1] = range(r); let s = 0; for (let i = i0; i <= i1; i++) s += b[i]; return s / ((i1 - i0 + 1) * 255); };
    const raw = { energy: band(BANDS.energy), low: band(BANDS.low), mid: band(BANDS.mid), high: band(BANDS.high) };
    this._level = raw.energy;
    // the running peak falls (τ ≈ 13 s) and the floor rises (τ ≈ 8 s) slowly, with a minimum span, so
    // a quiet passage reads low and a swell reads high within the song's own range
    const fall = Math.exp(-step / 13.3), rise = 1 - Math.exp(-step / 8.3);
    for (const k of ['energy', 'low', 'mid', 'high']) {
      const pk = this._norm[k] = Math.max(raw[k], this._norm[k] * fall);
      const fl = this._floor[k] = Math.min(raw[k], this._floor[k] + (raw[k] - this._floor[k]) * rise);
      this._raw[k] = Math.max(0, Math.min(1, (raw[k] - fl) / Math.max(0.1, pk - fl)));
    }
    // the swell also keeps half of the absolute level, so a quieter passage (or a quieter recording)
    // stays visibly lower instead of being normalized up to the same breathing
    this._raw.energy = 0.5 * this._raw.energy + 0.5 * Math.max(0, Math.min(1, (raw.energy - 0.2) / 0.45));
    // onset: positive spectral flux in the low band, against its own adaptive mean + deviation
    const [i0, i1] = range(BANDS.onset);
    const prev = this._prev ?? (this._prev = new Uint8Array(b.length));
    let flux = 0;
    const had = this._hadPrev;
    for (let i = i0; i <= i1; i++) { const d = b[i] - prev[i]; if (d > 0) flux += d; }
    flux /= (i1 - i0 + 1) * 255;
    prev.set(b);
    this._hadPrev = true;
    const F = this._flux, k = 1 - Math.exp(-step / 1.2);
    if (!had) { F.last = flux; return 0; }
    const thr = F.mean + 1.6 * F.dev + 0.012;
    let out = 0;
    // fire at the peak of a rise above the threshold (one frame of latency), never inside the gap
    if (F.rising && flux < F.last && F.last > thr && F.since >= ONSET_GAP) {
      F.peak = Math.max(F.last, F.peak * Math.exp(-step / 20));
      out = Math.max(0.2, Math.min(1, (F.last - thr) / Math.max(0.02, F.peak - thr) * 0.8 + 0.2));
      F.since = 0;
    }
    F.rising = flux > F.last;
    F.last = flux;
    F.mean += (flux - F.mean) * k;
    F.dev += (Math.abs(flux - F.mean) - F.dev) * k;
    return out;
  }

  dispose() {
    try { this.src?.disconnect(); this.analyser?.disconnect(); this.gain?.disconnect(); } catch { /* already released */ }
    try { this.ctx?.close(); } catch { /* already closed */ }
    this.ctx = this.gain = this.analyser = this.src = null;
  }
}
