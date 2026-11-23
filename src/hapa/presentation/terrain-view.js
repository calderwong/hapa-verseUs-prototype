/**
 * Terrain presentation (Design Companion v1 ch.3 and ch.15; Master Requirements v3 ch.12 "Terrain
 * height can obscure the information that matters"). Draws the rules volume — hills and their
 * ramps, open pits, roofed tunnels, flyers — and a cutaway that steps through the six bands.
 * Every distinction carries a text label and a shape, never height or color alone. It reads the
 * authoritative state and never changes it.
 */
import * as THREE from 'three';
import { BANDS, solidAt, exposed, surfaceBand, cellKey } from '../rules/terrain.js';

export const BAND_H = 0.9; // world units per band

/** World height of a band's floor: band +1 stands on the surface (0), −1 one band below it. */
export const bandY = (band) => (band >= 1 ? (band - 1) * BAND_H : band * BAND_H);

/**
 * Earth strata as a small pixel texture (review UX-11): turf or ground at the top, then bands of
 * soil, clay and stone with deterministic speckles, so a cut face reads as depth, not a flat box.
 * `rows` bands per world band; repeat it vertically for deeper faces.
 */
const strataCache = new Map();
function strataTexture(kind = 'earth') {
  if (strataCache.has(kind)) return strataCache.get(kind);
  const cv = document.createElement('canvas'); cv.width = 32; cv.height = 32;
  const g = cv.getContext('2d');
  const bands = kind === 'turf' ? ['#7d8f4e', '#6f7f45', '#8a6b48', '#7a5c3d'] : ['#8a6b48', '#7a5c3d', '#6b5a48', '#5d4a38', '#6e6052', '#56473a'];
  for (let y = 0; y < 32; y++) { g.fillStyle = bands[Math.floor((y / 32) * bands.length)]; g.fillRect(0, y, 32, 1); }
  let h = 2166136261;
  for (let i = 0; i < 90; i++) { h = Math.imul(h ^ i, 16777619) >>> 0; const x = h % 32, y = (h >>> 8) % 32; g.fillStyle = (h >>> 16) % 3 ? 'rgba(23,33,45,0.28)' : 'rgba(245,240,227,0.18)'; g.fillRect(x, y, 1 + ((h >>> 20) % 2), 1); }
  g.fillStyle = 'rgba(23,33,45,0.35)'; for (const y of [10, 21]) g.fillRect(0, y, 32, 1); // strata seams
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  strataCache.set(kind, t);
  return t;
}
const strataMat = (kind, w, h, side = THREE.FrontSide) => { const t = strataTexture(kind).clone(); t.needsUpdate = true; t.repeat.set(Math.max(1, Math.round(w)), Math.max(1, h)); return new THREE.MeshLambertMaterial({ map: t, side, transparent: true, opacity: 1 }); };

/** A camera-facing text label (canvas sprite). */
export function textLabel(text, { color = '#f3ead2', bg = 'rgba(20,18,24,0.82)', size = 0.55 } = {}) {
  const cv = document.createElement('canvas');
  const g = cv.getContext('2d');
  g.font = 'bold 30px sans-serif';
  const w = Math.ceil(g.measureText(text).width) + 20;
  cv.width = w; cv.height = 44;
  g.font = 'bold 30px sans-serif';
  g.fillStyle = bg; g.fillRect(0, 0, w, 44);
  g.strokeStyle = color; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, 42);
  g.fillStyle = color; g.textBaseline = 'middle'; g.fillText(text, 10, 23);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  spr.scale.set(size * (w / 44), size, 1);
  spr.renderOrder = 10;
  return spr;
}

/** How a party stands, in words: the decisive terrain facts the player must not infer from height. */
export function standingOf(state, ctx, party) {
  const open = exposed(state, ctx, party);
  if (party.movementMode === 'air') return { kind: 'flying', label: `✈ FLYING ${fmtBand(party.band)}`, exposed: open, note: 'airborne: no ground anchor, cannot cross solid earth' };
  if (party.band < 0) return open
    ? { kind: 'pit', label: `▽ OPEN PIT ${fmtBand(party.band)}`, exposed: true, note: 'below ground, open to the sky: exposed ground' }
    : { kind: 'tunnel', label: `▭ TUNNEL ${fmtBand(party.band)}`, exposed: false, note: 'below ground under a roof: not exposed' };
  const hill = surfaceBand(state.terrain, party.region.column, party.region.row);
  if (party.band > 1 && hill === party.band) return { kind: 'hilltop', label: `▲ HILLTOP ${fmtBand(party.band)}`, exposed: open, note: 'raised ground: Archers gain range and power shooting down' };
  return { kind: 'ground', label: null, exposed: open, note: 'surface ground' };
}
export const fmtBand = (b) => (b > 0 ? `+${b}` : `${b}`);

export class TerrainView {
  /** @param {THREE.Object3D} root @param {any} ctx @param {(x:number,y:number)=>THREE.Vector3} toWorld @param {number} S */
  constructor(root, ctx, toWorld, S) {
    this.ctx = ctx; this.toWorld = toWorld; this.S = S;
    this.group = new THREE.Group();
    this.group.name = 'terrain';
    root.add(this.group);
    this.sig = '';
    this.cutaway = null; // null = all layers, else a band
    this.hillMeshes = [];
  }

