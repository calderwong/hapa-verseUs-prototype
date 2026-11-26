/**
 * Hit effects during playback (Design Companion v1 ch.5 "Physical attacks use compact solid impact
 * marks, angular trails and material contact. Magic attacks use an open rune, stepped rings and an
 * effect-shaped trail. Above and Below receive explicit vertical arrows"). Each mark is driven by a
 * resolved hit record — it never invents a hit, range or extra damage — and fades quickly. With
 * reduced motion the marks appear without travel or scaling. Presentation only.
 */
import * as THREE from 'three';
import { HUE, INK } from './palette.js';

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function canvasTex(size, draw) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  draw(cv.getContext('2d'), size);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const BURST = () => canvasTex(128, (g, n) => { // compact solid impact: an angular star with an ink edge
  g.translate(n / 2, n / 2); g.beginPath();
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2, r = i % 2 ? 22 : 52 - (i % 4) * 6; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  g.closePath(); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 6; g.strokeStyle = 'rgba(13,19,27,0.9)'; g.stroke();
});
const RUNE = () => canvasTex(128, (g, n) => { // open rune: stepped rings and ticks, hollow center
  g.translate(n / 2, n / 2); g.strokeStyle = '#ffffff'; g.lineCap = 'round';
  g.lineWidth = 6; g.beginPath(); g.arc(0, 0, 50, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 32, 0.3, Math.PI * 2 - 0.3); g.stroke();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * 38, Math.sin(a) * 38); g.lineTo(Math.cos(a) * 46, Math.sin(a) * 46); g.stroke(); }
});
const ARROW = () => canvasTex(64, (g) => { // an explicit downward arrow for hits from Above
  g.fillStyle = '#ffffff'; g.strokeStyle = 'rgba(13,19,27,0.9)'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(24, 4); g.lineTo(40, 4); g.lineTo(40, 36); g.lineTo(54, 36); g.lineTo(32, 60); g.lineTo(10, 36); g.lineTo(24, 36); g.closePath(); g.fill(); g.stroke();
});

function numberSprite(text, color) {
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = '800 40px system-ui, sans-serif';
  const w = Math.ceil(probe.measureText(text).width) + 24;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = 64;
  const g = cv.getContext('2d');
  g.font = '800 40px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 8; g.strokeStyle = INK.ink; g.strokeText(text, w / 2, 32);
  g.fillStyle = color; g.fillText(text, w / 2, 32);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, toneMapped: false }));
  s.scale.set(0.65 * (w / 64), 0.65, 1); s.renderOrder = 12;
  return s;
}

export class HitFX {
  /** @param {THREE.Object3D} root */
  constructor(root) {
    this.group = new THREE.Group(); this.group.name = 'fx';
    root.add(this.group);
    this.items = [];
    this.tex = { burst: BURST(), rune: RUNE(), arrow: ARROW() };
  }

