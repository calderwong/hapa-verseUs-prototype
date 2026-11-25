/**
 * A territory becomes a place as the camera approaches (human-feedback addendum 02, HF2-08 to
 * HF2-10; review 05, R5-05). One bounded, world-space environment around the inspected party's
 * territory, with a lighter dressing of its eight neighbours:
 *   - a brushed-pixel ground decal at the true surface height (the hill top on raised ground),
 *     painted from the territory's alignment, with the member grid quietened but a thin legal
 *     rim kept; squares open to the sky (a real pit) are left transparent, so excavation shows;
 *   - world-fixed crossed-quad grass and flowers (they have sides when orbited, they do not turn
 *     to the camera), stones with contact shadows, and on the territory's corner crossing the
 *     benchmark landmark (review 06, R6-06): a weathered wayside shrine on a flagstone pad — stone
 *     plinth, timber posts, a shingled gable roof, a closed plank back wall, an offering stone with
 *     a bowl, a torn banner on one side and a lantern post on the other — so its front, sides and
 *     back read differently as the camera turns, at another depth for real parallax;
 *   - on raised ground, a rock outcrop on the slope; around running work, rising dust.
 * Everything here is decoration: never pickable, no collision, cover, resource or visibility
 * rule. Each territory's dressing follows the terrain view's cutaway policy by its own surface
 * height: a cutaway below a territory's surface (a +3 hill viewed at +1, any surface viewed at a
 * lower band) hides that territory's dressing, as the terrain there turns see-through (review 06,
 * R6-05). It is rebuilt whenever the open/solid content of the neighbourhood changes — not only
 * its entry count — so an excavated or refilled cube is never covered by a stale floor. It keeps
 * still under reduced motion and is disposed on change or New match. Textures and geometry are
 * painted here (no external media).
 */
import * as THREE from 'three';
import { shared } from './resources.js';
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
  texCache.set(key, shared(t));
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
  shared(grassTex);
  return grassTex;
}

/** A small pixel texture painted once (nearest filtering, like the brushed-pixel sprites). */
const painted = new Map();
function pixelTexture(name, w, h, paint) {
  if (painted.has(name)) return painted.get(name);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  paint(cv.getContext('2d'), brushRng(name.length * 977 + w * 31 + h));
  const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  painted.set(name, shared(t));
  return t;
}
/** Dressed stone: offset courses, mortar, chipped highlights and moss at the foot. */
const stoneTex = () => pixelTexture('stone', 32, 32, (g, rng) => {
  g.fillStyle = '#6f675a'; g.fillRect(0, 0, 32, 32);
  for (let row = 0; row < 4; row++) for (let col = -1; col < 3; col++) {
    const x = col * 14 + (row % 2) * 7, y = row * 8, shade = 0.8 + rng() * 0.4;
    g.fillStyle = `rgb(${Math.round(140 * shade)},${Math.round(131 * shade)},${Math.round(114 * shade)})`; g.fillRect(x + 1, y + 1, 12, 6);
    g.fillStyle = 'rgba(255,245,220,0.18)'; g.fillRect(x + 1, y + 1, 12, 1);
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x + 1, y + 6, 12, 1);
  }
  for (let i = 0; i < 14; i++) { g.fillStyle = rng() < 0.5 ? '#4f6b34' : '#5f7d3c'; g.fillRect(Math.floor(rng() * 32), 26 + Math.floor(rng() * 6), 2, 1); }
});
/** Weathered timber: vertical planks with grain and dark seams. */
const woodTex = () => pixelTexture('wood', 16, 32, (g, rng) => {
  for (let x = 0; x < 16; x += 4) {
    g.fillStyle = rng() < 0.5 ? '#6b4a2f' : '#5d3f27'; g.fillRect(x, 0, 4, 32);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, 0, 1, 32);
    for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(255,220,170,0.12)'; g.fillRect(x + 1 + Math.floor(rng() * 3), Math.floor(rng() * 32), 1, 3); }
  }
});
/** Shingles: staggered rows, a darker lower edge on each. */
const roofTex = () => pixelTexture('roof', 32, 16, (g, rng) => {
  g.fillStyle = '#5a2d24'; g.fillRect(0, 0, 32, 16);
  for (let row = 0; row < 4; row++) for (let col = 0; col < 5; col++) {
    const x = col * 7 + (row % 2) * 3, y = row * 4;
    g.fillStyle = rng() < 0.5 ? '#7d3e2f' : '#8a4733'; g.fillRect(x, y, 6, 3);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x, y + 3, 6, 1);
  }
});
/** Worn flagstones with grass in the joints (the courtyard pad under the shrine). */
const flagTex = () => pixelTexture('flags', 32, 32, (g, rng) => {
  g.fillStyle = '#4c5a34'; g.fillRect(0, 0, 32, 32);
  const stones = [[1, 1, 13, 9], [15, 1, 16, 7], [1, 11, 9, 10], [11, 9, 11, 12], [23, 9, 8, 11], [1, 22, 15, 9], [17, 22, 14, 9]];
  for (const [x, y, w, h] of stones) {
    const k = 0.85 + rng() * 0.3;
    g.fillStyle = `rgb(${Math.round(138 * k)},${Math.round(129 * k)},${Math.round(112 * k)})`; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,240,210,0.14)'; g.fillRect(x, y, w, 1);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y + h - 1, w, 1);
    if (rng() < 0.6) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 2 + Math.floor(rng() * (w - 4)), y + 2 + Math.floor(rng() * (h - 4)), 2, 1); }
  }
});
/** A few wild flowers on stems (crossed quads, like the grass). */
const flowerTex = () => pixelTexture('flowers', 16, 16, (g) => {
  for (const [x, top, c] of [[3, 6, '#e8d36a'], [7, 3, '#f2efe4'], [11, 7, '#c98ab8'], [13, 4, '#e8d36a']]) {
    g.fillStyle = '#4f7a30'; g.fillRect(x, top + 2, 1, 16 - top - 2);
    g.fillStyle = c; g.fillRect(x - 1, top, 3, 2); g.fillRect(x, top - 1, 1, 1);
  }
});

