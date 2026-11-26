/**
 * The renderer's only bridge to the desktop host (electron-desktop-v1 §3). Sandboxed preloads are
 * CommonJS and may require only `electron`. The page gets two functions and an event subscription:
 * no raw ipcRenderer, no channel names, no filesystem, shell or URL access. The host validates the
 * sender frame and the operation; the peer runtime validates arguments, seat and generation.
 */
const { contextBridge, ipcRenderer } = require('electron');

const listeners = new Set();
ipcRenderer.on('versus:event', (_e, event) => { for (const fn of listeners) { try { fn(event); } catch (err) { console.error(err); } } });

contextBridge.exposeInMainWorld('hapaDesktop', {
  kind: 'electron',
  /** @param {string} op @param {object} [args] */
  call: (op, args) => ipcRenderer.invoke('versus:call', { op: String(op), args: args ?? {} }),
  /** @param {'about'|'revealData'} op */
  host: (op) => ipcRenderer.invoke('versus:host', { op: String(op) }),
  /** @param {(event: any) => void} fn @returns {() => void} unsubscribe */
  onEvent: (fn) => { if (typeof fn !== 'function') return () => {}; listeners.add(fn); return () => listeners.delete(fn); },
});
