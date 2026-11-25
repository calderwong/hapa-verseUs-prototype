/**
 * GPU resource ownership for board teardown (Review 13, R13-05).
 *
 * Module caches (crest plaques, piece textures, gear, strata, diorama paint) are shared by every
 * board for the page's lifetime and are marked here once when created; a board's teardown releases
 * only what it created. Subtrees owned by someone else (the setting, the seated Avatar) carry
 * `userData.owner` and are released by their owners, never by the board.
 */

/** Resources that outlive any one board (cached textures, geometries, materials). */
const SHARED = new WeakSet();

/** Mark a cached resource as shared and return it. @template T @param {T} r @returns {T} */
export function shared(r) { if (r) SHARED.add(r); return r; }

export const isShared = (r) => SHARED.has(r);

const TEXTURE_KEYS = ['map', 'alphaMap', 'emissiveMap', 'normalMap', 'bumpMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'lightMap', 'specularMap', 'envMap', 'displacementMap'];

/**
 * Collect what a subtree owns: geometries, materials, the textures those materials reference
 * (including texture uniforms), and lights with shadow maps. Stops at nodes owned elsewhere.
 * @param {import('three').Object3D} root
 * @param {{ skip?: (o: any) => boolean }} [o]
 */
export function collectOwned(root, o = {}) {
  const geometries = new Set(), materials = new Set(), textures = new Set(), lights = new Set();
  const visit = (node) => {
    if (node !== root && (node.userData?.owner || o.skip?.(node))) return;
    if (node.isLight) lights.add(node);
    if (node.geometry && !isShared(node.geometry)) geometries.add(node.geometry);
    const mats = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
    for (const m of [...mats, node.customDepthMaterial, node.customDistanceMaterial]) {
      if (!m || isShared(m)) continue;
      materials.add(m);
      for (const k of TEXTURE_KEYS) if (m[k]?.isTexture && !isShared(m[k])) textures.add(m[k]);
      for (const u of Object.values(m.uniforms ?? {})) if (u?.value?.isTexture && !isShared(u.value)) textures.add(u.value);
    }
    for (const c of node.children) visit(c);
  };
  visit(root);
  return { geometries, materials, textures, lights };
}

/** Release a collection once (lights free their shadow render targets). */
export function release({ geometries, materials, textures, lights }) {
  for (const l of lights) l.dispose?.();
  for (const t of textures) t.dispose();
  for (const m of materials) m.dispose();
  for (const g of geometries) g.dispose();
  return { geometries: geometries.size, materials: materials.size, textures: textures.size, lights: lights.size };
}
