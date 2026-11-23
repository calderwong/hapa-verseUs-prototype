/**
 * A territory becomes a place as the camera approaches (human-feedback addendum 02, HF2-08 to
 * HF2-10; review 05, R5-05). One bounded, world-space environment around the inspected party's
 * territory, with a lighter dressing of its eight neighbours:
 *   - a brushed-pixel ground decal at the true surface height (the hill top on raised ground),
 *     painted from the territory's alignment, with the member grid quietened but a thin legal
 *     rim kept; squares open to the sky (a real pit) are left transparent, so excavation shows;
 *   - world-fixed crossed-quad grass (it has sides when orbited, it does not turn to the camera),
 *     stones with contact shadows, and on the territory's corner crossing an asymmetric landmark —
 *     a broken pillar with a fallen drum and a torn banner — at another depth, for real parallax;
 *   - on raised ground, a rock outcrop on the slope; around running work, rising dust.
 * Everything here is decoration: never pickable, no collision, cover, resource or visibility
 * rule; it hides when a cutaway shows a lower band, keeps still under reduced motion, and is
 * disposed on change or New match. Textures and geometry are painted here (no external media).
 */
import * as THREE from 'three';
import { brushRng } from './palette.js';
import { solidAt, surfaceBand } from '../rules/terrain.js';
import { territoryColors } from '../rules/economy.js';

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const GROUND = { red: ['#6b4a34', '#8a5d3b'], green: ['#3f5a2c', '#56733a'], purple: ['#4d3f55', '#655170'], yellow: ['#7a6a3a', '#958247'], blue: ['#3b4f5f', '#4f6777'], orange: ['#7a4f2c', '#93633a'], black: ['#33302f', '#45403d'], white: ['#8a857a', '#a39d90'], rainbow: ['#5a4f62', '#6f617a'] };

