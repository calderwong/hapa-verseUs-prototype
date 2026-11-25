/**
 * The dusk island table (Assignment 13 §3D–E; companion §4–§6). Replaces the meadow and camps.
 *
 * A crafted cedar game table stands on a sheltered stone terrace at the edge of dark coastal
 * water: a cedar apron with a narrow aged-brass inlay and corner caps, a raised cedar lip, a recessed
 * dark plinth and legs; wet flagstones with moss and a retaining wall down to the water; grouped
 * rocks at the waterline; fir clusters on nearby islands and a hazy distant shore under a dusk sky;
 * four warm lanterns, a brazier, and a small linen-and-brass side table implying habitation.
 * Built from Luminati's procedural PropFactory / TextureLibrary plus a few owned meshes and two
 * small shaders here (no external art). The composition is complete with musical response off.
 *
 * Protected: nothing decorative lies inside the painted table top's footprint, so the field's
 * excavation bands stay visible through the cutaway (2026-11-22 UX-04); tile positions, banks,
 * height bands, picking and the seated opponent are untouched. Nothing here is pickable, blocks a
 * rule, or changes with play. Layout is deterministic.
 *
 * Music response (three bounded jobs, §5.1): slow warm practical/trim glow from the smoothed
 * full-mix energy; subdued shoreline/reflection shimmer from the low/high bands; rare embers and one
 * light travelling along the outer trim after an accent with a cooldown. The playable grid and its
 * light are never modulated: no exposure, camera, rule color or target changes. Off keeps quiet
 * ambient life; Still holds every decorative motion and musical intensity animation.
 */
import * as THREE from 'three';
import { TextureLibrary } from '../../../vendor/lumina/src/engine/pixel/Textures.js';
import { PropFactory } from '../../../vendor/lumina/src/engine/world/Props.js';
import { brushRng } from './palette.js';

/** World units per metre at the seated opponent's scale (Red's 48-unit seated figure; the board is a ~1.4 m table). */
export const M = 40;
export const APRON = 9; // a deep cedar apron: it encloses the excavation bands (to −2.7) and Red's seated waist
export const TERRACE_Y = -0.76 * M; // the stone terrace the table stands on (a 76 cm table)
export const WATER_Y = TERRACE_Y - 0.55 * M; // a high-tide quay: the water reads from Home just past the parapet (R13-06)
const CEDAR = 0x76513a, CEDAR_DARK = 0x4a3326, BRASS = 0xb99252, HAZE = 0x8ba5a4, LANTERN = 0xffd7a0, LINEN = 0xeee2c8;

const lerpK = (dt, tau) => 1 - Math.exp(-dt / tau);

/** A plane with a library texture tiled at its natural world size (a cloned material this scene owns). */
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

/** A ground frame: rectangle o minus the hole i, as four strips whose tiling continues across seams. */
function framePlanes(make, o, i, y) {
  const g = new THREE.Group();
  const strip = (x0, x1, z0, z1) => {
    if (x1 - x0 <= 0 || z1 - z0 <= 0) return;
    const m = make(x0, x1, z0, z1);
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    g.add(m);
  };
  strip(o.x0, o.x1, o.z0, i.z0); strip(o.x0, o.x1, i.z1, o.z1);
  strip(o.x0, i.x0, i.z0, i.z1); strip(i.x1, o.x1, i.z0, i.z1);
  return g;
}

/** Dusk sky: warm low horizon toward the far shore, cooling to slate overhead. */
function skyDome() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uLow: { value: new THREE.Color(0xb98a72) }, uMid: { value: new THREE.Color(0x40566a) }, uTop: { value: new THREE.Color(0x15212e) }, uGlowDir: { value: new THREE.Vector3(-0.45, 0, -0.89).normalize() } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uLow; uniform vec3 uMid; uniform vec3 uTop; uniform vec3 uGlowDir; varying vec3 vDir;
      void main(){ float e = clamp(vDir.y, -0.2, 1.0);
        float g = pow(max(dot(normalize(vec3(vDir.x,0.0,vDir.z)), uGlowDir), 0.0), 3.0);
        vec3 c = mix(mix(uMid, uLow, g * 0.85), uMid, smoothstep(0.0, 0.16, e));
        c = mix(c, uTop, smoothstep(0.14, 0.62, e));
        c = mix(c, uLow * 0.55, smoothstep(0.02, -0.15, e));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(620, 32, 16), mat);
  m.renderOrder = -10;
  m.frustumCulled = false;
  return m;
}

