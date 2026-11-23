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
import { legalDestinations, planPartyRoute, routeOrigin, touchingPairs, contactTolerance, quotedDestinations, quoteRoute, destinationPolicy } from '../rules/movement.js';
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
import { openLab, anyProfile, labProfiles } from './lab.js';
import { localCatalog, localDecks } from './local-content.js';

const U = 1e6;
const SUIT = { wands: '♣', pentacles: '✪', cups: '♥', swords: '♠', wildcard: '✱' };
const SUIT_NAME = { wands: 'Wands', pentacles: 'Pentacles', cups: 'Cups', swords: 'Swords', wildcard: 'Wildcard' };
const ROLE_ABBR = { swordsman: 'Sw', pikeman: 'Pk', archer: 'Ar', mage: 'Mg', priest: 'Pr', center: '★' };
/** Role names shown with their marks (review UX-13: pair role icons with full names). */
const ROLE_NAME = { swordsman: 'Sword', pikeman: 'Pike', archer: 'Archer', mage: 'Mage', priest: 'Priest' };
const FACING_NAME = { N: 'North', E: 'East', S: 'South', W: 'West' };
const STATE_NAME = { idle: 'waiting', moving: 'moving', engaged: 'in combat', turning: 'turning', working: 'working' };
/** Attributes that make a click-driven element a keyboard button too (Enter / Space; review UX-14). */
const kbd = (fn, label) => ({ tabindex: '0', role: 'button', ...(label ? { 'aria-label': label } : {}), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); fn(e); } } });
const cap = (x) => (x ? x[0].toUpperCase() + x.slice(1) : x);
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
  constructor(root) {
    this.root = root;
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
      b.addEventListener('click', () => { this.selected = { kind: 'basin', id: seat }; this._renderAll(); });
    }
    // one contextual inspection system for Cards, parties, members, basins and events (§3)
    this.inspect = new InspectController({
      host: this.el.world,
      generation: () => this.generation ?? 0,
      build: (sub) => (this.session ? this._contentFor(sub) : null),
      project: (sub) => this._screenAnchor(sub),
      onPin: (sub) => { if (!sub && this.selected) { this.selected = null; this.view?.select(this.state, null); this._renderAll(); } },
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
      if (e.target.closest?.('button, .layer-rail, .cam-pad') || this.cam?.wasDrag() || this.cardDrag?.active || this.dragging) return;
      this._onPointer(e);
    });
    canvas.addEventListener('pointermove', (e) => { if (!this.cam?.dragging && !this.dragging) this._onHover(e); });
    canvas.addEventListener('pointerleave', () => this.inspect.hover(null));
    this.el.world.addEventListener('contextmenu', (e) => e.preventDefault());
    this.engine.addSystem({ name: 'versus', update: (dt) => this._frame(dt) });
    this.engine.start();
  }

  // --- setup -------------------------------------------------------------------------------------
  showSetup() {
    const profileSel = h('select', { id: 'set-profile' }, ...PROFILE_IDS.map((id) => h('option', { value: id, selected: id === DEFAULT_PROFILE_ID }, `${id} — ${profileById(id).title}${id === DEFAULT_PROFILE_ID ? ' (default)' : ''}`)), ...labProfiles().map((p) => h('option', { value: p.id }, `${p.id} — lab revision: ${p.changes.join(', ')}`)));
    const seatSel = (seat, dflt) => h('select', { id: `set-${seat}` }, h('option', { value: 'human', selected: dflt === 'human' }, 'Human'), h('option', { value: 'bot', selected: dflt === 'bot' }, 'Heuristic bot'));
    const seed = h('input', { id: 'set-seed', type: 'number', value: '1', min: '1' });
    const policySel = (seat) => h('select', { id: `set-pol-${seat}` }, ...ALLOCATION_POLICIES.map((p) => h('option', { value: p }, { slot_order: 'Slot order (fixture)', center_first: 'Center first (sacrifice the center)', protect_ranged: 'Protect ranged members' }[p])));
    this._overlayDismiss = false;
    this.el.overlay.replaceChildren(h('div', { class: 'card-sheet setup' },
      h('div', { class: 'title-emblems', 'aria-hidden': 'true' }, ...['red', 'purple', 'blue', 'black', 'rainbow', 'white', 'orange', 'yellow', 'green'].map((c) => h('img', { src: emblemURL(c, 18), alt: '' }))),
      h('h1', {}, 'Hapa Versus'),
      h('p', { class: 'lede' }, 'Two armies on a nine-column battlefield. Each Tick the highlighted columns mint public Minor Arcana from the territory you hold: spend a card as Supply to move, burn it for colored Mana, or play its attached ability. Win by moving a party center into the enemy Capital or killing the enemy Commander.'),
      h('div', { class: 'form' },
        h('label', { class: 'wide' }, 'Profile', profileSel),
        h('label', {}, 'Seat A (low rows)', seatSel('A', 'human')),
        h('label', {}, 'Seat B (high rows)', seatSel('B', 'bot')),
        h('label', {}, 'A standing damage allocation', policySel('A')),
        h('label', {}, 'B standing damage allocation', policySel('B')),
        h('label', {}, 'Seed', seed)),
      h('p', { class: 'dim small' }, 'Allocation applies when your seat assigns damage under the profile (attacker or defender allocation). It is public and recorded in the match manifest.'),
      h('div', { class: 'row' },
        h('button', { class: 'primary', onclick: () => this.startMatch({ profileId: profileSel.value, seats: { A: document.getElementById('set-A').value, B: document.getElementById('set-B').value }, seed: Number(seed.value) || 1, policies: { A: document.getElementById('set-pol-A').value, B: document.getElementById('set-pol-B').value } }) }, 'Start match'),
        h('button', { onclick: () => this.startMatch({ profileId: profileSel.value, seats: { A: 'bot', B: 'bot' }, seed: Number(seed.value) || 1, watch: true }) }, 'Watch bot vs bot')),
      h('div', { class: 'row' }, h('button', { onclick: () => openLab(this) }, 'Rules & experiments…'), h('span', { class: 'dim small' }, 'Edit a copy of a profile, compare profiles, run bot batches.')),
      h('div', { class: 'row' }, h('button', { onclick: () => openEditor(this) }, 'Cards & decks…'), h('span', { class: 'dim small' }, 'Edit Cards, bind them to columns for either seat, exchange bundles.')),
      h('details', {}, h('summary', {}, 'Diagnostic fixtures (labeled, not ordinary play)'),
        ...Object.entries(UI_FIXTURES).map(([id, f]) => h('div', { class: 'row fixture' },
          h('button', { onclick: () => this.startMatch({ fixture: id, seats: { A: 'human', B: 'human' } }) }, f.title),
          h('span', { class: 'dim small' }, f.description)))),
      h('details', {}, h('summary', {}, 'Controls'), h('div', { class: 'keys' },
        ...[['Left click', 'select a party, member, territory or card'], ['Right click', 'set the selected party\'s one destination'], ['1–9', 'select your hand slot (home column order)'], ['U / B / C', 'Supply, Burn or Ability with the selected card'], ['M', 'show legal destinations of the selected party'], ['G', 'formation facing tools'], ['P', 'plan comparison'], ['Ctrl/⌘ + Enter', 'Ready (freeze your plan for this pair)'], ['Esc', 'cancel the current tool'], ['Left-drag', 'pan the board'], ['Right-drag', 'orbit and tilt'], ['Wheel / pinch', 'zoom toward the cursor'], ['Shift + wheel', 'tilt'], ['W A S D / arrows', 'pan'], ['Q / E', 'rotate the camera 45°'], ['Z / X', 'tilt'], ['V', 'tactical view'], ['Home', 'home view'], ['F', 'focus the selection'], ['Space', 'pause playback']].map(([k, v]) => h('div', {}, h('kbd', {}, k), ' ', v)))),
    ));
    this.el.overlay.hidden = false;
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
    this.cam.setHome(this.viewSeat);
    this._renderCamPad();
    this.selected = null;
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
    for (const s of ['A', 'B']) if (this.bots[s]) { this.plans[s] = this.bots[s].plan(this.state, this.ctx); this.rev[s] = 1; }
    for (const s of ['A', 'B']) if (this.bots[s]) this.ready[s] = { ...this.rev };
    this.view.setActiveColumns(this.state.activeColumns);
    this.view.sync(this.state);
    this.view.syncBanks(this.state, drawCardCanvas);
    this._renderAll();
    const gen = this.generation;
    if (this.watch) setTimeout(() => { if (gen === this.generation) this._tryResolve(); }, 350 / this.speed);
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
    const frozen = !!this.ready?.[seat];
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
      ? `Your plan is frozen after Ready. Review ${other(seat)}'s changes, then Acknowledge updated plan`
      : 'Your plan is frozen after Ready (one Ready per phase; there is no Unready)';
  }

  /** Change a seat's public plan: a new revision; any Ready of the old pair becomes stale. */
  _setPlan(seat, cmds) {
    const refusal = this.bots[seat] ? null : this._editRefusal(seat);
    if (refusal) { this._toast(refusal, true); this._renderAll(); return false; }
    this.plans[seat] = cmds;
    this.rev[seat] += 1;
    for (const s of ['A', 'B']) if (this.bots[s]) this.ready[s] = { ...this.rev }; // bots re-acknowledge the new pair
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

  _readyValid(seat) { const r = this.ready[seat]; return !!r && r.A === this.rev.A && r.B === this.rev.B; }

  /**
   * Ready (first press) freezes the viewing seat's plan and acknowledges the current pair; after the
   * opponent revises, the same action acknowledges the updated pair. Refused while busy (resolving,
   * playback, a response window) or when this seat's acknowledgment is already current.
   */
  _pressReady() {
    if (!this.session) return;
    const seat = this.viewSeat;
    if (this._can(seat).invalid) { this._toast(`Ready is blocked: ${this._can(seat).invalid} invalid order${this._can(seat).invalid > 1 ? 's' : ''} — repair or remove them in Orders`, true); this._toggleOrders(true); return; }
    if (!this._can(seat).ready) return;
    this.sound?.play('confirm', { volume: 0.6 });
    // remember both plans as acknowledged, to show what the opponent changed afterwards
    this.ready[seat] = { ...this.rev, seen: { A: this.plans.A.map(cmdKey), B: this.plans.B.map(cmdKey) } };
    this._renderAll();
    const opp = other(seat);
    if (this.seats.A === 'human' && this.seats.B === 'human' && !this._readyValid(opp)) {
      this.viewSeat = opp;
      this._toast(this.ready[opp]
        ? `${seat} changed its plan after ${opp}'s Ready. ${opp}: your plan is frozen — review ${seat}'s changes, then Acknowledge updated plan.`
        : `${seat} is Ready and its plan is frozen. ${opp} plans now (hotseat).`);
      this._renderAll();
      return;
    }
    this._tryResolve();
  }

  /** Resolve once both acknowledgments name the current pair; a latch makes it single-entry. */
  async _tryResolve() {
    if (this.resolving) return;
    if (!(this._readyValid('A') && this._readyValid('B'))) return this._renderAll();
    const gen = this.generation;
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
    for (const s of ['A', 'B']) accepted[s] = validatePlan(state, ctx, s, this.plans[s]).accepted;
    // trace member positions during simulation (presentation only)
    const frames = [];
    const snap = (q, evLen) => frames.push({ q, pos: snapshot(state), evLen });
    let lastQ = -1;
    ctx.trace = (s, q, events) => { if (q - lastQ >= 20 || events.length !== frames.at(-1)?.evLen) { snap(q, events.length); lastQ = q; } };
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
    const events = step.value;
    session.events.push(...events);
    session.replay.ticks.push({ tick: state.tick, plans: clone(accepted), choices: answers, fingerprint: stateFingerprint(state) });
    this.tickEvents.push(...events);
    this.lastEvents = this.tickEvents;
    await this._play(before, frames, events);
    return owner === this.generation;
  }

  /** Release the current match's unfinished work (pending choice, playback) without continuing it. */
  _detachMatch() {
    const pc = this.pendingChoice, pb = this.playback;
    this.pendingChoice = null;
    this.playback = null;
    this.resolving = false;
    pc?.resolve({ pass: true, detached: true });
    pb?.resolve();
  }

  /** Play back a resolved Tick: members follow the traced trajectories; casualties fall at their event. */
  _play(before, frames, events) {
    const startPos = snapshot(before);
    const all = timeline(startPos, frames, events.length, eventsBeforeMovement(events));
    const duration = (this.watch ? 0.9 : 1.4) / this.speed;
    const moving = new Set();
    for (const m of Object.values(this.state.members)) { const a = startPos[m.id], b = [m.x, m.y]; if (a && (a[0] !== b[0] || a[1] !== b[1])) moving.add(m.id); }
    this.view.setWalking(moving);
    for (const t of this.view.supplyTokens?.values() ?? []) t.visible = false; // they return at their new places after playback
    this.view.syncPlanLinks(this.state, []); // the planned relationship ends where the resolved landing begins
    return new Promise((resolve) => {
      this.playback = { t: 0, duration, all, events, resolve, shown: 0, paused: false };
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
      if (e.code === 'Escape' && this.el.pickList) { this._closePickList(); return; }
      if (e.code === 'Escape' && document.body.classList.contains('roster-open')) { this._toggleRoster(false); return; }
      if (e.code === 'Escape' && this.inspect.dismissTop()) return; // the top contextual view first
      if (e.code === 'Escape' && this.ordersOpen && !this._can(this.viewSeat).stale) { this._toggleOrders(false); return; }
      if (e.code === 'Escape') { if (this.tool) { this.tool = null; this._renderAll(); } else { this.selected = null; this.view?.select(this.state, null); this._renderAll(); } return; }
      if (k === 'q') this.cam.rotate(45);
      else if (k === 'e') this.cam.rotate(-45);
      else if (k === 'z') this.cam.tilt(15);
      else if (k === 'x') this.cam.tilt(-15);
      else if (k === 'v') this.cam.toggleTactical();
      else if (e.code === 'Home') this.cam.home();
      else if (k === 'f') this._focusSelection();
      else if (e.code === 'Space' && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); if (this.playback) this.playback.paused = !this.playback.paused; }
      else if (/^[1-9]$/.test(e.key)) this._selectHandSlot(Number(e.key));
      else if (k === 'u') this._cardTool('supply');
      else if (k === 'b') this._cardTool('burn');
      else if (k === 'c') this._cardTool('ability');
      else if (k === 'm') this._showDestinations();
      else if (k === 'p') this._toggleOrders();
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
  _groundAt(cx, cy) {
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
        b('⌂', 'Home view (Home)', { onclick: () => cam.home() }),
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
    // hover inspects; it never selects, orders, moves the camera or takes focus (addendum §3)
    const card = this._cardTileAt(e);
    const site = card ? null : this._siteAt(e);
    const party = p?.candidates?.length === 1 ? p.candidates[0].party : p?.party ?? null;
    this.inspect.hover(card ? { kind: 'card', id: card } : site ? { kind: 'basin', id: site.seat } : party ? { kind: 'party', id: party.id } : null);
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
      if (id) { this.selected = { kind: 'card', id }; this._renderAll(); return; }
      const site = this._siteAt(e);
      if (site) { this.selected = { kind: 'basin', id: site.seat }; this._renderAll(); return; }
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
        if (this._addCommand(seat, { type, partyId: party.id, target: pick.territory })) {
          const plan = planPartyRoute(this.state, this.ctx, party, routeOrigin(this.state, this.ctx, party), pick.territory);
          if (plan.route) this.view.showRoute(party, plan.route.map((n) => { const c = this.ctx.geo.center(n.column, n.row); return [c.x, c.y]; }));
          this._toast(`${type === 'retreat' ? 'Retreat' : 'Destination'}: R${pick.territory.row}C${pick.territory.column} (planned)`);
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
    // plain selection
    if (pick.member && e.altKey) this.selected = { kind: 'member', id: pick.member.id };
    else if (pick.party) { this.selected = { kind: 'party', id: pick.party.id }; this._autoLayer(pick.party); }
    else this.selected = null; // empty ground: quiet board, nothing pinned
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
    return quotePayment(this._plannedPool(seat), def.cost?.mana ?? {}, this._paymentCandidates(seat, sourceId)).burns;
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
    this.selected = { kind: 'card', id };
    this._renderAll();
  }

  _cardTool(kind) {
    if (this.selected?.kind !== 'card') return this._toast('Select one of your hand cards first (1–9)');
    const card = this.state.cards[this.selected.id];
    if (card.owner !== this.viewSeat) return this._toast('That card belongs to the opponent');
    const refusal = this._editRefusal(card.owner);
    if (refusal) return this._toast(refusal, true);
    if (kind === 'burn') { if (this._addCommand(this.viewSeat, { type: 'burn', cardId: card.id })) this._toast(`Burn planned: +${fmtMana(card.mana)}`); return; }
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
    const busy = !!(this.cardDrag?.active || this.cam?.dragging);
    if (busy !== this._inspectBusy) { this._inspectBusy = busy; this.inspect.setSuspended(busy); }
    this.inspect.update();
    this._placeBasinCounters();
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
      const head = this._inspectorEl().querySelector('h3');
      if (head) { head.setAttribute('tabindex', '-1'); head.focus({ preventScroll: true }); return; }
    }
    if (panel && !document.contains(prev)) {
      const same = [...panel.querySelectorAll('button, [tabindex="0"], summary')].find((e) => (e.getAttribute('aria-label') || e.textContent || '').trim() === key);
      const head = this._inspectorEl().querySelector('h3');
      const target = same ?? (head && (head.setAttribute('tabindex', '-1'), head));
      target?.focus({ preventScroll: true });
    }
  }

  _renderAllInner() {
    this._renderMatchBar();
    this._renderRoster();
    this._renderOrders();
    this._renderDecision();
    this._renderBasins();
    this._syncInspection();
    this._renderEvents();
    this._renderLayers();
    this._renderToolHint();
    if (!this.playback) this.view.syncSupplyTokens(this.state, this._plannedSupplyMap());
    this.view.syncPlanLinks(this.state, this.playback ? [] : ['A', 'B'].flatMap((seat) => this.plans[seat].filter((c) => c.type === 'load_supply')));
    this.view.terrain.syncWork(this.state, this.playback ? [] : ['A', 'B'].flatMap((seat) => this.plans[seat].filter((c) => c.type === 'begin_work')));
    const sel = this.selected?.kind === 'party' ? this.state.parties[this.selected.id] : null;
    if (sel && !this.playback) this.view.select(this.state, sel, sel.owner === this.viewSeat && this.state.activeColumns.includes(sel.region.column) && sel.mount ? this._fundedTargets(sel).filter((d) => d.funded) : []);
    else if (!sel) this.view.select(this.state, null);
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
    this.el.ordersBtn = h('button', { class: `strip-btn orders${can.stale ? ' stale' : ''}${bad ? ' bad' : ''}`, 'aria-expanded': String(!!this.ordersOpen), 'aria-controls': 'orders', onclick: () => this._toggleOrders(), title: 'Public plans (P)' },
      'Orders ', h('b', {}, `${me} ${n(me)}`), ` · ${other(me)} ${n(other(me))}`, can.stale ? h('span', { class: 'badge warn' }, 'changed') : null, bad ? h('span', { class: 'badge bad' }, `${bad} invalid`) : null);
    this.el.navBtn = h('button', { class: 'strip-btn', 'aria-expanded': String(document.body.classList.contains('roster-open')), 'aria-controls': 'roster', title: 'Parties and Cards (N)', onclick: () => this._toggleRoster() }, '☰ Parties & Cards');
    this.el.matchbar.replaceChildren(...[
      h('div', { class: `crest ${me.toLowerCase()}`, title: `You are seat ${me}` }, me, h('small', {}, this.seats[me] === 'bot' ? 'bot' : 'you')),
      h('div', { class: 'tick' }, this.session.fixture ? h('span', { class: 'fixture-tag', title: 'This state was prepared directly as a diagnostic fixture; it did not emerge from ordinary play.' }, 'FIXTURE') : null, h('b', {}, `Tick ${s.tick}`), ` · ${r.period === 'prologue' ? 'Prologue' : `Round ${r.round}`}`),
      h('div', { class: 'active', title: 'Columns that mint Cards and take new unit orders this Tick' }, 'Active ', ...s.activeColumns.map((c) => h('span', { class: 'colchip' }, `C${this.ctx.geo.toLocal(me, c, 1).column}`))),
      h('div', { class: 'phase' }, this.playback ? 'Resolving…' : this.pendingChoice ? `Response · ${this.pendingChoice.req.seat} to act` : s.outcome ? 'Match over' : can.stale ? 'Review the changed plan' : can.current ? 'Ready — waiting' : 'Planning'),
      h('div', { class: 'cmds', title: 'Commander health (the match ends if one falls)' }, ...['A', 'B'].map((seat) => { const c = cmd(seat); return h('span', { class: `cmdhp ${seat.toLowerCase()}` }, `${seat}★ ${c?.alive ? `${pts(c.hp)}/${pts(c.maxHp)}` : 'fallen'}`); })),
      this.el.navBtn, this.el.ordersBtn, this.el.readyBig,
      h('div', { class: 'speed' }, h('label', {}, h('span', { class: 'sr' }, 'Playback speed '), h('select', { 'aria-label': 'Playback speed', onchange: (e) => (this.speed = Number(e.target.value)) }, ...[0.5, 1, 2, 4].map((v) => h('option', { value: v, selected: v === this.speed }, `${v}×`))))),
      h('button', { class: 'menu', 'aria-label': 'Help', 'aria-haspopup': 'dialog', onclick: () => this._help() }, '?'),
      this.sound ? h('button', { class: 'menu', 'aria-label': this.sound.muted ? 'Sound off' : 'Sound on', 'aria-pressed': String(!this.sound.muted), onclick: () => { this.sound.toggle(); this._renderMatchBar(); } }, this.sound.muted ? '🔇' : '🔊') : null,
      this.el.menuBtn = h('button', { class: 'menu', 'aria-label': 'Match menu', 'aria-haspopup': 'dialog', onclick: () => this._menu() }, '☰'),
    ].filter(Boolean));
  }

  /** Help on demand (the long teaching text that used to fill the inspector). */
  _help() {
    const keys = [['Hover / focus', 'inspect a Card, party or basin where it is'], ['Click / Enter', 'pin that view; Esc closes the top view'], ['N', 'Parties & Cards navigator'], ['P', 'Orders (public plans)'], ['Right click', 'set the selected party\'s destination'], ['1–9', 'inspect your Card in that home column'], ['U / B / C', 'Supply, Burn or Ability with the inspected Card'], ['Ctrl/⌘ + Enter', 'Ready (freezes your plan)'], ['Q / E · Z / X', 'rotate · tilt the camera'], ['V · Home · F', 'tactical · home · focus'], ['[ ]', 'height layers'], ['Space', 'pause playback']];
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
      h('div', { class: 'row' },
        h('button', { 'data-autofocus': true, onclick: () => this._closeSheet() }, 'Resume'),
        h('button', { onclick: () => this._downloadReplay() }, 'Download replay'),
        h('button', { onclick: () => this.showSetup() }, 'New match')),
      con.show ? h('div', { class: 'concede-box' },
        h('h3', {}, `Concede as ${seat}`),
        h('p', { class: 'small', id: 'concede-note' }, con.text),
        con.can ? h('button', { class: 'danger', 'aria-describedby': 'concede-note', onclick: () => this._confirmConcede(seat) }, `Concede as ${seat}…`) : null) : null), this.el.menuBtn);
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
    const subjectRow = (subject, label, text, cls = '') => {
      const pin = () => { this.selected = subject.kind === 'party' ? { kind: 'party', id: subject.id } : { kind: subject.kind, id: subject.id }; if (subject.kind === 'party') { this._autoLayer(s.parties[subject.id]); this._focusSelection(); } this._focusInspectorNext = true; this._renderAll(); };
      return h('button', { class: `rrow ${cls}${this.selected?.id === subject.id ? ' sel' : ''}`, 'aria-label': label, onclick: pin, onfocus: () => this.inspect.focusSubject(subject), onblur: () => this.inspect.blurSubject() }, ...text);
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
        subjectRow({ kind: 'basin', id: seat }, `${seat}'s Fire Pit and Mana basin: ${Object.keys(s.players[seat].pool).length ? fmtMana(s.players[seat].pool) : 'empty'}`, [h('b', {}, 'Fire Pit & Mana basin'), h('span', { class: 'dim' }, ` ${Object.keys(s.players[seat].pool).length ? fmtMana(s.players[seat].pool) : 'empty'}`)]))));
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
      const head = h('div', { class: 'phead', title: `revision r${this.rev[seat]}${rd ? ` · its Ready named A r${rd.A} · B r${rd.B}` : ''}` }, h('b', {}, who), ` · ${n} order${n === 1 ? '' : 's'} · `, status);
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
      : can.edit ? h('div', { class: 'plan-banner dim' }, 'Your orders can change until you press Ready. Ready freezes them; there is no Unready.')
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
    (this._lastRemoved ??= {})[seat] = { cmd, tick: this.state.tick };
    this._toast(`Removed: ${describeCmd(this.state, cmd)}`);
    // keep the keyboard in the list: the next order's Remove, else Restore
    this._focusAfter = () => this.el.plan.querySelectorAll(`.planbox.${seat.toLowerCase()} button.x`)[i] ?? this.el.plan.querySelector('button.restore');
    this._renderAll();
  }

  _restoreOrder(seat) {
    const r = this._lastRemoved?.[seat];
    if (!r) return;
    if (this._addCommand(seat, r.cmd)) {
      this._lastRemoved[seat] = null;
      this._toast(`Restored: ${describeCmd(this.state, r.cmd)}`);
      this._focusAfter = () => [...this.el.plan.querySelectorAll(`.planbox.${seat.toLowerCase()} button.x`)].at(-1) ?? this.el.readyBig;
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
    this.el.events.replaceChildren(...shown.map((e) => { const open = () => { this.inspectEvent = e.id; this.selected = { kind: 'event', id: e.id, event: e }; this._renderAll(); }; return h('span', { class: `ev ev-${e.type}${this.inspectEvent === e.id ? ' sel' : ''}`, onclick: open, ...kbd(open) }, eventLine(s, e)); }));
    this.el.events.scrollLeft = this.el.events.scrollWidth;
  }

  /** The pinned view follows the selection; hover views are the InspectController's own. */
  _syncInspection() {
    const sel = this.selected;
    const subj = sel && ['card', 'party', 'member', 'event', 'basin', 'territory'].includes(sel.kind)
      ? { kind: sel.kind, id: sel.kind === 'territory' ? `${sel.column},${sel.row}` : sel.id, event: sel.event } : null;
    const cur = this.inspect.pinnedSubject;
    if (subj && this.inspect.key(subj) !== this.inspect.key(cur)) this.inspect.pin(subj, { opener: document.activeElement });
    else if (!subj && cur) this.inspect.unpin({ restoreFocus: false });
    this.inspect.refresh();
  }

  /** Where keyboard routing lands: the required decision, else the pinned view. */
  _inspectorEl() { return this.pendingChoice || !this.inspect.shown.pinned ? this.el.decision : this.inspect.shown.pinned.el; }

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
      if (p.retired) return { title: `${partyShort(s, p.id)} (merged)`, tag: 'history', node: h('div', {}, h('p', {}, `This party merged into ${partyShort(s, p.mergedInto)}.`), h('button', { class: 'linkish', onclick: () => { this.selected = { kind: 'party', id: p.mergedInto }; this._renderAll(); } }, `Inspect ${partyShort(s, p.mergedInto)}`)) };
      return { title: `${p.mount ? cap(p.mount) : 'Pawn'}${p.commander ? ' ★ Commander' : ''}`, tag: p.owner === this.viewSeat ? 'Yours' : `${p.owner}'s`, node: this._partyPanel(p) };
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

  /** Orders: the public plans, opened on demand and automatically when an acknowledgment goes stale. */
  _renderOrders() {
    const me = this.viewSeat, can = this._can(me);
    const staleKey = can.stale ? `${this.state.tick}:${this.rev.A}:${this.rev.B}:${me}` : null;
    if (staleKey && staleKey !== this._staleKey) this.ordersOpen = true;
    this._staleKey = staleKey;
    this._renderPlan();
    this.el.orders.hidden = !this.ordersOpen;
    if (!this.ordersOpen) return;
    this.el.orders.replaceChildren(
      h('div', { class: 'orders-head' }, h('h3', {}, 'Orders'), h('button', { class: 'peek-btn', 'aria-label': 'Close Orders', disabled: can.stale, title: can.stale ? 'Review the changed plan, then Acknowledge' : 'Close (Esc)', onclick: () => this._toggleOrders(false) }, '×')),
      this._nowPanel(), this.el.plan);
  }

  _toggleOrders(open = !this.ordersOpen) {
    this.ordersOpen = open;
    this._renderAll();
    if (open) this.el.orders.querySelector('h3')?.setAttribute('tabindex', '-1'), this.el.orders.querySelector('h3')?.focus();
    else this.el.ordersBtn?.focus();
  }

  /** Mana basin counters: sharp numerals attached to the world basins (§7). */
  _renderBasins() {
    const s = this.state;
    for (const seat of ['A', 'B']) {
      const pool = s.players[seat].pool, el = this.el.basins[seat];
      // while a Tick resolves the state already holds its accepted burns: never project them twice
      const proj = this.resolving || this.playback || this.pendingChoice ? { ...pool } : this._plannedPool(seat);
      const entries = Object.entries(pool).filter(([, n]) => n > 0);
      const changed = JSON.stringify(Object.entries(proj).filter(([, n]) => n > 0).sort()) !== JSON.stringify(entries.slice().sort());
      el.replaceChildren(...[h('span', { class: 'bc-seat' }, seat),
        ...(entries.length ? entries.map(([c, n]) => h('span', { class: `bc-chip c-${c}` }, h('img', { src: emblemURL(c, 16), alt: '' }), String(n))) : [h('span', { class: 'bc-empty' }, 'Empty')]),
        changed ? h('span', { class: 'bc-proj', title: 'Projected after this plan' }, '→ plan') : null].filter(Boolean));
      el.setAttribute('aria-label', `${seat}'s Mana basin: ${entries.length ? fmtMana(pool) : 'empty'}${changed ? `; projected after its plan ${fmtMana(proj)}` : ''}`);
    }
    const offerings = (seat) => this.plans[seat].flatMap((c) => (c.type === 'burn' ? [c.cardId] : c.burns ?? [])).filter((id) => s.cards[id]).map((id) => drawCardCanvas(s.cards[id], s, 120, 160));
    for (const seat of ['A', 'B']) this.view.sites.setOfferings(seat, this.playback ? [] : offerings(seat));
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
    const proj = this.resolving || this.playback || this.pendingChoice ? { ...pool } : this._plannedPool(seat);
    const burns = this.plans[seat].filter((c) => c.type === 'burn');
    const all = ['red', 'green', 'purple', 'yellow', 'blue', 'orange', 'black', 'white', 'rainbow'];
    const row = (c) => h('tr', {}, h('td', {}, h('img', { src: emblemURL(c, 16), alt: '' }), ` ${COLOR_NAME[c]}`), h('td', {}, String(pool[c] ?? 0)), h('td', { class: (proj[c] ?? 0) !== (pool[c] ?? 0) ? 'ok' : 'dim' }, String(proj[c] ?? 0)));
    const shown = all.filter((c) => pool[c] || proj[c]);
    return h('div', { class: 'basin-view' },
      h('table', { class: 'mana-table' }, h('tr', {}, h('th', {}, 'Mana'), h('th', {}, 'Now'), h('th', {}, 'After plan')), ...(shown.length ? shown.map(row) : [h('tr', {}, h('td', { colspan: 3, class: 'dim' }, 'Empty — burn a Card in this Fire Pit to fill it.'))])),
      h('p', { class: 'small' }, '“After plan” projects ', seat === this.viewSeat ? 'your' : `${seat}'s`, ' public plan in order (its burns and payments). The opponent\'s plan and responses can still change what is available.'),
      burns.length ? h('div', { class: 'small' }, h('b', {}, 'Planned burns: '), burns.map((c) => cardShort(s, c.cardId)).join(', ')) : null,
      h('p', { class: 'dim small' }, this.ctx.profile.resources.poolCarryover ? 'Unspent Mana carries over to the next Tick.' : 'Unspent Mana expires at the Tick boundary.'),
      h('p', { class: 'dim small' }, 'A Card does one thing: Supply for a party, Burn in the Fire Pit for its Mana, or its ability. White has a dark rim, Black a light rim, Rainbow pays any color until it is assigned.'));
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
    const open = (e) => { this.inspectEvent = e.id; this.selected = { kind: 'event', id: e.id, event: e }; this._focusInspectorNext = true; this._renderAll(); };
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
          h('div', { class: 'ident-line' }, `${STATE_NAME[p.state] ?? p.state}${engagedWith.length ? ` with ${engagedWith.map((id) => partyShort(s, id)).join(', ')}` : ''}${p.mountLost ? ' · mount lost' : ''} · faces ${FACING_NAME[p.facing]}${p.turn ? ` → ${FACING_NAME[p.turn.to]} at Tick end` : ''}`),
          h('div', { class: 'ident-line' }, `${living} member${living === 1 ? '' : 's'} · capacity 9 · Supply ${pts(supplyOf(p))}`, planned ? h('b', { class: 'planned-supply' }, ` → ${pts(supplyOf(p) + planned)} planned`) : null, p.destination ? ` · heading to R${p.destination.row}C${p.destination.column}` : ''));
      })(),
      h('details', { class: 'details' }, h('summary', {}, 'Details'),
        h('div', { class: 'kv' },
          h('span', {}, 'Territory'), h('span', {}, `global R${p.region.row}C${p.region.column}${p.owner !== 'A' || local.row !== p.region.row || local.column !== p.region.column ? ` · ${p.owner}'s home R${local.row}C${local.column}` : ''}`),
          h('span', {}, 'Record id'), h('span', { class: 'mono' }, p.id),
          h('span', {}, 'State'), h('span', {}, p.state))),
      h('div', { class: 'kv' },
        ...(() => { const st = standingOf(s, this.ctx, p); return st.kind === 'ground'
          ? [h('span', {}, 'Stands'), h('span', {}, 'surface ground (band +1, exposed)')]
          : [h('span', {}, 'Stands'), h('span', {}, `${st.label} · ${st.exposed ? 'exposed (counts for income and blocking)' : 'not exposed (roofed)'}`, h('div', { class: 'dim small' }, st.note))]; })(),
        h('span', {}, 'Supply'), h('span', {}, `${pts(supplyOf(p))}${p.supply.length ? ` (${p.supply.map((x) => `${pts(x.units)} from ${x.cardId}`).join(', ')})` : ''}`, this._plannedSupply(p) ? h('b', { class: 'planned-supply' }, ` +${pts(this._plannedSupply(p))} planned`) : null),
        h('span', {}, 'Speed'), h('span', {}, p.mount ? `${this.ctx.profile.movement.speeds[p.mount].join('/')} step per Tick` : 'none (needs a Mount)'),
        h('span', {}, 'Destination'), h('span', {}, p.destination ? `R${p.destination.row}C${p.destination.column}` : '—'),
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
    const list = q && q.mount && !q.mountLost ? quotedDestinations(proj.state, this.ctx, q).filter((d) => d.column !== p.region.column || d.row !== p.region.row) : [];
    if (!extraLoads.length) this._fundCache = { key, list };
    return list;
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
        const note = there ? (there.owner === p.owner && !there.mount ? ' · joins your Pawn' : there.owner === p.owner ? ` · your ${partyShort(s, there.id)} is there` : ` · ${there.owner}'s party is there`) : '';
        return h('button', { 'aria-label': `Move ${partyShort(s, p.id)} to R${d.row}C${d.column}: needs ${need(d)}${note}`, onclick: () => {
          if (this._addCommand(p.owner, { type: 'set_destination', partyId: p.id, target: { column: d.column, row: d.row } })) {
            const plan = planPartyRoute(s, this.ctx, p, routeOrigin(s, this.ctx, p), d);
            if (plan.route) this.view.showRoute(p, plan.route.map((n) => { const c = this.ctx.geo.center(n.column, n.row); return [c.x, c.y]; }));
            this._toast(`Destination: R${d.row}C${d.column} (planned, needs ${need(d)})`);
            // the keyboard follows the decision: the new order when Orders is open, else Ready
            this._focusAfter = () => (this.ordersOpen ? [...this.el.plan.querySelectorAll(`.planbox.${p.owner.toLowerCase()} button.x`)].at(-1) : null) ?? this.el.readyBig;
            this._renderAll();
          }
        } }, `R${d.row}C${d.column}`, h('small', { class: 'dim' }, ` ${need(d)}${note}`));
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
        ? h('div', { class: 'row' }, ...cards.map((c) => h('button', { disabled: !this._can(seat).edit, 'aria-label': `Load ${pts(c.supply)} Supply from ${cardShort(s, c.id)} into ${partyShort(s, p.id)}${Object.keys(c.mana ?? {}).length ? ` (gives up ${fmtMana(c.mana)} and its ability)` : ' (gives up its ability)'}`, title: `Spend ${c.id} as ${pts(c.supply)} Supply for this party (the card's Mana and ability are given up)`, onclick: () => { if (this._addCommand(seat, { type: 'load_supply', cardId: c.id, partyId: p.id })) { this._toast(`+${pts(c.supply)} Supply planned for ${partyName(s, p.id)} — it arrives when the Tick resolves`); this._focusAfter = () => this._inspectorEl().querySelector('details.movelist > summary') ?? this._inspectorEl().querySelector('.supply-loader button'); this._renderAll(); } } },
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
        h('button', { class: 'burn', 'aria-label': manaN ? `Burn ${cardShort(s, card.id)} for ${fmtMana(card.mana)}` : `Burn ${cardShort(s, card.id)} for 0 Mana; consumes this Card`, onclick: () => { if (this._addCommand(seat, { type: 'burn', cardId: card.id })) this._toast(manaN ? `Burn planned: +${fmtMana(card.mana)} when the Tick resolves` : 'Burn planned for 0 Mana: the Card is consumed when the Tick resolves'); } },
          manaN ? `Burn for ${fmtMana(card.mana)}` : 'Burn for 0 Mana — consumes this Card'),
        def && def.category !== 'resource' ? h('button', { disabled: def.timing === 'response', title: def.timing === 'response' ? 'A response: offered when the opponent announces a Spell' : '', onclick: () => { this.selected = { kind: 'card', id: card.id }; this._cardTool('ability'); } }, def.timing === 'response' ? `${def.title} (response only)` : `Use ${def.title}…`) : null,
        this.tool?.cardId === card.id && this.tool.step === 'facing' ? h('div', { class: 'row' }, 'Facing ', ...['N', 'E', 'S', 'W'].map((f) => h('button', { onclick: () => { this._addCommand(seat, { type: 'play_ability', cardId: card.id, actorPartyId: this.tool.actorPartyId, target: { facing: f } }); this.tool = null; this._renderAll(); } }, f))) : null);
    }
    const art = renditionFor(card);
    return h('div', { class: 'cardview' },
      h('div', { class: 'cv-top' }, face,
        h('div', {},
          h('div', { class: 'cv-id' }, `${card.rank ?? ''}${SUIT[card.suit] ?? ''} ${SUIT_NAME[card.suit] ? `of ${SUIT_NAME[card.suit]}` : ''}`),
          h('div', { class: 'small' }, `${seat === this.viewSeat ? 'Your' : `${seat}'s`} C${card.localColumn}${isMinor ? ' · Minor Arcana' : ''}`),
          h('div', { class: `cv-state ${card.state}` }, stateLine, plannedUse ? ` · planned: ${plannedUse}` : ''),
          replacedBy ? h('div', { class: 'small warn' }, `Its slot now holds ${cardShort(s, replacedBy)}.`) : null,
          isMinor ? h('div', { class: 'cv-res' }, h('div', {}, h('b', {}, 'Supply '), pts(card.supply)),
            h('div', {}, h('b', {}, 'Mana '), manaRows.length ? manaRows.map(([c, n]) => h('span', { class: `mchip c-${c}` }, h('img', { src: emblemURL(c, 14), alt: '' }), `${n} ${COLOR_NAME[c]}`)) : '0 (none)')) : null)),
      h('h4', {}, def?.title ?? 'No attached ability'),
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
      e.cardId && s.cards[e.cardId] ? h('button', { class: 'linkish', onclick: () => { this.selected = { kind: 'card', id: e.cardId }; this._focusInspectorNext = true; this._renderAll(); } }, `Inspect the Card: ${cardShort(s, e.cardId)} (Supply ${pts(s.cards[e.cardId].supply)}, ${Object.keys(s.cards[e.cardId].mana ?? {}).length ? fmtMana(s.cards[e.cardId].mana) : 'no Mana'})`) : null,
      e.partyId && s.parties[e.partyId] ? h('button', { class: 'linkish', onclick: () => { this.selected = { kind: 'party', id: e.partyId }; this._focusInspectorNext = true; this._focusSelection(); this._renderAll(); } }, `Inspect the party: ${partyShort(s, e.partyId)}`) : null,
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
      h('h3', {}, `Response window · ${req.seat} to act`),
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
    case 'set_destination': return `Move ${partyShort(state, c.partyId)} → R${c.target.row}C${c.target.column}`;
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
