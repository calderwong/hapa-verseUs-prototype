/**
 * The diorama around the field (Design Companion v1 ch.2; the reference board brief: "moving
 * rivers, rocks, bridges and scenery outside the playing rectangle"). The painted field sits on a
 * stone plinth in a meadow; trees, crags and rocks stand only outside the playable rectangle and
 * its banks; each army has a small camp behind its home edge. Built from Luminati's procedural
 * PropFactory and TextureLibrary (no external art). Decorative: nothing here is pickable, blocks
 * a rule, or changes with play. Deterministic layout from a fixed seed.
 */
import * as THREE from 'three';
import { TextureLibrary } from '../../../vendor/lumina/src/engine/pixel/Textures.js';
import { PropFactory } from '../../../vendor/lumina/src/engine/world/Props.js';
import { loadSetPieceKit } from '../../../vendor/lumina/src/engine/world/SetPieceKit.js';
import { brushRng } from './palette.js';

const PLINTH = 1.6; // world units the field stands above the meadow

/** A plane with a library texture tiled at its natural world size. */
function tiledPlane(textures, name, w, d, { tint = null } = {}) {
  const base = textures.material(name);
  const mat = base.clone();
  const [uw, uh] = textures.meta(name).units;
  for (const k of ['map', 'normalMap']) {
    if (!base[k]) continue;
    const t = base[k].clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(w / uw, d / uh);
    t.needsUpdate = true;
    mat[k] = t;
  }
  if (tint) mat.color = new THREE.Color(tint);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}

/**
 * A tiled ground frame: the rectangle (ox0..ox1, oz0..oz1) minus the hole (ix0..ix1, iz0..iz1), as
 * four strips whose tiling continues across their seams. The hole keeps decorative ground out of
 * the plinth's footprint, where the excavation bands (−2 at y −1.8, −3 at y −2.7) lie below the
 * meadow and must stay visible through the cutaway (2026-11-22 review UX-04).
 */
function framePlanes(textures, name, o, i, y, opts) {
  const g = new THREE.Group();
  const [uw, uh] = textures.meta(name).units;
  const strip = (x0, x1, z0, z1) => {
    if (x1 - x0 <= 0 || z1 - z0 <= 0) return;
    const m = tiledPlane(textures, name, x1 - x0, z1 - z0, opts);
    for (const k of ['map', 'normalMap']) if (m.material[k]) m.material[k].offset.set((x0 - o.x0) / uw, (o.z1 - z1) / uh);
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    g.add(m);
  };
  strip(o.x0, o.x1, o.z0, i.z0); // far
  strip(o.x0, o.x1, i.z1, o.z1); // near
  strip(o.x0, i.x0, i.z0, i.z1); // left
  strip(i.x1, o.x1, i.z0, i.z1); // right
  return g;
}

/**
 * @param {THREE.Object3D} root
 * @param {{ x0: number, x1: number, z0: number, z1: number, fieldX0: number, fieldX1: number, fieldZ0: number, fieldZ1: number }} b
 *   world bounds of the painted ground plane (x0..x1, z0..z1) and of the playable field inside it
 * @returns {Promise<{ group: THREE.Group, update: (dt: number) => void }>}
 */