/** Dark coastal water: slow swell, sparse sky streaks and warm lantern reflections (one shared material). */
function waterMaterial() {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uShimmer: { value: 0 }, uWarm: { value: 1 },
      uDeep: { value: new THREE.Color(0x0d1b23) }, uSky: { value: new THREE.Color(0x4d6875) }, uHaze: { value: new THREE.Color(HAZE) }, uLamp: { value: new THREE.Color(LANTERN) },
      uLamps: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
    }]),
    vertexShader: `varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime; uniform float uShimmer; uniform float uWarm; uniform vec3 uDeep; uniform vec3 uSky; uniform vec3 uHaze; uniform vec3 uLamp; uniform vec4 uLamps[4]; varying vec3 vW;
      #include <fog_pars_fragment>
      void main(){
        vec3 v = normalize(cameraPosition - vW);
        float fres = pow(1.0 - max(v.y, 0.0), 3.0);
        vec2 q = vW.xz * 0.025; float n = sin(q.x * 0.9 + uTime * 0.35) * sin(q.y * 1.2 - uTime * 0.27) + 0.5 * sin((q.x + q.y) * 2.9 + uTime * 0.8) + 0.25 * sin(q.x * 6.3 - q.y * 4.9 + uTime * 1.4);
        vec3 c = mix(uDeep, uSky, 0.25 + 0.55 * fres + 0.06 * n);
        float streak = smoothstep(1.05, 1.45, n) * (0.10 + 0.55 * uShimmer);
        c += uHaze * streak * (0.35 + fres);
        for (int i = 0; i < 4; i++) {
          vec2 d = vW.xz - uLamps[i].xy;
          float r = exp(-dot(d, d) / (uLamps[i].z * uLamps[i].z));
          c += uLamp * uLamps[i].w * r * (0.55 + 0.45 * smoothstep(-0.4, 1.2, n + uShimmer * 0.6)) * 0.16;
        }
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

/** A soft round sprite texture (embers, the trim glint). */
function dotTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 32;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,240,210,1)'); grd.addColorStop(0.4, 'rgba(255,190,120,0.6)'); grd.addColorStop(1, 'rgba(255,150,80,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Wet coursed flagstones (procedural; Review 13 R13-06): six irregular courses per repeat, quiet
 * joints only a little darker than the stone, soft per-stone value shifts, and moss living in the
 * joints (never flat polygons on top), so the floor reads as a material rather than a grid.
 */
function flagTexture(seed) {
  const N = 256, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const g = cv.getContext('2d');
  const rng = brushRng(seed);
  g.fillStyle = '#4b514c'; g.fillRect(0, 0, N, N); // the joint: close in value to the stone
  const rows = [0, 40, 86, 126, 170, 212, 256];
  const wrap = (fn) => { for (const dx of [0, -N]) fn(dx); };
  for (let r = 0; r < rows.length - 1; r++) {
    let x = -Math.floor(rng() * 50);
    while (x < N) {
      const w = 38 + Math.floor(rng() * 52), y0 = rows[r] + 1, y1 = rows[r + 1] - 1;
      const v = 92 + Math.floor(rng() * 9), warm = Math.floor(rng() * 5);
      g.fillStyle = `rgb(${v + warm - 4},${v},${v - 5})`;
      wrap((dx) => g.fillRect(x + 1 + dx, y0, w - 2, y1 - y0)); // wrap horizontally
      for (let i = 0; i < 18; i++) { g.fillStyle = rng() < 0.5 ? 'rgba(255,250,235,0.03)' : 'rgba(0,0,0,0.045)'; const px = x + 3 + rng() * (w - 8), py = y0 + 2 + rng() * (y1 - y0 - 4), pw = 4 + rng() * 14, ph = 1 + rng() * 3; wrap((dx) => g.fillRect(px + dx, py, pw, ph)); }
      // moss in the joint under some stones, feathered into the stone's foot
      if (rng() < 0.45) {
        const mx = x + rng() * w * 0.6, mw = 10 + rng() * 26;
        for (let k = 0; k < 3; k++) { g.fillStyle = `rgba(${78 + k * 6},${98 + k * 6},${62},${0.42 - k * 0.12})`; wrap((dx) => g.fillRect(mx + dx - k * 2, y1 - 1 - k, mw + k * 4, 2 + k)); }
      }
      x += w;
    }
  }
  // a few lichen speckles (quiet, warm) so broad areas are not flat
  for (let i = 0; i < 140; i++) { g.fillStyle = rng() < 0.6 ? 'rgba(120,128,88,0.16)' : 'rgba(170,160,120,0.10)'; g.fillRect(rng() * N, rng() * N, 1 + rng() * 2, 1 + rng() * 2); }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/** A soft moss decal (alpha falls off irregularly), for drifts along the parapet and planters. */
function mossTexture(seed) {
  const N = 128, cv = document.createElement('canvas'); cv.width = N; cv.height = N / 2;
  const g = cv.getContext('2d');
  const rng = brushRng(seed);
  for (let i = 0; i < 220; i++) {
    const x = N * (0.08 + 0.84 * rng()), y = (N / 2) * (0.25 + 0.5 * rng()) + Math.sin(x * 0.07) * 4;
    const r = 3 + rng() * 9, a = 0.10 + rng() * 0.14;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(${84 + rng() * 20},${104 + rng() * 18},${64},${a})`); grd.addColorStop(1, 'rgba(70,90,58,0)');
    g.fillStyle = grd; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A small directional-grain cedar texture (procedural; no gloss). */
