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
import { validatePlan, resolveTick, responseOptions } from '../rules/match.js';
import { legalDestinations, planPartyRoute, routeOrigin, touchingPairs, contactTolerance } from '../rules/movement.js';
import { mintForecast, nextActivation, roundOf, supplyOf } from '../rules/economy.js';
import { stateFingerprint, other } from '../rules/state.js';
import { summarize } from '../rules/stats.js';
import { clone, canonicalize } from '../rules/encoding.js';
import { HeuristicBot } from '../controllers/heuristic-bot.js';
import { ALLOCATION_POLICIES } from '../rules/combat.js';
import { profileById, PROFILE_IDS, BASE_PROFILE } from '../../../fixtures/hapa/profiles.js';
import { CATALOG } from '../../../fixtures/hapa/content.js';

/** The catalog the running match agreed (bundled + local Cards); presentation reads definitions from it. */
let activeCatalog = CATALOG;
/** A plan command's identity for change highlighting (canonical JSON, so key order never matters). */
const cmdKey = (c) => canonicalize(c);
import { UI_FIXTURES } from '../../../fixtures/hapa/ui-fixtures.js';
import { standingOf, fmtBand } from './terrain-view.js';
import { loadRenditions, renditionFor, drawCover } from './renditions.js';
import { h } from './dom.js';
import { VersusSound } from './sound.js';
import { buildScenery } from './scenery.js';
import { CardDrag } from './card-drag.js';
import { emblemURL, COLOR_NAME, drawEmblem, INK, HUE, SUIT_GLYPH as SUIT_MARK } from './palette.js';
import { openEditor } from './editor.js';
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
    r.append(area('matchbar'), area('opphand', 'ribbon'), area('roster', 'panel'), area('world'), area('inspector', 'panel'), area('ownhand', 'ribbon'), area('resources', 'panel'), area('plan', 'panel'), area('events'));
    // narrow windows (or enlarged text): the roster becomes a drawer opened from this toggle (review UX-06)
    this.el.rosterToggle = h('button', { class: 'roster-toggle', 'aria-controls': 'roster', 'aria-expanded': 'false', onclick: () => this._toggleRoster() }, '☰ Parties');
    r.append(this.el.rosterToggle);
    this.el.overlay = h('div', { id: 'overlay' });
    r.append(this.el.overlay);
    this.el.world.append(this.el.toast = h('div', { class: 'toast' }));
    this.el.world.append(this.el.compass = h('div', { class: 'compass' }));
    this.el.world.append(this.el.layers = h('div', { class: 'layer-rail', role: 'toolbar', 'aria-label': 'Height layers' }));
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
    this.el.world.addEventListener('contextmenu', (e) => e.preventDefault());
    this.engine.addSystem({ name: 'versus', update: (dt) => this._frame(dt) });
    this.engine.start();
  }

  // --- setup -------------------------------------------------------------------------------------
  showSetup() {
    const profileSel = h('select', { id: 'set-profile' }, ...PROFILE_IDS.map((id) => h('option', { value: id }, `${id} — ${profileById(id).title}`)), ...labProfiles().map((p) => h('option', { value: p.id }, `${p.id} — lab revision: ${p.changes.join(', ')}`)));
    const seatSel = (seat, dflt) => h('select', { id: `set-${seat}` }, h('option', { value: 'human', selected: dflt === 'human' }, 'Human'), h('option', { value: 'bot', selected: dflt === 'bot' }, 'Heuristic bot'));
    const seed = h('input', { id: 'set-seed', type: 'number', value: '1', min: '1' });
    const policySel = (seat) => h('select', { id: `set-pol-${seat}` }, ...ALLOCATION_POLICIES.map((p) => h('option', { value: p }, { slot_order: 'Slot order (fixture)', center_first: 'Center first (sacrifice the center)', protect_ranged: 'Protect ranged members' }[p])));
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

  async startMatch({ profileId = BASE_PROFILE.id, profile: profileObj = null, seats = { A: 'human', B: 'bot' }, seed = 1, watch = false, policies = { A: 'slot_order', B: 'slot_order' }, fixture = null }) {
    this.el.overlay.hidden = true;
    await loadCharacterKit(); // crowns, helmets and the guard preset are kit parts
    await loadRenditions(); // optional local card faces; placeholders otherwise
    const fx = fixture ? UI_FIXTURES[fixture] : null;
    if (fx) {
      // a labeled diagnostic fixture: its state is prepared directly, not reached by ordinary play
      this.session = createFixtureSession(fx.build(), { id: fixture, title: fx.title });
    } else {
      const profile = profileObj ? JSON.parse(JSON.stringify(profileObj)) : anyProfile(profileId) ?? profileById(BASE_PROFILE.id);
      profileId = profile.id;
      this.session = createSession({
        matchId: `local-${profileId}-${seed}-${Date.now().toString(36)}`, profile, catalog: localCatalog(), decks: localDecks(profile), seed, allocationPolicies: policies,
        controllers: { A: { type: seats.A, revision: seats.A === 'bot' ? 'heuristic-bot/0.1.0' : 'ui/0.1.0' }, B: { type: seats.B, revision: seats.B === 'bot' ? 'heuristic-bot/0.1.0' : 'ui/0.1.0' } },
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
    if (this.watch) setTimeout(() => this._tryResolve(), 350 / this.speed);
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
    return { human, busy, frozen, current, stale: frozen && !current, edit: human && !busy && !frozen, ready: human && !busy && !current };
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
    this.resolving = true;
    try { await this._resolveAgreed(); } finally { this.resolving = false; }
    if (this.state.outcome) this._showResult();
    else this._newTick();
  }

  async _resolveAgreed() {
    const { state, ctx } = this;
    const before = clone(state);
    const accepted = {};
    for (const s of ['A', 'B']) accepted[s] = validatePlan(state, ctx, s, this.plans[s]).accepted;
    // trace member positions during simulation (presentation only)
    const frames = [];
    const snap = (q, evLen) => {
      const pos = {};
      for (const m of Object.values(state.members)) pos[m.id] = [m.x, m.y];
      for (const p of Object.values(state.parties)) pos[`party:${p.id}`] = [p.x, p.y];
      frames.push({ q, pos, evLen });
    };
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
      answers.push(answer ?? { pass: true });
      step = gen.next(answer ?? { pass: true });
    }
    ctx.trace = null;
    const events = step.value;
    this.session.events.push(...events);
    this.session.replay.ticks.push({ tick: state.tick, plans: clone(accepted), choices: answers, fingerprint: stateFingerprint(state) });
    this.tickEvents.push(...events);
    this.lastEvents = this.tickEvents;
    await this._play(before, frames, events);
  }

  /** Play back a resolved Tick: members follow the traced trajectories; casualties fall at their event. */
  _play(before, frames, events) {
    const startPos = {};
    for (const m of Object.values(before.members)) startPos[m.id] = [m.x, m.y];
    for (const p of Object.values(before.parties)) startPos[`party:${p.id}`] = [p.x, p.y];
    const all = [{ q: 0, pos: startPos, evLen: 0 }, ...frames];
    if (all.length === 1) all.push({ q: 1000, pos: startPos, evLen: events.length });
    const duration = (this.watch ? 0.9 : 1.4) / this.speed;
    const moving = new Set();
    for (const m of Object.values(this.state.members)) { const a = startPos[m.id], b = [m.x, m.y]; if (a && (a[0] !== b[0] || a[1] !== b[1])) moving.add(m.id); }
    this.view.setWalking(moving);
    for (const t of this.view.supplyTokens?.values() ?? []) t.visible = false; // they return at their new places after playback
    this.view.syncPlanLinks(this.state, []); // the planned relationship ends where the resolved landing begins
    return new Promise((resolve) => {
      this.playback = { t: 0, duration, all, events, resolve, shown: 0, paused: false };
      this._renderReadyButton();
    });
  }

  /** Hit marks for newly reached exchange and Card-damage events (at most 48 per batch). */
  _spawnHits(events) {
    const posOf = (id) => this.view.sprites.get(id)?.position ?? null;
    const colorOfMember = (id) => activeCatalog.archetypes[this.state.members[id]?.archetype]?.color ?? null;
    let n = 0;
    for (const e of events) {
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
    const q = k * 1000;
    const all = pb.all;
    let i = 0;
    while (i < all.length - 1 && all[i + 1].q <= q) i++;
    const a = all[i], b = all[Math.min(i + 1, all.length - 1)];
    const f = b.q > a.q ? (q - a.q) / (b.q - a.q) : 1;
    const pos = {};
    for (const id of Object.keys(b.pos)) {
      const pa = a.pos[id] ?? b.pos[id], pb2 = b.pos[id];
      pos[id] = [pa[0] + (pb2[0] - pa[0]) * f, pa[1] + (pb2[1] - pa[1]) * f, true];
    }
    // casualties reveal at their event
    const evLen = a.evLen;
    const dead = new Set(pb.events.slice(0, evLen).filter((e) => e.type === 'member_died').map((e) => e.memberId));
    for (const id of Object.keys(pos)) if (dead.has(id)) pos[id][2] = false;
    for (const m of Object.values(this.state.members)) if (!m.alive && !(m.id in pos)) pos[m.id] = [m.x, m.y, false];
    this.view.sync(this.state, k >= 1 ? null : Object.fromEntries(Object.entries(pos).map(([id, p]) => [id, p[2] === false ? [p[0], p[1], false] : p]).map(([id, p]) => [id, p])));
    for (const [id, p] of Object.entries(pos)) { const spr = this.view.sprites.get(id); if (spr && k < 1) spr.visible = p[2] !== false && (this.state.members[id]?.alive || !dead.has(id)); }
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
      this._renderAll();
    });
  }

  // --- input -------------------------------------------------------------------------------------
  _bindKeys() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      this.keys.add(e.code);
      if (!this.session) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (!e.repeat) this._pressReady(); return; }
      if (e.code === 'Escape' && this.el.pickList) { this._closePickList(); return; }
      if (e.code === 'Escape' && document.body.classList.contains('roster-open')) { this._toggleRoster(false); return; }
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
      else if (k === 'g') this._renderInspector();
      else if (k === 'p') this.el.plan.scrollIntoView();
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
    if (e.button === 0) { const id = this._cardTileAt(e); if (id) { this.selected = { kind: 'card', id }; this._renderAll(); return; } }
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
    else if (pick.territory) this.selected = { kind: 'territory', ...pick.territory };
    else this.selected = null;
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
  _autoBurns(seat, def, sourceId) {
    const cost = def.cost?.mana ?? {};
    const pool = { ...this._plannedPool(seat) };
    const burns = [];
    const planned = this._plannedCardIds(seat);
    const enough = () => Object.entries(cost).every(([c, n]) => (pool[c] ?? 0) + (pool.rainbow ?? 0) >= n);
    for (const id of Object.values(this.state.players[seat].bank.minor).filter(Boolean)) {
      if (enough()) break;
      if (id === sourceId || planned.has(id)) continue;
      const card = this.state.cards[id];
      if (!Object.keys(cost).some((c) => card.mana[c] || card.mana.rainbow)) continue;
      burns.push(id);
      for (const [c, n] of Object.entries(card.mana)) pool[c] = (pool[c] ?? 0) + n;
    }
    return burns;
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

  _plannedPool(seat) {
    const pool = { ...this.state.players[seat].pool };
    for (const c of this.plans[seat]) if (c.type === 'burn') for (const [k, n] of Object.entries(this.state.cards[c.cardId]?.mana ?? {})) pool[k] = (pool[k] ?? 0) + n;
    return pool;
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
    if (party) this.view.select(this.state, party, legalDestinations(this.state, this.ctx, party));
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
    if (this._focusInspectorNext) {
      this._focusInspectorNext = false;
      const head = this.el.inspector.querySelector('h3');
      if (head) { head.setAttribute('tabindex', '-1'); head.focus({ preventScroll: true }); return; }
    }
    if (panel && !document.contains(prev)) {
      const same = [...panel.querySelectorAll('button, [tabindex="0"], summary')].find((e) => (e.getAttribute('aria-label') || e.textContent || '').trim() === key);
      const head = this.el.inspector.querySelector('h3');
      const target = same ?? (head && (head.setAttribute('tabindex', '-1'), head));
      target?.focus({ preventScroll: true });
    }
  }

  _renderAllInner() {
    this._renderMatchBar();
    this._renderHand(this.el.ownhand, this.viewSeat, true);
    this._renderHand(this.el.opphand, this.viewSeat === 'A' ? 'B' : 'A', false);
    this._renderRoster();
    this._renderInspector();
    this._renderResources();
    this._renderPlan();
    this._renderEvents();
    this._renderLayers();
    this._renderToolHint();
    if (!this.playback) this.view.syncSupplyTokens(this.state, this._plannedSupplyMap());
    this.view.syncPlanLinks(this.state, this.playback ? [] : ['A', 'B'].flatMap((seat) => this.plans[seat].filter((c) => c.type === 'load_supply')));
    const sel = this.selected?.kind === 'party' ? this.state.parties[this.selected.id] : null;
    if (sel && !this.playback) this.view.select(this.state, sel, sel.owner === this.viewSeat && this.state.activeColumns.includes(sel.region.column) && sel.mount ? legalDestinations(this.state, this.ctx, sel) : []);
    else if (!sel) this.view.select(this.state, null);
  }

  _renderMatchBar() {
    const s = this.state, p = this.ctx.profile;
    const r = roundOf(p, Math.max(1, s.tick));
    const cmd = (seat) => Object.values(s.members).find((m) => m.commander && m.owner === seat);
    const next = s.tick + 1;
    this.el.matchbar.replaceChildren(
      h('div', { class: 'crest a', title: `Seat A · ${this.seats.A}` }, 'A', h('small', {}, this.seats.A === 'bot' ? 'bot' : this.viewSeat === 'A' ? 'you' : 'human')),
      h('div', { class: 'tick' }, this.session.fixture ? h('span', { class: 'fixture-tag', title: 'This state was prepared directly as a diagnostic fixture; it did not emerge from ordinary play.' }, `FIXTURE · ${this.session.fixture.title}`) : null, h('b', {}, `Tick ${s.tick}`), ` · ${r.period === 'prologue' ? 'Prologue' : `Round ${r.round}`}`),
      h('div', { class: 'active' }, 'Active ', ...s.activeColumns.map((c) => h('span', { class: 'colchip' }, `C${c}`)), h('small', {}, ` next T${next}: ${this.ctx.profile.clock.activation[(next - 1) % 9].map((c) => `C${c}`).join('/')}`)),
      h('div', { class: 'phase' }, this.playback ? 'Resolving…' : this.pendingChoice ? `Response window · ${this.pendingChoice.req.seat} to act` : s.outcome ? 'Match over' : `Planning · you are ${this.viewSeat}`),
      h('div', { class: 'cmds' }, ...['A', 'B'].map((seat) => { const c = cmd(seat); return h('span', { class: `cmdhp ${seat.toLowerCase()}` }, `${seat} Commander ${c?.alive ? `${pts(c.hp)}/${pts(c.maxHp)} HP` : 'fallen'}`); })),
      h('div', { class: 'speed' }, h('label', {}, 'Playback ', h('select', { onchange: (e) => (this.speed = Number(e.target.value)) }, ...[0.5, 1, 2, 4].map((v) => h('option', { value: v, selected: v === this.speed }, `${v}×`))))),
      h('div', { class: 'crest b', title: `Seat B · ${this.seats.B}` }, 'B', h('small', {}, this.seats.B === 'bot' ? 'bot' : this.viewSeat === 'B' ? 'you' : 'human')),
      this.sound ? h('button', { class: 'menu', title: this.sound.muted ? 'Sound off (click to turn on)' : 'Sound on (click to mute)', 'aria-pressed': String(!this.sound.muted), onclick: () => { this.sound.toggle(); this._renderMatchBar(); } }, this.sound.muted ? '🔇' : '🔊') : null,
      h('button', { class: 'menu', onclick: () => this._menu() }, '☰'),
    );
  }

  _menu() {
    const seat = this.viewSeat;
    this.el.overlay.replaceChildren(h('div', { class: 'card-sheet' },
      h('h2', {}, 'Match menu'),
      h('p', {}, `Profile ${this.ctx.profile.id} · match ${this.state.matchId}`),
      h('p', {}, h('code', {}, stateFingerprint(this.state).slice(0, 23) + '…'), ' state fingerprint'),
      h('div', { class: 'row' },
        h('button', { onclick: () => { this.el.overlay.hidden = true; } }, 'Resume'),
        h('button', { onclick: () => this._downloadReplay() }, 'Download replay'),
        this.seats[seat] === 'human' && !this.state.outcome ? h('button', { class: 'danger', onclick: () => { this.el.overlay.hidden = true; this._addCommand(seat, { type: 'concede' }); this._toast('Concession planned: it takes effect when the Tick resolves'); } }, `Concede as ${seat}`) : null,
        h('button', { onclick: () => this.showSetup() }, 'New match'))));
    this.el.overlay.hidden = false;
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

  _renderHand(el, seat, own) {
    const s = this.state, geo = this.ctx.geo;
    const planned = this._plannedCardIds(seat);
    const tiles = [];
    // both ribbons follow the viewer's home columns, so position i is the same physical column in each
    // (Design Companion: "The opponent ribbon uses those same physical columns"); review UX-05
    for (let lc = 1; lc <= 9; lc++) {
      const col = geo.toGlobal(this.viewSeat, lc, 1).column;
      const ownerLc = geo.toLocal(seat, col, 1).column;
      const id = s.players[seat].bank.minor[String(col)];
      const card = id ? s.cards[id] : null;
      const next = s.activeColumns.includes(col) && s.phase === 'planning' ? nextActivation(this.ctx.profile, col, s.tick) : nextActivation(this.ctx.profile, col, s.tick);
      const fc = mintForecast(s, this.ctx, seat, col);
      const forecast = fc ? `T${next}: ${fc.rank} · S${fc.rank}${Object.keys(fc.mana).length ? ` · ${fmtMana(fc.mana)}` : ''}${card ? ' (replaces)' : ''}` : `T${next}: no frontier`;
      const sel = this.selected?.kind === 'card' && this.selected.id === id;
      const def = card ? activeCatalog.cards[card.abilityId] : null;
      const where = own ? `your C${lc}${col !== lc ? `, global C${col}` : ''}` : `${seat}'s C${ownerLc}, global C${col}`;
      const pick = () => { if (card && !this.dragging) { this.selected = { kind: 'card', id }; this._renderAll(); } };
      tiles.push(h('div', {
        class: `tile owner-${seat.toLowerCase()}${card && own && this.cardDrag?.canLift(card) ? ' liftable' : ''}${card ? '' : ' empty'}${sel ? ' sel' : ''}${planned.has(id) ? ' planned' : ''} suit-${card?.suit ?? ''}`,
        tabindex: card ? '0' : '-1', role: card ? 'button' : null,
        'aria-label': card ? `${card.rank} of ${SUIT_NAME[card.suit] ?? card.suit}, ${where}: Supply ${pts(card.supply)}, ${Object.keys(card.mana).length ? fmtMana(card.mana) : 'no Mana'}, ${def?.title ?? 'no ability'}${planned.has(id) ? ' (planned)' : ''}` : `Empty, ${where}`,
        onclick: pick,
        onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); pick(); } },
        // a restrained tether to the physical bank slot and its column on the board
        onpointerenter: () => this.view?.tether(id, col), onpointerleave: () => this.view?.tether(null, null),
        onfocus: () => this.view?.tether(id, col), onblur: () => this.view?.tether(null, null),
        onpointerdown: (e) => { if (card && own) { const r = e.currentTarget.getBoundingClientRect(); this.cardDrag?.press(e, card, { x: r.left + r.width / 2, y: r.top + r.height / 2 }); } },
        title: card ? `${card.id}\n${def?.title}: ${def?.text ?? ''}` : `Empty · next mint ${forecast}`,
      },
      // one Card anatomy in every view (review UX-08): identity row, a bounded face, resources,
      // then the attached ability on its own band — the same order as the drag / world-bank face
      h('div', { class: 'thead' },
        card ? h('span', { class: 'rank' }, `${card.rank}`, h('span', { class: 'suit' }, SUIT[card.suit])) : null,
        own ? h('span', { class: 'tl' }, `C${lc}`, col !== lc ? h('small', {}, ` · g${col}`) : null)
          : h('span', { class: 'tl' }, `g${col}`, h('small', {}, ` · ${seat} C${ownerLc}`))),
      card ? [
        own ? this._faceBand(card) : null,
        h('div', { class: 'res' }, h('span', { class: 'sup' }, own ? `Supply ${pts(card.supply)}` : `S${pts(card.supply)}`), h('span', { class: 'mana' }, ...this._manaCompact(card.mana, own ? 3 : 2))),
        h('div', { class: `abil${def?.category === 'resource' || !def ? ' none' : ''}` }, def?.category === 'resource' || !def ? 'no ability' : def.title),
        planned.has(id) ? h('div', { class: 'plannedtag' }, this._plannedUse(seat, id)) : null,
      ] : h('div', { class: 'dim' }, 'empty'),
      own ? h('div', { class: 'fc' }, forecast) : null));
    }
    el.replaceChildren(h('div', { class: 'ribbon-label', title: own ? `Your hand (seat ${seat})` : `Opponent's public hand (seat ${seat})` }, own ? `Your hand · ${seat}` : `Opp. · ${seat}`), h('div', { class: 'tiles' }, ...tiles));
  }

  /** Open or close the roster drawer (narrow layouts only; at wide layouts the roster is a column). */
  _toggleRoster(open = !document.body.classList.contains('roster-open')) {
    document.body.classList.toggle('roster-open', open);
    this.el.rosterToggle?.setAttribute('aria-expanded', String(open));
    if (open) this.el.roster.querySelector('.rrow')?.setAttribute('tabindex', '-1');
  }

  _renderRoster() {
    const s = this.state;
    const list = (seat) => Object.values(s.parties).filter((p) => p.owner === seat && p.alive && !p.retired).sort((a, b) => a.localColumn - b.localColumn || (a.kind < b.kind ? -1 : 1));
    const row = (p) => {
      const living = Object.values(p.slots).filter((id) => id && s.members[id].alive).length;
      const engaged = p.state === 'engaged';
      const planned = this._plannedSupply(p);
      const pickRow = (e) => {
        if (e?.type === 'keydown') this._focusInspectorNext = true; // a keyboard pick continues in the inspector
        if (this.tool?.kind === 'supply' && p.owner === this.viewSeat) {
          if (this._addCommand(this.viewSeat, { type: 'load_supply', cardId: this.tool.cardId, partyId: p.id })) this._toast(`Supply planned for ${partyName(s, p.id)} — it arrives when the Tick resolves`);
          this.tool = null; this._renderAll(); return;
        }
        this.selected = { kind: 'party', id: p.id }; this._autoLayer(p); this._focusSelection(); this._toggleRoster(false); this._renderAll();
      };
      return h('div', { class: `rrow${this.selected?.id === p.id ? ' sel' : ''}${engaged ? ' engaged' : ''}${this.tool?.kind === 'supply' && p.owner === this.viewSeat ? ' target' : ''}`, onclick: pickRow,
        ...kbd(pickRow, `${p.owner === this.viewSeat ? 'Your' : `${p.owner}'s`} ${p.mount ? cap(p.mount) : 'Pawn'}${p.commander ? ' Commander' : ''} at R${p.region.row}C${p.region.column}, ${living} of 9 members, Supply ${pts(supplyOf(p))}${engaged ? ', in combat' : ''}`) },
        h('span', { class: `dot ${p.owner.toLowerCase()}` }), h('b', {}, p.mount ? p.mount[0].toUpperCase() + p.mount.slice(1) : 'Pawn'), p.commander ? ' ★' : '',
        h('span', { class: 'dim' }, ` R${p.region.row}C${p.region.column}`), ` ${living}/9`,
        h('span', { class: 'dim' }, ` S${pts(supplyOf(p))}`), planned ? h('span', { class: 'planned-supply' }, `+${pts(planned)}`) : null, engaged ? h('span', { class: 'badge' }, '⚔') : p.state === 'moving' ? h('span', { class: 'badge' }, '→') : null);
    };
    this.el.roster.replaceChildren(h('h3', {}, 'Parties'), h('div', { class: 'rgroup' }, h('div', { class: 'rhead a' }, 'A'), ...list('A').map(row)), h('div', { class: 'rgroup' }, h('div', { class: 'rhead b' }, 'B'), ...list('B').map(row)));
  }

  _renderResources() {
    const s = this.state;
    const pool = (seat) => h('div', { class: 'pool' }, h('b', {}, `${seat} pool `), ...(Object.keys(s.players[seat].pool).length ? manaChips(s.players[seat].pool) : [h('span', { class: 'dim' }, 'empty')]),
      seat === this.viewSeat && this.plans[seat].some((c) => c.type === 'burn') ? h('div', { class: 'dim' }, 'after planned burns: ', ...manaChips(this._plannedPool(seat))) : null);
    const sel = this.selected?.kind === 'party' ? s.parties[this.selected.id] : null;
    this.el.resources.replaceChildren(...[h('h3', {}, 'Mana pools'), pool('A'), pool('B'), h('div', { class: 'dim small' }, 'Burned Mana expires at the Tick boundary.'), sel ? h('div', {}, h('b', {}, 'Selected Supply '), pts(supplyOf(sel))) : null].filter(Boolean));
  }

  _renderPlan() {
    const s = this.state;
    const box = (seat) => {
      const v = validatePlan(s, this.ctx, seat, this.plans[seat]);
      const bad = new Map(v.errors.map((e) => [e.index, e.error]));
      const rd = this.ready[seat];
      const status = this._readyValid(seat) ? h('span', { class: 'ok', title: `Ready acknowledges the pair A r${rd.A} · B r${rd.B}; this plan is frozen for the phase` }, `Ready · acks A r${rd.A}·B r${rd.B}`)
        : rd ? h('span', { class: 'warn', title: `Frozen. Its Ready named A r${rd.A} · B r${rd.B}; the pair has changed since, so it must acknowledge again` }, `Frozen · ack stale`) : h('span', { class: 'dim' }, 'editing');
      // what changed in this plan since the viewing seat acknowledged it (Companion: highlight added / removed)
      const mine = this.ready[this.viewSeat];
      const seen = seat !== this.viewSeat && mine && !this._readyValid(this.viewSeat) ? mine.seen?.[seat] ?? null : null;
      const keys = this.plans[seat].map(cmdKey);
      const removed = seen ? seen.filter((k) => !keys.includes(k)) : [];
      const editable = seat === this.viewSeat && this._can(seat).edit;
      return h('div', { class: `planbox ${seat.toLowerCase()}${rd ? ' frozen' : ''}` },
        h('div', { class: 'phead' }, h('b', {}, `${seat} plan r${this.rev[seat]}`), ' ', status),
        h('ol', {}, ...this.plans[seat].map((c, i) => {
          const added = seen && !seen.includes(keys[i]);
          return h('li', { class: `${bad.has(i) ? 'bad' : ''}${added ? ' added' : ''}` }, added ? h('span', { class: 'chg' }, 'new') : null, describeCmd(s, c), bad.has(i) ? h('div', { class: 'err' }, bad.get(i)) : null,
            editable ? h('button', { class: 'x', title: 'Remove this order (a new public revision)', onclick: () => this._setPlan(seat, this.plans[seat].filter((_, j) => j !== i)) }, '×') : null);
        }),
          ...removed.map((k) => h('li', { class: 'removed' }, h('span', { class: 'chg' }, 'removed'), describeCmd(s, JSON.parse(k))))),
        this.plans[seat].length || removed.length ? null : h('div', { class: 'dim' }, 'empty plan (a legal pass)'));
    };
    const can = this._can(this.viewSeat);
    // one primary Ready, the agreement action, at the foot of the plan panel (Companion layout; review UX-06)
    this._renderReadyButton();
    this.el.plan.replaceChildren(h('h3', {}, 'Public plans'), h('div', { class: 'plans' }, box('A'), box('B')), this.el.readyBig);
    if (can.stale) this.el.plan.querySelector('.plans li.added, .plans li.removed')?.scrollIntoView({ block: 'nearest' });
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
    return n
      ? { state: 'ready', main: 'Ready ▶', sub: `Freeze my plan (${n} order${n > 1 ? 's' : ''}) · Tick ${tick} · Ctrl/⌘+Enter`, pinned: `Ready and freeze my plan (${me})` }
      : { state: 'ready', main: 'Ready ▶', sub: `Continue with existing orders · Tick ${tick} · Ctrl/⌘+Enter`, pinned: `Ready: continue with existing orders (${me})` };
  }

  /** The big Ready button at the end of your hand ribbon: ends your planning for this Tick. */
  _renderReadyButton() {
    if (!this.el.readyBig) this.el.readyBig = h('button', { class: 'ready-big', onclick: () => this._pressReady() });
    const me = this.viewSeat, b = this.el.readyBig;
    const L = this._readyLabel(me);
    b.hidden = L.state === 'watch' || L.state === 'over';
    b.disabled = !this._can(me).ready;
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

  _renderInspector() {
    const s = this.state, sel = this.selected, el = this.el.inspector;
    if (this.pendingChoice) return el.replaceChildren(this._responsePanel());
    if (!sel) return el.replaceChildren(this._nowPanel(), h('h3', {}, 'How a Tick goes'),
      h('ol', { class: 'quickstart' },
        h('li', {}, h('b', {}, 'Supply. '), h('b', {}, 'Drag'), ' a card from your hand (or its slot on the board) onto one of your formations and let go. Each step of movement costs 1 Supply. Drop a card on the Mana pool panel to burn it instead.'),
        h('li', {}, h('b', {}, 'Move. '), 'With the party selected, ', h('b', {}, 'right-click'), ' a highlighted territory. New orders need the party\'s column to be active (striped edges).'),
        h('li', {}, h('b', {}, 'Ready. '), 'Press the gold ', h('b', {}, 'Ready ▶'), ' button under the public plans (or Ctrl/⌘ + Enter). It freezes your plan; when both players are Ready the plans resolve together and play back.')),
      h('p', { class: 'dim small' }, 'Opening: drag the C1 card onto your C1 Castle (R1), select the Castle and right-click the Pawn ahead of it (R2) — they merge into one nine-member party.'),
      this._hoverHelp());
    if (sel.kind === 'party') return el.replaceChildren(this._partyPanel(s.parties[sel.id]));
    if (sel.kind === 'member') return el.replaceChildren(this._memberPanel(s.members[sel.id]));
    if (sel.kind === 'card') return el.replaceChildren(this._cardPanel(s.cards[sel.id]));
    if (sel.kind === 'event') return el.replaceChildren(this._eventPanel(sel.event));
    if (sel.kind === 'territory') {
      const c = this.ctx.geo.toLocal(this.viewSeat, sel.column, sel.row);
      const occ = Object.values(s.parties).filter((p) => p.alive && !p.retired && p.region.column === sel.column && p.region.row === sel.row);
      const mana = [...this.ctx.profile.board.manaRows, ...this.ctx.profile.board.dualRows].includes(sel.row);
      return el.replaceChildren(h('h3', {}, `Territory R${sel.row}C${sel.column}`),
        h('p', {}, (c.row !== sel.row || c.column !== sel.column) ? `Your R${c.row}C${c.column}. ` : '', mana ? 'A Mana row: cards minted from here can carry Mana. ' : '', s.activeColumns.includes(sel.column) ? 'Its column is active this Tick.' : ''),
        h('p', {}, occ.length ? `Here: ${occ.map((p) => `${p.owner === this.viewSeat ? 'your' : `${p.owner}'s`} ${partyShort(s, p.id)} (band ${fmtBand(p.band ?? 1)})`).join('; ')}.` : 'Empty.'));
    }
    return el.replaceChildren(h('h3', {}, 'Inspector'));
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
      h('div', {}, h('b', {}, 'You can: '), `spend ${cards} unplanned card${cards === 1 ? '' : 's'} (drag onto a formation for Supply, onto Mana pools to Burn, or use its ability), and order ${movable} mounted part${movable === 1 ? 'y' : 'ies'} in active columns.`),
      h('div', {}, h('b', {}, 'If you press Ready: '), ready));
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
        h('div', { class: 'dim small' }, active ? (p.mount ? 'Right-click a highlighted territory: destination (one step costs 1 Supply).' : 'An unmounted Pawn stores Supply but cannot move.') : `C${p.region.column} is not active: only Supply can reach this party now.`),
        p.mount && active && this._can(p.owner).edit ? this._moveList(p) : null,
        h('div', { class: 'row' }, 'Face ', facing('N'), facing('E'), facing('S'), facing('W')),
        p.state === 'engaged' ? this._retreatPreview(p) : null,
        p.state === 'engaged' ? h('button', { disabled: !active || !this._can(p.owner).edit, onclick: () => { this.tool = { kind: 'retreat', partyId: p.id }; this._toast('Retreat: right-click a legal destination away from contact. Touching members die.'); } }, 'Retreat…') : null) : null);
  }

  /**
   * Move without a right-click (review UX-13/UX-14): the party's legal destinations as buttons,
   * nearest first, each with its Supply cost. The same validated set_destination command.
   */
  _moveList(p) {
    const s = this.state;
    const dests = legalDestinations(s, this.ctx, p).filter((d) => d.column !== p.region.column || d.row !== p.region.row)
      .sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0) || a.row - b.row || a.column - b.column).slice(0, 12);
    if (!dests.length) return null;
    const step = this.ctx.profile.movement.stepCost ?? 1;
    const cost = (d) => (d.cost != null ? `${d.cost} step${d.cost === 1 ? '' : 's'} · ${d.cost * step} Supply` : '');
    return h('details', { class: 'movelist' }, h('summary', {}, `Move to… (${dests.length} nearest legal territories; or right-click the board)`),
      h('div', { class: 'row' }, ...dests.map((d) => h('button', { onclick: () => {
        if (this._addCommand(p.owner, { type: 'set_destination', partyId: p.id, target: { column: d.column, row: d.row } })) {
          const plan = planPartyRoute(s, this.ctx, p, routeOrigin(s, this.ctx, p), d);
          if (plan.route) this.view.showRoute(p, plan.route.map((n) => { const c = this.ctx.geo.center(n.column, n.row); return [c.x, c.y]; }));
          this._toast(`Destination: R${d.row}C${d.column} (planned)`);
        }
      } }, `R${d.row}C${d.column}`, h('small', { class: 'dim' }, ` ${cost(d)}`)))));
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
        ? h('div', { class: 'row' }, ...cards.map((c) => h('button', { disabled: !this._can(seat).edit, title: `Spend ${c.id} as ${pts(c.supply)} Supply for this party (the card's Mana and ability are given up)`, onclick: () => { if (this._addCommand(seat, { type: 'load_supply', cardId: c.id, partyId: p.id })) { this._toast(`+${pts(c.supply)} Supply planned for ${partyName(s, p.id)} — it arrives when the Tick resolves`); this._renderAll(); } } },
          `+${pts(c.supply)} `, h('small', { class: 'dim' }, `C${c.localColumn} ${c.rank}${SUIT[c.suit] ?? ''}`))))
        : h('p', { class: 'dim small' }, 'No unplanned hand cards. New cards mint from the highlighted columns each Tick.'),
      h('p', { class: 'dim small' }, 'Any card can become Supply for any of your parties, in any column, at any time. Moving one step costs 1 Supply.'));
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

  _cardPanel(card) {
    const s = this.state, def = activeCatalog.cards[card.abilityId];
    const own = card.owner === this.viewSeat && this.seats[card.owner] === 'human' && card.state === 'available';
    const planned = this._plannedCardIds(card.owner).has(card.id);
    const face = drawCardCanvas(card, s, 240, 320);
    face.className = 'inspect-face';
    face.setAttribute('role', 'img');
    face.setAttribute('aria-label', `${card.rank} of ${SUIT_NAME[card.suit] ?? card.suit}: Supply ${pts(card.supply)}, ${Object.keys(card.mana ?? {}).length ? fmtMana(card.mana) : 'no Mana'}, ability ${def?.title ?? 'none'}`);
    return h('div', {}, face,
      h('h3', {}, `${card.rank} of ${SUIT_NAME[card.suit]} · ${card.owner} C${card.localColumn}`),
      h('div', { class: 'kv' },
        h('span', {}, 'Supply'), h('span', {}, pts(card.supply)),
        h('span', {}, 'Mana'), h('span', {}, fmtMana(card.mana)),
        h('span', {}, 'Minted'), h('span', {}, `Tick ${card.tick} from ${card.frontierParty ? partyName(s, card.frontierParty) : '—'}${card.blocker ? `, cut at ${card.blocker}` : ''}`),
        h('span', {}, 'State'), h('span', {}, `${card.state}${planned ? ' (planned)' : ''}`)),
      card.pips?.length ? h('div', { class: 'small' }, 'Mana provenance: ', ...card.pips.map((p) => h('span', { class: `chip c-${p.color}` }, `R${p.row}:${COLOR_LETTER[p.color]}${p.amount}`))) : null,
      h('h4', {}, def?.title ?? 'Ability'), h('p', {}, def?.text ?? ''),
      h('p', { class: 'dim small' }, `Definition ${card.ability} · creator ${def?.lineage?.creator?.label ?? def?.lineage?.creator?.id ?? '—'}${def?.lineage?.parents?.length ? ` · derived from ${def.lineage.parents.map((p) => (typeof p === 'string' ? p : `${p.id}@${p.revision}`)).join(', ')}` : ''}`),
      (() => { const art = renditionFor(card); return art
        ? h('div', { class: 'artcredit small' }, h('img', { src: art.url, alt: `${art.title} — ${art.deck}` }), h('span', { class: 'dim' }, `Face: “${art.title}” from the ${art.deck} (local rendition; the art stays with its owner and never affects play)`))
        : h('p', { class: 'dim small' }, 'Face: procedural placeholder (no local rendition for this rank and suit; play is identical)'); })(),
      own ? h('div', { class: 'actions' },
        h('div', { class: 'dim small' }, 'One instance, one use:'),
        h('div', { class: 'row' },
          h('button', { onclick: () => this._cardTool('supply') }, 'Supply… (U)'),
          h('button', { onclick: () => this._cardTool('burn') }, `Burn → ${fmtMana(card.mana)} (B)`),
          h('button', { disabled: !def || def.category === 'resource' || def.timing === 'response', onclick: () => this._cardTool('ability') }, `${def?.title ?? 'Ability'}… (C)`)),
        this.tool?.cardId === card.id && this.tool.step === 'facing' ? h('div', { class: 'row' }, 'Facing ', ...['N', 'E', 'S', 'W'].map((f) => h('button', { onclick: () => { this._addCommand(card.owner, { type: 'play_ability', cardId: card.id, actorPartyId: this.tool.actorPartyId, target: { facing: f } }); this.tool = null; this._renderAll(); } }, f))) : null) : null);
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
      h('details', { class: 'details' }, h('summary', {}, 'Details (exact record)'), h('pre', { class: 'raw' }, JSON.stringify(e, null, 1).slice(0, 1600))));
  }

  _responsePanel() {
    const { req, resolve } = this.pendingChoice;
    const s = this.state;
    const opts = responseOptions(s, this.ctx, req.seat);
    const top = req.stack[req.stack.length - 1];
    const finish = (answer) => { this.pendingChoice = null; this.selected = null; resolve(answer); this._renderAll(); };
    const actor = Object.values(s.parties).find((p) => p.owner === req.seat && p.alive && !p.retired);
    return h('div', { class: 'response' },
      h('h3', {}, `Response window · ${req.seat}`),
      h('p', {}, 'Pending (last resolves first):'),
      h('ol', {}, ...req.stack.map((e) => h('li', {}, `${e.seat}: ${activeCatalog.cards[e.defId].title}${e.target?.memberId ? ` → ${memberName(s, e.target.memberId)}` : e.target?.stackId ? ` → ${e.target.stackId}` : ''}${e.countered ? ' (countered)' : ''}`))),
      ...opts.cards.map((id) => {
        const c = s.cards[id];
        const def = activeCatalog.cards[c.abilityId];
        const burns = this._autoBurnsNow(req.seat, def, id);
        return h('button', { class: 'primary', onclick: () => finish({ cardId: id, actorPartyId: actor.id, target: { stackId: top.id }, burns }) }, `${def.title} with ${c.id} → counter ${top.id}${burns.length ? ` (burn ${burns.join(', ')})` : ''}`);
      }),
      h('button', { onclick: () => finish({ pass: true }) }, 'Pass'));
  }

  _autoBurnsNow(seat, def, sourceId) {
    const pool = { ...this.state.players[seat].pool };
    const burns = [];
    const cost = def.cost?.mana ?? {};
    const enough = () => Object.entries(cost).every(([c, n]) => (pool[c] ?? 0) + (pool.rainbow ?? 0) >= n);
    for (const id of Object.values(this.state.players[seat].bank.minor).filter(Boolean)) {
      if (enough()) break;
      if (id === sourceId) continue;
      const card = this.state.cards[id];
      burns.push(id);
      for (const [c, n] of Object.entries(card.mana)) pool[c] = (pool[c] ?? 0) + n;
    }
    return burns;
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
