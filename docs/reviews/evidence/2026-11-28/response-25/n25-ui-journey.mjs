// N25-02/N25-03 UI journey on the Vite dev page (headless Chrome, unthrottled). Usage: node journey.mjs <out dir>
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const [out] = process.argv.slice(2);
const pc = path.join(process.env.HOME, 'Documents/Codex/2026-06-29/can/lumina/node_modules/puppeteer-core');
const puppeteer = (await import(pathToFileURL(path.join(pc, 'lib/puppeteer/puppeteer-core.js')).href)).default;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--ignore-gpu-blocklist', '--enable-webgl', '--use-angle=metal', '--no-first-run', '--mute-audio'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = { url: 'http://127.0.0.1:5199/versus.html?debug=1', at: new Date().toISOString(), steps: [] };
const ctx = await browser.createBrowserContext();
const page = await ctx.newPage();
await page.setViewport({ width: 1360, height: 900 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
// hold Falka's rig request when asked, so her frame stays loading (the V23-01 path)
let holdFalka = false; const held = [];
await page.setRequestInterception(true);
page.on('request', (r) => { if (holdFalka && /\/mesh\/apps\/player\/falka\/rig\.json/.test(r.url())) held.push(r); else r.continue(); });
await page.goto(report.url, { waitUntil: 'networkidle2' });

const setup = () => page.evaluate(() => {
  const radios = [...document.querySelectorAll('input[name=roster-choice]')].map((x) => ({ value: x.value || null, name: x.getAttribute('aria-label'), checked: x.checked, disabled: x.disabled }));
  const boxes = [...document.querySelectorAll('.roster-ctl input[type=checkbox]')].map((x) => ({ name: x.getAttribute('aria-label'), checked: x.checked, disabled: x.disabled }));
  const music = [...document.querySelectorAll('.table-setup .small')].find((d) => d.textContent.startsWith('Your tracks'))?.textContent;
  return { radios, boxes, music, owner: document.querySelector('.owner-note')?.textContent, summaries: [...document.querySelectorAll('.roster-details summary')].map((s) => s.getAttribute('aria-label')) };
});
// accessible names from Chrome's own accessibility tree (not just our attributes)
const axNames = async () => { const snap = await page.accessibility.snapshot({ interestingOnly: true }); const acc = []; const walk = (n) => { if (['radio', 'checkbox'].includes(n.role)) acc.push(`${n.role}: ${n.name}`); (n.children || []).forEach(walk); }; walk(snap); return acc; };
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const choose = async (id) => {
  if (id) { const on = await page.evaluate((i) => document.querySelector(`.roster-row[data-avatar="${i}"] .roster-ctl input[type=checkbox]`).checked, id); if (!on) await click(`.roster-row[data-avatar="${id}"] .roster-ctl input[type=checkbox]`); await sleep(150); await click(`.roster-row[data-avatar="${id}"] input[type=radio]`); }
  else await click('input[name=roster-choice][value=""]');
  await sleep(1200);
};
const start = () => page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Start match').click());
const bound = () => page.evaluate(async () => { const v = window.__versus; for (let i = 0; i < 120; i++) { await new Promise((r) => setTimeout(r, 250)); const op = v.table?.opponent; if (!op || op.player || op.binding?.status === 'text-only') break; } const op = v.table?.opponent; return { status: op?.binding?.status ?? null, owner: op?.binding?.renderer?.owner ?? null, nameplate: document.querySelector('.opp-label')?.textContent ?? null, frames: document.querySelectorAll('iframe.red-frame').length, music: v.table?.music?.queue?.entries?.map((e) => e.fromLibrary) ?? null, tick: v.state.tick }; });
const whoIsPlaying = () => page.evaluate(async () => { const n = document.querySelector('.opp-name'); if (n.getAttribute('aria-expanded') !== 'true') n.click(); await new Promise((r) => setTimeout(r, 200)); const d = document.querySelector('.opp-binding'); d.open = true; await new Promise((r) => setTimeout(r, 100)); return document.querySelector('.opp-details').textContent; });
const backToSetup = async () => { await page.goto(report.url, { waitUntil: 'networkidle2' }); };

report.steps.push({ step: 'clean setup', ...(await setup()), accessibilityTree: await axNames() });
await choose(null);
report.steps.push({ step: 'No figure chosen', music: (await setup()).music, owner: (await setup()).owner });
await start(); report.steps.push({ step: 'No figure started', ...(await bound()) });
for (const id of ['avatar-8', 'avatar-46', 'avatar-39', 'red-reaper']) {
  await backToSetup(); await choose(id);
  const s = await setup();
  await start(); const b = await bound();
  report.steps.push({ step: `${id} chosen and started`, setupMusic: s.music, setupOwner: s.owner, ...b, whoIsPlaying: await whoIsPlaying() });
  await page.screenshot({ path: path.join(out, `private-${id}.jpg`), type: 'jpeg', quality: 70 });
}

// V23-01 through the page: Falka's frame held mid-load, then the match is replaced by Leo's
await backToSetup();
await choose('avatar-46'); await choose('avatar-8');
holdFalka = true;
await start();
await sleep(1500);
const during = await page.evaluate(() => { const op = window.__versus.table.opponent; return { avatar: op.avatarId, status: op.binding.status, player: !!op.player, frames: document.querySelectorAll('iframe.red-frame').length, frameSrc: [...document.querySelectorAll('iframe.red-frame')].map((f) => new URL(f.src).search) }; });
const replaced = await page.evaluate(async () => {
  const v = window.__versus, old = v.table.opponent;
  const oldAttach = old._attaching; let settledAt = null; const t0 = performance.now();
  oldAttach?.then((x) => { settledAt = { value: x, ms: Math.round(performance.now() - t0) }; });
  // a replacement match with Leo (the same startMatch the Start/New match controls call)
  v.startMatch({ table: { ...v._tableChoice, avatarId: 'avatar-46' } });
  const framesRightAfter = document.querySelectorAll('iframe.red-frame').length;
  await new Promise((r) => setTimeout(r, 50));
  const oldSettled = settledAt;
  for (let i = 0; i < 120; i++) { await new Promise((r) => setTimeout(r, 250)); if (v.table.opponent.player) break; }
  const leo = v.table.opponent;
  return { framesRightAfter, oldDisposed: old.disposed, oldSettledWithin50ms: oldSettled, newAvatar: leo.avatarId, newStatus: leo.binding.status, newBound: !!leo.player, framesAfterBind: document.querySelectorAll('iframe.red-frame').length, frameSrc: [...document.querySelectorAll('iframe.red-frame')].map((f) => new URL(f.src).search) };
});
// release Falka's held request: her old frame is gone, so nothing may change
holdFalka = false; for (const r of held.splice(0)) r.continue().catch(() => {});
await sleep(2500);
const after = await page.evaluate(() => { const op = window.__versus.table.opponent; return { avatar: op.avatarId, bound: !!op.player, playerDisposed: op.player?.disposed ?? null, frames: document.querySelectorAll('iframe.red-frame').length, tick: window.__versus.state.tick }; });
const ready = await page.evaluate(async () => { const v = window.__versus, t0 = v.state.tick; [...document.querySelectorAll('button')].find((b) => /^READY/i.test(b.textContent.trim()))?.click(); for (let i = 0; i < 60 && v.state.tick === t0; i++) await new Promise((r) => setTimeout(r, 500)); return { from: t0, to: v.state.tick, stillBound: !!v.table.opponent.player }; });
report.steps.push({ step: 'V23-01: Falka held mid-load, replaced by Leo, held request released', heldRequests: 1, during, replaced, afterRelease: after, ready });
report.pageErrors = errors;
await ctx.close(); await browser.close();
fs.writeFileSync(path.join(out, 'n25-ui-journey.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
