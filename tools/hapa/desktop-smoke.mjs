#!/usr/bin/env node
/**
 * npm run desktop:smoke -- [--app <path to .app>] [--data <abs dir>] [--out <abs dir>] [--launches n]
 *
 * Focused packaged-app attachment proof (electron-desktop-v1 §6): launch the actual packaged app's
 * executable — not `electron .` — with a minimal environment (no Node/npm on PATH, no Vite server,
 * no owner configuration) and an isolated test data root. Each launch renders a local human/bot
 * match, opens/appends/closes/reopens a native Hypercore in the utility process, starts/stops the
 * peer transport and checks the bridge. Run twice to show the store reopening across launches.
 */
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const app = resolve(arg('app', 'out/Hapa Versus-darwin-arm64/Hapa Versus.app'));
// --exe: a Windows (or other) packaged executable; otherwise the macOS .app layout
const exe = arg('exe') ? resolve(arg('exe')) : join(app, 'Contents', 'MacOS', 'Hapa Versus');
// --os-data: use the operating system's own user-data folder (the player path) instead of an isolated root
const osData = process.argv.includes('--os-data');
if (!existsSync(exe)) { console.error(`no packaged app at ${app} (run npm run desktop:package)`); process.exit(2); }
const data = resolve(arg('data', join(tmpdir(), `hapa-versus-smoke-${Date.now().toString(36)}`)));
const outRoot = resolve(arg('out', join(data, 'smoke')));
const launches = Number(arg('launches', 2));

const results = [];
for (let i = 1; i <= launches; i++) {
  const out = join(outRoot, `launch-${i}`);
  mkdirSync(out, { recursive: true });
  const win = process.platform === 'win32';
  const base = win ? { SystemRoot: process.env.SystemRoot, windir: process.env.windir, PATH: `${process.env.SystemRoot}\\System32;${process.env.SystemRoot}`, USERPROFILE: process.env.USERPROFILE, APPDATA: process.env.APPDATA, LOCALAPPDATA: process.env.LOCALAPPDATA, TEMP: process.env.TEMP, TMP: process.env.TMP } : { HOME: process.env.HOME, PATH: '/usr/bin:/bin', TMPDIR: process.env.TMPDIR ?? '/tmp' };
  const env = { ...base, ...(osData ? {} : { HAPA_VERSUS_DATA_DIR: data }), HAPA_VERSUS_SMOKE_OUT: out, HAPA_VERSUS_NETWORK: 'test-smoke' };
  const t0 = Date.now();
  const code = await new Promise((res) => {
    const p = spawn(exe, [], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    p.stdout.on('data', (d) => { log += d; });
    p.stderr.on('data', (d) => { log += d; });
    const t = setTimeout(() => { p.kill('SIGKILL'); }, 120_000);
    p.on('exit', (c) => { clearTimeout(t); if (process.argv.includes('--verbose')) console.log(log); res(c); });
  });
  let smoke = null;
  try { smoke = JSON.parse(readFileSync(join(out, 'smoke.json'), 'utf8')); } catch { /* none */ }
  results.push({ launch: i, exit: code, seconds: Math.round((Date.now() - t0) / 100) / 10, ok: !!smoke?.ok, storeLength: smoke?.status?.launch?.length, createdIdentity: smoke?.status?.createdIdentity, fingerprint: smoke?.status?.fingerprint, page: smoke?.page, transport: smoke?.transport, bridge: smoke?.bridge, refusedUnknownOp: smoke?.refusedUnknownOp, ownerRoutes: smoke?.ownerRoutes, dataInsideBundle: smoke?.dataInsideBundle, versions: smoke?.status?.versions, about: smoke?.about, error: smoke?.error });
}
const sameIdentity = results.every((r) => r.fingerprint && r.fingerprint === results[0].fingerprint);
const grew = results.every((r, i) => r.storeLength === i + 1 + (results[0].storeLength - 1));
const ok = results.every((r) => r.ok && r.exit === 0) && sameIdentity && grew;
console.log(JSON.stringify({ app: (arg('exe') ?? app).replace(process.env.HOME ?? process.env.USERPROFILE ?? '~', '~'), platform: `${process.platform}-${process.arch}`, data: osData ? '(operating-system user data folder)' : '(isolated test root)', launches: results, sameIdentity, storeGrewPerLaunch: grew, ok }, null, 1));
process.exit(ok ? 0 : 1);
