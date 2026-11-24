/**
 * Hapa Versus — the local match application (Master Requirements v3 Chapter 12; Design Companion
 * v1 Chapters 9–12). One shared rules module decides everything; this file draws the public
 * state, builds public plans from input, asks public choices and plays back resolved Ticks.
 *
 * Seats are human or bot (same command contract). Plans are public and editable until Ready; a
 * Ready names both current plan revisions, so a change to either plan makes it stale.
 */
import * as THREE from 'three';
import { Engine } from '../../../vendor/lumina/src/engine/core/Engine.js';
import { PostFX } from '../../../vendor/lumina/src/engine/render/PostFX.js';
import { loadCharacterKit } from '../../../vendor/lumina/src/engine/pixel/CharacterSprites.js';
import { BoardCamera } from './camera.js';
import { BoardView, COLOR_HEX, OWNER_HEX } from './board-view.js';
import { eventLine, explainHit, memberName, partyName, fmtMana } from './explain.js';
import { createSession, createFixtureSession, openTick } from '../rules/session.js';
import { validatePlan, resolveTick, responseOptions, projectPlan } from '../rules/match.js';
import { legalDestinations, planPartyRoute, routeOrigin, routeFromHere, routeClearance, atNode, travelTicks, knightTurnPolicy, FACES4, touchingPairs, contactTolerance, quotedDestinations, quoteRoute, destinationPolicy } from '../rules/movement.js';
import { surfaceBand } from '../rules/terrain.js';
import { pieceOf, PIECE_NAME } from './pieces.js';
import { mintForecast, nextActivation, roundOf, supplyOf, quotePayment } from '../rules/economy.js';
import { stateFingerprint, other } from '../rules/state.js';
import { summarize } from '../rules/stats.js';
import { clone, canonicalize } from '../rules/encoding.js';
import { HeuristicBot } from '../controllers/heuristic-bot.js';
import { ALLOCATION_POLICIES } from '../rules/combat.js';
import { profileById, PROFILE_IDS, BASE_PROFILE, DEFAULT_PROFILE_ID } from '../../../fixtures/hapa/profiles.js';
import { CATALOG } from '../../../fixtures/hapa/content.js';

/** The catalog the running match agreed (bundled + local Cards); presentation reads definitions from it. */
let activeCatalog = CATALOG;
/** A plan command's identity for change highlighting (canonical JSON, so key order never matters). */
const cmdKey = (c) => canonicalize(c);
import { UI_FIXTURES } from '../../../fixtures/hapa/ui-fixtures.js';
import { standingOf, fmtBand, bandY } from './terrain-view.js';
import { snapshot, poseAt, timeline, eventsBeforeMovement } from './playback.js';
import { loadRenditions, renditionFor, drawCover } from './renditions.js';
import { h } from './dom.js';
import { VersusSound } from './sound.js';
import { buildScenery } from './scenery.js';
import { CardDrag } from './card-drag.js';
import { emblemURL, COLOR_NAME, drawEmblem, INK, HUE, SUIT_GLYPH as SUIT_MARK } from './palette.js';
import { openEditor } from './editor.js';
import { InspectController } from './inspect.js';
import { MemberLabels } from './member-labels.js';
import { factChips, chipsText, roleGlyph } from './member-glyphs.js';
import { FACINGS } from '../rules/geometry.js';
import { memberFacts, partyFacts, rangedTargets, linePreview, momentSlice, stateAt } from '../rules/inspection.js';
import { term, closeTerms } from './glossary.js';
import { openLab, anyProfile, labProfiles } from './lab.js';
import { localCatalog, localDecks } from './local-content.js';
import { PhaseAgreement, agreementPolicy } from '../protocol/agreement.js';
import { readPreset, savePreset, clearPreset, resolveLaunch, launchURL, describeConfig, ROLE_NAME as CONTROLLER_NAME } from './dev-preset.js';

const U = 1e6;
const SUIT = { wands: '♣', pentacles: '✪', cups: '♥', swords: '♠', wildcard: '✱' };
const SUIT_NAME = { wands: 'Wands', pentacles: 'Pentacles', cups: 'Cups', swords: 'Swords', wildcard: 'Wildcard' };
const ROLE_ABBR = { swordsman: 'Sw', pikeman: 'Pk', archer: 'Ar', mage: 'Mg', priest: 'Pr', center: '★' };
/** Role names shown with their marks (review UX-13: pair role icons with full names). */
const ROLE_NAME = { swordsman: 'Sword', pikeman: 'Pike', archer: 'Archer', mage: 'Mage', priest: 'Priest' };
const FACING_NAME = { N: 'North', E: 'East', S: 'South', W: 'West' };
const STATE_NAME = { idle: 'waiting', moving: 'moving', engaged: 'in combat', turning: 'turning', working: 'working', blocked: 'blocked' };
/** A Mount's Speed in territories per Tick ("2", "1", "½"). */
const speedText = (ctx, p) => { const sp = p?.mount ? ctx.profile.movement.speeds[p.mount] : null; if (!sp) return null; const v = sp[0] / sp[1]; return v === 0.5 ? '½' : Number.isInteger(v) ? String(v) : v.toFixed(2); };
const FACE_ARROW = { N: '↑', E: '→', S: '↓', W: '←' };
/** A party's travel state in words; a known obstruction says so instead of "moving" (HF3-01). */
const stateWord = (state, p) => (p?.blockedBy && p.destination && state.parties[p.blockedBy.partyId] ? `blocked by ${state.parties[p.blockedBy.partyId].owner === p.owner ? 'your' : `${state.parties[p.blockedBy.partyId].owner}'s`} ${state.parties[p.blockedBy.partyId].mount ? cap(state.parties[p.blockedBy.partyId].mount) : 'Pawn'} R${state.parties[p.blockedBy.partyId].region.row}C${state.parties[p.blockedBy.partyId].region.column}` : STATE_NAME[p?.state] ?? p?.state);
/** Attributes that make a click-driven element a keyboard button too (Enter / Space; review UX-14). */
const kbd = (fn, label) => ({ tabindex: '0', role: 'button', ...(label ? { 'aria-label': label } : {}), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); fn(e); } } });
const cap = (x) => (x ? x[0].toUpperCase() + x.slice(1) : x);
const FACES_ALL = ['front', 'left', 'right', 'rear', 'above', 'below'];
const listWords = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
/** A Card effect's readable name from its definition id (`fixture.bound_standard@1` → "Bound Standard"). */
const cardEffectName = (kind) => String(kind).replace(/@\d+$/, '').replace(/^.*\./, '').split('_').map(cap).join(' ');
/**
 * One member's protection grouped into rows (review 06, R6-01): faces sharing the same channel,
 * total, base and named sources become one row ("Magic 1 on all six faces, from the party Mage"),
 * so identical values are not repeated while every real exception keeps its own row.
 */
function protectionGroups(f) {
  const rows = new Map();
  for (const channel of ['physical', 'magic']) for (const face of FACES_ALL) {
    const v = f.protection[channel]?.[face];
    if (!v) continue;
    const k = `${channel}|${v.total}|${v.base}|${v.sources.map((x) => `${x.source}:${x.kind}:${x.amount}`).join(',')}`;
    if (!rows.has(k)) rows.set(k, { channel, total: v.total, base: v.base, sources: v.sources, faces: [] });
    rows.get(k).faces.push(face);
  }
  return [...rows.values()];
}
/** A party in plain words: "Castle R1C1" (Mount kind, or Pawn, and its global territory). */
const partyShort = (state, id) => { const p = state.parties[id]; return p ? `${p.mount ? cap(p.mount) : 'Pawn'} R${p.region.row}C${p.region.column}` : id; };
/** A card in plain words: "2♣ (C1)". */
const cardShort = (state, id) => { const c = state.cards[id]; return c ? `${c.rank ?? ''}${SUIT_GLYPH_TXT[c.suit] ?? ''} (C${c.localColumn})` : id; };
const SUIT_GLYPH_TXT = { wands: '♣', pentacles: '✪', cups: '♥', swords: '♠', wildcard: '✱' };
const COLOR_LETTER = { red: 'R', green: 'G', purple: 'P', yellow: 'Y', blue: 'B', orange: 'O', black: 'K', white: 'W', rainbow: '✦' };
const pts = (u) => { const v = u / U; return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''); };
/** Mana as emblem + count (the emblem carries the color identity by shape; the name is in the title). */
const manaChips = (m) => Object.entries(m ?? {}).filter(([, n]) => n).map(([c, n]) => h('span', { class: `mchip`, title: `${n} ${COLOR_NAME[c]} Mana`, 'aria-label': `${n} ${COLOR_NAME[c]}` }, h('img', { src: emblemURL(c, 16), alt: '' }), String(n)));

export class VersusApp {
  constructor(root, { launch = null } = {}) {
    this.root = root;
    this.launch = launch;
    this.speed = 1;
    this.keys = new Set();
    this._layout();
    this._bindKeys();
    this.showSetup();
  }

  // --- layout ------------------------------------------------------------------------------------
  _layout() {
    this.el = {};
    const r = this.root;
    r.innerHTML = '';
    const area = (id, cls = '') => (this.el[id] = h('div', { id, class: `area ${cls}` }));
    // ordinary play is the board (human-feedback addendum 01 §2): a compact decision strip, the
    // world and a thin event strip. Cards and parties are inspected where they are; Orders, the
    // Parties & Cards navigator and a required decision open over the board when needed.
    r.append(area('matchbar'), area('world'), area('events'));
    this.el.roster = h('nav', { id: 'roster', class: 'area panel drawer', 'aria-label': 'Parties and Cards' });
    this.el.orders = h('section', { id: 'orders', class: 'area panel drawer', role: 'region', 'aria-label': 'Orders and public plans', hidden: true });
    this.el.plan = h('div', { id: 'plan', role: 'region', 'aria-label': 'Public plans' });
    this.el.decision = h('section', { id: 'decision', class: 'area panel', role: 'region', 'aria-label': 'Required decision', hidden: true });
    this.el.basins = { A: h('button', { class: 'basin-counter a', 'aria-label': "A's Mana basin" }), B: h('button', { class: 'basin-counter b', 'aria-label': "B's Mana basin" }) };
    this.el.overlay = h('div', { id: 'overlay' });
    r.append(this.el.overlay);
    this._containModals();
    this.el.world.append(this.el.toast = h('div', { class: 'toast' }));
    this.el.world.append(this.el.compass = h('div', { class: 'compass' }));
    this.el.world.append(this.el.layers = h('div', { class: 'layer-rail', role: 'toolbar', 'aria-label': 'Height layers' }));
    this.el.world.append(this.el.basins.A, this.el.basins.B, this.el.roster, this.el.orders, this.el.decision);
    for (const seat of ['A', 'B']) {
      const b = this.el.basins[seat], subject = { kind: 'basin', id: seat };
      b.addEventListener('pointerenter', () => this.inspect?.hover(subject));
      b.addEventListener('pointerleave', () => this.inspect?.hover(null));
      b.addEventListener('focus', () => this.inspect?.focusSubject(subject));
      b.addEventListener('blur', () => this.inspect?.blurSubject());
      b.addEventListener('click', () => { this.pinned = { kind: 'basin', id: seat }; this._renderAll(); });
    }
    this.labels = new MemberLabels(this.el.world);
    // one contextual inspection system for Cards, parties, members, basins and events (§3)
    this.inspect = new InspectController({
      host: this.el.world,
      // open drawers (navigator on the left, Orders / a decision on the right) are kept clear:
      // the one free-space reading shared with the docked bars and the member explanation
      reserved: () => {
        const f = this._freeSpace(), w = this.el.world.getBoundingClientRect();
        const rail = this.el.layers && !this.el.layers.hidden ? this.el.layers.getBoundingClientRect() : null;
        return { left: f.left, right: Math.max(f.right, rail && rail.width ? w.right - rail.left + 6 : 0) };
      },
      generation: () => this.generation ?? 0,
      build: (sub) => (this.session ? this._contentFor(sub) : null),
      project: (sub) => this._screenAnchor(sub),
      onPin: (sub) => { if (!sub && this.pinned) { this.pinned = null; this._renderAll(); } },
    });
  }

