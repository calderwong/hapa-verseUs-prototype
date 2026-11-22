#!/usr/bin/env node
// npm run check: headless rules tests, a bot-versus-bot smoke match, then a production build.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';

const run = (label, cmd, args) => {
  const t = Date.now();
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  const ok = r.status === 0;
  console.log(`${ok ? '✔' : '✖'} ${label} (${Date.now() - t} ms)`);
  return ok;
};
const tests = readdirSync('tests/hapa').filter((f) => f.endsWith('.test.js')).map((f) => `tests/hapa/${f}`);
const steps = [['rules tests', process.execPath, ['--test', ...tests]]];
if (existsSync('tools/hapa/match.mjs')) steps.push(['bot-versus-bot smoke match', process.execPath, ['tools/hapa/match.mjs', '--quiet', '--seed', '2', '--ticks', '80']]);
if (existsSync('versus.html')) steps.push(['build', 'npx', ['vite', 'build', '--logLevel', 'warn']]);
let ok = true;
for (const [label, cmd, args] of steps) ok = run(label, cmd, args) && ok;
process.exit(ok ? 0 : 1);
