/**
 * The board as a crafted object (Design Companion ch.2 "slate / ivory / brass"; the dusk island
 * table's ink slate and aged brass, Assignment 13; brushed-pixel
 * materials; review 03 R3-04; human-feedback addendum 01 §9). A carved slate frame with a brass
 * inlay around the playable field, stone trays under each owner's real Card banks (Minor, Major,
 * row Enchantments) and plinths under the Fire Pits and Mana basins, so the banks read as part of
 * the table rather than floating tiles.
 *
 * Every piece lies outside legal territory and contact strips, is never pickable, and carries no
 * rules meaning. Textures are painted here procedurally with the shared brush RNG (no external
 * media), so their provenance is this file.
 */
import * as THREE from 'three';
import { brushRng } from './palette.js';

/** A small brushed-pixel stone texture (procedural, tiled). */
function stoneTexture(base, seed) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const rng = brushRng(seed);
  g.fillStyle = base; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 220; i++) {
    const x = Math.floor(rng() * 64), y = Math.floor(rng() * 64), s = 1 + Math.floor(rng() * 3);
    const v = rng() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
    g.fillStyle = v; g.fillRect(x, y, s * 2, s);
  }
  // chisel lines: big flat planes with a few cut edges, comic-style
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1;
  for (let i = 0; i < 4; i++) { g.beginPath(); const y = Math.floor(rng() * 64) + 0.5; g.moveTo(0, y); g.lineTo(64, y + (rng() - 0.5) * 6); g.stroke(); }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * @param {THREE.Object3D} root
 * @param {{ w: number, h: number, S: number, rowsBanks?: boolean }} d board size in member widths
 */
export function buildBoardFrame(root, { w, h, S }) {
  const g = new THREE.Group();
  g.name = 'board-frame';
  // dusk island table (Assignment 13 §3D): matte ink slate bands and trays, restrained aged brass
  const slate = new THREE.MeshStandardMaterial({ map: stoneTexture('#2c3b44', 7), roughness: 0.95, flatShading: true });
  const tray = new THREE.MeshStandardMaterial({ map: stoneTexture('#1d2a32', 11), roughness: 1, flatShading: true });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb99252, metalness: 0.6, roughness: 0.42 });
  const box = (x0, x1, y0, y1, top, mat, rep = 4) => {
    const W = (x1 - x0) * S, D = (y1 - y0) * S;
    const m = new THREE.Mesh(new THREE.BoxGeometry(W, top, D), mat.clone());
    if (m.material.map) { m.material.map = m.material.map.clone(); m.material.map.repeat.set(Math.max(1, W / rep), Math.max(1, D / rep)); m.material.map.needsUpdate = true; }
    m.position.set(((x0 + x1) / 2) * S, top / 2 - 0.02, -((y0 + y1) / 2) * S);
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const rim = (x0, x1, y0, y1, y = 0.07) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry((x1 - x0) * S, 0.05, (y1 - y0) * S), brass);
    m.position.set(((x0 + x1) / 2) * S, y, -((y0 + y1) / 2) * S);
    g.add(m);
  };
  // the carved frame: four slate bands hugging the field, a brass inlay on their inner edge
  const f = 0.9;
  box(-f, w + f, -f, 0, 0.1, slate); box(-f, w + f, h, h + f, 0.1, slate);
  box(-f, 0, 0, h, 0.1, slate); box(w, w + f, 0, h, 0.1, slate);
  rim(-0.15, w + 0.15, -0.18, -0.08, 0.11); rim(-0.15, w + 0.15, h + 0.08, h + 0.18, 0.11);
  rim(-0.18, -0.08, 0, h, 0.11); rim(w + 0.08, w + 0.18, 0, h, 0.11);
  // bank trays under the real Card banks (Minor at ±5.9, Major at ±2.3, rows along the sides)
  for (const [y0, y1] of [[-7.7, -4.1], [-3.7, -0.9], [h + 0.9, h + 3.7], [h + 4.1, h + 7.7]]) { box(0.3, w - 0.3, y0, y1, 0.04, tray, 3); rim(0.3, w - 0.3, y0 - 0.06, y0 + 0.02, 0.05); }
  box(-4.4, -2.2, 0.6, h - 0.6, 0.04, tray, 3); box(w + 2.2, w + 4.4, 0.6, h - 0.6, 0.04, tray, 3);
  // plinths under each owner's Fire Pit and Mana basin (outside the field and its banks)
  for (const [x, y] of [[-5.2, -5.9], [-5.2, -1.9], [w + 5.2, h + 5.9], [w + 5.2, h + 1.9]]) box(x - 1.25, x + 1.25, y - 1.25, y + 1.25, 0.08, slate, 2);
  root.add(g);
  return g;
}
