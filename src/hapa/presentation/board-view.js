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
import { TerrainView, bandY, textLabel, standingOf } from './terrain-view.js';
import { paintGround, PX } from './ground-painter.js';

export const S = 1.5; // world units per member width
export const COLOR_HEX = {
  red: '#c8473c', green: '#4d9a4a', purple: '#7b4fa8', yellow: '#d9b840', blue: '#3f6fc4', orange: '#d9853b',
  black: '#2a2730', white: '#e9e4d6', rainbow: '#c08fd8',
};
export const OWNER_HEX = { A: '#7FB2E8', B: '#E8857A' }; // with single (A) / double (B) brackets
const SUIT_GLYPH = { wands: '♣', pentacles: '✪', cups: '♥', swords: '♠', wildcard: '✱' };

/** Sprite specs per role (procedural Luminati pixel characters; the owner color is the tabard). */
function spriteSpec(role, mount, owner) {
  const top = owner === 'A' ? '#3d6db4' : '#b44a3d';
  const trim = owner === 'A' ? '#cfe0ff' : '#ffd9cf';
  const base = { outfit: { top, bottom: '#4a4a5e', accent: 'metal', style: 'tunic', shirt: 'cream' }, cape: false, beard: false };
  switch (role) {
    case 'swordsman': return { ...base, preset: 'swordsman', weapon: 'sword', gear: { shield: owner === 'A' ? '#2c4f86' : '#862c2c', boots: 'black' } };
    case 'pikeman': return { ...base, preset: 'guard', weapon: 'spear', hat: 'helmet' };
    case 'archer': return { ...base, preset: 'hunter', weapon: 'bow', hat: 'hood', hatColor: top };
    case 'mage': return { ...base, preset: 'scholar', weapon: 'staff', hat: 'wide', hatColor: '#d9853b', outfit: { ...base.outfit, style: 'robe' } };
    case 'priest': return { ...base, preset: 'cleric', weapon: 'holystaff', hat: 'circlet', outfit: { ...base.outfit, style: 'robe', top: '#7b4fa8' } };
    default: {
      const hats = { castle: 'helmet', knight: 'helmet', bishop: 'circlet', queen: 'circlet', king: 'crown', commander: 'crown' };
      const weapon = mount === 'bishop' ? 'holystaff' : mount === 'queen' ? 'staff' : 'sword';
      return { ...base, preset: 'guard', hat: hats[mount] ?? 'helmet', weapon, cape: { color: trim, style: mount === 'commander' ? 'cloak' : 'short', lining: top } };
    }
  }
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
    this.selectRing = cornerBrackets(2.15 * S, 0.7 * S, 0.12 * S, 0xf5f0e3, 1);
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
      }
      spr.userData.awayCorner.visible = m.alive && m.helperAway?.kind === 'corner';
      spr.userData.awayBreach.visible = m.alive && m.helperAway?.kind === 'breach';
      seen.add(m.id);
      const pos = positions?.[m.id] ?? [m.x, m.y];
      const w = this.toWorld(pos[0], pos[1]);
      const band = m.band ?? 1;
      spr.position.set(w.x, bandY(band) + 0.03, w.z);
      spr.visible = (m.alive || (positions?.[m.id] !== undefined && positions[m.id][2])) && (layer === null || band === layer);
      // a flyer keeps a line to the floor below it, so height is never the only cue
      const flying = party?.movementMode === 'air';
      if (flying && !spr.userData.flyLine) {
        const line = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 6), new THREE.MeshBasicMaterial({ color: 0x9fd8ff }));
        spr.add(line);
        spr.userData.flyLine = line;
      }
      if (spr.userData.flyLine) {
        const hgt = bandY(band);
        spr.userData.flyLine.visible = flying;
        spr.userData.flyLine.scale.y = Math.max(0.01, hgt);
        spr.userData.flyLine.position.y = -hgt / 2;
      }
      spr.userData.facing = party?.facing ?? 'N';
    }
    for (const [id, spr] of this.sprites) if (!seen.has(id)) { spr.visible = false; }
    // party markers
    for (const p of Object.values(state.parties)) {
      let mk = this.markers.get(p.id);
      if (!mk) { mk = this._partyMarker(p); this.markers.set(p.id, mk); this.root.add(mk); }
      const pos = positions?.[`party:${p.id}`] ?? [p.x, p.y];
      const w = this.toWorld(pos[0], pos[1]);
      mk.position.set(w.x, (p.movementMode === 'air' ? 0 : bandY(p.band ?? 1)) + 0.04, w.z);
      mk.visible = p.alive && !p.retired;
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
    // A: a solid disc; B: a ring — ownership by shape as well as hue
    const geo = owner === 'A' ? new THREE.CircleGeometry(0.34 * S, 16) : new THREE.RingGeometry(0.2 * S, 0.36 * S, 16);
    const disc = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: OWNER_HEX[owner], transparent: true, opacity: 0.75, depthWrite: false }));
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
    const color = new THREE.Color(OWNER_HEX[p.owner]);
    // ownership: single brackets for A, double brackets for B (shape, not only hue)
    g.add(cornerBrackets(1.72 * S, 0.55 * S, 0.09 * S, color, 0.95));
    if (p.owner === 'B') g.add(cornerBrackets(1.9 * S, 0.45 * S, 0.07 * S, color, 0.85));
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
    g.userData = { partyId: p.id, empty };
    g.renderOrder = 2;
    return g;
  }

  /** Billboard + facing each frame. */
  update(dt, camera) {
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
    const w = this.toWorld(party.x, party.y);
    this.selectRing.position.set(w.x, 0.05, w.z);
    this.selectRing.visible = true;
    for (const d of dests) {
      const c = this.ctx.geo.center(d.column, d.row);
      const occupant = Object.values(state.parties).find((q) => q.alive && !q.retired && q.region.column === d.column && q.region.row === d.row);
      const color = occupant ? (occupant.owner === party.owner ? (occupant.mount ? 0x888888 : 0x9fe07a) : 0xff6b5b) : 0x7ad1ff;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.9 * S, 2.9 * S), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      const p = this.toWorld(c.x, c.y);
      m.position.set(p.x, 0.03, p.z);
      m.renderOrder = 2;
      this.destGroup.add(m);
    }
    this.showRoute(party, party.route.map((n) => [n.x, n.y]));
  }

  showRoute(party, nodes) {
    if (!nodes.length) { this.routeLine.visible = false; return; }
    const pts = [[party.x, party.y], ...nodes].map(([x, y]) => { const v = this.toWorld(x, y); v.y = 0.12; return v; });
    this.routeLine.geometry.dispose();
    this.routeLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    this.routeLine.visible = true;
  }

  hover(territory) {
    if (!territory) { this.hoverRing.visible = false; return; }
    const c = this.ctx.geo.center(territory.column, territory.row);
    const w = this.toWorld(c.x, c.y);
    this.hoverRing.position.set(w.x, 0.035, w.z);
    this.hoverRing.visible = true;
  }

  /** Pick: world point on the ground → territory and nearest member/party. */
  pick(raycaster, state) {
    const hit = raycaster.intersectObject(this.ground)[0];
    if (!hit) return null;
    const b = this.toBoard(hit.point);
    const U = this.ctx.U;
    const column = Math.floor(b.x / 4) + 1, row = Math.floor(b.y / 4) + 1;
    let member = null, best = 0.75;
    for (const m of Object.values(state.members)) {
      if (!m.alive) continue;
      const d = Math.max(Math.abs(m.x / U - b.x), Math.abs(m.y / U - b.y));
      if (d < best) { best = d; member = m; }
    }
    let party = member ? state.parties[member.party] : null;
    if (!party) party = Object.values(state.parties).find((p) => p.alive && !p.retired && Math.abs(p.x / U - b.x) < 1.6 && Math.abs(p.y / U - b.y) < 1.6) ?? null;
    const onBoard = this.ctx.geo.onBoard(column, row);
    return { territory: onBoard ? { column, row } : null, member, party, point: b };
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
