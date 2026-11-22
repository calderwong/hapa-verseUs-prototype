#!/usr/bin/env node
// npm run replay -- <replay.json>: recompute a recorded match from its manifest, accepted plans and
// choices; report the first diverging Tick or the verified final fingerprint and outcome.
import { readFileSync } from 'node:fs';
import { verifyReplay } from '../../src/hapa/rules/session.js';
import { parseStrict } from '../../src/hapa/rules/encoding.js';

const file = process.argv[2];
if (!file) { console.error('usage: npm run replay -- <replay.json>'); process.exit(2); }
const replay = parseStrict(readFileSync(file, 'utf8'));
const r = verifyReplay(replay);
console.log(JSON.stringify(r, null, 1));
process.exit(r.ok ? 0 : 1);
