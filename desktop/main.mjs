/**
 * Hapa Versus desktop main process (Addendum 08; docs/integrations/electron-desktop-v1.md).
 *
 * Main owns app identity, the `app://versus/` origin, the window, the single-instance lock and the
 * supervised peer utility process. It runs no game rules and holds no player keys: the utility
 * process hosts the same reusable Node peer runtime the headless tools use, and the sandboxed
 * renderer reaches it only through the narrow preload bridge (desktop/preload.cjs).
 */
import { app, BrowserWindow, protocol, session, ipcMain, utilityProcess, net, shell, dialog, Menu, screen, powerMonitor } from 'electron';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, normalize, extname, isAbsolute, resolve, sep } from 'node:path';
import { matchOwnerRoute, ownerEndpoint } from '../src/hapa/host/owner-routes.js';

const ORIGIN = 'app://versus';
const PARTITION = 'persist:versus';
const NETWORK_ID = process.env.HAPA_VERSUS_NETWORK || 'public-alpha';

app.setName('Hapa Versus');
// never use the OS keychain ("Hapa Versus Safe Storage"): nothing the game stores in Chromium needs it,
// and an unsigned app is asked for keychain access again after every update
app.commandLine.appendSwitch('use-mock-keychain');
// An explicit data root is for isolated test players and operators; players use the OS default.
const dataOverride = process.env.HAPA_VERSUS_DATA_DIR;
if (dataOverride) {
  if (!isAbsolute(dataOverride)) throw new Error('HAPA_VERSUS_DATA_DIR must be absolute');
  app.setPath('userData', dataOverride);
}
const SMOKE_OUT = process.env.HAPA_VERSUS_SMOKE_OUT && isAbsolute(process.env.HAPA_VERSUS_SMOKE_OUT) ? process.env.HAPA_VERSUS_SMOKE_OUT : null;

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true } }]);

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

const appRoot = app.getAppPath();
const DIST = join(appRoot, 'dist');
const stateRoot = () => join(app.getPath('userData'), 'state');

// --- the app:// origin -------------------------------------------------------------------------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; frame-src http://red.versus.localhost; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";
// Red's renderer frame (review 18, R18-01; src/hapa/presentation/red-bridge.js): a loopback-only http
// origin whose content is this game's bridge page plus Harbor's own forwarded routes. Harbor's player
// mounts its package only on an http(s) page origin, which `app://versus/` is not.
const RED_HOST = 'red.versus.localhost';
const RED_CSP = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors app://versus; form-action 'none'";

/** Owner configuration is explicit (userData/owners.json); none means every optional owner is absent. */
function ownerConfig() {
  try { return JSON.parse(readFileSync(join(app.getPath('userData'), 'owners.json'), 'utf8')); } catch { return null; }
}

async function serveStatic(pathname, csp = CSP) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { return new Response('bad path', { status: 400 }); }
  if (rel === '/' || rel === '') rel = '/versus.html';
  const file = normalize(join(DIST, rel));
  if (!file.startsWith(DIST + sep)) return new Response('not found', { status: 404 });
  try {
    const s = await stat(file);
    if (!s.isFile()) return new Response('not found', { status: 404 });
  } catch { return new Response('not found', { status: 404 }); }
  const type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
  const headers = { 'content-type': type, 'x-content-type-options': 'nosniff' };
  if (type.startsWith('text/html')) headers['content-security-policy'] = csp;
  return new Response(await readFile(file), { headers });
}

async function serveOwner(request, url, route) {
  const ep = ownerEndpoint(ownerConfig(), route);
  if (!ep) return Response.json({ error: `${route.owner === 'music' ? `music library ${route.library}` : route.owner} is not configured on this computer` }, { status: 503 });
  const target = ep.url + route.path + (route.owner === 'harbor' ? '' : url.search);
  const headers = new Headers();
  for (const h of ['content-type', 'accept', 'range']) { const v = request.headers.get(h); if (v) headers.set(h, v); }
  if (ep.token) headers.set('authorization', `Bearer ${ep.token}`);
  try {
    const init = { method: request.method, headers };
    if (!['GET', 'HEAD'].includes(request.method)) { init.body = await request.arrayBuffer(); }
    const r = await net.fetch(target, init);
    const out = new Headers();
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control']) { const v = r.headers.get(h); if (v) out.set(h, v); }
    return new Response(r.body, { status: r.status, headers: out });
  } catch (e) {
    return Response.json({ error: `${route.owner} is not reachable: ${e.message}` }, { status: 503 });
  }
}

