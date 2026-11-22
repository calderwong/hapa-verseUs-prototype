/**
 * Deck and Card editor (Master Requirements v3 ch.11 "Make creation understandable and testable";
 * ch.12 "Deck and Card editor"): start from a known Card, edit its supported fields, read the
 * generated wording, validate, save a derivative or a new revision with creator lineage, bind
 * Cards to columns for each seat's next deck, and exchange bundles with another client.
 * Validation checks executable meaning and required fields — it is not a balance certificate.
 */
import { h } from './dom.js';
import { CATALOG } from '../../../fixtures/hapa/content.js';
import { BASE_PROFILE } from '../../../fixtures/hapa/profiles.js';
import { COLORS } from '../rules/context.js';
import { clone } from '../rules/encoding.js';
import { validateContent } from '../rules/validate.js';
import { deriveDefinition, reviseDefinition, generateWording, exportBundle, loadBundle, bundleText, definitionHash } from '../adapters/content.js';
import { readStore, writeStore, localCatalog, LOCAL_CREATOR } from './local-content.js';

const CHANNELS = ['magic', 'physical'];
const FACES = ['front', 'rear', 'left', 'right', 'above', 'below'];

/** @param {{ el: { overlay: HTMLElement }, showSetup: () => void }} app */
export function openEditor(app) {
  const ui = { selected: 'fixture.ember_strike', draft: null, messages: [], tab: 'cards' };
  const render = () => {
    const cat = localCatalog();
    const store = readStore();
    const base = cat.cards[ui.selected] ?? cat.cards['fixture.ember_strike'];
    if (!ui.draft || ui.draft.__from !== base.id + '@' + base.revision) ui.draft = { ...clone(base), __from: base.id + '@' + base.revision };
    const d = ui.draft;
    const op = d.operations?.[0] ?? {};
    const editable = op.type === 'damage';
    const preview = { ...d }; delete preview.__from;
    preview.text = generateWording(preview);
    const own = base.lineage?.creator?.id === LOCAL_CREATOR.id;
    const num = (val, set, min = 0, max = 9) => h('input', { type: 'number', min, max, value: String(val ?? 0), onchange: (e) => { set(Math.max(min, Math.min(max, Number(e.target.value) || 0))); render(); } });
    const sel = (val, opts, set) => h('select', { onchange: (e) => { set(e.target.value); render(); } }, ...opts.map((o) => h('option', { value: o, selected: o === val }, o)));

    const list = h('div', { class: 'ed-list', role: 'listbox', 'aria-label': 'Cards' }, ...Object.values(cat.cards).filter((c) => c.category !== 'resource').map((c) =>
      h('button', { class: `ed-item${c.id === base.id ? ' on' : ''}`, 'aria-selected': String(c.id === base.id), onclick: () => { ui.selected = c.id; ui.draft = null; ui.messages = []; render(); } },
        h('b', {}, c.title), h('small', {}, ` r${c.revision} · ${c.lineage?.creator?.label ?? c.lineage?.creator?.id}`))));

    const fields = editable ? h('div', { class: 'ed-fields' },
      h('label', {}, 'Title ', h('input', { value: d.title, onchange: (e) => { d.title = e.target.value.slice(0, 40); render(); } })),
      h('label', {}, 'Hits ', num(op.hits, (v) => { op.hits = Math.max(1, v); }, 1, 4)),
      h('label', {}, 'Power per hit ', num(op.power, (v) => { op.power = v; }, 0, 9)),
      h('label', {}, 'Channel ', sel(op.channel, CHANNELS, (v) => { op.channel = v; })),
      h('label', {}, 'Incoming face ', sel(op.incomingFace, FACES, (v) => { op.incomingFace = v; })),
      h('label', {}, h('input', { type: 'checkbox', checked: !!d.counterable, onchange: (e) => { d.counterable = e.target.checked; render(); } }), ' Counterable'),
      h('div', { class: 'ed-cost' }, h('span', {}, 'Mana cost '), ...COLORS.map((c) => h('label', { class: `chip c-${c}` }, c.slice(0, 3), num(d.cost?.mana?.[c], (v) => { d.cost = { ...d.cost, mana: { ...(d.cost?.mana ?? {}) } }; if (v) d.cost.mana[c] = v; else delete d.cost.mana[c]; }, 0, 6)))))
      : h('p', { class: 'dim' }, `This first editor edits damage Cards. “${base.title}” uses ${op.type ?? 'no'} — it can still be bound to a column and exchanged.`);

    // validation: executable meaning, not balance
    const trial = clone(cat);
    const candidate = deriveDefinition(base, stripDraft(d), LOCAL_CREATOR);
    trial.cards[candidate.id] = candidate;
    const v = validateContent(trial);
    const validity = h('div', { class: `ed-valid ${v.ok ? 'ok' : 'bad'}` }, v.ok ? '✓ Valid: every operation is supported and the required fields are present. (Not a balance judgement — playtest it.)' : `✗ ${v.errors.join('; ')}`);

    const save = (kind) => {
      const st = readStore();
      const def = kind === 'revision' ? reviseDefinition(base, stripDraft(d), LOCAL_CREATOR) : deriveDefinition(base, stripDraft(d), LOCAL_CREATOR);
      if (kind !== 'revision' && cat.cards[def.id]) def.id = `${def.id}_${definitionHash(def).slice(7, 13)}`;
      def.text = generateWording(def);
      st.cards[def.id] = def;
      writeStore(st);
      ui.selected = def.id; ui.draft = null;
      ui.messages = [`Saved ${def.title} as ${def.id} revision ${def.revision}${kind === 'revision' ? '' : `, derived from ${base.id}@${base.revision}`}. A match already in progress keeps the version it agreed.`];
      render();
    };

    const lineage = base.lineage ?? {};
    const card = h('div', { class: 'ed-card' },
      h('h3', {}, base.title, h('small', { class: 'dim' }, ` · ${base.id}@${base.revision}`)),
      h('div', { class: 'dim small' }, `Creator: ${lineage.creator?.label ?? lineage.creator?.id ?? '—'}`, lineage.parents?.length ? ` · parent ${lineage.parents.map((p) => (typeof p === 'string' ? p : `${p.id}@${p.revision}`)).join(', ')}` : '', lineage.original ? ` · original ${lineage.original.id}` : ''),
      fields,
      h('h4', {}, 'Generated wording'), h('blockquote', { class: 'ed-wording' }, preview.text),
      validity,
      h('div', { class: 'row' },
        h('button', { class: 'primary', disabled: !v.ok, onclick: () => save('derive') }, 'Save as my derivative'),
        own ? h('button', { disabled: !v.ok, onclick: () => save('revision') }, 'Save new revision') : null,
        h('button', { onclick: () => { ui.draft = null; render(); } }, 'Reset edits')),
      ...ui.messages.map((m) => h('p', { class: 'small ok' }, m)));

    // deck bindings for the next match
    const decks = store.decks ?? { A: { bindings: {} }, B: { bindings: {} } };
    const usable = Object.values(cat.cards).filter((c) => ['ordinary_action', 'response'].includes(c.timing) || c.category === 'resource');
    const bindSel = (seat, lc) => {
      const cur = decks[seat]?.bindings?.[lc] ?? BASE_PROFILE.cards.bindings[lc];
      return h('select', { 'aria-label': `Seat ${seat} column ${lc}`, onchange: (e) => { const st = readStore(); st.decks = st.decks ?? { A: { bindings: {} }, B: { bindings: {} } }; st.decks[seat].bindings[lc] = e.target.value; writeStore(st); render(); } },
        ...usable.map((c) => h('option', { value: c.id, selected: c.id === cur }, `${c.title} r${c.revision}`)));
    };
    const deckGrid = h('div', { class: 'ed-deck' },
      h('table', {}, h('tr', {}, h('th', {}, 'Local column'), h('th', {}, 'Seat A deck'), h('th', {}, 'Seat B deck')),
        ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lc) => h('tr', {}, h('td', {}, `C${lc}`), h('td', {}, bindSel('A', lc)), h('td', {}, bindSel('B', lc))))),
      h('p', { class: 'dim small' }, 'Each generated Minor Arcana from a column carries the bound Card. Bindings apply to the next match you start; both seats\' decks are public in the match manifest.'),
      h('button', { onclick: () => { const st = readStore(); st.decks = null; writeStore(st); render(); } }, 'Reset both decks to the profile'));

    // exchange
    const mine = Object.values(cat.cards).filter((c) => !CATALOG.cards[c.id]);
    const file = h('input', { type: 'file', accept: 'application/json,.json', onchange: async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      let bundle;
      try { bundle = JSON.parse(await f.text()); } catch { ui.messages = ['✗ That file is not JSON.']; return render(); }
      const r = loadBundle(bundle, cat, { receivedFrom: bundle.exporter?.id ?? null });
      if (!r.ok) { ui.messages = [`✗ Not imported — ${r.errors.join('; ')}`]; return render(); }
      const st = readStore();
      for (const rec of r.received) st.cards[rec.id] = r.catalog.cards[rec.id];
      st.received.push(...r.received.map((x) => ({ ...x, at: 'local-import' })));
      writeStore(st);
      ui.messages = r.received.map((x) => `Received ${x.id}@${x.revision} by ${x.creator} (hash verified).`);
      render();
    } });
    const exchange = h('div', { class: 'ed-exchange' },
      h('p', {}, mine.length ? `${mine.length} Card${mine.length > 1 ? 's' : ''} you made or received can be exported as one bundle.` : 'Nothing to export yet: save a derivative first.'),
      h('button', { disabled: !mine.length, onclick: () => {
        const bundle = exportBundle(cat, mine.map((c) => c.id), { exporter: LOCAL_CREATOR });
        const a = h('a', { href: URL.createObjectURL(new Blob([bundleText(bundle)], { type: 'application/json' })), download: `hapa-versus-bundle-${bundle.bundleHash.slice(7, 15)}.json` });
        a.click();
      } }, 'Export bundle…'),
      h('label', { class: 'file' }, 'Import a bundle: ', file),
      h('p', { class: 'dim small' }, 'Import checks every definition\'s content hash and that this client can execute every operation; anything unsupported is named and nothing is merged.'),
      store.received.length ? h('details', {}, h('summary', {}, `Received (${store.received.length})`), h('ul', {}, ...store.received.map((x) => h('li', {}, `${x.id}@${x.revision} · creator ${x.creator}`)))) : null);

    const tabs = ['cards', 'decks', 'exchange'];
    app.el.overlay.replaceChildren(h('div', { class: 'card-sheet editor' },
      h('div', { class: 'row' }, h('h2', {}, 'Cards & decks'), h('button', { onclick: () => app.showSetup() }, '← Back to setup')),
      h('div', { class: 'tabs', role: 'tablist' }, ...tabs.map((t) => h('button', { role: 'tab', 'aria-selected': String(ui.tab === t), class: ui.tab === t ? 'on' : '', onclick: () => { ui.tab = t; render(); } }, { cards: 'Card editor', decks: 'Deck bindings', exchange: 'Exchange' }[t]))),
      ui.tab === 'cards' ? h('div', { class: 'ed-grid' }, list, card) : ui.tab === 'decks' ? deckGrid : h('div', {}, exchange, ...ui.messages.map((m) => h('p', { class: 'small' }, m)))));
    app.el.overlay.hidden = false;
  };
  render();
}

function stripDraft(d) {
  const out = clone(d);
  delete out.__from; delete out.id; delete out.revision; delete out.lineage; delete out.text; delete out.wording;
  return out;
}
