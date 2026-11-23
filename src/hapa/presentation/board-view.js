/**
 * The battlefield diorama (Master Requirements v3 Chapter 12; Design Companion v1 Chapters 3–6,
 * 15). A presentation adapter: it draws the authoritative state (territories, contact strips,
 * Capitals, the three banks, every member at its slot with its facing, party anchors) and turns
 * picks into territory / member / party ids. It never changes rules state.
 *
 * Coordinates: one rules member width = S world units; world X = x·S, world Z = −y·S (A's home is
 * the near edge in A's home view).
 */
import * as THREE from 'three';
import { Sprite3D } from '../../../vendor/lumina/src/engine/sprite/Sprite3D.js';
import { createCharacterSheet } from '../../../vendor/lumina/src/engine/pixel/CharacterSprites.js';
import { territoryColors } from '../rules/economy.js';
import { surfaceBand } from '../rules/terrain.js';
import { TerrainView, bandY, textLabel, standingOf } from './terrain-view.js';
import { paintGround, PX } from './ground-painter.js';
import { HitFX } from './fx.js';
import { attachGear, placeGear } from './gear.js';
import { FACINGS } from '../rules/geometry.js';
import { bodyVisible } from './playback.js';
import { ResourceSites } from './firepit.js';
import { buildBoardFrame } from './boardframe.js';
import { pieceOf, standardSprite, pieceTexture, zoomLevel, STANDARD_PX, STANDARD_OPACITY } from './pieces.js';

export const S = 1.5; // world units per member width
export const COLOR_HEX = {
  red: '#c8473c', green: '#4d9a4a', purple: '#7b4fa8', yellow: '#d9b840', blue: '#3f6fc4', orange: '#d9853b',
  black: '#2a2730', white: '#e9e4d6', rainbow: '#c08fd8',
};
export const OWNER_HEX = { A: '#7FB2E8', B: '#E8857A' }; // with single (A) / double (B) brackets
/** The player's reduced-motion preference (cosmetic motion only; state changes stay visible). */
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const SUIT_GLYPH = { wands: '♣', pentacles: '✪', cups: '♥', swords: '♠', wildcard: '✱' };

/** Sprite specs per role (procedural Luminati pixel characters; the owner color is the tabard). */
/**
 * Hapa party recipes — a provisional sample (addendum 01 §9, review 03 R3-04): the native Luminati
 * procedural painter (CharacterSprites at the vendored pin), no external media. One shared
 * proportion and material language per owner: A slate-blue, B oxblood, both with ivory trim and
 * brass accents (Design Companion's slate / ivory / brass); shields keep the owner value.
 */
function spriteSpec(role, mount, owner) {
  const top = owner === 'A' ? '#2f4a6e' : '#7a2e2a';
  const trim = owner === 'A' ? '#e8e2d0' : '#efe3d0';
  const lining = owner === 'A' ? '#1d2f48' : '#4a1a18';
  const base = { outfit: { top, bottom: owner === 'A' ? '#363c4c' : '#3c3236', accent: 'gold', style: 'tabard', shirt: 'metal' }, cape: false, beard: false };
  switch (role) {
    case 'swordsman': return { ...base, preset: 'swordsman', weapon: 'sword', gear: { shield: owner === 'A' ? '#24405f' : '#6a2522', boots: 'black' } };
    case 'pikeman': return { ...base, preset: 'guard', weapon: 'spear', hat: 'helmet' };
    case 'archer': return { ...base, preset: 'hunter', weapon: 'bow', hat: 'hood', hatColor: top, outfit: { ...base.outfit, style: 'tunic', shirt: 'cream' } };
    case 'mage': return { ...base, preset: 'scholar', weapon: 'staff', hat: 'wide', hatColor: lining, outfit: { ...base.outfit, style: 'robe', shirt: 'cream' } };
    case 'priest': return { ...base, preset: 'cleric', weapon: 'holystaff', hat: 'circlet', outfit: { ...base.outfit, style: 'robe', top: trim, shirt: 'cream' } };
    default: {
      const hats = { castle: 'helmet', knight: 'helmet', bishop: 'circlet', queen: 'circlet', king: 'crown', commander: 'crown' };
      const weapon = mount === 'bishop' ? 'holystaff' : mount === 'queen' ? 'staff' : 'sword';
      return { ...base, preset: 'guard', hat: hats[mount] ?? 'helmet', weapon, cape: { color: trim, style: mount === 'commander' ? 'cloak' : 'short', lining } };
    }
  }
}

/** A Supply token sprite: a brass ration-crate icon with the loaded count, plus "+n" when planned. */
function supplyToken(have, plan) {
  const txt = `${+have.toFixed(2)}`;
  const extra = plan ? ` +${+plan.toFixed(2)}` : '';
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = '800 34px system-ui, sans-serif';
  const w = 62 + Math.ceil(probe.measureText(txt).width) + (extra ? Math.ceil(probe.measureText(extra).width) + 6 : 0) + 14;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = 56;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgba(23,33,45,0.92)'; g.beginPath(); g.roundRect(2, 2, w - 4, 52, 14); g.fill();
  g.lineWidth = 3; g.strokeStyle = plan ? '#8FD3A0' : '#C9A65E';
  if (plan) g.setLineDash([7, 5]);
  g.stroke(); g.setLineDash([]);
  // the icon: a small strapped crate
  g.fillStyle = '#C9A65E'; g.fillRect(14, 14, 32, 28); g.strokeStyle = '#0D131B'; g.lineWidth = 3; g.strokeRect(14, 14, 32, 28);
  g.beginPath(); g.moveTo(14, 28); g.lineTo(46, 28); g.moveTo(30, 14); g.lineTo(30, 42); g.stroke();
  g.font = '800 34px system-ui, sans-serif'; g.textBaseline = 'middle';
  g.fillStyle = '#F5F0E3'; g.fillText(txt, 56, 30);
  if (extra) { g.fillStyle = '#8FD3A0'; g.fillText(extra, 56 + probe.measureText(txt).width + 4, 30); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, toneMapped: false }));
  spr.userData.w = 0.55 * (w / 56); spr.userData.h = 0.55;
  spr.scale.set(spr.userData.w, spr.userData.h, 1);
  spr.renderOrder = 9;
  return spr;
}

