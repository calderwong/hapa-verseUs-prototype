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

export const S = 1.5; // world units per member width
const PX = 16; // ground texture pixels per member width
export const COLOR_HEX = {
  red: '#c8473c', green: '#4d9a4a', purple: '#7b4fa8', yellow: '#d9b840', blue: '#3f6fc4', orange: '#d9853b',
  black: '#2a2730', white: '#e9e4d6', rainbow: '#c08fd8',
};
export const OWNER_HEX = { A: '#4d86d9', B: '#d9574d' };
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
  }

  get center() { return new THREE.Vector3((this.w / 2) * S, 0, -(this.h / 2) * S); }
  get size() { return Math.max(this.w, this.h) * S; }
  /** rules units → world */
  toWorld(x, y) { return new THREE.Vector3((x / this.ctx.U) * S, 0, -(y / this.ctx.U) * S); }
  /** world → member-width board coordinates */
  toBoard(v) { return { x: v.x / S, y: -v.z / S }; }

  _buildLights() {
    const hemi = new THREE.HemisphereLight(0xdfe6ff, 0x3a3428, 1.25);
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.1);
    sun.position.set(this.w * S * 0.2, 60, 30);
    sun.target.position.copy(this.center);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const half = this.size * 0.75;
    Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: 200 });
    sun.shadow.bias = -0.0005;
    this.root.add(hemi, sun, sun.target);
  }

  /** The ground: territories with their 3×3 slots, contact strips, Capitals, labels and bank frames. */
  _buildGround() {
    const { ctx } = this;
    const margin = { x: 6, y: 12 };
    const W = this.w + margin.x * 2, H = this.h + margin.y * 2;
    const cv = document.createElement('canvas');
    cv.width = W * PX; cv.height = H * PX;
    const g = cv.getContext('2d');
    const px = (x) => (x + margin.x) * PX; // member-width x → canvas
    const py = (y) => (H - (y + margin.y)) * PX; // member-width y (up) → canvas (down)
    g.fillStyle = '#1b1f2a'; g.fillRect(0, 0, cv.width, cv.height);
    // contact strips / earth
    g.fillStyle = '#3a3024'; g.fillRect(px(0), py(this.h), this.w * PX, this.h * PX);
    const mana = new Set([...ctx.profile.board.manaRows, ...ctx.profile.board.dualRows]);
    for (let c = 1; c <= this.cols; c++) for (let r = 1; r <= this.rows; r++) {
      const colors = territoryColors(ctx.profile, c, r);
      const x0 = 4 * c - 3.5, y0 = 4 * r - 3.5;
      const grad = g.createLinearGradient(px(x0), 0, px(x0 + 3), 0);
      colors.forEach((col, i) => { grad.addColorStop(i / Math.max(1, colors.length - 1) * 0.999, COLOR_HEX[col]); });
      g.globalAlpha = mana.has(r) ? 0.62 : 0.32;
      g.fillStyle = colors.length > 1 ? grad : COLOR_HEX[colors[0]];
      g.fillRect(px(x0), py(y0 + 3), 3 * PX, 3 * PX);
      g.globalAlpha = 1;
      // 3×3 slot grid
      g.strokeStyle = 'rgba(14,12,10,0.55)'; g.lineWidth = 1;
      for (let i = 0; i <= 3; i++) {
        g.beginPath(); g.moveTo(px(x0 + i), py(y0)); g.lineTo(px(x0 + i), py(y0 + 3)); g.stroke();
        g.beginPath(); g.moveTo(px(x0), py(y0 + i)); g.lineTo(px(x0 + 3), py(y0 + i)); g.stroke();
      }
      g.strokeStyle = 'rgba(240,230,210,0.35)'; g.lineWidth = 2;
      g.strokeRect(px(x0) + 1, py(y0 + 3) + 1, 3 * PX - 2, 3 * PX - 2);
      if (mana.has(r)) { // Mana pips: a small diamond per contributed color
        colors.forEach((col, i) => {
          g.fillStyle = COLOR_HEX[col]; g.strokeStyle = '#111';
          const cx = px(x0 + 0.35 + i * 0.4), cy = py(y0 + 0.35);
          g.beginPath(); g.moveTo(cx, cy - 4); g.lineTo(cx + 4, cy); g.lineTo(cx, cy + 4); g.lineTo(cx - 4, cy); g.closePath(); g.fill(); g.stroke();
        });
      }
    }
    // Capitals
    for (const seat of ['A', 'B']) {
      const cap = ctx.geo.toGlobal(seat, ctx.profile.board.capitalColumn, 1);
      const x0 = 4 * cap.column - 3.5, y0 = 4 * cap.row - 3.5;
      g.strokeStyle = '#f0c75e'; g.lineWidth = 4; g.setLineDash([10, 6]);
      g.strokeRect(px(x0) - 4, py(y0 + 3) - 4, 3 * PX + 8, 3 * PX + 8);
      g.setLineDash([]);
      g.fillStyle = '#f0c75e'; g.font = 'bold 14px sans-serif'; g.textAlign = 'center';
      g.fillText(`${seat} CAPITAL`, px(x0 + 1.5), seat === 'A' ? py(y0) + 16 : py(y0 + 3) - 6);
    }
    // labels: global columns and rows
    g.fillStyle = '#d8ccb0'; g.font = 'bold 18px sans-serif'; g.textAlign = 'center';
    for (let c = 1; c <= this.cols; c++) {
      const info = ctx.profile.board.columnMap[c - 1];
      g.fillText(`C${c} ${SUIT_GLYPH[info.suit]}`, px(4 * c - 2), py(-0.6) + 6);
      g.fillText(`C${c} ${SUIT_GLYPH[info.suit]}`, px(4 * c - 2), py(this.h + 0.6) + 6);
    }
    g.textAlign = 'right';
    for (let r = 1; r <= this.rows; r++) g.fillText(`R${r}`, px(-0.4), py(4 * r - 2) + 6);
    g.textAlign = 'left';
    for (let r = 1; r <= this.rows; r++) g.fillText(`R${r}`, px(this.w + 0.4), py(4 * r - 2) + 6);
    // bank frames: Major (nearer) and Minor (behind it) for each seat; row Enchantments on the left
    const frame = (x, y, w, h, color) => { g.strokeStyle = color; g.lineWidth = 2; g.strokeRect(px(x), py(y + h), w * PX, h * PX); };
    for (let c = 1; c <= this.cols; c++) {
      frame(4 * c - 3.4, -3.6, 2.8, 2.6, 'rgba(240,199,94,0.5)');
      frame(4 * c - 3.4, -7.6, 2.8, 3.4, 'rgba(160,190,240,0.55)');
      frame(4 * c - 3.4, this.h + 1, 2.8, 2.6, 'rgba(240,199,94,0.5)');
      frame(4 * c - 3.4, this.h + 4.2, 2.8, 3.4, 'rgba(240,160,150,0.55)');
    }
    for (let r = 1; r <= this.rows; r++) {
      frame(-4.6, 4 * r - 3.2, 2.6, 2.4, 'rgba(220,220,220,0.35)');
      frame(this.w + 2, 4 * r - 3.2, 2.6, 2.4, 'rgba(220,220,220,0.35)');
    }
    g.fillStyle = '#9fb3d9'; g.font = '13px sans-serif'; g.textAlign = 'left';
    g.fillText('A · MAJOR ARCANA', px(-5.5), py(-2.2)); g.fillText('A · MINOR ARCANA (HAND)', px(-5.5), py(-6));
    g.fillText('B · MAJOR ARCANA', px(-5.5), py(this.h + 2.4)); g.fillText('B · MINOR ARCANA (HAND)', px(-5.5), py(this.h + 6));
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.anisotropy = 4;
    const geo = new THREE.PlaneGeometry(W * S, H * S);
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set((this.w / 2) * S, 0, -(this.h / 2) * S);
    ground.receiveShadow = true;
    ground.name = 'ground';
    this.ground = ground;
    this.root.add(ground);
  }

  _buildOverlays() {
    // active-column highlight
    this.activeCols = new Map();
    for (let c = 1; c <= this.cols; c++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(3.6 * S, this.h * S), new THREE.MeshBasicMaterial({ color: 0xf0c75e, transparent: true, opacity: 0.0, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.set((4 * c - 2) * S, 0.02, -(this.h / 2) * S);
      m.renderOrder = 1;
      this.activeCols.set(c, m);
      this.root.add(m);
    }
    // legal destination squares (pooled)
    this.destGroup = new THREE.Group();
    this.root.add(this.destGroup);
    this.routeLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xfff2b0 }));
    this.routeLine.renderOrder = 3;
    this.root.add(this.routeLine);
    this.selectRing = new THREE.Mesh(new THREE.RingGeometry(2.05 * S, 2.25 * S, 4, 1, Math.PI / 4), new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }));
    this.selectRing.rotation.x = -Math.PI / 2;
    this.selectRing.visible = false;
    this.root.add(this.selectRing);
    this.hoverRing = new THREE.Mesh(new THREE.PlaneGeometry(3 * S, 3 * S), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false }));
    this.hoverRing.rotation.x = -Math.PI / 2;
    this.hoverRing.visible = false;
    this.root.add(this.hoverRing);
  }

  setActiveColumns(cols) { for (const [c, m] of this.activeCols) m.material.opacity = cols.includes(c) ? 0.16 : 0; }

  _sheet(role, mount, owner) {
    const key = `${role}:${mount}:${owner}`;
    if (!this.sheets.has(key)) this.sheets.set(key, createCharacterSheet(spriteSpec(role, mount, owner)));
    return this.sheets.get(key);
  }

  /** Create or update every member sprite and party marker from a state (positions optional override). */
  sync(state, positions = null) {
    const seen = new Set();
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
      }
      seen.add(m.id);
      const pos = positions?.[m.id] ?? [m.x, m.y];
      const w = this.toWorld(pos[0], pos[1]);
      spr.position.set(w.x, 0.03, w.z);
      spr.visible = m.alive || (positions?.[m.id] !== undefined && positions[m.id][2]);
      spr.userData.facing = party?.facing ?? 'N';
    }
    for (const [id, spr] of this.sprites) if (!seen.has(id)) { spr.visible = false; }
    // party markers
    for (const p of Object.values(state.parties)) {
      let mk = this.markers.get(p.id);
      if (!mk) { mk = this._partyMarker(p); this.markers.set(p.id, mk); this.root.add(mk); }
      const pos = positions?.[`party:${p.id}`] ?? [p.x, p.y];
      const w = this.toWorld(pos[0], pos[1]);
      mk.position.set(w.x, 0.04, w.z);
      mk.visible = p.alive && !p.retired;
      const rot = { N: 0, E: -Math.PI / 2, S: Math.PI, W: Math.PI / 2 }[p.facing];
      mk.rotation.y = rot;
      mk.userData.empty.visible = !p.slots['5'] || !state.members[p.slots['5']]?.alive;
    }
  }

  _ownerDisc(owner) {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.36 * S, 12), new THREE.MeshBasicMaterial({ color: OWNER_HEX[owner], transparent: true, opacity: 0.55, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.02;
    disc.renderOrder = 2;
    return disc;
  }

  _partyMarker(p) {
    const g = new THREE.Group();
    const color = new THREE.Color(OWNER_HEX[p.owner]);
    const frame = new THREE.Mesh(new THREE.RingGeometry(1.62 * S, 1.75 * S, 4, 1, Math.PI / 4), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }));
    frame.rotation.x = -Math.PI / 2;
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(-0.45 * S, 0); arrowShape.lineTo(0.45 * S, 0); arrowShape.lineTo(0, 0.5 * S); arrowShape.closePath();
    const arrow = new THREE.Mesh(new THREE.ShapeGeometry(arrowShape), new THREE.MeshBasicMaterial({ color, depthWrite: false, side: THREE.DoubleSide }));
    arrow.rotation.x = -Math.PI / 2;
    arrow.position.set(0, 0.01, -1.85 * S);
    // an empty center (Pawn) reads as a dashed square, never as a missing member
    const empty = new THREE.Mesh(new THREE.RingGeometry(0.3 * S, 0.42 * S, 4, 1, Math.PI / 4), new THREE.MeshBasicMaterial({ color: 0xe8dcc0, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
    empty.rotation.x = -Math.PI / 2;
    g.add(frame, arrow, empty);
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
      const tex = new THREE.CanvasTexture(drawCard(card, state, 120, 160));
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
