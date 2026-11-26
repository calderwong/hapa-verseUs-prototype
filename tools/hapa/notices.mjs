#!/usr/bin/env node
/**
 * Build the desktop app's self-contained third-party notices (review 16, R16-08):
 * desktop/THIRD_PARTY_NOTICES.txt — the game notice, the compiled Luminati engine (revision + MIT
 * licence text), and the licence of every package whose code is in the app: production node_modules
 * shipped in the ASAR, plus the build-time packages compiled into dist/ (three.js and the fonts).
 * Run by the Forge generateAssets hook; also runnable on its own. Output is a generated file.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..', '..');
const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8'));
const licenceText = (dir) => {
  if (!existsSync(dir)) return null;
  const f = readdirSync(dir).find((n) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(n));
  return f ? readFileSync(join(dir, f), 'utf8').trim() : null;
};
const sections = [];
const add = (title, licence, text) => sections.push(`${'='.repeat(78)}\n${title}\nLicence: ${licence}\n${'-'.repeat(78)}\n${text ?? '(no licence file is distributed with this package; see its declared licence above)'}\n`);

// the game itself
sections.push(`Hapa Versus — third-party notices\nGenerated ${new Date().toISOString().slice(0, 10)} for the packaged desktop app.\n\n${readFileSync(join(ROOT, 'NOTICE.md'), 'utf8').replace(/`vendor\/lumina`[^.]*\./, 'The compiled Luminati engine below is included in this app.').trim()}\n`);
// the engine compiled into dist/
let engineRev = null;
try { engineRev = execFileSync('git', ['-C', join(ROOT, 'vendor', 'lumina'), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* not a checkout */ }
add(`Luminati game engine (Hapa fork, revision ${engineRev ?? 'unknown'}) — compiled into dist/`, 'MIT', licenceText(join(ROOT, 'vendor', 'lumina')));
// packages compiled into dist/ at build time
const compiled = Object.keys(JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).devDependencies).filter((n) => n === 'three' || n.startsWith('@fontsource/'));
// production packages shipped in the ASAR
const shipped = Object.entries(lock.packages).filter(([p, v]) => p.startsWith('node_modules/') && !v.dev && !v.devOptional && !v.optional).map(([p]) => p.slice('node_modules/'.length));
const seen = new Set();
for (const [name, where] of [...compiled.map((n) => [n, 'compiled into dist/']), ...shipped.map((n) => [n, 'in the app archive'])]) {
  if (seen.has(name)) continue;
  seen.add(name);
  const dir = join(ROOT, 'node_modules', name);
  if (!existsSync(join(dir, 'package.json'))) continue;
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  add(`${pkg.name}@${pkg.version} — ${where}`, pkg.license ?? 'see package', licenceText(dir));
}
const out = join(ROOT, 'desktop', 'THIRD_PARTY_NOTICES.txt');
writeFileSync(out, sections.join('\n'));
console.log(JSON.stringify({ out: 'desktop/THIRD_PARTY_NOTICES.txt', packages: seen.size, engine: engineRev }));