const MOUNT_GLYPH = { castle: '♜', knight: '♞', bishop: '♝', queen: '♛', king: '♚', commander: '♚' };
const crestCache = new Map();
/** A flat round plaque with the Mount's movement glyph (a Commander's carries a brass star). */
function mountCrest(mount, ownerHex, commander) {
  const key = `${mount}:${ownerHex}:${commander}`;
  if (!crestCache.has(key)) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fillStyle = '#F5F0E3'; g.fill();
    g.lineWidth = 9; g.strokeStyle = ownerHex; g.stroke();
    g.lineWidth = 3; g.strokeStyle = '#17212D'; g.beginPath(); g.arc(64, 64, 63, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#17212D'; g.font = '76px "Apple Symbols", "Segoe UI Symbol", "DejaVu Sans", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(MOUNT_GLYPH[mount] ?? '•', 64, 70);
    if (commander) { g.fillStyle = '#C9A65E'; g.font = 'bold 30px sans-serif'; g.fillText('★', 100, 26); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    crestCache.set(key, t);
  }
  // 0.46 S: legible at overview distance (UX-10)
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.46 * S, 24), new THREE.MeshBasicMaterial({ map: crestCache.get(key), transparent: true, depthWrite: false, toneMapped: false }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 3;
  return m;
}

/** Four L-shaped corner brackets lying on the ground (half-size `half`, arm length `arm`). */
function cornerBrackets(half, arm, thick, color, opacity) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const h = new THREE.Mesh(new THREE.PlaneGeometry(arm, thick), mat);
    h.rotation.x = -Math.PI / 2; h.position.set(sx * (half - arm / 2), 0, sz * half);
    const v = new THREE.Mesh(new THREE.PlaneGeometry(thick, arm), mat);
    v.rotation.x = -Math.PI / 2; v.position.set(sx * half, 0, sz * (half - arm / 2));
    g.add(h, v);
  }
  g.renderOrder = 3;
  g.visible = true;
  return g;
}

export class BoardView {
  /** @param {THREE.Scene} scene @param {any} ctx rules context */
  constructor(scene, ctx) {
    this.scene = scene;
    this.ctx = ctx;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.cols = ctx.profile.board.columns;
    this.rows = ctx.profile.board.rows;
    this.w = this.cols * 4; // member widths
    this.h = this.rows * 4;
    this.sheets = new Map();
    this.sprites = new Map();
    this.markers = new Map();
    this.cardTiles = new Map();
    this._buildLights();
    this._buildGround();
    this._buildOverlays();
    this.terrain = new TerrainView(this.root, ctx, (x, y) => this.toWorld(x, y), S);
    this.terrain.onOpenCells = (cells) => this._punchGround(cells);
    this.fx = new HitFX(this.root);
    this.sites = new ResourceSites(this.root, (x, y) => new THREE.Vector3(x * S, 0, -y * S), { w: this.w, h: this.h, S });
    this.frame = buildBoardFrame(this.root, { w: this.w, h: this.h, S });
    this._time = 0;
  }

  /**
   * World anchor of an inspectable subject (addendum 01 §3): a bank Card tile, a party's marker at
   * its height, a member body, or a Fire Pit / Mana basin. Null when it is not on the board.
   */
  anchorOf(subject, state) {
    if (!subject) return null;
    if (subject.kind === 'card') { const t = [...this.cardTiles.values()].find((x) => x.userData.cardId === subject.id); return t ? t.position.clone().setY(0.3) : null; }
    if (subject.kind === 'party') { const mk = this.markers.get(subject.id), p = state?.parties[subject.id]; return mk && p && !p.retired ? mk.position.clone().setY(this.partyY(p) + 1.6 * S) : null; }
    if (subject.kind === 'member') { const sp = this.sprites.get(subject.id); return sp?.visible ? sp.position.clone().setY(sp.position.y + 1.2) : null; }
    if (subject.kind === 'basin' || subject.kind === 'pit') return this.sites.anchor(subject.id, subject.kind);
    if (subject.kind === 'territory') { const [c, r] = subject.id.split(',').map(Number); const p = this.ctx.geo.center(c, r); return this.toWorld(p.x, p.y).setY(0.2); }
    return null;
  }

  /** Repaint the surface and clear the member squares open to the sky. */
  _punchGround(cells) {
    const { g, base, px, py, tex } = this.groundPaint;
    g.putImageData(base, 0, 0);
    for (const { x, y } of cells) g.clearRect(px(x - 0.5), py(y + 0.5), PX, PX);
    tex.needsUpdate = true;
  }

  /** Step the cutaway layer: null (all) → +3 … +1, −1 … −3 → null. */
  stepLayer(dir) {
    const order = [null, 3, 2, 1, -1, -2, -3];
    const i = order.indexOf(this.terrain.cutaway);
    const next = order[(i + dir + order.length) % order.length];
    this.setLayer(next);
    return next;
  }

  setLayer(band) { this.terrain.setCutaway(band, this.ground); this._layerDirty = true; }

  get center() { return new THREE.Vector3((this.w / 2) * S, 0, -(this.h / 2) * S); }
  get size() { return Math.max(this.w, this.h) * S; }
  /**
   * The camera's framing subject: the playable territory plus a one-member-width allowance (edge
   * labels, Capitals, active-column headers) plus both owners' real Card banks (Minor, Major, row
   * Enchantments), Fire Pits and Mana basins: with the hand ribbons gone the banks are the Card
   * surface, so the default view must reach them (addendum 01 §2; review 04, R4-01).
   */
  get subject() { const e = ResourceSites.extents(this.w, this.h); return { x0: e.x0 * S, x1: e.x1 * S, z0: -e.y1 * S, z1: -e.y0 * S }; }
  /**
   * The world height at which a party is drawn: its members' band (a flyer at its flight band, a
   * hilltop party on the hill, a tunnel party below ground). Overlays and focus use it so markers
   * sit with what the player sees.
   */
  partyY(p) { return bandY(p.band ?? 1); }

