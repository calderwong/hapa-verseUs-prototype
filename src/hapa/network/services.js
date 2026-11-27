/**
 * Connectivity services: typed descriptors, local adoption history and the effective policy
 * (Assignment 19, N19-03; friend-test-and-resilient-connectivity-v1 §4–5).
 *
 * Roles are separate: `bootstrap` (entry into one HyperDHT overlay), `relay` (a native blind relay
 * carrying encrypted live streams when holepunching fails), `archive` (retains and serves public
 * result evidence) and `gateway` (a future transport adapter: kept as data, never executed). None of
 * them is identity, history or game authority.
 *
 * Provenance is stated, never invented: the public HyperDHT bootstrap entries are this build's
 * bundled defaults copied from the pinned hyperdht release (no operator signature exists for them);
 * the bundled desktop/network.json is the build's configuration; a player's userData network.json is
 * a local adoption decision. A peer's advertisement never becomes local configuration by itself.
 *
 * Accepted decisions (seed, add, update, disable, retire, mode) are appended to a local single-writer
 * Hypercore (`cores/service-policy`) and the effective policy is a validated projection of that
 * history. Importing the same configuration again appends nothing; an invalid update is refused and
 * the last valid policy stays in force. Health observations are not recorded here.
 *
 * Modes: `default` and `extend` use the public overlay plus accepted additions (an added compatible
 * bootstrap node extends the same overlay); `replace` uses only the accepted non-default bootstrap
 * nodes (an empty replacement is refused rather than silently isolating the player); `isolated` is
 * an explicitly named development overlay (a test network), never the normal player path.
 */
import Hypercore from 'hypercore';
import { createHash } from 'node:crypto';
import { canonicalize } from '../rules/encoding.js';

export const SERVICE_SCHEMA = 'hapa-versus-service/v1';
export const POLICY_SCHEMA = 'hapa-versus-service-policy/v1';
export const ROLES = ['bootstrap', 'relay', 'archive', 'gateway'];
export const MODES = ['default', 'extend', 'replace', 'isolated'];
const EXECUTABLE = { bootstrap: ['hyperdht/6'], relay: ['blind-relay/1'], archive: ['hapa-versus-archive/v1'] };
const MAX_PER_ROLE = 16;
const MAX_RECORDS = 2000;

/** The pinned hyperdht@6.37.0 `lib/constants.js` BOOTSTRAP_NODES (an IP hint @ host:port). */
export const PUBLIC_BOOTSTRAP = ['88.99.3.86@node1.hyperdht.org:49737', '142.93.90.113@node2.hyperdht.org:49737', '138.68.147.8@node3.hyperdht.org:49737'];
export const PUBLIC_OVERLAY = 'hyperdht-public';
// note: PUBLIC_BOOTSTRAP only seeds the bundled defaults; effective options come from the projection

const bare = ({ state, provenance, since, ...d }) => d; // eslint-disable-line no-unused-vars
const digest = (v) => createHash('sha256').update(canonicalize(v)).digest('hex').slice(0, 32);
const str = (v, n) => (typeof v === 'string' && v.length > 0 && v.length <= n ? v : null);
const hex64 = (v) => (typeof v === 'string' && /^[0-9a-f]{64}$/.test(v) ? v : null);

/** Bundled defaults as descriptors with their real provenance. */
export function defaultDescriptors() {
  return PUBLIC_BOOTSTRAP.map((node, i) => ({
    schema: SERVICE_SCHEMA, id: `hyperdht-public-${i + 1}`, role: 'bootstrap', adapter: 'hyperdht/6', overlay: PUBLIC_OVERLAY,
    endpoint: { node }, label: node.split('@')[1].split(':')[0], default: true,
  }));
}

/** Parse "ip@host:port", "host:port" or { host, port } into a bootstrap node (or null). */
export function bootstrapNode(v) {
  if (v && typeof v === 'object' && str(v.host, 253) && Number.isInteger(v.port) && v.port > 0 && v.port < 65536) return { host: v.host, port: v.port };
  if (typeof v !== 'string' || v.length > 300) return null;
  return /^(?:[0-9a-fA-F:.]{3,45}@)?[A-Za-z0-9.-]{1,253}:\d{1,5}$/.test(v) ? v : null;
}

