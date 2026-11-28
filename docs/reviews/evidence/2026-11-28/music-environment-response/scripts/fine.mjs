import { open, choose, start, sleep } from './lib.mjs';
const [track, from, to] = process.argv.slice(2).map(Number);
const { browser, page } = await open({ w: 1000, hgt: 700 });
await choose(page, null); await start(page); await sleep(2500);
await page.evaluate(() => document.querySelector('.opp-sound').click()); await sleep(2500);
await page.evaluate(async ([i, t]) => { const m = window.__versus.table.music; m._select(i, 'start'); for (let k = 0; k < 40 && m.status !== 'playing'; k++) await new Promise((r) => setTimeout(r, 250)); m.audio.currentTime = t; }, [track, from]);
let row = '';
for (;;) { const r = await page.evaluate(async () => { const s = window.__versus.table.music.signal; const c0 = s.frame.onsetCount; let L = 0; for (let j = 0; j < 10; j++) { await new Promise((r) => setTimeout(r, 100)); L += s._level; } return { t: Math.round(s.frame.sourceTimeSeconds), n: s.frame.onsetCount - c0, L: (L / 10).toFixed(2), e: s.frame.energy01.toFixed(2) }; }); row += `${r.t}:${r.n}/${r.L}/${r.e} `; if (r.t >= to) break; }
console.log(row);
await browser.close();
