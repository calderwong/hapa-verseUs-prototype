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
    try {
      runtime = new PeerRuntime({ root: m.root, networkId: m.networkId, host: 'electron-utility', log: (s) => process.stdout.write(`${s}\n`), onEvent: (event) => send({ type: 'event', event }) });
      send({ type: 'ready', status: await runtime.open() });
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
