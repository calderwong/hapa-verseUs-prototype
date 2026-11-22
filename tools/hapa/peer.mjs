#!/usr/bin/env node
// One peer process (spawned by tools/hapa/peers.mjs). Reads {manifest, identity, opponent, remoteKey,
// port, listen} from stdin lines; prints KEY, then per-Tick receipts, then RESULT as JSON.
import net from 'node:net';
import { createInterface } from 'node:readline';
import { Peer } from '../../src/hapa/protocol/peer.js';
import { HeuristicBot } from '../../src/hapa/controllers/heuristic-bot.js';

const rl = createInterface({ input: process.stdin });
const lines = rl[Symbol.asyncIterator]();
const next = async () => JSON.parse((await lines.next()).value);
const setup = await next();
const peer = new Peer({ ...setup, controller: new HeuristicBot({ seat: setup.seat, seed: setup.botSeed }), log: (s) => process.stdout.write(`LOG ${s}\n`) });
const key = await peer.open();
process.stdout.write(`KEY ${key}\n`);
const { remoteKey, port, listen } = await next();
await peer.attachRemote(remoteKey);
const socket = await new Promise((resolve) => {
  if (listen) { const srv = net.createServer((s) => { srv.close(); resolve(s); }); srv.listen(port, '127.0.0.1', () => process.stdout.write('LISTENING\n')); }
  else { const s = net.connect(port, '127.0.0.1', () => resolve(s)); }
});
const stream = peer.replicate(!!listen);
stream.pipe(socket).pipe(stream);
const outcome = await peer.play({ tickBudget: setup.tickBudget ?? 120 });
process.stdout.write(`RESULT ${JSON.stringify({ seat: setup.seat, outcome, ticks: peer.receipts.length, allAgreed: peer.receipts.every((r) => r.agreed), finalHash: peer.receipts.at(-1)?.hash, errors: peer.errors })}\n`);
await peer.close();
socket.destroy();
process.exit(0);
