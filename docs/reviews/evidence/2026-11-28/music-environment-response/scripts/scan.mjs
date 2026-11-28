import fs from 'node:fs';
import { open, choose, start, sleep } from './lib.mjs';
const { browser, page } = await open({ w: 1000, hgt: 700 });
await choose(page, null); await start(page); await sleep(2500);
await page.evaluate(() => document.querySelector('.opp-sound').click()); await sleep(3000);
const res = [];
const n = await page.evaluate(() => window.__versus.table.music.queue.entries.length);
for (let i = 0; i < n; i++) {
  await page.evaluate(async (i) => { const m = window.__versus.table.music; m._select(i, 'start'); for (let k = 0; k < 40 && m.status !== 'playing'; k++) await new Promise((r) => setTimeout(r, 250)); }, i);
  await sleep(1000);
  const dur = await page.evaluate(() => window.__versus.table.music.audio.duration);
  for (let t = 15; t < dur - 10; t += 25) {
    await page.evaluate((t) => { window.__versus.table.music.audio.currentTime = t; }, t);
    await sleep(1500);
    const r = await page.evaluate(async () => { const m = window.__versus.table.music, s = m.signal; const c0 = s.frame.onsetCount; let L = 0, H = 0, k = 0; for (let j = 0; j < 30; j++) { await new Promise((r) => setTimeout(r, 100)); L += s._level; H += s._raw.high; k++; } return { onsetsPerS: (s.frame.onsetCount - c0) / 3, level: +(L / k).toFixed(3) }; });
    res.push({ track: i, t, dur: Math.round(dur), ...r });
    console.log(JSON.stringify(res.at(-1)));
  }
}
fs.writeFileSync('scan.json', JSON.stringify(res, null, 1));
await browser.close();
