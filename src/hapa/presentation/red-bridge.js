/**
 * Red's owner renderer inside the packaged desktop app (review 18, R18-01).
 *
 * Harbor's RedPlayer resolves its package resources against the page origin, and the avatar package
 * contract it uses (pinned from Mesh Avatar) accepts only an http(s) mount. The desktop game page is
 * `app://versus/`, so the player cannot mount there. Instead of copying owner code or media into the
 * installer, the desktop host serves one small loopback-only origin, `http://red.versus.localhost`,
 * whose only content is `red-frame.html` (this game's bridge page) and Harbor's own routes, forwarded
 * by the host exactly like the `app://versus/` owner routes (token added in main, never in pages).
 *
 * The same bridge carries a Mesh Avatar opponent (Falka, Leo, Thor): `mesh-frame.html?avatar=<dir>` on the
 * same frame origin in the desktop app, or on this page's own origin in the browser (see
 * mesh-frame.js). Pass `{ src, origin, name }`; the default is Red's frame.
 *
 * This module is the game-page half: an object with the small RedPlayer surface AvatarOpponent uses
 * (load, play, stop, unlock, dispose, activity, reduced, audio.volume/currentTime, `playback`
 * events). Frames arrive as ImageBitmaps and are drawn into the caller's canvas, which the seated
 * figure samples as before. Messages are accepted only from that frame's window and origin.
 */
export const FRAME_ORIGIN = 'http://red.versus.localhost';
const LOAD_MS = 45000;

export class FramedRedPlayer extends EventTarget {
  /**
   * @param {HTMLCanvasElement} canvas the caller's canvas (the owner's frames are drawn here)
   * @param {{ src?: string, origin?: string, name?: string }} [o] the frame page, its origin and who it renders
   */
  constructor(canvas, o = {}) {
    super();
    this.canvas = canvas;
    this.origin = o.origin ?? FRAME_ORIGIN;
    this.src = o.src ?? `${FRAME_ORIGIN}/red-frame.html`;
    this.name = o.name ?? 'Red';
    this.disposed = false;
    this._seq = 0;
    this._calls = new Map();
    this._vol = 1;
    this._time = 0;
    this._reduced = false;
    const self = this;
    this.audio = { get volume() { return self._vol; }, set volume(v) { self._vol = v; self._post({ t: 'volume', v }); }, get currentTime() { return self._time; } };
  }

  set activity(v) { this._post({ t: 'activity', v }); }
  set reduced(v) { this._reduced = !!v; this._post({ t: 'reduced', v: !!v }); }
  get reduced() { return this._reduced; }

  /** Mount the frame and wait for the owner's player inside it to load (or fail truthfully). */
  load() {
    return new Promise((resolve, reject) => {
      const f = this.frame = document.createElement('iframe');
      Object.assign(f, { src: this.src, title: `${this.name}'s renderer`, tabIndex: -1, className: 'red-frame' });
      f.setAttribute('allow', 'autoplay');
      f.setAttribute('aria-hidden', 'true');
      this._loading = { resolve, reject };
      this._timer = setTimeout(() => this._settleLoad(Error(`${this.name}'s renderer frame did not load in time`)), LOAD_MS);
      this._onMessage = (e) => { if (e.source === f.contentWindow && e.origin === this.origin) this._message(e.data); };
      window.addEventListener('message', this._onMessage);
      f.addEventListener('error', () => this._settleLoad(Error(`${this.name}'s renderer frame could not be opened`)));
      document.body.append(f);
    });
  }

  _settleLoad(err, size) {
    const l = this._loading;
    if (!l) return;
    this._loading = null;
    clearTimeout(this._timer);
    if (err) { this.dispose(); l.reject(err); return; }
    if (size) [this.canvas.width, this.canvas.height] = size;
    l.resolve();
  }

  _message(m) {
    if (this.disposed || !m || typeof m.t !== 'string') return;
    if (m.t === 'loaded') this._settleLoad(null, Array.isArray(m.size) ? m.size.map(Number) : null);
    else if (m.t === 'failed') this._settleLoad(Error(String(m.error || `${this.name}'s renderer failed to load`).slice(0, 200)));
    else if (m.t === 'frame' && m.bitmap) {
      const b = m.bitmap;
      try {
        const c = this._ctx ??= this.canvas.getContext('2d');
        if (this.canvas.width !== b.width || this.canvas.height !== b.height) [this.canvas.width, this.canvas.height] = [b.width, b.height];
        c.clearRect(0, 0, b.width, b.height);
        c.drawImage(b, 0, 0);
      } finally { b.close?.(); }
      this._post({ t: 'ack' });
    } else if (m.t === 'playback') {
      this._time = Number(m.detail?.audioTime) || 0;
      this.dispatchEvent(new CustomEvent('playback', { detail: m.detail }));
    } else if (m.t === 'reply') {
      const c = this._calls.get(m.id);
      if (!c) return;
      this._calls.delete(m.id);
      m.ok ? c.resolve(m.value) : c.reject(Error(String(m.error || 'failed').slice(0, 200)));
    }
  }

  _post(msg) { if (!this.disposed && this.frame?.contentWindow) this.frame.contentWindow.postMessage(msg, this.origin); }

  _call(t, args) {
    if (this.disposed) return Promise.reject(Error(`${this.name}’s renderer was released`));
    const id = ++this._seq;
    return new Promise((resolve, reject) => { this._calls.set(id, { resolve, reject }); this._post({ t, id, ...args }); });
  }

  play(job) { return this._call('play', { job: { id: job.id, plan: job.plan, audio: job.audio } }); }
  unlock() { return this._call('unlock', {}); }
  stop() { this._post({ t: 'stop' }); }

  dispose() {
    if (this.disposed) return;
    this._post({ t: 'dispose' });
    this.disposed = true;
    clearTimeout(this._timer);
    window.removeEventListener('message', this._onMessage);
    for (const c of this._calls.values()) c.reject(Error(`${this.name}’s renderer was released`));
    this._calls.clear();
    this.frame?.remove();
    this.frame = null;
  }
}
