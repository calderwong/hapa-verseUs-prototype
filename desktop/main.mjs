/**
 * Hapa Versus desktop main process (Addendum 08; docs/integrations/electron-desktop-v1.md).
 *
 * Main owns app identity, the `app://versus/` origin, the window, the single-instance lock and the
 * supervised peer utility process. It runs no game rules and holds no player keys: the utility
 * process hosts the same reusable Node peer runtime the headless tools use, and the sandboxed
 * renderer reaches it only through the narrow preload bridge (desktop/preload.cjs).
 */
import { app, BrowserWindow, protocol, session, ipcMain, utilityProcess, net, shell, dialog, Menu, screen } from 'electron';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, normalize, extname, isAbsolute, resolve, sep } from 'node:path';
import { matchOwnerRoute, ownerEndpoint } from '../src/hapa/host/owner-routes.js';

const ORIGIN = 'app://versus';
const PARTITION = 'persist:versus';
const NETWORK_ID = process.env.HAPA_VERSUS_NETWORK || 'public-alpha';

app.setName('Hapa Versus');
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
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";

/** Owner configuration is explicit (userData/owners.json); none means every optional owner is absent. */
function ownerConfig() {
  try { return JSON.parse(readFileSync(join(app.getPath('userData'), 'owners.json'), 'utf8')); } catch { return null; }
}

