/**
 * The optional owner routes the game page uses, shared by both hosts (electron-desktop-v1 §5):
 * the Vite dev/preview server (http-proxy) and the packaged desktop app (its `app://versus/`
 * protocol handler). One table, so the two hosts cannot drift into different authority.
 *
 * Node-only host code. Each owner listens on loopback; its bearer token is read server-side from
 * the token file the owner writes and is never handed to page code. An owner that is not
 * configured or not running leaves its feature unavailable; the game stays playable.
 */
import { readFileSync } from 'node:fs';

/** Harbor (Red's renderer package, puppet modules and voiced utterances). Harbor takes no query strings. */
export const HARBOR_PATHS = ['/v1', '/capabilities', '/app', '/skill', '/projects', '/assets', '/puppet', '/core', '/tools/preview'];
/** Only the three participant-game operations of the Harness, never the rest of its API. */
export const HARNESS_ROUTE = /^\/harness\/game-(decision|decision-cancel|status)$/;
/** Music libraries by name: the human seat's (`cj`) and Red's (`red`); only their peer routes. */
export const MUSIC_LIBRARIES = ['cj', 'red'];

/**
 * Match a page path to an owner route.
 * @param {string} pathname
 * @returns {{ owner: 'harbor'|'harness'|'music', library?: string, path: string } | null} the owner and the path to request there
 */
export function matchOwnerRoute(pathname) {
  if (HARBOR_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return { owner: 'harbor', path: pathname };
  if (HARNESS_ROUTE.test(pathname)) return { owner: 'harness', path: pathname.replace(/^\/harness\//, '/v1/harness/') };
  for (const name of MUSIC_LIBRARIES) {
    const pre = `/music/${name}/`;
    if (pathname.startsWith(pre)) return { owner: 'music', library: name, path: `/api/peer/${pathname.slice(pre.length)}` };
  }
  return null;
}

export const readToken = (file) => { if (!file) return null; try { return readFileSync(file, 'utf8').trim() || null; } catch { return null; } };

/** Only loopback owner URLs are accepted: a host adapter is not a general proxy. */
export function loopbackUrl(u) {
  try {
    const url = new URL(u);
    return (url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) ? url.origin : null;
  } catch { return null; }
}

/**
 * Resolve an owner's endpoint from a configuration object of the shape
 * `{ harbor: { url, tokenFile }, harness: { url, tokenFile }, music: { cj: { url, tokenFile }, red: {...} } }`.
 * @returns {{ url: string, token: string | null } | null}
 */
export function ownerEndpoint(config, route) {
  const entry = route.owner === 'music' ? config?.music?.[route.library] : config?.[route.owner];
  const origin = entry && loopbackUrl(entry.url);
  if (!origin) return null;
  return { url: origin, token: readToken(entry.tokenFile) };
}
