/**
 * The online data root and its single-writer lock (Assignment 16, electron-desktop-v1 §7).
 *
 * Node-only. The host (Electron main or a CLI) supplies the root explicitly: packaged identity and
 * match stores live under the OS userData directory, development/test roots under ignored `.data/`.
 * This module never derives a root from `process.cwd()` and never deletes one. The `.data/peers`
 * fixture reset in tools/hapa/peers.mjs is a different directory tree.
 */
import { mkdirSync, openSync, closeSync, writeFileSync, readFileSync, renameSync, chmodSync, existsSync, fsyncSync } from 'node:fs';
import { join, resolve, isAbsolute } from 'node:path';
import fsx from 'fs-native-extensions';

/** Version of the on-disk layout under `<root>/<networkId>/`. */
export const STORE_LAYOUT = 'hapa-versus-store/v1';

/**
 * Open (create if needed) the data root for one network and take its exclusive OS lock. The lock is
 * an advisory file lock the OS releases if the process dies, so a crash never strands the store.
 * @param {string} root absolute directory supplied by the host
 * @param {string} networkId e.g. `public-alpha`, `test-<name>`
 */
export function openDataRoot(root, networkId) {
  if (typeof root !== 'string' || !isAbsolute(root)) throw new Error('the data root must be an absolute path supplied by the host');
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(networkId)) throw new Error(`invalid network id ${networkId}`);
  const dir = resolve(root, networkId);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const lockPath = join(dir, 'LOCK');
  const fd = openSync(lockPath, existsSync(lockPath) ? 'r+' : 'w+', 0o600);
  if (!fsx.tryLock(fd)) {
    closeSync(fd);
    const e = new Error('another Hapa Versus process already holds this player store');
    e.code = 'STORE_LOCKED';
    throw e;
  }
  const layoutFile = join(dir, 'layout.json');
  if (!existsSync(layoutFile)) writeJsonAtomic(layoutFile, { layout: STORE_LAYOUT, networkId });
  const layout = JSON.parse(readFileSync(layoutFile, 'utf8'));
  if (layout.layout !== STORE_LAYOUT) { closeSync(fd); throw new Error(`unsupported store layout ${layout.layout}`); }
  return {
    dir,
    networkId,
    path: (...p) => join(dir, ...p),
    release() { try { fsx.unlock(fd); } catch { /* already released */ } try { closeSync(fd); } catch { /* closed */ } },
  };
}

/** Write JSON durably: temp file, fsync, rename (a crash leaves the old or the new file, never half). */
export function writeJsonAtomic(file, value, mode = 0o600) {
  const tmp = `${file}.tmp-${process.pid}`;
  const fd = openSync(tmp, 'w', mode);
  try { writeFileSync(fd, JSON.stringify(value, null, 1)); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(tmp, file);
  try { chmodSync(file, mode); } catch { /* platform without modes */ }
}

export function readJson(file, fallback = null) {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return fallback; throw e; }
}
