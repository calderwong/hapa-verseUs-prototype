#!/usr/bin/env node
/**
 * Installed Mesh Avatar opponents (Falka, Leo, Thor):
 *
 *   node tools/hapa/desktop-mesh-journey.mjs --app <path to .app> --work <abs scratch dir> [--avatars avatar-8,avatar-46,avatar-39]
 *
 * Needs Mesh Avatar's player node running on 127.0.0.1:8860 (`npm run owners -- --start`). For each
 * Avatar the packaged app runs visibly with a minimal environment and an isolated data root whose
 * owners.json names that node; smoke script `mesh` chooses the Avatar, waits for the owner figure in the
 * loopback frame, captures Home and plays one Tick. Records the package identity the owner served.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const app = resolve(arg('app', 'out/Hapa Versus-darwin-arm64/Hapa Versus.app'));
const exe = join(app, 'Contents', 'MacOS', 'Hapa Versus');
const work = resolve(arg('work'));
const avatars = arg('avatars', 'avatar-8,avatar-46,avatar-39').split(',');
const FILES = { 'avatar-8': 'falka/falka-package.json', 'avatar-46': 'leo/leo-package.json', 'avatar-39': 'thor/thor-package.json' };
rmSync(work, { recursive: true, force: true });
const results = [];
for (const id of avatars) {
  const dir = join(work, id), out = join(dir, 'out');
  mkdirSync(join(dir, 'data'), { recursive: true });
  writeFileSync(join(dir, 'data', 'owners.json'), JSON.stringify({ mesh: { url: 'http://127.0.0.1:8860' } }));
  let served = null;
  try { const text = await (await fetch(`http://127.0.0.1:8860/apps/player/${FILES[id]}`)).text(); const j = JSON.parse(text); served = { id: j.id, revision: j.revision, renderer: j.renderer, status: j.status, avatarId: j.avatarId, sha256: createHash('sha256').update(text).digest('hex'), bytes: Buffer.byteLength(text) }; } catch (e) { served = { error: e.message }; }
  const env = { HOME: process.env.HOME, PATH: '/usr/bin:/bin', TMPDIR: process.env.TMPDIR ?? '/tmp', HAPA_VERSUS_DATA_DIR: join(dir, 'data'), HAPA_VERSUS_SMOKE_OUT: out, HAPA_VERSUS_SMOKE_SHOW: '1', HAPA_VERSUS_SMOKE_SCRIPT: 'mesh', HAPA_VERSUS_SMOKE_AVATAR: id, HAPA_VERSUS_START: 'versus.html?debug=1', HAPA_VERSUS_NETWORK: 'test-mesh' };
  const p = spawn(exe, [], { env, stdio: 'ignore' });
  const code = await new Promise((res) => { const t = setTimeout(() => p.kill('SIGKILL'), 240_000); p.on('exit', (c) => { clearTimeout(t); res(c); }); });
  let smoke = null; try { smoke = JSON.parse(readFileSync(join(out, 'smoke.json'), 'utf8')); } catch { /* none */ }
  results.push({ avatarId: id, ok: !!smoke?.ok, exit: code, ownerServed: served, binding: smoke?.binding ?? null, drawn: smoke?.drawn, tickBefore: smoke?.tickBefore, tickAfter: smoke?.tickAfter, origin: smoke?.origin, build: smoke?.about?.build ?? null, seconds: smoke?.seconds, capture: `${id}/out/mesh-${id}-home.png` });
}
const report = { ok: results.every((r) => r.ok), app: app.replace(process.env.HOME, '~'), results };
writeFileSync(join(work, 'report.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
process.exit(report.ok ? 0 : 1);