  /** Rebuild the volume meshes when the rules terrain changed. */
  sync(state) {
    const t = state.terrain;
    const sig = JSON.stringify([t.kind, t.hills ?? {}, t.ramps ?? {}, Object.keys(t.cells).length, Object.entries(t.cells).filter(([, c]) => !c.solid).map(([k]) => k).sort()]);
    if (sig === this.sig) return;
    this.sig = sig;
    this.group.clear();
    this.hillMeshes = [];
    const { S, ctx } = this;
    const U = ctx.U;
    // hills: a stone block under the territory body, labeled with its standing band
    for (const [key, height] of Object.entries(t.hills ?? {})) {
      if (!height) continue;
      const [column, row] = key.split(',').map(Number);
      const c = ctx.geo.center(column, row);
      const w = this.toWorld(c.x, c.y);
      const geo = new THREE.BoxGeometry(3 * S, height * BAND_H, 3 * S);
      // cut faces show strata; the top is turf-capped ground; the underside is dark earth
      const side = strataMat('turf', 3, height), top = new THREE.MeshLambertMaterial({ color: 0x9c8a62, transparent: true, opacity: 1 }), under = new THREE.MeshLambertMaterial({ color: 0x3e3226, transparent: true, opacity: 1 });
      const mat = [side, side, top, under, side, side];
      const box = new THREE.Mesh(geo, mat);
      box.position.set(w.x, (height * BAND_H) / 2, w.z);
      box.castShadow = true; box.receiveShadow = true;
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xe8dcc0 }));
      box.add(edges);
      this.group.add(box);
      this.hillMeshes.push(box);
      const lab = textLabel(`▲ HILL ${fmtBand(1 + height)}`, { color: '#f0d49a' });
      lab.position.set(w.x, height * BAND_H + 0.25, w.z + 1.7 * S);
      this.group.add(lab);
    }
    // ramps: a sloped plank across the contact strip between linked territories
    for (const key of Object.keys(t.ramps ?? {})) {
      const [a, b] = key.split('>').map((s) => s.split(',').map(Number));
      const ha = surfaceBand(t, a[0], a[1]) - 1, hb = surfaceBand(t, b[0], b[1]) - 1;
      const ca = ctx.geo.center(a[0], a[1]), cb = ctx.geo.center(b[0], b[1]);
      const mid = this.toWorld((ca.x + cb.x) / 2, (ca.y + cb.y) / 2);
      const len = Math.hypot((cb.x - ca.x) / U, (cb.y - ca.y) / U) * S * 0.45;
      const rise = (hb - ha) * BAND_H;
      const plank = new THREE.Mesh(new THREE.BoxGeometry(1.4 * S, 0.08, Math.hypot(len, rise)), new THREE.MeshLambertMaterial({ color: 0xc9a86a }));
      plank.position.set(mid.x, (ha + hb) * BAND_H / 2, mid.z);
      plank.lookAt(this.toWorld(cb.x, cb.y).setY(hb * BAND_H));
      plank.rotateX(0); // lookAt aligns the long axis with the climb
      this.group.add(plank);
      const lab = textLabel('RAMP', { color: '#c9a86a', size: 0.4 });
      lab.position.set(mid.x, Math.max(ha, hb) * BAND_H + 0.3, mid.z);
      this.group.add(lab);
    }
    // excavations: each dug column of cubes is an open pit (sky above) or a roofed tunnel
    const dug = new Map();
    for (const [k, cell] of Object.entries(t.cells)) {
      if (cell.solid) continue;
      const [x, y, band] = k.split(',').map(Number);
      if (band > 0) continue;
      const key = `${x},${y}`;
      dug.set(key, Math.min(dug.get(key) ?? 0, band));
    }
    const openCells = [];
    for (const [key, low] of dug) {
      const [x, y] = key.split(',').map(Number);
      let open = true;
      for (const b of BANDS) if (b > low && solidAt(t, x, y, b)) { open = false; break; }
      const w = this.toWorld(x * U, y * U);
      if (open) {
        // a pit: the surface is cut away and earthen walls drop to its floor
        openCells.push({ x, y });
        const depth = -low * BAND_H;
        const shaft = new THREE.Mesh(new THREE.BoxGeometry(S, depth, S), strataMat('earth', 1, -low, THREE.BackSide));
        shaft.position.set(w.x, -depth / 2, w.z);
        this.group.add(shaft);
        // a floor at the bottom of the cut (the next band down stays solid)
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(S, S), new THREE.MeshLambertMaterial({ color: 0x3e3226 }));
        floor.rotation.x = -Math.PI / 2; floor.position.set(w.x, -depth + 0.005, w.z);
        this.group.add(floor);
      } else {
        // a tunnel: the roof stays; a dashed outline marks what runs beneath
        const sq = new THREE.Mesh(new THREE.PlaneGeometry(S, S), new THREE.MeshBasicMaterial({ color: 0x2c2433, transparent: true, opacity: 0.55, depthWrite: false }));
        sq.rotation.x = -Math.PI / 2;
        sq.position.set(w.x, 0.015, w.z);
        sq.renderOrder = 1;
        this.group.add(sq);
      }
      const border = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(S, S)), new THREE.LineDashedMaterial({ color: open ? 0xff9b6b : 0xb59ae0, dashSize: 0.15, gapSize: 0.1 }));
      border.computeLineDistances();
      border.rotation.x = -Math.PI / 2;
      border.position.set(w.x, 0.02, w.z);
      this.group.add(border);
    }
    this.onOpenCells?.(openCells);
  }

  /**
   * Work in three visible stages (review UX-11): a planned dig/fill/extract is a dashed mint cube
   * with its words; a running task is a solid amber cube with its completion Tick; a completed dig
   * is the void the terrain already draws. Presentation of the public plan and the task records only.
   */
  syncWork(state, planned = []) {
    this.work ??= new THREE.Group();
    if (!this.work.parent) this.group.parent?.add(this.work);
    for (const o of [...this.work.children]) { o.traverse((x) => { x.geometry?.dispose?.(); x.material?.map?.dispose?.(); x.material?.dispose?.(); }); }
    this.work.clear();
    const U = this.ctx.U, S = this.S;
    const cube = (t, color, dashed, text) => {
      const w = this.toWorld(t.x * U, t.y * U);
      const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(S * 0.96, BAND_H * 0.96, S * 0.96));
      const line = new THREE.LineSegments(geo, dashed ? new THREE.LineDashedMaterial({ color, dashSize: 0.18, gapSize: 0.12, depthTest: false, transparent: true }) : new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true }));
      if (dashed) line.computeLineDistances();
      line.position.set(w.x, bandY(t.band) + BAND_H / 2, w.z);
      line.renderOrder = 9;
      const lab = textLabel(text, { color: dashed ? '#8FD3A0' : '#F2C14E', size: 0.38 });
      lab.position.set(0, BAND_H * 0.9, 0);
      line.add(lab);
      this.work.add(line);
    };
    const WORD = { excavate: 'DIG', fill: 'FILL', extract: 'MINE' };
    for (const c of planned) if (c.target && WORD[c.work]) cube(c.target, 0x8fd3a0, true, `PLANNED ${WORD[c.work]}`);
    for (const t of Object.values(state.tasks ?? {})) if (t.status === 'running' && t.target && WORD[t.kind]) cube(t.target, 0xf2c14e, false, `${WORD[t.kind]} · done end of T${t.completeTick}`);
  }

  /** Cutaway: null shows every layer with an opaque surface; a band shows that layer through it. */
  setCutaway(band, ground) {
    this.cutaway = band;
    // the shown band's floor as a ghosted grid with its name, so cut-away occupants stand on something
    if (!this.floor) {
      const cols = this.ctx.geo.columns, rows = this.ctx.geo.rows, S = this.S;
      const g = new THREE.Group();
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(cols * 4 * S, rows * 4 * S), new THREE.MeshBasicMaterial({ color: 0x3e3226, transparent: true, opacity: 0.55, depthWrite: false }));
      plane.rotation.x = -Math.PI / 2;
      const grid = new THREE.GridHelper(Math.max(cols, rows) * 4 * S, Math.max(cols, rows) * 4, 0x9c8a62, 0x5d4a38);
      grid.material.transparent = true; grid.material.opacity = 0.35; grid.position.y = 0.01;
      grid.scale.set(cols / Math.max(cols, rows), 1, rows / Math.max(cols, rows));
      g.add(plane, grid);
      g.position.set((cols * 4 / 2) * S, 0, -(rows * 4 / 2) * S);
      this.floor = g; this.floor.renderOrder = 0;
      this.group.parent?.add(g);
    }
    this.floor.visible = band !== null && band < 1;
    if (this.floor.visible) {
      this.floor.position.y = bandY(band) - 0.02;
      if (this.floorLabel) this.floor.remove(this.floorLabel);
      this.floorLabel = textLabel(`BAND ${fmtBand(band)} FLOOR · solid earth around the dug cubes`, { color: '#c6b2ff', size: 0.6 });
      this.floorLabel.position.set(0, 0.4, (this.ctx.geo.rows * 4 / 2) * this.S + 1.2);
      this.floor.add(this.floorLabel);
    }
    const see = band !== null && band < 1;
    ground.material.transparent = see;
    ground.material.opacity = see ? 0.28 : 1;
    ground.material.depthWrite = !see;
    ground.material.alphaTest = see ? 0.01 : 0.5; // keep pit holes cut while the surface is see-through
    ground.material.needsUpdate = true;
    for (const h of this.hillMeshes) {
      const op = band !== null && band < 1 + Math.round(h.geometry.parameters.height / BAND_H) ? 0.3 : 1;
      for (const m of [h.material].flat()) { m.opacity = op; m.depthWrite = op === 1; }
    }
  }
}
