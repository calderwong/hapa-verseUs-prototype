/**
 * Development controllers (human-feedback addendum 03, HF3-04). One saved preset, whose built-in
 * default is the ordinary test launch — A human, B the existing heuristic bot — and one effective
 * configuration resolved with explicit precedence:
 *
 *   valid URL parameters  >  saved development preset  >  built-in A human / B bot, seed 1
 *
 * Every value is validated. An invalid role, seed, profile or fixture is reported and ignored
 * (the next source supplies it), so an invalid role can never create an uncontrolled seat. The
 * preset lives in this browser's localStorage (a per-developer convenience, never game state);
 * when storage is unavailable the built-in default applies.
 */
export const DEV_PRESET_KEY = 'hapa-versus.dev-preset.v1';
export const ROLES = ['human', 'bot'];
export const ROLE_NAME = { human: 'Human', bot: 'Heuristic bot' };
export const BUILTIN = Object.freeze({ a: 'human', b: 'bot', seed: 1, profile: null });
const SEED_MAX = 0x7fffffff;

const validSeed = (v) => { const n = Number(v); return Number.isSafeInteger(n) && n >= 1 && n <= SEED_MAX ? n : null; };

/** The saved preset, validated field by field; `null` fields fall back to the built-in default. */
export function readPreset(storage = safeStorage()) {
  let raw = null;
  try { raw = JSON.parse(storage?.getItem(DEV_PRESET_KEY) ?? 'null'); } catch { raw = null; }
  if (!raw || typeof raw !== 'object') return null;
  return {
    a: ROLES.includes(raw.a) ? raw.a : null,
    b: ROLES.includes(raw.b) ? raw.b : null,
    seed: validSeed(raw.seed),
    profile: typeof raw.profile === 'string' ? raw.profile : null,
  };
}

export function savePreset(p, storage = safeStorage()) {
  const clean = { a: ROLES.includes(p.a) ? p.a : BUILTIN.a, b: ROLES.includes(p.b) ? p.b : BUILTIN.b, seed: validSeed(p.seed) ?? BUILTIN.seed, profile: p.profile ?? null };
  try { storage?.setItem(DEV_PRESET_KEY, JSON.stringify(clean)); return true; } catch { return false; }
}

export function clearPreset(storage = safeStorage()) { try { storage?.removeItem(DEV_PRESET_KEY); } catch { /* unavailable */ } }

function safeStorage() { try { return globalThis.localStorage ?? null; } catch { return null; } }

/**
 * Resolve the effective launch configuration.
 * @param {string|URLSearchParams} search the page query
 * @param {ReturnType<typeof readPreset>} preset
 * @param {{ profileOk?: (id: string) => boolean, fixtureOk?: (id: string) => boolean }} [check]
 * @returns {{ autostart: boolean, config: { seats: { A: string, B: string }, seed: number, profileId: string|null, fixture: string|null },
 *   sources: Record<string, 'url'|'preset'|'default'>, problems: string[] }}
 */
export function resolveLaunch(search, preset = null, { profileOk = () => true, fixtureOk = () => true } = {}) {
  const q = typeof search === 'string' ? new URLSearchParams(search) : search;
  const problems = [], sources = {};
  const pick = (key, urlVal, ok, presetVal, dflt, what) => {
    if (urlVal != null && urlVal !== '') {
      const v = ok(urlVal);
      if (v != null) { sources[key] = 'url'; return v; }
      problems.push(`${what} "${urlVal}" is not valid — ${presetVal != null ? 'using the saved preset' : 'using the default'}`);
    }
    if (presetVal != null) { sources[key] = 'preset'; return presetVal; }
    sources[key] = 'default';
    return dflt;
  };
  const role = (v) => (ROLES.includes(v) ? v : null);
  const a = pick('a', q.get('a'), role, preset?.a, BUILTIN.a, 'Seat A role');
  const b = pick('b', q.get('b'), role, preset?.b, BUILTIN.b, 'Seat B role');
  const seed = pick('seed', q.get('seed'), validSeed, preset?.seed, BUILTIN.seed, 'Seed');
  const profileId = pick('profile', q.get('profile'), (v) => (profileOk(v) ? v : null), preset?.profile && profileOk(preset.profile) ? preset.profile : null, null, 'Profile');
  const fixtureParam = q.get('fixture');
  let fixture = null;
  if (fixtureParam) { if (fixtureOk(fixtureParam)) fixture = fixtureParam; else problems.push(`Fixture "${fixtureParam}" is unknown — starting an ordinary match`); }
  return { autostart: q.has('autostart'), config: { seats: { A: a, B: b }, seed, profileId, fixture }, sources, problems };
}

/** A copyable launch link that reproduces a configuration exactly. */
export function launchURL(config, base = (typeof location !== 'undefined' ? `${location.origin}${location.pathname}` : '/versus.html')) {
  const q = new URLSearchParams({ autostart: '1' });
  if (config.fixture) q.set('fixture', config.fixture);
  q.set('a', config.seats.A);
  q.set('b', config.seats.B);
  if (!config.fixture) q.set('seed', String(config.seed));
  if (config.profileId && !config.fixture) q.set('profile', config.profileId);
  return `${base}?${q}`;
}

/** "A human · B bot · seed 1" */
export const describeConfig = (c) => `A ${c.seats.A === 'bot' ? 'bot' : 'human'} · B ${c.seats.B === 'bot' ? 'bot' : 'human'}${c.fixture ? ` · fixture ${c.fixture}` : ` · seed ${c.seed}`}${c.profileId ? ` · ${c.profileId}` : ''}`;
