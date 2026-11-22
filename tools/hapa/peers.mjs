#!/usr/bin/env node
/**
 * npm run peers -- [--seed n] [--ticks budget] [--port p]
 *
 * A peer-verified match: two separate OS processes, each with its own development identity,
 * storage directory (.data/peers/<seat>) and Hypercore log, replicate over a 127.0.0.1 socket,
 * agree public plans, resolve every Tick independently and compare signed state receipts.
 * The coordinator only launches the processes and compares their reports; it decides nothing.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { createDevIdentity, publicIdentity } from '../../src/hapa/protocol/messages.js';
import { createManifest } from '../../src/hapa/rules/state.js';
import { profileById, BASE_PROFILE } from '../../fixtures/hapa/profiles.js';
import { CATALOG } from '../../fixtures/hapa/content.js';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const seed = Number(arg('seed', 2)), ticks = Number(arg('ticks', 120)), port = Number(arg('port', 47811));
const root = '.data/peers';
rmSync(root, { recursive: true, force: true });
const ids = { A: createDevIdentity('peer-a'), B: createDevIdentity('peer-b') };
const manifest = createManifest({ matchId: `peers-${seed}-${Date.now().toString(36)}`, profile: profileById(BASE_PROFILE.id), catalog: CATALOG, seed,
  participants: { A: publicIdentity(ids.A), B: publicIdentity(ids.B) },
  controllers: { A: { type: 'bot', revision: 'heuristic-bot/0.1.0' }, B: { type: 'bot', revision: 'heuristic-bot/0.1.0' } } });
const procs = {}, keys = {}, results = {};
const ready = [];
for (const seat of ['A', 'B']) {
  mkdirSync(`${root}/${seat}`, { recursive: true });
  writeFileSync(`${root}/${seat}/identity.json`, JSON.stringify(ids[seat], null, 1)); // development keys, ignored by git
  const p = spawn(process.execPath, ['tools/hapa/peer.mjs'], { stdio: ['pipe', 'pipe', 'inherit'] });
  procs[seat] = p;
  const rl = createInterface({ input: p.stdout });
  ready.push(new Promise((resolve) => rl.on('line', (line) => {
    if (line.startsWith('KEY ')) { keys[seat] = line.slice(4); resolve(); }
    else if (line.startsWith('RESULT ')) results[seat] = JSON.parse(line.slice(7));
    else if (line.startsWith('LOG ') && process.argv.includes('--verbose')) console.log(line.slice(4));
  })));
  p.stdin.write(JSON.stringify({ seat, identity: ids[seat], opponent: publicIdentity(ids[seat === 'A' ? 'B' : 'A']), storage: `${root}/${seat}`, manifest, botSeed: seed * 2 + (seat === 'A' ? 1 : 2), tickBudget: ticks }) + '\n');
}
await Promise.all(ready);
procs.A.stdin.write(JSON.stringify({ remoteKey: keys.B, port, listen: true }) + '\n');
await new Promise((r) => setTimeout(r, 300));
procs.B.stdin.write(JSON.stringify({ remoteKey: keys.A, port, listen: false }) + '\n');
await Promise.all(Object.values(procs).map((p) => new Promise((r) => p.on('exit', r))));
const same = results.A && results.B && JSON.stringify(results.A.outcome) === JSON.stringify(results.B.outcome) && results.A.finalHash === results.B.finalHash;
console.log(JSON.stringify({ logs: { A: keys.A.slice(0, 16), B: keys.B.slice(0, 16) }, A: results.A, B: results.B, peersAgree: !!same }, null, 1));
process.exit(same ? 0 : 1);
