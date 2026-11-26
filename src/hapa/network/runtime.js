/**
 * The reusable local peer runtime (Assignment 16; p2p-matchmaking-v1 §3, electron-desktop-v1 §3).
 *
 * One instance per player process. It owns the data root lock, the persistent identity, native
 * Hypercore storage and (when online) the single Hyperswarm. It has no Electron or DOM imports:
 * the desktop utility process and the headless/browser host wrap it with thin adapters that call
 * `handle(op, args)` and forward `onEvent` notifications.
 */
import Hypercore from 'hypercore';
import { openDataRoot } from './store.js';
import { openIdentity, publicPlayer, fingerprintOf, renameIdentity } from './identity.js';

export const RUNTIME_VERSION = 'hapa-versus-peer-runtime/0.1.0';

export class PeerRuntime {
  /**
   * @param {{ root: string, networkId?: string, displayName?: string, log?: (s: string) => void, onEvent?: (e: any) => void, host?: string }} o
   */
  constructor(o) {
    this.o = o;
    this.networkId = o.networkId ?? 'public-alpha';
    this.log = o.log ?? (() => {});
    this.onEvent = o.onEvent ?? (() => {});
    this.state = 'closed';
  }

  async open() {
    this.store = openDataRoot(this.o.root, this.networkId);
    const { identity, created } = openIdentity(this.store, { displayName: this.o.displayName });
    this.identity = identity;
    this.createdIdentity = created;
    this.launch = await this._recordLaunch();
    this.state = 'open';
    this.log(`runtime open ${this.networkId} ${fingerprintOf(identity.publicKey)} launch ${this.launch.index}`);
    return this.status();
  }

  /**
   * Append one launch record to a durable local Hypercore, then close and reopen it and read the
   * record back. Run at every open, this is the native-storage attachment proof (create, append,
   * close, reopen) and also shows the store surviving app restarts: its length grows by one per
   * launch.
   */
  async _recordLaunch() {
    const dir = this.store.path('cores', 'launches');
    let core = new Hypercore(dir, { valueEncoding: 'json' });
    await core.ready();
    const before = core.length;
    const key = core.key.toString('hex');
    const rec = { index: before, at: new Date().toISOString(), host: this.o.host ?? 'node', runtime: RUNTIME_VERSION, node: process.versions.node, electron: process.versions.electron ?? null };
    await core.append(rec);
    await core.close();
    core = new Hypercore(dir, { valueEncoding: 'json' });
    await core.ready();
    const reopened = { length: core.length, key: core.key.toString('hex'), last: await core.get(core.length - 1) };
    await core.close();
    if (reopened.key !== key || reopened.length !== before + 1 || reopened.last.index !== before) throw new Error('native store did not reopen with the appended record');
    return { index: before, length: reopened.length, coreKey: key.slice(0, 16) };
  }

  status() {
    const id = this.identity;
    return {
      runtime: RUNTIME_VERSION,
      state: this.state,
      networkId: this.networkId,
      player: id ? { ...publicPlayer(id), fingerprint: fingerprintOf(id.publicKey) } : null,
      createdIdentity: !!this.createdIdentity,
      launch: this.launch ?? null,
      transport: this.transport ?? { state: 'off' },
      versions: { node: process.versions.node, electron: process.versions.electron ?? null, modules: process.versions.modules },
    };
  }

  /** Start then stop the peer transport once (attachment proof before the lobby exists). */
  async probeTransport() {
    const { default: Hyperswarm } = await import('hyperswarm');
    const swarm = new Hyperswarm();
    const t0 = Date.now();
    await swarm.listen();
    const pub = swarm.keyPair.publicKey.toString('hex');
    const out = { listened: true, transportKey: pub.slice(0, 16), ms: Date.now() - t0 };
    await swarm.destroy();
    out.destroyed = true;
    return out;
  }

  /** The adapter entry point: one named operation with plain-data arguments. */
  async handle(op, args = {}) {
    switch (op) {
      case 'getStatus': return this.status();
      case 'probeTransport': return this.probeTransport();
      case 'setDisplayName': return { label: renameIdentity(this.store, this.identity, args.name) };
      default: throw new Error(`unknown operation ${op}`);
    }
  }

  async close() {
    if (this.state === 'closed') return;
    this.state = 'closing';
    this.store?.release();
    this.state = 'closed';
  }
}
