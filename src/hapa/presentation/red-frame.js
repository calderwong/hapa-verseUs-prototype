/**
 * The frame half of Red's desktop renderer bridge (review 18, R18-01; see red-bridge.js).
 *
 * Runs at `http://red.versus.localhost/red-frame.html` inside the packaged app only. It loads
 * Harbor's RedPlayer from Harbor's own routes (forwarded by the desktop host), renders into its own
 * canvas, and sends frames as transferable ImageBitmaps to the game page, at most one in flight and
 * about 20 per second. It accepts commands only from its parent window at `app://versus`.
 */
const PARENT = 'app://versus';
const canvas = document.getElementById('red');
let player = null;
let inFlight = false;
let pump = null;

const post = (m, transfer) => window.parent.postMessage(m, PARENT, transfer ?? []);

async function boot() {
  try {
    const url = ['', 'puppet', 'red-player.mjs'].join('/'); // Harbor's module, never bundled here
    const { RedPlayer } = await import(/* @vite-ignore */ url);
    player = new RedPlayer(canvas, { packageURL: '/v1/avatar-package', audioURL: (p) => p });
    await player.load();
    player.addEventListener('playback', (e) => post({ t: 'playback', detail: { status: e.detail.status, audioTime: e.detail.audioTime, duration: e.detail.duration, id: e.detail.id } }));
    post({ t: 'loaded', size: [canvas.width, canvas.height] });
    pump = setInterval(async () => {
      if (inFlight || !player || !canvas.width) return;
      inFlight = true;
      try { const bitmap = await createImageBitmap(canvas); post({ t: 'frame', bitmap }, [bitmap]); } catch { inFlight = false; }
    }, 50);
  } catch (e) {
    post({ t: 'failed', error: e?.message ?? String(e) });
  }
}

window.addEventListener('message', async (e) => {
  if (e.source !== window.parent || e.origin !== PARENT) return;
  const m = e.data ?? {};
  const reply = (ok, value) => post({ t: 'reply', id: m.id, ok, ...(ok ? { value } : { error: value }) });
  if (m.t === 'ack') { inFlight = false; return; }
  if (!player) { if (m.id) reply(false, 'not loaded'); return; }
  try {
    if (m.t === 'play') reply(true, await player.play(m.job));
    else if (m.t === 'unlock') reply(true, await player.unlock());
    else if (m.t === 'stop') player.stop();
    else if (m.t === 'activity') player.activity = m.v;
    else if (m.t === 'reduced') player.reduced = !!m.v;
    else if (m.t === 'volume') player.audio.volume = Number(m.v);
    else if (m.t === 'dispose') { clearInterval(pump); player.dispose(); player = null; }
  } catch (err) { if (m.id) reply(false, err?.message ?? String(err)); }
});

boot();