  _initEngine() {
    if (this.engine) return;
    try { this.sound = new VersusSound(); } catch { this.sound = null; }
    // Versus reads its own keys and pointers; the engine's game Input (which claims Enter, Space and
    // Tab on the window for its adventure bindings) listens to a detached target, so keyboard focus
    // and button activation work in the HUD (the engine's documented inputTarget option)
    this.engine = new Engine({ container: this.el.world, clearColor: 0x17212d, maxPixelRatio: 2, inputTarget: new EventTarget() });
    this.engine.renderer.toneMappingExposure = 1.12;
    this.engine.scene.fog = new THREE.Fog(0x17212d, 160, 320);
    // restrained post (Design Companion ch.2): no depth blur, grain or chromatic aberration over
    // playable territory; a soft bloom for the inlays and short effects; a gentle vignette
    try {
      const r = this.engine.renderer;
      const dpr = Math.min(window.devicePixelRatio || 1, this.engine.maxPixelRatio);
      this.postfx = new PostFX(r, this.engine.scene, this.engine.camera, { maxTaps: 48, samples: window.innerWidth * window.innerHeight * dpr * dpr > 1.8e6 ? 2 : 4 });
      const st = this.postfx.settings;
      st.dof.enabled = false;
      Object.assign(st.bloom, { enabled: true, strength: 0.32, radius: 0.45, threshold: 0.86, warmth: 0.2 });
      Object.assign(st.grade, { contrast: 1.06, saturation: 1.06, temperature: 0.05, vignette: 0.32, vignetteSoftness: 0.6, grain: 0, chromaticAberration: 0, sharpen: 0.12 });
      this.engine.events.on('resize', ({ width, height, pixelRatio }) => this.postfx.setSize(width, height, pixelRatio));
      const size = r.getSize(new THREE.Vector2());
      this.postfx.setSize(Math.max(1, size.x), Math.max(1, size.y), r.getPixelRatio());
      this.engine.setRenderFn((dt) => this.postfx.render(dt));
    } catch (err) {
      console.warn('[versus] post effects unavailable; plain rendering', err);
      this.postfx = null;
    }
    this.raycaster = new THREE.Raycaster();
    const canvas = this.engine.renderer.domElement;
    // cards are picked up from the hand ribbon or their bank slot and dropped on the field
    this.cardDrag = new CardDrag(this, { drawCard: drawCardCanvas, pts, fmtMana, supplyOf, partyName, legalDestinations });
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !this.view || !this.session) return;
      const id = this._cardTileAt(e);
      const card = id ? this.state.cards[id] : null;
      if (card && this.cardDrag.press(e, card, { x: e.clientX, y: e.clientY })) e.stopPropagation(); // not a camera pan
    });
    // a click acts on release, and only if the gesture was not a camera drag (pan / orbit) or a card drag
    this.el.world.addEventListener('pointerup', (e) => {
      // only the canvas acts on the board: a click inside a view, drawer or counter never reaches
      // the territory behind it (addendum §3: "stop pointer events from issuing commands behind it")
      if (e.target !== canvas || this.cam?.wasDrag() || this.cardDrag?.active || this.dragging) return;
      this._onPointer(e);
    });
    canvas.addEventListener('pointermove', (e) => { if (!this.cam?.dragging && !this.dragging) this._onHover(e); });
    canvas.addEventListener('pointerleave', () => this.inspect.hover(null));
    this.el.world.addEventListener('contextmenu', (e) => e.preventDefault());
    this.engine.addSystem({ name: 'versus', update: (dt) => this._frame(dt) });
    this.engine.start();
  }

  // --- setup -------------------------------------------------------------------------------------
  /** A short message over whatever is shown (setup or match): invalid launch values, etc. */
  notice(msg) {
    if (this.session) { this._toast(msg, true); return; }
    if (this.launch?.autostart) this._pendingNotice = msg; // shown once the match opens
    this.el.overlay.querySelector('.launch-notice')?.remove();
    this.el.overlay.querySelector('.setup')?.prepend(h('p', { class: 'launch-notice warn', role: 'alert' }, msg));
  }

  /** The effective development configuration now: this match's, else the resolved launch/preset. */
  _devConfig() {
    if (this.effective) return this.effective;
    return (this.launch ?? resolveLaunch('', readPreset())).config;
  }

  showSetup() {
    // the form starts from the effective configuration (URL > saved preset > A human / B bot)
    const eff = this._devConfig();
    const dProfile = eff.profileId ?? DEFAULT_PROFILE_ID;
    const profileSel = h('select', { id: 'set-profile' }, ...PROFILE_IDS.map((id) => h('option', { value: id, selected: id === dProfile }, `${id} — ${profileById(id).title}${id === DEFAULT_PROFILE_ID ? ' (default)' : ''}`)), ...labProfiles().map((p) => h('option', { value: p.id, selected: p.id === dProfile }, `${p.id} — lab revision: ${p.changes.join(', ')}`)));
    const seatSel = (seat, dflt) => h('select', { id: `set-${seat}` }, h('option', { value: 'human', selected: dflt === 'human' }, 'Human'), h('option', { value: 'bot', selected: dflt === 'bot' }, 'Heuristic bot'));
    const seed = h('input', { id: 'set-seed', type: 'number', value: String(eff.seed ?? 1), min: '1' });
    const remember = h('input', { id: 'set-remember', type: 'checkbox', checked: true });
    const read = () => ({ seats: { A: document.getElementById('set-A').value, B: document.getElementById('set-B').value }, seed: Math.max(1, Math.floor(Number(seed.value) || 1)), profileId: profileSel.value });
    const linkOut = h('code', { class: 'launch-link' });
    // a copied link reproduces the whole configuration, the profile included even when it is the
    // default (a bare URL still follows the saved preset; review 08, R8-03)
    const showLink = () => { const c = read(); linkOut.textContent = launchURL({ ...c, fixture: null }); };
    const start = (over = {}) => {
      const c = { ...read(), ...over };
      if (remember.checked && !over.seats) savePreset({ a: c.seats.A, b: c.seats.B, seed: c.seed, profile: c.profileId === DEFAULT_PROFILE_ID ? null : c.profileId });
      this.startMatch({ profileId: c.profileId, seats: c.seats, seed: c.seed, watch: !!over.watch, policies: { A: document.getElementById('set-pol-A').value, B: document.getElementById('set-pol-B').value } });
    };
    const policySel = (seat) => h('select', { id: `set-pol-${seat}` }, ...ALLOCATION_POLICIES.map((p) => h('option', { value: p }, { slot_order: 'Slot order (fixture)', center_first: 'Center first (sacrifice the center)', protect_ranged: 'Protect ranged members' }[p])));
    this._overlayDismiss = false;
    this.el.overlay.replaceChildren(h('div', { class: 'card-sheet setup' },
      h('div', { class: 'title-emblems', 'aria-hidden': 'true' }, ...['red', 'purple', 'blue', 'black', 'rainbow', 'white', 'orange', 'yellow', 'green'].map((c) => h('img', { src: emblemURL(c, 18), alt: '' }))),
      h('h1', {}, 'Hapa Versus'),
      h('p', { class: 'lede' }, 'Two armies on a nine-column battlefield. Each Tick the highlighted columns mint public Minor Arcana from the territory you hold: spend a card as Supply to move, burn it for colored Mana, or play its attached ability. Win by moving a party center into the enemy Capital or killing the enemy Commander.'),
      h('div', { class: 'form' },
        h('label', { class: 'wide' }, 'Profile', profileSel),
        h('label', {}, 'Seat A (low rows)', seatSel('A', eff.seats?.A ?? 'human')),
        h('label', {}, 'Seat B (high rows)', seatSel('B', eff.seats?.B ?? 'bot')),
        h('label', {}, 'A standing damage allocation', policySel('A')),
        h('label', {}, 'B standing damage allocation', policySel('B')),
        h('label', {}, 'Seed', seed)),
      h('p', { class: 'dim small' }, 'Allocation applies when your seat assigns damage under the profile (attacker or defender allocation). It is public and recorded in the match manifest.'),
      h('div', { class: 'row' },
        h('button', { class: 'primary', onclick: () => start() }, 'Start match'),
        h('button', { onclick: () => start({ seats: { A: 'bot', B: 'bot' }, watch: true }) }, 'Watch bot vs bot')),
      h('div', { class: 'dev-preset' },
        h('label', { class: 'inline' }, remember, ' Remember these seats, seed and profile as my development preset'),
        h('div', { class: 'small' }, h('b', {}, 'Launch link: '), linkOut, ' ', h('button', { class: 'linkish', onclick: () => navigator.clipboard?.writeText(linkOut.textContent).then(() => this.notice?.('Launch link copied')) }, 'Copy')),
        h('div', { class: 'dim small' }, `URL values override the saved preset; the built-in default is A ${CONTROLLER_NAME.human} / B ${CONTROLLER_NAME.bot}, seed 1. `, h('button', { class: 'linkish', onclick: () => { clearPreset(); this.effective = null; this.launch = null; this.showSetup(); } }, 'Reset preset'))),
      h('div', { class: 'row' }, h('button', { onclick: () => openLab(this) }, 'Rules & experiments…'), h('span', { class: 'dim small' }, 'Edit a copy of a profile, compare profiles, run bot batches.')),
      h('div', { class: 'row' }, h('button', { onclick: () => openEditor(this) }, 'Cards & decks…'), h('span', { class: 'dim small' }, 'Edit Cards, bind them to columns for either seat, exchange bundles.')),
      h('details', {}, h('summary', {}, 'Diagnostic fixtures (labeled, not ordinary play)'),
        ...Object.entries(UI_FIXTURES).map(([id, f]) => h('div', { class: 'row fixture' },
          h('button', { onclick: () => this.startMatch({ fixture: id, seats: { A: 'human', B: 'human' } }) }, f.title),
          h('span', { class: 'dim small' }, f.description)))),
      h('details', {}, h('summary', {}, 'Controls'), h('div', { class: 'keys' },
        ...[['Left click', 'select a party, member, territory or card'], ['Right click', 'set the selected party\'s one destination (again on a Knight\'s destination: flip its L)'], ['Shift + right click', 'a Knight\'s destination: change the facing it arrives with'], ['1–9', 'select your hand slot (home column order)'], ['U / B / C', 'Supply, Burn or Ability with the selected card'], ['M', 'show legal destinations of the selected party'], ['G', 'Face menu: turn the selected formation N / E / S / W'], ['L / O', 'Knight: flip the L path / change its arrival facing'], ['P / H', 'this Tick\'s orders / Tick history'], ['Ctrl/⌘ + Enter', 'Ready (commit your plan for this Tick)'], ['Esc', 'cancel the current tool'], ['Left-drag', 'pan the board'], ['Right-drag', 'orbit and tilt'], ['Wheel / pinch', 'zoom toward the cursor'], ['Shift + wheel', 'tilt'], ['W A S D / arrows', 'pan'], ['Q / E', 'rotate the camera 45°'], ['Z / X', 'tilt'], ['V', 'tactical view'], ['Home', 'home view'], ['F', 'focus the selection'], ['Space', 'pause playback']].map(([k, v]) => h('div', {}, h('kbd', {}, k), ' ', v)))),
    ));
    this.el.overlay.hidden = false;
    showLink();
    for (const id of ['set-A', 'set-B', 'set-seed', 'set-profile']) document.getElementById(id)?.addEventListener('input', showLink);
  }

  async startMatch({ profileId = DEFAULT_PROFILE_ID, profile: profileObj = null, seats = { A: 'human', B: 'bot' }, seed = 1, watch = false, policies = { A: 'slot_order', B: 'slot_order' }, fixture = null }) {
    // the new match owns everything from here: the previous match's pending response, playback and
    // continuation are detached so a late answer cannot write into this session (review 03, R3-02)
    const gen = this.generation = (this.generation ?? 0) + 1;
    this._detachMatch();
    this._closeSheet({ restore: false });
    this.inspect.reset();
    this.view?.sites.clearEffects();
    await loadCharacterKit(); // crowns, helmets and the guard preset are kit parts
    await loadRenditions(); // optional local card faces; placeholders otherwise
    if (gen !== this.generation) return; // a newer New match replaced this one while loading
    const fx = fixture ? UI_FIXTURES[fixture] : null;
    if (fx) {
      // a labeled diagnostic fixture: its state is prepared directly, not reached by ordinary play
      this.session = createFixtureSession(fx.build(), { id: fixture, title: fx.title });
    } else {
      const profile = profileObj ? JSON.parse(JSON.stringify(profileObj)) : anyProfile(profileId) ?? profileById(DEFAULT_PROFILE_ID);
      profileId = profile.id;
      this.session = createSession({
        matchId: `local-${profileId}-${seed}-${Date.now().toString(36)}`, profile, catalog: localCatalog(), decks: localDecks(profile), seed, allocationPolicies: policies,
        controllers: { A: { type: seats.A, revision: seats.A === 'bot' ? 'heuristic-bot/0.2.0' : 'ui/0.2.0' }, B: { type: seats.B, revision: seats.B === 'bot' ? 'heuristic-bot/0.2.0' : 'ui/0.2.0' } },
      });
    }
    this.ctx = this.session.ctx;
    activeCatalog = this.ctx.catalog;
    this.seats = seats;
    this.watch = watch || (seats.A === 'bot' && seats.B === 'bot');
    this.auto = this.watch ? { mode: 'run' } : null;
    this.effective = { seats: { ...seats }, seed, profileId: fixture ? null : profileId, fixture };
    this.bots = {};
    for (const s of ['A', 'B']) if (seats[s] === 'bot') this.bots[s] = new HeuristicBot({ seat: s, seed: seed * 2 + (s === 'A' ? 1 : 2) });
    this.viewSeat = seats.A === 'human' ? 'A' : seats.B === 'human' ? 'B' : 'A';
    this._initEngine();
    if (this.view) { this.engine.scene.remove(this.view.root); }
    this.view = new BoardView(this.engine.scene, this.ctx);
    // decorative diorama around the field (outside the playable rectangle and its banks)
    this.scenery = null;
    const v = this.view, Sx = 1.5;
    buildScenery(v.root, { x0: -6 * Sx, x1: (v.w + 6) * Sx, z0: -(v.h + 12) * Sx, z1: 12 * Sx }).then((sc) => { if (this.view === v) this.scenery = sc; }).catch((err) => console.warn('[versus] scenery unavailable', err));
    this.cam?.dispose();
    this.cam = new BoardCamera(this.engine.camera, this.el.world, { center: this.view.center, size: this.view.size, subject: this.view.subject });
    this.cam.groundAt = (cx, cy) => this._groundAt(cx, cy);
    // a deliberate zoom-in over a party makes it the close-inspection subject (HF2-03); an explicit
    // Focus keeps priority, and command selection never changes
    this.cam.onWheelZoom = (f, cx, cy) => {
      if (f >= 1 || this.tool || this.inspectParty?.via === 'focus') return;
      const p = this._partyAtClient(cx, cy);
      if (p) this.inspectParty = { partyId: p.id, via: 'zoom', since: performance.now() };
    };
    this.cam.setHome(this.viewSeat);
    this._renderCamPad();
    this.selected = null;
    this.pinned = null;
    this.inspectParty = null;
    this._returnPose = null;
    this.expandedMember = null;
    this.expandedPin = null;
    this.labels.clear();
    this.view?.diorama.clear();
    this.inspect.reset();
    this.ordersOpen = false;
    this._staleKey = null;
    this._shownEvents = new Set();
    this.tool = null;
    this.lastEvents = [];
    this.inspectEvent = null;
    this.playback = null;
    this.resolving = false;
    this.view.sync(this.state);
    this._newTick();
  }

  get state() { return this.session.state; }

  // --- the Tick cycle ----------------------------------------------------------------------------
  _newTick() {
    if (this.state.outcome) return this._showResult();
    const minted = openTick(this.session);
    this.tickEvents = [...minted];
    for (const e of minted) this._fireEffect(e);
    if (!this.watch && minted.some((e) => e.type === 'card_minted')) this.sound?.play('chime', { volume: 0.35 });
    this.plans = { A: [], B: [] };
    this.rev = { A: 0, B: 0 };
    this.ready = { A: null, B: null };
    // one agreement per Tick, the same object the peer path uses (addendum 03, HF3-02): the
    // profile's policy decides whether Ready commits the own plan or acknowledges the pair
    this.agreement = new PhaseAgreement({ matchId: this.session.manifest.matchId, count: this.state.tick, phaseId: 'plan', priorStateHash: stateFingerprint(this.state), policy: agreementPolicy(this.ctx.profile) });
    this._seq = { A: 0, B: 0 };
    this._resolvedTick = null;
    this._draft = { A: { burns: new Map(), pays: new Map() }, B: { burns: new Map(), pays: new Map() } };
    for (const s of ['A', 'B']) if (this.bots[s]) { this.plans[s] = this.bots[s].plan(this.state, this.ctx); this.rev[s] = 1; this._publish(s, 'plan'); this._syncDraftMana(s); }
    for (const s of ['A', 'B']) if (this.bots[s]) { this._publish(s, 'ready'); this.ready[s] = {}; }
    this.view.setActiveColumns(this.state.activeColumns);
    this.view.sync(this.state);
    this.view.syncBanks(this.state, drawCardCanvas);
    this._renderAll();
    if (this._pendingNotice) { const m = this._pendingNotice; this._pendingNotice = null; setTimeout(() => this._toast(m, true), 50); }
    if (this.watch) this._scheduleAuto();
  }

  /**
   * Both-bot development runs (addendum 03, HF3-04): the between-Tick scheduler obeys
   * Pause / Step / Stop. A Tick that is already resolving finishes atomically; the next one starts
   * only when running (or once for Step). New match clears the timer and the generation check
   * drops any callback that was already queued.
   */
  _scheduleAuto() {
    clearTimeout(this._autoTimer);
    this._autoTimer = null;
    const a = this.auto;
    if (!this.watch || !a || this.state.outcome) return;
    if (a.mode === 'step') { a.mode = 'pause'; this._renderMatchBar(); }
    if (a.mode !== 'run') return;
    const gen = this.generation;
    this._autoTimer = setTimeout(() => { this._autoTimer = null; if (gen === this.generation && this.auto?.mode === 'run') this._tryResolve(); }, 350 / this.speed);
  }

  _autoControl(cmd) {
    if (!this.watch || !this.auto || this.auto.mode === 'stop') return;
    if (cmd === 'pause') { this.auto.mode = 'pause'; clearTimeout(this._autoTimer); this._autoTimer = null; }
    else if (cmd === 'resume') { this.auto.mode = 'run'; if (!this.resolving && !this.playback) this._scheduleAuto(); }
    else if (cmd === 'step') { if (this.resolving || this.playback) return; this.auto.mode = 'step'; this._tryResolve(); }
    else if (cmd === 'stop') { this.auto.mode = 'stop'; clearTimeout(this._autoTimer); this._autoTimer = null; }
    this._renderMatchBar();
  }

  /**
   * Current-Tick Mana feedback (addendum 03, HF3-06): the plan's ordered projection names every
   * burn and payment it makes now. A burn that newly appears flies into the Fire Pit and its colors
   * stream into the basin at once; a newly reserved ability cost leaves the basin. Undoing a burn
   * drops it from the draft (its count falls immediately). Accepted events later reconcile with this
   * record (`_fireEffect`), so nothing is minted or animated twice. Presentation only.
   */
  _syncDraftMana(seat) {
    const d = this._draft?.[seat];
    if (!d || this.playback || this.resolving) return;
    const ev = projectPlan(this.state, this.ctx, seat, this.plans[seat]).events;
    const burns = new Map(ev.filter((e) => e.type === 'card_burned').map((e) => [e.cardId, e.mana]));
    const pays = new Map(ev.filter((e) => e.type === 'mana_paid').map((e) => [e.cardId, e.assigned]));
    let gained = false;
    for (const [id, mana] of burns) if (!d.burns.has(id)) {
      const c = this.state.cards[id];
      this.view.sites.burn(seat, c ? drawCardCanvas(c, this.state, 120, 160) : null, mana);
      if (Object.values(mana ?? {}).some((n) => n > 0)) gained = true;
    }
    for (const [id, assigned] of pays) if (!d.pays.has(id)) this.view.sites.pay(seat, assigned);
    d.burns = burns; d.pays = pays;
    if (gained) { this._basinFlash = { seat, at: performance.now() }; if (!this.watch) this.sound?.play('chime', { volume: 0.3 }); }
  }

  /**
   * Mana a seat can spend now: during planning its plan's ordered projection (burns credited,
   * queued costs reserved); while a Tick resolves, the actual pool (already holding accepted burns).
   */
  _availablePool(seat) {
    return this.resolving || this.playback || this.pendingChoice ? { ...this.state.players[seat].pool } : this._plannedPool(seat);
  }

  /** Feed one local plan or Ready record to this Tick's agreement (unsigned: same process). */
  _publish(seat, type) {
    const ag = this.agreement;
    if (!ag) return { ok: false };
    const payload = type === 'plan' ? { planRevision: this.rev[seat], commands: this.plans[seat] } : ag.readyPayload(seat);
    return ag.receive(seat, { schemaVersion: 1, type, matchId: ag.matchId, authorId: seat, signingKeyId: 'local', authorSequence: ++this._seq[seat], count: ag.count, phaseId: ag.phaseId, priorStateHash: ag.priorStateHash, payload });
  }

  /**
   * What the local interface allows a seat now: one reading of the agreement state shared by every
   * button, shortcut, drag and plan edit (Master Requirements v3 ch.16 "Ready names … the exact pair";
   * Design Companion "Public planning Ready and response choices").
   *  - frozen: the seat pressed Ready this phase, so its own plan can no longer change;
   *  - stale: its acknowledgment names an older pair (the opponent revised) — it must acknowledge again;
   *  - busy: a resolution, its playback or a response window is in progress, or the match is over.
   */
  _can(seat = this.viewSeat) {
    const human = this.seats?.[seat] === 'human';
    const busy = !!(this.resolving || this.playback || this.pendingChoice || this.state?.outcome);
    const frozen = !!this.agreement?.ready?.[seat];
    const current = this._readyValid(seat);
    // an invalid draft order (e.g. a destination whose funding Card was removed) blocks the first
    // Ready until it is repaired or removed — the plan is never silently shortened (addendum §6)
    const invalid = !frozen && human && !busy ? this._planErrors(seat).length : 0;
    return { human, busy, frozen, current, invalid, stale: frozen && !current, edit: human && !busy && !frozen, ready: human && !busy && !current && !invalid };
  }

  /** The seat's plan errors, cached per plan revision. */
  _planErrors(seat) {
    const key = `${this.generation}:${this.state.tick}:${seat}:${this.rev?.[seat]}`;
    if (this._errCache?.[seat]?.key !== key) (this._errCache ??= {})[seat] = { key, errors: validatePlan(this.state, this.ctx, seat, this.plans[seat] ?? []).errors };
    return this._errCache[seat].errors;
  }

  /** Why a seat's plan cannot change now (for the toast), or null. */
  _editRefusal(seat) {
    const c = this._can(seat);
    if (c.edit) return null;
    if (!c.human) return `${seat} is not a human seat`;
    if (this.pendingChoice) return 'A response window is open: plans cannot change until it closes';
    if (this.resolving || this.playback) return 'The Tick is resolving: plans reopen at the next Tick';
    if (this.state.outcome) return 'The match is over';
    return c.stale
      ? `Your plan is frozen after Ready. Review ${other(seat)}'s changes, then Acknowledge updated plan (legacy pair-acknowledgment profile)`
      : 'Your plan is committed for this Tick (Ready commits it once; there is no Unready)';
  }

  /** Change a seat's public plan: a new revision; any Ready of the old pair becomes stale. */
  _setPlan(seat, cmds) {
    const refusal = this.bots[seat] ? null : this._editRefusal(seat);
    if (refusal) { this._toast(refusal, true); this._renderAll(); return false; }
    const prev = this.plans[seat];
    this.plans[seat] = cmds;
    this.rev[seat] += 1;
    if (!this._publish(seat, 'plan').ok) { this.plans[seat] = prev; this.rev[seat] -= 1; this._toast('That plan revision was refused', true); this._renderAll(); return false; }
    this._syncDraftMana(seat);
    // the legacy pair-acknowledgment profile: bots re-acknowledge the new pair (own-plan Ready needs nothing)
    if (this.agreement.policy === 'pair_acknowledgment_v3') for (const s of ['A', 'B']) if (this.bots[s] && s !== seat) this._publish(s, 'ready');
    this._renderAll();
    return true;
  }

  _addCommand(seat, cmd) {
    const refusal = this._editRefusal(seat);
    if (refusal) { this._toast(refusal, true); return false; }
    let plan = [...this.plans[seat]];
    if (cmd.type === 'set_destination' || cmd.type === 'change_formation' || cmd.type === 'retreat') plan = plan.filter((c) => !(c.type === cmd.type && c.partyId === cmd.partyId));
    plan.push(cmd);
    const v = validatePlan(this.state, this.ctx, seat, plan);
    const err = v.errors.find((e) => e.index === plan.length - 1);
    if (err) { this._toast(`Not added: ${err.error}`, true); return false; }
    return this._setPlan(seat, plan);
  }

  _readyValid(seat) { return !!this.agreement?.current(seat); }

  /**
   * Ready (first press) freezes the viewing seat's plan and acknowledges the current pair; after the
   * opponent revises, the same action acknowledges the updated pair. Refused while busy (resolving,
   * playback, a response window) or when this seat's acknowledgment is already current.
   */
  _pressReady() {
    if (!this.session) return;
    const seat = this.viewSeat;
    if (this._can(seat).invalid) { const e = this._planErrors(seat)[0]; this._toast(`Ready is blocked: order ${e.index + 1} (${describeCmd(this.state, this.plans[seat][e.index])}) — ${e.error}`, true); this._toggleOrders(true); return; }
    if (!this._can(seat).ready) return; // duplicate clicks, a held key or a stale callback: no second effect
    const r = this._publish(seat, 'ready');
    if (!r.ok) { this._renderAll(); return; }
    this.sound?.play('confirm', { volume: 0.6 });
    // remember both plans as seen (the legacy profile marks what the opponent changed afterwards)
    this.ready[seat] = { seen: { A: this.plans.A.map(cmdKey), B: this.plans.B.map(cmdKey) } };
    this._renderAll();
    const opp = other(seat);
    if (this.seats.A === 'human' && this.seats.B === 'human' && !this._readyValid(opp)) {
      this.viewSeat = opp;
      this._toast(this.agreement.ready[opp]
        ? `${seat} changed its plan after ${opp}'s Ready. ${opp}: your plan is frozen — Acknowledge the updated pair (legacy profile).`
        : `${seat} committed its plan. ${opp} plans now (hotseat).`);
      this._renderAll();
      return;
    }
    this._tryResolve();
  }

  /** Resolve once both acknowledgments name the current pair; a latch makes it single-entry. */
  async _tryResolve() {
    if (this.resolving || this._resolvedTick === this.state.tick) return; // one resolution per Tick
    if (!this.agreement?.locked) return this._renderAll();
    const gen = this.generation;
    this._resolvedTick = this.state.tick;
    this.resolving = true;
    let done = false;
    try { done = await this._resolveAgreed(); } finally { if (gen === this.generation) this.resolving = false; }
    if (!done || gen !== this.generation) return; // detached by New match: the old Tick never continues
    if (this.state.outcome) this._showResult();
    else this._newTick();
  }

  /**
   * Resolve the agreed pair. Returns false when a New match detached this resolution: every await
   * re-checks that the match that started it still owns the app, and the captured session is the
   * only one written to.
   */
  async _resolveAgreed() {
    const { state, ctx, session } = this;
    const owner = this.generation;
    const before = clone(state);
    const accepted = {};
    // the exact locked pair, not whatever the drafts hold now
    for (const s of ['A', 'B']) accepted[s] = validatePlan(state, ctx, s, this.agreement.locked[s]).accepted;
    // trace member positions during simulation (presentation only)
    const frames = [];
    const snap = (q, evLen) => frames.push({ q, pos: snapshot(state), evLen });
    let lastQ = -1;
    ctx.trace = (s, q, events) => { if (q - lastQ >= 20 || events.length !== frames.at(-1)?.evLen) { snap(q, events.length); lastQ = q; } };
    // the state right after each event, so inspection during playback reads one moment (R6-03)
    const moments = [];
    ctx.observeEvents = (s) => moments.push(momentSlice(s));
    const gen = resolveTick(state, ctx, accepted);
    const answers = [];
    let step = gen.next();
    while (!step.done) {
      const req = step.value;
      let answer;
      if (this.bots[req.seat]) answer = this.bots[req.seat].choose(req, state, ctx);
      else answer = await this._askResponse(req);
      if (owner !== this.generation) return false;
      answers.push(answer ?? { pass: true });
      step = gen.next(answer ?? { pass: true });
    }
    ctx.trace = null;
    ctx.observeEvents = null;
    const events = step.value;
    session.events.push(...events);
    session.replay.ticks.push({ tick: state.tick, plans: clone(accepted), choices: answers, fingerprint: stateFingerprint(state) });
    this.tickEvents.push(...events);
    this.lastEvents = this.tickEvents;
    await this._play(before, frames, events, moments);
    return owner === this.generation;
  }

  /** Release the current match's unfinished work (pending choice, playback) without continuing it. */
  _detachMatch() {
    clearTimeout(this._autoTimer);
    this._autoTimer = null;
    const pc = this.pendingChoice, pb = this.playback;
    this.pendingChoice = null;
    this.playback = null;
    this.resolving = false;
    pc?.resolve({ pass: true, detached: true });
    pb?.resolve();
  }

  /** Play back a resolved Tick: members follow the traced trajectories; casualties fall at their event. */
  _play(before, frames, events, moments = []) {
    const startPos = snapshot(before);
    const all = timeline(startPos, frames, events.length, eventsBeforeMovement(events));
    const duration = (this.watch ? 0.9 : 1.4) / this.speed;
    const moving = new Set();
    for (const m of Object.values(this.state.members)) { const a = startPos[m.id], b = [m.x, m.y]; if (a && (a[0] !== b[0] || a[1] !== b[1])) moving.add(m.id); }
    this.view.setWalking(moving);
    for (const t of this.view.supplyTokens?.values() ?? []) t.visible = false; // they return at their new places after playback
    this.view.syncPlanLinks(this.state, []); // the planned relationship ends where the resolved landing begins
    return new Promise((resolve) => {
      this.playback = { t: 0, duration, all, events, resolve, shown: 0, paused: false, before, moments };
      this._renderReadyButton();
      this._renderBasins(); // offerings leave the pit; counters show the accepted pool at once
    });
  }

  /**
   * Fire Pit / basin cosmetics for an accepted event (addendum 01 §7): once per event id and match;
   * they never change a counter (counters render from state).
   */
  _fireEffect(e) {
    if (!['card_burned', 'mana_paid', 'mana_expired'].includes(e.type)) return false;
    const key = `${this.generation}:${e.id}`;
    if (this._shownEvents?.has(key)) return true;
    (this._shownEvents ??= new Set()).add(key);
    const sites = this.view.sites;
    // a burn or payment the player already saw when it was planned is reconciled, not shown twice
    const d = this._draft?.[e.seat];
    if (e.type === 'card_burned' && d?.burns.has(e.cardId)) { d.burns.delete(e.cardId); return true; }
    if (e.type === 'mana_paid' && d?.pays.has(e.cardId)) { d.pays.delete(e.cardId); return true; }
    if (e.type === 'card_burned') { const c = this.state.cards[e.cardId]; sites.burn(e.seat, c ? drawCardCanvas(c, this.state, 120, 160) : null, e.mana); }
    else if (e.type === 'mana_paid') sites.pay(e.seat, e.assigned);
    else sites.expire(e.seat);
    return true;
  }

  /** Hit marks for newly reached exchange and Card-damage events (at most 48 per batch). */
  _spawnHits(events) {
    const posOf = (id) => this.view.sprites.get(id)?.position ?? null;
    const colorOfMember = (id) => activeCatalog.archetypes[this.state.members[id]?.archetype]?.color ?? null;
    let n = 0;
    for (const e of events) {
      if (this._fireEffect(e)) continue;
      if (e.type === 'supply_loaded') { // the planned Supply actually lands
        const mk = this.view.markers.get(e.partyId);
        if (mk) this.view.fx.supply(mk.position.clone(), `+${pts(e.units)} landed · Supply ${pts(e.total)}`);
        continue;
      }
      const hits = e.type === 'exchange' ? e.hits : e.type === 'card_damage' ? [e] : [];
      const totals = new Map();
      for (const hit of hits) { const t = totals.get(hit.recipient) ?? { damage: 0, hits: 0, seen: 0 }; t.damage += hit.damage; t.hits++; totals.set(hit.recipient, t); }
      for (const hit of hits) {
        if (n++ >= 48) return;
        const to = posOf(hit.recipient);
        if (!to) continue;
        const from = hit.kind === 'card' ? null : posOf(hit.source);
        const color = hit.kind === 'card' ? activeCatalog.cards[this.state.cards[hit.cardId]?.abilityId]?.color : colorOfMember(hit.source);
        const t = totals.get(hit.recipient);
        this.view.fx.hit(hit, from, to, color, this.ctx.U, { index: t.seen, total: t.seen === 0 ? t : null });
        t.seen++;
      }
    }
  }

  _stepPlayback(dt) {
    const pb = this.playback;
    if (!pb || pb.paused) return;
    pb.t += dt;
    const k = Math.min(1, pb.t / pb.duration);
    // one pose for the moment; BoardView.sync alone decides what is visible from it (R2-01)
    const { pos, evLen } = poseAt(pb.all, k * 1000, bandY);
    this.view.sync(this.state, k >= 1 ? null : pos);
    if (evLen > pb.shown) { const fresh = pb.events.slice(pb.shown, evLen); this._spawnHits(fresh); this.sound?.events(fresh); pb.shown = evLen; this._renderEvents(); }
    if (k >= 1) {
      this.playback = null;
      this.view.setWalking(new Set());
      this.view.sync(this.state);
      this.view.syncBanks(this.state, drawCardCanvas);
      pb.resolve();
    }
  }

  _askResponse(req) {
    return new Promise((resolve) => {
      this.pendingChoice = { req, resolve };
      this.viewSeat = req.seat;
      this.selected = { kind: 'choice' };
      // the decision takes the keyboard: its first available choice (a response, else Pass)
      this._focusAfter = () => this.el.decision.querySelector('.response button:not(:disabled)');
      this._renderAll();
    });
  }

  // --- input -------------------------------------------------------------------------------------
  _bindKeys() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      // an open sheet (menu, confirmation, setup, result) owns the keyboard: no order or Ready behind it
      if (!this.el.overlay.hidden) { if (e.code === 'Escape' && this._overlayDismiss) { e.preventDefault(); this._closeSheet(); } return; }
      this.keys.add(e.code);
      if (!this.session) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (!e.repeat) this._pressReady(); return; }
      if (e.code === 'Escape' && this.labels.hideTip()) return; // a symbol's definition first
      if (e.code === 'Escape' && this.el.pickList) { this._closePickList(); return; }
      if (e.code === 'Escape' && document.body.classList.contains('roster-open')) { this._toggleRoster(false); return; }
      if (e.code === 'Escape' && this.inspect.dismissTop()) return; // the top contextual view first
      if (e.code === 'Escape' && this.ordersOpen) { this._toggleOrders(false); return; }
      if (e.code === 'Escape' && this.tool) { this.tool = null; this._renderAll(); return; } // tool cancel, orders kept
      if (e.code === 'Escape' && this.inspectParty && this.expandedPin) { const m = this.expandedPin, inBar = document.activeElement?.closest?.('.inspect-bar'); this.expandedPin = null; this._renderInspectBar(); if (inBar) this.el.inspectBar?.querySelector(`[data-member="${CSS.escape(m)}"]`)?.focus({ preventScroll: true }); return; } // the explanation first
      if (e.code === 'Escape' && this.inspectParty) { const back = document.activeElement?.closest?.('.inspect-bar'); this.inspectParty = null; this.expandedMember = null; this._renderInspectBar(); if (back) this._inspectorEl()?.querySelector?.('summary:not(.off), button')?.focus({ preventScroll: true }); return; } // labels off, camera stays
      if (e.code === 'Escape') { if (this.tool) { this.tool = null; this._renderAll(); } else { this.selected = null; this.view?.select(this.state, null); this._renderAll(); } return; }
      if (k === 'q') this.cam.rotate(45);
      else if (k === 'e') this.cam.rotate(-45);
      else if (k === 'z') this.cam.tilt(15);
      else if (k === 'x') this.cam.tilt(-15);
      else if (k === 'v') this.cam.toggleTactical();
      else if (e.code === 'Home') this._goHome();
      else if (k === 'f') { const id = this._inspectCandidate(); if (id) this._focusInspect(id); else this._focusSelection(); }
      else if (k === 'r') this._returnCamera();
      else if (e.code === 'Space' && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); if (this.playback) this.playback.paused = !this.playback.paused; }
      else if (/^[1-9]$/.test(e.key)) this._selectHandSlot(Number(e.key));
      else if (k === 'u') this._cardTool('supply');
      else if (k === 'b') this._cardTool('burn');
      else if (k === 'c') this._cardTool('ability');
      else if (k === 'm') this._showDestinations();
      else if (k === 'l') this._flipL(this.selected?.kind === 'party' ? this.state.parties[this.selected.id] : null);
      else if (k === 'o') this._cycleFace(this.selected?.kind === 'party' ? this.state.parties[this.selected.id] : null);
      else if (k === 'g') { if (this.selected?.kind === 'party') { this._cmdOpen = 'face'; this._renderCommandBar(); this.el.cmdbar?.querySelector('details.cmd-menu[open] .cmd-pop button:not([disabled])')?.focus(); } else this._toast('Select one of your formations first, then G (or Face ▾) to change its facing'); }
      else if (k === 'p') this._toggleOrders(this.ordersOpen && this.ordersTab !== 'history' ? false : true, 'plan');
      else if (k === 'h') this._toggleOrders(this.ordersOpen && this.ordersTab === 'history' ? false : true, 'history');
      else if (k === 'n') this._toggleRoster();
      else if (['[', ']'].includes(e.key) || ['BracketLeft', 'BracketRight'].includes(e.code)) { const b = this.view.stepLayer(e.key === ']' || e.code === 'BracketRight' ? 1 : -1); this.view.sync(this.state); this._toast(b === null ? 'All layers (surface opaque)' : `Layer ${b > 0 ? '+' : ''}${b}${b < 1 ? ' — cutaway: the surface is see-through' : ''}`); this._renderAll(); }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  _rayFrom(e) {
    const rect = this.engine.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.engine.camera);
    return this.view.pick(this.raycaster, this.state);
  }

  /** The ground point (y = 0) under a screen position, for zooming toward the cursor. */
  /** The single party under a client point (stacked candidates are not guessed), or null. */
  _partyAtClient(cx, cy) {
    const pick = this._rayFrom({ clientX: cx, clientY: cy });
    return pick?.candidates?.length === 1 ? pick.candidates[0].party : pick?.party ?? null;
  }

  _groundAt(cx, cy) {
    // over a party, zoom toward its real center (at any height), not the ground plane under it
    const p = this._partyAtClient(cx, cy);
    if (p) return this.view.toWorld(p.x, p.y).setY(this.view.partyY(p));
    const rect = this.engine.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.engine.camera);
    const hit = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit) ? hit : null;
  }

  /** On-screen camera pad: hold to pan, tilt or zoom; click to turn 45°, go home or toggle tactical. */
  _renderCamPad() {
    const cam = this.cam;
    const hold = (fn) => ({
      onpointerdown: (e) => { e.preventDefault(); e.stopPropagation(); cam.held = fn; },
      onpointerup: () => { cam.held = null; }, onpointerleave: () => { cam.held = null; }, onpointercancel: () => { cam.held = null; },
    });
    const b = (label, title, attrs) => h('button', { class: 'cam-btn', title, 'aria-label': title, ...attrs }, label);
    const pad = h('div', { class: 'cam-pad', role: 'toolbar', 'aria-label': 'Camera' },
      h('div', { class: 'cam-grid' },
        b('⟲', 'Turn left 45° (Q)', { onclick: () => cam.rotate(45) }),
        b('▲', 'Pan forward (W / ↑ / left-drag)', hold((dt) => cam.pan(0, 620 * dt))),
        b('⟳', 'Turn right 45° (E)', { onclick: () => cam.rotate(-45) }),
        b('◀', 'Pan left (A / ←)', hold((dt) => cam.pan(620 * dt, 0))),
        b('⌂', 'Home view (Home)', { onclick: () => this._goHome() }),
        b('▶', 'Pan right (D / →)', hold((dt) => cam.pan(-620 * dt, 0))),
        b('⤒', 'Tilt up — look more from above (Z)', hold((dt) => cam.tilt(40 * dt))),
        b('▼', 'Pan back (S / ↓)', hold((dt) => cam.pan(0, -620 * dt))),
        b('⤓', 'Tilt down — look more from the side (X)', hold((dt) => cam.tilt(-40 * dt)))),
      h('div', { class: 'cam-col' },
        b('+', 'Zoom in (wheel / pinch)', hold((dt) => cam.zoom(Math.exp(-1.6 * dt)))),
        b('−', 'Zoom out (wheel / pinch)', hold((dt) => cam.zoom(Math.exp(1.6 * dt)))),
        b('V', 'Tactical overhead view (V)', { onclick: () => cam.toggleTactical() })));
    this.el.camPad?.remove();
    this.el.camPad = pad;
    this.el.world.append(pad);
  }

  _onHover(e) {
    if (!this.view) return;
    const p = this._rayFrom(e);
    this.view.hover(p?.territory ?? null);
    this.hoverInfo = p;
    if (this.cardDrag?.active || this.cam?.dragging) return;
    this.expandedMember = this.inspectParty && p?.member && p.member.party === this.inspectParty.partyId ? p.member.id : null;
    // hover inspects; it never selects, orders, moves the camera or takes focus (addendum §3)
    const card = this._cardTileAt(e);
    const site = card ? null : this._siteAt(e);
    const party = p?.candidates?.length === 1 ? p.candidates[0].party : p?.party ?? null;
    // a party at ordinary distance gets a one-line hint, never the full document (HF2-02); the
    // party under close inspection is already annotated on its own members
    const partyHint = party && party.id !== this.inspectParty?.partyId ? { kind: 'hint', id: party.id } : null;
    this.inspect.hover(card ? { kind: 'card', id: card } : site ? { kind: 'basin', id: site.seat } : partyHint);
  }

  /** The Fire Pit or Mana basin under a pointer event, or null. */
  _siteAt(e) {
    const rect = this.engine.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.engine.camera);
    return this.view.sites.pick(this.raycaster);
  }

  /** A subject's world anchor projected into the world element (null when behind the camera). */
  _screenAnchor(sub) {
    const w = this.view?.anchorOf(sub, this.state);
    if (!w) return null;
    const v = w.clone().project(this.engine.camera);
    if (v.z > 1) return null;
    const r = this.el.world.getBoundingClientRect(), c = this.engine.renderer.domElement.getBoundingClientRect();
    return { x: c.left - r.left + ((v.x + 1) / 2) * c.width, y: c.top - r.top + ((1 - v.y) / 2) * c.height };
  }

  /** The bank card tile under a pointer event, or null. */
  _cardTileAt(e) {
    const rect = this.engine.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.engine.camera);
    return this.view.pickCard(this.raycaster);
  }

  /** Supply planned in both public plans, by party (for the on-board tokens). */
  _plannedSupplyMap() {
    const out = {};
    for (const seat of ['A', 'B']) for (const c of this.plans?.[seat] ?? []) if (c.type === 'load_supply') out[c.partyId] = (out[c.partyId] ?? 0) + (this.state.cards[c.cardId]?.supply ?? 0);
    return out;
  }

  _onPointer(e) {
    if (!this.session || e.button === 1) return;
    this._closePickList();
    if (e.button === 0) {
      const id = this._cardTileAt(e);
      if (id) { this.pinned = { kind: 'card', id }; this._renderAll(); return; }
      const site = this._siteAt(e);
      if (site) { this.pinned = { kind: 'basin', id: site.seat }; this._renderAll(); return; }
    }
    const pick = this._rayFrom(e);
    if (!pick) return;
    // several parties under the pointer (stacked heights): the player chooses; never a silent guess
    if (e.button === 0 && pick.candidates.length > 1) return this._showPickList(e, pick, (chosen) => this._onPick(e, chosen));
    this._onPick(e, pick);
  }

  /** Act on a resolved pick (one party or none), for the current tool or plain selection. */
  _onPick(e, pick) {
    const seat = this.viewSeat;
    if (e.button === 2) {
      // right click: one destination for the selected own party (or a retreat target)
      const party = this.selected?.kind === 'party' ? this.state.parties[this.selected.id] : null;
      if (this.tool?.kind === 'ability') { this.tool = null; this._renderAll(); return; }
      if (party && party.owner === seat && pick.territory && this.seats[seat] === 'human') {
        const type = this.tool?.kind === 'retreat' ? 'retreat' : 'set_destination';
        // a Knight: right-clicking the destination it already has flips its L, every time
        const drafted = type === 'set_destination' ? this._draftMove(party) : null;
        const same = drafted && drafted.target.column === pick.territory.column && drafted.target.row === pick.territory.row;
        // a Knight: Shift+right-click on its destination cycles the facing it arrives with
        if (same && e.shiftKey && this._freeKnight(party)) { this._cycleFace(party); this.tool = null; return; }
        if (same && this._fundedTargets(party).find((x) => x.column === drafted.target.column && x.row === drafted.target.row)?.paths?.length > 1) {
          this._flipL(party); this.tool = null; return;
        }
        // the same route, default Knight L and clearance facts as the keyboard list (HF3-01)
        const d = this._fundedTargets(party).find((x) => x.column === pick.territory.column && x.row === pick.territory.row);
        const via = type === 'set_destination' && d?.paths ? d.via : null;
        if (this._addCommand(seat, { type, partyId: party.id, target: pick.territory, ...(via ? { via } : {}) })) {
          const plan = routeFromHere(this.state, this.ctx, party, pick.territory, via);
          if (plan.path) this.view.showRoute(party, plan.path.map((n) => [n.x, n.y]));
          const by = d?.blocked ? this.state.parties[d.clearance.partyId] : null;
          const lnote = via && d.paths.length > 1 ? ` — L via ${d.route.slice(0, 2).map((n) => `R${n.row}C${n.column}`).join(', ')}${d.joins ? ', absorbs your Pawn' : ''}; right-click it again to flip the L` : '';
          this._toast(`${type === 'retreat' ? 'Retreat' : 'Destination'}: R${pick.territory.row}C${pick.territory.column} (planned)${lnote}${by ? ` — warning: your ${partyShort(this.state, by.id)} blocks this route now` : ''}`, !!by);
        }
        this.tool = null;
      }
      return;
    }
    // left click with a tool
    if (this.tool?.kind === 'supply' && pick.party) {
      if (this._addCommand(seat, { type: 'load_supply', cardId: this.tool.cardId, partyId: pick.party.id })) this._toast(`Supply planned for ${partyName(this.state, pick.party.id)}`);
      this.tool = null; this._renderAll(); return;
    }
    if (this.tool?.kind === 'ability') {
      const t = this.tool;
      const def = activeCatalog.cards[this.state.cards[t.cardId].abilityId];
      if (t.step === 'actor' && pick.party && pick.party.owner === seat) {
        t.actorPartyId = pick.party.id;
        const op = def.operations[0]?.type;
        if (op === 'damage') { t.step = 'target'; this._toast('Now click an enemy member in an adjacent territory'); }
        else if (op === 'place_row_enchantment') { t.step = 'row'; this._toast('Now click a territory in an enemy-half Mana row'); }
        else if (op === 'formation_immediate') { t.step = 'facing'; }
        this._renderAll(); return;
      }
      if (t.step === 'target' && pick.member) {
        if (this._addCommand(seat, { type: 'play_ability', cardId: t.cardId, actorPartyId: t.actorPartyId, target: { memberId: pick.member.id }, burns: this._autoBurns(seat, def, t.cardId) })) this._toast(`${def.title} planned`);
        this.tool = null; this._renderAll(); return;
      }
      if (t.step === 'row' && pick.territory) {
        if (this._addCommand(seat, { type: 'play_ability', cardId: t.cardId, actorPartyId: t.actorPartyId, target: { row: pick.territory.row }, burns: this._autoBurns(seat, def, t.cardId) })) this._toast(`${def.title} planned`);
        this.tool = null; this._renderAll(); return;
      }
    }
    // a tap or click on a member of the party being inspected opens its explanation (the touch
    // route to member facts); it never changes the command selection (review 06, R6-01/R6-02)
    if (this.inspectParty && pick.member && pick.member.party === this.inspectParty.partyId && !e.altKey) {
      this.expandedPin = this.expandedPin === pick.member.id ? null : pick.member.id;
      this._renderInspectBar();
      return;
    }
    // plain selection: only a party you can command becomes the command selection; any other party
    // is read (its public summary pinned, F to inspect it) and your selection and orders stay
    if (pick.member && e.altKey) this.selected = { kind: 'member', id: pick.member.id };
    else if (pick.party && !this._commandable(pick.party)) { this.pinned = { kind: 'hint', id: pick.party.id }; }
    else if (pick.party) { this.selected = { kind: 'party', id: pick.party.id }; this._autoLayer(pick.party); }
    else { this.selected = null; if (this.pinned?.kind === 'hint') this.pinned = null; } // empty ground: quiet board
    this._renderAll();
  }

  /**
   * A candidate list where several parties lie under the pointer at different heights (Design
   * Companion: owner, name, territory, band and state; keyboard accessible; picking a covered
   * candidate opens its layer). `then` receives the pick narrowed to the chosen party.
   */
  _showPickList(e, pick, then) {
    this._closePickList();
    const s = this.state;
    const rect = this.el.world.getBoundingClientRect();
    const describe = (c) => {
      const p = c.party, st = standingOf(s, this.ctx, p);
      const where = st.kind === 'flying' ? 'flying' : st.kind === 'tunnel' ? 'roofed tunnel' : st.kind === 'pit' ? 'open pit' : st.kind === 'hilltop' ? 'hilltop' : 'ground';
      return [h('span', { class: `dot ${p.owner.toLowerCase()}` }), h('b', {}, partyName(s, p.id)), h('span', { class: 'dim' }, ` · band ${fmtBand(c.band)} · ${where} · ${p.state}${c.covered ? ' · under a roof' : ''}`)];
    };
    const choose = (c) => { this._closePickList(); then({ ...pick, party: c.party, member: c.member, candidates: [c] }); };
    const list = h('div', { class: 'pick-list', role: 'dialog', 'aria-label': 'Choose what to select' },
      h('div', { class: 'pl-head' }, `${pick.candidates.length} here${pick.territory ? ` · R${pick.territory.row}C${pick.territory.column}` : ''} — choose one`),
      ...pick.candidates.map((c) => h('button', { onclick: (ev) => { ev.stopPropagation(); choose(c); } }, ...describe(c))),
      h('button', { class: 'pl-cancel', onclick: (ev) => { ev.stopPropagation(); this._closePickList(); } }, 'Cancel (Esc)'));
    list.addEventListener('keydown', (ev) => {
      if (ev.code !== 'ArrowDown' && ev.code !== 'ArrowUp') return;
      ev.preventDefault(); ev.stopPropagation();
      const bs = [...list.querySelectorAll('button')], i = bs.indexOf(document.activeElement);
      bs[(i + (ev.code === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length]?.focus();
    });
    list.addEventListener('pointerup', (ev) => ev.stopPropagation());
    list.addEventListener('pointerdown', (ev) => ev.stopPropagation());
    list.style.left = `${Math.min(e.clientX - rect.left + 12, rect.width - 330)}px`;
    list.style.top = `${Math.min(e.clientY - rect.top + 12, rect.height - 60 - 34 * pick.candidates.length)}px`;
    this.el.world.append(list);
    this.el.pickList = list;
    list.querySelector('button')?.focus();
  }

  _closePickList() { this.el.pickList?.remove(); this.el.pickList = null; }

  /** Burn the fewest other cards needed to pay a colored cost (a declared payment, never silent). */
  /** Cards this seat can still burn for a payment: available bank Cards not already used in its plan. */
  _paymentCandidates(seat, sourceId, { planned = true } = {}) {
    const used = planned ? this._plannedCardIds(seat) : new Set();
    return Object.values(this.state.players[seat].bank.minor).filter(Boolean).map((id) => this.state.cards[id])
      .filter((c) => c && c.id !== sourceId && c.state === 'available' && !used.has(c.id));
  }

  /** Burns that pay an ordinary ability on top of the plan so far (the rules' own allocation). */
  _autoBurns(seat, def, sourceId) {
    return quotePayment(this._availablePool(seat), def.cost?.mana ?? {}, this._paymentCandidates(seat, sourceId)).burns;
  }


  /**
   * A card's face band: its local Tarot rendition, bounded and at full strength; without one, an
   * intentional suit fallback. The face is the card's art identity only — the attached ability is
   * named separately (review UX-08).
   */
  _faceBand(card) {
    const art = renditionFor(card);
    return art
      ? h('div', { class: 'face', style: `background-image:url("${art.url}")`, role: 'img', 'aria-label': `Face: ${art.title}` })
      : h('div', { class: `face fallback suit-${card.suit}`, 'aria-hidden': 'true' }, h('span', {}, SUIT[card.suit] ?? '◆'));
  }

  /** Mana chips, at most `max`, then an explicit "+n" so an overflow never reads as zero; "no Mana" when none. */
  _manaCompact(mana, max) {
    const chips = manaChips(mana);
    if (!chips.length) return [h('span', { class: 'nomana' }, 'no Mana')];
    return chips.length > max ? [...chips.slice(0, max), h('span', { class: 'more', title: fmtMana(mana) }, `+${chips.length - max}`)] : chips;
  }

  /** The reserved use of a planned card, in words ("Supply → Knight R1C8", "Burn", "Ember Strike", "pays for …"). */
  _plannedUse(seat, cardId) {
    const c = this.plans[seat].find((x) => x.cardId === cardId);
    if (c?.type === 'load_supply') { const p = this.state.parties[c.partyId]; return `Supply → ${p?.mount ? p.mount[0].toUpperCase() + p.mount.slice(1) : 'Pawn'} R${p?.region.row}C${p?.region.column}`; }
    if (c?.type === 'burn') return 'Burn planned';
    if (c?.type === 'play_ability') return `${activeCatalog.cards[this.state.cards[cardId]?.abilityId]?.title ?? 'Ability'} planned`;
    const payer = this.plans[seat].find((x) => x.burns?.includes(cardId));
    return payer ? `pays ${activeCatalog.cards[this.state.cards[payer.cardId]?.abilityId]?.title ?? 'a Spell'}` : 'planned';
  }

  _plannedCardIds(seat) {
    const s = new Set();
    for (const c of this.plans[seat]) { if (c.cardId) s.add(c.cardId); for (const b of c.burns ?? []) s.add(b); }
    return s;
  }

  /**
   * The seat's Mana pool as its own public plan would leave it (addendum 01 §7): every valid
   * command in declared order — burns, payment burns and exact assigned spends — on a scratch state
   * (match.projectPlan). A projection of this plan only, not a promise about the opponent or
   * responses. Cached per plan revision.
   */
  _plannedPool(seat) {
    const key = `${this.generation}:${this.state.tick}:${seat}:${this.rev?.[seat]}:${JSON.stringify(this.state.players[seat].pool)}`;
    if (this._poolCache?.[seat]?.key !== key) (this._poolCache ??= {})[seat] = { key, pool: { ...projectPlan(this.state, this.ctx, seat, this.plans?.[seat] ?? []).state.players[seat].pool } };
    return { ...this._poolCache[seat].pool };
  }

  _selectHandSlot(localCol) {
    const seat = this.viewSeat;
    const col = this.ctx.geo.toGlobal(seat, localCol, 1).column;
    const id = this.state.players[seat].bank.minor[String(col)];
    if (!id) return this._toast(`Your C${localCol} slot is empty`);
    this.pinned = { kind: 'card', id };
    this._renderAll();
  }

  _cardTool(kind) {
    if (this.pinned?.kind !== 'card') return this._toast('Inspect one of your Cards first (hover it, or 1–9)');
    const card = this.state.cards[this.pinned.id];
    if (card.owner !== this.viewSeat) return this._toast('That card belongs to the opponent');
    const refusal = this._editRefusal(card.owner);
    if (refusal) return this._toast(refusal, true);
    if (kind === 'burn') { if (this._addCommand(this.viewSeat, { type: 'burn', cardId: card.id })) this._toast(Object.keys(card.mana ?? {}).length ? `Burned: +${fmtMana(card.mana)} available this Tick` : '0 Mana — the Card is consumed'); return; }
    if (kind === 'supply') { this.tool = { kind: 'supply', cardId: card.id }; }
    if (kind === 'ability') {
      const def = activeCatalog.cards[card.abilityId];
      if (!def || def.category === 'resource') return this._toast('No attached ability');
      if (def.timing === 'response') return this._toast(`${def.title} is a response: it is offered when the opponent announces a Spell`);
      this.tool = { kind: 'ability', cardId: card.id, step: 'actor' };
      this._toast(`${def.title}: click a friendly party in an active column as the source`);
    }
    this._renderAll();
  }

  _showDestinations() {
    const party = this.selected?.kind === 'party' ? this.state.parties[this.selected.id] : null;
    if (party) this.view.select(this.state, party, this._fundedTargets(party).filter((d) => d.funded));
  }

  /** The layer rail (Design Companion: six bands split at Ground 0; All is a view preset). */
  _renderLayers() {
    const s = this.state, cut = this.view.terrain.cutaway;
    const count = (b) => Object.values(s.parties).filter((p) => p.alive && !p.retired && (p.band ?? 1) === b).length;
    const btn = (b) => h('button', { class: `band${cut === b ? ' on' : ''}`, 'aria-pressed': String(cut === b), title: b === null ? 'All layers' : `Show band ${fmtBand(b)} (${count(b)} parties)${b < 1 ? ' — the surface becomes see-through' : ''}`, onclick: () => { this.view.setLayer(b); this.view.sync(this.state); this._renderAll(); } },
      b === null ? 'All' : fmtBand(b), b !== null && count(b) ? h('small', {}, ` ${count(b)}`) : null);
    this.el.layers.replaceChildren(btn(3), btn(2), btn(1), h('div', { class: 'ground0' }, 'GROUND 0'), btn(-1), btn(-2), btn(-3), btn(null));
  }

  /** Selecting an underground party opens the cutaway at its band; a surface party restores all layers. */
  _autoLayer(p) {
    const want = p.band < 0 ? p.band : null;
    if (this.view.terrain.cutaway !== want && (want !== null || this.view.terrain.cutaway < 1)) { this.view.setLayer(want); this.view.sync(this.state); }
  }

  /**
   * Frame a party for close inspection (HF2-03): its living members' real bounds at their real
   * height, current yaw kept, enough room for labels; the prior pose is saved for one-step Return.
   * Never changes selection, facing, orders or time.
   */
  _focusInspect(partyId) {
    const p = this.state.parties[partyId];
    if (!p || p.retired) return;
    const pts = Object.values(p.slots).filter(Boolean).map((id) => this.view.sprites.get(id)).filter((sp) => sp?.visible).map((sp) => sp.position);
    const c = this.view.toWorld(p.x, p.y).setY(this.view.partyY(p) + 0.8);
    if (pts.length) { c.x = pts.reduce((n, v) => n + v.x, 0) / pts.length; c.z = pts.reduce((n, v) => n + v.z, 0) / pts.length; }
    // a margin for the labels above the heads; tight enough that a full formation's compact labels
    // fit side by side at 1280×720 (the reading panel and party facts are placed in measured space)
    const r = Math.max(2.2 * 1.5, ...pts.map((v) => Math.hypot(v.x - c.x, v.z - c.z))) + 1.6;
    if (!this._returnPose) this._returnPose = this.cam.savePose();
    if (this.inspectParty?.partyId !== partyId) this.expandedPin = null;
    this.inspectParty = { partyId, via: 'focus', since: performance.now() };
    this._cmdOpen = null;
    this._renderCommandBar();
    this._renderInspectBar();
    // frame it in the space the docked bars leave free (they grow with the text size; R6-01)
    const H = this.el.world.clientHeight || 1;
    const docked = [this.el.cmdbar, this.el.inspectBar].filter((el) => el && !el.hidden).reduce((n, el) => n + el.offsetHeight + 8, 0);
    const free = Math.max(0.4, 1 - Math.min(0.6, docked / H));
    this.cam.frame(c, r, { lift: 1 - free });
  }

  /**
   * Home, from the camera pad or the Home key (review 06, R6-02): the fitted home view, close
   * inspection released and the saved Return pose dropped, so a later Focus starts a fresh
   * Return journey from home. Command selection and orders are kept.
   */
  _goHome() {
    this.cam.home();
    this.inspectParty = null;
    this.expandedMember = null;
    this.expandedPin = null;
    this._returnPose = null;
    this._renderCommandBar();
    this._renderInspectBar();
  }

  /** The party F inspects: a party being read (pinned) first, else the command selection. */
  _inspectCandidate() {
    const pin = this.pinned;
    if (pin && ['hint', 'party'].includes(pin.kind) && this.state.parties[pin.id]?.alive) return pin.id;
    return this.selected?.kind === 'party' ? this.selected.id : this.selected?.kind === 'member' ? this.state.members[this.selected.id]?.party ?? null : null;
  }

  /** Can the viewing seat give this party orders here (own party, human seat)? */
  _commandable(p) { return !!p && p.owner === this.viewSeat && this.seats[p.owner] === 'human' && !this.watch; }

  /** One-step return to the pose before Inspect (HF2-03); releases close inspection. */
  _returnCamera() {
    if (!this._returnPose) return;
    this.cam.restorePose(this._returnPose);
    this._returnPose = null;
    this.inspectParty = null;
    this.expandedMember = null;
    this.expandedPin = null;
    this._renderCommandBar();
    this._renderInspectBar();
  }

  /**
   * The state as of the displayed moment (review 06, R6-03): during playback, the slice recorded
   * right after the last event shown; otherwise the accepted state. Read-only.
   */
  _displayState() {
    const pb = this.playback;
    if (!pb?.before) return this.state;
    const key = `${this.generation}:${this.session.events.length}:${pb.shown}`;
    if (this._momentCache?.key !== key) this._momentCache = { key, state: stateAt(pb.before, pb.moments, pb.shown, this.state) };
    return this._momentCache.state;
  }

  /** Facts for the inspected party at the displayed moment, cached until that moment changes. */
  _labelFacts(partyId) {
    const pb = this.playback, S = this._displayState();
    const key = `${this.generation}:${partyId}:${this.state.tick}:${this.session.events.length}:${pb ? pb.shown : 'final'}:${this.rev?.A}:${this.rev?.B}`;
    if (this._factsCache?.key === key) return this._factsCache.facts;
    const party = partyFacts(S, this.ctx, partyId);
    const members = {};
    for (const id of Object.values(S.parties[partyId]?.slots ?? {})) if (id) { const f = memberFacts(S, this.ctx, id); if (f) { f.sig = JSON.stringify(f); members[id] = f; } }
    // helpers of other parties standing in this formation's strip keep their own identity
    const facts = { party, members, playing: !!pb, state: S };
    this._factsCache = { key, facts };
    return facts;
  }

  /**
   * Context only an open explanation needs (R6-04): the ranged targets the rules would actually
   * consider (engaged parties only) and, in line profiles, the front line a frontal hit reaches.
   * Its JSON is part of the label signature, so any change refreshes the open text.
   */
  _memberContext(S, f) {
    const ranged = f.attacks.find((a) => a.kind === 'ranged');
    const targets = ranged ? rangedTargets(S, this.ctx, f.id, ranged.id) : [];
    const line = f.protectionMode === 'line' ? Object.fromEntries(['physical', 'magic'].map((c) => [c, linePreview(S, this.ctx, f.partyId, c, 'front')])) : null;
    return { targets, line };
  }

  /** Ranged target context per member, once per displayed moment (part of each chip's text). */
  _memberCtxCached(facts, S, f) {
    facts.ctx ??= {};
    if (!(f.id in facts.ctx)) facts.ctx[f.id] = this._memberContext(S, f);
    return facts.ctx[f.id];
  }

  /** The member's symbols and exact values (member-glyphs.js), once per displayed moment. */
  _chipsCached(facts, f, text, mctx) {
    facts.chips ??= {};
    return (facts.chips[f.id] ??= factChips(f, { pts, sources: text.sourceName, line: f.protectionMode === 'line', targets: mctx?.targets }));
  }

  /** Text for one member's label from the shared read model (HF2-05); detail is built on demand. */
  _memberText(f, S, ctx = null) {
    const ch = { physical: 'Phys', magic: 'Mag' }, CH = { physical: 'Physical', magic: 'Magic' };
    const role = f.role === 'center' ? `${f.mount ? cap(f.mount) : 'Center'}${f.conditions.includes('commander') ? ' ★' : ''}` : cap(f.role);
    const hpText = f.health.mode === 'party_pool' ? `pool ${pts(f.health.hp)}/${pts(f.health.max)}` : `${pts(f.health.hp)}/${pts(f.health.max)} HP`;
    const hpPct = f.health.max ? Math.max(0, Math.min(1, f.health.hp / f.health.max)) : null;
    const atk = f.attacks.map((a) => `${a.hits > 1 ? `${a.hits}×` : ''}${a.power} ${ch[a.channel]}${a.range ? ` r${a.range}` : ''}`).join(', ');
    const line = f.protectionMode === 'line';
    // protection grouped by channel and the faces it really covers; "+applied" marks a value that
    // another source (a Card effect, a party ward) raises above the member's own
    const groups = protectionGroups(f);
    const def = groups.map((g) => `${ch[g.channel]} ${g.total} ${g.faces.length === 6 ? 'all sides' : g.faces.length >= 5 ? 'all but ' + FACES_ALL.filter((x) => !g.faces.includes(x)).join('/') : g.faces.join('/')}${g.total !== g.base ? ' (+applied)' : ''}`);
    const combat = `Atk ${atk || '—'} · ${line ? 'Line contribution' : 'Def'} ${def.length ? def.join(' · ') : 'none'}${f.alive ? '' : ' · fallen'}`;
    const name = (src) => { const m = S.members[src.source]; if (src.source === f.id) return src.kind === 'shield' ? 'its own shield' : `its own ${String(src.kind).replace(/_/g, ' ')}`; if (m) return `the party ${cap(m.archetype)} (${String(src.kind).replace(/_/g, ' ')})`; return cardEffectName(src.kind); };
    // the explanation: built only when this member is opened (R6-04), from the same facts and context
    const detail = () => {
      const out = [];
      for (const a of f.attacks) out.push(h('div', {}, `${cap(a.id)}: ${a.hits} × ${a.power} ${CH[a.channel]}${a.kind === 'ranged' ? `, base range ${a.range}${a.elevationAware ? ' (height changes it)' : ''}${a.needsArc ? ', needs open sky' : ''}` : ', melee'}${a.charge ? ', charges' : ''}`));
      if (!groups.length) out.push(h('div', { class: 'dim' }, 'No protection on any face'));
      for (const g of groups) {
        const where = g.faces.length === 6 ? 'on all six faces' : `on the ${listWords(g.faces)}`;
        const from = g.sources.filter((x) => x.amount).map((x) => `${x.amount} from ${name(x)}`);
        out.push(h('div', {}, `${CH[g.channel]} ${line ? 'contribution' : 'protection'} ${g.total} ${where}${from.length ? `: ${from.join(' + ')}` : ''}${g.total !== g.base ? ` (base ${g.base}, applied ${g.total})` : ''}`));
      }
      if (line && ctx?.line) for (const c of ['physical', 'magic']) { const lp = ctx.line[c]; if (lp && lp.total) out.push(h('div', { class: 'dim' }, `Line defense: a frontal hit on the front row (slots ${lp.slots.join(', ')}) meets ${CH[c]} ${lp.total} shared by ${lp.members.length} member${lp.members.length === 1 ? '' : 's'}.`)); }
      if (f.health.mode === 'party_pool') out.push(h('div', { class: 'dim' }, 'Health is the party\'s shared pool.'));
      const ranged = f.attacks.find((a) => a.kind === 'ranged');
      if (ranged && ctx) {
        const t = ctx.targets.find((x) => x.inRange && !x.blocked) ?? ctx.targets[0];
        if (!t) out.push(h('div', { class: 'dim' }, 'No engaged target: a volley only reaches a party this formation is engaged with.'));
        else out.push(h('div', { class: t.inRange && !t.blocked ? 'ok' : 'dim' }, `Preview vs ${partyShort(S, t.target)} (engaged): power ${t.power}, range ${t.range}${t.elevation !== 'level' ? ` (${t.elevation.replace('_', ' ')})` : ''}${t.blocked ? ', blocked: needs open sky' : t.inRange ? '' : ', out of range'} — a preview, not a result`));
      }
      const cond = f.conditions.filter((c) => c !== 'center');
      if (cond.length) out.push(h('div', { class: 'warn' }, cond.join(', ').replace(/_/g, ' ')));
      return h('div', {}, ...out);
    };
    const key = `${f.sig}|${ctx ? JSON.stringify(ctx) : ''}`;
    return { role, health: hpText, healthPct: f.health.mode === 'member' ? hpPct : null, combat, detail, key, sourceName: name };
  }

  /**
   * The territory environment (HF2-08/09/10): built around the inspected party's territory, faded
   * in with the measured member size, hidden under a lower cutaway, disposed once faded out.
   */
  _updateDiorama(dt, p, pxPerMember) {
    const d = this.view.diorama;
    const amount = p ? Math.max(0, Math.min(1, (pxPerMember - 34) / 40)) : 0;
    if (p && amount > 0) {
      const running = Object.values(this.state.tasks ?? {}).filter((t) => t.status === 'running' && t.target);
      d.sync(this.state, p.region, { runningWork: running });
    }
    d.update(dt, amount, this.view.terrain.cutaway);
    this.view.setCloseFraming(p?.id ?? null, d.opacity);
    // kept (hidden) after fading out, so returning to the same territory does not rebuild it; a
    // different territory or terrain change rebuilds through its key, New match clears it
  }

  /** Per frame: annotate the inspected party's real members (HF2-04/06/07). */
  _updateLabels(dt = 0) {
    if (!this.inspectParty && this.el.inspectBar && !this.el.inspectBar.hidden) { this.expandedPin = null; this._renderInspectBar(); }
    const sub = this.inspectParty;
    // survival is read at the displayed moment: a party defeated later in the Tick keeps its labels
    // until its defeat is shown (R6-03)
    const S = sub ? this._displayState() : null;
    const p = sub ? S?.parties[sub.partyId] : null;
    if (!p || p.retired || !p.alive) { if (sub) this.inspectParty = null; this.labels.update(null); this._updateDiorama(dt, null, 0); return; }
    const cam = this.engine.camera, world = this.el.world.getBoundingClientRect(), canvas = this.engine.renderer.domElement.getBoundingClientRect();
    const toScreen = (v) => { const q = v.clone().project(cam); return q.z > 1 ? null : { x: canvas.left - world.left + ((q.x + 1) / 2) * canvas.width, y: canvas.top - world.top + ((1 - q.y) / 2) * canvas.height }; };
    const center = this.view.toWorld(p.x, p.y).setY(this.view.partyY(p) + 0.4);
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0).setY(0).normalize();
    const a0 = toScreen(center), a1 = toScreen(center.clone().addScaledVector(right, 1.5));
    const pxPerMember = a0 && a1 ? Math.hypot(a1.x - a0.x, a1.y - a0.y) : 0;
    // vertical room between formation rows on screen (foreshortened by pitch): one row = 1.5 units
    const fwd = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 2).setY(0).normalize();
    const a2 = toScreen(center.clone().addScaledVector(fwd, 1.5));
    const rowPx = a0 && a2 ? Math.abs(a2.y - a0.y) : 0;
    // release: zoomed well out, or the party has left the middle of the view
    const W = world.width, H = world.height;
    const away = !a0 || a0.x < W * 0.05 || a0.x > W * 0.95 || a0.y < H * 0.05 || a0.y > H * 0.95;
    if ((pxPerMember < 36 || away) && performance.now() - (sub.since ?? 0) > 1200) { this.inspectParty = null; this.expandedMember = null; this.labels.update(null); this._updateDiorama(dt, null, 0); this._renderCommandBar(); return; }
    this._updateDiorama(dt, p, pxPerMember);
    const facts = this._labelFacts(p.id);
    const roofed = standingOf(S, this.ctx, p).kind === 'tunnel' && this.view.terrain.cutaway === null;
    // hovering a body only highlights it; the source breakdown opens for a deliberate tap, click or
    // keyboard choice (HF3-05: symbols answer first, the deeper view on request)
    const expanded = this.expandedPin && facts.members[this.expandedPin] ? this.expandedPin : null;
    const hovered = this.expandedMember;
    const occluded = this._occlusion(facts, cam);
    const members = Object.values(facts.members).map((f) => {
      const sp = this.view.sprites.get(f.id);
      const open = expanded === f.id;
      const mctx = this._memberCtxCached(facts, S, f);
      const text = this._memberText(f, S, open ? mctx : null);
      text.where = `slot ${f.slot} · ${f.slot <= 3 ? 'front row' : f.slot <= 6 ? 'middle row' : 'rear row'}`;
      const chips = this._chipsCached(facts, f, text, mctx);
      return { id: f.id, visible: !!sp?.visible && !roofed, occluded: occluded.has(f.id), anchor: sp ? toScreen(sp.position.clone().setY(sp.position.y + 1.35)) : null, foot: sp ? toScreen(sp.position) : null, text, chips };
    });
    // the formation's real front on screen, for the covered-face diagrams (never screen-up)
    const fv = FACINGS[p.facing];
    const fr = fv ? toScreen(this.view.toWorld(p.x + fv.fx * this.ctx.U, p.y + fv.fy * this.ctx.U).setY(this.view.partyY(p) + 0.4)) : null;
    const frontDeg = a0 && fr ? (Math.atan2(fr.x - a0.x, -(fr.y - a0.y)) * 180) / Math.PI : null;
    const pf = facts.party, planned = this._plannedSupply(p);
    const party = {
      // just beyond the rightmost visible member on screen, whatever the orbit (never over a body)
      anchor: a0 ? { x: Math.max(a0.x + pxPerMember * 1.2, ...members.filter((m) => m.anchor && m.visible).map((m) => m.anchor.x + pxPerMember * 0.75)), y: a0.y } : null,
      lines: [`${p.owner === this.viewSeat ? 'Your' : `${p.owner}'s`} ${pf.mount ? cap(pf.mount) : 'Pawn'}${pf.commander ? ' ★ Commander' : ''}${pf.mount ? ` · Speed ${speedText(this.ctx, p)}/Tick` : ''} · ${pf.living}/9${pf.centerEmpty ? ' · empty center' : ''} · faces ${FACING_NAME[pf.facing]}`,
        `Supply ${pts(pf.supply)}${planned ? ` (+${pts(planned)} planned)` : ''} · ${stateWord(S, p)}${pf.destination ? ` → R${pf.destination.row}C${pf.destination.column}` : ''}`,
        `Band ${fmtBand(pf.band)}${standingOf(S, this.ctx, p).kind === 'hilltop' ? ' · hilltop' : ''} · ${pf.exposed ? 'exposed' : 'not exposed'}${pf.pool ? ` · pool ${pts(pf.pool.hp)}/${pts(pf.pool.max)}` : ''}`],
      note: roofed ? 'Roofed tunnel: open its layer to read the members (cutaway)' : facts.playing ? 'Playing back: health as of the moment shown' : null,
      key: `${JSON.stringify(pf)}|${planned}|${roofed}|${facts.playing}`,
    };
    this.labels.update({ partyId: p.id, members, party, pxPerMember, rowPx, expanded, hovered, frontDeg, avoid: this._avoidRects() });
    this._renderInspectBar(facts, members, expanded); // rebuilds only when its content changes
  }

  /**
   * Docked controls the member explanation and party facts must never cover (R6-01): the command
   * bar, the inspection bar, the camera pad, the layer rail and any pinned view, in world-element
   * coordinates. Measured at most every 200 ms (they move only when re-rendered).
   */
  _avoidRects(now = performance.now()) {
    if (this._avoidCache && now - this._avoidCache.at < 200) return this._avoidCache.rects;
    const world = this.el.world.getBoundingClientRect();
    // open drawers (Orders & history, the navigator, a required decision) are reserved too (R7-06)
    const drawers = [this.el.orders, this.el.decision, document.body.classList.contains('roster-open') ? this.el.roster : null];
    const els = [this.el.cmdbar, this.el.inspectBar, this.el.camPad, this.el.world.querySelector('.layer-rail'), this.inspect.shown?.pinned?.el, document.getElementById('matchbar'), ...drawers];
    const rects = els.filter((el) => el && !el.hidden && el.offsetParent !== null).map((el) => { const r = el.getBoundingClientRect(); return { x: r.left - world.left, y: r.top - world.top, w: r.width, h: r.height }; }).filter((r) => r.w > 0 && r.h > 0);
    this._avoidCache = { at: now, rects };
    return rects;
  }

  /**
   * Members whose body is hidden behind raised terrain from this camera (low-angle hills; review
   * 06 general occlusion): a ray from the camera to the body's middle meets a hill block first.
   * Such a label is drawn as "behind terrain" rather than as if the body were in view. Throttled.
   */
  _occlusion(facts, cam, now = performance.now()) {
    const key = `${this._factsCache?.key}|${cam.position.x.toFixed(1)},${cam.position.y.toFixed(1)},${cam.position.z.toFixed(1)}`;
    if (this._occCache && (this._occCache.key === key || now - this._occCache.at < 150)) return this._occCache.set;
    const set = new Set(), hills = this.view.terrain.hillMeshes ?? [];
    if (hills.length) {
      const ray = new THREE.Raycaster();
      for (const f of Object.values(facts.members)) {
        const sp = this.view.sprites.get(f.id);
        if (!sp?.visible) continue;
        const mid = sp.position.clone().setY(sp.position.y + 0.6), dir = mid.clone().sub(cam.position), dist = dir.length();
        ray.set(cam.position, dir.normalize()); ray.far = dist - 0.3;
        if (ray.intersectObjects(hills, false).length) set.add(f.id);
      }
    }
    this._occCache = { key, at: now, set };
    return set;
  }

  /**
   * The inspection bar (R6-01/R6-02): the deliberate keyboard and touch route to the same member
   * facts — who is being inspected, the collective facts, one button per member (activating it
   * opens that member's explanation, described by the reading panel), Return and Close. It never
   * changes the command selection. Arrow keys move between members; Escape closes the explanation.
   */
  _renderInspectBar(facts = null, members = null, expanded = null) {
    const sub = this.inspectParty;
    if (!this.el.inspectBar) {
      this.el.inspectBar = h('section', { class: 'inspect-bar', role: 'region', 'aria-label': 'Inspection' });
      this.el.inspectBar.addEventListener('keydown', (ev) => {
        if (!['ArrowLeft', 'ArrowRight'].includes(ev.code)) return;
        const cls = document.activeElement?.classList?.contains('ib-fact') ? '.ib-fact' : '.ib-member';
        const bs = [...this.el.inspectBar.querySelectorAll(cls)], i = bs.indexOf(document.activeElement);
        if (i < 0) return;
        ev.preventDefault(); ev.stopPropagation();
        const next = bs[(i + (ev.code === 'ArrowRight' ? 1 : -1) + bs.length) % bs.length];
        next?.focus(); next?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      });
      this.el.inspectBar.addEventListener('pointerup', (ev) => ev.stopPropagation());
      this.el.world.append(this.el.inspectBar);
    }
    const bar = this.el.inspectBar;
    const p = sub ? this._displayState().parties[sub.partyId] : null;
    if (!p) { if (!bar.hidden) { bar.hidden = true; this._avoidCache = null; } this._inspectBarKey = null; return; }
    facts ??= this._labelFacts(p.id);
    const S = facts.state, pf = facts.party;
    const list = members ?? Object.values(facts.members).map((f) => { const text = this._memberText(f, S); return { id: f.id, text, chips: this._chipsCached(facts, f, text, this._memberCtxCached(facts, S, f)), visible: false }; });
    const open = expanded ?? this.expandedPin;
    // on-body facts readable → the strip carries identity and navigation only; otherwise (scale,
    // occlusion, a roof, room) the same symbols and values are reachable here (HF3-05)
    const level = this.labels.level;
    const readable = (m) => level === 'combat' && m.visible && !m.occluded;
    const partyShown = !this.labels.layout?.partyCrowded && level !== 'none';
    const barKey = `${this.generation}|${p.id}|${JSON.stringify(pf)}|${list.map((m) => `${m.id}:${m.text.key}:${readable(m)}`).join(',')}|${open}|${this.expandedPin}|${!!this._returnPose}|${this.selected?.id ?? ''}|${this.viewSeat}|${this.view.terrain.cutaway}|${level}|${partyShown}`;
    if (barKey === this._inspectBarKey && !bar.hidden && !this._focusInspectBarNext) return;
    this._inspectBarKey = barKey;
    const focused = document.activeElement?.closest?.('.inspect-bar') ? document.activeElement.dataset.member ?? document.activeElement.dataset.act ?? document.activeElement.dataset.fact : null;
    const sel = this.selected?.kind === 'party' && this.selected.id !== p.id ? this.state.parties[this.selected.id] : null;
    const icon = (html, cls = '') => { const sp = h('span', { class: `ib-ic ${cls}`, 'aria-hidden': 'true' }); sp.innerHTML = html; return sp; };
    const pinned = list.find((m) => m.id === this.expandedPin);
    const showTip = (ref, btn) => this.labels.showTip(ref, this.labels.chipEl(ref) ?? btn);
    bar.replaceChildren(
      h('div', { class: 'ib-head' },
        h('b', {}, `Inspecting ${p.owner === this.viewSeat ? 'your' : `${p.owner}'s`} ${pf.mount ? cap(pf.mount) : 'Pawn'} · R${p.region.row}C${p.region.column}`),
        partyShown ? null : h('span', { class: 'dim' }, ` ${pf.living}/9${pf.centerEmpty ? ' · empty center' : ''} · faces ${FACING_NAME[pf.facing]} · Supply ${pts(pf.supply)} · ${stateWord(S, p)}${pf.destination ? ` → R${pf.destination.row}C${pf.destination.column}` : ''} · band ${fmtBand(pf.band)} · ${pf.exposed ? 'exposed' : 'not exposed'}${pf.pool ? ` · pool ${pts(pf.pool.hp)}/${pts(pf.pool.max)}` : ''}`),
        sel ? h('span', { class: 'ib-keep' }, ` · commanding your ${partyShort(this.state, sel.id)}`) : null,
        standingOf(S, this.ctx, p).kind === 'tunnel' && this.view.terrain.cutaway === null ? h('div', { class: 'warn' }, 'Roofed tunnel: open its layer to read the members (cutaway)') : null),
      h('div', { class: 'ib-row' },
        ...list.map((m) => {
          const role = m.chips.find((c) => c.kind === 'role');
          const said = `${role?.title ?? m.text.role}, slot ${this.state.members[m.id]?.slot ?? ''}: ${chipsText(m.chips)}`;
          return h('button', { class: `ib-member${open === m.id ? ' on' : ''}${readable(m) ? ' brief' : ''}`, 'data-member': m.id, 'aria-pressed': String(this.expandedPin === m.id), 'aria-describedby': this.expandedPin === m.id ? 'member-reading' : null, 'aria-label': `${said}${this.expandedPin === m.id ? ', sources open' : ''}`, title: readable(m) ? `${role?.title ?? ''} — its facts are on its body; Enter lists them here` : null,
            onclick: () => { this.expandedPin = this.expandedPin === m.id ? null : m.id; this._focusInspectBarFact = this.expandedPin; this._renderInspectBar(); } },
            icon(role?.icon ?? '', 'role'), readable(m) ? null : h('span', { class: 'ib-vals' }, ...m.chips.filter((c) => c.kind !== 'role').map((c) => h('span', { class: `ib-v ${c.cls}` }, icon(c.icon), c.value ? h('b', {}, c.value) : null))));
        }),
        this._returnPose ? h('button', { 'data-act': 'return', onclick: () => this._returnCamera(), title: 'Back to the view before Inspect (R)' }, '↩ Return (R)') : null,
        h('button', { 'data-act': 'close', onclick: () => { this.inspectParty = null; this.expandedPin = null; this.expandedMember = null; this.labels.hideTip(); this._renderInspectBar(); }, title: 'Stop inspecting; the camera stays (Esc)' }, 'Close (Esc)')),
      // the chosen member's symbols as keyboard/touch stops (only this member: a bounded set)
      pinned ? h('div', { class: 'ib-facts', role: 'group', 'aria-label': `${pinned.chips.find((c) => c.kind === 'role')?.title ?? 'Member'} facts` },
        ...pinned.chips.map((c) => { const ref = `${pinned.id}|${c.key}`; return h('button', { class: `ib-fact ${c.cls}`, 'data-fact': ref, 'aria-label': `${c.title}${c.value ? ` ${c.value}` : ''}`, 'aria-describedby': 'member-tip',
          // the pointer leaving a symbol returns to the keyboard-focused symbol's definition, if any
          onfocus: (e) => showTip(ref, e.currentTarget), onblur: () => this.labels.hideTip(), onpointerenter: (e) => showTip(ref, e.currentTarget), onpointerleave: () => { const f = document.activeElement; if (f?.classList?.contains('ib-fact') && f.dataset.fact) showTip(f.dataset.fact, f); else this.labels.hideTip(); },
          onclick: (e) => showTip(ref, e.currentTarget) }, icon(c.icon), c.value ? h('b', {}, c.value) : null); })) : '');
    bar.hidden = false;
    // compact: one scrolling row of members when the wrapped bar would take too much height
    bar.classList.remove('compact');
    if (bar.offsetHeight > 0.2 * (this.el.world.clientHeight || 1)) bar.classList.add('compact');
    if (this._focusInspectBarFact) { this._focusInspectBarFact = null; bar.querySelector('.ib-fact')?.focus({ preventScroll: true }); }
    else if (focused) bar.querySelector(`[data-member="${CSS.escape(focused)}"], [data-act="${CSS.escape(focused)}"], [data-fact="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });
    bar.querySelector('.ib-member.on')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    if (this._focusInspectBarNext) { this._focusInspectBarNext = false; bar.querySelector('.ib-member')?.focus({ preventScroll: true }); }
    this._avoidCache = null;
  }

  _focusSelection() {
    const s = this.selected;
    if (s?.kind === 'party') { const p = this.state.parties[s.id]; this.cam.focusOn(this.view.toWorld(p.x, p.y).setY(this.view.partyY(p))); }
    else if (s?.kind === 'member') { const m = this.state.members[s.id]; this.cam.focusOn(this.view.toWorld(m.x, m.y).setY(this.view.partyY(m))); }
  }

  // --- frame -------------------------------------------------------------------------------------
  _frame(dt) {
    if (!this.cam) return;
    this.cam.update(dt, this.keys);
    this._stepPlayback(dt);
    this.scenery?.update(dt);
    this.view.update(dt, this.engine.camera);
    this.view.viewportH = this.engine.renderer.domElement.clientHeight;
    const busy = !!(this.cardDrag?.active || this.cam?.dragging || this.tool);
    if (busy !== this._inspectBusy) { this._inspectBusy = busy; this.inspect.setSuspended(busy); }
    this.inspect.update();
    this._placeBasinCounters();
    this._updateLabels(dt);
    const emph = `${this.inspect.transientSubject?.id ?? ''}|${this.inspect.pinnedSubject?.id ?? ''}`;
    if (emph !== this._emphKey && this.session) { this._emphKey = emph; this._syncIntents(); }
    this.el.compass.textContent = `▲ ${Math.round(this.cam.bearing)}° · ${this.cam.tactical ? 'Tactical' : 'Angled'} · home ${this.viewSeat}`;
  }

  /** A persistent hint while a targeting tool is active (Esc cancels). */
  _renderToolHint() {
    const t = this.tool;
    const text = !t ? null
      : t.kind === 'supply' ? `Supply ${pts(this.state.cards[t.cardId]?.supply ?? 0)}: click one of your parties on the board or in the roster`
      : t.kind === 'retreat' ? 'Retreat: right-click a legal territory away from contact'
      : t.kind === 'ability' ? (t.step === 'actor' ? 'Ability: click a friendly party in an active column as the source' : 'Ability: choose the target')
      : null;
    if (!this.el.toolHint) { this.el.toolHint = h('div', { class: 'tool-hint', role: 'status' }); this.el.world.append(this.el.toolHint); }
    this.el.toolHint.hidden = !text;
    this.el.toolHint.replaceChildren(...(text ? [h('span', {}, text), h('button', { onclick: () => { this.tool = null; this._renderAll(); } }, 'Cancel (Esc)')] : []));
  }

  _toast(msg, warn = false) {
    this.el.toast.textContent = msg;
    this.el.toast.className = `toast show${warn ? ' warn' : ''}`;
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => (this.el.toast.className = 'toast'), 3200);
  }

  // --- rendering the HUD -------------------------------------------------------------------------
  _renderAll() {
    if (!this.session) return;
    // keyboard focus survives re-rendering (review UX-14): if the focused control is about to be
    // rebuilt, focus returns to the same panel's control with the same accessible name, else to the
    // inspector heading — never to the top of the page
    const prev = document.activeElement;
    const panel = prev && prev !== document.body ? prev.closest?.('.area') : null;
    const key = panel ? (prev.getAttribute('aria-label') || prev.textContent || '').trim() : null;
    this._renderAllInner();
    if (this._focusAfter) {
      const f = this._focusAfter; this._focusAfter = null;
      const t = f();
      if (t) { t.focus({ preventScroll: false }); return; }
    }
    if (this._focusInspectorNext) {
      this._focusInspectorNext = false;
      const el = this._inspectorEl();
      if (el === this.el.cmdbar) { const first = el.querySelector('summary:not(.off), button'); if (first) { first.focus({ preventScroll: true }); return; } }
      const head = el.querySelector('h3');
      if (head) { head.setAttribute('tabindex', '-1'); head.focus({ preventScroll: true }); return; }
    }
    if (panel && !document.contains(prev)) {
      const same = [...panel.querySelectorAll('button, [tabindex="0"], summary')].find((e) => (e.getAttribute('aria-label') || e.textContent || '').trim() === key);
      const head = this._inspectorEl().querySelector('h3');
      const target = same ?? (head && (head.setAttribute('tabindex', '-1'), head));
      target?.focus({ preventScroll: true });
    }
  }

  /**
   * The free horizontal band of the world between open drawers (addendum 03, HF3-07): left/right
   * reserved px. Written to CSS variables so the command bar, inspection bar, camera pad and layer
   * rail reflow inside it instead of sliding underneath a drawer.
   */
  _freeSpace() {
    const w = this.el.world.getBoundingClientRect();
    const edge = (el) => (el && !el.hidden && getComputedStyle(el).display !== 'none' ? el.getBoundingClientRect() : null);
    const nav = edge(this.el.roster), dec = edge(this.el.decision), ord = edge(this.el.orders);
    const right = Math.max(dec ? w.right - dec.left + 6 : 0, ord ? w.right - ord.left + 6 : 0);
    return { left: nav ? Math.max(0, nav.right - w.left + 6) : 0, right };
  }

  _syncFreeSpace() {
    const f = this._freeSpace(), st = this.el.world.style;
    const l = `${Math.round(f.left)}px`, r = `${Math.round(f.right)}px`;
    if (st.getPropertyValue('--free-l') !== l || st.getPropertyValue('--free-r') !== r) {
      st.setProperty('--free-l', l); st.setProperty('--free-r', r);
      this._avoidCache = null;
      this.labels.readingKey = null; // re-measure the explanation for its new room
    }
  }

  _renderAllInner() {
    closeTerms();
    this._renderMatchBar();
    this._renderRoster();
    this._renderOrders();
    this._renderDecision();
    this._renderCommandBar();
    this._renderBasins();
    this._syncInspection();
    this._renderEvents();
    this._renderLayers();
    this._renderToolHint();
    this._syncFreeSpace();
    if (!this.playback) this.view.syncSupplyTokens(this.state, this._plannedSupplyMap());
    this.view.syncPlanLinks(this.state, this.playback ? [] : ['A', 'B'].flatMap((seat) => this.plans[seat].filter((c) => c.type === 'load_supply')));
    this.view.terrain.syncWork(this.state, this.playback ? [] : ['A', 'B'].flatMap((seat) => this.plans[seat].filter((c) => c.type === 'begin_work')));
    const sel = this.selected?.kind === 'party' ? this.state.parties[this.selected.id] : null;
    if (sel && !this.playback) {
      this.view.select(this.state, sel, sel.owner === this.viewSeat && this.state.activeColumns.includes(sel.region.column) && sel.mount ? this._fundedTargets(sel).filter((d) => d.funded) : [], this._blockCue(sel));
      // a drafted destination shows its own route (and the chosen Knight L), not the accepted one
      const draft = this._draftMove(sel);
      if (draft) { const r = routeFromHere(this.state, this.ctx, sel, draft.target, draft.via ?? null); if (r.path) { this.view.showRoute(sel, r.path.map((n) => [n.x, n.y])); this.view.showPath(sel, r.path.map((n) => [n.x, n.y]), this._freeKnight(sel) ? this._arrivalFacing(sel, draft) : null); } }
      else this.view.showPath(null);
    }
    else { if (!sel) this.view.select(this.state, null); this.view.showPath(null); }
    this._syncIntents();
  }

  /**
   * The compact decision strip (addendum §2): seat, Tick/phase, active columns, Commander status,
   * Orders (count, stale badge), the one Ready / Acknowledge, the navigator, help, sound and menu.
   * Operational state only — no permanent tutorial.
   */
  _renderMatchBar() {
    const s = this.state, p = this.ctx.profile;
    const r = roundOf(p, Math.max(1, s.tick));
    const cmd = (seat) => Object.values(s.members).find((m) => m.commander && m.owner === seat);
    const me = this.viewSeat, can = this._can(me);
    const n = (seat) => this.plans[seat]?.length ?? 0;
    const bad = this._planErrors(me).length;
    this._renderReadyButton();
    this.el.ordersBtn = h('button', { class: `strip-btn orders${can.stale ? ' stale' : ''}${bad ? ' bad' : ''}`, 'aria-expanded': String(!!this.ordersOpen), 'aria-controls': 'orders', onclick: () => this._toggleOrders(), title: 'Orders and Tick history (P · H)' },
      'Orders ', h('b', {}, `${me} ${n(me)}`), ` · ${other(me)} ${n(other(me))}`, can.stale ? h('span', { class: 'badge warn' }, 'changed') : null, bad ? h('span', { class: 'badge bad' }, `${bad} invalid`) : null);
    this.el.navBtn = h('button', { class: 'strip-btn', 'aria-expanded': String(document.body.classList.contains('roster-open')), 'aria-controls': 'roster', title: 'Parties and Cards (N)', onclick: () => this._toggleRoster() }, '☰ Parties & Cards');
    this.el.matchbar.replaceChildren(...[
      h('div', { class: `crest ${me.toLowerCase()}`, title: `You are seat ${me}` }, me, h('small', {}, this.seats[me] === 'bot' ? 'bot' : 'you')),
      h('div', { class: 'tick' }, this.session.fixture ? h('span', { class: 'fixture-tag', title: 'This state was prepared directly as a diagnostic fixture; it did not emerge from ordinary play.' }, 'FIXTURE') : null, h('b', {}, term('tick', `Tick ${s.tick}`)), ' · ', r.period === 'prologue' ? 'Prologue' : term('round', `Round ${r.round}`)),
      h('div', { class: 'active' }, term('active', 'Active'), ' ', ...s.activeColumns.map((c) => h('span', { class: 'colchip' }, `C${this.ctx.geo.toLocal(me, c, 1).column}`))),
      h('div', { class: 'phase', role: 'status' }, this.playback ? 'Resolving…' : this.pendingChoice ? `Response · ${this.pendingChoice.req.seat} to act` : s.outcome ? 'Match over' : can.stale ? 'Acknowledge the changed pair' : can.current ? `Committed — ${this._readyValid(other(me)) ? 'resolving' : `waiting for ${other(me)}`}` : this.watch ? `Bots · ${{ run: 'running', pause: 'paused', step: 'stepping', stop: 'stopped' }[this.auto?.mode] ?? ''}` : 'Planning'),
      h('div', { class: 'cmds', title: 'Commander health (the match ends if one falls)' }, ...['A', 'B'].map((seat) => { const c = cmd(seat); return h('span', { class: `cmdhp ${seat.toLowerCase()}` }, `${seat}★ ${c?.alive ? `${pts(c.hp)}/${pts(c.maxHp)}` : 'fallen'}`); })),
      this.el.navBtn, this.el.ordersBtn, this.el.readyBig, this._autoControls(),
      h('div', { class: 'speed' }, h('label', {}, h('span', { class: 'sr' }, 'Playback speed '), h('select', { 'aria-label': 'Playback speed', onchange: (e) => (this.speed = Number(e.target.value)) }, ...[0.5, 1, 2, 4].map((v) => h('option', { value: v, selected: v === this.speed }, `${v}×`))))),
      h('button', { class: 'menu', 'aria-label': 'Help', 'aria-haspopup': 'dialog', onclick: () => this._help() }, '?'),
      this.sound ? h('button', { class: 'menu', 'aria-label': this.sound.muted ? 'Sound off' : 'Sound on', 'aria-pressed': String(!this.sound.muted), onclick: () => { this.sound.toggle(); this._renderMatchBar(); } }, this.sound.muted ? '🔇' : '🔊') : null,
      this.el.menuBtn = h('button', { class: 'menu', 'aria-label': 'Match menu', 'aria-haspopup': 'dialog', onclick: () => this._menu() }, '☰'),
    ].filter(Boolean));
  }

  /** Both-bot runs: Pause / Step / Stop of the Tick scheduler (shown only when watching bots). */
  _autoControls() {
    if (!this.watch || !this.auto) return null;
    const m = this.auto.mode, busy = this.resolving || this.playback;
    return h('div', { class: 'auto-ctl', role: 'group', 'aria-label': 'Bot match controls' },
      m === 'run' ? h('button', { onclick: () => this._autoControl('pause'), title: 'Finish the current Tick, then hold' }, '⏸ Pause')
        : h('button', { disabled: m === 'stop', onclick: () => this._autoControl('resume') }, '▶ Run'),
      h('button', { disabled: m === 'run' || m === 'stop' || busy, onclick: () => this._autoControl('step'), title: 'Resolve one Tick' }, 'Step'),
      h('button', { disabled: m === 'stop', onclick: () => this._autoControl('stop'), title: 'No further automatic Ticks (New match restarts)' }, '■ Stop'));
  }

  /** Help on demand (the long teaching text that used to fill the inspector). */
  _help() {
    const keys = [['Hover / focus', 'inspect a Card, party or basin where it is'], ['Click / Enter', 'pin that view; Esc closes the top view'], ['N', 'Parties & Cards navigator'], ['P · H', 'this Tick\'s orders · Tick history'], ['Right click', 'set the selected party\'s destination; again on a Knight\'s destination flips its L'], ['Shift + right click', 'a Knight\'s destination: its facing on arrival'], ['G', 'Face menu: turn the selected formation (one Tick)'], ['L · O', 'Knight: flip the L · arrival facing'], ['1–9', 'inspect your Card in that home column'], ['U / B / C', 'Supply, Burn or Ability with the inspected Card'], ['Ctrl/⌘ + Enter', 'Ready (commits your plan)'], ['Q / E · Z / X', 'rotate · tilt the camera'], ['V · Home · F', 'tactical · home · focus'], ['[ ]', 'height layers'], ['Space', 'pause playback']];
    this._sheet(h('div', { class: 'card-sheet help', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Help' },
      h('h2', {}, 'How a Tick goes'),
      h('ol', { class: 'quickstart' },
        h('li', {}, h('b', {}, 'Inspect. '), 'Hover or focus any Card in the banks, any party, or a Mana basin: its details open beside it. Click to pin.'),
        h('li', {}, h('b', {}, 'Choose each Card\'s one use. '), 'Supply for a party (Load Supply, or drag onto the party); Burn in your Fire Pit for its Mana (Burn, or drag onto the pit); or its ability.'),
        h('li', {}, h('b', {}, 'Move. '), 'In a party\'s view, Move to… lists every destination its Supply can fund for the whole route (held plus earlier planned loads). Speed is how fast it travels.'),
        h('li', {}, h('b', {}, 'Ready. '), 'Orders shows both public plans. Ready (in the strip, or Ctrl/⌘ + Enter) freezes your plan; when both are Ready the Tick resolves and plays back.')),
      h('h3', {}, 'Keys'), h('div', { class: 'keys' }, ...keys.map(([k, v]) => h('div', {}, h('kbd', {}, k), ' ', v))),
      this._hoverHelp(),
      h('div', { class: 'row' }, h('button', { 'data-autofocus': true, onclick: () => this._closeSheet() }, 'Close'))));
  }

  /**
   * What concession means for a seat right now (Master Requirements v3 "Terminal conditions";
   * Design Companion: "a separate menu action with an explicit match-ending confirmation").
   * In this prototype a concession is an order in the seat's public plan, so it is accepted only
   * while that plan is editable; it ends the match when the Tick resolves. Concession at any phase
   * needs a separate accepted terminal record (see design response 04) and is not claimed here.
   * @returns {{ show: boolean, can: boolean, planned: boolean, text: string }}
   */
  _concession(seat) {
    const c = this._can(seat);
    if (!c.human || this.state.outcome) return { show: false, can: false, planned: false, text: '' };
    const planned = this.plans[seat].some((x) => x.type === 'concede');
    if (planned) return { show: true, can: false, planned, text: c.frozen
      ? `Your concession is in your frozen plan for Tick ${this.state.tick}: the match ends when this Tick resolves.`
      : `Your concession is in your public plan for Tick ${this.state.tick}. It ends the match when this Tick resolves; remove it from your plan to withdraw it before Ready.` };
    if (c.edit) return { show: true, can: true, planned, text: `Adds a concession to your public plan for Tick ${this.state.tick}. ${other(seat)} sees it; the match ends when this Tick resolves.` };
    const why = this.pendingChoice ? 'a response window is open'
      : (this.resolving || this.playback) ? 'the Tick is resolving'
      : 'your plan is frozen after Ready';
    return { show: true, can: false, planned, text: `Concession is not available now: ${why}. In this prototype a concession is an order in your editable plan, so you can concede in the next planning phase, before pressing Ready. Your plan has not been reopened.` };
  }

  /** Open an overlay sheet that Escape (or its Cancel) closes, returning focus to `back`. */
  _sheet(content, back) {
    this.el.overlay.replaceChildren(content);
    this.el.overlay.hidden = false;
    this._overlayBack = back ?? document.activeElement;
    this._overlayDismiss = true;
    (content.querySelector('[data-autofocus]') ?? content.querySelector('button'))?.focus();
  }

  _closeSheet({ restore = true } = {}) {
    this.el.overlay.hidden = true;
    this._applyModal?.(); // lift inert now, so the opener can take focus below
    this._overlayDismiss = false;
    const back = this._overlayBack;
    this._overlayBack = null;
    if (!restore) return;
    if (back?.isConnected) back.focus(); else this.el.menuBtn?.focus();
  }

  /**
   * Every blocking sheet (menu, confirmation, setup, result, editor, lab) is modal (review 03, R3-03):
   * while the overlay is shown the rest of the app is inert — no Tab stop, click or Enter reaches an
   * obscured game control — and Tab / Shift+Tab cycle inside the sheet.
   */
  _containModals() {
    const ov = this.el.overlay;
    const apply = () => {
      const open = !ov.hidden;
      for (const el of this.root.children) if (el !== ov) el.inert = open;
      document.body.classList.toggle('modal-open', open);
    };
    this._applyModal = apply;
    new MutationObserver(apply).observe(ov, { attributes: true, attributeFilter: ['hidden'] });
    ov.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const f = [...ov.querySelectorAll('button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent !== null);
      if (!f.length) { e.preventDefault(); return; }
      const first = f[0], last = f.at(-1);
      if (e.shiftKey && (document.activeElement === first || !ov.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !ov.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    });
    apply();
  }

  _menu() {
    const seat = this.viewSeat;
    const con = this._concession(seat);
    this._sheet(h('div', { class: 'card-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Match menu' },
      h('h2', {}, 'Match menu'),
      h('p', {}, `Profile ${this.ctx.profile.id} · match ${this.state.matchId}`),
      h('p', {}, h('code', {}, stateFingerprint(this.state).slice(0, 23) + '…'), ' state fingerprint'),
      this._devSection(),
      h('div', { class: 'row' },
        h('button', { 'data-autofocus': true, onclick: () => this._closeSheet() }, 'Resume'),
        h('button', { onclick: () => this._downloadReplay() }, 'Download replay'),
        h('button', { onclick: () => this.showSetup() }, 'New match')),
      con.show ? h('div', { class: 'concede-box' },
        h('h3', {}, `Concede as ${seat}`),
        h('p', { class: 'small', id: 'concede-note' }, con.text),
        con.can ? h('button', { class: 'danger', 'aria-describedby': 'concede-note', onclick: () => this._confirmConcede(seat) }, `Concede as ${seat}…`) : null) : null), this.el.menuBtn);
  }

  /** Development: the effective controllers and a copyable launch link (changes start a new match). */
  _devSection() {
    const c = this.effective;
    if (!c) return null;
    const url = launchURL({ ...c, profileId: c.fixture ? null : (c.profileId ?? this.ctx.profile.id) });
    const swap = (A, B) => h('button', { disabled: c.seats.A === A && c.seats.B === B, onclick: () => { this._closeSheet({ restore: false }); this.startMatch({ fixture: c.fixture, profileId: c.profileId ?? undefined, seats: { A, B }, seed: c.seed }); } }, `A ${A} · B ${B}`);
    return h('div', { class: 'dev-preset' },
      h('h3', {}, 'Development controllers'),
      h('p', { class: 'small' }, h('b', {}, describeConfig(c)), ' — ', h('code', { class: 'launch-link' }, url), ' ', h('button', { class: 'linkish', onclick: () => navigator.clipboard?.writeText(url) }, 'Copy link')),
      h('div', { class: 'row' }, swap('human', 'bot'), swap('bot', 'human'), swap('bot', 'bot'), swap('human', 'human')),
      h('p', { class: 'dim small' }, 'Changing controllers starts a new match with the same seed (never a mid-match transfer).'));
  }

  /** The explicit match-ending confirmation; Cancel (or Escape) changes nothing. */
  _confirmConcede(seat) {
    const back = this._overlayBack;
    this._sheet(h('div', { class: 'card-sheet confirm', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'concede-h', 'aria-describedby': 'concede-d' },
      h('h2', { id: 'concede-h' }, `Concede the match as ${seat}?`),
      h('p', { id: 'concede-d' }, `${seat} loses and ${other(seat)} wins by concession. The concession goes into your public plan for Tick ${this.state.tick}; the match ends when this Tick resolves, after both players are Ready. A lost connection or closing this window is never a concession.`),
      h('div', { class: 'row' },
        h('button', { 'data-autofocus': true, onclick: () => this._closeSheet() }, 'Cancel — keep playing'),
        h('button', { class: 'danger', onclick: () => {
          this._closeSheet();
          if (this._addCommand(seat, { type: 'concede' })) this._toast(`Concession added to ${seat}'s plan: the match ends when Tick ${this.state.tick} resolves. Press Ready to commit it.`);
        } }, `Concede as ${seat}`))), back);
  }

  _downloadReplay() {
    const blob = new Blob([JSON.stringify(this.session.replay)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `${this.state.matchId}.replay.json` });
    a.click();
  }

  _showResult() {
    const o = this.state.outcome ?? { result: 'unfinished' };
    this._renderAll();
    const sum = summarize(this.session.events, this.state);
    const REASON = { commander_died: 'the Commander fell', capital_captured: 'a party center entered the Capital', conceded: 'conceded' };
    const crest = (seat) => h('span', { class: `crest ${seat.toLowerCase()}` }, seat);
    const headline = o.result === 'draw' ? 'Draw' : o.result === 'win' ? 'Victory' : 'Unfinished';
    const stat = (label, a, b) => h('tr', {}, h('td', {}, label), h('td', {}, String(a)), h('td', {}, String(b)));
    this._overlayDismiss = false;
    this.el.overlay.replaceChildren(h('div', { class: 'card-sheet result' },
      h('div', { class: 'title-emblems', 'aria-hidden': 'true' }, ...['red', 'purple', 'blue', 'black', 'rainbow', 'white', 'orange', 'yellow', 'green'].map((c) => h('img', { src: emblemURL(c, 16), alt: '' }))),
      h('h1', {}, headline),
      o.result === 'win' ? h('p', { class: 'lede' }, crest(o.winner), ` wins on Tick ${o.tick} — `, ...(o.reasons ?? []).map((r) => h('span', {}, `${r.seat}: ${REASON[r.reason] ?? r.reason.replace('_', ' ')}${r.partyId ? ` (${partyName(this.state, r.partyId)})` : ''}`)))
        : h('p', { class: 'lede' }, o.result === 'draw' ? `Both sides lost on Tick ${o.tick}: ${(o.reasons ?? []).map((r) => `${r.seat} — ${REASON[r.reason] ?? r.reason}`).join('; ')}` : `Stopped at Tick ${this.state.tick} without a rules-defined result.`),
      h('table', { class: 'result-stats' },
        h('tr', {}, h('th', {}, ''), h('th', {}, crest('A')), h('th', {}, crest('B'))),
        stat('Cards minted', sum.mints.A, sum.mints.B),
        stat('Supply loaded', +sum.supplyLoaded.A.toFixed(2), +sum.supplyLoaded.B.toFixed(2)),
        stat('Mana burned', sum.manaBurned.A, sum.manaBurned.B),
        stat('Members lost', sum.casualties.A, sum.casualties.B)),
      h('p', { class: 'dim small' }, `First contact on Tick ${sum.firstEngagementTick ?? '—'} · ${sum.engagements} contacts · ${sum.merges} merges · damage ${+sum.damage.physical.toFixed(1)} Physical / ${+sum.damage.magic.toFixed(1)} Magic. The replay recomputes this match exactly (npm run replay -- file.json).`),
      h('div', { class: 'row center' }, h('button', { onclick: () => (this.el.overlay.hidden = true) }, 'Inspect the board'), h('button', { onclick: () => this._downloadReplay() }, 'Download replay'), h('button', { class: 'primary', onclick: () => this.showSetup() }, 'New match'))));
    this.el.overlay.hidden = false;
    this.sound?.play(o.result === 'win' ? 'levelup' : 'close', { volume: 0.6 });
  }

  /** Open or close the roster drawer (narrow layouts only; at wide layouts the roster is a column). */
  _toggleRoster(open = !document.body.classList.contains('roster-open')) {
    document.body.classList.toggle('roster-open', open);
    this.el.navBtn?.setAttribute('aria-expanded', String(open));
    this.inspect.relayout();
    // the keyboard follows the drawer: into its first entry on open, back to the toggle on close
    if (open) requestAnimationFrame(() => this.el.roster.querySelector('.rrow, button')?.focus());
    else if (this.el.roster.contains(document.activeElement)) this.el.navBtn?.focus();
  }

  /**
   * The Parties & Cards navigator (addendum §2): an on-demand list of the same instances the board
   * shows — every party, every Card in both owners' Minor / Major / row banks, both basins. Focus
   * inspects (no click needed); Enter pins and moves into the view; Escape closes.
   */
  _renderRoster() {
    const s = this.state;
    // a party row: your own party is selected for commands (no camera move); any party can be
    // inspected up close, which keeps the command selection and its orders (review 06, R6-02)
    const inspectRow = (p) => { this._focusInspect(p.id); this._focusInspectBarNext = true; this._renderAll(); };
    const subjectRow = (subject, label, text, cls = '') => {
      const party = subject.kind === 'party' ? s.parties[subject.id] : null;
      const own = party && this._commandable(party);
      const pick = () => {
        if (party && !own) return inspectRow(party);
        if (party) { this.selected = { kind: 'party', id: subject.id }; this._autoLayer(party); }
        else this.pinned = { kind: subject.kind, id: subject.id };
        this._focusInspectorNext = true; this._renderAll();
      };
      const peekAs = party ? { kind: 'hint', id: subject.id } : subject;
      const row = h('button', { class: `rrow ${cls}${this.selected?.id === subject.id || this.pinned?.id === subject.id ? ' sel' : ''}`, 'aria-label': party && !own ? `Inspect ${label}` : party ? `Select ${label}` : label, onclick: pick, onfocus: () => this.inspect.focusSubject(peekAs), onblur: () => this.inspect.blurSubject() }, ...text, party && !own ? h('span', { class: 'dim' }, ' · inspect') : null);
      if (!own) return row;
      return h('div', { class: 'rpair' }, row, h('button', { class: 'rinspect', 'aria-label': `Inspect ${label} up close`, title: 'Inspect up close (keeps your selection)', onclick: () => inspectRow(party) }, '⌕'));
    };
    const parties = (seat) => Object.values(s.parties).filter((p) => p.owner === seat && p.alive && !p.retired).sort((a, b) => a.localColumn - b.localColumn || (a.kind < b.kind ? -1 : 1)).map((p) => {
      const living = Object.values(p.slots).filter((id) => id && s.members[id].alive).length;
      const planned = this._plannedSupply(p);
      if (this.tool?.kind === 'supply' && p.owner === this.viewSeat) return h('button', { class: 'rrow target', onclick: () => { if (this._addCommand(this.viewSeat, { type: 'load_supply', cardId: this.tool.cardId, partyId: p.id })) this._toast(`Supply planned for ${partyName(s, p.id)}`); this.tool = null; this._renderAll(); } }, `Load into ${partyShort(s, p.id)}`);
      return subjectRow({ kind: 'party', id: p.id }, `${p.owner === this.viewSeat ? 'Your' : `${p.owner}'s`} ${p.mount ? cap(p.mount) : 'Pawn'}${p.commander ? ' Commander' : ''} at R${p.region.row}C${p.region.column}, ${living} of 9 members, Supply ${pts(supplyOf(p))}${planned ? ` plus ${pts(planned)} planned` : ''}${p.state === 'engaged' ? ', in combat' : ''}`,
        [h('span', { class: `dot ${p.owner.toLowerCase()}` }), h('b', {}, p.mount ? cap(p.mount) : 'Pawn'), p.commander ? ' ★' : '', h('span', { class: 'dim' }, ` R${p.region.row}C${p.region.column}`), ` ${living}/9`, h('span', { class: 'dim' }, ` S${pts(supplyOf(p))}`), planned ? h('span', { class: 'planned-supply' }, `+${pts(planned)}`) : null, p.state === 'engaged' ? h('span', { class: 'badge' }, '⚔') : null]);
    });
    const cards = (seat) => {
      const out = [];
      const bank = s.players[seat].bank, planned = this._plannedCardIds(seat);
      for (let lc = 1; lc <= 9; lc++) {
        const col = this.ctx.geo.toGlobal(seat, lc, 1).column, id = bank.minor[String(col)];
        if (!id) continue;
        const c = s.cards[id], def = activeCatalog.cards[c.abilityId];
        out.push(subjectRow({ kind: 'card', id }, `${seat}'s C${lc} Minor Arcana: ${c.rank} of ${SUIT_NAME[c.suit] ?? c.suit}, Supply ${pts(c.supply)}, ${Object.keys(c.mana ?? {}).length ? fmtMana(c.mana) : 'no Mana'}, ${def?.title ?? 'no ability'}${planned.has(id) ? ` (planned: ${this._plannedUse(seat, id)})` : ''}`,
          [h('span', { class: 'dim' }, `C${lc} `), h('b', {}, `${c.rank}${SUIT[c.suit] ?? ''}`), ` S${pts(c.supply)} `, Object.keys(c.mana ?? {}).length ? fmtMana(c.mana) : h('span', { class: 'dim' }, '0 Mana'), planned.has(id) ? h('span', { class: 'planned-supply' }, ' planned') : null]));
      }
      for (const [lc, id] of Object.entries(bank.major ?? {})) if (id) out.push(subjectRow({ kind: 'card', id }, `${seat}'s Major Arcana in C${lc}: ${activeCatalog.cards[s.cards[id].abilityId]?.title ?? id}`, [h('span', { class: 'dim' }, `Major C${lc} `), activeCatalog.cards[s.cards[id].abilityId]?.title ?? id]));
      for (const [row, id] of Object.entries(bank.rows ?? {})) if (id) out.push(subjectRow({ kind: 'card', id }, `${seat}'s row Enchantment on R${row}: ${activeCatalog.cards[s.cards[id].abilityId]?.title ?? id}`, [h('span', { class: 'dim' }, `Row R${row} `), activeCatalog.cards[s.cards[id].abilityId]?.title ?? id]));
      return out;
    };
    const group = (title, items) => h('details', { class: 'navgroup', open: true }, h('summary', {}, `${title} (${items.length})`), ...(items.length ? items : [h('div', { class: 'dim small' }, 'none')]));
    this.el.roster.replaceChildren(
      h('div', { class: 'orders-head' }, h('h3', {}, 'Parties & Cards'), h('button', { class: 'peek-btn', 'aria-label': 'Close Parties and Cards', onclick: () => this._toggleRoster(false) }, '×')),
      ...['A', 'B'].map((seat) => h('div', { class: 'navseat' }, h('div', { class: `rhead ${seat.toLowerCase()}` }, `${seat}${seat === this.viewSeat ? ' (you)' : ''}`),
        group('Parties', parties(seat)), group('Cards', cards(seat)),
        // the same quantity the basin shows: available this Tick while planning (review 08, R8-06)
        (() => { const planning = !(this.resolving || this.playback || this.pendingChoice), av = this._availablePool(seat), has = Object.values(av).some((n) => n > 0), label = planning ? 'available this Tick' : 'pool now';
          return subjectRow({ kind: 'basin', id: seat }, `${seat}'s Fire Pit and Mana basin: ${label} ${has ? fmtMana(av) : 'none'}`, [h('b', {}, 'Fire Pit & Mana basin'), h('span', { class: 'dim' }, ` ${label}: ${has ? fmtMana(av) : '0'}`)]); })())));
  }

  /**
   * The public plans dock (review 02, R2-02). Own plan first while planning; when the opponent
   * revised after this seat's Ready, its plan comes first with every NEW / REMOVED order, and the
   * banner says the own plan stays frozen. Orders wrap in full; each has a named Remove while the
   * plan is editable, and the last removed order can be restored. Ready is pinned at the foot.
   */
  _renderPlan() {
    const s = this.state, me = this.viewSeat, opp = other(me), can = this._can(me);
    const mine = this.ready[me];
    const seenOf = (seat) => (seat !== me && mine && can.stale ? mine.seen?.[seat] ?? null : null);
    const changes = (seat) => {
      const seen = seenOf(seat), keys = this.plans[seat].map(cmdKey);
      return { seen, keys, added: seen ? keys.filter((k) => !seen.includes(k)).length : 0, removed: seen ? seen.filter((k) => !keys.includes(k)) : [] };
    };
    const box = (seat) => {
      const v = validatePlan(s, this.ctx, seat, this.plans[seat]);
      const bad = new Map(v.errors.map((e) => [e.index, e.error]));
      const rd = this.ready[seat];
      const own = seat === me;
      const who = own ? `Your plan (${seat})` : `${seat}'s plan`;
      const status = this._readyValid(seat) ? h('span', { class: 'ok' }, 'Ready · frozen')
        : rd ? h('span', { class: 'warn' }, 'Frozen · must acknowledge again') : h('span', { class: 'dim' }, own && can.edit ? 'editing' : 'planning');
      const { seen, keys, removed } = changes(seat);
      const editable = own && can.edit;
      const n = this.plans[seat].length;
      const items = this.plans[seat].map((c, i) => {
        const added = seen && !seen.includes(keys[i]);
        const text = describeCmd(s, c);
        return h('li', { class: `${bad.has(i) ? 'bad' : ''}${added ? ' added' : ''}` },
          added ? h('span', { class: 'chg' }, 'NEW') : null, h('span', { class: 'otext' }, text),
          bad.has(i) ? h('div', { class: 'err' }, bad.get(i)) : null,
          editable ? h('button', { class: 'x', 'aria-label': `Remove order ${i + 1}: ${text}`, title: 'Remove this order (a new public revision)', onclick: () => this._removeOrder(seat, i) }, 'Remove') : null);
      });
      const gone = removed.map((k) => h('li', { class: 'removed' }, h('span', { class: 'chg' }, 'REMOVED'), h('span', { class: 'otext' }, describeCmd(s, JSON.parse(k)))));
      const restore = editable && this._lastRemoved?.[seat]?.tick === s.tick ? h('button', { class: 'restore', 'aria-label': `Restore removed order: ${describeCmd(s, this._lastRemoved[seat].cmd)}`, onclick: () => this._restoreOrder(seat) }, `↶ Restore “${describeCmd(s, this._lastRemoved[seat].cmd)}”`) : null;
      const body = [h('ol', {}, ...items, ...gone), n || removed.length ? null : h('div', { class: 'dim' }, 'No orders: a legal pass (parties keep any destination they already have).'), restore];
      const head = h('div', { class: 'phead', title: `revision r${this.rev[seat]}${this.agreement?.ready?.[seat] ? ' · committed' : ''}` }, h('b', {}, who), ` · ${n} order${n === 1 ? '' : 's'} · `, status);
      // during a stale review the frozen own plan folds away (one click / Enter reopens it in full)
      if (own && can.stale) return h('details', { class: `planbox ${seat.toLowerCase()} frozen` }, h('summary', {}, head), ...body);
      return h('div', { class: `planbox ${seat.toLowerCase()}${rd ? ' frozen' : ''}` }, head, ...body);
    };
    const ch = changes(opp);
    document.body.classList.toggle('responding', !!this.pendingChoice);
    const n = this.plans[me]?.length ?? 0;
    const banner = this.playback || this.resolving ? null
      : can.stale ? h('div', { class: 'plan-banner stale', role: 'status' }, h('b', {}, `${opp} changed its plan after your Ready`), ` — ${ch.added} new, ${ch.removed.length} removed (marked below). Your ${n} order${n === 1 ? '' : 's'} stay frozen; Acknowledge accepts the new pair without changing them.`)
      : can.current ? h('div', { class: 'plan-banner', role: 'status' }, `You are Ready: your ${n} order${n === 1 ? '' : 's'} are frozen for Tick ${s.tick}. Waiting for ${opp}.`)
      : can.edit ? h('div', { class: 'plan-banner dim' }, 'Your orders can change until you press ', term('ready'), '. Ready makes them ', term('frozen'), '; there is no Unready.')
      : null;
    this._renderReadyButton();
    const order = can.stale ? [opp, me] : [me, opp];
    this.el.plan.replaceChildren(...[
      h('div', { class: 'plan-head' }, h('h4', {}, `Public plans · Tick ${s.tick}`)),
      banner,
      h('div', { class: 'plans' }, ...order.map(box))].filter(Boolean));
    if (can.stale) this.el.plan.querySelector('.plans li.added, .plans li.removed')?.scrollIntoView({ block: 'nearest' });
  }

  /** Remove one order (a new public revision); remember it so it can be restored this Tick. */
  _removeOrder(seat, i) {
    const cmd = this.plans[seat][i];
    if (!this._setPlan(seat, this.plans[seat].filter((_, j) => j !== i))) return;
    (this._lastRemoved ??= {})[seat] = { cmd, index: i, tick: this.state.tick };
    // a dependent order (e.g. a cast its burn funded) stays visible and invalid; Ready names it
    const bad = this._planErrors(seat);
    this._toast(`Removed: ${describeCmd(this.state, cmd)}${bad.length ? ` — ${bad.length} dependent order${bad.length > 1 ? 's are' : ' is'} now invalid: ${bad[0].error}` : ''}`, !!bad.length);
    // keep the keyboard in the list: the next order's Remove, else Restore
    this._focusAfter = () => this.el.plan.querySelectorAll(`.planbox.${seat.toLowerCase()} button.x`)[i] ?? this.el.plan.querySelector('button.restore');
    this._renderAll();
  }

  /** Put the last removed order back at its original place (order matters: loads fund later moves). */
  _restoreOrder(seat) {
    const r = this._lastRemoved?.[seat];
    if (!r) return;
    const plan = [...this.plans[seat]];
    plan.splice(Math.min(r.index ?? plan.length, plan.length), 0, r.cmd);
    const err = validatePlan(this.state, this.ctx, seat, plan).errors.find((e) => e.index === Math.min(r.index ?? plan.length - 1, plan.length - 1));
    if (err) { this._toast(`Not restored: ${err.error}`, true); return; }
    if (this._setPlan(seat, plan)) {
      this._lastRemoved[seat] = null;
      this._toast(`Restored: ${describeCmd(this.state, r.cmd)}`);
      this._focusAfter = () => this.el.plan.querySelectorAll(`.planbox.${seat.toLowerCase()} button.x`)[r.index] ?? this.el.readyBig;
      this._renderAll();
    }
  }

  /** The words for the Ready action in its current state (shared by both Ready controls). */
  _readyLabel(me) {
    const c = this._can(me), opp = other(me), n = this.plans[me]?.length ?? 0, tick = this.state.tick;
    if (this.state.outcome) return { state: 'over', main: 'Match over', sub: '', pinned: 'Match over' };
    if (this.playback || this.resolving && !this.pendingChoice) return { state: 'resolving', main: 'Resolving…', sub: '', pinned: 'Resolving…' };
    if (this.pendingChoice) return { state: 'choice', main: 'Response window', sub: `${this.pendingChoice.req.seat} to respond or pass`, pinned: 'Response window open' };
    if (!c.human) return { state: 'watch', main: '', sub: '', pinned: `${me} is a bot` };
    if (c.stale) return { state: 'ack', main: 'Acknowledge updated plan ▶', sub: `Your plan is frozen · review ${opp}'s changes (NEW / REMOVED)`, pinned: `Acknowledge updated plan (${me})` };
    if (c.current) return { state: 'waiting', main: `Waiting for ${opp}…`, sub: `Your plan is frozen · ${opp} is planning`, pinned: `Ready ✓ · frozen (${me})` };
    if (c.invalid) return { state: 'blocked', main: `Fix ${c.invalid} order${c.invalid > 1 ? 's' : ''}`, sub: 'Open Orders: repair or remove the invalid orders before Ready', pinned: 'Ready blocked by invalid orders' };
    return n
      ? { state: 'ready', main: 'Ready ▶', sub: `Freeze my plan (${n} order${n > 1 ? 's' : ''}) · Tick ${tick} · Ctrl/⌘+Enter`, pinned: `Ready and freeze my plan (${me})` }
      : { state: 'ready', main: 'Ready ▶', sub: `Continue with existing orders · Tick ${tick} · Ctrl/⌘+Enter`, pinned: `Ready: continue with existing orders (${me})` };
  }

  /** The one Ready / Acknowledge button in the Public plans panel: freezes your plan for this Tick. */
  _renderReadyButton() {
    if (!this.el.readyBig) this.el.readyBig = h('button', { class: 'ready-big', onclick: () => (this._can(this.viewSeat).invalid ? this._toggleOrders(true) : this._pressReady()) });
    const me = this.viewSeat, b = this.el.readyBig;
    const L = this._readyLabel(me);
    b.hidden = L.state === 'watch' || L.state === 'over';
    b.disabled = !this._can(me).ready && !this._can(me).invalid; // blocked: it opens Orders to repair
    b.className = `ready-big ${L.state === 'ready' ? 'can' : L.state === 'ack' ? 'can ack' : L.state}`;
    b.replaceChildren(h('span', { class: 'rb-main' }, L.main), h('span', { class: 'rb-sub' }, L.sub));
  }

  _renderEvents() {
    const s = this.state;
    const evs = (this.playback ? this.playback.events.slice(0, this.playback.shown) : this.lastEvents ?? []).filter((e) => eventLine(s, e));
    const minted = this.tickEvents?.filter((e) => e.type === 'card_minted' || e.type === 'tick_started' || e.type === 'mana_expired') ?? [];
    const all = [...(this.playback ? [] : []), ...evs];
    const shown = (all.length ? all : minted).slice(-60);
    const histBtn = h('button', { class: 'ev-hist', title: 'Browse earlier Ticks (H)', onclick: () => this._toggleOrders(true, 'history') }, 'History');
    this.el.events.replaceChildren(histBtn, ...shown.map((e) => { const open = () => { this.inspectEvent = e.id; this.pinned = { kind: 'event', id: e.id, event: e }; this._renderAll(); }; return h('span', { class: `ev ev-${e.type}${this.inspectEvent === e.id ? ' sel' : ''}`, onclick: open, ...kbd(open) }, eventLine(s, e)); }));
    this.el.events.scrollLeft = this.el.events.scrollWidth;
  }

  /**
   * The pinned view shows only an explicit reference (a Card, basin, event, territory, or a party
   * the player asked to see in full). Command selection never opens it (addendum 02, HF2-01).
   */
  _syncInspection() {
    const ref = this.pinned;
    const subj = ref && ['card', 'party', 'hint', 'member', 'event', 'basin', 'territory'].includes(ref.kind)
      ? { kind: ref.kind, id: ref.kind === 'territory' ? `${ref.column},${ref.row}` : ref.id, event: ref.event } : null;
    const cur = this.inspect.pinnedSubject;
    if (subj && this.inspect.key(subj) !== this.inspect.key(cur)) this.inspect.pin(subj, { opener: document.activeElement });
    else if (!subj && cur) this.inspect.unpin({ restoreFocus: false });
    this.inspect.refresh();
  }

  /** Where keyboard routing lands: the required decision, else the pinned view. */
  _inspectorEl() { return this.pendingChoice ? this.el.decision : this.inspect.shown.pinned?.el ?? (this.el.cmdbar?.hidden === false ? this.el.cmdbar : this.el.decision); }

  /**
   * Content for an inspected subject, by stable id (addendum §3 "Lifecycle"): a consumed or
   * replaced Card shows as that instance's history, a merged party names its survivor.
   */
  _contentFor(sub) {
    const s = this.state;
    if (sub.kind === 'card') {
      const c = s.cards[sub.id];
      if (!c) return null;
      const def = activeCatalog.cards[c.abilityId];
      const type = c.major ? 'Major Arcana' : c.placedRow ? 'row Enchantment' : 'Minor Arcana';
      return { title: `${c.rank ?? ''} ${SUIT_NAME[c.suit] ? `of ${SUIT_NAME[c.suit]}` : def?.title ?? 'Card'}`.trim(), tag: `${c.owner === this.viewSeat ? 'Your' : `${c.owner}'s`} ${type}`, node: this._cardPanel(c) };
    }
    if (sub.kind === 'party') {
      const p = s.parties[sub.id];
      if (!p) return null;
      if (p.retired) return { title: `${partyShort(s, p.id)} (merged)`, tag: 'history', node: h('div', {}, h('p', {}, `This party merged into ${partyShort(s, p.mergedInto)}.`), h('button', { class: 'linkish', onclick: () => { this.pinned = { kind: 'hint', id: p.mergedInto }; this._renderAll(); } }, `Read ${partyShort(s, p.mergedInto)}`)) };
      return { title: `${p.mount ? cap(p.mount) : 'Pawn'}${p.commander ? ' ★ Commander' : ''}`, tag: p.owner === this.viewSeat ? 'Yours' : `${p.owner}'s`, node: this._partyPanel(p) };
    }
    if (sub.kind === 'hint') {
      const p = s.parties[sub.id];
      if (!p || p.retired) return null;
      const living = Object.values(p.slots).filter((id) => id && s.members[id]?.alive).length, planned = this._plannedSupply(p);
      const why = p.owner === this.viewSeat ? this._moveReason(p) : null;
      return { title: `${p.owner === this.viewSeat ? 'Your' : `${p.owner}'s`} ${p.mount ? cap(p.mount) : 'Pawn'}${p.commander ? ' ★' : ''} · R${p.region.row}C${p.region.column}`, tag: 'party', compact: true,
        node: h('div', { class: 'hint-line' }, `${living}/9${p.mount ? ` · Speed ${speedText(this.ctx, p)}/Tick` : ''} · Supply ${pts(supplyOf(p))}${planned ? ` (+${pts(planned)} planned)` : ''} · ${stateWord(s, p)}${p.destination ? ` → R${p.destination.row}C${p.destination.column}` : ''}`, why ? h('div', { class: 'warn' }, why) : null,
          this.pinned?.kind === 'hint' && this.pinned.id === p.id ? h('div', {}, h('button', { onclick: () => this._focusInspect(p.id) }, 'Inspect up close (F)'), this.selected?.kind === 'party' && this.selected.id !== p.id ? h('span', { class: 'dim' }, ` · your ${partyShort(s, this.selected.id)} stays selected`) : null)
            : h('div', { class: 'dim' }, this._commandable(p) ? 'Click to command · F or zoom in to inspect its members' : 'Click to read · F or zoom in to inspect its members')) };
    }
    if (sub.kind === 'member') { const m = s.members[sub.id]; return m ? { title: memberName(s, m.id), tag: 'Member', node: this._memberPanel(m) } : null; }
    if (sub.kind === 'event') return sub.event ? { title: cap(sub.event.type.replace(/_/g, ' ')), tag: `Tick ${sub.event.tick ?? s.tick}`, node: this._eventPanel(sub.event) } : null;
    if (sub.kind === 'basin') return { title: `${sub.id}'s Fire Pit and Mana basin`, tag: 'Mana', node: this._basinPanel(sub.id) };
    if (sub.kind === 'territory') {
      const [column, row] = sub.id.split(',').map(Number);
      const occ = Object.values(s.parties).filter((p) => p.alive && !p.retired && p.region.column === column && p.region.row === row);
      const mana = [...this.ctx.profile.board.manaRows, ...this.ctx.profile.board.dualRows].includes(row);
      return { title: `Territory R${row}C${column}`, node: h('div', {}, h('p', {}, mana ? 'A Mana row: Cards minted from here can carry Mana. ' : '', s.activeColumns.includes(column) ? 'Its column is active this Tick.' : ''), h('p', {}, occ.length ? `Here: ${occ.map((p) => `${p.owner === this.viewSeat ? 'your' : `${p.owner}'s`} ${partyShort(s, p.id)}`).join('; ')}.` : 'Empty.')) };
    }
    return null;
  }

  /** The required response surface: shown at once, never behind a hover (addendum §2). */
  _renderDecision() {
    const pc = this.pendingChoice;
    this.el.decision.hidden = !pc;
    if (pc) this.el.decision.replaceChildren(this._responsePanel());
    else this.el.decision.replaceChildren();
  }

  /**
   * Orders & history (addendum 03, HF3-03): a voluntary drawer. "This Tick" holds the current
   * public plans (drafts, never history); "History" browses completed Ticks from the session's own
   * event record, grouped by Tick with a short result and expandable details. Nothing opens it
   * automatically and its Close always works.
   */
  _renderOrders() {
    this._renderPlan();
    this.el.orders.hidden = !this.ordersOpen;
    if (!this.ordersOpen) return;
    const tab = this.ordersTab ?? 'plan';
    const tabBtn = (id, label) => h('button', { class: `otab${tab === id ? ' on' : ''}`, role: 'tab', 'aria-selected': String(tab === id), onclick: () => { this.ordersTab = id; this._renderAll(); this.inspect.relayout(); } }, label);
    this.el.orders.replaceChildren(
      h('div', { class: 'orders-head' }, h('h3', {}, 'Orders & history'), h('div', { class: 'otabs', role: 'tablist' }, tabBtn('plan', `This Tick (${this.state.tick})`), tabBtn('history', 'History')),
        h('button', { class: 'peek-btn', 'aria-label': 'Close Orders and history', title: 'Close (Esc)', onclick: () => this._toggleOrders(false) }, '×')),
      ...(tab === 'history' ? [this._historyPanel()] : [this._nowPanel(), this.el.plan]));
  }

  /** Completed Ticks, newest first, from session.events (during playback only what has been shown). */
  _historyTicks() {
    const pb = this.playback;
    let evs = this.session.events;
    if (pb) { const hidden = new Set(pb.events.slice(pb.shown).map((e) => e.id)); evs = evs.filter((e) => !hidden.has(e.id)); }
    const by = new Map();
    for (const e of evs) { const t = e.tick ?? 0; if (!by.has(t)) by.set(t, []); by.get(t).push(e); }
    return [...by.entries()].sort((a, b) => b[0] - a[0]);
  }

  _historyPanel() {
    const s = this.state, ticks = this._historyTicks();
    if (!ticks.length) return h('div', { class: 'history dim' }, 'No completed Tick yet.');
    // default: the latest completed Tick (the open Tick holds only its minting until it resolves)
    const live = this.playback || this.resolving;
    const at = ticks.findIndex(([t]) => t === this.historyTick);
    const done = ticks.findIndex(([t]) => t < s.tick || live);
    const i = at >= 0 ? at : Math.max(0, done);
    const [tick, evs] = ticks[i];
    const GROUPS = [
      ['Movement', ['destination_set', 'region_entered', 'destination_reached', 'travel_blocked', 'travel_paused', 'parties_merged', 'elevation_changed', 'retreat_started', 'formation_change_started', 'formation_changed']],
      ['Resources', ['card_minted', 'supply_loaded', 'supply_spent', 'card_burned', 'mana_paid', 'mana_expired']],
      ['Cards and effects', ['ability_announced', 'ability_resolved', 'ability_countered', 'response_passed', 'effect_started', 'effect_ended', 'terrain_changed']],
      ['Combat', ['contact', 'engagement_started', 'exchange', 'card_damage', 'member_died', 'party_defeated', 'engagement_ended']],
    ];
    const known = new Set(GROUPS.flatMap(([, t]) => t));
    const lines = (list) => list.filter((e) => eventLine(s, e));
    const groups = GROUPS.map(([label, types]) => [label, lines(evs.filter((e) => types.includes(e.type)))]);
    groups.push(['Other', lines(evs.filter((e) => !known.has(e.type)))]);
    const count = (t) => evs.filter((e) => e.type === t).length;
    const summary = [count('destination_reached') && `${count('destination_reached')} arrived`, count('travel_blocked') && `${count('travel_blocked')} blocked`, count('card_burned') && `${count('card_burned')} burned`, count('supply_loaded') && `${count('supply_loaded')} Supply loaded`, count('ability_resolved') && `${count('ability_resolved')} abilities`, count('exchange') && `${count('exchange')} exchanges`, count('member_died') && `${count('member_died')} fell`].filter(Boolean).join(' · ') || 'No movement, Cards or combat';
    const open = (e) => { this.inspectEvent = e.id; this.pinned = { kind: 'event', id: e.id, event: e }; this._renderAll(); };
    const go = (j) => { this.historyTick = ticks[j][0]; this._renderAll(); this.el.orders.querySelector('.hist-nav button:not([disabled])')?.focus({ preventScroll: true }); };
    return h('div', { class: 'history' },
      h('div', { class: 'hist-nav' },
        h('button', { 'aria-label': 'Earlier Tick', disabled: i >= ticks.length - 1, onclick: () => go(i + 1) }, '◀'),
        h('select', { 'aria-label': 'Tick', onchange: (e) => { this.historyTick = Number(e.target.value); this._renderAll(); } }, ...ticks.map(([t]) => h('option', { value: t, selected: t === tick }, `Tick ${t}${t === s.tick ? (live ? ' (playing)' : ' (open: minted so far)') : ''}`))),
        h('button', { 'aria-label': 'Later Tick', disabled: i <= 0, onclick: () => go(i - 1) }, '▶')),
      h('p', { class: 'hist-sum' }, h('b', {}, `Tick ${tick}: `), summary),
      ...groups.filter(([, l]) => l.length).map(([label, l]) => h('details', { class: 'hist-group', open: l.length <= 6 ? true : null },
        h('summary', {}, `${label} (${l.length})`),
        h('ul', {}, ...l.map((e) => h('li', {}, h('button', { class: 'linkish', onclick: () => open(e) }, eventLine(s, e))))))));
  }

  _toggleOrders(open = !this.ordersOpen, tab = null) {
    this.ordersOpen = open;
    if (tab) this.ordersTab = tab;
    this._renderAll();
    this.inspect.relayout();
    this._avoidCache = null;
    if (open) this.el.orders.querySelector('h3')?.setAttribute('tabindex', '-1'), this.el.orders.querySelector('h3')?.focus();
    else this.el.ordersBtn?.focus();
  }

  /** Mana basin counters: sharp numerals attached to the world basins (§7). */
  _renderBasins() {
    const s = this.state;
    for (const seat of ['A', 'B']) {
      const el = this.el.basins[seat];
      // the primary answer is what can be spent now (HF3-06): this plan's burns credited and its
      // queued costs reserved; while a Tick resolves the actual pool (never projected twice)
      const avail = this._availablePool(seat);
      const entries = Object.entries(avail).filter(([, n]) => n > 0);
      const planning = !(this.resolving || this.playback || this.pendingChoice);
      el.replaceChildren(...[h('span', { class: 'bc-seat' }, seat), h('span', { class: 'bc-label' }, planning ? 'Available' : 'Pool'),
        ...(entries.length ? entries.map(([c, n]) => h('span', { class: `bc-chip c-${c}` }, h('img', { src: emblemURL(c, 16), alt: '' }), String(n))) : [h('span', { class: 'bc-empty' }, '0')])].filter(Boolean));
      el.title = planning ? `${seat}'s Mana available this Tick (its plan's burns credited, queued costs reserved; the plan stays editable until Ready)` : `${seat}'s Mana pool now`;
      el.setAttribute('aria-label', `${seat}'s Mana ${planning ? 'available this Tick' : 'pool'}: ${entries.length ? fmtMana(avail) : 'none'}`);
      const f = this._basinFlash;
      el.classList.toggle('gain', !!f && f.seat === seat && performance.now() - f.at < 900);
    }
    // burns are shown entering the flame when planned (_syncDraftMana): no ghost offerings linger
    for (const seat of ['A', 'B']) this.view.sites.setOfferings(seat, []);
  }

  /** Per frame: keep each basin counter on its basin, or at the viewport edge as a locator. */
  _placeBasinCounters() {
    for (const seat of ['A', 'B']) {
      const el = this.el.basins[seat], a = this._screenAnchor({ kind: 'basin', id: seat });
      const W = this.el.world.clientWidth, H = this.el.world.clientHeight;
      const x = a ? Math.max(8, Math.min(a.x, W - 8)) : (seat === this.viewSeat ? 60 : W - 60), y = a ? Math.max(8, Math.min(a.y, H - 8)) : H - 30;
      el.classList.toggle('edge', !a || a.x < 0 || a.x > W || a.y < 0 || a.y > H);
      el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
    }
  }

  /** The basin view: actual pool by named color, the plan's projection, and the conversion rules. */
  _basinPanel(seat) {
    const s = this.state, pool = s.players[seat].pool;
    const planning = !(this.resolving || this.playback || this.pendingChoice);
    const avail = this._availablePool(seat);
    const ev = planning ? projectPlan(s, this.ctx, seat, this.plans[seat]).events : [];
    const gained = {}, spent = {};
    for (const e of ev) {
      if (e.type === 'card_burned') for (const [c, n] of Object.entries(e.mana ?? {})) gained[c] = (gained[c] ?? 0) + n;
      if (e.type === 'mana_paid') for (const a of e.assigned ?? []) spent[a.color] = (spent[a.color] ?? 0) + (a.amount ?? 1);
    }
    const all = ['red', 'green', 'purple', 'yellow', 'blue', 'orange', 'black', 'white', 'rainbow'];
    const row = (c) => h('tr', {}, h('td', {}, h('img', { src: emblemURL(c, 16), alt: '' }), ` ${COLOR_NAME[c]}`), h('td', { class: 'big' }, String(avail[c] ?? 0)), planning ? h('td', { class: 'dim' }, `${pool[c] ?? 0} start${gained[c] ? ` + ${gained[c]} burned` : ''}${spent[c] ? ` − ${spent[c]} reserved` : ''}`) : null);
    const shown = all.filter((c) => pool[c] || avail[c] || gained[c] || spent[c]);
    const burnCmds = ev.filter((e) => e.type === 'card_burned');
    return h('div', { class: 'basin-view' },
      h('table', { class: 'mana-table' }, h('tr', {}, h('th', {}, term('mana')), h('th', {}, planning ? 'Available this Tick' : 'Pool now'), planning ? h('th', {}, 'From') : null), ...(shown.length ? shown.map(row) : [h('tr', {}, h('td', { colspan: 3, class: 'dim' }, 'None — burn a Mana-bearing Card in this Fire Pit: its colors are available at once, this Tick.'))])),
      planning ? h('p', { class: 'small' }, 'Burning a Card adds its colors now, so an ability later in ', seat === this.viewSeat ? 'your' : `${seat}'s`, ' plan can spend them this Tick. Queued costs are reserved at once. The plan stays editable until Ready; the opponent\'s responses can still change the outcome.') : null,
      burnCmds.length ? h('div', { class: 'small' }, h('b', {}, 'Burned this Tick: '), burnCmds.map((e) => `${cardShort(s, e.cardId)} (${Object.keys(e.mana ?? {}).length ? fmtMana(e.mana) : '0 Mana'})`).join(', ')) : null,
      h('p', { class: 'dim small' }, this.ctx.profile.resources.poolCarryover ? 'Unspent Mana carries over to the next Tick.' : 'Unspent Mana expires at the end of this Tick, before the next Tick\'s spending.'),
      h('p', { class: 'dim small' }, 'A Card does one thing: ', term('supply'), ' for a party, ', term('burn'), ' in the ', term('firepit'), ' for its Mana, or its ', term('ability'), '. ', term('rainbow'), ' pays any one color until a payment assigns it.'));
  }

  /**
   * What matters now, in plain words (review UX-13): what is active, what you can do, and what
   * Ready will commit or acknowledge.
   */
  _nowPanel() {
    const s = this.state, me = this.viewSeat, c = this._can(me), n = this.plans[me]?.length ?? 0;
    const cols = s.activeColumns.map((x) => `C${this.ctx.geo.toLocal(me, x, 1).column}`).join(' and ');
    const mine = Object.values(s.parties).filter((p) => p.owner === me && p.alive && !p.retired);
    const movable = mine.filter((p) => p.mount && s.activeColumns.includes(p.region.column)).length;
    const cards = Object.values(s.players[me].bank.minor).filter(Boolean).filter((id) => !this._plannedCardIds(me).has(id)).length;
    const moving = mine.filter((p) => p.destination).length;
    const ready = c.stale ? `it acknowledges ${other(me)}'s updated plan; your ${n} order${n === 1 ? '' : 's'} stay frozen.`
      : c.current ? `you already pressed it; waiting for ${other(me)}.`
      : n ? `it freezes your ${n} order${n === 1 ? '' : 's'} for Tick ${s.tick}.` : `it continues with existing orders${moving ? ` (${moving} of your parties keep moving)` : ''}.`;
    return h('div', { class: 'now' },
      h('h3', {}, `Tick ${s.tick} · you are ${me}`),
      h('div', {}, h('b', {}, 'Active: '), `your columns ${cols} mint new cards and take new move orders.`),
      c.edit ? h('div', {}, h('b', {}, 'You can: '), `spend ${cards} unplanned card${cards === 1 ? '' : 's'} (select a card for Supply…, Burn or its ability, or drag it onto a formation), and order ${movable} mounted part${movable === 1 ? 'y' : 'ies'} in active columns (select one, then Move to…).`)
        : h('div', {}, h('b', {}, 'You can: '), this._editRefusal(me) ?? 'watch this Tick resolve.'),
      h('div', {}, h('b', {}, 'If you press Ready: '), ready),
      this._lastResult());
  }

  /** The previous Tick's results as inspectable entries (review 02 opening journey, step 7). */
  _lastResult() {
    const s = this.state;
    const KEEP = new Set(['supply_loaded', 'card_burned', 'destination_reached', 'parties_merged', 'elevation_changed', 'member_died', 'ability_resolved', 'card_damage', 'exchange', 'terrain_changed', 'conceded']);
    const evs = this.playback ? [] : (this.lastEvents ?? []).filter((e) => KEEP.has(e.type) && eventLine(s, e));
    if (!evs.length) return null;
    const open = (e) => { this.inspectEvent = e.id; this.pinned = { kind: 'event', id: e.id, event: e }; this._focusInspectorNext = true; this._renderAll(); };
    return h('div', { class: 'last-result' },
      h('b', {}, `Tick ${evs[0].tick ?? s.tick - 1} result:`),
      h('ul', {}, ...evs.slice(0, 10).map((e) => h('li', {}, h('button', { class: 'linkish', onclick: () => open(e) }, eventLine(s, e))))),
      evs.length > 10 ? h('div', { class: 'dim small' }, `…and ${evs.length - 10} more in the event strip below.`) : null);
  }

  _hoverHelp() {
    const em = (c) => h('img', { class: 'lg-em', src: emblemURL(c, 14), alt: '' });
    return h('div', { class: 'legend' }, h('h4', {}, 'Legend'),
      h('div', {}, h('span', { class: 'lg-a' }, 'A'), ' single brackets and solid discs · ', h('span', { class: 'lg-b' }, 'B'), ' double brackets and ring discs; the arrow is the formation\'s front.'),
      h('div', {}, 'Striped column edges with an ACTIVE header: columns that mint and take new unit orders this Tick.'),
      h('div', {}, 'Thin glowing inlay + emblem plaque: a territory\'s color identity — ', em('red'), ' Red ', em('green'), ' Green ', em('purple'), ' Purple ', em('yellow'), ' Yellow ', em('blue'), ' Blue ', em('orange'), ' Orange ', em('black'), ' Black ', em('white'), ' White ', em('rainbow'), ' Rainbow.'),
      h('div', {}, 'Brass diamond on a slab: a Mana row. Brass dashed square: a Capital.'),
      h('div', {}, 'Ivory corner brackets: your selection. A small dashed square in a formation: an empty Pawn center.'),
      h('div', {}, 'Gold square under a member: a corner helper in the contact strip (still in its own party). Red triangle: it advanced into an enemy casualty\'s gap.'),
      h('div', {}, 'Terrain labels: ▲ HILLTOP, ▽ OPEN PIT (exposed), ▭ TUNNEL (roofed, not exposed), ✈ FLYING (a line drops to the floor). [ and ] step the height layers.'));
  }

  /**
   * Why a party cannot take a new move order now, in a few words (HF2-01), or null when it can.
   * Short forms of the same distinctions the full party view explains.
   */
  _moveReason(p) {
    const s = this.state;
    const blocked = this._blockInfo(p);
    if (blocked && !s.activeColumns.includes(p.region.column)) return `${blocked.text.split(' — ')[0]}. Next active Tick ${nextActivation(this.ctx.profile, p.region.column, s.tick) ?? '—'}`;
    if (!this._can(p.owner).edit) return this._can(p.owner).frozen ? 'Plan frozen after Ready' : this._editRefusal(p.owner);
    if (!p.mount) return 'Needs a Mount: a Pawn cannot move on its own';
    if (p.mountLost) return 'Mount lost: cannot travel';
    if (!s.activeColumns.includes(p.region.column)) return `C${this.ctx.geo.toLocal(p.owner, p.region.column, 1).column} inactive: next active Tick ${nextActivation(this.ctx.profile, p.region.column, s.tick) ?? '—'}`;
    if (!this._fundedTargets(p).some((d) => d.funded)) return 'No Supply for any route: load a Card first';
    if (blocked) return blocked.text;
    return null;
  }

  /**
   * The contextual command group for the command-selected party (addendum 02, HF2-01): docked at
   * the bottom of the field, small, never the party document. Supply, Move, Face and terrain work
   * reuse the same validated controls; Inspect frames the real formation; Details pins the full
   * party reference only when asked.
   */
  _renderCommandBar() {
    if (!this.el.cmdbar) {
      this.el.cmdbar = h('section', { class: 'cmdbar', role: 'region', 'aria-label': 'Selected party commands' });
      this.el.world.append(this.el.cmdbar);
      // the inspection bar docks just above the command bar, whatever its height (text scale)
      const bar = this.el.cmdbar;
      new ResizeObserver(() => { this.el.world.style.setProperty('--cmdbar-h', bar.hidden ? '0px' : `${bar.offsetHeight + 6}px`); this._avoidCache = null; }).observe(bar);
    }
    const bar = this.el.cmdbar, s = this.state;
    const p = this.selected?.kind === 'party' ? s.parties[this.selected.id] : null;
    if (!p || p.retired || !p.alive || this.playback) { bar.hidden = true; bar.replaceChildren(); return; }
    bar.hidden = false;
    const own = p.owner === this.viewSeat && this.seats[p.owner] === 'human';
    const open = this._cmdOpen;
    // one open menu at a time; its state lives here (re-rendering never races a toggle event)
    const menu = (key, label, body, disabled = false) => h('details', { class: 'cmd-menu', open: open === key && !disabled ? true : null },
      h('summary', { 'aria-disabled': disabled ? 'true' : null, 'aria-expanded': String(open === key), class: disabled ? 'off' : '', onclick: (e) => { e.preventDefault(); if (disabled) return; this._cmdOpen = this._cmdOpen === key ? null : key; this._renderCommandBar(); bar.querySelector(`details.cmd-menu[open] .cmd-pop button, details.cmd-menu[open] .cmd-pop summary`)?.focus(); } }, label),
      disabled ? null : h('div', { class: 'cmd-pop' }, body));
    const reason = own ? this._moveReason(p) : null;
    const planned = this._plannedSupply(p);
    const active = s.activeColumns.includes(p.region.column);
    const facing = own && p.mount && active && this._can(p.owner).edit && !p.formationChange
      ? h('div', { class: 'row' }, ...['N', 'E', 'S', 'W'].map((f) => h('button', { disabled: f === p.facing, onclick: () => { if (this._addCommand(p.owner, { type: 'change_formation', partyId: p.id, facing: f })) this._toast(`Formation change to face ${f} planned (one Tick)`); } }, f))) : null;
    const work = own && active && this._can(p.owner).edit ? this._workList(p) : null;
    const move = own && p.mount ? this._moveList(p) : null;
    bar.replaceChildren(...[
      h('div', { class: 'cmd-id' },
        h('b', {}, `${own ? 'Your' : `${p.owner}'s`} ${p.mount ? cap(p.mount) : 'Pawn'}${p.commander ? ' ★' : ''}`), ` R${p.region.row}C${p.region.column} · `,
        p.mount ? h('span', { class: 'speed-chip', title: `Speed: ${speedText(this.ctx, p)} territor${speedText(this.ctx, p) === '1' ? 'y' : 'ies'} per Tick on flat ground (uphill legs are slower)` }, term('speed', `Speed ${speedText(this.ctx, p)}`), '/Tick') : null, p.mount ? ' · ' : null, term('supply', `Supply ${pts(supplyOf(p))}`, { party: p, held: supplyOf(p), planned }), planned ? h('span', { class: 'planned-supply' }, ` +${pts(planned)}`) : null,
        reason ? h('span', { class: 'cmd-why', role: 'status' }, reason) : null),
      own ? h('div', { class: 'cmd-row' },
        menu('supply', 'Supply ▾', this._supplyLoader(p) ?? h('p', { class: 'dim small' }, 'No unplanned Cards.'), !this._can(p.owner).edit),
        p.mount ? menu('move', 'Move to ▾', move ?? h('p', { class: 'dim small' }, reason ?? 'No legal destination.'), !move) : null,
        p.mount ? menu('face', 'Face ▾', facing ?? h('p', { class: 'dim small' }, 'Not now'), !facing) : null,
        work ? menu('work', 'Work ▾', work) : null,
        h('button', { onclick: () => this._focusInspect(p.id), title: 'Frame this formation and read its members (F)' }, 'Inspect (F)'),
        this._returnPose ? h('button', { onclick: () => this._returnCamera(), title: 'Back to the view before Inspect (R)' }, '↩ Return (R)') : null,
        h('button', { class: 'linkish', onclick: () => { this.pinned = { kind: 'party', id: p.id }; this._renderAll(); } }, 'Details')) :
        h('div', { class: 'cmd-row' }, h('button', { onclick: () => this._focusInspect(p.id) }, 'Inspect (F)'), this._returnPose ? h('button', { onclick: () => this._returnCamera() }, '↩ Return (R)') : null, h('button', { class: 'linkish', onclick: () => { this.pinned = { kind: 'party', id: p.id }; this._renderAll(); } }, 'Details')),
    ].filter(Boolean));
    const lsw = own && p.mount === 'knight' ? this._lSwitcher(p) : null;
    if (lsw) bar.append(lsw);
    // the Move list inside the bar is open by default in its popover (no nested disclosure)
    const ml = bar.querySelector('details.movelist'); if (ml) ml.open = true;
  }

  _partyPanel(p) {
    const s = this.state, own = p.owner === this.viewSeat && this.seats[p.owner] === 'human';
    const local = this.ctx.geo.toLocal(p.owner, p.region.column, p.region.row);
    const grid = h('div', { class: 'fgrid' });
    for (let slot = 1; slot <= 9; slot++) {
      const id = p.slots[String(slot)];
      const m = id ? s.members[id] : null;
      const pickSlot = () => { if (m) { this.selected = { kind: 'member', id: m.id }; this._renderAll(); } };
      grid.append(h('div', { class: `slot${m ? (m.alive ? '' : ' dead') : ' empty'}${slot === 5 ? ' center' : ''}${m ? ` role-${m.archetype}` : ''}`, onclick: pickSlot, ...(m ? kbd(pickSlot, `Slot ${slot}: ${memberName(s, m.id)}${m.alive ? '' : ', fallen'}`) : {}), title: m ? memberName(s, m.id) : `slot ${slot} empty` },
        h('span', { class: 'sn' }, slot), m?.alive && m.helperAway ? h('span', { class: 'away', title: m.helperAway.kind === 'corner' ? `helping ${partyName(s, m.helperAway.helps)} in the contact strip` : 'advanced into an enemy gap' }, m.helperAway.kind === 'corner' ? '◇' : '▲') : null, m ? [h('b', {}, m.isCenter ? cap(p.mount ?? 'center') : ROLE_NAME[m.archetype] ?? ROLE_ABBR[m.archetype]), m.alive && !p.pool ? h('div', { class: 'hp' }, h('i', { style: `width:${Math.max(0, m.hp / m.maxHp) * 100}%` })) : m.alive ? null : h('small', {}, '†')] : h('small', { class: 'dim' }, slot === 5 ? 'empty center' : '')));
    }
    const engagedWith = Object.values(s.engagements).filter((e) => e.active && (e.a === p.id || e.b === p.id)).map((e) => (e.a === p.id ? e.b : e.a));
    const active = s.activeColumns.includes(p.region.column);
    const facing = (f) => h('button', { disabled: !own || !active || f === p.facing || !!p.formationChange || !this._can(p.owner).edit, title: p.state === 'engaged' ? 'In contact: combat keeps the old arrangement this Tick; the change fails if it would pull a touching member out of contact' : `face ${f} (one Tick)`, onclick: () => this._addCommand(p.owner, { type: 'change_formation', partyId: p.id, facing: f }) && this._toast(`Formation change to face ${f} planned (takes one Tick${p.state === 'engaged' ? '; legality is rechecked at completion' : ''})`) }, f);
    return h('div', {},
      (() => {
        const living = Object.values(p.slots).filter((id) => id && s.members[id].alive).length;
        const whose = p.owner === this.viewSeat ? 'yours' : `${p.owner}'s`;
        const planned = this._plannedSupply(p);
        return h('div', { class: 'ident' },
          h('h3', {}, `${p.mount ? cap(p.mount) : 'Pawn'}${p.commander ? ' ★ Commander' : ''}`, h('span', { class: `whose ${p.owner.toLowerCase()}` }, whose)),
          h('div', { class: 'ident-line' }, `${stateWord(s, p)}${engagedWith.length ? ` with ${engagedWith.map((id) => partyShort(s, id)).join(', ')}` : ''}${p.mountLost ? ' · mount lost' : ''} · faces ${FACING_NAME[p.facing]}${p.turn ? ` → ${FACING_NAME[p.turn.to]} at Tick end` : ''}`),
          h('div', { class: 'ident-line' }, `${living} member${living === 1 ? '' : 's'} · capacity 9 · Supply ${pts(supplyOf(p))}`, planned ? h('b', { class: 'planned-supply' }, ` → ${pts(supplyOf(p) + planned)} planned`) : null, p.destination ? ` · heading to R${p.destination.row}C${p.destination.column}` : ''));
      })(),
      h('details', { class: 'details' }, h('summary', {}, 'Details'),
        h('div', { class: 'kv' },
          h('span', {}, 'Territory'), h('span', {}, `global R${p.region.row}C${p.region.column}${p.owner !== 'A' || local.row !== p.region.row || local.column !== p.region.column ? ` · ${p.owner}'s home R${local.row}C${local.column}` : ''}`),
          h('span', {}, 'Record id'), h('span', { class: 'mono' }, p.id),
          h('span', {}, 'State'), h('span', {}, p.state))),
      h('div', { class: 'kv' },
        ...(() => { const st = standingOf(s, this.ctx, p); return st.kind === 'ground'
          ? [h('span', {}, term('exposure', 'Stands', { standing: 'surface ground, band +1, exposed' })), h('span', {}, 'surface ground (', term('band', 'band'), ' +1, exposed)')]
          : [h('span', {}, term('exposure', 'Stands', { standing: `${st.label}, ${st.exposed ? 'exposed' : 'not exposed'}` })), h('span', {}, `${st.label} · ${st.exposed ? 'exposed (counts for income and blocking)' : 'not exposed (roofed)'}`, h('div', { class: 'dim small' }, st.note))]; })(),
        h('span', {}, term('supply', 'Supply', { party: p, held: supplyOf(p), planned: this._plannedSupply(p), need: (() => { const d = this.plans[p.owner].find((c) => c.type === 'set_destination' && c.partyId === p.id); return d ? quoteRoute(this.state, this.ctx, p, d.target).required ?? null : null; })() })), h('span', {}, `${pts(supplyOf(p))}${p.supply.length ? ` (${p.supply.map((x) => `${pts(x.units)} from ${x.cardId}`).join(', ')})` : ''}`, this._plannedSupply(p) ? h('b', { class: 'planned-supply' }, ` +${pts(this._plannedSupply(p))} planned`) : null),
        h('span', {}, term('speed', 'Speed', { speed: p.mount ? this.ctx.profile.movement.speeds[p.mount].join('/') + ' step' : null })), h('span', {}, p.mount ? `${this.ctx.profile.movement.speeds[p.mount].join('/')} step per Tick` : 'none (needs a Mount)'),
        h('span', {}, term('route', 'Destination')), h('span', {}, (() => { const d = this.plans[p.owner].find((c) => c.type === 'set_destination' && c.partyId === p.id); return d ? `R${d.target.row}C${d.target.column} (planned)${p.destination ? `, replacing R${p.destination.row}C${p.destination.column}` : ''}` : p.destination ? `R${p.destination.row}C${p.destination.column} (${stateWord(s, p)})` : '—'; })()),
        p.pool ? h('span', {}, 'Party pool') : null, p.pool ? h('span', {}, `${pts(p.pool.hp)}/${pts(p.pool.max)} (maintenance)`) : null),
      h('h4', { title: 'The grid is the party\'s own frame: its front is at the top whatever way the camera looks.' }, `Formation · front (${FACING_NAME[p.facing]}) at top`), grid,
      own ? this._supplyLoader(p) : null,
      own ? h('div', { class: 'actions' },
        // one reason per restriction (R2-06): a frozen plan, an inactive column and an unmounted Pawn differ
        h('div', { class: 'dim small why' }, !this._can(p.owner).edit ? `${this._editRefusal(p.owner)}.`
          : !p.mount ? 'An unmounted Pawn has no Mount, so it cannot move. Supply loads into it and is stored; it moves only after merging under a mounted party.'
          : !active ? `Column C${local.column} is not active this Tick: it takes no new move, formation or work orders now, but Supply can still be loaded. It is next active on Tick ${nextActivation(this.ctx.profile, p.region.column, s.tick) ?? '—'}.`
          : supplyOf(p) + this._plannedSupply(p) <= 0 ? 'No Supply yet: each step costs 1 Supply, so load a card first (Load Supply above), then Move to….'
          : 'Choose Move to… below (or right-click a highlighted territory). Each step costs 1 Supply.'),
        p.mount && active && this._can(p.owner).edit ? this._moveList(p) : null,
        active && this._can(p.owner).edit ? this._workList(p) : null,
        h('div', { class: 'row' }, 'Face ', facing('N'), facing('E'), facing('S'), facing('W')),
        p.state === 'engaged' ? this._retreatPreview(p) : null,
        p.state === 'engaged' ? h('button', { disabled: !active || !this._can(p.owner).edit, onclick: () => { this.tool = { kind: 'retreat', partyId: p.id }; this._toast('Retreat: right-click a legal destination away from contact. Touching members die.'); } }, 'Retreat…') : null) : null);
  }

  /**
   * Every legal destination of an own party with its exact funding quote (addendum 01 §6), from a
   * projection of its seat's plan without this party's own unit orders — a new destination is
   * appended after every planned load, so all of them precede it. Cached per plan revision.
   */
  _fundedTargets(p, extraLoads = []) {
    const key = `${this.generation}:${this.state.tick}:${this.rev?.[p.owner]}:${p.id}:${extraLoads.join(',')}`;
    if (!extraLoads.length && this._fundCache?.key === key) return this._fundCache.list;
    const cmds = this.plans[p.owner].filter((c) => !(['set_destination', 'retreat'].includes(c.type) && c.partyId === p.id));
    const proj = projectPlan(this.state, this.ctx, p.owner, [...cmds, ...extraLoads.map((cardId) => ({ type: 'load_supply', cardId, partyId: p.id }))]);
    const q = proj.state.parties[p.id];
    // every legal destination with its quote and known clearance (HF3-01). A party between centers
    // keeps its starting territory as a destination: only actual arrival makes "already there".
    // A Knight (either_l_v1) gets both L paths with what each passes; the default is the L that
    // absorbs a Pawn on the way, else a clear one, else the first legal one.
    const pathInfo = (d, via) => {
      const r = routeFromHere(proj.state, this.ctx, q, d, via);
      const c = routeClearance(proj.state, this.ctx, q, r.path);
      const joins = r.path ? this._pawnOnPath(proj.state, q, r.path, c) : null;
      return { via, route: r.route, path: r.path, clearance: c, blocked: !c.clear && c.friendly, joins };
    };
    const list = q && q.mount && !q.mountLost ? quotedDestinations(proj.state, this.ctx, q).filter((d) => !(atNode(this.ctx, q) && d.column === q.region.column && d.row === q.region.row)).map((d) => {
      const paths = (d.vias ?? [d.via ?? null]).map((v) => pathInfo(d, v));
      const best = paths.find((x) => x.joins && !x.blocked) ?? paths.find((x) => !x.blocked) ?? paths[0];
      return { ...d, via: best.via ?? undefined, paths: d.vias ? paths : null, route: best.route, clearance: best.clearance, blocked: best.blocked, joins: best.joins };
    }) : [];
    if (!extraLoads.length) this._fundCache = { key, list };
    return list;
  }

  /** The known obstruction of a party's accepted travel, for the in-world cue and the command bar. */
  _blockInfo(p) {
    const b = p?.blockedBy;
    if (!b || !p.destination) return null;
    const by = this.state.parties[b.partyId];
    const c = routeClearance(this.state, this.ctx, p, p.route);
    const who = by ? `${by.owner === p.owner ? 'Your' : `${by.owner}'s`} ${by.mount ? cap(by.mount) : 'Pawn'} at R${by.region.row}C${by.region.column}` : 'A formation';
    return { at: c.clear ? null : c.at, label: `${by ? (by.mount ? cap(by.mount) : 'Pawn') : 'Body'} R${by?.region.row ?? '?'}C${by?.region.column ?? '?'}`, text: `${who} blocks its path — destination and Supply kept. When its column is active, order a clear route (returning to the territory it left is one).`, who };
  }

  _blockCue(p) { const b = this._blockInfo(p); return b?.at ? b : null; }

  /** The first friendly Pawn a path absorbs (a node it reaches before any obstruction), or null. */
  _pawnOnPath(state, party, path, clearance) {
    let size = Object.values(party.slots).filter((id) => id && state.members[id]?.alive).length;
    for (let i = 0; i < path.length; i++) {
      if (!clearance.clear && clearance.segment <= i) return null;
      const n = path[i];
      const pawn = Object.values(state.parties).find((o) => o.alive && !o.retired && o.owner === party.owner && !o.mount && o.x === n.x && o.y === n.y);
      if (pawn) { const k = Object.values(pawn.slots).filter((id) => id && state.members[id]?.alive).length; if (size + k <= 9) return pawn; }
    }
    return null;
  }

  /** The planned destination command of a party in its owner's draft, if any. */
  _draftMove(p) { return this.plans?.[p.owner]?.find((c) => c.type === 'set_destination' && c.partyId === p.id) ?? null; }

  /** Flip a Knight's drafted L path (L key or the switcher); the same validated command. */
  _flipL(p) {
    const cmd = p ? this._draftMove(p) : null;
    const d = cmd ? this._fundedTargets(p).find((x) => x.column === cmd.target.column && x.row === cmd.target.row) : null;
    if (!d?.paths || d.paths.length < 2) { this._toast(p ? 'Only a Knight with a planned destination and two legal L paths can flip its L' : 'Select your Knight first'); return; }
    const now = cmd.via ?? d.via, next = d.paths.find((x) => x.via !== now);
    if (this._addCommand(p.owner, { ...cmd, via: next.via })) this._toast(`L path to R${cmd.target.row}C${cmd.target.column}: via ${next.route.slice(0, 2).map((n) => `R${n.row}C${n.column}`).join(', ')}${next.joins ? ' · absorbs your Pawn' : ''}${next.blocked ? ' · ✕ blocked now' : ''} — right-click it again (or L) to flip`, next.blocked);
  }

  /** A small L icon: the path from the party's square in the viewer's orientation (forward is up). */
  _lIcon(p, route) {
    const geo = this.ctx.geo, me = this.viewSeat;
    const o = geo.toLocal(me, p.region.column, p.region.row);
    const pts = [[0, 0], ...route.map((n) => { const l = geo.toLocal(me, n.column, n.row); return [l.column - o.column, l.row - o.row]; })];
    const xs = pts.map(([x]) => x), ys = pts.map(([, y]) => y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const P = pts.map(([x, y]) => [12 + (x - cx) * 6, 12 - (y - cy) * 6]);
    const sp = h('span', { class: 'licon', 'aria-hidden': 'true' });
    sp.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22"><polyline points="${P.map((q) => q.join(',')).join(' ')}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><circle cx="${P[0][0]}" cy="${P[0][1]}" r="2.2" fill="currentColor" opacity=".6"/><path d="M${P.at(-1)[0] - 3} ${P.at(-1)[1] - 3}h6v6h-6z" fill="currentColor"/></svg>`;
    return sp;
  }

  _freeKnight(p) { return !!p && p.mount === 'knight' && knightTurnPolicy(this.ctx.profile) === 'free_follow_v1'; }

  /** The facing a drafted Knight order arrives with: chosen, else the direction of its last leg. */
  _arrivalFacing(p, cmd) {
    if (cmd.face) return { face: cmd.face, chosen: true };
    const r = routeFromHere(this.state, this.ctx, p, cmd.target, cmd.via ?? null);
    const pts = [{ x: p.x, y: p.y }, ...(r.path ?? [])];
    const a = pts.at(-2), b = pts.at(-1);
    const dx = b.x - a.x, dy = b.y - a.y;
    const face = Math.abs(dy) >= Math.abs(dx) ? (dy >= 0 ? 'N' : 'S') : (dx >= 0 ? 'E' : 'W');
    return { face, chosen: false };
  }

  /** Cycle a drafted Knight's arrival facing: as moving → the other three directions → as moving. */
  _cycleFace(p) {
    const cmd = p ? this._draftMove(p) : null;
    if (!cmd || !this._freeKnight(p)) { this._toast('Select your Knight with a planned destination first'); return; }
    const moving = this._arrivalFacing(p, { ...cmd, face: null }).face;
    const order = [null, ...FACES4.filter((f) => f !== moving)];
    const next = order[(order.indexOf(cmd.face ?? null) + 1) % order.length];
    const { face, ...rest } = cmd;
    if (this._addCommand(p.owner, next ? { ...rest, face: next } : rest)) this._toast(`Arrives facing ${next ? `${FACE_ARROW[next]} ${next}` : `${FACE_ARROW[moving]} ${moving} (the way it is moving)`} — Shift+right-click the destination (or O) to change`);
  }

  /** A facing arrow in the viewer's orientation (forward is up), for the switcher. */
  _faceIcon(face) {
    const geo = this.ctx.geo, me = this.viewSeat, f = FACINGS[face];
    const o = geo.toLocal(me, 5, 5), t = geo.toLocal(me, 5 + Math.sign(f.fx), 5 + Math.sign(f.fy));
    const ang = Math.atan2(t.column - o.column, t.row - o.row) * 180 / Math.PI;
    const sp = h('span', { class: 'ficon', 'aria-hidden': 'true' });
    sp.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20"><g transform="rotate(${ang} 12 12)"><path d="M12 3 19 13h-4.5v8h-5v-8H5Z" fill="currentColor"/></g></svg>`;
    return sp;
  }

  /** The Knight order row shown in the command bar while a Knight destination is drafted. */
  _lSwitcher(p) {
    const cmd = this._draftMove(p);
    if (!cmd) return null;
    const d = this._fundedTargets(p).find((x) => x.column === cmd.target.column && x.row === cmd.target.row);
    const free = this._freeKnight(p);
    if (!d || (!(d.paths?.length > 1) && !free)) return null;
    const now = cmd.via ?? d.via;
    const af = free ? this._arrivalFacing(p, cmd) : null;
    const faceBtn = free ? h('button', { class: `lsw face${af.chosen ? ' on' : ''}`, title: 'Facing on arrival — click (or Shift+right-click the destination, or O) to change', 'aria-label': `Arrives facing ${af.face}${af.chosen ? '' : ', the way it is moving'}; activate to change`, onclick: () => this._cycleFace(p) },
      this._faceIcon(af.face), h('span', {}, `arrive facing ${af.face}`), h('small', { class: 'dim' }, af.chosen ? ' (chosen)' : ' (as moving)')) : null;
    const pathBtns = d.paths?.length > 1 ? d.paths : [];
    return h('div', { class: 'lswitch', role: 'group', 'aria-label': `Knight order to R${d.row}C${d.column}` },
      h('span', { class: 'lsw-label' }, `To R${d.row}C${d.column}:`), faceBtn,
      ...pathBtns.map((x) => h('button', { role: 'radio', 'aria-checked': String(x.via === now), class: `lsw${x.via === now ? ' on' : ''}${x.blocked ? ' blocked' : ''}`, title: `${x.via === 'long' ? 'Two steps on the long axis first' : 'The short step first'}${x.blocked ? ' — blocked now' : ''}`,
        onclick: () => { if (x.via !== now) this._flipL(p); } },
        this._lIcon(p, x.route), h('span', {}, `via ${x.route.slice(0, 2).map((n) => `R${n.row}C${n.column}`).join(' → ')}`), x.joins ? h('b', { class: 'lsw-join' }, ' · absorbs Pawn') : null, x.blocked ? h('b', { class: 'lsw-block' }, ' · ✕ blocked') : null)),
      pathBtns.length ? h('kbd', { title: 'Flip the L path (or right-click the destination again)' }, 'L') : null, free ? h('kbd', { title: 'Change the arrival facing (or Shift+right-click the destination)' }, 'O') : null);
  }

  /** How many more destinations a Card would fund if loaded into this party ("if loaded" preview). */
  _rangeIfLoaded(p, cardId) {
    if (!p.mount || p.mountLost || destinationPolicy(this.ctx.profile) !== 'full_route_funded_v1') return null;
    const now = this._fundedTargets(p).filter((d) => d.funded).length;
    return this._fundedTargets(p, [cardId]).filter((d) => d.funded).length - now;
  }

  /**
   * Public destination intent on the board (addendum 01 §6): every party's accepted destination
   * with its actual status, and every draft destination in either public plan (a draft replaces the
   * accepted one in the drawing — never two active endpoints). Invalid drafts say UNFUNDED.
   */
  _syncIntents() {
    const s = this.state, list = [];
    if (this.playback) { this.view.syncIntents([], null); return; }
    const drafts = new Map();
    for (const seat of ['A', 'B']) {
      const bad = new Set(this._planErrors(seat).map((e) => e.index));
      this.plans[seat].forEach((c, i) => { if (c.type === 'set_destination' || c.type === 'retreat') drafts.set(c.partyId, { target: c.target, bad: bad.has(i), retreat: c.type === 'retreat' }); });
    }
    const bandAt = (p, t) => (p.movementMode === 'air' ? p.band : surfaceBand(s.terrain, t.column, t.row));
    for (const p of Object.values(s.parties)) {
      if (!p.alive || p.retired || !p.mount) continue;
      const d = drafts.get(p.id);
      if (d) { list.push({ partyId: p.id, owner: p.owner, piece: pieceOf(p), target: d.target, band: bandAt(p, d.target), status: d.bad ? 'UNFUNDED' : d.retreat ? 'RETREAT' : 'PLANNED', bad: d.bad }); continue; }
      if (!p.destination) continue;
      const engaged = p.state === 'engaged';
      const status = p.state === 'waiting_supply' ? 'PAUSED · SUPPLY' : engaged ? 'PAUSED · COMBAT' : (p.blockedTick ?? -9) >= s.tick - 1 ? 'BLOCKED' : 'TRAVELLING';
      list.push({ partyId: p.id, owner: p.owner, piece: pieceOf(p), target: p.destination, band: bandAt(p, p.destination), status });
    }
    const hov = this.inspect.transientSubject, pin = this.inspect.pinnedSubject;
    const emphasis = hov?.kind === 'party' ? hov.id : pin?.kind === 'party' ? pin.id : null;
    this.view.syncIntents(list, emphasis);
  }

  /**
   * Move without a right-click (addendum 01 §6): every destination the party's Supply funds for the
   * whole route — held plus earlier planned loads — nearest first, no cap; the legal targets it
   * cannot fund are summarised with their shortfall. The same validated command as the board.
   */
  _moveList(p) {
    const s = this.state;
    const all = this._fundedTargets(p).sort((a, b) => (a.required ?? 0) - (b.required ?? 0) || a.row - b.row || a.column - b.column);
    const funded = all.filter((d) => d.funded), unfunded = all.filter((d) => !d.funded);
    if (!all.length) return null;
    const need = (d) => `${pts(d.required)} Supply`;
    const strict = destinationPolicy(this.ctx.profile) === 'full_route_funded_v1';
    const held = all[0]?.held ?? supplyOf(p);
    return h('details', { class: 'movelist' }, h('summary', {}, `Move to… (${funded.length} funded${strict ? ` with ${pts(held)} Supply` : ''}${unfunded.length ? ` · ${unfunded.length} need more` : ''})`),
      funded.length ? h('div', { class: 'row scrolly' }, ...funded.map((d) => {
        // who is there already: one of your Pawns means the move merges them
        const there = Object.values(s.parties).find((q) => q.alive && !q.retired && q.id !== p.id && q.region.column === d.column && q.region.row === d.row);
        const by = d.blocked ? s.parties[d.clearance.partyId] : null;
        const eta = travelTicks(s, this.ctx, p, d, d.paths ? d.via : null);
        const etaNote = eta ? ` · ~${eta.ticks} Tick${eta.ticks === 1 ? '' : 's'}${eta.turn ? ' (incl. 1 to turn)' : ''}` : '';
        const lnote = d.paths ? ` · L via ${d.route.slice(0, 2).map((n) => `R${n.row}C${n.column}`).join(', ')}${d.paths.length > 1 ? ' (L flips)' : ''}` : '';
        const note = (by ? ` · ✕ blocked by your ${partyShort(s, by.id)}` : '') + (there ? (there.owner === p.owner && !there.mount ? ' · joins your Pawn' : there.owner === p.owner ? ` · your ${partyShort(s, there.id)} is there` : ` · ${there.owner}'s party is there`) : '') + (d.direct ? ' · along its current segment' : '') + etaNote + lnote + (d.joins && !(there && there.id === d.joins.id) ? ' · absorbs your Pawn on the way' : '');
        return h('button', { class: d.blocked ? 'blocked' : null, 'aria-label': `Move ${partyShort(s, p.id)} to R${d.row}C${d.column}: needs ${need(d)}${note}`, onclick: () => {
          if (this._addCommand(p.owner, { type: 'set_destination', partyId: p.id, target: { column: d.column, row: d.row }, ...(d.paths ? { via: d.via } : {}) })) {
            const plan = routeFromHere(s, this.ctx, p, d, d.paths ? d.via : null);
            if (plan.path) this.view.showRoute(p, plan.path.map((n) => [n.x, n.y]));
            this._toast(`Destination: R${d.row}C${d.column} (planned, needs ${need(d)})${by ? ` — warning: your ${partyShort(s, by.id)} blocks this route now` : ''}`, !!by);
            this._cmdOpen = null; // the choice is made: the menu closes, the endpoint shows on the board
            // the keyboard follows the decision: the new order when Orders is open, else Ready
            this._focusAfter = () => (this.ordersOpen ? [...this.el.plan.querySelectorAll(`.planbox.${p.owner.toLowerCase()} button.x`)].at(-1) : null) ?? this.el.readyBig;
            this._renderAll();
          }
        } }, `R${d.row}C${d.column}`, h('small', { class: 'dim' }, ` ${need(d)}${etaNote}${note.replace(etaNote, '')}`));
      })) : h('p', { class: 'dim small' }, 'No destination is funded yet: load Supply first (above).'),
      unfunded.length ? h('p', { class: 'dim small' }, `${unfunded.length} more legal destination${unfunded.length > 1 ? 's' : ''} need more Supply for the whole route — e.g. R${unfunded[0].row}C${unfunded[0].column} needs ${need(unfunded[0])} (short ${pts(unfunded[0].shortfall)}).`) : null);
  }

  /**
   * Terrain work the rules allow this party now (review UX-11): each face-adjacent cube of its
   * center, for dig, fill and mine, filtered by the rules' own work check. Empty for most parties
   * (a surface center cannot dig the cube that supports it); shown only when something is legal.
   */
  _workList(p) {
    const s = this.state, U = this.ctx.U;
    const c = s.members[p.slots['5']];
    if (!c?.alive) return null;
    const here = { x: Math.round(c.x / U), y: Math.round(c.y / U), band: c.band ?? 1 };
    const bands = [-3, -2, -1, 1, 2, 3], bi = bands.indexOf(here.band);
    const near = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]].map(([dx, dy]) => ({ x: here.x + dx, y: here.y + dy, band: here.band }));
    if (bi > 0) near.push({ ...here, band: bands[bi - 1] });
    if (bi < bands.length - 1) near.push({ ...here, band: bands[bi + 1] });
    const WORD = { excavate: 'Dig', fill: 'Fill', extract: 'Mine' };
    const opts = [];
    for (const t of near) for (const work of ['excavate', 'fill', 'extract']) {
      const cmd = { type: 'begin_work', partyId: p.id, work, target: t };
      const v = validatePlan(s, this.ctx, p.owner, [...this.plans[p.owner], cmd]);
      if (!v.errors.some((e) => e.index === this.plans[p.owner].length)) opts.push(cmd);
    }
    if (!opts.length) return null;
    return h('details', { class: 'movelist' }, h('summary', {}, `Terrain work… (${opts.length} legal now; completes at the end of the Tick)`),
      h('div', { class: 'row' }, ...opts.map((cmd) => h('button', { onclick: () => { if (this._addCommand(p.owner, cmd)) this._toast(`${WORD[cmd.work]} planned at (${cmd.target.x}, ${cmd.target.y}) band ${fmtBand(cmd.target.band)}`); } },
        `${WORD[cmd.work]} `, h('small', { class: 'dim' }, `${cmd.target.x},${cmd.target.y} · ${fmtBand(cmd.target.band)}`)))));
  }

  /** Supply already planned for a party this Tick (it lands when the Tick resolves). */
  _plannedSupply(p) {
    return this.plans[p.owner].filter((c) => c.type === 'load_supply' && c.partyId === p.id).reduce((n, c) => n + (this.state.cards[c.cardId]?.supply ?? 0), 0);
  }

  /** One-click Supply: each of your available hand cards as a button that loads it into this party. */
  _supplyLoader(p) {
    const s = this.state, seat = p.owner;
    if (this.seats[seat] !== 'human' || s.outcome) return null;
    const planned = this._plannedCardIds(seat);
    const cards = Object.values(s.players[seat].bank.minor).filter(Boolean).map((id) => s.cards[id]).filter((c) => c.state === 'available' && !planned.has(c.id));
    return h('div', { class: 'supply-loader' },
      h('h4', {}, 'Load Supply'),
      cards.length
        ? h('div', { class: 'row' }, ...cards.map((c) => h('button', { disabled: !this._can(seat).edit, 'aria-label': `Load ${pts(c.supply)} Supply from ${cardShort(s, c.id)} into ${partyShort(s, p.id)}${Object.keys(c.mana ?? {}).length ? ` (gives up ${fmtMana(c.mana)} and its ability)` : ' (gives up its ability)'}`, title: `Spend ${c.id} as ${pts(c.supply)} Supply for this party (the card's Mana and ability are given up)`, onclick: () => { if (this._addCommand(seat, { type: 'load_supply', cardId: c.id, partyId: p.id })) { this._toast(`+${pts(c.supply)} Supply planned for ${partyName(s, p.id)} — it arrives when the Tick resolves`); this._cmdOpen = 'move'; this._focusAfter = () => this._inspectorEl().querySelector('details.cmd-menu[open] .movelist button') ?? this._inspectorEl().querySelector('details.movelist > summary') ?? this._inspectorEl().querySelector('.supply-loader button'); this._renderAll(); } } },
          `+${pts(c.supply)} `, h('small', { class: 'dim' }, `C${c.localColumn} ${c.rank}${SUIT[c.suit] ?? ''}`), (() => { const k = this._rangeIfLoaded(p, c.id); return k ? h('small', { class: 'ok' }, ` if loaded: +${k} destination${k > 1 ? 's' : ''}`) : null; })())))
        : h('p', { class: 'dim small' }, 'No unplanned hand cards. New cards mint from the highlighted columns each Tick.'),
      h('p', { class: 'dim small' }, 'While your plan is editable (before you press Ready), any available card can become Supply for any of your parties, in any column — not only active ones. Moving one step costs 1 Supply.'));
  }

  /** Retreat preview: own touching members are lost; neighbours' helpers go home alive. */
  _retreatPreview(p) {
    const s = this.state, tol = contactTolerance(this.ctx);
    const lost = new Set();
    for (const E of Object.values(s.engagements)) {
      if (!E.active || (E.a !== p.id && E.b !== p.id)) continue;
      const q = s.parties[E.a === p.id ? E.b : E.a];
      for (const pr of touchingPairs(s, this.ctx, p, q, tol)) if (s.members[pr.a].homeParty === p.id) lost.add(pr.a);
    }
    const helpers = Object.values(s.engagements).filter((E) => E.active && E.support?.helped === p.id).flatMap((E) => E.support.helpers).filter((id) => s.members[id]?.alive);
    return h('div', { class: 'preview small' },
      h('div', {}, `Retreat would lose: ${lost.size ? [...lost].map((id) => memberName(s, id)).join(', ') : 'nobody'}`),
      helpers.length ? h('div', {}, `Helpers returning alive: ${helpers.map((id) => memberName(s, id)).join(', ')}`) : null);
  }

  _memberPanel(m) {
    const s = this.state, arch = activeCatalog.archetypes[m.archetype];
    return h('div', {},
      h('h3', {}, memberName(s, m.id)),
      h('div', { class: 'kv' },
        h('span', {}, 'Party'), h('span', {}, partyName(s, m.party)),
        m.helperAway ? h('span', {}, 'Away') : null, m.helperAway ? h('span', {}, m.helperAway.kind === 'corner' ? `corner helper for ${partyName(s, m.helperAway.helps)} against ${partyName(s, m.helperAway.against)}${m.helperAway.pendingReturn ? ' (return pending)' : ''}` : `breach into ${partyName(s, m.helperAway.intoParty)} slot ${m.helperAway.intoSlot}`) : null,
        h('span', {}, 'HP'), h('span', {}, s.parties[m.party]?.pool ? 'party pool (see party)' : `${pts(m.hp)} / ${pts(m.maxHp)}`),
        h('span', {}, 'Definition'), h('span', {}, `${arch.title} · ${m.definition}`)),
      h('h4', {}, 'Attacks'), h('ul', {}, ...arch.attacks.map((a) => h('li', {}, `${a.hits} × ${a.power} ${a.channel} (${a.kind}${a.range ? `, range ${a.range}` : ''}${a.face === 'above' ? ', from Above' : ''})`))),
      h('h4', {}, 'Protection'), h('ul', {}, ...(arch.protections.length ? arch.protections.map((p) => h('li', {}, `${p.amount} ${p.channel} on ${Array.isArray(p.faces) ? p.faces.join(', ') : p.faces} (${p.scope})`)) : [h('li', { class: 'dim' }, 'none')])),
      h('button', { onclick: () => { this.selected = { kind: 'party', id: m.party }; this._renderAll(); } }, '← party'));
  }

  /**
   * A Card where it lies (addendum 01 §4), in order: identity and face; actual state of this
   * instance; exact resources (every Mana amount, zero included); its ability in plain words with
   * cost and consumption; the actions the viewer can take, or why not; then Details (lineage,
   * mint provenance, art attribution). The same validated commands as drag and drop.
   */
  _cardPanel(card) {
    const s = this.state, def = activeCatalog.cards[card.abilityId], seat = card.owner;
    const mine = seat === this.viewSeat && this.seats[seat] === 'human';
    const plannedUse = this._plannedCardIds(seat).has(card.id) ? this._plannedUse(seat, card.id) : null;
    const slotCol = String(card.column), inSlot = s.players[seat].bank.minor[slotCol] === card.id;
    const replacedBy = !inSlot && s.players[seat].bank.minor[slotCol] ? s.players[seat].bank.minor[slotCol] : null;
    const manaN = Object.values(card.mana ?? {}).reduce((n, v) => n + v, 0);
    const face = drawCardCanvas(card, s, 240, 320);
    face.className = 'inspect-face';
    face.setAttribute('role', 'img');
    face.setAttribute('aria-label', `${card.rank} of ${SUIT_NAME[card.suit] ?? card.suit}: Supply ${pts(card.supply ?? 0)}, ${manaN ? fmtMana(card.mana) : 'no Mana'}, ability ${def?.title ?? 'none'}`);
    const STATE = { available: 'Available in its bank slot', supply: 'Consumed: loaded as Supply', burned: 'Consumed: burned for Mana', played: 'Consumed: its ability was used', replaced: 'Replaced by a newer mint', reserved: 'Reserved for a pending use' };
    const stateLine = card.state === 'available' && !inSlot ? 'No longer in its slot' : STATE[card.state] ?? cap(card.state);
    const manaRows = Object.entries(card.mana ?? {}).filter(([, n]) => n > 0);
    const isMinor = card.supply != null;
    // the viewer's actions on this instance, or the reason there are none
    let actions;
    if (!mine) actions = h('p', { class: 'dim small' }, `${seat}'s public Card: you can inspect it; only ${seat} can use it.`);
    else if (card.state !== 'available' || !inSlot) actions = h('p', { class: 'dim small' }, 'This instance has been used; it has no actions.');
    else if (plannedUse) {
      const i = this.plans[seat].findIndex((c) => c.cardId === card.id || c.burns?.includes(card.id));
      actions = h('div', { class: 'actions' }, h('p', { class: 'small' }, h('b', {}, 'Planned: '), plannedUse, '. One instance, one use.'),
        this._can(seat).edit && i >= 0 ? h('button', { onclick: () => this._removeOrder(seat, i) }, 'Remove that order') : h('p', { class: 'dim small' }, this._editRefusal(seat) ?? ''));
    } else if (!this._can(seat).edit) actions = h('p', { class: 'dim small' }, `${this._editRefusal(seat)}.`);
    else {
      const parties = Object.values(s.parties).filter((p) => p.owner === seat && p.alive && !p.retired).sort((a, b) => a.localColumn - b.localColumn);
      actions = h('div', { class: 'actions' },
        h('p', { class: 'dim small' }, 'Choose one use for this Card:'),
        h('details', { class: 'supplyto' }, h('summary', {}, `Load Supply ${pts(card.supply)} into…`),
          h('div', { class: 'col' }, ...parties.map((p) => h('button', { 'aria-label': `Load ${pts(card.supply)} Supply from ${cardShort(s, card.id)} into ${partyShort(s, p.id)}`, onclick: () => { if (this._addCommand(seat, { type: 'load_supply', cardId: card.id, partyId: p.id })) { this._toast(`+${pts(card.supply)} Supply planned for ${partyName(s, p.id)} — it arrives when the Tick resolves`); this.selected = { kind: 'party', id: p.id }; this._focusInspectorNext = true; this._renderAll(); } } },
            `${partyShort(s, p.id)}`, h('small', { class: 'dim' }, ` Supply ${pts(supplyOf(p) + this._plannedSupply(p))} → ${pts(supplyOf(p) + this._plannedSupply(p) + card.supply)}`))))),
        h('button', { class: 'burn', 'aria-label': manaN ? `Burn ${cardShort(s, card.id)} for ${fmtMana(card.mana)}` : `Burn ${cardShort(s, card.id)} for 0 Mana; consumes this Card`, onclick: () => { if (this._addCommand(seat, { type: 'burn', cardId: card.id })) this._toast(manaN ? `Burned: +${fmtMana(card.mana)} available this Tick` : '0 Mana — the Card is consumed'); } },
          manaN ? `Burn for ${fmtMana(card.mana)}` : 'Burn for 0 Mana — consumes this Card'),
        def && def.category !== 'resource' ? h('button', { disabled: def.timing === 'response', title: def.timing === 'response' ? 'A response: offered when the opponent announces a Spell' : '', onclick: () => { this.pinned = { kind: 'card', id: card.id }; this._cardTool('ability'); } }, def.timing === 'response' ? `${def.title} (response only)` : `Use ${def.title}…`) : null,
        this.tool?.cardId === card.id && this.tool.step === 'facing' ? h('div', { class: 'row' }, 'Facing ', ...['N', 'E', 'S', 'W'].map((f) => h('button', { onclick: () => { this._addCommand(seat, { type: 'play_ability', cardId: card.id, actorPartyId: this.tool.actorPartyId, target: { facing: f } }); this.tool = null; this._renderAll(); } }, f))) : null);
    }
    const art = renditionFor(card);
    return h('div', { class: 'cardview' },
      h('div', { class: 'cv-top' }, face,
        h('div', {},
          h('div', { class: 'cv-id' }, `${card.rank ?? ''}${SUIT[card.suit] ?? ''} ${SUIT_NAME[card.suit] ? `of ${SUIT_NAME[card.suit]}` : ''}`),
          h('div', { class: 'small' }, `${seat === this.viewSeat ? 'Your' : `${seat}'s`} C${card.localColumn}`, isMinor ? [' · ', term('minor')] : null),
          h('div', { class: `cv-state ${card.state}` }, stateLine, plannedUse ? ` · planned: ${plannedUse}` : ''),
          replacedBy ? h('div', { class: 'small warn' }, `Its slot now holds ${cardShort(s, replacedBy)}.`) : null,
          isMinor ? h('div', { class: 'cv-res' }, h('div', {}, h('b', {}, term('supply')), ' ', pts(card.supply)),
            h('div', {}, h('b', {}, term('mana')), ' ', manaRows.length ? manaRows.map(([c, n]) => h('span', { class: `mchip c-${c}` }, h('img', { src: emblemURL(c, 14), alt: '' }), `${n} ${COLOR_NAME[c]}`)) : '0 (none)')) : null)),
      h('h4', {}, def?.title ?? 'No attached ability', def ? h('span', { class: 'dim small' }, ' · ', term('ability', def.category === 'spell' ? 'Spell' : def.category === 'skill' ? 'Skill' : 'ability')) : null),
      def ? h('p', { class: 'small' }, def.text, def.cost?.mana && Object.keys(def.cost.mana).length ? h('span', { class: 'dim' }, ` Cost: ${fmtMana(def.cost.mana)}${def.cost.consumeSourceInstance ? ', consumes this Card' : ''}.`) : null) : null,
      actions,
      h('details', { class: 'details' }, h('summary', {}, 'Details'),
        h('div', { class: 'kv' },
          h('span', {}, 'Instance'), h('span', { class: 'mono' }, card.id),
          h('span', {}, 'Minted'), h('span', {}, `Tick ${card.tick}${card.frontierParty ? ` from ${partyName(s, card.frontierParty)}` : ''}${card.blocker ? `, cut at ${card.blocker}` : ''}`),
          h('span', {}, 'Definition'), h('span', {}, `${card.ability} · creator ${def?.lineage?.creator?.label ?? def?.lineage?.creator?.id ?? '—'}${def?.lineage?.parents?.length ? ` · derived from ${def.lineage.parents.map((p) => (typeof p === 'string' ? p : `${p.id}@${p.revision}`)).join(', ')}` : ''}`)),
        card.pips?.length ? h('div', { class: 'small' }, 'Mana provenance: ', ...card.pips.map((p) => h('span', { class: `chip c-${p.color}` }, `R${p.row}:${COLOR_LETTER[p.color]}${p.amount}`))) : null,
        art ? h('div', { class: 'artcredit small' }, h('span', { class: 'dim' }, `Face: “${art.title}” from the ${art.deck} (local rendition; the art stays with its owner and never affects play)`))
          : h('p', { class: 'dim small' }, 'Face: procedural placeholder (no local rendition for this rank and suit; play is identical)')));
  }

  _eventPanel(e) {
    const s = this.state;
    if (e.type === 'exchange') {
      return h('div', {}, h('h3', {}, `Exchange · Tick ${e.tick} (${e.cause.replace('_', ' ')})`),
        h('p', { class: 'dim small' }, `Protection ${e.mode.protection}, allocation ${e.mode.allocation}, health ${e.mode.health}. All hits come from one snapshot and land together.`),
        h('ol', { class: 'hits' }, ...e.hits.map((x) => h('li', {}, explainHit(s, x)))));
    }
    const causes = [e.cardId ? `card ${cardShort(s, e.cardId)}` : null, e.partyId ? partyShort(s, e.partyId) : null, e.memberId ? memberName(s, e.memberId) : null, e.seat ? `player ${e.seat}` : null].filter(Boolean);
    return h('div', {}, h('h3', {}, cap(e.type.replace(/_/g, ' '))), h('p', {}, eventLine(s, e) ?? ''),
      causes.length ? h('p', { class: 'dim small' }, `Involves: ${causes.join(' · ')} · Tick ${e.tick ?? s.tick}`) : null,
      // the Card behind a resolved result stays one step away (its instance, Supply and Mana)
      e.cardId && s.cards[e.cardId] ? h('button', { class: 'linkish', onclick: () => { this.pinned = { kind: 'card', id: e.cardId }; this._focusInspectorNext = true; this._renderAll(); } }, `Inspect the Card: ${cardShort(s, e.cardId)} (Supply ${pts(s.cards[e.cardId].supply)}, ${Object.keys(s.cards[e.cardId].mana ?? {}).length ? fmtMana(s.cards[e.cardId].mana) : 'no Mana'})`) : null,
      e.partyId && s.parties[e.partyId]?.alive ? h('button', { class: 'linkish', onclick: () => { this.inspect.dismissTop?.(); this._focusInspect(e.partyId); this._focusInspectBarNext = true; this._renderAll(); } }, `Inspect the party: ${partyShort(s, e.partyId)}`) : null,
      h('details', { class: 'details' }, h('summary', {}, 'Details (exact record)'), h('pre', { class: 'raw' }, JSON.stringify(e, null, 1).slice(0, 1600))));
  }

  /**
   * A required response (review 02, R2-02/R2-04): what is pending and what it does, every eligible
   * response with its exact cost and the Cards it would burn to pay, and Pass with its consequence.
   * Focus lands on the first choice when the window opens and returns to the inspector after.
   */
  _responsePanel() {
    const { req, resolve } = this.pendingChoice;
    const s = this.state;
    const opts = responseOptions(s, this.ctx, req.seat);
    const top = req.stack[req.stack.length - 1];
    const target = req.stack.slice().reverse().find((e) => opts.targets.includes(e.id)) ?? null;
    const finish = (answer) => { this.pendingChoice = null; this.selected = null; this._focusInspectorNext = true; resolve(answer); this._renderAll(); };
    const actor = Object.values(s.parties).find((p) => p.owner === req.seat && p.alive && !p.retired);
    const effect = (e) => {
      const def = activeCatalog.cards[e.defId];
      const tgt = e.target?.memberId ? ` at ${memberName(s, e.target.memberId)}` : e.target?.stackId ? ` against ${req.stack.find((x) => x.id === e.target.stackId) ? activeCatalog.cards[req.stack.find((x) => x.id === e.target.stackId).defId]?.title : e.target.stackId}` : '';
      return h('li', {}, h('b', {}, `${e.seat === req.seat ? 'Your' : `${e.seat}'s`} ${def?.title ?? e.defId}`), tgt, e.countered ? ' — countered' : '', def?.cost?.mana ? h('span', { class: 'dim' }, ` · paid ${fmtMana(def.cost.mana)}`) : null,
        h('div', { class: 'dim small' }, def?.text ?? ''));
    };
    const pool = s.players[req.seat].pool;
    const choices = opts.cards.map((id) => {
      const c = s.cards[id];
      const def = activeCatalog.cards[c.abilityId];
      const cost = def?.cost?.mana ?? {};
      // the same allocation the rules use: one Rainbow cannot cover two requirements
      const quote = this._responseQuote(req.seat, def, id);
      const burns = quote.burns;
      const affordable = !!quote.payment;
      const why = !target ? 'nothing pending can be countered' : !affordable ? `needs ${fmtMana(cost)}; your pool and unplanned Cards cannot pay it` : null;
      return h('div', { class: 'resp-opt' },
        h('button', { class: 'primary', disabled: !!why, 'aria-describedby': `resp-${id}`, onclick: () => finish({ cardId: id, actorPartyId: actor.id, target: { stackId: target.id }, burns }) },
          `${def.title} (${cardShort(s, id)})`),
        h('div', { class: 'small', id: `resp-${id}` },
          def.text, h('br'), h('b', {}, 'Cost: '), Object.keys(cost).length ? fmtMana(cost) : 'none',
          burns.length ? ` — burns ${burns.map((x) => `${cardShort(s, x)} (${fmtMana(s.cards[x].mana)})`).join(', ')} now` : Object.keys(cost).length ? ' — from your pool' : '',
          def.cost?.consumeSourceInstance ? `; ${cardShort(s, id)} is consumed` : '', why ? h('div', { class: 'warn' }, `Unavailable: ${why}.`) : null));
    });
    return h('div', { class: 'response', role: 'group', 'aria-label': `Response window for ${req.seat}` },
      h('h3', {}, term('response', 'Response window'), ` · ${req.seat} to act`),
      h('p', {}, `${top.seat === req.seat ? 'Your' : `${top.seat}'s`} ${activeCatalog.cards[top.defId]?.title ?? 'effect'} is waiting to resolve. Plans are locked; you may answer it with a response Card or Pass.`),
      h('h4', {}, 'Pending (last resolves first)'),
      h('ol', { class: 'stack' }, ...req.stack.map(effect)),
      h('h4', {}, choices.length ? 'Your responses' : 'No response Cards'),
      ...choices,
      h('div', { class: 'resp-opt' },
        h('button', { 'data-autofocus': choices.length ? null : true, onclick: () => finish({ pass: true }) }, 'Pass'),
        h('div', { class: 'small dim' }, `Pass lets ${activeCatalog.cards[top.defId]?.title ?? 'the top effect'} resolve${req.stack.length > 1 ? ' (then the rest of the stack, last first)' : ''} once both players have passed in turn. No Mana or Card is spent.`)));
  }

  /** A response's payment from the actual pool at this choice (review 03, R3-01): the rules' quote. */
  _responseQuote(seat, def, sourceId) {
    return quotePayment({ ...this.state.players[seat].pool }, def.cost?.mana ?? {}, this._paymentCandidates(seat, sourceId, { planned: false }));
  }

}

function describeCmd(state, c) {
  switch (c.type) {
    // plain words first; exact ids stay in the event log and the card / party inspectors (UX-13)
    case 'load_supply': return `+${pts(state.cards[c.cardId]?.supply ?? 0)} Supply from ${cardShort(state, c.cardId)} → ${partyShort(state, c.partyId)}`;
    case 'burn': { const m = state.cards[c.cardId]?.mana; return `Burn ${cardShort(state, c.cardId)} for ${m && Object.keys(m).length ? fmtMana(m) : 'no Mana'}`; }
    case 'set_destination': return `Move ${partyShort(state, c.partyId)} → R${c.target.row}C${c.target.column}${c.via ? ` (${c.via === 'short' ? 'short step first' : 'long axis first'} L)` : ''}`;
    case 'change_formation': return `Turn ${partyShort(state, c.partyId)} to face ${FACING_NAME[c.facing] ?? c.facing}`;
    case 'retreat': return `Retreat ${partyShort(state, c.partyId)} → R${c.target.row}C${c.target.column}`;
    case 'play_ability': { const d = activeCatalog.cards[state.cards[c.cardId]?.abilityId]; const t = c.target?.memberId ? ` at ${memberName(state, c.target.memberId)}` : c.target?.row ? ` on row ${c.target.row}` : ''; return `Cast ${d?.title ?? 'ability'} from ${cardShort(state, c.cardId)}${c.actorPartyId ? ` by ${partyShort(state, c.actorPartyId)}` : ''}${t}${c.burns?.length ? `, burning ${c.burns.map((b) => cardShort(state, b)).join(', ')}` : ''}`; }
    case 'begin_work': return `${{ excavate: 'Dig', fill: 'Fill', extract: 'Mine', craft: 'Craft', equip: 'Equip' }[c.work] ?? c.work}${c.target ? ` at (${c.target.x}, ${c.target.y}) band ${fmtBand(c.target.band)}` : ''} by ${partyShort(state, c.partyId)}`;
    case 'concede': return 'Concede';
    default: return c.type;
  }
}

/** A card face for the world bank tiles. */
export function drawCardCanvas(card, state, w = 240, h2 = 320) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h2;
  const g = cv.getContext('2d');
  const def = activeCatalog.cards[card.abilityId];
  const k = w / 120; // design units: a 120 × 160 card
  g.scale(k, k);
  const W = 120, H = 160;
  // ivory face, slate keyline
  const face = g.createLinearGradient(0, 0, 0, H);
  face.addColorStop(0, '#F8F3E7'); face.addColorStop(1, '#E6DCC6');
  g.fillStyle = face; g.beginPath(); g.roundRect(1, 1, W - 2, H - 2, 7); g.fill();
  g.strokeStyle = INK.slate; g.lineWidth = 2; g.stroke();
  // owner: single corner brackets for A, double for B
  const oc = OWNER_HEX[card.owner];
  const brackets = (inset, lw) => {
    g.strokeStyle = oc; g.lineWidth = lw; const a = 14;
    for (const [x, y, dx, dy] of [[inset, inset, 1, 1], [W - inset, inset, -1, 1], [inset, H - inset, 1, -1], [W - inset, H - inset, -1, -1]]) {
      g.beginPath(); g.moveTo(x + dx * a, y); g.lineTo(x, y); g.lineTo(x, y + dy * a); g.stroke();
    }
  };
  brackets(6, 3);
  if (card.owner === 'B') brackets(11, 2);
  g.fillStyle = INK.slate; g.textAlign = 'center';
  if (card.category === 'major') {
    g.fillStyle = INK.brass; g.fillRect(14, 16, W - 28, 18);
    g.fillStyle = INK.slate; g.font = '700 10px Cinzel, Georgia, serif'; g.fillText('MAJOR ARCANA', W / 2, 29);
    g.font = '700 14px Cinzel, Georgia, serif';
    (def?.title ?? '').split(' ').forEach((wd, i) => g.fillText(wd, W / 2, 62 + i * 18));
    g.font = '10px system-ui, sans-serif'; g.fillStyle = '#4B5866';
    g.fillText(`${card.owner} · C${card.localColumn}`, W / 2, H - 18);
    return cv;
  }
  const art = renditionFor(card);
  if (art) { g.save(); g.beginPath(); g.rect(12, 44, W - 24, 62); g.clip(); drawCover(g, art.img, 12, 44, W - 24, 62); g.restore(); g.strokeStyle = 'rgba(23,33,45,0.6)'; g.lineWidth = 1; g.strokeRect(12, 44, W - 24, 62); }
  // rank and suit
  g.font = '700 30px Cinzel, Georgia, serif'; g.textAlign = 'left'; g.fillStyle = INK.slate;
  g.fillText(String(card.rank ?? ''), 14, 38);
  g.font = '22px Georgia, serif'; g.textAlign = 'right';
  g.fillText(SUIT_MARK[card.suit] ?? '', W - 14, 34);
  g.font = '600 8px system-ui, sans-serif'; g.fillStyle = '#4B5866';
  g.fillText((card.suit ?? '').toUpperCase(), W - 14, 43);
  // Supply and Mana (emblem + count), on a band
  const by = art ? 110 : 56;
  g.textAlign = 'left'; g.fillStyle = INK.slate; g.font = '700 13px system-ui, sans-serif';
  g.fillText(`Supply ${pts(card.supply ?? 0)}`, 14, by + 12);
  const mana = Object.entries(card.mana ?? {}).filter(([, n]) => n);
  let x = 14;
  if (!mana.length) { g.font = '11px system-ui, sans-serif'; g.fillStyle = '#5C6A78'; g.fillText('no Mana', 14, by + 30); }
  for (const [c, n] of mana) { drawEmblem(g, c, x + 7, by + 26, 7); g.fillStyle = INK.slate; g.font = '700 12px system-ui, sans-serif'; g.fillText(String(n), x + 16, by + 30); x += 30; }
  // the attached ability on a slate band
  g.fillStyle = INK.slate; g.fillRect(8, H - 26, W - 16, 18);
  g.fillStyle = INK.ivory; g.textAlign = 'center'; g.font = '600 10px system-ui, sans-serif';
  g.fillText(def?.title ?? '—', W / 2, H - 13);
  return cv;
}
