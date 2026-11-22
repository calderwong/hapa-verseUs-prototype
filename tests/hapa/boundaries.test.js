// Module boundaries (Master Requirements v3 ch.17): the rules never depend on presentation, art,
// the DOM, the wall clock or Math.random; presentation-only renditions stay out of git.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const RULES = new URL('../../src/hapa/rules/', import.meta.url);

test('the rules import only rules modules and use no DOM, wall clock or Math.random', () => {
  for (const f of readdirSync(RULES).filter((n) => n.endsWith('.js'))) {
    const src = readFileSync(new URL(f, RULES), 'utf8');
    for (const m of src.matchAll(/^import .* from '([^']+)'/gm)) assert.match(m[1], /^\.\/[\w-]+\.js$/, `${f} imports ${m[1]}`);
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''); // prose may name what the code avoids
    const bad = /Math\.random|Date\.now|new Date\(|performance\.now|document\.|window\./.exec(code);
    assert.equal(bad, null, `${f} uses ${bad?.[0]}`);
  }
});

test('local card renditions are ignored by git and never part of the content catalog', () => {
  const out = execFileSync('git', ['check-ignore', 'public/renditions/index.json'], { cwd: new URL('../../', import.meta.url) }).toString().trim();
  assert.equal(out, 'public/renditions/index.json');
  const content = readFileSync(new URL('../../fixtures/hapa/content.js', import.meta.url), 'utf8');
  assert.doesNotMatch(content, /renditions/);
});
