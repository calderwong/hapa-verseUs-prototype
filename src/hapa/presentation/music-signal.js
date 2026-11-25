/**
 * A read-only music signal for the setting (Assignment 13 §3E; companion §5–§6).
 *
 * One optional analysis tap on the table's single music element: source → owned gain → speakers,
 * with a separate source → analyser branch. Red's voice and the game's sounds have their own
 * outputs and never enter this graph, so the signal is the music alone (a full-mix spectrum: no
 * claim about isolated instruments). The graph is created at most once for the element's lifetime,
 * after a user gesture; if it cannot be built before the element is attached, ordinary playback
 * continues without analysis. Once attached the audible path is kept even if analysis fails.
 *
 * The frame is bound to the exact active item and its playback generation and to the element's own
 * clock (`currentTime`), never to the game's Tick or Playback speed. Envelopes are smoothed and
 * normalized with a floor (silence cannot amplify noise into a crescendo); a source change, a seek
 * or a pause resets or releases them so no previous song's response lingers. Nothing here can
 * change a rule, a camera or a target.
 */

const BIN_HZ_FFT = 1024;
const SAMPLE_S = 1 / 30; // analysis rate; envelopes interpolate in the render update

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
    this.frame = { itemKey: null, assetId: null, recordingId: null, generation: -1, sourceTimeSeconds: 0, durationSeconds: 0, playing: false, listening: false, muted: false, analysis: 'unavailable', energy01: 0, low01: 0, high01: 0, accent01: 0 };
    this._acc = 0;
    this._raw = { energy: 0, low: 0, high: 0 };
    this._norm = { energy: 0.25, low: 0.25, high: 0.25 }; // running peaks
    this._floor = { energy: 0, low: 0, high: 0 }; // running floors
    this._avgLow = 0;
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
      an.smoothingTimeConstant = 0.55;
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
    f.energy01 = f.low01 = f.high01 = f.accent01 = 0;
    this._raw.energy = this._raw.low = this._raw.high = 0;
    this._norm = { energy: 0.25, low: 0.25, high: 0.25 };
    this._floor = { energy: 0, low: 0, high: 0 };
    this._avgLow = 0;
    this._sinceAccent = 0;
    this._warm = 0;
  }

  /**
   * One sample per render frame.
   * @param {number} dt presentation seconds (clamped; a hidden tab does not replay missed accents)
   * @param {{ itemKey: string|null, assetId?: string|null, recordingId?: string|null, generation: number, playing: boolean, listening: boolean, muted: boolean, time: number, duration: number }} s
   * @param {{ accentGap?: number }} [o]
   */
  sample(dt, s, o = {}) {
    dt = Math.min(Math.max(dt || 0, 0), 0.1);
    const f = this.frame;
    if (s.itemKey !== f.itemKey || s.generation !== f.generation) { this.reset(); f.itemKey = s.itemKey; f.generation = s.generation; f.assetId = s.assetId ?? null; f.recordingId = s.recordingId ?? null; }
    else if (s.playing && Math.abs(s.time - this._lastTime) > 0.75 + dt * 2) this.reset(); // a seek
    this._lastTime = s.time;
    f.sourceTimeSeconds = s.time || 0;
    f.durationSeconds = Number.isFinite(s.duration) ? s.duration : 0;
    f.playing = s.playing; f.listening = s.listening; f.muted = s.muted;
    const measured = !!(this.analyser && this.ctx?.state === 'running');
    f.analysis = measured ? 'measured' : 'unavailable';
    this._sinceAccent += dt;
    if (measured && s.playing) {
      this._acc += dt;
      if (this._acc >= SAMPLE_S) { this._acc = 0; this._measure(); }
      this._warm = Math.min(1, this._warm + dt / 0.6);
    } else {
      // paused, ended, not listening or unavailable: release toward neutral, never fabricate beats
      this._raw.energy = this._raw.low = this._raw.high = 0;
      this._warm = 0;
    }
    const w = this._warm;
    f.energy01 = env(f.energy01, this._raw.energy * w, dt, 0.9, 2.2);
    f.low01 = env(f.low01, this._raw.low * w, dt, 0.1, 0.45);
    f.high01 = env(f.high01, this._raw.high * w, dt, 0.15, 0.5);
    // a rare accent: the low band clearly above its own recent average, after a cooldown
    this._avgLow = env(this._avgLow, this._raw.low, dt, 1.6, 1.6);
    const gap = o.accentGap ?? 6;
    if (s.playing && w >= 1 && this._sinceAccent > gap && this._raw.low > 0.55 && this._raw.low > this._avgLow * 1.45) { f.accent01 = 1; this._sinceAccent = 0; }
    else f.accent01 = Math.max(0, f.accent01 - dt / 1.2);
    return f;
  }

  _measure() {
    const an = this.analyser, b = this.bins;
    an.getByteFrequencyData(b);
    const hz = (this.ctx.sampleRate / 2) / b.length;
    const band = (lo, hi) => {
      const i0 = Math.max(1, Math.floor(lo / hz)), i1 = Math.min(b.length - 1, Math.ceil(hi / hz));
      let s = 0; for (let i = i0; i <= i1; i++) s += b[i];
      return s / ((i1 - i0 + 1) * 255);
    };
    const raw = { energy: band(40, 6000), low: band(40, 180), high: band(2500, 9000) };
    for (const k of ['energy', 'low', 'high']) {
      // normalize within this song's own recent range: a running peak that falls slowly and a running
      // floor that rises slowly, with a minimum span so silence or a flat passage cannot be amplified
      // into a crescendo; quiet passages read low, swells read high
      const pk = this._norm[k] = Math.max(raw[k], this._norm[k] * 0.9975);
      const fl = this._floor[k] = Math.min(raw[k], this._floor[k] + (raw[k] - this._floor[k]) * 0.004);
      this._raw[k] = Math.max(0, Math.min(1, (raw[k] - fl) / Math.max(0.1, pk - fl)));
    }
  }

  dispose() {
    try { this.src?.disconnect(); this.analyser?.disconnect(); this.gain?.disconnect(); } catch { /* already released */ }
    try { this.ctx?.close(); } catch { /* already closed */ }
    this.ctx = this.gain = this.analyser = this.src = null;
  }
}
