/**
 * Fire Pits and Mana basins on the board frame (human-feedback addendum 01, §7; review 04, R4-04).
 *
 * Each owner has one carved stone Fire Pit and one Mana basin outside legal territory and contact
 * strips, fixed in world space (they do not turn with the camera). The pit is where a Card is
 * burned; the basin presents the same public pool the rules hold — it is never a second store.
 *
 * Every effect follows an accepted event and never changes a counter:
 *   - planned burn → a ghost offering hovers over the flame (plan only; nothing consumed);
 *   - `card_burned` → the Card dissolves into the flame and one light stream per Mana color runs
 *     to the basin (Red and Green stay two streams; Rainbow stays Rainbow); zero Mana → no stream;
 *   - `mana_paid` → a short trace leaves the basin; `mana_expired` → the basin dims.
 * Reduced motion: no travel or dissolve, only a brief static emphasis.
 */
import * as THREE from 'three';

const STONE = 0x5b5148, STONE_DARK = 0x3b342e, BRASS = 0xc9a65e, EMBER = 0xff8a3d;
const MANA_HEX = { red: 0xc8473c, green: 0x4d9a4a, purple: 0x7b4fa8, yellow: 0xd9b840, blue: 0x3f6fc4, orange: 0xd9853b, black: 0x2a2730, white: 0xe9e4d6, rainbow: 0xc08fd8 };
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A soft flame texture (procedural, upright). */
function flameTexture() {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 96;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(32, 70, 4, 32, 60, 40);
  grd.addColorStop(0, 'rgba(255,240,180,1)'); grd.addColorStop(0.35, 'rgba(255,160,60,0.95)'); grd.addColorStop(0.75, 'rgba(200,60,30,0.5)'); grd.addColorStop(1, 'rgba(120,20,10,0)');
  g.fillStyle = grd;
  g.beginPath(); g.moveTo(32, 4); g.bezierCurveTo(54, 36, 60, 70, 32, 92); g.bezierCurveTo(4, 70, 10, 36, 32, 4); g.fill();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class ResourceSites {
  /**
   * @param {THREE.Object3D} root board root
   * @param {(x: number, y: number) => THREE.Vector3} at member-width coordinates → world
   * @param {{ w: number, h: number, S: number }} dims board size in member widths
   */
  constructor(root, at, dims) {
    this.root = root;
    this.S = dims.S;
    this.group = new THREE.Group();
    root.add(this.group);
    this.sites = {};
    this.effects = [];
    this.flameTex = flameTexture();
    const spots = {
      A: { pit: [-5.2, -5.9], basin: [-5.2, -1.9] },
      B: { pit: [dims.w + 5.2, dims.h + 5.9], basin: [dims.w + 5.2, dims.h + 1.9] },
    };
    for (const seat of ['A', 'B']) {
      const pit = this._pit(seat), basin = this._basin(seat);
      pit.position.copy(at(...spots[seat].pit));
      basin.position.copy(at(...spots[seat].basin));
      this.group.add(pit, basin);
      this.sites[seat] = { pit, basin, offerings: new THREE.Group(), dim: 0 };
      pit.add(this.sites[seat].offerings);
    }
  }

  /** Member-width spot of a site (for the camera subject). */
  static extents(w, h) { return { x0: -6.8, x1: w + 6.8, y0: -7.6, y1: h + 7.6 }; }

  _pit(seat) {
    const S = this.S, g = new THREE.Group();
    g.userData = { site: { seat, kind: 'pit' } };
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.25 * S, 1.45 * S, 0.5 * S, 12, 1, true), new THREE.MeshStandardMaterial({ color: STONE, roughness: 0.95, flatShading: true, side: THREE.DoubleSide }));
    ring.position.y = 0.25 * S;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.25 * S, 12), new THREE.MeshStandardMaterial({ color: 0x1d1410, emissive: EMBER, emissiveIntensity: 0.35, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0.12 * S;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.35 * S, 0.09 * S, 6, 24), new THREE.MeshStandardMaterial({ color: BRASS, metalness: 0.7, roughness: 0.35 }));
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.5 * S;
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.flameTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    flame.scale.set(1.5 * S, 2.2 * S, 1); flame.position.y = 1.2 * S;
    g.add(ring, floor, rim, flame);
    g.userData.flame = flame; g.userData.floor = floor;
    // a fixed-size pick proxy (the flame sprite is not a reliable target)
    const proxy = new THREE.Mesh(new THREE.CylinderGeometry(1.5 * S, 1.5 * S, 1.6 * S, 10), new THREE.MeshBasicMaterial({ visible: false }));
    proxy.position.y = 0.8 * S; proxy.userData = { site: { seat, kind: 'pit' } };
    g.add(proxy); g.userData.proxy = proxy;
    return g;
  }

  _basin(seat) {
    const S = this.S, g = new THREE.Group();
    g.userData = { site: { seat, kind: 'basin' } };
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.35 * S, 1.0 * S, 0.45 * S, 14), new THREE.MeshStandardMaterial({ color: STONE_DARK, roughness: 0.9, flatShading: true }));
    bowl.position.y = 0.22 * S;
    const water = new THREE.Mesh(new THREE.CircleGeometry(1.15 * S, 18), new THREE.MeshStandardMaterial({ color: 0x1f2a3a, emissive: 0x6a7fa8, emissiveIntensity: 0.25, roughness: 0.2, metalness: 0.1 }));
    water.rotation.x = -Math.PI / 2; water.position.y = 0.46 * S;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.35 * S, 0.08 * S, 6, 28), new THREE.MeshStandardMaterial({ color: BRASS, metalness: 0.7, roughness: 0.35 }));
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.46 * S;
    const proxy = new THREE.Mesh(new THREE.CylinderGeometry(1.5 * S, 1.5 * S, 1.2 * S, 10), new THREE.MeshBasicMaterial({ visible: false }));
    proxy.position.y = 0.6 * S; proxy.userData = { site: { seat, kind: 'basin' } };
    g.add(bowl, water, rim, proxy);
    g.userData.water = water; g.userData.proxy = proxy;
    return g;
  }

  /** World anchor (top of the object) for a site. */
  anchor(seat, kind) {
    const o = this.sites[seat]?.[kind];
    return o ? o.position.clone().setY(o.position.y + (kind === 'pit' ? 1.6 : 0.9) * this.S) : null;
  }

  /** The pit / basin under a ray, or null. */
  pick(raycaster) {
    const proxies = [];
    for (const seat of ['A', 'B']) for (const k of ['pit', 'basin']) proxies.push(this.sites[seat][k].userData.proxy);
    const hit = raycaster.intersectObjects(proxies, false)[0];
    return hit ? hit.object.userData.site : null;
  }

  /** Drop-target emphasis while a Card is carried over a pit (preview only). */
  highlight(seat, state) {
    for (const s of ['A', 'B']) {
      const f = this.sites[s].pit.userData.floor.material;
      f.emissiveIntensity = s === seat ? (state === 'ok' ? 1.1 : 0.15) : 0.35;
      f.emissive.setHex(s === seat && state === 'bad' ? 0x553333 : EMBER);
    }
  }

  /** Planned burns: ghost offerings above the flame (no Card is consumed). */
  setOfferings(seat, faces) {
    const g = this.sites[seat].offerings;
    for (const c of g.children) { c.material.map?.dispose(); c.material.dispose(); }
    g.clear();
    faces.forEach((canvas, i) => {
      const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.62, depthWrite: false }));
      sp.scale.set(1.2 * this.S, 1.6 * this.S, 1);
      sp.position.set((i - (faces.length - 1) / 2) * 0.9 * this.S, 2.9 * this.S + i * 0.05, 0);
      sp.userData.bob = i * 0.7;
      g.add(sp);
    });
  }

  /** Accepted `card_burned`: dissolve into the flame, one stream per Mana color into the basin. */
  burn(seat, face, mana) {
    const site = this.sites[seat];
    const from = site.pit.position.clone().setY(1.4 * this.S), to = site.basin.position.clone().setY(0.6 * this.S);
    if (reduced()) { this._pulse(site.basin, 0.6); return; }
    if (face) {
      const tex = new THREE.CanvasTexture(face); tex.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      sp.scale.set(1.2 * this.S, 1.6 * this.S, 1); sp.position.copy(from).setY(3 * this.S);
      this.group.add(sp);
      this.effects.push({ t: 0, d: 0.35, step: (k) => { sp.position.y = (3 - 1.8 * k) * this.S; sp.material.opacity = 1 - k; sp.scale.setScalar(1.2 * this.S * (1 - 0.6 * k)); sp.scale.y = 1.6 * this.S * (1 - 0.6 * k); }, end: () => { this.group.remove(sp); tex.dispose(); sp.material.dispose(); } });
    }
    const colors = Object.entries(mana ?? {}).filter(([, n]) => n > 0);
    colors.forEach(([color, n], i) => {
      for (let j = 0; j < Math.min(n, 4); j++) {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.22 * this.S, 8, 6), new THREE.MeshBasicMaterial({ color: MANA_HEX[color] ?? 0xffffff, toneMapped: false }));
        dot.visible = false;
        this.group.add(dot);
        const lift = (i - (colors.length - 1) / 2) * 0.8 * this.S;
        this.effects.push({ t: -(0.3 + j * 0.08), d: 0.3, step: (k) => { dot.visible = true; dot.position.lerpVectors(from, to, k); dot.position.y += Math.sin(k * Math.PI) * 2 * this.S; dot.position.x += lift * Math.sin(k * Math.PI); }, end: () => { this.group.remove(dot); dot.geometry.dispose(); dot.material.dispose(); } });
      }
    });
    this.effects.push({ t: -0.55, d: 0.3, step: () => {}, end: () => this._pulse(site.basin, colors.length ? 0.6 : 0) });
  }

  /** Accepted `mana_paid`: a short trace leaves the basin. */
  pay(seat, assigned) {
    const site = this.sites[seat];
    if (reduced() || !assigned?.length) { this._pulse(site.basin, 0.3); return; }
    const from = site.basin.position.clone().setY(0.6 * this.S);
    assigned.forEach((a, i) => {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.18 * this.S, 8, 6), new THREE.MeshBasicMaterial({ color: MANA_HEX[a.color] ?? 0xffffff, toneMapped: false }));
      this.group.add(dot);
      const dir = new THREE.Vector3(Math.cos(i * 1.7), 0, Math.sin(i * 1.7)).multiplyScalar(3 * this.S);
      this.effects.push({ t: 0, d: 0.3, step: (k) => { dot.position.copy(from).addScaledVector(dir, k); dot.position.y += k * 1.5 * this.S; dot.material.opacity = 1 - k; dot.material.transparent = true; }, end: () => { this.group.remove(dot); dot.geometry.dispose(); dot.material.dispose(); } });
    });
  }

  /** Accepted `mana_expired`: the basin's light settles. */
  expire(seat) { this.sites[seat].dim = 1; }

  _pulse(basin, amount) {
    const m = basin.userData.water.material;
    if (reduced()) { m.emissiveIntensity = 0.25 + amount; this.effects.push({ t: 0, d: 0.6, step: () => {}, end: () => { m.emissiveIntensity = 0.25; } }); return; }
    this.effects.push({ t: 0, d: 0.5, step: (k) => { m.emissiveIntensity = 0.25 + amount * (1 - k); } });
  }

  /** Remove every in-flight effect (New match, seeking). */
  clearEffects() { for (const e of this.effects) e.end?.(); this.effects = []; }

  update(dt, time) {
    const still = reduced();
    for (const seat of ['A', 'B']) {
      const s = this.sites[seat];
      const fl = s.pit.userData.flame;
      if (!still) { const f = 1 + Math.sin(time * 9 + (seat === 'A' ? 0 : 2)) * 0.06; fl.scale.y = 2.2 * this.S * f; }
      for (const o of s.offerings.children) o.position.y = 2.9 * this.S + (still ? 0 : Math.sin(time * 2 + o.userData.bob) * 0.12 * this.S);
      if (s.dim > 0) { s.dim = Math.max(0, s.dim - dt * 1.5); s.basin.userData.water.material.emissiveIntensity = 0.25 * (1 - s.dim * 0.8); }
    }
    for (const e of this.effects) {
      e.t += dt;
      if (e.t < 0) continue;
      e.step(Math.min(1, e.t / e.d));
      if (e.t >= e.d) { e.end?.(); e.done = true; }
    }
    this.effects = this.effects.filter((e) => !e.done);
  }
}
