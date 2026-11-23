/**
 * Rules and experiment panel (Master Requirements v3 ch.12; ch.14): edit a copy of a profile with
 * each field's meaning, units and legal values; save it as a fingerprinted revision; compare it
 * with another profile or the last match's; run a bot batch and inspect the summary and each
 * replay. Saved revisions live in this browser (per-viewer convenience); each match and replay
 * records the full profile it used, so nothing depends on this storage.
 */
import { h } from './dom.js';
import { PROFILE_IDS, profileById } from '../../../fixtures/hapa/profiles.js';
import { PROFILE_FIELDS, editProfile, profileDiff, runBatchMatch, batchSummary } from '../adapters/profile-lab.js';
import { canonicalize } from '../rules/encoding.js';
import { localCatalog } from './local-content.js';

const KEY = 'hapa-versus.lab.v1';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') ?? { profiles: [] }; } catch { return { profiles: [] }; } };
const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage unavailable */ } };

/** Saved lab revisions (newest first). */
export const labProfiles = () => read().profiles;
/** A profile by id: bundled base/variant or a saved lab revision. */
export function anyProfile(id) {
  if (PROFILE_IDS.includes(id)) return profileById(id);
  const p = labProfiles().find((x) => x.id === id);
  return p ? JSON.parse(JSON.stringify(p)) : null;
}
const allIds = () => [...PROFILE_IDS, ...labProfiles().map((p) => p.id)];
const get = (o, path) => path.split('.').reduce((v, k) => (v == null ? v : v[k]), o);
const show = (v) => (v === null || v === undefined ? '—' : Array.isArray(v) ? v.join('/') : String(v));