/**
 * Validate one descriptor. Returns `{ ok, descriptor | reason }`. Unknown roles/adapters are
 * retained as data (`executable: false`) only for `gateway`; other unknown values are refused.
 */
export function validateDescriptor(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return { ok: false, reason: 'not an object' };
  try { d = JSON.parse(JSON.stringify(d)); } catch { return { ok: false, reason: 'descriptor is not data' }; } // absent fields drop out
  try { if (canonicalize(d).length > 2048) return { ok: false, reason: 'descriptor too large' }; } catch { return { ok: false, reason: 'descriptor is not canonical data' }; }
  const id = str(d.id, 64);
  if (!id || !/^[A-Za-z0-9._:-]+$/.test(id)) return { ok: false, reason: 'bad id' };
  if (!ROLES.includes(d.role)) return { ok: false, reason: `unknown role ${String(d.role).slice(0, 20)}` };
  const out = { schema: SERVICE_SCHEMA, id, role: d.role, adapter: str(d.adapter, 40), overlay: str(d.overlay, 64) ?? PUBLIC_OVERLAY, label: str(d.label, 40) ?? id };
  if (Number.isSafeInteger(d.expiresAt)) out.expiresAt = d.expiresAt;
  if (d.role === 'bootstrap') {
    const node = bootstrapNode(d.endpoint?.node ?? d.endpoint);
    if (!node) return { ok: false, reason: `${id}: bootstrap needs a host:port node` };
    out.adapter ??= 'hyperdht/6'; out.endpoint = { node };
  } else if (d.role === 'relay') {
    const key = hex64(d.publicKey ?? d.key);
    if (!key) return { ok: false, reason: `${id}: relay needs a 64-hex public key` };
    out.adapter ??= 'blind-relay/1'; out.publicKey = key;
    // the relay's own UDP endpoint, when its operator publishes it: lets a connection be observed as relayed
    const ep = str(d.endpoint, 80);
    if (ep && /^(\*|[0-9a-fA-F:.]{3,45}):\d{1,5}$/.test(ep)) out.endpoint = ep;
  } else if (d.role === 'archive') {
    const player = typeof d.player === 'string' && /^hv1:[0-9a-f]{64}$/.test(d.player) ? d.player : null;
    const transport = hex64(d.transport);
    if (!player || !transport) return { ok: false, reason: `${id}: archive needs a player id and transport key` };
    out.adapter ??= 'hapa-versus-archive/v1'; out.player = player; out.transport = transport;
  } else {
    out.adapter ??= 'unknown'; out.endpoint = str(typeof d.endpoint === 'string' ? d.endpoint : null, 200);
  }
  out.executable = !!EXECUTABLE[out.role]?.includes(out.adapter);
  return { ok: true, descriptor: out };
}

/**
 * Normalize one network section of a network.json (bundled or local) into typed descriptors plus a
 * mode. Accepts the v1 shape (`relays`, `archives`, `bootstrap`) and a typed `services` list.
 * @returns {{ ok: boolean, mode: string|null, services: any[], disable: string[], retire: string[], errors: string[] }}
 */
export function normalizeConfig(section) {
  const out = { ok: true, mode: null, services: [], disable: [], retire: [], errors: [] };
  if (!section || typeof section !== 'object') return out;
  const add = (d) => { const v = validateDescriptor(d); if (v.ok) out.services.push(v.descriptor); else out.errors.push(v.reason); };
  const b = section.bootstrap;
  if (b && typeof b === 'object' && !Array.isArray(b)) {
    if (b.mode !== undefined) { if (MODES.includes(b.mode)) out.mode = b.mode; else out.errors.push(`unknown bootstrap mode ${String(b.mode).slice(0, 20)}`); }
    for (const [i, n] of (Array.isArray(b.nodes) ? b.nodes : []).entries()) add({ id: `bootstrap-${digest(n).slice(0, 8)}-${i}`, role: 'bootstrap', endpoint: { node: n }, overlay: b.overlay ?? (out.mode === 'isolated' ? 'isolated' : PUBLIC_OVERLAY) });
  } else if (b !== undefined && b !== 'hyperdht-public-defaults') out.errors.push('bootstrap must be "hyperdht-public-defaults" or { mode, nodes }');
  for (const r of Array.isArray(section.relays) ? section.relays : []) add({ id: r?.id ?? `relay-${String(r?.key ?? r?.publicKey ?? '').slice(0, 12)}`, role: 'relay', publicKey: r?.key ?? r?.publicKey, endpoint: r?.endpoint, label: r?.label });
  for (const a of Array.isArray(section.archives) ? section.archives : []) add({ id: a?.id ?? `archive-${String(a?.player ?? '').slice(4, 16)}`, role: 'archive', player: a?.player, transport: a?.transport, label: a?.label });
  for (const d of Array.isArray(section.services) ? section.services : []) add(d);
  for (const k of ['disable', 'retire']) for (const id of Array.isArray(section[k]) ? section[k] : []) if (str(id, 64)) out[k].push(id);
  for (const role of ROLES) if (out.services.filter((d) => d.role === role).length > MAX_PER_ROLE) out.errors.push(`more than ${MAX_PER_ROLE} ${role} services`);
  out.ok = out.errors.length === 0;
  return out;
}