  /** The world height of a territory's walking surface (a hill top, or the ground); under a cutaway, the shown band's floor. */
  surfaceY(column, row) {
    const layer = this.terrain.cutaway;
    if (layer !== null && layer < 1) return bandY(layer);
    return bandY(surfaceBand(this._state?.terrain ?? { hills: {} }, column, row));
  }

  /** The height an overlay for travel to a territory sits at, for this party's movement mode. */
  travelY(party, column, row) {
    return party.movementMode === 'air' || (party.band ?? 1) < 1 ? this.partyY(party) : bandY(surfaceBand(this._state?.terrain ?? { hills: {} }, column, row));
  }

  /** rules units → world */
  toWorld(x, y) { return new THREE.Vector3((x / this.ctx.U) * S, 0, -(y / this.ctx.U) * S); }
  /** world → member-width board coordinates */
  toBoard(v) { return { x: v.x / S, y: -v.z / S }; }

  _buildLights() {
    // a stable warm key and a cool fill (Design Companion ch.2); the light stays with the world
    const hemi = new THREE.HemisphereLight(0xc9d8f0, 0x4a3a28, 1.05);
    const fill = new THREE.DirectionalLight(0x9db8ff, 0.7);
    fill.position.set(-this.w * S * 0.6, 30, -this.h * S * 1.2);
    this.root.add(fill);
    const sun = new THREE.DirectionalLight(0xffdcae, 2.9);
    sun.position.set(this.w * S * 0.2, 60, 30);
    sun.target.position.copy(this.center);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const half = this.size * 0.75;
    Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: 200 });
    sun.shadow.bias = -0.0005;
    this.root.add(hemi, sun, sun.target);
  }

  /** The ground: painted slabs, earth strips, inlays, plaques, Capitals, labels and bank trays. */
  _buildGround() {
    const { ctx } = this;
    const paint = paintGround(ctx, { cols: this.cols, rows: this.rows });
    const { color: cv, emissive, px, py, W, H } = paint;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const glow = new THREE.CanvasTexture(emissive);
    glow.colorSpace = THREE.SRGBColorSpace;
    // open excavations are cut out of the surface so a pit is seen from above (alphaTest)
    const g = cv.getContext('2d');
    this.groundPaint = { g, base: g.getImageData(0, 0, cv.width, cv.height), px, py, tex, px1: PX };
    const geo = new THREE.PlaneGeometry(W * S, H * S);
    const mat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, emissive: 0xffffff, emissiveMap: glow, emissiveIntensity: 0.9 });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set((this.w / 2) * S, 0, -(this.h / 2) * S);
    ground.receiveShadow = true;
    ground.name = 'ground';
    this.ground = ground;
    this.root.add(ground);
  }

  _buildOverlays() {
    // active columns: a patterned edge along both sides and a named header at each end (not a wash)
    const stripe = document.createElement('canvas');
    stripe.width = 16; stripe.height = 64;
    const sg = stripe.getContext('2d');
    for (let i = -4; i < 8; i++) { sg.fillStyle = i % 2 ? 'rgba(245,240,227,0.95)' : 'rgba(201,166,94,0.95)'; sg.beginPath(); sg.moveTo(0, i * 16); sg.lineTo(16, i * 16 - 16); sg.lineTo(16, i * 16); sg.lineTo(0, i * 16 + 16); sg.closePath(); sg.fill(); }
    const stripeTex = new THREE.CanvasTexture(stripe);
    stripeTex.wrapS = stripeTex.wrapT = THREE.RepeatWrapping;
    stripeTex.repeat.set(1, this.h / 1.2);
    stripeTex.colorSpace = THREE.SRGBColorSpace;
    this.activeCols = new Map();
    for (let c = 1; c <= this.cols; c++) {
      const grp = new THREE.Group();
      for (const x of [4 * c - 3.72, 4 * c - 0.28]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.22 * S, this.h * S), new THREE.MeshBasicMaterial({ map: stripeTex, transparent: true, depthWrite: false, toneMapped: false }));
        m.rotation.x = -Math.PI / 2;
        m.position.set(x * S, 0.025, -(this.h / 2) * S);
        m.renderOrder = 1;
        grp.add(m);
      }
      for (const y of [-0.05, this.h + 0.05]) {
        const lab = textLabel(`ACTIVE C${c}`, { color: '#F5F0E3', bg: 'rgba(201,166,94,0.92)', size: 0.55 });
        lab.material.color.set(0xffffff);
        lab.position.set((4 * c - 2) * S, 0.7, -y * S);
        grp.add(lab);
      }
      grp.visible = false;
      this.activeCols.set(c, grp);
      this.root.add(grp);
    }
    // legal destination squares (pooled)
    this.destGroup = new THREE.Group();
    this.root.add(this.destGroup);
    this.routeLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xfff2b0 }));
    this.routeLine.renderOrder = 3;
    this.root.add(this.routeLine);
    // the selection: the heaviest outline (ivory brackets over a slate keyline, plus a soft footprint)
    this.selectRing = new THREE.Group();
    const keyline = cornerBrackets(2.2 * S, 0.8 * S, 0.26 * S, 0x17212d, 0.9), ivory = cornerBrackets(2.2 * S, 0.8 * S, 0.15 * S, 0xf5f0e3, 0.999);
    // both transparent, drawn keyline first, so the ivory always sits on top of its slate edge
    keyline.traverse((o) => { o.renderOrder = 4; }); ivory.traverse((o) => { o.renderOrder = 5; }); ivory.position.y = 0.006;
    this.selectRing.add(keyline, ivory);
    const foot = new THREE.Mesh(new THREE.PlaneGeometry(4.2 * S, 4.2 * S), new THREE.MeshBasicMaterial({ color: 0xf5f0e3, transparent: true, opacity: 0.07, depthWrite: false, toneMapped: false }));
    foot.rotation.x = -Math.PI / 2; foot.position.y = -0.01; foot.renderOrder = 2;
    this.selectRing.add(foot);
    this.selectRing.visible = false;
    this.root.add(this.selectRing);
    this.hoverRing = cornerBrackets(1.62 * S, 0.45 * S, 0.07 * S, 0xc8d2da, 1);
    this.hoverRing.visible = false;
    this.root.add(this.hoverRing);
  }

  setActiveColumns(cols) { for (const [c, g] of this.activeCols) g.visible = cols.includes(c); }

  _sheet(role, mount, owner) {
    const key = `${role}:${mount}:${owner}`;
    if (!this.sheets.has(key)) this.sheets.set(key, createCharacterSheet(spriteSpec(role, mount, owner)));
    return this.sheets.get(key);
  }

  /** Create or update every member sprite and party marker from a state (positions optional override). */
  sync(state, positions = null) {
    this._state = state;
    const seen = new Set();
    this.terrain.sync(state);
    const layer = this.terrain.cutaway;
    for (const m of Object.values(state.members)) {
      const party = state.parties[m.party];
      let spr = this.sprites.get(m.id);
      if (!spr) {
        spr = new Sprite3D(this._sheet(m.archetype, party?.mount ?? state.parties[m.homeParty]?.mount, m.owner), { scale: 0.82, blobSize: [0.9, 0.6] });
        spr.userData = { memberId: m.id };
        spr.play('idle_down');
        this.sprites.set(m.id, spr);
        this.root.add(spr);
        spr.add(this._ownerDisc(m.owner));
        // away markers: a gold diamond for a corner helper, a red triangle for a breach step
        spr.userData.awayCorner = this._awayMark(4, 0xf2c14e);
        spr.userData.awayBreach = this._awayMark(3, 0xff6b5b);
        spr.add(spr.userData.awayCorner, spr.userData.awayBreach);
        // the archetype's held gear (sword in the right hand, shield on the left arm), from catalog data
        spr.userData.gear = attachGear(spr, this.ctx.catalog.archetypes[m.archetype], m.owner);
      }
      spr.userData.awayCorner.visible = m.alive && m.helperAway?.kind === 'corner';
      spr.userData.awayBreach.visible = m.alive && m.helperAway?.kind === 'breach';
      seen.add(m.id);
      // during playback a pose (playback.js) says where the body is, whether it is alive yet and its
      // band at that moment; this is the one place a body's visibility is decided (R2-01)
      const pose = positions?.[m.id];
      const pos = pose ?? [m.x, m.y];
      const w = this.toWorld(pos[0], pos[1]);
      const band = pose ? pose[3] : (m.band ?? 1);
      const hgt = pose ? pose[4] : bandY(band);
      spr.position.set(w.x, hgt + 0.03, w.z);
      spr.visible = bodyVisible(pose ? pose[2] : m.alive, band, layer);
      // a flyer keeps a line to the floor below it, so height is never the only cue
      const flying = party?.movementMode === 'air';
      if (flying && !spr.userData.flyLine) {
        const line = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 6), new THREE.MeshBasicMaterial({ color: 0x9fd8ff }));
        spr.add(line);
        spr.userData.flyLine = line;
      }
      if (spr.userData.flyLine) {
        spr.userData.flyLine.visible = flying;
        spr.userData.flyLine.scale.y = Math.max(0.01, hgt);
        spr.userData.flyLine.position.y = -hgt / 2;
      }
      spr.userData.facing = party?.facing ?? 'N';
      if (spr.userData.gear) {
        const F = FACINGS[spr.userData.facing] ?? FACINGS.N;
        // rules (x, y) → world (x, −z)
        placeGear(spr.userData.gear, { x: F.fx, z: -F.fy }, { x: F.rx, z: -F.ry }, spr.visible);
      }
    }
    for (const [id, spr] of this.sprites) if (!seen.has(id)) { spr.visible = false; }
    // party markers
    for (const p of Object.values(state.parties)) {
      let mk = this.markers.get(p.id);
      if (!mk) { mk = this._partyMarker(p); this.markers.set(p.id, mk); this.root.add(mk); }
      const pose = positions?.[`party:${p.id}`];
      const pos = pose ?? [p.x, p.y];
      const w = this.toWorld(pos[0], pos[1]);
      mk.position.set(w.x, (p.movementMode === 'air' ? 0 : pose ? pose[4] : bandY(p.band ?? 1)) + 0.04, w.z);
      mk.visible = p.alive && !p.retired;
      // the chess standard replaces the small plaque (addendum 01 §5): one per party, at its
      // logical center, owner by value/shape; a lost Mount says so instead of implying travel
      if (mk.userData.crest) mk.userData.crest.visible = false;
      const key = `${p.owner}:${pieceOf(p)}:${p.mountLost ? 'lost' : ''}`;
      if (mk.userData.standardKey !== key) {
        if (mk.userData.standard) { mk.remove(mk.userData.standard); mk.userData.standard.material.dispose(); }
        const sp = standardSprite(p.owner, pieceOf(p), { status: p.mountLost ? 'MOUNT LOST' : null });
        sp.position.set(0, 2.1 * S, 0);
        sp.scale.set(0.001, 0.001, 1);
        mk.add(sp);
        mk.userData.standard = sp; mk.userData.standardKey = key;
      }
      mk.userData.standard.visible = mk.visible && (layer === null || (p.band ?? 1) === layer || p.movementMode === 'air');
      // decisive terrain facts in words: hilltop, open pit, roofed tunnel or flying
      const st = standingOf(state, this.ctx, p);
      if (mk.userData.standing !== st.label) {
        if (mk.userData.standingLabel) mk.remove(mk.userData.standingLabel);
        mk.userData.standingLabel = null;
        mk.userData.standing = st.label;
        if (st.label) {
          const lab = textLabel(st.label, { color: st.kind === 'tunnel' ? '#c6b2ff' : st.kind === 'pit' ? '#ffb08a' : st.kind === 'flying' ? '#9fd8ff' : '#f0d49a', size: 0.5 });
          lab.position.set(0, 2.2, 1.9 * S);
          mk.add(lab);
          mk.userData.standingLabel = lab;
        }
      }
      const rot = { N: 0, E: -Math.PI / 2, S: Math.PI, W: Math.PI / 2 }[p.facing];
      mk.rotation.y = rot;
      mk.userData.empty.visible = !p.slots['5'] || !state.members[p.slots['5']]?.alive;
    }
  }

  _ownerDisc(owner) {
    // A: a solid disc; B: an open ring with a dark centre — ownership by shape and value as well as hue
    const geo = owner === 'A' ? new THREE.CircleGeometry(0.34 * S, 20) : new THREE.RingGeometry(0.22 * S, 0.37 * S, 20);
    const disc = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: OWNER_HEX[owner], transparent: true, opacity: 0.85, depthWrite: false }));
    const edge = new THREE.Mesh(new THREE.RingGeometry(owner === 'A' ? 0.34 * S : 0.37 * S, owner === 'A' ? 0.39 * S : 0.42 * S, 20), new THREE.MeshBasicMaterial({ color: 0x17212d, transparent: true, opacity: 0.8, depthWrite: false }));
    if (owner === 'B') { const hole = new THREE.Mesh(new THREE.CircleGeometry(0.22 * S, 20), new THREE.MeshBasicMaterial({ color: 0x17212d, transparent: true, opacity: 0.55, depthWrite: false })); disc.add(hole); }
    disc.add(edge);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.02;
    disc.renderOrder = 2;
    return disc;
  }

  _awayMark(sides, color) {
    const mk = new THREE.Mesh(new THREE.RingGeometry(0.48 * S, 0.58 * S, sides, 1, Math.PI / 4), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }));
    mk.rotation.x = -Math.PI / 2;
    mk.position.y = 0.025;
    mk.renderOrder = 3;
    mk.visible = false;
    return mk;
  }

  _partyMarker(p) {
    const g = new THREE.Group();
    g.userData.partyId = p.id;
    const color = new THREE.Color(OWNER_HEX[p.owner]);
    // ownership: single brackets for A, double brackets for B (shape, not only hue)
    // ownership is a quiet persistent baseline (review UX-10): same shapes, lower weight, so the
    // selection outline stays the strongest mark on the field
    // (the shapes must still read in grayscale: checked with a color-reduced capture, UX-10/UX-14)
    g.add(cornerBrackets(1.72 * S, 0.42 * S, 0.07 * S, color, 0.6));
    if (p.owner === 'B') g.add(cornerBrackets(1.92 * S, 0.36 * S, 0.06 * S, color, 0.6));
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(-0.45 * S, 0); arrowShape.lineTo(0.45 * S, 0); arrowShape.lineTo(0, 0.5 * S); arrowShape.closePath();
    const arrow = new THREE.Mesh(new THREE.ShapeGeometry(arrowShape), new THREE.MeshBasicMaterial({ color, depthWrite: false, side: THREE.DoubleSide }));
    arrow.rotation.x = -Math.PI / 2;
    arrow.position.set(0, 0.01, -1.95 * S);
    const arrowEdge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.45 * S, 0, 0), new THREE.Vector3(0.45 * S, 0, 0), new THREE.Vector3(0, 0.5 * S, 0)]), new THREE.LineBasicMaterial({ color: 0x0d131b }));
    arrow.add(arrowEdge);
    // an empty center (Pawn) reads as a dashed square, never as a missing member
    const empty = new THREE.Mesh(new THREE.RingGeometry(0.3 * S, 0.42 * S, 4, 1, Math.PI / 4), new THREE.MeshBasicMaterial({ color: 0xe8dcc0, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
    empty.rotation.x = -Math.PI / 2;
    g.add(arrow, empty);
    // the Mount crest: its movement glyph on a round plaque in the strip at the formation's left
    // (clear of the facing arrow, the rear row and the edge labels; Pawns carry none)
    if (p.mount) {
      const crest = mountCrest(p.mount, OWNER_HEX[p.owner], p.commander);
      crest.position.set(-2.02 * S, 0.012, 0);
      g.add(crest);
      g.userData.crest = crest;
    }
    g.userData = { ...g.userData, partyId: p.id, empty };
    g.renderOrder = 2;
    return g;
  }

  /** Billboard + facing each frame. */
  update(dt, camera) {
    this.fx.update(dt);
    this._time += dt;
    this.sites.update(dt, this._time);
    this._sizeStandards(camera);
    const still = reducedMotion();
    if (this.dropRing?.visible) {
      this.dropRing.userData.t += dt;
      const k = still ? 1 : 1 + Math.sin(this.dropRing.userData.t * 7) * 0.05; // a steady frame under reduced motion
      this.dropRing.scale.set(k, 1, k);
    }
    for (const tok of this.supplyTokens?.values() ?? []) {
      if (still) tok.userData.pop = 1; // the new value shows at once, without the pop
      if (tok.userData.pop === undefined || tok.userData.pop >= 1) { tok.scale.set(tok.userData.w, tok.userData.h, 1); continue; }
      tok.userData.pop = Math.min(1, tok.userData.pop + dt * 2.2);
      const t = tok.userData.pop, k = 1 + Math.sin(t * Math.PI) * 0.6 * (1 - t);
      tok.scale.set(tok.userData.w * k, tok.userData.h * k, 1);
    }
    for (const spr of this.sprites.values()) {
      if (!spr.visible) continue;
      const f = spr.userData.facing;
      const v = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[f] ?? [0, -1];
      spr.faceVector(v[0], v[1]);
      const want = `${spr.userData.walking ? 'walk' : 'idle'}_${spr.direction}`;
      if (spr.animation !== want) spr.play(want, { keepPhase: true });
      spr.update(dt, camera);
    }
  }

  setWalking(ids) { for (const [id, spr] of this.sprites) spr.userData.walking = ids.has(id); }

  /** Highlight a selected party, its legal destinations and current route. */
  select(state, party, dests = []) {
    this.destGroup.clear();
    if (!party) { this.selectRing.visible = false; this.routeLine.visible = false; return; }
    this._state = state;
    const w = this.toWorld(party.x, party.y);
    this.selectRing.position.set(w.x, this.partyY(party) + 0.05, w.z);
    this.selectRing.visible = true;
    for (const d of dests) {
      const c = this.ctx.geo.center(d.column, d.row);
      const occupant = Object.values(state.parties).find((q) => q.alive && !q.retired && q.region.column === d.column && q.region.row === d.row);
      const color = occupant ? (occupant.owner === party.owner ? (occupant.mount ? 0x888888 : 0x9fe07a) : 0xff6b5b) : 0x7ad1ff;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.9 * S, 2.9 * S), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      const p = this.toWorld(c.x, c.y);
      m.position.set(p.x, this.travelY(party, d.column, d.row) + 0.03, p.z);
      m.renderOrder = 2;
      this.destGroup.add(m);
    }
    this.showRoute(party, party.route.map((n) => [n.x, n.y]));
  }

  showRoute(party, nodes) {
    if (!nodes.length) { this.routeLine.visible = false; return; }
    const U = this.ctx.U, geo = this.ctx.geo;
    const pts = [[party.x, party.y], ...nodes].map(([x, y], i) => {
      const v = this.toWorld(x, y);
      // each point at the surface it crosses (a hill top, the ground) or at a flyer / tunnel band
      const col = Math.floor(x / U / 4) + 1, row = Math.floor(y / U / 4) + 1;
      v.y = (i === 0 ? this.partyY(party) : geo.onBoard(col, row) ? this.travelY(party, col, row) : this.partyY(party)) + 0.12;
      return v;
    });
    this.routeLine.geometry.dispose();
    this.routeLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    this.routeLine.visible = true;
  }

  hover(territory) {
    if (!territory) { this.hoverRing.visible = false; return; }
    const c = this.ctx.geo.center(territory.column, territory.row);
    const w = this.toWorld(c.x, c.y);
    this.hoverRing.position.set(w.x, this.surfaceY(territory.column, territory.row) + 0.035, w.z);
    this.hoverRing.visible = true;
  }

  /**
   * Pick what the pointer is over, by visible height (Design Companion "Seeing a six-band volume"):
   *  1. member bodies the player can see — drawn at their band, in the shown layer, and not under a
   *     roof while all layers are shown — nearest the ray wins within a party;
   *  2. otherwise the territory surface under the pointer (a hill top, the ground, or the shown
   *     band's floor in a cutaway) and the parties occupying it in the shown layers.
   * When more than one party qualifies the result is ambiguous: `party` is null and `candidates`
   * lists them for the player to choose. A filtered-out layer never wins. Presentation only: rules
   * collision and legality stay in the rules module.
   * @returns {{ territory: {column:number,row:number}|null, member: any, party: any, point: {x:number,y:number}|null, candidates: Array<{ party: any, member: any, band: number, covered: boolean }>, layer: number|null } | null}
   */
  pick(raycaster, state) {
    this._state = state;
    const U = this.ctx.U, ray = raycaster.ray, layer = this.terrain.cutaway;
    const shown = (band) => layer === null || band === layer;
    const coveredParty = (p) => layer === null && (p.band ?? 1) < 0 && standingOf(state, this.ctx, p).kind === 'tunnel';
    const reach = 0.55 * S, body = new THREE.Vector3();
    // 1. visible bodies
    const byParty = new Map();
    for (const m of Object.values(state.members)) {
      if (!m.alive) continue;
      const spr = this.sprites.get(m.id), p = state.parties[m.party];
      if (!spr || !p || !shown(m.band ?? 1) || coveredParty(p)) continue;
      body.copy(spr.position); body.y += 0.45;
      const d = Math.sqrt(ray.distanceSqToPoint(body));
      if (d > reach) continue;
      const along = body.clone().sub(ray.origin).dot(ray.direction);
      const prev = byParty.get(p.id);
      if (!prev || d < prev.d) byParty.set(p.id, { party: p, member: m, d, along, band: m.band ?? 1, covered: false });
    }
    // the surface under the pointer: hill tops first, then the ground (or the cutaway floor)
    let point = null;
    if (layer !== null && layer < 1) {
      const v = new THREE.Vector3();
      if (ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -bandY(layer)), v)) point = v;
    } else {
      const hit = raycaster.intersectObjects([...this.terrain.hillMeshes, this.ground], false)[0];
      point = hit?.point ?? null;
    }
    const b = point ? this.toBoard(point) : null;
    const column = b ? Math.floor(b.x / 4) + 1 : 0, row = b ? Math.floor(b.y / 4) + 1 : 0;
    const territory = b && this.ctx.geo.onBoard(column, row) ? { column, row } : null;
    let candidates = [...byParty.values()].sort((x, y) => x.along - y.along);
    // 2. no body under the pointer: the occupants of that territory body in the shown layers
    if (!candidates.length && b) {
      for (const p of Object.values(state.parties)) {
        if (!p.alive || p.retired || !shown(p.band ?? 1)) continue;
        if (Math.abs(p.x / U - b.x) >= 1.6 || Math.abs(p.y / U - b.y) >= 1.6) continue;
        let member = null, best = Infinity;
        for (const id of Object.values(p.slots)) {
          const m = id && state.members[id];
          if (!m?.alive) continue;
          const d = Math.max(Math.abs(m.x / U - b.x), Math.abs(m.y / U - b.y));
          if (d < best) { best = d; member = m; }
        }
        candidates.push({ party: p, member, d: best, band: p.band ?? 1, covered: coveredParty(p) });
      }
      candidates.sort((x, y) => (y.band - x.band) || (x.d - y.d));
    }
    candidates = candidates.map(({ party, member, band, covered }) => ({ party, member, band, covered }));
    const one = candidates.length === 1 ? candidates[0] : null;
    return { territory, member: one?.member ?? null, party: one?.party ?? null, point: b, candidates, layer };
  }

  /**
   * Semantic zoom for the chess standards and endpoint ghosts: one level for the board from the
   * projected territory size, with hysteresis; sizes stay constant on screen.
   */
  _sizeStandards(camera = this._camera) {
    if (!camera) return;
    this._camera = camera;
    const H = this.viewportH ?? 720;
    const P11 = camera.projectionMatrix.elements[5];
    const dist = camera.position.distanceTo(this.center);
    const territoryPx = (4 * S * P11 * H) / (2 * Math.max(1e-3, dist));
    this.zoom = zoomLevel(this.zoom ?? 'overview', territoryPx);
    const size = (px) => (px * 2) / (P11 * H);
    for (const mk of this.markers.values()) {
      const sp = mk.userData.standard;
      if (!sp) continue;
      const k = this.emphasis === mk.userData.partyId ? 1.15 : 1;
      const h = size(STANDARD_PX[this.zoom] * (sp.userData.tall ? 1.17 : 1) * k);
      sp.scale.set(h * sp.userData.aspect, h, 1);
      sp.material.opacity = this.emphasis === mk.userData.partyId ? 1 : STANDARD_OPACITY[this.zoom];
    }
    for (const g of this.intents?.children ?? []) {
      // endpoint markers grow with the territory so their status stays legible up close
      const h = size(Math.max(40, Math.min(96, territoryPx * 0.6))) * (g.userData.emph ? 1.15 : 1);
      g.scale.set(h * g.userData.aspect, h, 1);
      g.material.opacity = g.userData.emph ? 0.95 : g.userData.quiet ? 0.5 : 0.75;
    }
  }

  /**
   * Public destination intent (addendum 01 §6): the party's chess glyph, hollow and dashed, at
   * each endpoint, with its status. Several intents on one territory and band fan out with a count.
   * Not pickable, not an occupant. `emphasis` brightens one party's pair.
   * @param {Array<{ partyId: string, owner: 'A'|'B', piece: string, target: {column:number,row:number}, band: number, status: string, bad?: boolean }>} list
   */
  syncIntents(list, emphasis = null) {
    this.intents ??= new THREE.Group();
    if (!this.intents.parent) this.root.add(this.intents);
    for (const c of this.intents.children) c.material.dispose();
    this.intents.clear();
    this.emphasis = emphasis;
    const groups = new Map();
    for (const it of list) { const k = `${it.target.column},${it.target.row},${it.band}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); }
    for (const [, items] of groups) {
      items.forEach((it, i) => {
        const tex = pieceTexture(it.owner, it.piece, { ghost: true, status: it.status, bad: it.bad, count: i === 0 ? items.length : 1 });
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false, toneMapped: false }));
        sp.center.set(0.5, 0);
        sp.renderOrder = 8;
        sp.userData = { aspect: tex.image.width / tex.image.height, partyId: it.partyId, emph: it.partyId === emphasis, quiet: !!emphasis && it.partyId !== emphasis };
        const c = this.ctx.geo.center(it.target.column, it.target.row), w = this.toWorld(c.x, c.y);
        const fan = (i - (items.length - 1) / 2) * 1.1 * S;
        sp.position.set(w.x + fan, bandY(it.band) + 0.25, w.z);
        sp.scale.set(0.001, 0.001, 1); // sized below, never drawn at the default world scale
        this.intents.add(sp);
      });
    }
    this._sizeStandards();
  }

  /** The bank card tile under the pointer, or null. */
  pickCard(raycaster) {
    const hit = raycaster.intersectObjects([...this.cardTiles.values()], false)[0];
    return hit ? hit.object.userData.cardId : null;
  }

  /**
   * A restrained tether from a HUD ribbon tile to its physical bank slot and generating column
   * (Design Companion "World banks remain attached…"; review UX-05). Null clears it.
   */
  tether(cardId, column) {
    if (!this.tetherBand) {
      this.tetherBand = new THREE.Mesh(new THREE.PlaneGeometry(3.6 * S, this.h * S), new THREE.MeshBasicMaterial({ color: 0xf2d98c, transparent: true, opacity: 0.16, depthWrite: false, toneMapped: false }));
      this.tetherBand.rotation.x = -Math.PI / 2;
      this.tetherBand.renderOrder = 1;
      this.tetherMark = cornerBrackets(1.45 * S, 0.5 * S, 0.1 * S, 0xf5f0e3, 1);
      this.root.add(this.tetherBand, this.tetherMark);
    }
    this.tetherBand.visible = column != null;
    if (column != null) this.tetherBand.position.set((4 * column - 2) * S, 0.022, -(this.h / 2) * S);
    const tile = cardId ? [...this.cardTiles.values()].find((t) => t.userData.cardId === cardId) : null;
    this.tetherMark.visible = !!tile;
    if (tile) { this.tetherMark.position.set(tile.position.x, 0.08, tile.position.z); this.tetherMark.scale.set(tile.scale.x, 1, (3.2 / 2.4) * tile.scale.y); }
  }

  /** Hide or show one bank tile (while its card is picked up). */
  setCardLifted(cardId, lifted) { for (const t of this.cardTiles.values()) if (t.userData.cardId === cardId) t.visible = !lifted; }

  /**
   * Drop-target feedback: a pulsing bracket frame around a formation (green when the drop is
   * legal, red when it is not), or nothing.
   */
  dropHighlight(state, party, valid) {
    if (!this.dropRing) {
      this.dropRing = new THREE.Group();
      this.dropRing.add(cornerBrackets(2.3 * S, 0.9 * S, 0.16 * S, 0xffffff, 1));
      const fill = new THREE.Mesh(new THREE.PlaneGeometry(4.2 * S, 4.2 * S), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false, toneMapped: false }));
      fill.rotation.x = -Math.PI / 2;
      this.dropRing.add(fill);
      this.dropRing.renderOrder = 4;
      this.root.add(this.dropRing);
    }
    if (!party) { this.dropRing.visible = false; return; }
    const w = this.toWorld(party.x, party.y);
    this.dropRing.position.set(w.x, 0.07 + (party.movementMode === 'air' ? 0 : bandY(party.band ?? 1)), w.z);
    const color = valid ? 0x8fd3a0 : 0xef6a5b;
    this.dropRing.traverse((o) => { if (o.material) o.material.color.setHex(color); });
    this.dropRing.visible = true;
    this.dropRing.userData.t = this.dropRing.userData.t ?? 0;
  }

  /**
   * Supply tokens beside each formation: loaded Supply and, if any, the Supply planned this Tick
   * (dashed rim, "+n"). A change pops the token. `planned` maps party id → planned units.
   */
  syncSupplyTokens(state, planned = {}) {
    this.supplyTokens ??= new Map();
    const U = this.ctx.U;
    for (const p of Object.values(state.parties)) {
      const have = p.supply.reduce((n, x) => n + x.units, 0) / U;
      const plan = (planned[p.id] ?? 0) / U;
      const key = `${have}|${plan}`;
      let tok = this.supplyTokens.get(p.id);
      const show = p.alive && !p.retired && (have > 0 || plan > 0);
      if (!show) { if (tok) tok.visible = false; continue; }
      if (!tok || tok.userData.key !== key) {
        if (tok) { this.root.remove(tok); tok.material.map.dispose(); tok.material.dispose(); }
        tok = supplyToken(have, plan);
        tok.userData.key = key;
        tok.userData.pop = 0; // pop on change
        this.supplyTokens.set(p.id, tok);
        this.root.add(tok);
      }
      const mk = this.markers.get(p.id);
      const base = mk ? mk.position : this.toWorld(p.x, p.y);
      // to the formation's right in world terms of its facing
      const F = FACINGS[p.facing] ?? FACINGS.N;
      tok.position.set(base.x + F.rx * 2.0 * S, base.y + 0.95, base.z - F.ry * 2.0 * S);
      tok.visible = true;
    }
  }

  /**
   * Planned Supply as a visible, reversible relationship: a dashed mint line from the card's bank
   * slot to the recipient formation while the plan holds it (review UX-09). Cleared during playback
   * and when the order is removed; the resolved landing has its own effect.
   */
  syncPlanLinks(state, cmds) {
    this.planLinks ??= new THREE.Group();
    if (!this.planLinks.parent) this.root.add(this.planLinks);
    for (const l of this.planLinks.children) { l.geometry.dispose(); l.material.dispose(); }
    this.planLinks.clear();
    for (const c of cmds) {
      const tile = [...this.cardTiles.values()].find((t) => t.userData.cardId === c.cardId);
      const p = state.parties[c.partyId], mk = this.markers.get(c.partyId);
      if (!tile || !p || !mk) continue;
      const a = new THREE.Vector3(tile.position.x, 0.12, tile.position.z), b = mk.position.clone().setY(this.partyY(p) + 0.12);
      const mid = a.clone().lerp(b, 0.5).setY(Math.max(a.y, b.y) + 1.2);
      const pts = new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(24);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0x8fd3a0, dashSize: 0.35, gapSize: 0.25, transparent: true, opacity: 0.85, depthTest: false, toneMapped: false }));
      line.computeLineDistances();
      line.renderOrder = 7;
      this.planLinks.add(line);
    }
  }

  /** Small card tiles lying in the world bank slots (the ribbons in the HUD show the same instances). */
  syncBanks(state, drawCard) {
    const want = new Map();
    for (const seat of ['A', 'B']) {
      for (const [col, id] of Object.entries(state.players[seat].bank.minor)) if (id) want.set(`${seat}:minor:${col}`, { id, seat, kind: 'minor', column: Number(col) });
      for (const [lc, id] of Object.entries(state.players[seat].bank.major)) if (id) want.set(`${seat}:major:${lc}`, { id, seat, kind: 'major', column: state.cards[id].column });
      for (const [row, id] of Object.entries(state.players[seat].bank.rows)) if (id) want.set(`${seat}:row:${row}`, { id, seat, kind: 'row', row: Number(row) });
    }
    for (const [key, tile] of this.cardTiles) if (!want.has(key) || want.get(key).id !== tile.userData.cardId) { this.root.remove(tile); tile.material.map?.dispose(); tile.material.dispose(); this.cardTiles.delete(key); }
    for (const [key, w] of want) {
      if (this.cardTiles.has(key)) continue;
      const card = state.cards[w.id];
      const tex = new THREE.CanvasTexture(drawCard(card, state, 240, 320));
      tex.anisotropy = 8;
      tex.colorSpace = THREE.SRGBColorSpace;
      const tile = new THREE.Mesh(new THREE.PlaneGeometry(2.4 * S, 3.2 * S), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      tile.rotation.x = -Math.PI / 2;
      let x, y;
      if (w.kind === 'row') { x = w.seat === 'A' ? -3.3 : this.w + 3.3; y = 4 * w.row - 2; tile.scale.set(0.8, 0.7, 1); }
      else if (w.kind === 'major') { x = 4 * w.column - 2; y = w.seat === 'A' ? -2.3 : this.h + 2.3; tile.scale.set(1, 0.8, 1); }
      else { x = 4 * w.column - 2; y = w.seat === 'A' ? -5.9 : this.h + 5.9; }
      if (w.seat === 'B') tile.rotation.z = Math.PI;
      tile.position.set(x * S, 0.06, -y * S);
      tile.userData = { cardId: w.id };
      this.cardTiles.set(key, tile);
      this.root.add(tile);
    }
  }
}
