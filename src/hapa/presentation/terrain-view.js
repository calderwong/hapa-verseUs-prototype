/**
 * Terrain presentation (Design Companion v1 ch.3 and ch.15; Master Requirements v3 ch.12 "Terrain
 * height can obscure the information that matters"). Draws the rules volume — hills and their
 * ramps, open pits, roofed tunnels, flyers — and a cutaway that steps through the six bands.
 * Every distinction carries a text label and a shape, never height or color alone. It reads the
 * authoritative state and never changes it.
 */
import * as THREE from 'three';
import { BANDS, solidAt, exposed, surfaceBand } from '../rules/terrain.js';

export const BAND_H = 0.9; // world units per band

/** World height of a band's floor: band +1 stands on the surface (0), −1 one band below it. */
export const bandY = (band) => (band >= 1 ? (band - 1) * BAND_H : band * BAND_H);

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
      const mat = new THREE.MeshLambertMaterial({ color: 0x8b7a5c, transparent: true, opacity: 1 });
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
        const shaft = new THREE.Mesh(new THREE.BoxGeometry(S, depth, S), new THREE.MeshLambertMaterial({ color: 0x4a3a28, side: THREE.BackSide }));
        shaft.position.set(w.x, -depth / 2, w.z);
        this.group.add(shaft);
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

  /** Cutaway: null shows every layer with an opaque surface; a band shows that layer through it. */
  setCutaway(band, ground) {
    this.cutaway = band;
    const see = band !== null && band < 1;
    ground.material.transparent = see;
    ground.material.opacity = see ? 0.28 : 1;
    ground.material.depthWrite = !see;
    ground.material.alphaTest = see ? 0.01 : 0.5; // keep pit holes cut while the surface is see-through
    ground.material.needsUpdate = true;
    for (const h of this.hillMeshes) { h.material.opacity = band !== null && band < 1 + Math.round(h.geometry.parameters.height / BAND_H) ? 0.3 : 1; h.material.depthWrite = h.material.opacity === 1; }
  }
}
