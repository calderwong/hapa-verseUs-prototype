/**
 * The opponent seated across the table (human-feedback addendum 05; review 10, R10-01).
 *
 * A presentation-only scene attachment around the Avatar owner's rendered output. Harbor's RedPlayer
 * keeps rendering into its own canvas (one performer, one audio owner). This module samples that
 * canvas, at most ~20 frames per second and only while the figure is visible, onto a transparent
 * CanvasTexture plane. The plane stands at the bound seat: beyond that seat's far bank tray, on the
 * table's long centerline, facing the other seat. The figure is environment. It is never a board
 * target, a height-band occupant or a rule-state object, and nothing here reads game state.
 *
 * Owner canvas contract, qualified on 2026-11-24 against package red-pose-art 2026-11-02.1:
 *  - 673 × 841 portrait of the upper body: head, shoulders and chest. There are no legs, so the
 *    table apron hides the lower edge as a seated waist.
 *  - Readable through drawImage (preserveDrawingBuffer); updated on the owner's own frame loop.
 *  - Opaque. Every owner stage renders with `alpha: false` and clears to the constant
 *    rgb(146,146,146), although the source art is RGBA-transparent. The owner exposes no
 *    transparent-background control. Until it does, `matte()` removes only that exact declared
 *    clear color, and only where it is connected to the frame border (a flood fill). Clothing or
 *    skin of any color inside the silhouette is never keyed. The rim is un-blended from the known
 *    background color. Owner seam requested: a renderer option for a transparent clear and alpha
 *    output in ReferenceMorph, GestureMotion and IdleRenderer.
 *
 * Limited-art orbit policy (a frontal 2D rig): the seat, chair and apron are fixed in the world and
 * visible from every side. The body is full within ±FRONT° of its facing direction. It fades and
 * narrows through to ±SIDE°, and is not drawn beyond that, where the empty chair back remains.
 * Near-overhead (tactical) views fade the body as the pitch rises, and the body also fades when
 * the camera comes too close. It is never drawn without depth.
 */
import * as THREE from 'three';
import { TERRACE_Y } from './scenery.js';

const BG = 146; // the owner renderer's declared clear color (each channel)
const FRONT = 50, SIDE = 80; // degrees: full body / no body
const TACTICAL_FADE = [62, 76]; // camera pitch degrees: full → gone
const SAMPLE_MS = 50;

/**
 * Remove the owner's constant background where it touches the frame border; un-blend the rim.
 * @param {ImageData} img mutated in place
 */
