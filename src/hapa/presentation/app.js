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
import { loadCharacterKit } from '../../../vendor/lumina/src/engine/pixel/CharacterSprites.js';
import { BoardCamera } from './camera.js';
import { BoardView, COLOR_HEX, OWNER_HEX } from './board-view.js';
import { eventLine, explainHit, memberName, partyName, fmtMana } from './explain.js';
import { createSession, createFixtureSession, openTick } from '../rules/session.js';
import { validatePlan, resolveTick, responseOptions } from '../rules/match.js';
import { legalDestinations, planPartyRoute, routeOrigin, touchingPairs, contactTolerance } from '../rules/movement.js';
import { mintForecast, nextActivation, roundOf, supplyOf } from '../rules/economy.js';
import { stateFingerprint } from '../rules/state.js';
import { clone } from '../rules/encoding.js';
import { HeuristicBot } from '../controllers/heuristic-bot.js';
import { ALLOCATION_POLICIES } from '../rules/combat.js';
import { profileById, PROFILE_IDS, BASE_PROFILE } from '../../../fixtures/hapa/profiles.js';
import { CATALOG } from '../../../fixtures/hapa/content.js';
import { UI_FIXTURES } from '../../../fixtures/hapa/ui-fixtures.js';
import { standingOf, fmtBand } from './terrain-view.js';
import { loadRenditions, renditionFor, drawCover } from './renditions.js';