  /**
   * One resolved hit. `from` and `to` are world positions (THREE.Vector3) of the source and the
   * recipient; `color` is the identity color of the attack's source (a member's or a Card's).
   * @param {{ channel: string, face: string, damage: number, protection: number }} hit
   */
  hit(hit, from, to, color, U, { index = 0, total = null } = {}) {
    const magic = hit.channel === 'magic';
    const tint = new THREE.Color(HUE[color] ?? (magic ? HUE.purple : INK.ivory));
    const mat = new THREE.SpriteMaterial({ map: magic ? this.tex.rune : this.tex.burst, color: tint, transparent: true, depthTest: false, toneMapped: false });
    const mark = new THREE.Sprite(mat); mark.renderOrder = 11;
    // fan several hits on one recipient so each separate hit stays countable
    const ang = index * 2.4;
    mark.position.copy(to).add(new THREE.Vector3(Math.cos(ang) * 0.28 * Math.min(index, 1), 1.1 + index * 0.12, Math.sin(ang) * 0.28 * Math.min(index, 1)));
    this.group.add(mark);
    const parts = [mark];
    // the trail: angular (straight, solid) for Physical, open (dashed) for Magic; Above arrives vertically
    if (hit.face === 'above' || hit.face === 'below') {
      const arrow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.arrow, color: tint, transparent: true, depthTest: false, toneMapped: false }));
      arrow.position.copy(to).add(new THREE.Vector3(0, hit.face === 'above' ? 2.6 : 0.2, 0));
      if (hit.face === 'below') arrow.material.rotation = Math.PI;
      arrow.scale.set(0.7, 0.7, 1); arrow.renderOrder = 11;
      this.group.add(arrow); parts.push(arrow);
    } else if (from) {
      const pts = [from.clone().add(new THREE.Vector3(0, 1.0, 0)), to.clone().add(new THREE.Vector3(0, 1.0, 0))];
      const lm = magic ? new THREE.LineDashedMaterial({ color: tint, dashSize: 0.25, gapSize: 0.15, transparent: true, depthTest: false }) : new THREE.LineBasicMaterial({ color: tint, transparent: true, depthTest: false });
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lm);
      if (magic) line.computeLineDistances();
      line.renderOrder = 10;
      this.group.add(line); parts.push(line);
    }
    // one number per recipient per exchange: the total and the hit count
    let label = null;
    if (total) {
      const dmg = total.damage / U;
      label = numberSprite(dmg > 0 ? `−${+dmg.toFixed(2)}${total.hits > 1 ? ` ×${total.hits}` : ''}` : `blocked${total.hits > 1 ? ` ×${total.hits}` : ''}`, dmg > 0 ? '#FFE3D6' : '#C8D2DA');
      label.position.copy(to).add(new THREE.Vector3(0, 2.1, 0));
      this.group.add(label); parts.push(label);
    }
    this.items.push({ parts, t: 0, life: reduced() ? 0.9 : 0.75, base: to.clone(), label, mark });
  }

  /**
   * Supply delivered (planned) to a formation: an expanding brass ring on the ground, sparks rising
   * from the drop point and a "+n Supply" callout. `at` is the formation's world position.
   */
  /**
   * A planned (not yet resolved) Supply or other reserved use: a dashed ring that settles in place
   * and a mint "+n planned" tag — no sparks, no rise, no coin. The resolved event keeps the brass
   * burst (`supply`), so completion is celebrated once, when it happens (review UX-09).
   */
  planned(at, text) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.12, 40, 1), new THREE.MeshBasicMaterial({ color: 0x8FD3A0, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    // dashed: drop alternate segments of the ring
    const idx = ring.geometry.index.array, keep = [];
    for (let i = 0; i < idx.length; i += 6) if ((i / 6) % 4 < 2) keep.push(...idx.slice(i, i + 6));
    ring.geometry.setIndex(keep);
    ring.rotation.x = -Math.PI / 2; ring.position.copy(at).add(new THREE.Vector3(0, 0.09, 0)); ring.renderOrder = 8;
    this.group.add(ring);
    const label = numberSprite(text, '#8FD3A0');
    label.position.copy(at).add(new THREE.Vector3(0, 2.0, 0));
    this.group.add(label);
    this.items.push({ parts: [ring, label], t: 0, life: 1.1, base: at.clone(), label, mark: null, ring, sparks: [], kind: 'planned' });
  }

  supply(at, text) {
    const still = reduced();
    const parts = [];
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 48), new THREE.MeshBasicMaterial({ color: 0xE3CB8E, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.copy(at).add(new THREE.Vector3(0, 0.08, 0)); ring.renderOrder = 8;
    this.group.add(ring); parts.push(ring);
    const sparks = [];
    if (!still) for (let i = 0; i < 14; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.burst, color: i % 3 ? 0xE3CB8E : 0xF5F0E3, transparent: true, depthTest: false, toneMapped: false }));
      sp.scale.set(0.28, 0.28, 1); sp.renderOrder = 11;
      const a = (i / 14) * Math.PI * 2;
      sp.position.copy(at).add(new THREE.Vector3(0, 0.4, 0));
      sp.userData.v = new THREE.Vector3(Math.cos(a) * (1.2 + (i % 4) * 0.35), 3.2 + (i % 5) * 0.5, Math.sin(a) * (1.2 + (i % 4) * 0.35));
      this.group.add(sp); parts.push(sp); sparks.push(sp);
    }
    const label = numberSprite(text, '#F2DFA6');
    label.position.copy(at).add(new THREE.Vector3(0, 2.4, 0));
    this.group.add(label); parts.push(label);
    this.items.push({ parts, t: 0, life: still ? 1.0 : 1.3, base: at.clone(), label, mark: null, ring, sparks, kind: 'supply' });
  }

  // --- signature sequences (VA-08): pending → accepted/countered → settled ----------------------
  /**
   * A Spell waiting on the stack: a quiet, steady rune at its exact target (no flashing) that stays
   * until the Spell is countered or resolves. Keyed by stack id.
   */
  pending(stackId, at, color = 0xd96b4a) {
    this.settlePending(stackId, 'replaced');
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.copy(at).add(new THREE.Vector3(0, 0.1, 0)); ring.renderOrder = 8;
    const rune = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.rune, color, transparent: true, opacity: 0.9, depthTest: false, toneMapped: false }));
    rune.scale.set(0.9, 0.9, 1); rune.position.copy(at).add(new THREE.Vector3(0, 1.9, 0)); rune.renderOrder = 11;
    this.group.add(ring, rune);
    (this.pendingSpells ??= new Map()).set(stackId, { parts: [ring, rune], ring, rune });
  }

  /** End a pending Spell: `countered` collapses it inward; anything else clears it (its impact shows separately). */
  settlePending(stackId, how) {
    const p = this.pendingSpells?.get(stackId);
    if (!p) return;
    this.pendingSpells.delete(stackId);
    if (how === 'countered') { this.items.push({ parts: p.parts, t: 0, life: reduced() ? 0.5 : 0.6, base: p.ring.position.clone(), label: null, mark: null, ring: p.ring, rune: p.rune, kind: 'collapse' }); return; }
    for (const part of p.parts) { this.group.remove(part); part.material.dispose(); if (part.geometry && !(part instanceof THREE.Sprite)) part.geometry.dispose(); }
  }

  /** Accepted absorption: members settle into the combined formation (a short inward ring and the new count). */
  absorbed(at, text) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.3, 48), new THREE.MeshBasicMaterial({ color: 0xf5f0e3, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.copy(at).add(new THREE.Vector3(0, 0.08, 0)); ring.renderOrder = 8;
    const label = numberSprite(text, '#F5F0E3');
    label.position.copy(at).add(new THREE.Vector3(0, 2.3, 0));
    this.group.add(ring, label);
    this.items.push({ parts: [ring, label], t: 0, life: reduced() ? 0.9 : 1.1, base: at.clone(), label, mark: null, ring, kind: 'absorb' });
  }

  /** Accepted excavation/fill: a short fracture and settle at the changed territory; debris never collides. */
  terrain(at, dig) {
    const still = reduced();
    const parts = [], chips = [];
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.6, 6), new THREE.MeshBasicMaterial({ color: dig ? 0x8a6a4a : 0xb59a72, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.copy(at).add(new THREE.Vector3(0, 0.06, 0)); ring.renderOrder = 8;
    this.group.add(ring); parts.push(ring);
    if (!still) for (let i = 0; i < 10; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.burst, color: i % 2 ? 0x8a6a4a : 0xcbb48c, transparent: true, depthTest: false, toneMapped: false }));
      sp.scale.set(0.22, 0.22, 1); sp.renderOrder = 10;
      const a = (i / 10) * Math.PI * 2;
      sp.position.copy(at).add(new THREE.Vector3(0, 0.2, 0));
      sp.userData.v = new THREE.Vector3(Math.cos(a) * 1.4, dig ? 3.4 : 1.6, Math.sin(a) * 1.4);
      this.group.add(sp); parts.push(sp); chips.push(sp);
    }
    this.items.push({ parts, t: 0, life: still ? 0.45 : 0.45, base: at.clone(), label: null, mark: null, ring, sparks: chips, kind: 'terrain' });
  }

  /**
   * Release everything this helper owns, once (R14-02): the parts of effects still running and the
   * three textures it painted for reuse during the match. Those textures stay owned here even after
   * every sprite that used them has expired and left the scene, so scene traversal alone cannot
   * find them. Nothing shared is touched (three's Sprite quad is never disposed).
   * @returns {{ items: number, textures: number } | null} null when already disposed
   */
  dispose() {
    if (this.disposed) return null;
    this.disposed = true;
    const items = this.items.length;
    for (const it of this.items) for (const p of it.parts) { p.material.dispose(); if (p.geometry && !(p instanceof THREE.Sprite)) p.geometry.dispose(); if (p === it.label) p.material.map?.dispose(); }
    this.items = [];
    for (const id of [...(this.pendingSpells?.keys() ?? [])]) this.settlePending(id, 'disposed');
    const tex = Object.values(this.tex);
    for (const t of tex) t.dispose();
    this.tex = {};
    this.group.parent?.remove(this.group);
    return { items, textures: tex.length };
  }

  update(dt) {
    if (this.disposed) return;
    const still = reduced();
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      const k = it.t / it.life;
      if (k >= 1) {
        for (const p of it.parts) { this.group.remove(p); p.material.dispose(); if (p.geometry && !(p instanceof THREE.Sprite)) p.geometry.dispose(); if (p === it.label) p.material.map.dispose(); }
        this.items.splice(i, 1);
        continue;
      }
      const fade = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      for (const p of it.parts) p.material.opacity = fade;
      if (it.kind === 'planned') {
        const r = still ? 1.7 : 2.3 - Math.min(1, k * 2.5) * 0.6; // closes in once, then holds
        it.ring.scale.set(r, r, r);
        it.ring.rotation.z = still ? 0 : k * 0.6;
        continue;
      }
      if (it.kind === 'collapse') { const r = Math.max(0.05, 1 - k); it.ring.scale.set(r, r, r); it.rune.scale.set(0.9 * r, 0.9 * r, 1); continue; }
      if (it.kind === 'absorb') { const r = still ? 1 : 1.6 - Math.min(1, k * 2) * 0.6; it.ring.scale.set(r, r, r); continue; }
      if (it.kind === 'terrain') { const r = 1 + (still ? 1 : Math.min(1, k * 3)) * 1.4; it.ring.scale.set(r, r, r); for (const sp of it.sparks) { sp.userData.v.y -= 12 * dt; sp.position.addScaledVector(sp.userData.v, dt); if (sp.position.y < it.base.y) sp.position.y = it.base.y; } continue; }
      if (it.kind === 'supply') {
        const r = 0.6 + (still ? 1.6 : Math.min(1, k * 1.6) * 2.2);
        it.ring.scale.set(r, r, r);
        it.ring.material.opacity = (1 - k) * 0.9;
        for (const sp of it.sparks) { sp.userData.v.y -= 7 * dt; sp.position.addScaledVector(sp.userData.v, dt); }
        if (it.label) it.label.position.y = it.base.y + 2.4 + (still ? 0 : k * 0.9);
        continue;
      }
      if (!still) {
        const s = 0.6 + Math.min(1, k * 4) * 0.7;
        it.mark.scale.set(s, s, 1);
        if (it.label) it.label.position.y = it.base.y + 2.1 + k * 0.8;
      } else it.mark.scale.set(1.1, 1.1, 1);
    }
  }
}