/**
 * Project an ordered list of policy records into the current service set and mode (Assignment 20,
 * N20-02; Hapa connectivity v0.1 §6, HC-06/07). Imports are logical transactions: their records
 * carry `batch: { id, index, count }` and count only when the batch's `commit` record is present
 * with the same count. A partial batch is kept as history (listed in `incomplete`) but never applied
 * and never marks its configuration imported. Records without a batch are single decisions (user
 * decisions; older histories). Retirement is final for a service id: seeding, a repeated import or
 * a cached success cannot resurrect it.
 */
export function project(records, nowMs = Date.now()) {
  const services = new Map(), imports = new Set(), seen = new Map(), committed = new Set(), incomplete = [];
  for (const r of records) if (r?.batch?.id) { if (r.action === 'commit') { if ((seen.get(r.batch.id) ?? 0) === r.batch.count) committed.add(r.batch.id); } else seen.set(r.batch.id, (seen.get(r.batch.id) ?? 0) + 1); }
  for (const [id, n] of seen) if (!committed.has(id)) incomplete.push({ id, records: n });
  let mode = 'default';
  for (const r of records) {
    if (r?.schema !== POLICY_SCHEMA) continue;
    if (r.batch?.id && !committed.has(r.batch.id)) continue;
    if (r.action === 'commit') { if (r.provenance?.digest) imports.add(`${r.provenance.kind}:${r.provenance.digest}`); continue; }
    if (r.action === 'mode' && MODES.includes(r.mode)) mode = r.mode;
    else if ((r.action === 'seed' || r.action === 'add' || r.action === 'update') && r.service) {
      const v = validateDescriptor(r.service);
      if (!v.ok) continue;
      const prev = services.get(v.descriptor.id);
      if (prev?.state === 'retired') continue; // retirement is final for that id
      services.set(v.descriptor.id, { ...v.descriptor, state: prev && prev.state !== 'active' && r.action !== 'add' ? prev.state : 'active', provenance: r.provenance, since: r.at });
    } else if ((r.action === 'disable' || r.action === 'retire' || r.action === 'enable') && services.has(r.serviceId)) {
      const s = services.get(r.serviceId);
      if (s.state === 'retired') continue;
      s.state = r.action === 'enable' ? 'active' : r.action === 'disable' ? 'disabled' : 'retired';
    }
  }
  for (const s of services.values()) if (s.state === 'active' && s.expiresAt && s.expiresAt < nowMs) s.state = 'expired';
  return { mode, services, imports, incomplete };
}

/**
 * The effective runtime options from a projection (what actually reaches Lobby/Hyperswarm). Built
 * only from accepted, eligible providers: a disabled, retired or expired entry never returns through a
 * hard-coded fallback. When no eligible discovery provider remains the result is an explicit
 * `noRoute` state (discovery stays off and says why) rather than a silent switch of overlay.
 */