export async function buildScenery(root, b) {
  const group = new THREE.Group();
  group.name = 'scenery';
  root.add(group);
  const textures = new TextureLibrary({ seed: 1337, anisotropy: 4 });
  const f = new PropFactory({ textures, seed: 7 });
  const updates = [];
  const rnd = brushRng(0xd10a);
  const W = b.x1 - b.x0, D = b.z1 - b.z0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
  const ground = -PLINTH;

  // the plinth: four stone walls under the painted plane, a dark top rim
  const wallH = PLINTH + 0.02;
  for (const [w, x, z, ry] of [[W, cx, b.z1, 0], [W, cx, b.z0, Math.PI], [D, b.x0, cz, -Math.PI / 2], [D, b.x1, cz, Math.PI / 2]]) {
    const side = tiledPlane(textures, 'stone_wall', w, wallH);
    side.rotation.set(0, ry, 0);
    side.position.set(x, -wallH / 2, z);
    side.castShadow = true;
    group.add(side);
  }
  // meadow and a worn path around the plinth
  // both stop at the plinth walls: nothing decorative lies under the field's excavation volume
  const hole = { x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1 };
  const meadow = framePlanes(textures, 'grass', { x0: cx - 160, x1: cx + 160, z0: cz - 160, z1: cz + 160 }, hole, ground, { tint: '#9FAE8A' }); // muted: the field, not the lawn, holds attention
  group.add(meadow);
  const path = framePlanes(textures, 'dirt_path', { x0: b.x0 - 3.5, x1: b.x1 + 3.5, z0: b.z0 - 3.5, z1: b.z1 + 3.5 }, hole, ground + 0.015, { tint: '#C9B9A0' });
  group.add(path);

  const add = (r) => { if (!r) return; group.add(r.object); if (r.update) updates.push(r.update); };
  const outside = (x, z, pad) => x < b.x0 - pad || x > b.x1 + pad || z < b.z0 - pad || z > b.z1 + pad;

  // tree belts on the long sides and behind each home edge, thinner toward the cameras' near edges
  const kinds = ['oak', 'pine', 'oak', 'autumn', 'pine', 'birch'];
  let placed = 0;
  for (let i = 0; i < 400 && placed < 70; i++) {
    const x = cx + (rnd() - 0.5) * (W + 110), z = cz + (rnd() - 0.5) * (D + 110);
    if (!outside(x, z, 7)) continue;
    const nearA = z > b.z1 + 4 && Math.abs(x - cx) < W * 0.6, nearB = z < b.z0 - 4 && Math.abs(x - cx) < W * 0.6;
    if ((nearA || nearB) && (Math.abs(z - (nearA ? b.z1 : b.z0)) < 26 || rnd() < 0.6)) continue; // keep the home views open
    add(f.tree(x, ground, z, { kind: kinds[Math.floor(rnd() * kinds.length)], height: 6 + rnd() * 4.5, seed: i }));
    placed++;
  }
  for (let i = 0; i < 26; i++) {
    const x = cx + (rnd() - 0.5) * (W + 70), z = cz + (rnd() - 0.5) * (D + 70);
    if (!outside(x, z, 4.5)) continue;
    add(f.rock(x, ground, z, { size: 0.6 + rnd() * 1.4, seed: i }));
  }
  try {
    await loadSetPieceKit();
    for (const [x, z, h] of [[b.x0 - 16, b.z0 + 6, 9], [b.x1 + 18, b.z0 + 14, 11], [b.x0 - 20, cz + 8, 7], [b.x1 + 15, cz - 12, 8]]) add(f.crag(x, ground, z, { height: h, width: 3 + h * 0.2, seed: Math.round(x * 7 + z) }));
    // pennant lines along each camp
    for (const [z, seed] of [[b.z1 + 9, 1], [b.z0 - 9, 2]]) add(f.garland(cx - 14, z, cx + 14, z, ground, { kind: 'pennants', sag: 0.6, height: 3.6, seed }));
  } catch { /* the set-piece kit is optional decoration */ }

  // camps behind each home edge: tents, a campfire, supplies, a fence
  for (const [z, dir, cloth] of [[b.z1 + 6.5, 1, 'cloth_stripe'], [b.z0 - 6.5, -1, 'cloth_red']]) {
    for (const dx of [-22, 22]) add(f.marketStall(cx + dx, ground, z + dir * 2, { cloth, rotation: dir > 0 ? Math.PI : 0, width: 3.2, depth: 2.4, display: false }));
    add(f.campfire(cx - 8, ground, z + dir * 3.5));
    add(f.campfire(cx + 8, ground, z + dir * 3.5));
    add(f.crateStack(cx - 27, ground, z + dir * 1));
    add(f.barrel(cx + 27, ground, z + dir * 1.2));
    add(f.barrel(cx + 28.2, ground, z + dir * 0.4));
    add(f.crate(cx - 28.5, ground, z + dir * 2.6));
    add(f.fence(cx - 31, z + dir * 6, cx + 31, z + dir * 6, ground));
  }
  return { group, update: (dt) => { for (const u of updates) u(dt); } };
}
