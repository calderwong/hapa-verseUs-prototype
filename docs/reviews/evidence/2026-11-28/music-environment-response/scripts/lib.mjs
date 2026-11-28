import path from 'node:path';
import { pathToFileURL } from 'node:url';
const pc = path.join(process.env.HOME, 'Documents/Codex/2026-06-29/can/lumina/node_modules/puppeteer-core');
export const puppeteer = (await import(pathToFileURL(path.join(pc, 'lib/puppeteer/puppeteer-core.js')).href)).default;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const URL0 = 'http://127.0.0.1:5199/versus.html?debug=1';
export async function open({ w = 1360, hgt = 900 } = {}) {
  const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--ignore-gpu-blocklist', '--enable-webgl', '--use-angle=metal', '--no-first-run', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: w, height: hgt });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  page.on('console', (m) => { if (m.type() === 'warn' || m.type() === 'error') errors.push(`${m.type()}: ${m.text()}`); });
  await page.goto(URL0, { waitUntil: 'networkidle2' });
  return { browser, page, errors };
}
export const click = (page, sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
export const start = (page) => page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Start match').click());
export async function choose(page, id) {
  if (id) { const on = await page.evaluate((i) => document.querySelector(`.roster-row[data-avatar="${i}"] .roster-ctl input[type=checkbox]`).checked, id); if (!on) await click(page, `.roster-row[data-avatar="${id}"] .roster-ctl input[type=checkbox]`); await sleep(150); await click(page, `.roster-row[data-avatar="${id}"] input[type=radio]`); }
  else await click(page, 'input[name=roster-choice][value=""]');
  await sleep(800);
}