const texCache = new Map();
/** A brushed-pixel ground texture for an alignment (cached; shared across territories). */
function groundTexture(color, open) {
  const key = `${color}:${open.join('')}`;
  if (texCache.has(key)) return texCache.get(key);
  // one coherent earth for the place; the alignment is only a tint (it is not the Mana signal)
  const tint = (hex, earth, k) => { const a = new THREE.Color(hex), b = new THREE.Color(earth); return `#${b.lerp(a, k).getHexString()}`; };
  const [dark0, light0] = GROUND[color] ?? GROUND.green;
  const dark = tint(dark0, '#3e3528', 0.28), light = tint(light0, '#5a4c38', 0.28);
  const N = 72, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const g = cv.getContext('2d');
  const rng = brushRng(color.length * 131 + 7);
  g.fillStyle = dark; g.fillRect(0, 0, N, N);
  for (let i = 0; i < 900; i++) { const x = Math.floor(rng() * N), y = Math.floor(rng() * N); g.fillStyle = rng() < 0.5 ? light : rng() < 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(255,240,200,0.07)'; g.fillRect(x, y, 1 + Math.floor(rng() * 3), 1); }
  // pebbles and soil specks
  for (let i = 0; i < 26; i++) { const x = Math.floor(rng() * N), y = Math.floor(rng() * N); g.fillStyle = '#8f8676'; g.fillRect(x, y, 2, 2); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, y + 2, 2, 1); }
  // a thin legal rim: the territory boundary stays readable while the member grid recedes
  g.strokeStyle = 'rgba(245,240,227,0.35)'; g.lineWidth = 1; g.strokeRect(0.5, 0.5, N - 1, N - 1);
  // squares open to the sky stay open: never paint a floor over a real excavation
  for (let i = 0; i < 9; i++) if (open[i]) g.clearRect((i % 3) * (N / 3), Math.floor(i / 3) * (N / 3), N / 3, N / 3);
  const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

let grassTex = null;
function grassTexture() {
  if (grassTex) return grassTex;
  const cv = document.createElement('canvas'); cv.width = 16; cv.height = 16;
  const g = cv.getContext('2d');
  const blades = [[2, 15, 4, 5], [5, 15, 6, 2], [8, 15, 8, 4], [11, 15, 12, 6], [13, 15, 14, 8], [7, 15, 5, 7]];
  for (const [x0, y0, x1, y1] of blades) { g.strokeStyle = (x0 % 2) ? '#6f9a42' : '#4f7a30'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
  grassTex = new THREE.CanvasTexture(cv); grassTex.magFilter = THREE.NearestFilter; grassTex.colorSpace = THREE.SRGBColorSpace;
  return grassTex;
}

let clothTex = null;
function clothTexture() {
  if (clothTex) return clothTex;
  const cv = document.createElement('canvas'); cv.width = 16; cv.height = 24;
  const g = cv.getContext('2d');
  g.fillStyle = '#7a2e2a'; g.fillRect(0, 0, 16, 24);
  g.fillStyle = '#c9a65e'; g.fillRect(0, 0, 16, 2); g.fillRect(6, 8, 4, 4);
  g.clearRect(10, 18, 6, 6); g.clearRect(13, 15, 3, 3); // torn corner
  clothTex = new THREE.CanvasTexture(cv); clothTex.magFilter = THREE.NearestFilter; clothTex.colorSpace = THREE.SRGBColorSpace;
  return clothTex;
}

export class TerritoryDiorama {
  /**
   * @param {THREE.Object3D} root board root
   * @param {any} ctx rules context
   * @param {(x: number, y: number) => THREE.Vector3} toWorld rules → world
   * @param {{ S: number, bandY: (b: number) => number }} k
   */
  constructor(root, ctx, toWorld, { S, bandY }) {
    Object.assign(this, { root, ctx, toWorld, S, bandY });
    this.group = new THREE.Group();
    this.group.name = 'territory-diorama';
    root.add(this.group);
    this.key = null;
    this.opacity = 0;
    this.sway = [];
    this.dust = [];
    this.time = 0;
  }

  /** Remove every decoration (subject change, New match). Shared textures stay cached. */
  clear() {
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); });
    this.group.clear();
    this.sway = []; this.dust = [];
    this.key = null;
    this.mats = [];
  }

  /**
   * Build (or keep) the environment around one territory.
   * @param {any} state @param {{column:number,row:number}|null} at @param {{ runningWork?: any[] }} [o]
   */
  sync(state, at, o = {}) {
    const work = (o.runningWork ?? []).map((t) => `${t.target.x},${t.target.y},${t.target.band}`).join(';');
    const key = at ? `${at.column},${at.row}|${JSON.stringify(state.terrain.hills ?? {})}|${Object.keys(state.terrain.cells ?? {}).length}|${work}` : null;
    if (key === this.key) return;
    this.clear();
    this.key = key;
    if (!at) return;
    this.mats = [];
    const { geo } = this.ctx, cols = geo.columns, rows = geo.rows;
    for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
      const c = at.column + dc, r = at.row + dr;
      if (c < 1 || r < 1 || c > cols || r > rows) continue;
      this._territory(state, c, r, dc === 0 && dr === 0);
    }
    for (const t of o.runningWork ?? []) this._dust(t);
  }

  _mat(m) { m.transparent = true; m.opacity = this.opacity; this.mats.push(m); return m; }

  _territory(state, column, row, main) {
    const S = this.S, U = this.ctx.U;
    const c = this.ctx.geo.center(column, row), w = this.toWorld(c.x, c.y);
    const cx = Math.round(c.x / U), cy = Math.round(c.y / U);
    const band = surfaceBand(state.terrain, column, row);
    const top = this.bandY(band);
    const rng = brushRng(column * 97 + row * 13 + 5);
    const open = [];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) open.push(!solidAt(state.terrain, cx - 1 + i, cy + 1 - j, -1));
    const color = territoryColors(this.ctx.profile, column, row)[0];
    // ground decal at the true surface height (hill top on raised ground)
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(3 * S, 3 * S), this._mat(new THREE.MeshLambertMaterial({ map: groundTexture(color, open), alphaTest: 0.5, depthWrite: true })));
    decal.rotation.x = -Math.PI / 2;
    decal.position.set(w.x, top + 0.012, w.z);
    decal.renderOrder = 1;
    this.group.add(decal);
    // grass and stones along the inner edges, between the member squares (never on a slot center)
    const spots = [];
    for (let k = 0; k < (main ? 14 : 6); k++) {
      const edge = Math.floor(rng() * 4), t = (rng() - 0.5) * 2.6 * S, d = 1.36 * S;
      const [dx, dz] = edge === 0 ? [t, -d] : edge === 1 ? [t, d] : edge === 2 ? [-d, t] : [d, t];
      const ix = Math.min(2, Math.max(0, Math.floor((dx / S) + 1.5))), iy = Math.min(2, Math.max(0, Math.floor(1.5 - (-dz / S))));
      if (open[iy * 3 + ix]) continue;
      spots.push([w.x + dx, w.z + dz]);
    }
    for (const [x, z] of spots) {
      if (rng() < 0.65) this._grass(x, top, z, rng);
      else this._stone(x, top, z, rng);
    }
    if (!main) return;
    // the landmark: on the territory's north-east corner crossing (outside every member square)
    this._landmark(w.x + 2 * S, top, w.z - 2 * S, rng);
    if (band > 1) this._outcrop(w.x - 2.05 * S, top, w.z + 0.4 * S, band - 1);
  }

  _grass(x, y, z, rng) {
    const S = this.S, h = 0.32 + rng() * 0.22;
    const g = new THREE.Group();
    const mat = this._mat(new THREE.MeshLambertMaterial({ map: grassTexture(), alphaTest: 0.4, side: THREE.DoubleSide }));
    for (let i = 0; i < 2; i++) { const q = new THREE.Mesh(new THREE.PlaneGeometry(0.42 * S * 0.6, h), mat); q.position.y = h / 2; q.rotation.y = i * Math.PI / 2 + rng(); g.add(q); }
    g.position.set(x, y + 0.01, z);
    g.userData.phase = rng() * 6;
    this.sway.push(g);
    this.group.add(g);
  }

  _stone(x, y, z, rng) {
    const r = 0.1 + rng() * 0.12;
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), this._mat(new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.08, 0.08, 0.38 + rng() * 0.15), roughness: 1, flatShading: true })));
    m.position.set(x, y + r * 0.55, z); m.rotation.set(rng() * 3, rng() * 3, 0); m.scale.y = 0.65;
    this.group.add(m);
    this._shadow(x, y, z, r * 1.6);
  }

  _shadow(x, y, z, r) {
    const s = new THREE.Mesh(new THREE.CircleGeometry(r, 12), this._mat(new THREE.MeshBasicMaterial({ color: 0x000000, depthWrite: false })));
    s.material.userData.max = 0.3;
    s.rotation.x = -Math.PI / 2; s.position.set(x, y + 0.014, z);
    this.group.add(s);
  }

  /** An asymmetric ruin: tall broken pillar, a fallen drum to one side, a torn banner on a pole. */
  _landmark(x, y, z) {
    const S = this.S, g = new THREE.Group();
    const stone = this._mat(new THREE.MeshStandardMaterial({ color: 0x8c8473, roughness: 0.95, flatShading: true }));
    const dark = this._mat(new THREE.MeshStandardMaterial({ color: 0x5b5448, roughness: 1, flatShading: true }));
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.7 * S, 0.18, 0.7 * S), dark); base.position.y = 0.09;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * S, 0.24 * S, 1.9, 7), stone); shaft.position.y = 0.18 + 0.95;
    // the broken top leans one way: the pillar has a clear front, side and back
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * S, 0.2 * S, 0.4, 7), stone); cap.position.set(0.06, 2.25, -0.04); cap.rotation.z = -0.35;
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * S, 0.2 * S, 0.5, 7), stone); drum.rotation.z = Math.PI / 2; drum.position.set(-0.55, 0.2, 0.35);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.7, 5), dark); pole.position.set(0.5, 0.85, 0.45);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.62), this._mat(new THREE.MeshLambertMaterial({ map: clothTexture(), side: THREE.DoubleSide, alphaTest: 0.3 })));
    cloth.position.set(0.72, 1.36, 0.45);
    cloth.userData.phase = 1.3;
    this.sway.push(cloth);
    g.add(base, shaft, cap, drum, pole, cloth);
    g.position.set(x, y, z);
    this.group.add(g);
    this._shadow(x + 0.15, y, z + 0.1, 0.75 * S);
  }

  /** A rock face on the slope of raised ground (its real height comes from the terrain). */
  _outcrop(x, y, z, height) {
    const S = this.S;
    const rock = this._mat(new THREE.MeshStandardMaterial({ color: 0x6e6455, roughness: 1, flatShading: true }));
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28 * S - i * 0.06, 0), rock);
      m.position.set(x + i * 0.18, y - 0.35 * height * 0.9 - i * 0.12, z - i * 0.5); m.scale.set(1, 0.8, 1.2);
      this.group.add(m);
    }
  }

  /** Dust over running work (only around the inspected area; a few drifting motes). */
  _dust(t) {
    const S = this.S, U = this.ctx.U;
    const w = this.toWorld(t.target.x * U, t.target.y * U);
    for (let i = 0; i < 7; i++) {
      const sp = new THREE.Sprite(this._mat(new THREE.SpriteMaterial({ color: 0xd9c9a4, depthWrite: false })));
      sp.material.userData.max = 0.55;
      sp.scale.set(0.12, 0.12, 1);
      sp.position.set(w.x + (Math.random() - 0.5) * S * 0.7, this.bandY(t.target.band) + 0.3, w.z + (Math.random() - 0.5) * S * 0.7);
      sp.userData = { base: sp.position.clone(), phase: i * 0.7 };
      this.dust.push(sp);
      this.group.add(sp);
    }
  }

  /**
   * Per frame. `amount` 0…1 fades the environment with the inspection level; a cutaway below the
   * surface hides it (it never obscures a chosen lower band).
   */
  update(dt, amount, cutaway) {
    this.time += dt;
    const target = cutaway !== null && cutaway < 1 ? 0 : amount;
    this.opacity += (target - this.opacity) * Math.min(1, dt * 6);
    if (Math.abs(this.opacity - target) < 0.01) this.opacity = target;
    this.group.visible = this.opacity > 0.01;
    for (const m of this.mats ?? []) m.opacity = this.opacity * (m.userData.max ?? 1);
    if (reduced()) return;
    for (const g of this.sway) g.rotation.z = Math.sin(this.time * 1.6 + g.userData.phase) * 0.06;
    for (const d of this.dust) { const k = (this.time * 0.6 + d.userData.phase) % 1; d.position.y = d.userData.base.y + k * 0.9; d.material.opacity = this.opacity * 0.55 * (1 - k); }
  }
}