async function serveStatic(pathname) {
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
  if (type.startsWith('text/html')) headers['content-security-policy'] = CSP;
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

// --- the peer utility process ------------------------------------------------------------------
const peer = { proc: null, pending: new Map(), seq: 0, restarts: [], status: null, quitting: false, ready: null };

function startPeer() {
  const entry = join(appRoot, 'desktop', 'peer-host.mjs');
  const proc = utilityProcess.fork(entry, [], { serviceName: 'Hapa Versus Peer', stdio: 'pipe' });
  peer.proc = proc;
  proc.stdout?.on('data', (d) => process.stdout.write(`[peer] ${d}`));
  proc.stderr?.on('data', (d) => process.stderr.write(`[peer] ${d}`));
  peer.ready = new Promise((resolveReady, rejectReady) => {
    const onMsg = (m) => {
      if (m?.type === 'ready') { peer.status = m.status; resolveReady(m.status); }
      else if (m?.type === 'fatal') rejectReady(new Error(m.error));
      else if (m?.type === 'reply') { const p = peer.pending.get(m.id); if (p) { peer.pending.delete(m.id); m.ok ? p.resolve(m.value) : p.reject(Object.assign(new Error(m.error), { code: m.code })); } }
      else if (m?.type === 'event') broadcast(m.event);
    };
    proc.on('message', onMsg);
  });
  peer.ready.catch((e) => broadcast({ type: 'runtime', state: 'failed', error: e.message }));
  proc.on('exit', (code) => {
    for (const p of peer.pending.values()) p.reject(new Error('the peer runtime stopped'));
    peer.pending.clear();
    peer.proc = null;
    if (peer.quitting) return;
    const now = Date.now();
    peer.restarts = peer.restarts.filter((t) => now - t < 60_000);
    if (peer.restarts.length >= 3) { broadcast({ type: 'runtime', state: 'failed', error: `the peer runtime stopped repeatedly (exit ${code})` }); return; }
    peer.restarts.push(now);
    broadcast({ type: 'runtime', state: 'restarting', exitCode: code });
    setTimeout(startPeer, 500 * peer.restarts.length);
  });
  proc.postMessage({ type: 'init', root: stateRoot(), networkId: NETWORK_ID });
}

function callPeer(op, args, timeoutMs = 20_000) {
  if (!peer.proc) return Promise.reject(new Error('the peer runtime is not running'));
  const id = ++peer.seq;
  return new Promise((res, rej) => {
    const t = setTimeout(() => { peer.pending.delete(id); rej(new Error(`${op} timed out`)); }, timeoutMs);
    peer.pending.set(id, { resolve: (v) => { clearTimeout(t); res(v); }, reject: (e) => { clearTimeout(t); rej(e); } });
    peer.proc.postMessage({ type: 'call', id, op, args });
  });
}

let win = null;
function broadcast(event) { if (win && !win.isDestroyed()) win.webContents.send('versus:event', event); }

// Renderer → host operations. The renderer names an operation; the host validates the sender and
// the operation name, and the runtime validates arguments, seat and generation.
const RENDERER_OPS = new Set(['getStatus', 'setDisplayName', 'probeTransport', 'lobby.join', 'lobby.leave', 'lobby.list', 'setAvailability', 'challenge', 'challenge.cancel', 'challenge.respond', 'invite.create', 'invite.join', 'table.open', 'table.close', 'match.get', 'match.draft', 'match.ready', 'match.choice', 'match.leave', 'match.resume', 'history.list', 'profile.get']);
ipcMain.handle('versus:call', async (e, msg) => {
  const frameUrl = e.senderFrame?.url ?? '';
  if (!frameUrl.startsWith(`${ORIGIN}/`) || e.senderFrame !== e.sender.mainFrame) throw new Error('refused: not the game page');
  if (!msg || typeof msg.op !== 'string' || !RENDERER_OPS.has(msg.op)) throw new Error('refused: unknown operation');
  await peer.ready;
  return callPeer(msg.op, msg.args ?? {});
});
ipcMain.handle('versus:host', async (e, msg) => {
  const frameUrl = e.senderFrame?.url ?? '';
  if (!frameUrl.startsWith(`${ORIGIN}/`)) throw new Error('refused');
  if (msg?.op === 'about') return about();
  if (msg?.op === 'revealData') { shell.showItemInFolder(stateRoot()); return true; }
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
  const start = process.env.HAPA_VERSUS_START || 'versus.html?autostart=1&a=human&b=bot';
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
  ses.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'fullscreen' || permission === 'clipboard-sanitized-write'));
  buildMenu();
  startPeer();
  createWindow();
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

// --- packaged smoke (focused attachment evidence; writes only into the given directory) ---------
const smokeConsole = [];
function writeSmoke(obj) { mkdirSync(SMOKE_OUT, { recursive: true }); writeFileSync(join(SMOKE_OUT, 'smoke.json'), JSON.stringify(obj, null, 1)); }

async function runSmoke() {
  const t0 = Date.now();
  const status = await peer.ready;
  const transport = await callPeer('probeTransport', {}, 30_000);
  if (win.webContents.isLoading()) await new Promise((r) => win.webContents.once('did-finish-load', r));
  let page = null, lastPending = null, smokeDiag = null;
  for (let i = 0; i < 60; i++) {
    page = await win.webContents.executeJavaScript(`(() => { const v = window.__versus; const s = v?.session?.state; const canvas = document.querySelector('canvas'); return s ? { tick: s.tick, phase: s.phase, parties: Object.values(s.parties).filter(p => p.alive).length, seats: v.seats ?? null, canvas: canvas ? [canvas.width, canvas.height] : null, bridge: typeof window.hapaDesktop, bridgeKeys: window.hapaDesktop ? Object.keys(window.hapaDesktop) : [], nodeInPage: typeof require !== 'undefined' || typeof process !== 'undefined', origin: location.origin, title: document.title } : { pending: true, ready: document.readyState, href: location.href, body: document.body?.innerHTML.length ?? -1, resources: performance.getEntriesByType('resource').map(r => r.name.split('/').pop() + ':' + (r.responseStatus ?? '?')).slice(0, 12), hasVersus: typeof window.__versus }; })()`);
    if (page?.pending) { lastPending = page; page = null; if (i === 3) smokeDiag = await win.webContents.executeJavaScript(`(async () => { const src = document.querySelector('script[type=module]')?.src; const f = await fetch(src).then(r => r.status + ' ' + r.headers.get('content-type')).catch(e => 'fetch ' + e.message); const m = await import(src).then(() => 'import ok').catch(e => 'import ' + e.message); return { src, f, m }; })()`); }
    if (page && page.canvas) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  await new Promise((r) => setTimeout(r, 2500));
  const image = await win.webContents.capturePage();
  mkdirSync(SMOKE_OUT, { recursive: true });
  writeFileSync(join(SMOKE_OUT, 'local-match.png'), image.toPNG());
  const bridge = await win.webContents.executeJavaScript(`window.hapaDesktop.call('getStatus').then(s => ({ ok: true, state: s.state, launch: s.launch, fingerprint: s.player?.fingerprint, hasSecret: JSON.stringify(s).includes('secretKey') })).catch(e => ({ ok: false, error: e.message }))`);
  const refused = await win.webContents.executeJavaScript(`window.hapaDesktop.call('deleteEverything').then(() => 'accepted').catch(e => e.message)`);
  const owners = await win.webContents.executeJavaScript(`Promise.all(['/capabilities','/music/cj/songs?q=x','/harness/game-status'].map(u => fetch(u).then(r => r.status).catch(e => 'error ' + e.message)))`);
  writeSmoke({ ok: !!(page?.canvas && status.launch && transport.destroyed && bridge.ok && !bridge.hasSecret), ms: Date.now() - t0, about: about(), userData: '(redacted: OS userData)', dataInsideBundle: stateRoot().startsWith(appRoot), status: { state: status.state, launch: status.launch, createdIdentity: status.createdIdentity, versions: status.versions, fingerprint: status.player?.fingerprint }, transport, page, bridge, refusedUnknownOp: refused, ownerRoutes: owners, console: smokeConsole, lastPending, diag: smokeDiag });
  app.quit();
}
