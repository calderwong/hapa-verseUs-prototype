/**
 * Electron utility-process entry: hosts the reusable peer runtime (src/hapa/network/runtime.js).
 * Main sends `init` with the explicit data root, then `call` messages; this process answers with
 * `reply` and pushes `event` notifications. It never touches the renderer DOM.
 */
import { PeerRuntime } from '../src/hapa/network/runtime.js';

const port = process.parentPort;
let runtime = null;

const send = (m) => port.postMessage(m);

port.on('message', async (e) => {
  const m = e.data;
  if (m?.type === 'init' && !runtime) {
    // an isolated test may delay this worker's startup to stage a late or never-ready generation
    const delay = (process.env.HAPA_VERSUS_PEER_DELAY_GENS === 'first' && m.gen > 1) ? 0 : Number(process.env.HAPA_VERSUS_PEER_DELAY_MS) || 0;
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    try {
      runtime = new PeerRuntime({ root: m.root, networkId: m.networkId, host: 'electron-utility', services: m.network?.services ?? null, forceRelay: process.env.HAPA_VERSUS_FORCE_RELAY === '1', log: (s) => process.stdout.write(`${s}\n`), onEvent: (event) => send({ type: 'event', event }) });
      const status = await runtime.open();
      send({ type: 'ready', status });
      // a player who joined the lobby before rejoins it (the saved online preference); local play never waits on it
      if (status.joined || status.match) runtime.joinLobby({}).catch((err) => send({ type: 'event', event: { type: 'lobby', kind: 'transport', transport: { state: 'failed', error: err.message } } }));
    } catch (err) {
      send({ type: 'fatal', error: err.message, code: err.code });
      setTimeout(() => process.exit(err.code === 'STORE_LOCKED' ? 3 : 1), 50);
    }
  } else if (m?.type === 'call') {
    try { send({ type: 'reply', id: m.id, ok: true, value: await runtime.handle(m.op, m.args) }); }
    catch (err) { send({ type: 'reply', id: m.id, ok: false, error: err.message, code: err.code }); }
  } else if (m?.type === 'shutdown') {
    try { await runtime?.close(); } finally { process.exit(0); }
  }
});
