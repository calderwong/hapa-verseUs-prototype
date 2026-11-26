import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { HARBOR_PATHS, readToken } from './src/hapa/host/owner-routes.js';

const ROOT = import.meta.dirname;
const PORT = 5199;

// --- Owner host clients (docs/integrations/IMPLEMENTATION_CHECKPOINT.md) --------------------------
// The route table is shared with the packaged desktop host (src/hapa/host/owner-routes.js); the
// defaults below are the contributor's development owners, configurable by environment.
// This dev server is the local host backend for two owners. It forwards their routes and adds each
// owner's bearer token server-side, read from the token file the owner writes, so no token reaches
// page code. Both owners listen on loopback only; an owner that is not running simply leaves its
// feature unavailable (the game stays playable).
//
//  - Harbor Storefront: Red's renderer package, puppet modules and voiced utterances (Avatar →
//    Builder Voice Card → OmniVoice). Same pattern as the Prawn Shop's host.
//  - Hapa Song Registry (the installed Music Library owner), one node per library: `cj` (the human
//    seat's library) and `red` (Red's own library). Only its bearer peer routes are forwarded.
const HARBOR = process.env.HAPA_HARBOR_URL ?? 'http://127.0.0.1:8862';
const HARBOR_ROOT = process.env.HAPA_HARBOR_ROOT ?? resolve(homedir(), 'Documents/Codex/2026-06-29/can/work/hapa-harbor-storefront');
// Hapa Harness (participant-game view, Milestone C): its bearer token is read from its state root.
const HARNESS = process.env.HAPA_HARNESS_URL ?? 'http://127.0.0.1:61290';
const HARNESS_STATE = process.env.HAPA_HARNESS_VERSUS_STATE ?? resolve(homedir(), '.hapa-harness-versus');
const LIBRARIES = {
  cj: { url: process.env.HAPA_MUSIC_CJ_URL ?? 'http://127.0.0.1:8811', tokenFile: process.env.HAPA_MUSIC_CJ_TOKEN ?? resolve(homedir(), 'Desktop/hapa-song-registry/data/api-token') },
  red: { url: process.env.HAPA_MUSIC_RED_URL ?? 'http://127.0.0.1:8801', tokenFile: process.env.HAPA_MUSIC_RED_TOKEN ?? resolve(homedir(), '.hapa-music-libraries/red-reaper/api-token') },
};

/** Only this page may use a forwarded token: refuse requests another site's page started. */
function crossSite(req) {
  const site = req.headers['sec-fetch-site'];
  if (site && site !== 'same-origin' && site !== 'none') return true;
  const origin = req.headers.origin;
  return !!origin && ![PORT, PORT + 1].some((p) => origin === `http://127.0.0.1:${p}` || origin === `http://localhost:${p}`);
}

function forwarding(target, token, rewrite) {
  return {
    target,
    changeOrigin: true,
    bypass: (req) => (crossSite(req) ? false : undefined),
    rewrite,
    configure(proxy) {
      proxy.on('proxyReq', (proxyReq) => {
        for (const h of ['origin', 'referer', 'cookie', 'sec-fetch-site', 'sec-fetch-mode', 'sec-fetch-dest']) proxyReq.removeHeader(h);
        const t = token();
        if (t) proxyReq.setHeader('authorization', `Bearer ${t}`);
      });
    },
  };
}

function ownerProxies() {
  // Harbor takes no query strings; Vite's client adds `?import` to dynamic module imports
  const harbor = forwarding(HARBOR, () => readToken(resolve(HARBOR_ROOT, 'data/api-token')), (path) => path.replace(/\?.*$/, ''));
  const out = Object.fromEntries(HARBOR_PATHS.map((p) => [`^${p}(/|$)`, harbor]));
  // only the three participant-game operations are forwarded, never the rest of the Harness API
  out['^/harness/game-(decision|decision-cancel|status)$'] = forwarding(HARNESS, () => readToken(resolve(HARNESS_STATE, 'operator.token')), (path) => path.replace(/^\/harness\//, '/v1/harness/'));
  for (const [name, lib] of Object.entries(LIBRARIES)) {
    out[`^/music/${name}/`] = forwarding(lib.url, () => readToken(lib.tokenFile), (path) => path.replace(new RegExp(`^/music/${name}/`), '/api/peer/'));
  }
  return out;
}

// The Versus page imports Luminati's engine straight from the vendored Hapa fork. The dev server
// binds 127.0.0.1 only.
export default defineConfig({
  root: ROOT,
  server: { host: '127.0.0.1', port: PORT, strictPort: true, open: false, fs: { allow: [ROOT] }, proxy: ownerProxies() },
  preview: { host: '127.0.0.1', port: 5200, strictPort: true, proxy: ownerProxies() },
  build: {
    outDir: 'dist',
    target: 'es2022',
    chunkSizeWarningLimit: 2500,
    rollupOptions: { input: { index: resolve(ROOT, 'index.html'), versus: resolve(ROOT, 'versus.html') } },
  },
});
