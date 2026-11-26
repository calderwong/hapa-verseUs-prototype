#!/usr/bin/env node
/**
 * The exact engine runtime this game needs (Assignment 16 finding 1): the transitive import closure
 * of `vendor/lumina` modules reachable from the game's entry points, with sizes and SHA-256, plus
 * the engine revision and licence. It is the file list an engine owner approves for a public,
 * revision-pinned source-build snapshot. It reads the vendored engine; it copies or publishes nothing.
 *
 *   node tools/hapa/engine-closure.mjs [--out docs/integrations/engine-runtime-manifest.json]
 */
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..', '..');
const ENGINE = join(ROOT, 'vendor', 'lumina');
const entries = ['src/versus.js', 'src/main.js'].map((f) => join(ROOT, f)).filter(existsSync);
const seen = new Set();
const engineFiles = new Set();
const IMPORT = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function resolveSpec(from, spec) {
  if (!spec.startsWith('.') && !spec.startsWith('/')) return null; // packages (three, fonts) are listed separately
  const base = resolve(dirname(from), spec);
  for (const c of [base, `${base}.js`, join(base, 'index.js')]) if (existsSync(c) && statSync(c).isFile()) return c;
  return null;
}

function walk(file) {
  if (seen.has(file)) return;
  seen.add(file);
  if (file.startsWith(ENGINE + '/')) engineFiles.add(file);
  if (!/\.(m?js)$/.test(file)) return;
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(IMPORT)) {
    const spec = m[1] ?? m[2] ?? m[3];
    const r = resolveSpec(file, spec);
    if (r) walk(r);
  }
}
for (const e of entries) walk(e);

const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');
const files = [...engineFiles].sort().map((f) => ({ path: relative(ENGINE, f), bytes: statSync(f).size, sha256: sha(f) }));
const licence = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'].map((f) => join(ENGINE, f)).find(existsSync);
const revision = (() => { try { return execFileSync('git', ['-C', ENGINE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return null; } })();
const manifest = {
  schema: 'hapa-versus-engine-runtime/v1',
  engine: { name: 'Luminati (Hapa fork)', repository: 'calderwong/lumina-hapa (private)', branch: 'hapa', revision, licence: licence ? { file: relative(ENGINE, licence), sha256: sha(licence), spdx: 'MIT' } : null },
  entries: entries.map((e) => relative(ROOT, e)),
  closure: { files: files.length, bytes: files.reduce((a, f) => a + f.bytes, 0) },
  files,
  notes: [
    'This is the transitive import closure of engine modules reachable from the game entry points (static and literal dynamic imports).',
    'The packaged desktop app already contains this code compiled into dist/ by the Vite build; installed players never need the private repository.',
    'A public source-build input would be a revision-pinned archive of exactly these files plus the licence, approved by the engine owner. Nothing here publishes it.',
  ],
};
const out = process.argv.includes('--out') ? resolve(process.argv[process.argv.indexOf('--out') + 1]) : null;
if (out) writeFileSync(out, JSON.stringify(manifest, null, 1) + '\n');
console.log(JSON.stringify({ revision, files: manifest.closure.files, bytes: manifest.closure.bytes, licence: manifest.engine.licence?.file ?? null, out: out ? relative(ROOT, out) : null }));
