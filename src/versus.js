import '@fontsource/cinzel/600.css';
import '@fontsource/crimson-pro/400.css';
import '@fontsource/pixelify-sans/400.css';
import { VersusApp } from './hapa/presentation/app.js';
import { readPreset, resolveLaunch } from './hapa/presentation/dev-preset.js';
import { PROFILE_IDS } from '../fixtures/hapa/profiles.js';
import { UI_FIXTURES } from '../fixtures/hapa/ui-fixtures.js';
import { anyProfile } from './hapa/presentation/lab.js';
import { desktopHost } from './hapa/presentation/online.js';

// effective launch: valid URL parameters > saved development preset > A human / B bot (HF3-04)
const launch = resolveLaunch(location.search, readPreset(), {
  profileOk: (id) => PROFILE_IDS.includes(id) || !!anyProfile(id),
  fixtureOk: (id) => Object.hasOwn(UI_FIXTURES, id),
});
const app = new VersusApp(document.getElementById('app'), { launch });
if (launch.autostart) {
  const c = launch.config;
  app.startMatch({ fixture: c.fixture, profileId: c.profileId ?? undefined, seats: c.seats, seed: c.seed });
}
if (launch.problems.length) app.notice(launch.problems.join(' · '));
// desktop: a reload or a reopened window reattaches to the runtime's active online match
if (desktopHost() && !launch.autostart) app.resumeOnline().catch((e) => console.warn('[versus] online reattach failed', e));
if (new URLSearchParams(location.search).has('debug') || launch.autostart) window.__versus = app;
