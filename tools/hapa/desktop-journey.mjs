#!/usr/bin/env node
/**
 * Packaged desktop journey (Assignment 16 journeys 1, 3 and 4 on one machine; attachment evidence,
 * NOT the different-network journey 2):
 *
 *   node tools/hapa/desktop-journey.mjs [--app <path to .app>] --work <abs scratch dir>
 *
 *  1. a headless archive (`lobby:serve`) and a headless declared-bot opponent join an isolated test
 *     network on the public DHT;
 *  2. the actual packaged app (minimal environment: no Node/npm on PATH, no Vite, no owners) joins
 *     the lobby and challenges by real DOM clicks, plays Ticks with Ready, reloads its renderer
 *     mid-match, then quits with the match in progress;
 *  3. a second launch on the same data root while the app runs must exit without becoming a writer;
 *  4. the app relaunches into the same match; its peer utility process is killed mid-match and main
 *     restarts it; the view reattaches and the match finishes; each Tick's view replay must equal the
 *     runtime's agreed receipt;
 *  5. both authors stop; a fresh observer retrieves and verifies the result from the archive.
 */
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const app = resolve(arg('app', 'out/Hapa Versus-darwin-arm64/Hapa Versus.app'));
const exe = join(app, 'Contents', 'MacOS', 'Hapa Versus');
const work = arg('work');
if (!work) { console.error('--work <absolute scratch directory> is required'); process.exit(2); }
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
const NET = `test-desk-${Date.now().toString(36)}`;
const node = process.execPath;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = { network: NET, app: app.replace(process.env.HOME, '~'), steps: [] };
const step = (name, data) => { report.steps.push({ name, ...data }); process.stderr.write(`· ${name} ${JSON.stringify(data).slice(0, 200)}\n`); };

