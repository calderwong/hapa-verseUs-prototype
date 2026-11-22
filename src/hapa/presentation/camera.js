/**
 * Board camera (Design Companion v1, Chapters 4 and 10): full orbit around a stable pivot, a
 * dependable home view per seat, a near-overhead tactical view (V), 45° yaw steps (Q/E), 15° pitch
 * steps (Z/X), WASD / arrow-key pan, left-drag pan, right-drag (or middle-drag) orbit and tilt,
 * wheel or pinch zoom toward the cursor. A drag never becomes a click (the app asks
 * `wasDrag()`). Viewing never changes territory identities, formation facing or any rule.
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
  /** Zoom by `factor`; with a ground point, keep that point under the cursor (zoom toward it). */
  zoom(factor, toward = null) {
    const before = this.goal.distance;
    this.goal.distance = Math.min(this.board.size * 2.6, Math.max(this.board.size * 0.1, before * factor));
    const k = this.goal.distance / before;
    if (toward && k !== 1) {
      this.goal.focus.x = toward.x + (this.goal.focus.x - toward.x) * k;
      this.goal.focus.z = toward.z + (this.goal.focus.z - toward.z) * k;
      this._clampFocus();
    }
  }
  _clampFocus() {
    const h = this.board.size * 0.8;
    this.goal.focus.x = Math.min(this.board.center.x + h, Math.max(this.board.center.x - h, this.goal.focus.x));
    this.goal.focus.z = Math.min(this.board.center.z + h, Math.max(this.board.center.z - h, this.goal.focus.z));
  }
  /** Orbit by screen drag pixels: horizontal turns the view, vertical tilts it. */
  orbit(dx, dy) { this.goal.yaw -= dx * 0.006; this.goal.pitch = Math.min(86 * DEG, Math.max(18 * DEG, this.goal.pitch + dy * 0.004)); }
  /** Did the last pointer gesture move far enough to count as a camera drag (not a click)? */
  wasDrag() { return this._moved > 5; }
  /** Focus a world point at its own height (a flyer, a hilltop or a tunnel floor), closing in if far. */
  focusOn(v) { this.goal.focus.set(v.x, v.y ?? 0, v.z); this.goal.distance = Math.min(this.goal.distance, this.board.size * 0.55); }

  /** Pan in screen directions (world units scaled by distance). */
  pan(dx, dy) {
    // scale by the view: a pixel of drag moves about one pixel of ground at the focus
    const viewH = this.el.clientHeight || 600;
    const s = (2 * this.distance * Math.tan((this.camera.fov * DEG) / 2)) / viewH;
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.goal.focus.addScaledVector(right, -dx * s).addScaledVector(fwd, (dy * s) / Math.max(0.35, Math.sin(this.pitch)));
    this._clampFocus();
  }

  /** Compass bearing of the view (degrees, 0 = looking from A's home edge toward B). */
  get bearing() { return ((this.yaw / DEG) % 360 + 360) % 360; }

  update(dt, keys) {
    const panSpeed = 620 * dt;
    if (keys.has('KeyW') || keys.has('ArrowUp')) this.pan(0, panSpeed);
    if (keys.has('KeyS') || keys.has('ArrowDown')) this.pan(0, -panSpeed);
    if (keys.has('KeyA') || keys.has('ArrowLeft')) this.pan(panSpeed, 0);
    if (keys.has('KeyD') || keys.has('ArrowRight')) this.pan(-panSpeed, 0);
    if (this.held) this.held(dt);
    this.yaw = dampAngle(this.yaw, this.goal.yaw, 9, dt);
    this.pitch = damp(this.pitch, this.goal.pitch, 9, dt);
    this.distance = damp(this.distance, this.goal.distance, 8, dt);
    this.focus.x = damp(this.focus.x, this.goal.focus.x, 8, dt);
    this.focus.z = damp(this.focus.z, this.goal.focus.z, 8, dt);
    this.focus.y = damp(this.focus.y, this.goal.focus.y, 8, dt);
    const c = this.camera;
    const r = this.distance * Math.cos(this.pitch);
    c.position.set(this.focus.x + Math.sin(this.yaw) * r, this.focus.y + this.distance * Math.sin(this.pitch), this.focus.z + Math.cos(this.yaw) * r);
    c.lookAt(this.focus);
    globalUniforms.uCameraYaw.value = this.yaw;
    globalUniforms.uCameraPosition?.value?.copy?.(c.position);
  }

  /** Remove this camera's input listeners (a new match creates a new camera). */
  dispose() { this._abort?.abort(); }

  _bind() {
    this._abort = new AbortController();
    const signal = this._abort.signal;
    let drag = null;
    this._moved = 0;
    this.dragging = false;
    this.el.addEventListener('pointerdown', (e) => {
      if (e.target.closest?.('button, .layer-rail, .cam-pad')) return; // on-screen controls are not drags
      if (e.button === 1) e.preventDefault();
      // left = pan (Alt: orbit); right or middle = orbit and tilt (Shift+middle: pan)
      const mode = e.button === 0 ? (e.altKey ? 'orbit' : 'pan') : e.button === 2 ? 'orbit' : e.shiftKey ? 'pan' : 'orbit';
      drag = { x: e.clientX, y: e.clientY, mode, id: e.pointerId, captured: false };
      this._moved = 0;
    }, { signal });
    this.el.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
      this._moved += Math.abs(dx) + Math.abs(dy);
      if (this._moved <= 5) return; // still a click
      if (!drag.captured) { try { this.el.setPointerCapture(e.pointerId); } catch {} drag.captured = true; this.dragging = true; this.el.classList.add(drag.mode === 'pan' ? 'cam-panning' : 'cam-orbiting'); }
      if (drag.mode === 'pan') this.pan(dx, dy);
      else this.orbit(dx, dy);
    }, { signal });
    const end = (e) => {
      if (!drag) return;
      if (drag.captured) { try { this.el.releasePointerCapture(e.pointerId); } catch {} }
      drag = null;
      this.el.classList.remove('cam-panning', 'cam-orbiting');
      setTimeout(() => { this.dragging = false; }, 0); // let the app's pointerup see the drag first
    };
    this.el.addEventListener('pointerup', end, { signal });
    this.el.addEventListener('pointercancel', end, { signal });
    this.el.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.shiftKey) { this.tilt(-Math.sign(e.deltaY) * 5); return; }
      // pinch (ctrl+wheel on trackpads) is finer; zoom toward the ground under the cursor
      const f = Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      this.zoom(f, this.groundAt?.(e.clientX, e.clientY) ?? null);
    }, { passive: false, signal });
  }
}
