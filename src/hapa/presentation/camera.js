/**
 * Board camera (Design Companion v1, Chapters 4 and 10): full orbit around a stable pivot, a
 * dependable home view per seat, a near-overhead tactical view (V), 45° yaw steps (Q/E), 15° pitch
 * steps (Z/X), WASD pan, wheel zoom, middle-drag orbit and Shift+middle-drag pan. Viewing never
 * changes territory identities, formation facing or any rule.
 */
import * as THREE from 'three';
import { globalUniforms } from '../../../vendor/lumina/src/engine/render/GlobalUniforms.js';

const DEG = Math.PI / 180;
const damp = (a, b, lambda, dt) => b + (a - b) * Math.exp(-lambda * dt);
const dampAngle = (a, b, lambda, dt) => {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * (1 - Math.exp(-lambda * dt));
};

export class BoardCamera {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {HTMLElement} el element receiving pointer input (the world viewport)
   * @param {{ center: THREE.Vector3, size: number }} board
   */
  constructor(camera, el, board) {
    this.camera = camera;
    this.el = el;
    this.board = board;
    this.focus = board.center.clone();
    this.goal = { yaw: 0, pitch: 56 * DEG, distance: board.size * 1.55, focus: board.center.clone() };
    this.yaw = 0; this.pitch = this.goal.pitch; this.distance = this.goal.distance;
    this.tactical = false;
    this._saved = null;
    this.homeYaw = 0;
    camera.fov = 32;
    camera.far = 1000;
    camera.updateProjectionMatrix();
    this._bind();
  }

  /** The controlling participant's home view: A looks from low rows toward B, B the reverse. */
  setHome(seat) {
    this.homeYaw = seat === 'B' ? Math.PI : 0;
    this.home();
  }

  home() {
    this.tactical = false;
    this.goal.yaw = this.homeYaw;
    this.goal.pitch = 56 * DEG;
    this.goal.distance = this.board.size * 1.55;
    // aim a little toward the viewer's home edge so the near rows and the home banks stay in frame
    this.goal.focus.copy(this.board.center).add(new THREE.Vector3(Math.sin(this.homeYaw), 0, Math.cos(this.homeYaw)).multiplyScalar(this.board.size * 0.07));
  }

  toggleTactical() {
    if (!this.tactical) {
      this._saved = { ...this.goal, focus: this.goal.focus.clone() };
      this.goal.pitch = 84 * DEG;
      this.goal.distance = this.board.size * 1.35;
      this.tactical = true;
    } else {
      Object.assign(this.goal, this._saved, { focus: this._saved.focus.clone() });
      this.tactical = false;
    }
  }

  rotate(stepDeg) { this.goal.yaw += stepDeg * DEG; }
  tilt(stepDeg) { this.goal.pitch = Math.min(86 * DEG, Math.max(18 * DEG, this.goal.pitch + stepDeg * DEG)); }
  zoom(factor) { this.goal.distance = Math.min(this.board.size * 2.6, Math.max(this.board.size * 0.18, this.goal.distance * factor)); }
  focusOn(v) { this.goal.focus.set(v.x, 0, v.z); this.goal.distance = Math.min(this.goal.distance, this.board.size * 0.55); }

  /** Pan in screen directions (world units scaled by distance). */
  pan(dx, dy) {
    const s = this.distance * 0.0016;
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.goal.focus.addScaledVector(right, -dx * s).addScaledVector(fwd, dy * s);
    const h = this.board.size * 0.7;
    this.goal.focus.x = Math.min(this.board.center.x + h, Math.max(this.board.center.x - h, this.goal.focus.x));
    this.goal.focus.z = Math.min(this.board.center.z + h, Math.max(this.board.center.z - h, this.goal.focus.z));
  }

  /** Compass bearing of the view (degrees, 0 = looking from A's home edge toward B). */
  get bearing() { return ((this.yaw / DEG) % 360 + 360) % 360; }

  update(dt, keys) {
    const panSpeed = 520 * dt;
    if (keys.has('KeyW')) this.pan(0, panSpeed);
    if (keys.has('KeyS')) this.pan(0, -panSpeed);
    if (keys.has('KeyA')) this.pan(-panSpeed, 0);
    if (keys.has('KeyD')) this.pan(panSpeed, 0);
    this.yaw = dampAngle(this.yaw, this.goal.yaw, 9, dt);
    this.pitch = damp(this.pitch, this.goal.pitch, 9, dt);
    this.distance = damp(this.distance, this.goal.distance, 8, dt);
    this.focus.x = damp(this.focus.x, this.goal.focus.x, 8, dt);
    this.focus.z = damp(this.focus.z, this.goal.focus.z, 8, dt);
    const c = this.camera;
    const r = this.distance * Math.cos(this.pitch);
    c.position.set(this.focus.x + Math.sin(this.yaw) * r, this.distance * Math.sin(this.pitch), this.focus.z + Math.cos(this.yaw) * r);
    c.lookAt(this.focus);
    globalUniforms.uCameraYaw.value = this.yaw;
    globalUniforms.uCameraPosition?.value?.copy?.(c.position);
  }

  _bind() {
    let drag = null;
    this.el.addEventListener('pointerdown', (e) => {
      if (e.button !== 1) return;
      e.preventDefault();
      drag = { x: e.clientX, y: e.clientY, pan: e.shiftKey };
      this.el.setPointerCapture(e.pointerId);
    });
    this.el.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
      if (drag.pan) this.pan(dx, -dy);
      else { this.goal.yaw -= dx * 0.006; this.goal.pitch = Math.min(86 * DEG, Math.max(18 * DEG, this.goal.pitch + dy * 0.004)); }
    });
    const end = (e) => { if (drag) { drag = null; try { this.el.releasePointerCapture(e.pointerId); } catch {} } };
    this.el.addEventListener('pointerup', end);
    this.el.addEventListener('pointercancel', end);
    this.el.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
  }
}