let clothTex = null;
function clothTexture() {
  if (clothTex) return clothTex;
  const cv = document.createElement('canvas'); cv.width = 16; cv.height = 24;
  const g = cv.getContext('2d');
  g.fillStyle = '#7a2e2a'; g.fillRect(0, 0, 16, 24);
  g.fillStyle = '#c9a65e'; g.fillRect(0, 0, 16, 2); g.fillRect(6, 8, 4, 4);
  g.clearRect(10, 18, 6, 6); g.clearRect(13, 15, 3, 3); // torn corner
  clothTex = new THREE.CanvasTexture(cv); clothTex.magFilter = THREE.NearestFilter; clothTex.colorSpace = THREE.SRGBColorSpace;
  shared(clothTex);
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
    this.queue = []; this.queueState = null;
    this.matCache = new Map();
  }

  /**
   * Build (or keep) the environment around one territory.
   * @param {any} state @param {{column:number,row:number}|null} at @param {{ runningWork?: any[] }} [o]
   */
  sync(state, at, o = {}) {
    const work = (o.runningWork ?? []).map((t) => `${t.target.x},${t.target.y},${t.target.band}`).join(';');
    const key = at ? `${at.column},${at.row}|${this.terrainSignature(state, at)}|${work}` : null;
    if (key === this.key) return;
    this.clear();
    this.key = key;
    if (!at) return;
    this.mats = [];
    const { geo } = this.ctx, cols = geo.columns, rows = geo.rows;
    // the inspected territory now; its neighbours one per frame (no single-frame build hitch)
    this._territory(state, at.column, at.row, true);
    this.queue = [];
    for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
      const c = at.column + dc, r = at.row + dr;
      if ((dc || dr) && c >= 1 && r >= 1 && c <= cols && r <= rows) this.queue.push([c, r]);
    }
    this.queueState = state;
    for (const t of o.runningWork ?? []) this._dust(t);
  }

  /**
   * What the dressing depends on in the 3×3 neighbourhood: each territory's surface band and the
   * open/solid state of its nine surface squares (R6-05). Bounded: 81 lookups, no full scan.
   */
  terrainSignature(state, at) {
    const { geo, U } = this.ctx, out = [];
    for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
      const column = at.column + dc, row = at.row + dr;
      if (column < 1 || row < 1 || column > geo.columns || row > geo.rows) continue;
      const c = geo.center(column, row), cx = Math.round(c.x / U), cy = Math.round(c.y / U);
      let mask = '';
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) mask += solidAt(state.terrain, cx - 1 + i, cy + 1 - j, -1) ? '1' : '0';
      out.push(`${surfaceBand(state.terrain, column, row)}:${mask}`);
    }
    return out.join(',');
  }

  /**
   * A dressing material, shared by every object with the same look, opacity cap and surface height
   * (one renderer setup per look instead of per tuft or stone: the first build of a territory had
   * cost a dropped frame). Unshared only where an object animates its own opacity (dust).
   */
  _mat(m, max = 1, share = true) {
    m.userData.max = max; m.userData.surface = this._surface ?? 1;
    const key = share ? [m.type, m.map?.uuid, m.color?.getHex(), m.emissive?.getHex?.(), m.side, m.alphaTest, m.flatShading, m.depthWrite, max, m.userData.surface].join('|') : null;
    if (key && this.matCache?.has(key)) { m.dispose(); return this.matCache.get(key); }
    m.transparent = true; m.opacity = this.opacity;
    this.mats.push(m);
    if (key) (this.matCache ??= new Map()).set(key, m);
    return m;
  }

  _territory(state, column, row, main) {
    const S = this.S, U = this.ctx.U;
    const c = this.ctx.geo.center(column, row), w = this.toWorld(c.x, c.y);
    const cx = Math.round(c.x / U), cy = Math.round(c.y / U);
    const band = surfaceBand(state.terrain, column, row);
    this._surface = band;
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
      const r = rng();
      if (r < 0.55) this._grass(x, top, z, rng);
      else if (r < 0.7 && main) this._grass(x, top, z, rng, flowerTex());
      else this._stone(x, top, z, rng);
    }
    if (!main) return;
    // the landmark: on the territory's north-east corner crossing (outside every member square)
    this._landmark(w.x + 2 * S, top, w.z - 2 * S, rng);
    if (band > 1) this._outcrop(w.x - 2.05 * S, top, w.z + 0.4 * S, band - 1);
  }

  _grass(x, y, z, rng, map = grassTexture()) {
    const S = this.S, h = 0.32 + rng() * 0.22;
    const g = new THREE.Group();
    const mat = this._mat(new THREE.MeshLambertMaterial({ map, alphaTest: 0.4, side: THREE.DoubleSide }));
    for (let i = 0; i < 2; i++) { const q = new THREE.Mesh(new THREE.PlaneGeometry(0.42 * S * 0.6, h), mat); q.position.y = h / 2; q.rotation.y = i * Math.PI / 2 + rng(); g.add(q); }
    g.position.set(x, y + 0.01, z);
    g.userData.phase = rng() * 6;
    this.sway.push(g);
    this.group.add(g);
  }

  _stone(x, y, z, rng) {
    const r = 0.1 + rng() * 0.12;
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), this._mat(new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.08, 0.08, 0.38 + Math.floor(rng() * 3) * 0.07), roughness: 1, flatShading: true })));
    m.position.set(x, y + r * 0.55, z); m.rotation.set(rng() * 3, rng() * 3, 0); m.scale.y = 0.65;
    this.group.add(m);
    this._shadow(x, y, z, r * 1.6);
  }

  _shadow(x, y, z, r) {
    const s = new THREE.Mesh(new THREE.CircleGeometry(r, 12), this._mat(new THREE.MeshBasicMaterial({ color: 0x000000, depthWrite: false }), 0.3));
    s.rotation.x = -Math.PI / 2; s.position.set(x, y + 0.014, z);
    this.group.add(s);
  }

  /**
   * The benchmark landmark (R6-06): a weathered wayside shrine on a flagstone pad, fitted to the
   * one-member-wide corner crossing so it never stands on a member square. Front: open between
   * two posts, an offering stone and bowl; back: a closed plank wall; one side carries a torn
   * banner, the other a lantern post — distinct from every bearing. Painted pixel materials only.
   */
  _landmark(x, y, z) {
    const S = this.S, g = new THREE.Group();
    const lam = (map, extra = {}) => this._mat(new THREE.MeshLambertMaterial({ map, ...extra }));
    const stone = lam(stoneTex()), wood = lam(woodTex()), roof = lam(roofTex(), { side: THREE.DoubleSide });
    const dark = this._mat(new THREE.MeshLambertMaterial({ color: 0x3b2a1d }));
    const half = 0.44 * S; // inside the crossing strip
    // flagstone pad and a two-step plinth
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(0.98 * S, 0.98 * S), lam(flagTex(), { depthWrite: true }));
    pad.rotation.x = -Math.PI / 2; pad.position.y = 0.018; pad.renderOrder = 1;
    const step = new THREE.Mesh(new THREE.BoxGeometry(2 * half, 0.1, 2 * half), stone); step.position.y = 0.05;
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.6 * half, 0.12, 1.6 * half), stone); plinth.position.y = 0.16;
    g.add(pad, step, plinth);
    // four timber posts (the front pair stands open, the back pair carries the wall)
    const postH = 1.15, px = 0.62 * half, pz = 0.62 * half;
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, postH, 0.08), wood);
      post.position.set(sx * px, 0.22 + postH / 2, sz * pz);
      g.add(post);
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(2 * px, postH * 0.85, 0.05), wood);
    back.position.set(0, 0.22 + postH * 0.45, -pz); g.add(back);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(2 * px + 0.12, 0.08, 0.08), dark);
    lintel.position.set(0, 0.22 + postH, pz); g.add(lintel);
    // a shingled gable roof, ridge front-to-back, eaves overhanging the posts a little
    const roofY = 0.22 + postH, slope = 0.5, w = px + 0.2, len = 2 * pz + 0.3;
    for (const sx of [-1, 1]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(w, w * slope), 0.05, len), roof);
      r.position.set(sx * w / 2, roofY + (w * slope) / 2, 0);
      r.rotation.z = -sx * Math.atan(slope);
      g.add(r);
    }
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, len + 0.04), dark);
    ridge.position.set(0, roofY + w * slope + 0.02, 0); g.add(ridge);
    // inside, at the front: an offering stone with a bowl
    const altar = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.22), stone); altar.position.set(0, 0.22 + 0.13, 0.02);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.05, 0.05, 8), this._mat(new THREE.MeshLambertMaterial({ color: 0xb08d4a })));
    bowl.position.set(0, 0.22 + 0.285, 0.02);
    g.add(altar, bowl);
    // one side: a torn banner on its pole; the other: a lantern post
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.55, 5), dark); pole.position.set(half + 0.04, 0.78, 0.18);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.52), this._mat(new THREE.MeshLambertMaterial({ map: clothTexture(), side: THREE.DoubleSide, alphaTest: 0.3 })));
    cloth.position.set(half + 0.04, 1.22, 0.36); cloth.rotation.y = Math.PI / 2;
    cloth.userData.phase = 1.3; this.sway.push(cloth);
    const lpost = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.62, 0.05), wood); lpost.position.set(-half - 0.02, 0.31, 0.22);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.15, 0.13), this._mat(new THREE.MeshLambertMaterial({ color: 0xf2c879, emissive: 0x6b4a12 })));
    lamp.position.set(-half - 0.02, 0.69, 0.22);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.08, 4), dark); cap.position.set(-half - 0.02, 0.8, 0.22); cap.rotation.y = Math.PI / 4;
    g.add(pole, cloth, lpost, lamp, cap);
    g.position.set(x, y, z);
    this.group.add(g);
    this._shadow(x + 0.06, y, z + 0.08, 0.62 * S);
  }

  /** A rock face on the slope of raised ground (its real height comes from the terrain). */
  _outcrop(x, y, z, height) {
    const S = this.S;
    const rock = this._mat(new THREE.MeshLambertMaterial({ map: stoneTex(), color: 0xb8ad98, flatShading: true })); // the shrine's pixel stone, one material family
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28 * S - i * 0.06, 0), rock);
      m.position.set(x + i * 0.18, y - 0.35 * height * 0.9 - i * 0.12, z - i * 0.5); m.scale.set(1, 0.8, 1.2);
      this.group.add(m);
    }
  }

  /** Dust over running work (only around the inspected area; a few drifting motes). */
  _dust(t) {
    const S = this.S, U = this.ctx.U;
    this._surface = t.target.band;
    const w = this.toWorld(t.target.x * U, t.target.y * U);
    for (let i = 0; i < 7; i++) {
      const sp = new THREE.Sprite(this._mat(new THREE.SpriteMaterial({ color: 0xd9c9a4, depthWrite: false }), 0.55, false));
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
    if (this.queue?.length && this.key) { const [c, r] = this.queue.shift(); this._territory(this.queueState, c, r, false); }
    const target = amount;
    this.opacity += (target - this.opacity) * Math.min(1, dt * 6);
    if (Math.abs(this.opacity - target) < 0.01) this.opacity = target;
    this.cutaway = cutaway;
    // a cutaway below a territory's surface hides that territory's dressing (its ground is cut away)
    const shown = (m) => cutaway === null || cutaway >= (m.userData.surface ?? 1);
    let any = false;
    for (const m of this.mats ?? []) { const v = shown(m); m.opacity = v ? this.opacity * (m.userData.max ?? 1) : 0; m.visible = v; any ||= v; }
    this.group.visible = this.opacity > 0.01 && any;
    if (reduced()) return;
    for (const g of this.sway) g.rotation.z = Math.sin(this.time * 1.6 + g.userData.phase) * 0.06;
    for (const d of this.dust) { const k = (this.time * 0.6 + d.userData.phase) % 1; d.position.y = d.userData.base.y + k * 0.9; d.material.opacity = this.opacity * 0.55 * (1 - k); }
  }
}