async function handleApp(request) {
  const url = new URL(request.url);
  if (url.host !== 'versus') return new Response('not found', { status: 404 });
  // the game's own built files win: Harbor's `/assets` route must not shadow the bundle's /assets/
  if (request.method === 'GET' || request.method === 'HEAD') {
    const local = await serveStatic(url.pathname);
    if (local.status !== 404) return local;
  }
  const route = matchOwnerRoute(url.pathname);
  if (route) return serveOwner(request, url, route);
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('method not allowed', { status: 405 });
  return new Response('not found', { status: 404 });
}

/**
 * The renderer session's http handler: only Red's frame origin exists; every other http request
 * from the game page is refused (the page never needs one; its CSP already forbids them).
 */
async function handleRedFrame(request) {
  const url = new URL(request.url);
  if (url.host !== RED_HOST) return new Response('not found', { status: 404 });
  if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/red-frame.html' || url.pathname.startsWith('/assets/'))) {
    const local = await serveStatic(url.pathname, RED_CSP);
    if (local.status !== 404) return local;
  }
  const route = matchOwnerRoute(url.pathname);
  if (route?.owner === 'harbor') return serveOwner(request, url, route);
  return new Response('not found', { status: 404 });
}

// --- the peer utility process ------------------------------------------------------------------
const peer = { proc: null, gen: 0, pending: new Map(), seq: 0, restarts: [], status: null, quitting: false, ready: null, state: 'starting', error: null };
// the startup deadline; an isolated test may shorten it (HAPA_VERSUS_PEER_STARTUP_MS) to stage a late worker
const STARTUP_MS = Number(process.env.HAPA_VERSUS_PEER_STARTUP_MS) > 0 ? Number(process.env.HAPA_VERSUS_PEER_STARTUP_MS) : 30_000;

/**
 * Start one worker generation (review 16, R16-06). Its readiness settles exactly once — on ready,
 * fatal, exit or a startup timeout — and its in-flight calls are rejected with a recoverable error
 * when it exits. Nothing is replayed to a replacement worker: a caller sees the failure and the UI
 * offers retry or reattachment.
 */
