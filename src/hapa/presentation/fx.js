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

  update(dt) {
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
      if (!still) {
        const s = 0.6 + Math.min(1, k * 4) * 0.7;
        it.mark.scale.set(s, s, 1);
        if (it.label) it.label.position.y = it.base.y + 2.1 + k * 0.8;
      } else it.mark.scale.set(1.1, 1.1, 1);
    }
  }
}