const U = 1e6;
const SUIT = { wands: '♣', pentacles: '✪', cups: '♥', swords: '♠', wildcard: '✱' };
const SUIT_NAME = { wands: 'Wands', pentacles: 'Pentacles', cups: 'Cups', swords: 'Swords', wildcard: 'Wildcard' };
const ROLE_ABBR = { swordsman: 'Sw', pikeman: 'Pk', archer: 'Ar', mage: 'Mg', priest: 'Pr', center: '★' };
const COLOR_LETTER = { red: 'R', green: 'G', purple: 'P', yellow: 'Y', blue: 'B', orange: 'O', black: 'K', white: 'W', rainbow: '✦' };
const pts = (u) => { const v = u / U; return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''); };
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style') e.style.cssText = v;
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
};
const manaChips = (m) => Object.entries(m ?? {}).filter(([, n]) => n).map(([c, n]) => h('span', { class: `chip c-${c}`, title: `${n} ${c}` }, `${COLOR_LETTER[c]}${n}`));

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
    this.el.overlay = h('div', { id: 'overlay' });
    r.append(this.el.overlay);
    this.el.world.append(this.el.toast = h('div', { class: 'toast' }));
    this.el.world.append(this.el.compass = h('div', { class: 'compass' }));
    this.el.world.append(this.el.layers = h('div', { class: 'layer-rail', role: 'toolbar', 'aria-label': 'Height layers' }));
  }

  _initEngine() {
    if (this.engine) return;
    this.engine = new Engine({ container: this.el.world, clearColor: 0x0e1018, maxPixelRatio: 2 });
    this.engine.scene.fog = new THREE.Fog(0x0e1018, 160, 320);
    this.raycaster = new THREE.Raycaster();
    const canvas = this.engine.renderer.domElement;
    canvas.addEventListener('pointerdown', (e) => this._onPointer(e));
    canvas.addEventListener('pointermove', (e) => this._onHover(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.engine.addSystem({ name: 'versus', update: (dt) => this._frame(dt) });
    this.engine.start();
  }

  // --- setup -------------------------------------------------------------------------------------
  showSetup() {
    const profileSel = h('select', { id: 'set-profile' }, ...PROFILE_IDS.map((id) => h('option', { value: id }, `${id} — ${profileById(id).title}`)));
    const seatSel = (seat, dflt) => h('select', { id: `set-${seat}` }, h('option', { value: 'human', selected: dflt === 'human' }, 'Human'), h('option', { value: 'bot', selected: dflt === 'bot' }, 'Heuristic bot'));
    const seed = h('input', { id: 'set-seed', type: 'number', value: '1', min: '1' });
    const policySel = (seat) => h('select', { id: `set-pol-${seat}` }, ...ALLOCATION_POLICIES.map((p) => h('option', { value: p }, { slot_order: 'Slot order (fixture)', center_first: 'Center first (sacrifice the center)', protect_ranged: 'Protect ranged members' }[p])));
    this.el.overlay.replaceChildren(h('div', { class: 'card-sheet setup' },
      h('h1', {}, 'Hapa Versus'),
      h('p', { class: 'lede' }, 'Two armies on a nine-column battlefield. Each Tick the highlighted columns mint public Minor Arcana from the territory you hold: spend a card as Supply to move, burn it for colored Mana, or play its attached ability. Win by moving a party center into the enemy Capital or killing the enemy Commander.'),
      h('div', { class: 'form' },
        h('label', {}, 'Profile', profileSel),
        h('label', {}, 'Seat A (low rows)', seatSel('A', 'human')),
        h('label', {}, 'Seat B (high rows)', seatSel('B', 'bot')),
        h('label', {}, 'Seed', seed),
        h('label', {}, 'A standing damage allocation', policySel('A')),
        h('label', {}, 'B standing damage allocation', policySel('B'))),
      h('p', { class: 'dim small' }, 'Allocation applies when your seat assigns damage under the profile (attacker or defender allocation). It is public and recorded in the match manifest.'),
      h('div', { class: 'row' },
        h('button', { class: 'primary', onclick: () => this.startMatch({ profileId: profileSel.value, seats: { A: document.getElementById('set-A').value, B: document.getElementById('set-B').value }, seed: Number(seed.value) || 1, policies: { A: document.getElementById('set-pol-A').value, B: document.getElementById('set-pol-B').value } }) }, 'Start match'),
        h('button', { onclick: () => this.startMatch({ profileId: profileSel.value, seats: { A: 'bot', B: 'bot' }, seed: Number(seed.value) || 1, watch: true }) }, 'Watch bot vs bot')),
      h('details', {}, h('summary', {}, 'Diagnostic fixtures (labeled, not ordinary play)'),
        ...Object.entries(UI_FIXTURES).map(([id, f]) => h('div', { class: 'row fixture' },
          h('button', { onclick: () => this.startMatch({ fixture: id, seats: { A: 'human', B: 'human' } }) }, f.title),
          h('span', { class: 'dim small' }, f.description)))),
      h('details', {}, h('summary', {}, 'Controls'), h('div', { class: 'keys' },
        ...[['Left click', 'select a party, member, territory or card'], ['Right click', 'set the selected party\'s one destination'], ['1–9', 'select your hand slot (home column order)'], ['U / B / C', 'Supply, Burn or Ability with the selected card'], ['M', 'show legal destinations of the selected party'], ['G', 'formation facing tools'], ['P', 'plan comparison'], ['Ctrl/⌘ + Enter', 'Ready (freeze your plan for this pair)'], ['Esc', 'cancel the current tool'], ['Q / E', 'rotate the camera 45°'], ['Z / X', 'tilt'], ['W A S D', 'pan'], ['Wheel', 'zoom'], ['V', 'tactical view'], ['Home', 'home view'], ['F', 'focus the selection'], ['Space', 'pause playback']].map(([k, v]) => h('div', {}, h('kbd', {}, k), ' ', v)))),
    ));
    this.el.overlay.hidden = false;
  }

  async startMatch({ profileId = BASE_PROFILE.id, seats = { A: 'human', B: 'bot' }, seed = 1, watch = false, policies = { A: 'slot_order', B: 'slot_order' }, fixture = null }) {
    this.el.overlay.hidden = true;
    await loadCharacterKit(); // crowns, helmets and the guard preset are kit parts
    await loadRenditions(); // optional local card faces; placeholders otherwise
    const fx = fixture ? UI_FIXTURES[fixture] : null;
    if (fx) {
      // a labeled diagnostic fixture: its state is prepared directly, not reached by ordinary play
      this.session = createFixtureSession(fx.build(), { id: fixture, title: fx.title });
    } else {
      const profile = profileById(profileId);
      this.session = createSession({
        matchId: `local-${profileId}-${seed}-${Date.now().toString(36)}`, profile, catalog: CATALOG, seed, allocationPolicies: policies,
        controllers: { A: { type: seats.A, revision: seats.A === 'bot' ? 'heuristic-bot/0.1.0' : 'ui/0.1.0' }, B: { type: seats.B, revision: seats.B === 'bot' ? 'heuristic-bot/0.1.0' : 'ui/0.1.0' } },
      });
    }
    this.ctx = this.session.ctx;
    this.seats = seats;
    this.watch = watch || (seats.A === 'bot' && seats.B === 'bot');
    this.bots = {};
    for (const s of ['A', 'B']) if (seats[s] === 'bot') this.bots[s] = new HeuristicBot({ seat: s, seed: seed * 2 + (s === 'A' ? 1 : 2) });
    this.viewSeat = seats.A === 'human' ? 'A' : seats.B === 'human' ? 'B' : 'A';
    this._initEngine();
    if (this.view) { this.engine.scene.remove(this.view.root); }
    this.view = new BoardView(this.engine.scene, this.ctx);
    this.cam = new BoardCamera(this.engine.camera, this.el.world, { center: this.view.center, size: this.view.size });
    this.cam.setHome(this.viewSeat);
    this.selected = null;
    this.tool = null;
    this.lastEvents = [];
    this.inspectEvent = null;
    this.playback = null;
    this.view.sync(this.state);
    this._newTick();
  }

  get state() { return this.session.state; }

  // --- the Tick cycle ----------------------------------------------------------------------------
  _newTick() {
    if (this.state.outcome) return this._showResult();
    const minted = openTick(this.session);
    this.tickEvents = [...minted];
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

  /** Change a seat's public plan: a new revision; any Ready of the old pair becomes stale. */
  _setPlan(seat, cmds) {
    this.plans[seat] = cmds;
    this.rev[seat] += 1;
    for (const s of ['A', 'B']) if (this.bots[s]) this.ready[s] = { ...this.rev }; // bots re-acknowledge the new pair
    this._renderAll();
  }

  _addCommand(seat, cmd) {
    let plan = [...this.plans[seat]];
    if (cmd.type === 'set_destination' || cmd.type === 'change_formation' || cmd.type === 'retreat') plan = plan.filter((c) => !(c.type === cmd.type && c.partyId === cmd.partyId));
    plan.push(cmd);
    const v = validatePlan(this.state, this.ctx, seat, plan);
    const err = v.errors.find((e) => e.index === plan.length - 1);
    if (err) { this._toast(`Not added: ${err.error}`, true); return false; }
    this._setPlan(seat, plan);
    return true;
  }

  _readyValid(seat) { const r = this.ready[seat]; return !!r && r.A === this.rev.A && r.B === this.rev.B; }

  _pressReady() {
    if (this.playback || this.state.outcome) return;
    const seat = this.viewSeat;
    if (this.seats[seat] !== 'human') return;
    this.ready[seat] = { ...this.rev };
    this._renderAll();
    if (this.seats.A === 'human' && this.seats.B === 'human' && !this._readyValid(seat === 'A' ? 'B' : 'A')) {
      this.viewSeat = seat === 'A' ? 'B' : 'A';
      this._toast(`${seat} is Ready. ${this.viewSeat} plans now (hotseat).`);
      this._renderAll();
      return;
    }
    this._tryResolve();
  }

  async _tryResolve() {
    if (!(this._readyValid('A') && this._readyValid('B'))) return this._renderAll();
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
    if (state.outcome) this._showResult();
    else this._newTick();
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
    return new Promise((resolve) => {
      this.playback = { t: 0, duration, all, events, resolve, shown: 0, paused: false };
    });
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
    if (evLen > pb.shown) { pb.shown = evLen; this._renderEvents(); }
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
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); return this._pressReady(); }
      if (e.code === 'Escape') { if (this.tool) { this.tool = null; this._renderAll(); } else { this.selected = null; this.view?.select(this.state, null); this._renderAll(); } return; }
      if (k === 'q') this.cam.rotate(45);
      else if (k === 'e') this.cam.rotate(-45);
      else if (k === 'z') this.cam.tilt(15);
      else if (k === 'x') this.cam.tilt(-15);
      else if (k === 'v') this.cam.toggleTactical();
      else if (e.code === 'Home') this.cam.home();
      else if (k === 'f') this._focusSelection();
      else if (e.code === 'Space') { e.preventDefault(); if (this.playback) this.playback.paused = !this.playback.paused; }
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

  _onHover(e) {
    if (!this.view) return;
    const p = this._rayFrom(e);
    this.view.hover(p?.territory ?? null);
    this.hoverInfo = p;
  }

  _onPointer(e) {
    if (!this.session || e.button === 1) return;
    const pick = this._rayFrom(e);
    if (!pick) return;
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
      const def = CATALOG.cards[this.state.cards[t.cardId].abilityId];
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
    if (kind === 'burn') { if (this._addCommand(this.viewSeat, { type: 'burn', cardId: card.id })) this._toast(`Burn planned: +${fmtMana(card.mana)}`); return; }
    if (kind === 'supply') { this.tool = { kind: 'supply', cardId: card.id }; this._toast('Click a friendly party to receive the Supply'); }
    if (kind === 'ability') {
      const def = CATALOG.cards[card.abilityId];
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
    if (s?.kind === 'party') { const p = this.state.parties[s.id]; this.cam.focusOn(this.view.toWorld(p.x, p.y)); }
    else if (s?.kind === 'member') { const m = this.state.members[s.id]; this.cam.focusOn(this.view.toWorld(m.x, m.y)); }
  }

  // --- frame -------------------------------------------------------------------------------------
  _frame(dt) {
    if (!this.cam) return;
    this.cam.update(dt, this.keys);
    this._stepPlayback(dt);
    this.view.update(dt, this.engine.camera);
    this.el.compass.textContent = `▲ ${Math.round(this.cam.bearing)}° · ${this.cam.tactical ? 'Tactical' : 'Angled'} · home ${this.viewSeat}`;
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
    this._renderMatchBar();
    this._renderHand(this.el.ownhand, this.viewSeat, true);
    this._renderHand(this.el.opphand, this.viewSeat === 'A' ? 'B' : 'A', false);
    this._renderRoster();
    this._renderInspector();
    this._renderResources();
    this._renderPlan();
    this._renderEvents();
    this._renderLayers();
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
      h('div', { class: 'crest a' }, 'A', h('small', {}, this.seats.A === 'bot' ? 'bot' : 'human')),
      h('div', { class: 'tick' }, this.session.fixture ? h('span', { class: 'fixture-tag', title: 'This state was prepared directly as a diagnostic fixture; it did not emerge from ordinary play.' }, `FIXTURE · ${this.session.fixture.title}`) : null, h('b', {}, `Tick ${s.tick}`), ` · ${r.period === 'prologue' ? 'Prologue' : `Round ${r.round}`}`),
      h('div', { class: 'active' }, 'Active ', ...s.activeColumns.map((c) => h('span', { class: 'colchip' }, `C${c}`)), h('small', {}, ` next T${next}: ${this.ctx.profile.clock.activation[(next - 1) % 9].map((c) => `C${c}`).join('/')}`)),
      h('div', { class: 'phase' }, this.playback ? 'Resolving…' : this.pendingChoice ? `Response window · ${this.pendingChoice.req.seat} to act` : s.outcome ? 'Match over' : `Planning · you are ${this.viewSeat}`),
      h('div', { class: 'cmds' }, ...['A', 'B'].map((seat) => { const c = cmd(seat); return h('span', { class: `cmdhp ${seat.toLowerCase()}` }, `${seat} Commander ${c?.alive ? `${pts(c.hp)}/${pts(c.maxHp)} HP` : 'fallen'}`); })),
      h('div', { class: 'speed' }, h('label', {}, 'Playback ', h('select', { onchange: (e) => (this.speed = Number(e.target.value)) }, ...[0.5, 1, 2, 4].map((v) => h('option', { value: v, selected: v === this.speed }, `${v}×`))))),
      h('div', { class: 'crest b' }, 'B', h('small', {}, this.seats.B === 'bot' ? 'bot' : 'human')),
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
    this.el.overlay.replaceChildren(h('div', { class: 'card-sheet' },
      h('h2', {}, o.result === 'draw' ? 'Draw' : o.result === 'win' ? `${o.winner} wins` : 'Unfinished'),
      h('p', {}, ...(o.reasons ?? []).map((r) => h('div', {}, `${r.seat}: ${r.reason.replace('_', ' ')}${r.partyId ? ` by ${partyName(this.state, r.partyId)}` : ''}`))),
      h('p', {}, `Tick ${this.state.tick}. Download the replay to verify it by recomputation (npm run replay -- file.json).`),
      h('div', { class: 'row' }, h('button', { onclick: () => (this.el.overlay.hidden = true) }, 'Inspect the board'), h('button', { onclick: () => this._downloadReplay() }, 'Download replay'), h('button', { class: 'primary', onclick: () => this.showSetup() }, 'New match'))));
    this.el.overlay.hidden = false;
  }

  _renderHand(el, seat, own) {
    const s = this.state, geo = this.ctx.geo;
    const planned = this._plannedCardIds(seat);
    const tiles = [];
    for (let lc = 1; lc <= 9; lc++) {
      const col = geo.toGlobal(seat, lc, 1).column;
      const id = s.players[seat].bank.minor[String(col)];
      const card = id ? s.cards[id] : null;
      const next = s.activeColumns.includes(col) && s.phase === 'planning' ? nextActivation(this.ctx.profile, col, s.tick) : nextActivation(this.ctx.profile, col, s.tick);
      const fc = mintForecast(s, this.ctx, seat, col);
      const forecast = fc ? `T${next}: ${fc.rank} · S${fc.rank}${Object.keys(fc.mana).length ? ` · ${fmtMana(fc.mana)}` : ''}${card ? ' (replaces)' : ''}` : `T${next}: no frontier`;
      const sel = this.selected?.kind === 'card' && this.selected.id === id;
      const def = card ? CATALOG.cards[card.abilityId] : null;
      tiles.push(h('div', {
        class: `tile${card ? '' : ' empty'}${sel ? ' sel' : ''}${planned.has(id) ? ' planned' : ''} suit-${card?.suit ?? ''}`,
        onclick: () => { if (card) { this.selected = { kind: 'card', id }; this._renderAll(); } },
        title: card ? `${card.id}\n${def?.title}: ${def?.text ?? ''}` : `Empty · next mint ${forecast}`,
      },
      h('div', { class: 'tl' }, `C${lc}`, seat === 'B' ? h('small', {}, ` g${col}`) : null),
      card && renditionFor(card) ? h('div', { class: 'art', style: `background-image:url("${renditionFor(card).url}")`, 'aria-hidden': 'true' }) : null,
      card ? [
        h('div', { class: 'rank' }, `${card.rank}`, h('span', { class: 'suit' }, SUIT[card.suit])),
        own ? h('div', { class: 'sup' }, `Supply ${pts(card.supply)}`) : h('div', { class: 'sup' }, `S${pts(card.supply)}`),
        h('div', { class: 'mana' }, ...(Object.keys(card.mana).length ? manaChips(card.mana) : [h('span', { class: 'dim' }, 'no Mana')])),
        own ? h('div', { class: 'abil' }, def?.title ?? '—') : null,
        planned.has(id) ? h('div', { class: 'plannedtag' }, 'planned') : null,
      ] : h('div', { class: 'dim' }, 'empty'),
      own ? h('div', { class: 'fc' }, forecast) : null));
    }
    el.replaceChildren(h('div', { class: 'ribbon-label' }, own ? `Your hand · ${seat}` : `Opponent hand · ${seat}`), h('div', { class: 'tiles' }, ...tiles));
  }

  _renderRoster() {
    const s = this.state;
    const list = (seat) => Object.values(s.parties).filter((p) => p.owner === seat && p.alive && !p.retired).sort((a, b) => a.localColumn - b.localColumn || (a.kind < b.kind ? -1 : 1));
    const row = (p) => {
      const living = Object.values(p.slots).filter((id) => id && s.members[id].alive).length;
      const engaged = p.state === 'engaged';
      return h('div', { class: `rrow${this.selected?.id === p.id ? ' sel' : ''}${engaged ? ' engaged' : ''}`, onclick: () => { this.selected = { kind: 'party', id: p.id }; this._autoLayer(p); this._focusSelection(); this._renderAll(); } },
        h('span', { class: `dot ${p.owner.toLowerCase()}` }), h('b', {}, p.mount ? p.mount[0].toUpperCase() + p.mount.slice(1) : 'Pawn'), p.commander ? ' ★' : '',
        h('span', { class: 'dim' }, ` R${p.region.row}C${p.region.column}`), ` ${living}/9`,
        h('span', { class: 'dim' }, ` S${pts(supplyOf(p))}`), engaged ? h('span', { class: 'badge' }, '⚔') : p.state === 'moving' ? h('span', { class: 'badge' }, '→') : null);
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
      const status = this._readyValid(seat) ? h('span', { class: 'ok' }, `Ready (A r${rd.A} · B r${rd.B})`) : rd ? h('span', { class: 'warn' }, 'Ready is stale: the pair changed') : h('span', { class: 'dim' }, 'editing');
      return h('div', { class: `planbox ${seat.toLowerCase()}` },
        h('div', { class: 'phead' }, h('b', {}, `${seat} plan r${this.rev[seat]}`), ' ', status),
        h('ol', {}, ...this.plans[seat].map((c, i) => h('li', { class: bad.has(i) ? 'bad' : '' }, describeCmd(s, c), bad.has(i) ? h('div', { class: 'err' }, bad.get(i)) : null,
          seat === this.viewSeat && this.seats[seat] === 'human' && !this.playback ? h('button', { class: 'x', onclick: () => this._setPlan(seat, this.plans[seat].filter((_, j) => j !== i)) }, '×') : null))),
        this.plans[seat].length ? null : h('div', { class: 'dim' }, 'empty plan (a legal pass)'));
    };
    const me = this.viewSeat;
    const canReady = this.seats[me] === 'human' && !this.playback && !this.pendingChoice && !this.state.outcome;
    this.el.plan.replaceChildren(h('h3', {}, 'Public plans'), h('div', { class: 'plans' }, box('A'), box('B')),
      h('button', { class: `primary ready${this._readyValid(me) ? ' done' : ''}`, disabled: !canReady, onclick: () => this._pressReady() }, this._readyValid(me) ? `Ready ✓ (${me})` : `Ready as ${me} (Ctrl/⌘+Enter)`));
  }

  _renderEvents() {
    const s = this.state;
    const evs = (this.playback ? this.playback.events.slice(0, this.playback.shown) : this.lastEvents ?? []).filter((e) => eventLine(s, e));
    const minted = this.tickEvents?.filter((e) => e.type === 'card_minted' || e.type === 'tick_started' || e.type === 'mana_expired') ?? [];
    const all = [...(this.playback ? [] : []), ...evs];
    const shown = (all.length ? all : minted).slice(-60);
    this.el.events.replaceChildren(...shown.map((e) => h('span', { class: `ev ev-${e.type}${this.inspectEvent === e.id ? ' sel' : ''}`, onclick: () => { this.inspectEvent = e.id; this.selected = { kind: 'event', id: e.id, event: e }; this._renderAll(); } }, eventLine(s, e))));
    this.el.events.scrollLeft = this.el.events.scrollWidth;
  }

  _renderInspector() {
    const s = this.state, sel = this.selected, el = this.el.inspector;
    if (this.pendingChoice) return el.replaceChildren(this._responsePanel());
    if (!sel) return el.replaceChildren(h('h3', {}, 'Inspector'), h('p', { class: 'dim' }, 'Select a party on the board or in the roster, a hand card (1–9) or an event below. Right-click a highlighted territory to give the selected party its one destination.'), this._hoverHelp());
    if (sel.kind === 'party') return el.replaceChildren(this._partyPanel(s.parties[sel.id]));
    if (sel.kind === 'member') return el.replaceChildren(this._memberPanel(s.members[sel.id]));
    if (sel.kind === 'card') return el.replaceChildren(this._cardPanel(s.cards[sel.id]));
    if (sel.kind === 'event') return el.replaceChildren(this._eventPanel(sel.event));
    if (sel.kind === 'territory') {
      const c = this.ctx.geo.toLocal(this.viewSeat, sel.column, sel.row);
      return el.replaceChildren(h('h3', {}, `Territory R${sel.row}C${sel.column}`), h('p', {}, `Your home view: R${c.row}C${c.column}`), h('p', { class: 'dim' }, `Mana row: ${[...this.ctx.profile.board.manaRows, ...this.ctx.profile.board.dualRows].includes(sel.row) ? 'yes' : 'no'}`));
    }
    return el.replaceChildren(h('h3', {}, 'Inspector'));
  }

  _hoverHelp() {
    return h('div', { class: 'legend' }, h('h4', {}, 'Legend'),
      h('div', {}, h('span', { class: 'dot a' }), ' A · ', h('span', { class: 'dot b' }), ' B ownership discs'),
      h('div', {}, 'Square frame + arrow: a party anchor and its facing; a small dashed square marks an empty Pawn center.'),
      h('div', {}, 'Gold column wash: active columns this Tick (new unit orders).'),
      h('div', {}, 'Diamonds on a territory: its Mana color(s).'),
      h('div', {}, 'Dashed gold square: a Capital.'),
      h('div', {}, 'Gold diamond under a member: a corner helper standing in the contact strip for a neighbour (it still belongs to its own party).'),
      h('div', {}, 'Red triangle under a member: it advanced one slot into an enemy casualty\'s gap.'),
      h('div', {}, 'Terrain labels: ▲ HILLTOP, ▽ OPEN PIT (exposed), ▭ TUNNEL (roofed, not exposed), ✈ FLYING (a line drops to the floor). [ and ] step the cutaway layer.'));
  }

  _partyPanel(p) {
    const s = this.state, own = p.owner === this.viewSeat && this.seats[p.owner] === 'human';
    const local = this.ctx.geo.toLocal(p.owner, p.region.column, p.region.row);
    const grid = h('div', { class: 'fgrid' });
    for (let slot = 1; slot <= 9; slot++) {
      const id = p.slots[String(slot)];
      const m = id ? s.members[id] : null;
      grid.append(h('div', { class: `slot${m ? (m.alive ? '' : ' dead') : ' empty'}${slot === 5 ? ' center' : ''}`, onclick: () => { if (m) { this.selected = { kind: 'member', id: m.id }; this._renderAll(); } }, title: m ? memberName(s, m.id) : `slot ${slot} empty` },
        h('span', { class: 'sn' }, slot), m?.alive && m.helperAway ? h('span', { class: 'away', title: m.helperAway.kind === 'corner' ? `helping ${partyName(s, m.helperAway.helps)} in the contact strip` : 'advanced into an enemy gap' }, m.helperAway.kind === 'corner' ? '◇' : '▲') : null, m ? [h('b', {}, m.isCenter ? (p.mount ?? '★').slice(0, 3) : ROLE_ABBR[m.archetype]), m.alive && !p.pool ? h('div', { class: 'hp' }, h('i', { style: `width:${Math.max(0, m.hp / m.maxHp) * 100}%` })) : m.alive ? null : h('small', {}, '†')] : h('small', { class: 'dim' }, slot === 5 ? 'empty center' : '')));
    }
    const engagedWith = Object.values(s.engagements).filter((e) => e.active && (e.a === p.id || e.b === p.id)).map((e) => (e.a === p.id ? e.b : e.a));
    const active = s.activeColumns.includes(p.region.column);
    const facing = (f) => h('button', { disabled: !own || !active || f === p.facing || !!p.formationChange, title: p.state === 'engaged' ? 'In contact: combat keeps the old arrangement this Tick; the change fails if it would pull a touching member out of contact' : `face ${f} (one Tick)`, onclick: () => this._addCommand(p.owner, { type: 'change_formation', partyId: p.id, facing: f }) && this._toast(`Formation change to face ${f} planned (takes one Tick${p.state === 'engaged' ? '; legality is rechecked at completion' : ''})`) }, f);
    return h('div', {},
      h('h3', {}, partyName(s, p.id)),
      h('div', { class: 'kv' },
        h('span', {}, 'Global / home'), h('span', {}, `R${p.region.row}C${p.region.column} / R${local.row}C${local.column}`),
        h('span', {}, 'State'), h('span', {}, `${p.state}${p.mountLost ? ' (mount lost)' : ''}${engagedWith.length ? ` with ${engagedWith.map((id) => partyName(s, id)).join(', ')}` : ''}`),
        h('span', {}, 'Facing'), h('span', {}, `${p.facing}${p.turn ? ` → ${p.turn.to} at Tick end` : ''}`),
        ...(() => { const st = standingOf(s, this.ctx, p); return [h('span', {}, 'Stands'), h('span', {}, `${st.label ?? 'surface ground'} · band ${fmtBand(p.band)} · ${st.exposed ? 'exposed (counts for income/blocking)' : 'not exposed (roofed)'}`, h('div', { class: 'dim small' }, st.note))]; })(),
        h('span', {}, 'Supply'), h('span', {}, `${pts(supplyOf(p))}${p.supply.length ? ` (${p.supply.map((x) => `${pts(x.units)} from ${x.cardId}`).join(', ')})` : ''}`),
        h('span', {}, 'Speed'), h('span', {}, p.mount ? `${this.ctx.profile.movement.speeds[p.mount].join('/')} step per Tick` : 'none (needs a Mount)'),
        h('span', {}, 'Destination'), h('span', {}, p.destination ? `R${p.destination.row}C${p.destination.column}` : '—'),
        p.pool ? h('span', {}, 'Party pool') : null, p.pool ? h('span', {}, `${pts(p.pool.hp)}/${pts(p.pool.max)} (maintenance)`) : null),
      h('h4', {}, 'Formation (front at top, seen from behind)'), grid,
      own ? h('div', { class: 'actions' },
        h('div', { class: 'dim small' }, active ? (p.mount ? 'Right-click a highlighted territory: destination.' : 'An unmounted Pawn stores Supply but cannot move.') : `C${p.region.column} is not active: only Supply can reach this party now.`),
        h('div', { class: 'row' }, 'Face ', facing('N'), facing('E'), facing('S'), facing('W')),
        p.state === 'engaged' ? this._retreatPreview(p) : null,
        p.state === 'engaged' ? h('button', { disabled: !active, onclick: () => { this.tool = { kind: 'retreat', partyId: p.id }; this._toast('Retreat: right-click a legal destination away from contact. Touching members die.'); } }, 'Retreat…') : null) : null);
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
    const s = this.state, arch = CATALOG.archetypes[m.archetype];
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
    const s = this.state, def = CATALOG.cards[card.abilityId];
    const own = card.owner === this.viewSeat && this.seats[card.owner] === 'human' && card.state === 'available';
    const planned = this._plannedCardIds(card.owner).has(card.id);
    return h('div', {},
      h('h3', {}, `${card.rank} of ${SUIT_NAME[card.suit]} · ${card.owner} C${card.localColumn}`),
      h('div', { class: 'kv' },
        h('span', {}, 'Supply'), h('span', {}, pts(card.supply)),
        h('span', {}, 'Mana'), h('span', {}, fmtMana(card.mana)),
        h('span', {}, 'Minted'), h('span', {}, `Tick ${card.tick} from ${card.frontierParty ? partyName(s, card.frontierParty) : '—'}${card.blocker ? `, cut at ${card.blocker}` : ''}`),
        h('span', {}, 'State'), h('span', {}, `${card.state}${planned ? ' (planned)' : ''}`)),
      card.pips?.length ? h('div', { class: 'small' }, 'Mana provenance: ', ...card.pips.map((p) => h('span', { class: `chip c-${p.color}` }, `R${p.row}:${COLOR_LETTER[p.color]}${p.amount}`))) : null,
      h('h4', {}, def?.title ?? 'Ability'), h('p', {}, def?.text ?? ''),
      h('p', { class: 'dim small' }, `Definition ${card.ability} · creator ${def?.lineage?.creator?.label ?? '—'}`),
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
    return h('div', {}, h('h3', {}, e.type.replace(/_/g, ' ')), h('p', {}, eventLine(s, e) ?? ''), h('pre', { class: 'raw' }, JSON.stringify(e, null, 1).slice(0, 1600)));
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
      h('ol', {}, ...req.stack.map((e) => h('li', {}, `${e.seat}: ${CATALOG.cards[e.defId].title}${e.target?.memberId ? ` → ${memberName(s, e.target.memberId)}` : e.target?.stackId ? ` → ${e.target.stackId}` : ''}${e.countered ? ' (countered)' : ''}`))),
      ...opts.cards.map((id) => {
        const c = s.cards[id];
        const def = CATALOG.cards[c.abilityId];
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
    case 'load_supply': return `Supply ${c.cardId} → ${partyName(state, c.partyId)}`;
    case 'burn': return `Burn ${c.cardId} (${fmtMana(state.cards[c.cardId]?.mana)})`;
    case 'set_destination': return `${partyName(state, c.partyId)} → R${c.target.row}C${c.target.column}`;
    case 'change_formation': return `${partyName(state, c.partyId)} faces ${c.facing}`;
    case 'retreat': return `${partyName(state, c.partyId)} retreats → R${c.target.row}C${c.target.column}`;
    case 'play_ability': { const d = CATALOG.cards[state.cards[c.cardId]?.abilityId]; return `${d?.title ?? 'Ability'} (${c.cardId})${c.burns?.length ? `, burning ${c.burns.join(', ')}` : ''}`; }
    case 'concede': return 'Concede';
    default: return c.type;
  }
}

/** A card face for the world bank tiles. */
export function drawCardCanvas(card, state, w = 120, h2 = 160) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h2;
  const g = cv.getContext('2d');
  const def = CATALOG.cards[card.abilityId];
  g.fillStyle = '#efe6d2'; g.fillRect(0, 0, w, h2);
  g.strokeStyle = OWNER_HEX[card.owner]; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h2 - 8);
  g.fillStyle = '#1d1a24'; g.textAlign = 'center';
  if (card.category === 'major') {
    g.font = 'bold 15px serif'; g.fillText('MAJOR', w / 2, 34);
    g.font = 'bold 13px serif'; (def?.title ?? '').split(' ').forEach((wd, i) => g.fillText(wd, w / 2, 62 + i * 18));
    return cv;
  }
  const art = renditionFor(card);
  if (art) { // the deck face as a band behind the rules text; the numbers stay legible on top
    drawCover(g, art.img, 8, 8, w - 16, h2 - 16);
    g.fillStyle = 'rgba(239,230,210,0.78)'; g.fillRect(8, 20, w - 16, 104);
    g.fillStyle = '#1d1a24';
  }
  g.font = 'bold 46px serif'; g.fillText(String(card.rank ?? ''), w / 2 - 14, 60);
  g.font = '36px serif'; g.fillText(SUIT[card.suit] ?? '', w / 2 + 26, 58);
  g.font = 'bold 15px sans-serif'; g.fillText(`Supply ${pts(card.supply ?? 0)}`, w / 2, 88);
  let x = 16;
  for (const [c, n] of Object.entries(card.mana ?? {})) { g.fillStyle = COLOR_HEX[c]; g.fillRect(x, 100, 24, 20); g.fillStyle = c === 'white' || c === 'yellow' ? '#111' : '#fff'; g.font = 'bold 13px sans-serif'; g.fillText(`${COLOR_LETTER[c]}${n}`, x + 12, 115); x += 28; }
  g.fillStyle = '#3a3346'; g.font = '12px sans-serif'; g.fillText(def?.title ?? '', w / 2, 144);
  return cv;
}
