/**
 * Electron Forge configuration for the Hapa Versus desktop app (electron-desktop-v1 §6).
 *
 * The app is assembled from an allowlist, never a recursive copy of the workspace: the built game
 * (`dist/`, without the ignored `renditions/` media), the desktop host, the Node-only peer runtime
 * and its rules/fixtures, and production node_modules with only this platform's native prebuilds.
 * The existing Vite build runs in a hook; there is no second bundler.
 *
 * Signing/notarization run only when their credentials are present in the build environment
 * (APPLE_SIGN_IDENTITY; APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID, or an
 * APPLE_API_KEY profile). Nothing about them is committed or baked into the app.
 */
const { execFileSync } = require('node:child_process');
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

const ROOT = __dirname;

// Top-level paths the packaged app may contain (everything else is ignored).
const ALLOW = [
  /^\/package\.json$/,
  /^\/dist(\/|$)/,
  /^\/desktop(\/|$)/,
  /^\/src(\/hapa(\/(network|host|protocol|rules|controllers)(\/.*)?)?)?$/,
  /^\/fixtures(\/hapa(\/.*)?)?$/,
  /^\/node_modules(\/|$)/,
];
const DENY = [
  /^\/dist\/renditions(\/|$)/, // ignored owner media is never shipped incidentally
  /^\/desktop\/(dev|test)(\/|$)/,
  /^\/src\/hapa\/controllers\/model-decider\.js$/, // the renderer's copy is in dist; the host does not call model services
  /\/\.(DS_Store|git|github)(\/|$)/,
  /\/(test|tests|__tests__|example|examples|docs)(\/|$)/i,
  /\.(md|markdown|map|ts|d\.ts)$/i,
];

function ignore(path) {
  if (!path) return false;
  if (path.startsWith('/node_modules/')) {
    if (/^\/node_modules\/\.(vite|cache|bin)(\/|$)/.test(path)) return true; // tool caches, not runtime
    // native prebuilds: keep only the target platform's directory
    const m = path.match(/\/prebuilds\/([^/]+)/);
    if (m && m[1] !== `${process.env.HAPA_TARGET_PLATFORM ?? process.platform}-${process.env.HAPA_TARGET_ARCH ?? process.arch}`) return true;
    if (/\/(test|tests|example|examples|docs|bench|benchmarks)(\/|$)/i.test(path.slice('/node_modules/'.length).replace(/^(@[^/]+\/)?[^/]+/, ''))) return true;
    return /\.(md|map|ts|cc|cpp|h|c|gyp|o)$/i.test(path) && !/LICEN[CS]E/i.test(path);
  }
  if (DENY.some((r) => r.test(path))) return true;
  return !ALLOW.some((r) => r.test(path));
}

const git = (...a) => { try { return execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return null; } };

module.exports = {
  packagerConfig: {
    name: 'Hapa Versus',
    executableName: 'Hapa Versus',
    appBundleId: 'com.hapa.versus',
    appCategoryType: 'public.app-category.strategy-games',
    icon: join(ROOT, 'desktop', 'icons', 'hapa-versus'),
    asar: true,
    prune: true,
    ignore,
    win32metadata: { CompanyName: 'Hapa', FileDescription: 'Hapa Versus', ProductName: 'Hapa Versus' },
    extendInfo: { NSHumanReadableCopyright: 'Hapa Versus prototype. Luminati engine © its authors (MIT).' },
    ...(process.env.APPLE_SIGN_IDENTITY ? {
      osxSign: { identity: process.env.APPLE_SIGN_IDENTITY, optionsForFile: () => ({ hardenedRuntime: true, entitlements: join(ROOT, 'desktop', 'entitlements.mac.plist') }) },
    } : {}),
    ...(process.env.APPLE_TEAM_ID && (process.env.APPLE_ID || process.env.APPLE_API_KEY) ? {
      osxNotarize: process.env.APPLE_API_KEY
        ? { appleApiKey: process.env.APPLE_API_KEY, appleApiKeyId: process.env.APPLE_API_KEY_ID, appleApiIssuer: process.env.APPLE_API_ISSUER }
        : { appleId: process.env.APPLE_ID, appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD, teamId: process.env.APPLE_TEAM_ID },
    } : {}),
  },
  makers: [
    // Windows x64 is delivered as a portable zip (extract, open Hapa Versus.exe): no installer, so it
    // builds on macOS without Wine; Authenticode signing is not configured (SmartScreen will warn)
    { name: '@electron-forge/maker-zip', platforms: ['darwin', 'win32'] },
    { name: '@electron-forge/maker-dmg', platforms: ['darwin'], config: { name: 'Hapa Versus', format: 'ULFO' } },
  ],
  plugins: [
    { name: '@electron-forge/plugin-auto-unpack-natives', config: {} },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  hooks: {
    // Without a configured Developer ID, seal the whole bundle with one consistent ad-hoc signature
    // (packaging edits Info.plist after Electron's own ad-hoc signature). This is not a release
    // signature: Gatekeeper still treats the app as unidentified until it is signed and notarized.
    postPackage: async (_config, result) => {
      if (process.env.APPLE_SIGN_IDENTITY || result.platform !== 'darwin') return;
      for (const dir of result.outputPaths) {
        const appPath = join(dir, 'Hapa Versus.app');
        execFileSync('codesign', ['--force', '--deep', '--sign', '-', '--identifier', 'com.hapa.versus', appPath], { stdio: 'inherit' });
        execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], { stdio: 'inherit' });
      }
    },
    // the existing production build, plus a small identity record the About box and diagnostics read
    generateAssets: async () => {
      execFileSync(process.execPath, [join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'], { cwd: ROOT, stdio: 'inherit' });
      // self-contained notices for exactly the bundled engine/dependencies/fonts (R16-08)
      execFileSync(process.execPath, [join(ROOT, 'tools', 'hapa', 'notices.mjs')], { cwd: ROOT, stdio: 'inherit' });
      const info = {
        source: git('rev-parse', 'HEAD'),
        // dirty: tracked changes, or untracked files where they could enter the build (docs/evidence cannot)
        dirty: (git('status', '--porcelain', '--untracked-files=all') ?? '').split('\n').filter(Boolean).some((l) => !l.startsWith('??') || /^\?\? (src|desktop|fixtures|public|vendor)\/|^\?\? (package(-lock)?\.json|vite\.config\.js|versus\.html|index\.html|red-frame\.html|forge\.config\.cjs)$/.test(l)),
        engine: git('-C', 'vendor/lumina', 'rev-parse', 'HEAD'),
        builtAt: new Date().toISOString(),
        target: `${process.env.HAPA_TARGET_PLATFORM ?? process.platform}-${process.env.HAPA_TARGET_ARCH ?? process.arch}`,
      };
      writeFileSync(join(ROOT, 'desktop', 'build-info.json'), JSON.stringify(info, null, 1));
    },
  },
};