function headless(script, args, log) {
  const p = spawn(node, [script, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { out += d; });
  p.log = () => out;
  return p;
}

function launch(name, env, { timeout = 600_000 } = {}) {
  const out = join(work, name);
  mkdirSync(out, { recursive: true });
  const e = { HOME: process.env.HOME, PATH: '/usr/bin:/bin', TMPDIR: process.env.TMPDIR ?? '/tmp', HAPA_VERSUS_DATA_DIR: join(work, 'desk-data'), HAPA_VERSUS_NETWORK: NET, HAPA_VERSUS_SMOKE_OUT: out, HAPA_VERSUS_START: 'versus.html?debug=1', ...env };
  const p = spawn(exe, [], { env: e, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  p.stdout.on('data', (d) => { log += d; });
  p.stderr.on('data', (d) => { log += d; });
  const done = new Promise((res) => { const t = setTimeout(() => p.kill('SIGKILL'), timeout); p.on('exit', (code) => { clearTimeout(t); res(code); }); });
  return { p, done, out, log: () => log };
}
const smoke = (dir) => { try { return JSON.parse(readFileSync(join(dir, 'smoke.json'), 'utf8')); } catch { return null; } };

const archive = headless('tools/hapa/lobby-serve.mjs', ['--data', join(work, 'archive'), '--network', NET]);
await sleep(2000);
const opp = headless('tools/hapa/online.mjs', ['--data', join(work, 'opponent'), '--name', 'Bram', '--network', NET, '--bot', '--auto-accept', '--quiet']);
await sleep(1500);

// 2. first launch: lobby, challenge, Ticks with a renderer reload, quit mid-match
const L1 = launch('launch-1', { HAPA_VERSUS_SMOKE_SCRIPT: 'online', HAPA_VERSUS_SMOKE_NAME: 'Cal', HAPA_VERSUS_SMOKE_OPPONENT: 'Bram', HAPA_VERSUS_SMOKE_TICKS: '5', HAPA_VERSUS_SMOKE_RELOAD_AT: '3' });
const s1code = await L1.done;
const s1 = smoke(L1.out);
step('launch-1', { exit: s1code, seat: s1?.seat, opponent: s1?.opponent, readyClicks: s1?.readyClicks, reloaded: s1?.reloaded, readyAckMs: s1?.readyAckMs, log: s1?.log?.map((x) => x.step), quitMidMatch: !s1?.outcome });

// 3 + 4. relaunch into the same match; meanwhile a second launch must not become a writer
const L2 = launch('launch-2', { HAPA_VERSUS_SMOKE_SCRIPT: 'online', HAPA_VERSUS_SMOKE_CONCEDE_AFTER: '20' });
await sleep(6000);
const L2b = launch('launch-2-second-instance', { HAPA_VERSUS_SMOKE_SCRIPT: 'local' }, { timeout: 30_000 });
const t2b = Date.now();
const s2bcode = await L2b.done;
step('second-instance', { exit: s2bcode, seconds: (Date.now() - t2b) / 1000, wroteSmoke: !!smoke(L2b.out) });
await sleep(8000);
// the peer utility process is a child of the app's main process
let killed = null;
try {
  const kids = execFileSync('pgrep', ['-P', String(L2.p.pid)], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  for (const pid of kids) { const cmd = execFileSync('ps', ['-o', 'command=', '-p', pid], { encoding: 'utf8' }); if (/utility-sub-type=node\.mojom\.NodeService/.test(cmd)) { process.kill(Number(pid), 'SIGKILL'); killed = Number(pid); break; } }
} catch (e) { step('kill-utility-error', { error: e.message }); }
step('kill-peer-utility', { killed: !!killed });
const s2code = await L2.done;
const s2 = smoke(L2.out);
step('launch-2', { exit: s2code, ok: s2?.ok, outcome: s2?.outcome, ticksAgreed: s2?.ticksAgreed, viewMatchesAgreed: s2?.viewMatchesAgreed, readyClicks: s2?.readyClicks, choices: s2?.choicesAnswered, feeds: s2?.feeds, log: s2?.log?.map((x) => x.step), runtimeRestartSeen: /runtime open .* launch/.test(L2.log()) && (L2.log().match(/runtime open/g) ?? []).length });

// the opponent's view of the same match
await sleep(4000);
const oppResult = (opp.log().match(/\{"RESULT":.*\}/) ?? [null])[0];
step('opponent', { result: oppResult ? JSON.parse(oppResult).RESULT : null, sameFinalHash: oppResult ? JSON.parse(oppResult).RESULT.finalHash === s2?.finalHash : false, archived: /ARCHIVED/.test(opp.log()) });
opp.kill('SIGTERM');
await sleep(2000);

// 5. both authors offline; a fresh *installed* observer reads the archive through the ordinary UI,
// with the archive configured by identity and transport key (R16-03)
const serving = JSON.parse((archive.log().match(/\{"at":[^\n]*"serving":\{[^\n]*\}\}/) ?? ['null'])[0])?.serving;
const obsDir = join(work, 'observer-desk');
mkdirSync(obsDir, { recursive: true });
if (serving) writeFileSync(join(obsDir, 'network.json'), JSON.stringify({ networks: { [NET]: { archives: [{ player: serving.player, transport: serving.transport, label: 'Hapa Archive' }] } } }));
const LO = launch('observer', { HAPA_VERSUS_DATA_DIR: obsDir, HAPA_VERSUS_SMOKE_SCRIPT: 'observe', HAPA_VERSUS_SMOKE_NAME: 'Olu' }, { timeout: 300_000 });
await LO.done;
const so = smoke(LO.out);
step('installed-observer', { ok: so?.ok, archive: so?.archive, records: so?.records, profiles: so?.profiles?.map((p) => p.split('\n').slice(0, 8).join(' | ')) });
archive.kill('SIGTERM');

const ident = (s) => s?.about?.peer?.fingerprint;
report.sameIdentityAcrossLaunches = !!(ident(s1) && ident(s1) === ident(s2));
report.ok = !!(s1 && report.sameIdentityAcrossLaunches && s2?.ok && s2.viewMatchesAgreed && s2bcode === 0 && !smoke(L2b.out) && so?.ok);
report.about = s2?.about;
console.log(JSON.stringify(report, null, 1));
process.exit(report.ok ? 0 : 1);
