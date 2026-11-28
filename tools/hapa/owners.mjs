#!/usr/bin/env node
/**
 * Local owner status for the representative demo (review 18, R18-01).
 *
 *   npm run owners            report which optional owners answer on this computer
 *   npm run owners -- --start also start the ones that are not running, with each owner's own
 *                             documented command in its own checkout (loopback only, detached,
 *                             logs in the system temp folder)
 *
 * Red's figure and voice come from Harbor (Red's renderer package `red-pose-art`, built from the
 * Mesh Avatar pin); the table music from two Hapa Song Registry nodes. None is required to play: an
 * owner that is not running leaves its feature unavailable and the match retries it by itself.
 * This tool never edits an owner, installs anything or prints a token.
 */
import { spawn } from 'node:child_process';
import { existsSync, openSync, readFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const H = homedir();
const env = process.env;
const OWNERS = [
  { name: 'Harbor (Red: renderer, voice)', url: env.HAPA_HARBOR_URL ?? 'http://127.0.0.1:8862', probe: '/capabilities', token: resolve(env.HAPA_HARBOR_ROOT ?? join(H, 'Documents/Codex/2026-06-29/can/work/hapa-harbor-storefront'), 'data/api-token'),
    cwd: env.HAPA_HARBOR_ROOT ?? join(H, 'Documents/Codex/2026-06-29/can/work/hapa-harbor-storefront'), cmd: ['node', 'server/main.mjs'], extra: {} },
  { name: 'Mesh Avatar player node (Falka, Leo, Thor)', url: env.HAPA_MESH_URL ?? 'http://127.0.0.1:8860', probe: '/apps/player/falka/falka-package.json', token: null,
    cwd: env.HAPA_MESH_ROOT ?? join(H, 'hapa-mesh-avatar'), cmd: ['node', 'server/api.mjs'], extra: {} },
  { name: "Red's music library", url: env.HAPA_MUSIC_RED_URL ?? 'http://127.0.0.1:8801', probe: '/api/peer/node', token: env.HAPA_MUSIC_RED_TOKEN ?? join(H, '.hapa-music-libraries/red-reaper/api-token'),
    cwd: join(H, 'Desktop/hapa-song-registry'), cmd: ['node', 'src/api-server.js', '--port', '8801', '--peer-port', '8802'], extra: { HAPA_SONG_REGISTRY_DATA_ROOT: join(H, '.hapa-music-libraries/red-reaper') } },
  { name: 'Your music library', url: env.HAPA_MUSIC_CJ_URL ?? 'http://127.0.0.1:8811', probe: '/api/peer/node', token: env.HAPA_MUSIC_CJ_TOKEN ?? join(H, 'Desktop/hapa-song-registry/data/api-token'),
    cwd: join(H, 'Desktop/hapa-song-registry'), cmd: ['node', 'src/api-server.js', '--port', '8811', '--peer-port', '8812'], extra: {} },
];

const readToken = (f) => { if (!f) return null; try { return readFileSync(f, 'utf8').trim() || null; } catch { return null; } };
async function probe(o) {
  try {
    const t = readToken(o.token);
    const r = await fetch(o.url + o.probe, { headers: t ? { authorization: `Bearer ${t}` } : {}, signal: AbortSignal.timeout(3000) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { up: true, ok: false, detail: `${r.status} ${j.error ?? ''}`.trim() };
    return { up: true, ok: true, detail: j.version === 'hapa.avatar-performance-package.v1' ? `package ${j.id} ${j.revision} (${j.renderer}), ${j.status}` : j.avatarPackage ? `package ${j.avatarPackage.id} ${j.avatarPackage.revision} (${j.avatarPackage.renderer}), ${j.avatarPackage.available ? 'available' : `unavailable: ${j.avatarPackage.reason}`}` : j.label ?? 'answering' };
  } catch (e) { return { up: false, ok: false, detail: e.cause?.code ?? e.name }; }
}

const start = process.argv.includes('--start');
let missing = 0;
for (const o of OWNERS) {
  let s = await probe(o);
  if (!s.up && start) {
    if (!existsSync(o.cwd)) { console.log(`✗ ${o.name}: not running, and no checkout at ${o.cwd.replace(H, '~')}`); missing++; continue; }
    const log = join(tmpdir(), `hapa-versus-owner-${o.url.split(':').pop()}.log`);
    const fd = openSync(log, 'a');
    spawn(o.cmd[0] === 'node' ? process.execPath : o.cmd[0], o.cmd.slice(1), { cwd: o.cwd, env: { ...env, ...o.extra }, detached: true, stdio: ['ignore', fd, fd] }).unref();
    for (let i = 0; i < 20 && !s.up; i++) { await new Promise((r) => setTimeout(r, 500)); s = await probe(o); }
    console.log(`${s.ok ? '✓' : '✗'} ${o.name}: started (${o.cmd.join(' ')}), ${s.detail}; log ${log}`);
  } else console.log(`${s.ok ? '✓' : '✗'} ${o.name} at ${o.url}: ${s.up ? s.detail : `not running (${s.detail})${start ? '' : ` — start: cd ${o.cwd.replace(H, '~')} && ${Object.entries(o.extra).map(([k, v]) => `${k}=${v.replace(H, '~')} `).join('')}${o.cmd.join(' ')}`}`}`);
  if (!s.ok) missing++;
}
if (missing && !start) console.log('\nOr run `npm run owners -- --start`. The game is playable without them; a running match picks them up by itself.');
process.exit(0);