function startPeer() {
  const gen = ++peer.gen;
  let retired = false; // this generation missed its deadline: everything it says from now on is ignored
  peer.state = 'starting'; peer.error = null;
  const entry = join(appRoot, 'desktop', 'peer-host.mjs');
  const proc = utilityProcess.fork(entry, [], { serviceName: 'Hapa Versus Peer', stdio: 'pipe' });
  peer.proc = proc;
  proc.stdout?.on('data', (d) => process.stdout.write(`[peer] ${d}`));
  proc.stderr?.on('data', (d) => process.stderr.write(`[peer] ${d}`));
  let settle;
  peer.ready = new Promise((resolveReady, rejectReady) => {
    let done = false;
    settle = (err, status) => { if (done) return; done = true; clearTimeout(timer); err ? rejectReady(err) : resolveReady(status); };
    // a missed deadline retires this generation (review 18, R18-05): its callers are settled with a
    // recoverable error, the process is stopped, and the exit path below replaces it under the same
    // bounded policy (or reports a usable failure); a late Ready from it is ignored
    const timer = setTimeout(() => {
      settle(Object.assign(new Error('the peer service did not start in time'), { code: 'RUNTIME_NOT_READY' }));
      retired = true;
      try { proc.kill(); } catch { /* already gone */ }
    }, STARTUP_MS);
  });
  peer.ready.catch((e) => { if (gen === peer.gen && !retired) { peer.state = 'failed'; peer.error = e.message; broadcast({ type: 'runtime', state: 'failed', error: e.message }); } });
  proc.on('message', (m) => {
    if (gen !== peer.gen || retired) return; // a stale or retired generation's late message
    if (m?.type === 'ready') { peer.status = m.status; peer.state = 'ready'; peer.error = null; settle(null, m.status); if (peer.restarts.length) broadcast({ type: 'runtime', state: 'ready', restarted: true }); }
    else if (m?.type === 'fatal') settle(Object.assign(new Error(m.error), { code: m.code ?? 'RUNTIME_FATAL' }));
    else if (m?.type === 'reply') { const p = peer.pending.get(m.id); if (p && p.gen === gen) { peer.pending.delete(m.id); m.ok ? p.resolve(m.value) : p.reject(Object.assign(new Error(m.error), { code: m.code })); } }
    else if (m?.type === 'event') broadcast(m.event);
  });
  proc.on('exit', (code) => {
    settle(Object.assign(new Error(`the peer service stopped before it was ready (exit ${code})`), { code: 'RUNTIME_STOPPED' }));
    for (const [id, p] of peer.pending) if (p.gen === gen) { peer.pending.delete(id); p.reject(Object.assign(new Error('the peer service stopped; nothing was retried — check the match and try again'), { code: 'RUNTIME_STOPPED' })); }
    if (gen !== peer.gen) return;
    peer.proc = null;
    if (peer.quitting) return;
    const now = Date.now();
    peer.restarts = peer.restarts.filter((t) => now - t < 60_000);
    const why = retired ? 'did not start in time' : `stopped (exit ${code})`;
    if (peer.restarts.length >= 3) { peer.state = 'failed'; peer.error = `the peer service ${why} three times in a minute`; broadcast({ type: 'runtime', state: 'failed', error: peer.error, retry: true }); return; }
    peer.restarts.push(now);
    peer.state = 'restarting';
    broadcast({ type: 'runtime', state: 'restarting', exitCode: code, reason: why });
    setTimeout(startPeer, 500 * peer.restarts.length);
  });
  // staged-start test hook (isolated qualification runs only): main forwards it explicitly, because the
  // packaged utility process does not see main's environment
  const delayMs = Number(process.env.HAPA_VERSUS_PEER_DELAY_MS) || 0;
  const testDelayMs = delayMs && !(process.env.HAPA_VERSUS_PEER_DELAY_GENS === 'first' && gen > 1) ? delayMs : 0;
  proc.postMessage({ type: 'init', gen, root: stateRoot(), networkId: NETWORK_ID, network: networkConfig(), testDelayMs, forceRelay: process.env.HAPA_VERSUS_FORCE_RELAY === '1' });
}

/** Wait for the current worker generation; a failed generation gives a recoverable error, never a hang. */
async function whenReady() {
  try { return await peer.ready; } catch (e) { throw Object.assign(new Error(`the game's peer service is not ready: ${e.message}`), { code: e.code ?? 'RUNTIME_NOT_READY' }); }
}

/**
 * Public network configuration (N19-03): the bundled desktop/network.json section and, when the
 * player or an operator supplied one, userData/network.json. Both go unfiltered to the peer runtime,
 * which validates them as typed service descriptors, records accepted decisions in its append-only
 * service history and derives the effective bootstrap/relay/archive policy. No secrets live here.
 */
function networkConfig() {
  const read = (f) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } };
  const bundled = read(join(appRoot, 'desktop', 'network.json'))?.networks?.[NETWORK_ID] ?? null;
  const local = read(join(app.getPath('userData'), 'network.json'))?.networks?.[NETWORK_ID] ?? null;
  return { services: { bundled, local } };
}

function callPeer(op, args, timeoutMs = 20_000) {
  if (!peer.proc) return Promise.reject(new Error('the peer runtime is not running'));
  const id = ++peer.seq;
  return new Promise((res, rej) => {
    // a host deadline only ends this wait: the worker's operation is not cancelled and may still
    // complete (the view asks the authority for the outcome; R18-02)
    const t = setTimeout(() => { peer.pending.delete(id); rej(Object.assign(new Error(`${op} did not answer in time; it may still complete`), { code: 'HOST_TIMEOUT' })); }, timeoutMs);
    peer.pending.set(id, { gen: peer.gen, resolve: (v) => { clearTimeout(t); res(v); }, reject: (e) => { clearTimeout(t); rej(e); } });
    peer.proc.postMessage({ type: 'call', id, op, args });
  });
}