/** @param {any} app the VersusApp (overlay, showSetup, startMatch, session) */
export function openLab(app) {
  const ui = { baseId: PROFILE_IDS[0], edits: {}, result: null, compareId: PROFILE_IDS[0], batch: null, seeds: [1, 4], ticks: 120 };
  const render = () => {
    const base = anyProfile(ui.baseId) ?? profileById(PROFILE_IDS[0]);
    const control = (f) => {
      const cur = f.path in ui.edits ? ui.edits[f.path] : get(base, f.path);
      const setv = (v) => { ui.edits[f.path] = v; ui.result = null; render(); };
      if (f.kind === 'enum') return h('select', { 'aria-label': f.label, onchange: (e) => setv(e.target.value) }, ...f.values.map((v) => h('option', { value: v, selected: v === cur }, v)));
      if (f.kind === 'bool') return h('input', { type: 'checkbox', 'aria-label': f.label, checked: !!cur, onchange: (e) => setv(e.target.checked) });
      if (f.kind === 'int') return h('input', { type: 'number', 'aria-label': f.label, min: f.min, max: f.max, value: String(cur), onchange: (e) => setv(Number(e.target.value)) });
      return h('span', {}, h('input', { type: 'number', 'aria-label': `${f.label} numerator`, min: 1, value: String(cur[0]), onchange: (e) => setv([Number(e.target.value), cur[1]]) }), ' / ',
        h('input', { type: 'number', 'aria-label': `${f.label} denominator`, min: 1, value: String(cur[1]), onchange: (e) => setv([cur[0], Number(e.target.value)]) }));
    };
    const changed = (f) => f.path in ui.edits && canonicalize(ui.edits[f.path]) !== canonicalize(get(base, f.path));
    const fields = h('table', { class: 'lab-fields' }, h('tr', {}, h('th', {}, 'Field'), h('th', {}, 'Value'), h('th', {}, 'Meaning')),
      ...PROFILE_FIELDS.map((f) => h('tr', { class: changed(f) ? 'changed' : '' },
        h('td', {}, h('b', {}, f.label), h('div', { class: 'dim small' }, f.path)),
        h('td', {}, control(f), f.units ? h('div', { class: 'dim small' }, f.units) : null, changed(f) ? h('div', { class: 'small' }, `was ${show(get(base, f.path))}`) : null),
        h('td', { class: 'small' }, f.description))));

    const create = () => {
      const edits = Object.fromEntries(Object.entries(ui.edits).filter(([p, v]) => canonicalize(v) !== canonicalize(get(base, p))));
      ui.result = editProfile(base, edits, { catalog: localCatalog() });
      if (ui.result.ok) {
        const st = read();
        if (!st.profiles.some((p) => p.id === ui.result.profile.id)) st.profiles.unshift(ui.result.profile);
        write(st);
        ui.compareId = base.id;
      }
      render();
    };
    const result = ui.result ? (ui.result.ok
      ? h('div', { class: 'lab-result ok' }, h('div', {}, `Saved revision ${ui.result.profile.id}`), h('code', { class: 'small' }, ui.result.fingerprint), h('div', { class: 'small dim' }, `Revision of ${ui.result.profile.revisionOf.id} (${ui.result.profile.revisionOf.fingerprint.slice(0, 19)}…). A match records this exact revision.`))
      : h('div', { class: 'lab-result bad' }, ui.result.errors.join('; '))) : null;

    // compare
    const other = ui.compareId === '__last' ? app.session?.manifest?.profile : anyProfile(ui.compareId);
    const diff = other ? profileDiff(other, base) : [];
    const compare = h('div', { class: 'lab-compare' },
      h('label', {}, 'Compare ', h('b', {}, base.id), ' with ', h('select', { onchange: (e) => { ui.compareId = e.target.value; render(); } },
        ...(app.session ? [h('option', { value: '__last', selected: ui.compareId === '__last' }, `the last match's profile (${app.session.manifest.profile.id})`)] : []),
        ...allIds().map((id) => h('option', { value: id, selected: id === ui.compareId }, id)))),
      diff.length ? h('table', { class: 'small' }, h('tr', {}, h('th', {}, 'Field'), h('th', {}, 'Other'), h('th', {}, 'This')), ...diff.map((d) => h('tr', {}, h('td', {}, d.path), h('td', {}, show(d.from)), h('td', {}, show(d.to)))))
        : h('p', { class: 'dim small' }, 'No differing fields.'));

    // batch
    const runBatch = async () => {
      const catalog = localCatalog();
      ui.batch = { profile: base, rows: [], running: true };
      render();
      for (let seed = ui.seeds[0]; seed <= ui.seeds[1]; seed++) {
        await new Promise((r) => setTimeout(r, 30)); // let the page paint between matches
        ui.batch.rows.push(runBatchMatch(base, catalog, seed, ui.ticks));
        render();
      }
      ui.batch.running = false;
      render();
    };
    const download = (replay, name) => { const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(replay)], { type: 'application/json' })), download: name }); a.click(); };
    const batch = h('div', { class: 'lab-batch' },
      h('div', { class: 'row' },
        h('label', {}, 'Seeds ', h('input', { type: 'number', min: 1, value: String(ui.seeds[0]), onchange: (e) => { ui.seeds[0] = Math.max(1, Number(e.target.value)); } }), '–', h('input', { type: 'number', min: 1, value: String(ui.seeds[1]), onchange: (e) => { ui.seeds[1] = Math.max(ui.seeds[0], Number(e.target.value)); } })),
        h('label', {}, ' Tick budget ', h('input', { type: 'number', min: 10, max: 400, value: String(ui.ticks), onchange: (e) => { ui.ticks = Math.min(400, Math.max(10, Number(e.target.value))); } })),
        h('button', { class: 'primary', disabled: ui.batch?.running, onclick: runBatch }, ui.batch?.running ? 'Running…' : `Run bot batch on ${base.id}`)),
      h('p', { class: 'dim small' }, 'A rules simulation (one process, heuristic bots, seats alternate by seed) — not a peer-verified match. Results are evidence about this bot, not about human comprehension.'),
      ui.batch ? (() => {
        const s = batchSummary(ui.batch.rows);
        return h('div', {},
          h('p', {}, `${s.runs} run${s.runs === 1 ? '' : 's'}: A ${s.winsA} · B ${s.winsB} · draw ${s.draws} · unfinished ${s.unfinished} · mean outcome Tick ${show(s.meanOutcomeTick)} · first contact ${show(s.meanFirstContact)} · casualties ${s.casualties.A}/${s.casualties.B} · replays ${s.allReplaysVerified ? 'all verified' : 'NOT all verified'}`),
          h('table', { class: 'small' }, h('tr', {}, ...['Seed', 'Result', 'Tick', 'First contact', 'Casualties A/B', 'Replay', ''].map((x) => h('th', {}, x))),
            ...ui.batch.rows.map((r) => h('tr', {},
              h('td', {}, r.seed), h('td', {}, r.outcome.result === 'win' ? `${r.outcome.winner} won (${r.outcome.reasons?.[0]?.reason?.replace('_', ' ') ?? ''})` : r.outcome.result),
              h('td', {}, r.tick), h('td', {}, show(r.summary.firstEngagementTick)), h('td', {}, `${r.summary.casualties.A}/${r.summary.casualties.B}`),
              h('td', {}, r.replayVerified ? '✓ verified' : '✗'),
              h('td', {}, h('button', { onclick: () => download(r.replay, `${base.id}.seed${r.seed}.replay.json`) }, 'Download replay'), ' ',
                h('button', { onclick: () => app.startMatch({ profile: base, seats: { A: 'bot', B: 'bot' }, seed: r.seed, watch: true }) }, 'Watch'))))));
      })() : null);

    app._overlayDismiss = false;
    app.el.overlay.replaceChildren(h('div', { class: 'card-sheet editor lab' },
      h('div', { class: 'row' }, h('h2', {}, 'Rules & experiments'), h('button', { onclick: () => app.showSetup() }, '← Back to setup'),
        h('button', { onclick: () => app.startMatch({ profile: base, seats: { A: 'human', B: 'bot' } }) }, `Play ${base.id} vs bot`)),
      h('label', {}, 'Start from ', h('select', { onchange: (e) => { ui.baseId = e.target.value; ui.edits = {}; ui.result = null; render(); } }, ...allIds().map((id) => h('option', { value: id, selected: id === ui.baseId }, id)))),
      h('h3', {}, 'Fields'), fields,
      h('div', { class: 'row' }, h('button', { class: 'primary', onclick: create }, 'Create revision'), h('button', { onclick: () => { ui.edits = {}; ui.result = null; render(); } }, 'Discard edits')),
      result,
      h('h3', {}, 'Compare'), compare,
      h('h3', {}, 'Batch'), batch));
    app.el.overlay.hidden = false;
  };
  render();
}
