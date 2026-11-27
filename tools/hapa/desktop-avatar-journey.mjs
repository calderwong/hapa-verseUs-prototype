#!/usr/bin/env node
/**
 * Installed default-Avatar journey (Review 20 V20-C / N22-04):
 *
 *   node tools/hapa/desktop-avatar-journey.mjs --app <path to .app> --harbor <Harbor checkout> --work <abs scratch dir>
 *
 * Requires that Harbor is NOT running at start (the owner-absent state is part of the witness). The
 * packaged app runs visibly with a minimal environment and an isolated data root whose owners.json
 * names the local Harbor. When the app signals the owner-absent state, this driver starts Harbor with
 * its own documented command; the app must restore Red in the same match. Records the exact owner
 * package description (id, revision, renderer, integrity mode) and the SHA-256 of the package manifest
 * Harbor served, the Mesh Avatar pin it is built from, and the app's own report and captures.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const app = resolve(arg('app', 'out/Hapa Versus-darwin-arm64/Hapa Versus.app'));
const exe = join(app, 'Contents', 'MacOS', 'Hapa Versus');
const harbor = resolve(arg('harbor'));
const work = resolve(arg('work'));
rmSync(work, { recursive: true, force: true });
mkdirSync(join(work, 'data'), { recursive: true });
const up = async () => { try { return (await fetch('http://127.0.0.1:8862/', { signal: AbortSignal.timeout(1500) })).status > 0; } catch { return false; } };
if (await up()) { console.error('Harbor is already running on 8862: stop it first (the owner-absent state is part of this witness)'); process.exit(2); }
writeFileSync(join(work, 'data', 'owners.json'), JSON.stringify({ harbor: { url: 'http://127.0.0.1:8862', tokenFile: join(harbor, 'data', 'api-token') } }));
const signal = join(work, 'signal'), out = join(work, 'out');
const env = { HOME: process.env.HOME, PATH: '/usr/bin:/bin', TMPDIR: process.env.TMPDIR ?? '/tmp', HAPA_VERSUS_DATA_DIR: join(work, 'data'), HAPA_VERSUS_SMOKE_OUT: out, HAPA_VERSUS_SMOKE_SHOW: '1', HAPA_VERSUS_SMOKE_SCRIPT: 'avatar', HAPA_VERSUS_SMOKE_SIGNAL: signal, HAPA_VERSUS_START: 'versus.html?autostart=1&a=human&b=bot', HAPA_VERSUS_NETWORK: 'test-avatar' };
const p = spawn(exe, [], { env, stdio: 'ignore' });
let owner = null;
const done = new Promise((res) => { const t = setTimeout(() => p.kill('SIGKILL'), 300_000); p.on('exit', (c) => { clearTimeout(t); res(c); }); });
// start the owner when the app has recorded its absence
for (let i = 0; i < 600 && !owner; i++) {
  if (existsSync(signal)) owner = spawn(process.execPath, ['server/main.mjs'], { cwd: harbor, stdio: 'ignore', detached: true });
  else await new Promise((r) => setTimeout(r, 250));
}
// package identity as served now (manifest digest)
let pkg = null;
for (let i = 0; i < 40 && owner && !pkg; i++) {
  await new Promise((r) => setTimeout(r, 500));
  try {
    const token = readFileSync(join(harbor, 'data', 'api-token'), 'utf8').trim();
    const caps = await (await fetch('http://127.0.0.1:8862/capabilities', { headers: { authorization: `Bearer ${token}` } })).json();
    const manifest = await (await fetch('http://127.0.0.1:8862/v1/avatar-package', { headers: { authorization: `Bearer ${token}` } })).text();
    let pin = null; try { pin = JSON.parse(readFileSync(join(harbor, 'data', 'red-renderer-pin-a6fc511.provenance.json'), 'utf8')); } catch { /* absent */ }
    pkg = { ...caps.avatarPackage, manifestSha256: createHash('sha256').update(manifest).digest('hex'), manifestBytes: manifest.length, meshAvatarPin: pin ? { owner: pin.owner, pinnedCommit: pin.pinnedCommit } : null, rendererKind: '2D mesh: forward triangle rasterization over pose art (WebGL); not volumetric' };
  } catch { /* not up yet */ }
}
const code = await done;
let smoke = null; try { smoke = JSON.parse(readFileSync(join(out, 'smoke.json'), 'utf8')); } catch { /* none */ }
const report = { ok: !!smoke?.ok && !!pkg, exit: code, app: app.replace(process.env.HOME, '~'), build: smoke?.about?.build ?? null, ownerPackage: pkg, steps: smoke?.log ?? null, sameMatch: smoke?.sameMatch, tickBefore: smoke?.tickBefore, tickAfter: smoke?.tickAfter, harborLeftRunning: !!owner };
writeFileSync(join(work, 'report.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
owner?.unref();
process.exit(report.ok ? 0 : 1);