let win = null;
function broadcast(event) { if (win && !win.isDestroyed()) win.webContents.send('versus:event', event); }

// Renderer → host operations. The renderer names an operation; the host validates the sender and
// the operation name, and the runtime validates arguments, seat and generation.
const LONG_OPS = new Set(['results.sync', 'profile.get', 'directory.list', 'lobby.join']);
const RENDERER_OPS = new Set(['getStatus', 'setDisplayName', 'probeTransport', 'lobby.join', 'lobby.leave', 'lobby.list', 'setAvailability', 'challenge', 'challenge.cancel', 'challenge.respond', 'invite.join', 'attempt.cancel', 'attempt.get', 'diagnostics', 'table.open', 'table.close', 'table.join', 'setup.retry', 'setup.leave', 'match.get', 'match.draft', 'match.ready', 'match.choice', 'match.leave', 'match.resume', 'history.list', 'profile.get', 'results.list', 'results.sync', 'directory.list']);
ipcMain.handle('versus:call', async (e, msg) => {
  const frameUrl = e.senderFrame?.url ?? '';
  if (!frameUrl.startsWith(`${ORIGIN}/`) || e.senderFrame !== e.sender.mainFrame) throw new Error('refused: not the game page');
  if (!msg || typeof msg.op !== 'string' || !RENDERER_OPS.has(msg.op)) throw new Error('refused: unknown operation');
  await whenReady();
  // deadlines match the runtime's own bounds (N19-02): joins return at once with an attempt; archive
  // lookups ask each archive with their own 15 s bounds; everything else is local and quick
  return callPeer(msg.op, msg.args ?? {}, LONG_OPS.has(msg.op) ? 120_000 : 20_000);
});
ipcMain.handle('versus:host', async (e, msg) => {
  const frameUrl = e.senderFrame?.url ?? '';
  if (!frameUrl.startsWith(`${ORIGIN}/`)) throw new Error('refused');
  if (msg?.op === 'about') return about();
  if (msg?.op === 'revealData') { shell.showItemInFolder(stateRoot()); return true; }
  // the peer service's lifecycle and an explicit Retry after a bounded failure (R18-05)
  if (msg?.op === 'peerStatus') return { state: peer.state, error: peer.error };
  if (msg?.op === 'restartPeer') {
    if (peer.state === 'failed' && !peer.proc) { peer.restarts = []; startPeer(); }
    return { state: peer.state, error: peer.error };
  }
  throw new Error('refused: unknown host operation');
});

function about() {
  let pkg = {};
  try { pkg = JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf8')); } catch { /* packaged without it */ }
  let build = null;
  try { build = JSON.parse(readFileSync(join(appRoot, 'desktop', 'build-info.json'), 'utf8')); } catch { /* development run */ }
  return { app: 'Hapa Versus', version: app.getVersion(), packaged: app.isPackaged, electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node, platform: process.platform, arch: process.arch, network: NETWORK_ID, build, peer: peer.status ? { runtime: peer.status.runtime, fingerprint: peer.status.player?.fingerprint } : null, name: pkg.productName ?? 'Hapa Versus' };
}

// --- window ------------------------------------------------------------------------------------
function boundsFile() { return join(app.getPath('userData'), 'window.json'); }
function savedBounds() {
  try {
    const b = JSON.parse(readFileSync(boundsFile(), 'utf8'));
    const onScreen = screen.getAllDisplays().some((d) => b.x >= d.workArea.x - 40 && b.y >= d.workArea.y - 40 && b.x + 200 <= d.workArea.x + d.workArea.width && b.y + 120 <= d.workArea.y + d.workArea.height);
    return onScreen ? b : { width: b.width, height: b.height };
  } catch { return null; }
}

function createWindow() {
  const b = savedBounds() ?? {};
  win = new BrowserWindow({
    width: b.width ?? 1440, height: b.height ?? 900, x: b.x, y: b.y, minWidth: 960, minHeight: 640,
    title: 'Hapa Versus', backgroundColor: '#14110f', show: false,
    webPreferences: { preload: join(appRoot, 'desktop', 'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, partition: PARTITION, spellcheck: false },
  });
  if (b.maximized) win.maximize();
  win.once('ready-to-show', () => { if (!SMOKE_OUT || process.env.HAPA_VERSUS_SMOKE_SHOW) win.show(); });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(`${ORIGIN}/`)) e.preventDefault(); });
  win.on('close', () => {
    try { mkdirSync(app.getPath('userData'), { recursive: true }); writeFileSync(boundsFile(), JSON.stringify({ ...win.getNormalBounds(), maximized: win.isMaximized() })); } catch { /* best effort */ }
  });
  win.on('closed', () => { win = null; });
  if (SMOKE_OUT) win.webContents.on('console-message', (e) => { if (smokeConsole.length < 80 && e.level !== 'debug') smokeConsole.push(`${e.level}: ${String(e.message).slice(0, 300)}`); });
  const start = process.env.HAPA_VERSUS_START || (SMOKE_OUT && !process.env.HAPA_VERSUS_SMOKE_SCRIPT ? 'versus.html?autostart=1&a=human&b=bot' : 'versus.html');
  win.loadURL(`${ORIGIN}/${start}`);
  return win;
}