export function matte(img) {
  const { width: W, height: H, data: d } = img;
  const bg = new Uint8Array(W * H);
  const isBg = (i) => Math.abs(d[i * 4] - BG) <= 3 && Math.abs(d[i * 4 + 1] - BG) <= 3 && Math.abs(d[i * 4 + 2] - BG) <= 3;
  const stack = [];
  const seed = (i) => { if (!bg[i] && isBg(i)) { bg[i] = 1; stack.push(i); } };
  for (let x = 0; x < W; x++) { seed(x); seed((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { seed(y * W); seed(y * W + W - 1); }
  while (stack.length) {
    const i = stack.pop(), x = i % W;
    if (x > 0) seed(i - 1);
    if (x < W - 1) seed(i + 1);
    if (i >= W) seed(i - W);
    if (i < W * (H - 1)) seed(i + W);
  }
  for (let i = 0; i < W * H; i++) {
    const o = i * 4;
    if (bg[i]) { d[o + 3] = 0; continue; }
    const x = i % W;
    const edge = (x > 0 && bg[i - 1]) || (x < W - 1 && bg[i + 1]) || (i >= W && bg[i - W]) || (i < W * (H - 1) && bg[i + W]);
    if (!edge) continue;
    // a rim pixel is part figure, part background: estimate coverage and remove the gray share
    const dev = Math.max(Math.abs(d[o] - BG), Math.abs(d[o + 1] - BG), Math.abs(d[o + 2] - BG));
    const a = Math.min(1, Math.max(0.25, dev / 70));
    for (let c = 0; c < 3; c++) d[o + c] = Math.max(0, Math.min(255, BG + (d[o + c] - BG) / a));
    d[o + 3] = Math.round(a * 255);
  }
  return img;
}

export class SeatedAvatar {
  /**
   * @param {{ root: THREE.Object3D, board: { w: number, h: number, S: number }, seat: 'A'|'B', label: string }} o
   */
  constructor(o) {
    const { w, h, S } = o.board;
    this.seat = o.seat;
    this.group = new THREE.Group();
    this.group.name = 'seated-avatar';
    this.group.userData = { environment: true, pickable: false };
    // the seat: beyond the far bank tray (y = h + 7.7 member widths for B), on the long centerline
    const back = 7.7 + 3.2;
    const cx = (w / 2) * S;
    const z = o.seat === 'B' ? -(h + back) * S : back * S;
    this.group.position.set(cx, 0, z);
    this.group.rotation.y = o.seat === 'B' ? 0 : Math.PI; // faces the other seat
    this.facing = new THREE.Vector3(0, 0, o.seat === 'B' ? 1 : -1);
    // authored dimensions (world units): the board is 36 member widths wide (54 units)
    const bodyH = 48, bodyW = bodyH * (673 / 841);
    this.bodyW = bodyW; this.bodyH = bodyH;
    const sink = 9; // how far the frame's lower edge sits below the table top (the seated waist)
    this.disposables = [];
    const own = (x) => { this.disposables.push(x); return x; };
    const wood = own(new THREE.MeshStandardMaterial({ color: 0x76513a, roughness: 0.85, flatShading: true })); // cedar (dusk island table)
    const darkWood = own(new THREE.MeshStandardMaterial({ color: 0x4a3326, roughness: 0.9, flatShading: true }));
    const slate = own(new THREE.MeshStandardMaterial({ color: 0x24323b, roughness: 0.95, flatShading: true }));
    const box = (W, H, D, mat, x, y, z2) => { const m = new THREE.Mesh(own(new THREE.BoxGeometry(W, H, D)), mat); m.position.set(x, y, z2); m.receiveShadow = true; this.group.add(m); return m; };
    // the far table edge: the plinth continues under the opponent's forearms, with an apron facing down
    const tableW = (w + 1.8) * S;
    box(tableW, 0.6, 5.5, slate, 0, -0.28, 2.6);
    box(tableW, 1.3, 1.4, darkWood, 0, 0.55, 0.3); // the raised far table edge: the seated waist is behind it
    box(tableW, 9, 0.6, darkWood, 0, -4.4, -0.2); // the apron below it
    // the chair: a tall back behind the shoulders and two posts, visible from every side
    this.chair = new THREE.Group();
    // the chair has its own materials so it can recede when it stands between the camera and the banks
    this.chairWood = own(new THREE.MeshStandardMaterial({ color: 0x76513a, roughness: 0.85, flatShading: true, transparent: true }));
    this.chairDark = own(new THREE.MeshStandardMaterial({ color: 0x4a3326, roughness: 0.9, flatShading: true, transparent: true }));
    // an open chair back: two posts just outside the shoulders and a rail at neck height (the head
    // rises above it), so it reads as a chair rather than a frame behind a picture
    const chairW = bodyW * 0.86, top = -sink + bodyH * 0.7;
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(own(new THREE.BoxGeometry(1.5, top - TERRACE_Y, 1.5)), this.chairDark); post.position.set(sx * chairW / 2, (top + TERRACE_Y) / 2, -4.2); this.chair.add(post); // the posts stand on the terrace (dusk island table)
      const finial = new THREE.Mesh(own(new THREE.BoxGeometry(2.1, 1.6, 2.1)), this.chairWood); finial.position.set(sx * chairW / 2, top + 0.8, -4.2); this.chair.add(finial);
    }
    const rail = new THREE.Mesh(own(new THREE.BoxGeometry(chairW, 1.6, 1.0)), this.chairWood); rail.position.set(0, top - 1.2, -4.2);
    this.chair.add(rail);
    this.group.add(this.chair);
    // a restrained contact shadow on the table where the forearms rest
    const sh = document.createElement('canvas'); sh.width = 64; sh.height = 32;
    const sg = sh.getContext('2d'); const grad = sg.createRadialGradient(32, 16, 2, 32, 16, 30);
    grad.addColorStop(0, 'rgba(0,0,0,0.45)'); grad.addColorStop(1, 'rgba(0,0,0,0)'); sg.fillStyle = grad; sg.fillRect(0, 0, 64, 32);
    const shTex = own(new THREE.CanvasTexture(sh));
    const shadow = new THREE.Mesh(own(new THREE.PlaneGeometry(bodyW * 0.9, 6)), own(new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false })));
    shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, 0.03, 2.2);
    this.group.add(shadow);
    // the body: the owner's frame on a plane with a lower-edge pivot, behind the table edge
    this.sample = document.createElement('canvas');
    this.sample.width = 337; this.sample.height = 421; // half the owner's size: enough for Home framing
    this.sampleCtx = this.sample.getContext('2d', { willReadFrequently: true });
    this.texture = own(new THREE.CanvasTexture(this.sample));
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.bodyMat = own(new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, alphaTest: 0.02, depthWrite: true, side: THREE.FrontSide, color: 0xe8e4de }));
    const geo = own(new THREE.PlaneGeometry(bodyW, bodyH));
    geo.translate(0, bodyH / 2, 0); // pivot at the lower edge
    this.body = new THREE.Mesh(geo, this.bodyMat);
    this.body.position.set(0, -sink, -1.2);
    this.body.visible = false; // until the first owner frame arrives
    this.group.add(this.body);
    this.head = new THREE.Vector3(0, -sink + bodyH * 0.98, -1.2); // the top of the head (local)
    this.shoulders = [new THREE.Vector3(-bodyW * 0.42, -sink + bodyH * 0.42, -1.2), new THREE.Vector3(bodyW * 0.42, -sink + bodyH * 0.42, -1.2)];
    this.face = new THREE.Vector3(0, -sink + bodyH * 0.74, -1.2);
    o.root.add(this.group);
    this.root = o.root;
    this.source = null;
    this.visibility = 0;
    this._last = 0;
  }

  /** Bind the owner's canvas (or null: chair only, e.g. text-only fallback). */
  setSource(canvas) { this.source = canvas; if (!canvas) this.body.visible = false; }

  /** Home fit points in world space: head top and shoulders (not used by tactical or close fits). */
  homePoints() {
    this.group.updateMatrixWorld(true);
    return [this.head, ...this.shoulders].map((v) => v.clone().applyMatrix4(this.group.matrixWorld));
  }

  /** The face's world position (for the social hit target and the caption anchor). */
  faceWorld() { this.group.updateMatrixWorld(true); return this.face.clone().applyMatrix4(this.group.matrixWorld); }

  /**
   * The limited-art view policy for this camera: 1 = full figure, 0 = chair only.
   * @param {THREE.Camera} camera
   */
  policy(camera) {
    const to = camera.position.clone().sub(this.group.position);
    const flat = new THREE.Vector3(to.x, 0, to.z);
    const dist = to.length();
    if (flat.lengthSq() < 1e-6) return { a: 0, angle: 180 };
    const angle = THREE.MathUtils.radToDeg(flat.normalize().angleTo(this.facing));
    const pitch = THREE.MathUtils.radToDeg(Math.atan2(to.y, Math.hypot(to.x, to.z)));
    const side = angle <= FRONT ? 1 : angle >= SIDE ? 0 : 1 - (angle - FRONT) / (SIDE - FRONT);
    const top = pitch <= TACTICAL_FADE[0] ? 1 : pitch >= TACTICAL_FADE[1] ? 0 : 1 - (pitch - TACTICAL_FADE[0]) / (TACTICAL_FADE[1] - TACTICAL_FADE[0]);
    const near = THREE.MathUtils.clamp((dist - 18) / 14, 0, 1); // the camera inside or at the figure
    return { a: Math.min(side, top, near), angle, pitch, dist };
  }

  update(camera, now = performance.now()) {
    const p = this.policy(camera);
    this.visibility = this.source ? p.a : 0;
    this.lastPolicy = p;
    // viewed from behind the seat, the empty chair stands between the camera and that seat's banks:
    // it recedes to a faint outline rather than covering them
    const chairA = p.angle >= 150 ? 0.22 : p.angle <= 110 ? 1 : 1 - 0.78 * (p.angle - 110) / 40;
    this.chairWood.opacity = this.chairDark.opacity = chairA;
    this.chairWood.depthWrite = this.chairDark.depthWrite = chairA > 0.99;
    const show = this.visibility > 0.01 && !!this.source;
    this.body.visible = show && this._hasFrame;
    if (show) {
      this.bodyMat.opacity = this.visibility;
      this.body.scale.x = 0.55 + 0.45 * Math.min(1, p.angle <= FRONT ? 1 : this.visibility); // narrows as it turns away
      if (now - this._last >= SAMPLE_MS && this.source.width) {
        this._last = now;
        try {
          const g = this.sampleCtx;
          g.clearRect(0, 0, this.sample.width, this.sample.height);
          g.drawImage(this.source, 0, 0, this.sample.width, this.sample.height);
          const img = g.getImageData(0, 0, this.sample.width, this.sample.height);
          g.putImageData(matte(img), 0, 0);
          this.texture.needsUpdate = true;
          this._hasFrame = true;
        } catch (e) { this.sampleError = e.message; }
      }
    }
  }

  dispose() {
    this.root.remove(this.group);
    for (const x of this.disposables) x.dispose?.();
    this.source = null;
  }
}
