#!/usr/bin/env node
/**
 * Installed invitation journey (Assignment 19; engineering evidence for FT-03/04/05 on ONE machine —
 * it does not replace two computers on two independent internet connections):
 *
 *   node tools/hapa/desktop-invite-journey.mjs --app <path to .app> --work <abs scratch dir> [--network <id>]
 *
 * Two copies of the installed app, each with its own data root and a minimal environment (no Node,
 * owners or checkout), both human seats. The host opens a table and copies the invitation with the
 * real buttons; the joiner pastes it and presses Join by invitation; both press Ready each Tick;
 * the joiner concedes after a few Ticks (a deliberate human concession under the rules). Then both
 * apps are reopened: same fingerprints, the result recorded on both, the same final hash.
 */
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const app = resolve(arg('app', 'out/Hapa Versus-darwin-arm64/Hapa Versus.app'));
const exe = join(app, 'Contents', 'MacOS', 'Hapa Versus');
const work = arg('work');
if (!work) { console.error('--work <absolute scratch directory> is required'); process.exit(2); }
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
const NET = arg('network', `test-invite-${Date.now().toString(36)}`);
const invite = join(work, 'invitation.txt');

function launch(name, data, env, timeout = 600_000) {
  const out = join(work, name);
  mkdirSync(out, { recursive: true });
  const e = { HOME: process.env.HOME, PATH: '/usr/bin:/bin', TMPDIR: process.env.TMPDIR ?? '/tmp', HAPA_VERSUS_DATA_DIR: join(work, data), HAPA_VERSUS_NETWORK: NET, HAPA_VERSUS_SMOKE_OUT: out, HAPA_VERSUS_START: 'versus.html?debug=1', ...env };
  const p = spawn(exe, [], { env: e, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; p.stdout.on('data', (d) => { log += d; }); p.stderr.on('data', (d) => { log += d; });
  const done = new Promise((res) => { const t = setTimeout(() => p.kill('SIGKILL'), timeout); p.on('exit', (code) => { clearTimeout(t); res(code); }); });
  return { done, out, log: () => log };
}
const smoke = (dir) => { try { return JSON.parse(readFileSync(join(dir, 'smoke.json'), 'utf8')); } catch { return null; } };
const recorded = (data) => { const d = join(work, data, 'state', NET, 'matches'); if (!existsSync(d)) return []; return readdirSync(d).map((id) => { try { return JSON.parse(readFileSync(join(d, id, 'progress.json'), 'utf8')); } catch { return null; } }).filter(Boolean); };

const host = launch('host', 'cal', { HAPA_VERSUS_SMOKE_SCRIPT: 'online', HAPA_VERSUS_SMOKE_NAME: 'Cal', HAPA_VERSUS_SMOKE_INVITE_OUT: invite, HAPA_VERSUS_SMOKE_TICKS: '6' });
await new Promise((r) => setTimeout(r, 4000));
const joiner = launch('joiner', 'friend', { HAPA_VERSUS_SMOKE_SCRIPT: 'online', HAPA_VERSUS_SMOKE_NAME: 'Friend', HAPA_VERSUS_SMOKE_INVITE_IN: invite, HAPA_VERSUS_SMOKE_TICKS: '6', HAPA_VERSUS_SMOKE_CONCEDE_AFTER: '3' });
const [hc, jc] = await Promise.all([host.done, joiner.done]);
const hs = smoke(host.out), js = smoke(joiner.out);
// reopen both: identity and records persist
const h2 = launch('host-reopen', 'cal', { HAPA_VERSUS_SMOKE_SCRIPT: 'local' }, 120_000);
const j2 = launch('joiner-reopen', 'friend', { HAPA_VERSUS_SMOKE_SCRIPT: 'local' }, 120_000);
await Promise.all([h2.done, j2.done]);
const hr = smoke(h2.out), jr = smoke(j2.out);
const report = {
  network: NET, app: app.replace(process.env.HOME, '~'), build: hs?.about?.build ?? null,
  host: { exit: hc, ok: hs?.ok, seat: hs?.seat, steps: hs?.log?.map((x) => x.step), outcome: hs?.outcome, finalHash: hs?.finalHash, readyClicks: hs?.readyClicks, fingerprint: hs?.about?.peer?.fingerprint },
  joiner: { exit: jc, ok: js?.ok, seat: js?.seat, steps: js?.log?.map((x) => x.step), stages: js?.log?.find((x) => x.step === 'joinedByInvitation')?.stages, outcome: js?.outcome, finalHash: js?.finalHash, readyClicks: js?.readyClicks, fingerprint: js?.about?.peer?.fingerprint },
  reopen: { hostSameIdentity: hr?.about?.peer?.fingerprint === hs?.about?.peer?.fingerprint, joinerSameIdentity: jr?.about?.peer?.fingerprint === js?.about?.peer?.fingerprint, hostRecorded: recorded('cal').map((p) => p.status), joinerRecorded: recorded('friend').map((p) => p.status) },
};
report.sameResult = !!(hs?.finalHash && hs.finalHash === js?.finalHash);
report.ok = !!(hs?.ok && js?.ok && report.sameResult && report.reopen.hostSameIdentity && report.reopen.joinerSameIdentity && report.reopen.hostRecorded.includes('recorded') && report.reopen.joinerRecorded.includes('recorded'));
console.log(JSON.stringify(report, null, 1));
if (!report.ok) { console.error('--- host log tail ---\n' + host.log().slice(-3000) + '\n--- joiner log tail ---\n' + joiner.log().slice(-3000)); }
process.exit(report.ok ? 0 : 1);