function buildMenu() {
  const template = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { role: 'fileMenu' }, { role: 'editMenu' },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'togglefullscreen' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }] },
    { role: 'windowMenu' },
    { label: 'Help', submenu: [
      { label: 'About Hapa Versus', click: () => { const a = about(); dialog.showMessageBox({ message: `Hapa Versus ${a.version}`, detail: `Electron ${a.electron} · ${a.platform}-${a.arch}\nNetwork ${a.network}${a.peer ? `\nPlayer ${a.peer.fingerprint}` : ''}${a.build ? `\nGame build ${a.build.source?.slice(0, 12)} · engine ${a.build.engine?.slice(0, 12)}` : ''}` }); } },
      { label: 'Show Player Data Folder', click: () => shell.showItemInFolder(stateRoot()) },
    ] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

app.whenReady().then(async () => {
  const ses = session.fromPartition(PARTITION);
  ses.protocol.handle('app', handleApp);
  ses.protocol.handle('http', handleRedFrame);
  ses.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'fullscreen' || permission === 'clipboard-sanitized-write'));
  buildMenu();
  startPeer();
  createWindow();
  // after sleep or a network change, refresh presence and reconnect from durable state before claiming Available
  powerMonitor.on('suspend', () => { if (peer.proc) peer.proc.postMessage({ type: 'call', id: 0, op: 'system.suspend', args: {} }); });
  powerMonitor.on('resume', () => { if (peer.proc) peer.proc.postMessage({ type: 'call', id: 0, op: 'system.resume', args: {} }); });
  if (SMOKE_OUT) runSmoke().catch((e) => { writeSmoke({ ok: false, error: e.stack ?? String(e) }); app.exit(1); });
});

app.on('window-all-closed', () => app.quit());

let shutdownDone = false;
app.on('before-quit', (e) => {
  if (shutdownDone || !peer.proc) return;
  e.preventDefault();
  peer.quitting = true;
  const p = peer.proc;
  const done = () => { shutdownDone = true; app.quit(); };
  const t = setTimeout(() => { try { p.kill(); } catch { /* gone */ } done(); }, 4000);
  p.once('exit', () => { clearTimeout(t); done(); });
  p.postMessage({ type: 'shutdown' });
});

// --- packaged smoke / journey automation (evidence only; writes only into the given directory) ----
// Loaded only when HAPA_VERSUS_SMOKE_OUT names an absolute directory; inert otherwise.
const smokeConsole = [];
async function runSmoke() {
  const { runSmoke: run } = await import('./smoke.mjs');
  await run({ app, win, peer, callPeer, about, stateRoot, appRoot, out: SMOKE_OUT, consoleLines: smokeConsole, script: process.env.HAPA_VERSUS_SMOKE_SCRIPT || 'local' });
}
function writeSmoke(obj) { mkdirSync(SMOKE_OUT, { recursive: true }); writeFileSync(join(SMOKE_OUT, 'smoke.json'), JSON.stringify(obj, null, 1)); }