function cedarTexture(seed) {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 32;
  const g = cv.getContext('2d');
  const rng = brushRng(seed);
  g.fillStyle = '#76513a'; g.fillRect(0, 0, 128, 32);
  for (let i = 0; i < 90; i++) {
    const y = Math.floor(rng() * 32), x = Math.floor(rng() * 128);
    g.fillStyle = rng() < 0.5 ? 'rgba(40,22,12,0.28)' : 'rgba(190,140,100,0.14)';
    g.fillRect(x, y, 18 + rng() * 60, 1);
  }
  g.fillStyle = 'rgba(20,10,5,0.35)'; for (const y of [0, 15]) g.fillRect(0, y, 128, 1); // board seams
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * @param {THREE.Object3D} root
 * @param {{ x0: number, x1: number, z0: number, z1: number, home?: 'A'|'B' }} b
 *   world bounds of the painted table top (x0..x1, z0..z1); `home` is the viewing seat (A at +z)
 * @returns {Promise<{ group: THREE.Group, update: (dt: number, music?: any) => void, dispose: () => void, stats: () => any }>}
 */
export async function buildScenery(root, b) {
  const group = new THREE.Group();
  group.name = 'scenery';
  group.userData = { environment: true, pickable: false, owner: 'scenery' }; // released by its own dispose (R13-05)
  root.add(group);
  const textures = new TextureLibrary({ seed: 1337, anisotropy: 4 });
  const f = new PropFactory({ textures, seed: 7 });
  const own = []; // geometries, materials and textures this scene created (disposed with it)
  const keep = (x) => { own.push(x); return x; };
  const updates = [];
  const rnd = brushRng(0xc0a57);
  const W = b.x1 - b.x0, D = b.z1 - b.z0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
  const nearZ = (b.home ?? 'A') === 'A' ? 1 : -1; // the home view looks from this z side

  // --- the table: a deep cedar apron with an aged-brass inlay, a raised lip, an underside, legs ---
  const cedarTex = keep(cedarTexture(0x7ced));
  const cedarMat = (rx, ry) => { const t = keep(cedarTex.clone()); t.repeat.set(rx, ry); t.needsUpdate = true; return keep(new THREE.MeshStandardMaterial({ map: t, roughness: 0.82, metalness: 0, flatShading: true })); };
  const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(keep(new THREE.BoxGeometry(w, h, d)), mat); m.position.set(x, y, z); m.receiveShadow = true; group.add(m); return m; };
  const lip = 1.2;
  const apronX = cedarMat(W / 6, APRON / 3), apronZ = cedarMat(D / 6, APRON / 3);
  // the apron: four cedar walls hugging the painted top's footprint (outside it)
  box(W + 2 * lip, APRON, lip, apronX, cx, -APRON / 2, b.z1 + lip / 2);
  box(W + 2 * lip, APRON, lip, apronX, cx, -APRON / 2, b.z0 - lip / 2);
  box(lip, APRON, D, apronZ, b.x0 - lip / 2, -APRON / 2, cz);
  box(lip, APRON, D, apronZ, b.x1 + lip / 2, -APRON / 2, cz);
  // the underside: faces down only, so from above it never fills an open pit; from below it hides them
  const under = new THREE.Mesh(keep(new THREE.PlaneGeometry(W, D)), keep(new THREE.MeshStandardMaterial({ color: 0x241a14, roughness: 1 })));
  under.rotation.x = Math.PI / 2; under.position.set(cx, -APRON + 0.05, cz); group.add(under);
  // the top rail (R13-06): a warm cedar overhang round the painted top, wide enough to read as the
  // table's own edge from Home, with a fine brass line and brass corner plates. Outside the painted
  // top and the banks; it does not respond to music (the response stays on the apron inlay)
  const lipMat = keep(new THREE.MeshStandardMaterial({ color: CEDAR_DARK, roughness: 0.75, flatShading: true }));
  const RAIL = 3.4, railY = 0.2, railH = 0.42;
  const railX = cedarMat(W / 5, 1), railZ = cedarMat(D / 5, 1);
  box(W + 2 * RAIL, railH, RAIL, railX, cx, railY, b.z1 + RAIL / 2);
  box(W + 2 * RAIL, railH, RAIL, railX, cx, railY, b.z0 - RAIL / 2);
  box(RAIL, railH, D, railZ, b.x0 - RAIL / 2, railY, cz);
  box(RAIL, railH, D, railZ, b.x1 + RAIL / 2, railY, cz);
  // a darker bevel on the rail's outer edge
  box(W + 2 * RAIL + 0.3, 0.5, 0.3, lipMat, cx, railY - 0.06, b.z1 + RAIL + 0.15);
  box(W + 2 * RAIL + 0.3, 0.5, 0.3, lipMat, cx, railY - 0.06, b.z0 - RAIL - 0.15);
  box(0.3, 0.5, D + 2 * RAIL, lipMat, b.x0 - RAIL - 0.15, railY - 0.06, cz);
  box(0.3, 0.5, D + 2 * RAIL, lipMat, b.x1 + RAIL + 0.15, railY - 0.06, cz);
  // two aged-brass inlay bands on the apron (the decorative trim that responds to music)
  const inlay = keep(new THREE.MeshStandardMaterial({ color: BRASS, metalness: 0.55, roughness: 0.45, emissive: new THREE.Color(0xffb46a), emissiveIntensity: 0.08 }));
  const band = 0.32, out = 0.06, bands = [-1.6, -APRON + 1.2];
  for (const by of bands) {
    box(W + 2 * lip + 0.02, band, 0.1, inlay, cx, by, b.z1 + lip + out);
    box(W + 2 * lip + 0.02, band, 0.1, inlay, cx, by, b.z0 - lip - out);
    box(0.1, band, D + 2 * lip + 0.02, inlay, b.x0 - lip - out, by, cz);
    box(0.1, band, D + 2 * lip + 0.02, inlay, b.x1 + lip + out, by, cz);
  }
  const by = bands[0];
  const capMat = keep(new THREE.MeshStandardMaterial({ color: BRASS, metalness: 0.6, roughness: 0.5 }));
  const lineY = railY + railH / 2 + 0.01, lineIn = RAIL * 0.62;
  box(W + 2 * lineIn, 0.04, 0.22, capMat, cx, lineY, b.z1 + lineIn);
  box(W + 2 * lineIn, 0.04, 0.22, capMat, cx, lineY, b.z0 - lineIn);
  box(0.22, 0.04, D + 2 * lineIn, capMat, b.x0 - lineIn, lineY, cz);
  box(0.22, 0.04, D + 2 * lineIn, capMat, b.x1 + lineIn, lineY, cz);
  for (const [x, z] of [[b.x0 - RAIL / 2, b.z0 - RAIL / 2], [b.x1 + RAIL / 2, b.z0 - RAIL / 2], [b.x0 - RAIL / 2, b.z1 + RAIL / 2], [b.x1 + RAIL / 2, b.z1 + RAIL / 2]]) box(RAIL - 0.5, 0.06, RAIL - 0.5, capMat, x, lineY + 0.02, z);
  const corners = [[b.x0 - lip, b.z0 - lip], [b.x1 + lip, b.z0 - lip], [b.x0 - lip, b.z1 + lip], [b.x1 + lip, b.z1 + lip]];
  for (const [x, z] of corners) box(1.1, APRON + 0.2, 1.1, capMat, x, -APRON / 2 + 0.05, z);
  // turned cedar legs and a low stretcher frame down to the terrace
  const legH = -APRON - TERRACE_Y, legMat = cedarMat(1, 4);
  const legAt = corners.map(([x, z]) => [x + Math.sign(cx - x) * 3.2, z + Math.sign(cz - z) * 3.2]);
  for (const [x, z] of legAt) {
    box(4.2, legH, 4.2, legMat, x, -APRON - legH / 2, z);
    box(5.2, 1.6, 5.2, lipMat, x, TERRACE_Y + 0.8, z); // a foot
    box(5.0, 1.2, 5.0, capMat, x, -APRON - 0.6, z); // a brass collar under the apron
  }
  const stretchY = TERRACE_Y + 0.18 * M;
  box(legAt[1][0] - legAt[0][0], 1.6, 1.6, lipMat, cx, stretchY, legAt[0][1]);
  box(legAt[3][0] - legAt[2][0], 1.6, 1.6, lipMat, cx, stretchY, legAt[2][1]);
  box(1.6, 1.6, legAt[2][1] - legAt[0][1], lipMat, legAt[0][0], stretchY, cz);
  box(1.6, 1.6, legAt[3][1] - legAt[1][1], lipMat, legAt[1][0], stretchY, cz);

  // --- the terrace: wet flagstones with moss, a low parapet and a retaining wall to the water -----
  // shallower behind the opponent's chair and at the sides, so the far parapet and the water below
  // it enter the normal Home frame (R13-06); deep on the viewer's side, which Home barely shows
  const farD = 1.4 * M, nearD = 2.6 * M, sideD = 1.8 * M;
  const T = { x0: b.x0 - sideD, x1: b.x1 + sideD, z0: b.z0 - (nearZ > 0 ? farD : nearD), z1: b.z1 + (nearZ > 0 ? nearD : farD) };
  const farEdge = nearZ > 0 ? T.z0 : T.z1;
  // the excavation volume (to band −3, y −3.6) stays empty: the terrace lies ~27 units below it and the
  // apron/underside enclose it, so the terrace can run under the table without covering a pit
  const flagTex = keep(flagTexture(0xf1a6));
  const FLAG = 1.9 * M; // one texture repeat: about 1.9 m of terrace (six courses of ~32 cm)
  const flagMat = keep(new THREE.MeshStandardMaterial({ map: flagTex, roughness: 0.66, metalness: 0.04, color: 0xa9ada6 }));
  const flag = (x0, x1, z0, z1) => {
    const geo = keep(new THREE.PlaneGeometry(x1 - x0, z1 - z0));
    const uv = geo.attributes.uv; // world-anchored UVs: the pattern continues across strips
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (x0 + uv.getX(i) * (x1 - x0)) / FLAG, (z1 - uv.getY(i) * (z1 - z0)) / -FLAG);
    const m = new THREE.Mesh(geo, flagMat);
    m.rotation.x = -Math.PI / 2; m.receiveShadow = false; // far below the board's shadow volume
    return m;
  };
  const tileScale = 9;
  group.add(framePlanes(flag, T, { x0: cx, x1: cx, z0: cz, z1: cz }, TERRACE_Y));
  // a soft contact shadow grounds the table
  const shadowTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); const grd = g.createRadialGradient(32, 32, 6, 32, 32, 32); grd.addColorStop(0, 'rgba(0,0,0,0.75)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grd; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(cv); return t; })();
  keep(shadowTex);
  const contact = new THREE.Mesh(keep(new THREE.PlaneGeometry(W * 1.35, D * 1.25)), keep(new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, color: 0x000000, opacity: 0.8 })));
  contact.rotation.x = -Math.PI / 2; contact.position.set(cx, TERRACE_Y + 0.12, cz); group.add(contact);
  // moss drifts hugging the parapet and the planters (soft-edged, in the stone's own value range);
  // the rest of the moss lives in the joints of the flag texture
  const mossTex = keep(mossTexture(0x3055));
  const mossMat = keep(new THREE.MeshLambertMaterial({ map: mossTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
  const drift = (x, z, len, depth, ry) => {
    const m = new THREE.Mesh(keep(new THREE.PlaneGeometry(len, depth)), mossMat);
    m.rotation.set(-Math.PI / 2, 0, ry); m.position.set(x, TERRACE_Y + 0.06, z); group.add(m);
  };
  for (let i = 0; i < 18; i++) {
    const edge = i % 4, t = 0.08 + 0.84 * rnd(), len = (0.7 + rnd() * 0.9) * M, dep = (0.22 + rnd() * 0.16) * M;
    if (edge < 2) drift(T.x0 + t * (T.x1 - T.x0), (edge === 0 ? T.z0 : T.z1) + (edge === 0 ? 1 : -1) * (dep / 2 + 4), len, dep, 0);
    else drift((edge === 2 ? T.x0 : T.x1) + (edge === 2 ? 1 : -1) * (dep / 2 + 4), T.z0 + t * (T.z1 - T.z0), len, dep, Math.PI / 2);
  }
  const curbMat = keep(new THREE.MeshStandardMaterial({ color: 0x56605f, roughness: 0.9, flatShading: true }));
  const curb = 0.35 * M, curbH = 0.4 * M;
  box(T.x1 - T.x0 + curb, curbH, curb, curbMat, (T.x0 + T.x1) / 2, TERRACE_Y + curbH / 2, T.z0);
  box(T.x1 - T.x0 + curb, curbH, curb, curbMat, (T.x0 + T.x1) / 2, TERRACE_Y + curbH / 2, T.z1);
  box(curb, curbH, T.z1 - T.z0, curbMat, T.x0, TERRACE_Y + curbH / 2, (T.z0 + T.z1) / 2);
  box(curb, curbH, T.z1 - T.z0, curbMat, T.x1, TERRACE_Y + curbH / 2, (T.z0 + T.z1) / 2);
  // retaining wall: wet stone from the terrace down into the water
  const wallH = TERRACE_Y - WATER_Y + 8;
  for (const [w, x, z, ry] of [[T.x1 - T.x0, (T.x0 + T.x1) / 2, T.z1 + curb / 2, 0], [T.x1 - T.x0, (T.x0 + T.x1) / 2, T.z0 - curb / 2, Math.PI], [T.z1 - T.z0, T.x0 - curb / 2, (T.z0 + T.z1) / 2, -Math.PI / 2], [T.z1 - T.z0, T.x1 + curb / 2, (T.z0 + T.z1) / 2, Math.PI / 2]]) {
    const side = tiledPlane(textures, 'stone_wall', w / tileScale, wallH / tileScale, { tint: '#5d6867' });
    keep(side.material); keep(side.geometry);
    side.scale.set(tileScale, tileScale, 1);
    side.rotation.set(0, ry, 0);
    side.position.set(x, TERRACE_Y - wallH / 2 + 0.2, z);
    group.add(side);
  }
  // a dark waterline band on the wall (wet stone)
  const wetMat = keep(new THREE.MeshBasicMaterial({ color: 0x0f1a1f, transparent: true, opacity: 0.55, depthWrite: false }));
  for (const [w, x, z, ry] of [[T.x1 - T.x0 + 2, (T.x0 + T.x1) / 2, T.z1 + curb / 2 + 0.1, 0], [T.x1 - T.x0 + 2, (T.x0 + T.x1) / 2, T.z0 - curb / 2 - 0.1, Math.PI], [T.z1 - T.z0 + 2, T.x0 - curb / 2 - 0.1, (T.z0 + T.z1) / 2, -Math.PI / 2], [T.z1 - T.z0 + 2, T.x1 + curb / 2 + 0.1, (T.z0 + T.z1) / 2, Math.PI / 2]]) {
    const m = new THREE.Mesh(keep(new THREE.PlaneGeometry(w, 7)), wetMat);
    m.rotation.y = ry; m.position.set(x, WATER_Y + 3, z); group.add(m);
  }

  // --- water, sky and the far shore ----------------------------------------------------------------
  const water = keep(waterMaterial());
  const waterMesh = new THREE.Mesh(keep(new THREE.PlaneGeometry(1400, 1400)), water);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.set(cx, WATER_Y, cz);
  group.add(waterMesh); // far below the terrace; never inside the table footprint's view
  const sky = skyDome(); keep(sky.geometry); keep(sky.material);
  sky.position.set(cx, 0, cz);
  group.add(sky);
  // the distant shore: a low jagged ring of wooded hills in haze (fog finishes the depth)
  const ring = [];
  const seg = 120, R0 = 540;
  const shorePos = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const hgt = 30 + 60 * Math.abs(Math.sin(a * 3.1 + 1.3)) + 34 * Math.abs(Math.sin(a * 7.7)) + 14 * rnd();
    ring.push([Math.cos(a) * R0, Math.sin(a) * R0, hgt]);
  }
  for (let i = 0; i < seg; i++) {
    const [x0, z0, h0] = ring[i], [x1, z1, h1] = ring[i + 1];
    shorePos.push(x0, WATER_Y - 2, z0, x1, WATER_Y - 2, z1, x1, WATER_Y + h1, z1, x0, WATER_Y - 2, z0, x1, WATER_Y + h1, z1, x0, WATER_Y + h0, z0);
  }
  const shoreGeo = keep(new THREE.BufferGeometry());
  shoreGeo.setAttribute('position', new THREE.Float32BufferAttribute(shorePos, 3));
  shoreGeo.computeVertexNormals();
  const shore = new THREE.Mesh(shoreGeo, keep(new THREE.MeshBasicMaterial({ color: 0x24343a, side: THREE.DoubleSide, fog: true })));
  shore.position.set(cx, 0, cz);
  group.add(shore);

  const add = (r, scale = 1, at = null) => {
    if (!r) return null;
    if (scale !== 1) { r.object.scale.multiplyScalar(scale); if (at) r.object.position.copy(at); }
    group.add(r.object); if (r.update) updates.push(r.update); return r;
  };
  // a prop built at its own diorama size, then scaled about its base to the human-scale terrace
  const scaled = (make, x, y, z, k) => add(make(0, 0, 0), k, new THREE.Vector3(x, y, z));
  // --- islands and wooded silhouettes: a few grouped fir stands, not uniform scatter ---------------
  const islandMat = keep(new THREE.MeshStandardMaterial({ color: 0x27302a, roughness: 1, flatShading: true }));
  const rockMat = keep(new THREE.MeshStandardMaterial({ color: 0x46504f, roughness: 0.95, flatShading: true }));
  const fir = (x, y, z, h, seed) => scaled(() => f.tree(0, 0, 0, { kind: 'pine', height: 10, seed }), x, y, z, h / 10);
  const island = (x, z, r, trees, tall) => {
    const m = new THREE.Mesh(keep(new THREE.CylinderGeometry(r * 0.72, r, 14, 10, 1)), islandMat);
    m.position.set(x, WATER_Y + 4, z); m.rotation.y = rnd() * 3; m.scale.set(1, 1, 0.55 + rnd() * 0.5);
    group.add(m);
    for (let i = 0; i < trees; i++) {
      const a = rnd() * Math.PI * 2, d = rnd() * r * 0.55;
      fir(x + Math.cos(a) * d, WATER_Y + 11, z + Math.sin(a) * d * 0.6, tall * (0.6 + rnd() * 0.55), Math.round(x * 13 + z * 7 + i));
    }
  };
  const sx = W / 2, sz = D / 2;
  // every island stands beyond the camera's farthest orbit (3.6 × board size from its center)
  island(cx - sx - 360, cz - 40, 70, 9, 7 * M);
  island(cx + sx + 350, cz + 110, 60, 7, 6 * M);
  island(cx + sx + 240, cz - sz - 330, 90, 11, 7.5 * M);
  island(cx - sx - 260, cz - sz - 380, 110, 12, 8 * M);
  island(cx + 30, cz - sz - 470, 120, 12, 8 * M);
  island(cx - sx - 360, cz + sz + 260, 70, 6, 6.5 * M);
  // terrace planting: low ferny shrubs in stone planters at the corners (firs stay on the islands, far
  // enough out that no camera mode looks through them at the board)
  const shrubMat = keep(new THREE.MeshLambertMaterial({ color: 0x34503a, flatShading: true }));
  const planterMat = keep(new THREE.MeshStandardMaterial({ color: 0x4a5453, roughness: 0.95, flatShading: true }));
  // only on the viewer's side: the far corners stay open so the parapet and water read from Home
  const nearT = nearZ > 0 ? T.z1 - 0.45 * M : T.z0 + 0.45 * M;
  for (const [x, z] of [[T.x0 + 0.45 * M, nearT], [T.x1 - 0.45 * M, nearT]]) {
    box(0.6 * M, 0.3 * M, 0.6 * M, planterMat, x, TERRACE_Y + 0.15 * M, z);
    drift(x, z, 0.95 * M, 0.95 * M, rnd() * 3);
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(keep(new THREE.IcosahedronGeometry(5 + rnd() * 4, 0)), shrubMat);
      m.position.set(x + (rnd() - 0.5) * 14, TERRACE_Y + 0.3 * M + 4 + rnd() * 5, z + (rnd() - 0.5) * 14); m.scale.y = 0.75;
      group.add(m);
    }
  }
  // rocks grouped at the waterline by the terrace corners, some half-submerged
  for (const [x, z, n] of [[T.x0 - 30, T.z0 - 20, 5], [T.x1 + 30, T.z0 - 30, 4], [T.x0 - 40, T.z1 + 28, 3], [T.x1 + 36, T.z1 + 20, 4], [T.x0 - 46, cz, 3], [T.x1 + 44, cz - 50, 3]]) {
    for (let i = 0; i < n; i++) scaled(() => f.rock(0, 0, 0, { size: 1.4 + rnd() * 2, seed: Math.round(x + z * 3 + i) }), x + (rnd() - 0.5) * 60, WATER_Y - 4 + rnd() * 3, z + (rnd() - 0.5) * 60, 9);
  }
  for (let i = 0; i < 8; i++) { // low stones with moss caps by the terrace corners
    const [x, z] = corners[i % 4];
    const sxn = Math.sign(x - cx), szn = Math.sign(z - cz);
    const m = new THREE.Mesh(keep(new THREE.DodecahedronGeometry(5 + rnd() * 6, 0)), rockMat);
    m.position.set(x + sxn * (40 + rnd() * 30), TERRACE_Y + 2.5, z + szn * (30 + rnd() * 34)); m.scale.y = 0.6; m.rotation.set(rnd(), rnd() * 3, 0);
    group.add(m);
    const moss = new THREE.Mesh(keep(new THREE.SphereGeometry(4.6, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2)), keep(new THREE.MeshLambertMaterial({ color: 0x47613f, flatShading: true })));
    moss.position.copy(m.position).add(new THREE.Vector3(0, 2, 0)); moss.scale.set(1.1, 0.35, 1);
    group.add(moss);
  }

  // --- the coastal cue seen from Home (R13-06): a moored skiff below the far parapet, its line made
  // fast to an iron bollard on the curb, a second bollard and a coiled rope beside it ---------------
  const ironMat = keep(new THREE.MeshStandardMaterial({ color: 0x2b302f, roughness: 0.6, metalness: 0.35, flatShading: true }));
  const ropeMat = keep(new THREE.MeshStandardMaterial({ color: 0x86735a, roughness: 0.95 }));
  const curbTop = TERRACE_Y + curbH, inward = nearZ; // +z is inward when the far edge is z0
  const bollards = [cx - 1.35 * M, cx + 1.55 * M].map((x) => {
    const post = new THREE.Mesh(keep(new THREE.CylinderGeometry(1.5, 1.9, 0.3 * M, 10)), ironMat);
    post.position.set(x, curbTop + 0.15 * M, farEdge); group.add(post);
    const cap = new THREE.Mesh(keep(new THREE.SphereGeometry(2.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2)), ironMat);
    cap.position.set(x, curbTop + 0.3 * M, farEdge); cap.scale.y = 0.6; group.add(cap);
    const turn = new THREE.Mesh(keep(new THREE.TorusGeometry(1.9, 0.4, 6, 14)), ropeMat);
    turn.rotation.x = Math.PI / 2; turn.position.set(x, curbTop + 0.2 * M, farEdge); group.add(turn);
    return new THREE.Vector3(x, curbTop + 0.2 * M, farEdge);
  });
  const coil = new THREE.Mesh(keep(new THREE.TorusGeometry(2.8, 0.7, 6, 18)), ropeMat);
  coil.rotation.x = -Math.PI / 2; coil.position.set(bollards[1].x + 9, TERRACE_Y + 1.1, farEdge + inward * 9); group.add(coil);
  // the skiff: a lofted cedar hull with thwarts, riding just off the wall
  const skiff = new THREE.Group();
  const L = 2.0 * M, Bm = 0.8 * M, Hh = 0.3 * M;
  const outline = new THREE.Shape();
  outline.moveTo(-L / 2, 0); outline.quadraticCurveTo(-L * 0.25, Bm / 2, 0, Bm / 2); outline.quadraticCurveTo(L * 0.3, Bm / 2, L / 2, 0);
  outline.quadraticCurveTo(L * 0.3, -Bm / 2, 0, -Bm / 2); outline.quadraticCurveTo(-L * 0.25, -Bm / 2, -L / 2, 0);
  const hullGeo = keep(new THREE.ExtrudeGeometry(outline, { depth: Hh, bevelEnabled: true, bevelThickness: 2, bevelSize: 2, bevelSegments: 1, curveSegments: 12 }));
  hullGeo.rotateX(Math.PI / 2); hullGeo.translate(0, Hh, 0);
  // a painted working skiff: weathered teal hull, cream gunwale (reads as a boat at a glance)
  const hullMat = keep(new THREE.MeshStandardMaterial({ color: 0x2f5552, roughness: 0.75, flatShading: true }));
  const hull = new THREE.Mesh(hullGeo, hullMat); skiff.add(hull);
  const rimGeo = keep(new THREE.ExtrudeGeometry(outline, { depth: 1.1, bevelEnabled: false, curveSegments: 12 }));
  rimGeo.rotateX(Math.PI / 2); rimGeo.translate(0, Hh + 2.4, 0);
  const rim = new THREE.Mesh(rimGeo, keep(new THREE.MeshStandardMaterial({ color: 0xd8ccb0, roughness: 0.8, flatShading: true })));
  rim.scale.set(1.03, 1, 1.05); skiff.add(rim);
  const inside = new THREE.Mesh(keep(new THREE.ShapeGeometry(outline, 12)), keep(new THREE.MeshStandardMaterial({ color: 0x2c2019, roughness: 1 })));
  inside.rotation.x = -Math.PI / 2; inside.position.y = Hh + 2.6; inside.scale.set(0.93, 0.86, 1); skiff.add(inside);
  for (const t of [-0.22, 0.12]) { const th = new THREE.Mesh(keep(new THREE.BoxGeometry(2.2, 1.0, Bm * 0.8)), cedarMat(1, 1)); th.position.set(t * L, Hh + 3.2, 0); skiff.add(th); }
  const oar = new THREE.Mesh(keep(new THREE.BoxGeometry(L * 0.7, 0.8, 1.6)), keep(new THREE.MeshStandardMaterial({ color: 0x9a7a55, roughness: 0.85, flatShading: true })));
  oar.position.set(0.05 * L, Hh + 3.8, Bm * 0.18); oar.rotation.y = 0.12; skiff.add(oar);
  // lying along the wall in the band of water the Home view sees just beyond the parapet
  const skiffAt = new THREE.Vector3(cx - 2.3 * M, WATER_Y + 0.5, farEdge - inward * (curb / 2 + 0.5 * M));
  skiff.position.copy(skiffAt); skiff.rotation.y = 0.1; group.add(skiff);
  // its painter (bow line) sags from the bow ring to the left bollard
  const bow = new THREE.Vector3(-L / 2 - 2, Hh, 0).applyEuler(skiff.rotation).add(skiffAt);
  const mid = bow.clone().lerp(bollards[0], 0.5); mid.y = Math.min(bow.y, bollards[0].y) + 6;
  const line = new THREE.Mesh(keep(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(bow, mid, bollards[0]), 16, 0.45, 5, false)), ropeMat);
  group.add(line);
  let bob = 0;
  updates.push((dt) => { bob += dt; skiff.position.y = skiffAt.y + Math.sin(bob * 0.9) * 0.45; skiff.rotation.z = Math.sin(bob * 0.7 + 1) * 0.015; });

  // --- practicals: four warm lanterns, a brazier, and a small linen-and-brass side table ----------
  const lanterns = [];
  const lampK = 16; // the library lamppost is diorama-sized; ×16 is a ~2.4 m lantern post
  const poolTex = keep(dotTexture());
  const poolMat = keep(new THREE.MeshBasicMaterial({ map: poolTex, color: 0xffb877, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, fog: true }));
  const haloMat = keep(new THREE.SpriteMaterial({ map: poolTex, color: 0xffd7a0, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  const lampSpots = [[b.x0 - 1.1 * M, b.z1 + 1.1 * M], [b.x1 + 1.1 * M, b.z1 + 1.1 * M], [b.x0 - 1.1 * M, b.z0 - 1.1 * M], [b.x1 + 1.1 * M, b.z0 - 1.1 * M]];
  for (const [x, z] of lampSpots) {
    const r = scaled(() => f.lamppost(0, 0, 0, { style: 'top', height: 3.8 }), x, TERRACE_Y, z, lampK);
    const lp = r?.lights?.[0]?.position ? r.lights[0].position.clone().multiplyScalar(lampK).add(new THREE.Vector3(x, TERRACE_Y, z)) : new THREE.Vector3(x, TERRACE_Y + 4.2 * lampK, z);
    // the lantern's light on the apron, legs and flagstones comes from just below the table-top plane,
    // so it can never light the playing surface or its pieces from above (tactical light stays stable)
    const light = new THREE.PointLight(LANTERN, 0, 120, 1.6);
    light.position.set(x + Math.sign(x - cx) * 6, -APRON - 3, z + Math.sign(z - cz) * 6);
    group.add(light);
    // a warm pool on the flagstones and a soft glow round the glass (additive, unlit)
    const pool = new THREE.Mesh(keep(new THREE.CircleGeometry(0.9 * M, 24)), poolMat);
    pool.rotation.x = -Math.PI / 2; pool.position.set(x, TERRACE_Y + 0.1, z); group.add(pool);
    const halo = new THREE.Sprite(haloMat); halo.scale.set(26, 26, 1); halo.position.copy(lp); group.add(halo);
    lanterns.push({ light, glass: r?.emissives?.[0]?.material ?? null, x, z, y: lp.y, phase: rnd() * 6.28, base: 260 });
  }
  const glassMats = [...new Set(lanterns.map((l) => l.glass).filter(Boolean))];
  for (const g of glassMats) { g.emissive = new THREE.Color(0xffc88a); g.emissiveIntensity = 1.8; }
  // the brazier at the side of the terrace, out of the home view's sightline
  const brazierAt = new THREE.Vector3(T.x0 + 0.8 * M, TERRACE_Y, nearZ > 0 ? T.z0 + 1.0 * M : T.z1 - 1.0 * M);
  const brazier = scaled(() => f.campfire(0, 0, 0), brazierAt.x, brazierAt.y, brazierAt.z, 9);
  // a cedar side table by the home corner: folded linen and a brass cup (habitation, not play)
  const st = { x: b.x1 + 0.95 * M, z: (nearZ > 0 ? b.z1 : b.z0) + nearZ * 0.35 * M };
  const sideMat = cedarMat(1, 1), stH = 0.62 * M;
  box(0.9 * M, 1.4, 0.6 * M, sideMat, st.x, TERRACE_Y + stH, st.z);
  for (const [dx, dz] of [[-0.4, -0.26], [0.4, -0.26], [-0.4, 0.26], [0.4, 0.26]]) box(1.6, stH, 1.6, sideMat, st.x + dx * M, TERRACE_Y + stH / 2, st.z + dz * M);
  const linen = keep(new THREE.MeshStandardMaterial({ color: LINEN, roughness: 0.95 }));
  box(0.42 * M, 1.4, 0.3 * M, linen, st.x - 0.12 * M, TERRACE_Y + stH + 1.4, st.z + 0.04 * M);
  box(0.4 * M, 1.0, 0.28 * M, linen, st.x - 0.12 * M, TERRACE_Y + stH + 2.5, st.z + 0.05 * M);
  const cup = new THREE.Mesh(keep(new THREE.CylinderGeometry(1.7, 1.3, 3.6, 12)), capMat);
  cup.position.set(st.x + 0.24 * M, TERRACE_Y + stH + 2.5, st.z - 0.08 * M); group.add(cup);
  // a linen runner folded over the near lip of the table (outside the playable top)
  const nearRail = nearZ > 0 ? b.z1 + RAIL / 2 : b.z0 - RAIL / 2;
  box(9, 0.12, RAIL + 0.5, linen, b.x0 + 9, railY + railH / 2 + 0.07, nearRail);
  box(9, 5.5, 0.1, linen, b.x0 + 9, railY - 2.6, nearRail + nearZ * (RAIL / 2 + 0.42));

  // --- music response objects: an ember pool and one trim glint (fixed, reused) -----------------
  const dot = keep(dotTexture());
  const EMBERS = 32;
  const ePos = new Float32Array(EMBERS * 3), eCol = new Float32Array(EMBERS * 3);
  const eVel = new Float32Array(EMBERS * 3), eLife = new Float32Array(EMBERS);
  const eGeo = keep(new THREE.BufferGeometry());
  eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
  eGeo.setAttribute('color', new THREE.BufferAttribute(eCol, 3));
  const embers = new THREE.Points(eGeo, keep(new THREE.PointsMaterial({ size: 2.4, map: dot, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  embers.frustumCulled = false;
  group.add(embers);
  const glint = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: dot, color: 0xffd7a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })));
  glint.scale.set(4.5, 1.6, 1);
  group.add(glint);
  // the trim path (the upper brass inlay's perimeter)
  const P = [[b.x0 - lip - out, b.z1 + lip + out], [b.x1 + lip + out, b.z1 + lip + out], [b.x1 + lip + out, b.z0 - lip - out], [b.x0 - lip - out, b.z0 - lip - out]];
  const perim = 2 * (W + 2 * lip) + 2 * (D + 2 * lip);
  const onTrim = (u, v) => { let s = (((u % 1) + 1) % 1) * perim; for (let i = 0; i < 4; i++) { const a = P[i], c = P[(i + 1) % 4]; const L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (s <= L) { const t = s / L; return v.set(a[0] + (c[0] - a[0]) * t, by, a[1] + (c[1] - a[1]) * t); } s -= L; } return v.set(P[0][0], by, P[0][1]); };
  let glintT = -1, glintU = 0;
  const spawnEmbers = (n) => {
    let made = 0;
    const src = [...lanterns.map((l) => [l.x, l.y, l.z]), ...(brazier ? [[brazierAt.x, brazierAt.y + 8, brazierAt.z]] : [])];
    for (let i = 0; i < EMBERS && made < n; i++) {
      if (eLife[i] > 0) continue;
      const [x, y, z] = src[Math.floor(rnd() * src.length)];
      ePos.set([x + (rnd() - 0.5) * 5, y + rnd() * 2, z + (rnd() - 0.5) * 5], i * 3);
      eVel.set([(rnd() - 0.5) * 3, 4 + rnd() * 4, (rnd() - 0.5) * 3], i * 3);
      eLife[i] = 1.6 + rnd() * 1.2;
      made++;
    }
  };
  const clearEmbers = () => { eLife.fill(0); eCol.fill(0); eGeo.attributes.color.needsUpdate = true; glintT = -1; glint.material.opacity = 0; };

  // --- the update: ambient life on its own clock, music response from the sampled frame ---------
  const tmp = new THREE.Vector3();
  const lampU = water.uniforms.uLamps.value;
  let clock = 0, glow = 0, shimmer = 0, lastKey = null, lastAccent = 0, ambient = 0;
  const update = (dt, m = {}) => {
    dt = Math.min(Math.max(dt || 0, 0), 0.1);
    const still = !!m.still, resp = m.response ?? 'subtle', fr = m.frame;
    const amp = still || resp === 'off' ? 0 : resp === 'expressive' ? 1 : 0.42;
    // a new song, generation or no song: no previous song's response lingers
    const key = fr && fr.playing ? `${fr.itemKey}|${fr.generation}` : null;
    if (key !== lastKey) { if (lastKey) clearEmbers(); lastKey = key; }
    const e = fr ? fr.energy01 : 0, lo = fr ? fr.low01 : 0, hi = fr ? fr.high01 : 0;
    glow += (amp * e - glow) * lerpK(dt, still ? 0.05 : 0.35);
    shimmer += (amp * (0.6 * lo + 0.4 * hi) - shimmer) * lerpK(dt, still ? 0.05 : 0.25);
    if (!still) { clock += dt; ambient = 1; } else ambient = 0;
    for (const u of updates) if (!still) u(dt);
    // 1) slow practical / trim glow (a fixed readable baseline; tactical light is not touched)
    for (let i = 0; i < lanterns.length; i++) {
      const l = lanterns[i];
      const flick = ambient ? 0.035 * Math.sin(clock * 6.3 + l.phase) + 0.02 * Math.sin(clock * 11.7 + l.phase * 2) : 0;
      l.light.intensity = l.base * (1 + flick + 0.5 * glow);
      lampU[i].set(l.x, l.z, 70 + 22 * glow, (1 + 0.6 * glow) * (1 + flick));
    }
    for (const g of glassMats) g.emissiveIntensity = 1.8 + 1.6 * glow;
    poolMat.opacity = 0.2 + 0.16 * glow; haloMat.opacity = 0.5 + 0.35 * glow;
    inlay.emissiveIntensity = 0.08 + 0.85 * glow;
    // 2) subdued shoreline / reflection motion
    water.uniforms.uTime.value = clock;
    water.uniforms.uShimmer.value = shimmer;
    // 3) rare accents: a few embers and one light travelling along the outer trim (never while busy)
    const acc = fr ? fr.accent01 : 0;
    if (acc >= 1 && lastAccent < 1 && amp > 0 && !m.busy && key) { spawnEmbers(resp === 'expressive' ? 10 : 5); glintT = 0; glintU = rnd(); }
    lastAccent = acc;
    let live = false;
    for (let i = 0; i < EMBERS; i++) {
      if (eLife[i] <= 0) continue;
      live = true;
      if (!still) { eLife[i] -= dt; for (let k = 0; k < 3; k++) ePos[i * 3 + k] += eVel[i * 3 + k] * dt; eVel[i * 3 + 1] *= 1 - 0.3 * dt; }
      const a = Math.max(0, Math.min(1, eLife[i] / 1.2));
      eCol.set([a, a * 0.62, a * 0.32], i * 3);
    }
    if (live) { eGeo.attributes.position.needsUpdate = true; eGeo.attributes.color.needsUpdate = true; }
    if (glintT >= 0 && !still) {
      glintT += dt / 1.8;
      onTrim(glintU + glintT * 0.22, tmp);
      glint.position.copy(tmp);
      glint.material.opacity = glintT >= 1 ? 0 : Math.sin(Math.PI * glintT) * (resp === 'expressive' ? 0.9 : 0.6);
      if (glintT >= 1) glintT = -1;
    } else if (still) glint.material.opacity = 0;
  };
  update(0, { response: 'off', still: true });

  const dispose = () => {
    group.traverse((o) => { if (o.isLight) o.dispose?.(); });
    // owned materials may hold cloned maps (tiled planes); every texture here belongs to this scene
    for (const x of own) { if (x.isMaterial) for (const k of ['map', 'normalMap', 'emissiveMap']) x[k]?.dispose?.(); x.dispose?.(); }
    f.dispose();
    textures.dispose();
    group.removeFromParent();
  };
  const stats = () => ({ lights: lanterns.length, embers: EMBERS, liveEmbers: [...eLife].filter((v) => v > 0).length, glow, shimmer, inlay: inlay.emissiveIntensity, lantern0: lanterns[0]?.light.intensity, waterTime: clock });
  return { group, update, dispose, stats };
}