export function effectivePolicy({ mode, services }, override = null) {
  const active = [...services.values()].filter((s) => s.state === 'active' && s.executable);
  const warnings = [];
  if (override?.bootstrap) {
    // an explicit test/development overlay passed by code (a local testnet): named, never the player default
    return { mode: 'isolated', overlay: 'isolated-test', bootstrap: override.bootstrap, relays: relaysOf(active), archives: archivesOf(active), warnings: ['an isolated development overlay is in use'], noRoute: null };
  }
  const boot = active.filter((s) => s.role === 'bootstrap');
  let nodes, overlay = PUBLIC_OVERLAY;
  if (mode === 'isolated') {
    const iso = boot.filter((s) => s.overlay !== PUBLIC_OVERLAY);
    overlay = iso[0]?.overlay ?? 'isolated';
    nodes = iso.filter((s) => s.overlay === overlay).map((s) => s.endpoint.node);
  } else if (mode === 'replace') {
    nodes = boot.filter((s) => s.overlay === PUBLIC_OVERLAY && s.provenance?.kind !== 'bundled-default').map((s) => s.endpoint.node);
  } else {
    nodes = boot.filter((s) => s.overlay === PUBLIC_OVERLAY).map((s) => s.endpoint.node);
    if (boot.some((s) => s.overlay !== PUBLIC_OVERLAY)) warnings.push('bootstrap nodes of another overlay are ignored outside isolated mode');
  }
  const noRoute = nodes.length ? null : `no eligible ${mode === 'isolated' ? `${overlay} ` : ''}discovery provider is adopted (every candidate is disabled, retired or expired, or none was added for ${mode} mode)`;
  if (noRoute) warnings.push(`${noRoute}; discovery stays off until a provider is enabled or added`);
  return { mode, overlay, bootstrap: nodes, relays: relaysOf(active), archives: archivesOf(active), warnings, noRoute };
}
const relaysOf = (active) => active.filter((s) => s.role === 'relay').map((s) => ({ id: s.id, key: s.publicKey, endpoint: s.endpoint ?? null, label: s.label }));
const archivesOf = (active) => active.filter((s) => s.role === 'archive').map((s) => ({ id: s.id, player: s.player, transport: s.transport, label: s.label }));

/**
 * The local service-policy history on native storage. `open()` seeds the bundled defaults and
 * imports bundled/local configuration idempotently, then projects the effective policy.
 */
export class ServicePolicy {
  /** @param {{ dir: string, bundled?: any, local?: any, override?: any, log?: (s: string) => void }} o */
  constructor(o) { this.o = o; this.log = o.log ?? (() => {}); this.errors = []; }

  async open() {
    this.core = new Hypercore(this.o.dir, { valueEncoding: 'json' });
    await this.core.ready();
    this.records = [];
    for (let i = 0; i < Math.min(this.core.length, MAX_RECORDS); i++) this.records.push(await this.core.get(i));
    let p = project(this.records);
    // 1) bundled defaults, one committed batch per descriptor set (a retired id is never resurrected)
    {
      const ds = defaultDescriptors();
      const prov = { kind: 'bundled-default', source: 'hyperdht@6.37.0 lib/constants.js BOOTSTRAP_NODES', digest: digest(ds) };
      if (!p.imports.has(`bundled-default:${prov.digest}`)) await this._appendBatch(ds.filter((d) => !p.services.has(d.id)).map((d) => ({ action: 'seed', service: d })), prov);
    }
    // 2) the build's bundled configuration, then 3) the player's local adoption, each imported once per content
    for (const [kind, section] of [['bundled-config', this.o.bundled], ['local-config-import', this.o.local]]) {
      if (!section) continue;
      const n = normalizeConfig(section);
      const prov = { kind, source: kind === 'bundled-config' ? 'desktop/network.json' : 'userData/network.json', digest: digest(section) };
      p = project(this.records);
      if (p.imports.has(`${kind}:${prov.digest}`)) continue;
      if (!n.ok) { this.errors.push(...n.errors.map((e) => `${prov.source}: ${e}`)); this.log(`service configuration refused (${prov.source}): ${n.errors.join('; ')}; the last valid policy stays in force`); continue; }
      const batch = [];
      for (const d of n.services) {
        const prev = p.services.get(d.id);
        if (prev && canonicalize(bare(prev)) === canonicalize(bare(d))) continue;
        batch.push({ action: prev ? 'update' : 'add', service: d });
      }
      for (const id of n.disable) batch.push({ action: 'disable', serviceId: id });
      for (const id of n.retire) batch.push({ action: 'retire', serviceId: id });
      if (n.mode && n.mode !== p.mode) batch.push({ action: 'mode', mode: n.mode });
      // adopt only a usable policy: a candidate that would leave no eligible discovery provider is
      // refused before anything is appended (the previous policy, with its retirements, stays)
      const trial = effectivePolicy(project([...this.records, ...batch.map((r) => ({ schema: POLICY_SCHEMA, ...r, provenance: prov }))]), this.o.override);
      if (trial.noRoute && !effectivePolicy(p, this.o.override).noRoute) { this.errors.push(`${prov.source}: refused — ${trial.noRoute}`); this.log(`service configuration refused (${prov.source}): ${trial.noRoute}`); continue; }
      await this._appendBatch(batch, prov);
    }
    this.projection = project(this.records);
    this.effective = effectivePolicy(this.projection, this.o.override);
    return this.effective;
  }

