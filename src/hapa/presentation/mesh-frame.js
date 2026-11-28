/**
 * The frame half of a Mesh Avatar opponent's renderer (Falka, Leo): same bridge as Red's
 * (red-frame.js / red-bridge.js), with Mesh Avatar's own player as the owner.
 *
 * Mesh Avatar serves each Avatar's player files read-only from its node (`/apps/player/<dir>/`,
 * forwarded here as `/mesh/apps/player/<dir>/`). Its renderer resolves `rig.json`, expressions and
 * images against the DOCUMENT, so this page points its <base> at that directory before importing the
 * owner's module — nothing of the owner is copied or bundled. The renderer draws the owner's 2D
 * forward mesh (WebGL2) into its own canvas; this page adds a gentle idle (breathing, blinks, small
 * turns, arm sway or ears and tail), frames the figure into the seat's 673 × 841 portrait and posts
 * frames as ImageBitmaps to its parent, at most one in flight, about 20 per second.
 *
 * Parent: `app://versus` in the desktop app (served from the loopback frame origin), otherwise this
 * page's own origin (the Vite dev/preview page). Commands are accepted only from that parent.
 * There is no voice: the opponent speaks in captions; `play` resolves at once.
 */
const AVATARS = {
  falka: {
    module: 'FalkaRenderer',
    // head to waist of the standing portrait (fractions of the owner's canvas)
    crop: [0.2, 0.035, 0.6, 0.6],
    idle: (t, blink, reduced) => ({ turn: reduced ? 0 : 0.22 * Math.sin(t * 0.31), arm: reduced ? 0 : 0.35 * Math.sin(t * 0.62), breath: reduced ? 0.5 : (Math.sin(t * 1.5) + 1) / 2, smileClosed: reduced ? 0 : 0.25 * Math.max(0, Math.sin(t * 0.13)), blink }),
  },
  leo: {
    module: 'LeoRenderer',
    crop: [0.07, 0.0, 0.86, 0.94],
    idle: (t, blink, reduced) => ({ turn: reduced ? 0 : 0.22 * Math.sin(t * 0.29), ear: reduced ? 0 : 0.4 * Math.sin(t * 0.9), tail: reduced ? 0 : 0.7 * Math.sin(t * 1.1), breath: reduced ? 0.5 : (Math.sin(t * 1.7) + 1) / 2, relaxed: 0.35, blink }),
  },
};

const dir = new URLSearchParams(location.search).get('avatar');
const PARENT = location.hostname === 'red.versus.localhost' ? 'app://versus' : location.origin;
const seat = document.getElementById('seat');
const post = (m, transfer) => window.parent.postMessage(m, PARENT, transfer ?? []);
let renderer = null, raf = 0, pump = null, inFlight = false, reduced = false, nextBlink = 3, t0 = 0;

function frame(now) {
  const spec = AVATARS[dir];
  const t = (now - t0) / 1000;
  // a blink every 3.5–6 s, 0.3 s long
  let blink = 0;
  if (t > nextBlink) { const p = (t - nextBlink) / 0.3; if (p >= 1) nextBlink = t + 3.5 + Math.random() * 2.5; else blink = Math.sin(Math.PI * p) ** 2; }
  renderer.render(spec.idle(t, blink, reduced));
  const src = renderer.canvas, [x, y, w, h] = spec.crop;
  const g = seat.getContext('2d');
  g.clearRect(0, 0, seat.width, seat.height);
  // keep the owner's aspect inside the seat frame (no stretching): fit the crop, centred at the bottom
  const sw = w * src.width, sh = h * src.height, k = Math.min(seat.width / sw, seat.height / sh);
  g.drawImage(src, x * src.width, y * src.height, sw, sh, (seat.width - sw * k) / 2, seat.height - sh * k, sw * k, sh * k);
  raf = requestAnimationFrame(frame);
}

async function boot() {
  try {
    if (!AVATARS[dir]) throw Error(`no Mesh Avatar player "${dir}"`);
    const base = document.createElement('base');
    base.href = `/mesh/apps/player/${dir}/`;
    document.head.prepend(base);
    // the owner's files resolve against this base; say exactly which one is missing if the owner refuses
    for (const f of ['rig.json', 'expressions.json']) {
      const u = new URL(f, document.baseURI), r = await fetch(u);
      if (!r.ok) throw Error(`${u.pathname} answered ${r.status}${r.status >= 500 ? ` (${(await r.text().catch(() => '')).slice(0, 120)})` : ''}`);
    }
    const url = ['', 'mesh', 'apps', 'player', dir, 'renderer.mjs'].join('/'); // the owner's module, never bundled here
    const mod = await import(/* @vite-ignore */ url);
    const own = document.createElement('canvas');
    renderer = await mod[AVATARS[dir].module].load(own);
    t0 = performance.now();
    raf = requestAnimationFrame(frame);
    post({ t: 'loaded', size: [seat.width, seat.height] });
    pump = setInterval(async () => {
      if (inFlight || !renderer) return;
      inFlight = true;
      try { const bitmap = await createImageBitmap(seat); post({ t: 'frame', bitmap }, [bitmap]); } catch { inFlight = false; }
    }, 50);
  } catch (e) {
    post({ t: 'failed', error: e?.message ?? String(e) });
  }
}

window.addEventListener('message', (e) => {
  if (e.source !== window.parent || e.origin !== PARENT) return;
  const m = e.data ?? {};
  const reply = (ok, value) => post({ t: 'reply', id: m.id, ok, ...(ok ? { value } : { error: value }) });
  if (m.t === 'ack') { inFlight = false; return; }
  if (m.t === 'reduced') { reduced = !!m.v; return; }
  if (m.t === 'dispose') { cancelAnimationFrame(raf); clearInterval(pump); renderer = null; return; }
  // captions only: there is no voice to play, unlock or stop
  if (m.t === 'play') reply(true, { status: 'caption-only' });
  else if (m.t === 'unlock') reply(true, true);
});

boot();