  /**
   * Append one import as a logical transaction: its records (each tagged with the batch id, index and
   * count) and a final `commit` record, in a single Hypercore append so the batch lands together;
   * projection applies it only when the commit is present. `interruptAfter` (tests only) appends
   * record by record and stops early to stage a crash at that durable boundary.
   */
  async _appendBatch(entries, provenance) {
    if (this.records.length + entries.length + 1 > MAX_RECORDS) throw new Error('service policy history is full');
    const id = `${provenance.kind}:${provenance.digest}:${this.records.length}`;
    const at = new Date().toISOString();
    const recs = [...entries.map((e, index) => ({ schema: POLICY_SCHEMA, seq: this.records.length + index, at, ...e, batch: { id, index, count: entries.length }, provenance })),
      { schema: POLICY_SCHEMA, seq: this.records.length + entries.length, at, action: 'commit', batch: { id, count: entries.length }, provenance }];
    if (Number.isInteger(this.o.interruptAfter)) {
      for (const [k, r] of recs.entries()) { if (k >= this.o.interruptAfter) throw Object.assign(new Error('import interrupted (test hook)'), { code: 'INTERRUPTED' }); await this.core.append(r); this.records.push(r); }
      return;
    }
    await this.core.append(recs);
    this.records.push(...recs);
  }

  async _append(r) {
    if (this.records.length >= MAX_RECORDS) throw new Error('service policy history is full');
    const rec = { schema: POLICY_SCHEMA, seq: this.records.length, at: new Date().toISOString(), ...r };
    await this.core.append(rec);
    this.records.push(rec);
  }

  /** A user decision recorded with its provenance (add/update/disable/enable/retire/mode). */
  async decide(decision) {
    const prov = { kind: 'user', source: 'in-app', digest: digest({ decision, at: Date.now() }) };
    if (decision.action === 'mode') { if (!MODES.includes(decision.mode)) throw new Error('unknown mode'); await this._append({ action: 'mode', mode: decision.mode, provenance: prov }); }
    else if (['add', 'update'].includes(decision.action)) { const v = validateDescriptor(decision.service); if (!v.ok) throw new Error(v.reason); await this._append({ action: decision.action, service: v.descriptor, provenance: prov }); }
    else if (['disable', 'enable', 'retire'].includes(decision.action)) await this._append({ action: decision.action, serviceId: String(decision.serviceId).slice(0, 64), provenance: prov });
    else throw new Error('unknown decision');
    this.projection = project(this.records);
    this.effective = effectivePolicy(this.projection, this.o.override);
    return this.effective;
  }

  /** Diagnostics: provenance and state per service, no secrets (relay keys shortened). */
  summary() {
    return {
      mode: this.effective?.mode, overlay: this.effective?.overlay, records: this.records?.length ?? 0, errors: this.errors, warnings: this.effective?.warnings ?? [], noRoute: this.effective?.noRoute ?? null, incompleteImports: this.projection?.incomplete ?? [],
      services: [...(this.projection?.services.values() ?? [])].map((s) => ({ id: s.id, role: s.role, adapter: s.adapter, overlay: s.overlay, state: s.state, executable: s.executable, provenance: s.provenance?.kind, label: s.label, key: s.publicKey ? `${s.publicKey.slice(0, 8)}…` : undefined })),
    };
  }

  async close() { await this.core?.close(); }
}
