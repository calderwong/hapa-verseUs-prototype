/**
 * Readable held gear for battlefield members (presentation only). Luminati's stock `sword` sheathes
 * the blade at the hip outside combat poses and has no shield, so at tactical distance a Swordsman
 * with Shield showed neither. This paints the archetype's actual equipment — a drawn sword in the
 * right hand, a heater shield in the owner's colors on the left arm — as pixel billboards
 * placed by the member's world facing, so the shield stays on the formation's left whatever the
 * camera does (Design Companion: gear keeps its anatomical side under orbit). Driven by catalog
 * data: a `sword` melee attack shows the sword, a `shield` protection shows the shield.
 */
import * as THREE from 'three';
import { shared } from './resources.js';
import { PPU } from '../../../vendor/lumina/src/engine/constants.js';

const OUT = '#0D131B';
const FIELD = { A: ['#3D6DB4', '#2C4F86', '#7FB2E8'], B: ['#B44A3D', '#862C2C', '#E8857A'] };

function pixelTexture(w, h, paint) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  paint((x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); }, g);
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A 12 × 14 heater shield: dark outline, steel rim, owner field with a sheen, an ivory cross and boss. */
function shieldTexture(owner) {
  const [field, shade, light] = FIELD[owner];
  return pixelTexture(12, 14, (put) => {
    // the heater outline: full width for 8 rows, then tapering to a point
    const half = (y) => (y < 8 ? 6 : Math.max(0, 6 - Math.ceil((y - 7) * 1.1)));
    for (let y = 0; y < 14; y++) {
      const hw = half(y);
      for (let x = 6 - hw; x < 6 + hw; x++) {
        const edge = x === 6 - hw || x === 5 + hw || y === 0 || half(y + 1) < hw - 0 && (x <= 6 - hw + 0 || x >= 5 + hw - 0) || y === 13;
        put(x, y, edge ? OUT : x === 6 - hw + 1 || x === 4 + hw || y === 1 ? '#C9CED6' : x < 5 ? light : x > 7 ? shade : field);
      }
    }
    for (let y = 3; y < 11; y++) put(6, y, '#F5F0E3'); // the cross
    for (let x = 3; x < 9; x++) put(x, 5, '#F5F0E3');
    put(6, 5, '#C9A65E'); put(5, 5, '#E3CB8E'); // the boss
  });
}

/** A 9 × 22 drawn sword, point up: a 3-pixel steel blade with a fuller and an ink outline, a broad gold guard, grip, pommel. */
function swordTexture() {
  return pixelTexture(9, 22, (put) => {
    put(4, 0, OUT); put(3, 1, OUT); put(5, 1, OUT); put(4, 1, '#FFFFFF');
    for (let y = 2; y < 14; y++) {
      put(2, y, OUT); put(6, y, OUT);
      put(3, y, '#F2F5F8'); put(4, y, y > 3 ? '#9AA6B4' : '#FFFFFF'); put(5, y, '#C9D1DB'); // edge, fuller, shade
    }
    for (let x = 0; x < 9; x++) { put(x, 14, OUT); put(x, 16, OUT); put(x, 15, x === 0 || x === 8 ? OUT : x === 4 ? '#E3CB8E' : '#C9A65E'); }
    for (let y = 17; y < 20; y++) { put(3, y, OUT); put(4, y, y % 2 ? '#7A5536' : '#5A3E28'); put(5, y, OUT); }
    put(3, 20, OUT); put(4, 20, '#E3CB8E'); put(5, 20, OUT); put(4, 21, OUT);
  });
}

const cache = new Map();
const tex = (key, make) => { if (!cache.has(key)) cache.set(key, shared(make())); return cache.get(key); };

const GEAR_SCALE = 1.25; // a little larger than the body's pixels so the gear reads at tactical distance
function billboard(texture, wPx, hPx) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: 0.5 }));
  s.scale.set((wPx / PPU) * GEAR_SCALE, (hPx / PPU) * GEAR_SCALE, 1);
  s.center.set(0.5, 0); // anchored at its lower edge
  return s;
}

/** What gear an archetype shows, from its catalog data. */
export function gearOf(arch) {
  return {
    sword: (arch?.attacks ?? []).some((a) => a.id === 'sword'),
    shield: (arch?.protections ?? []).some((p) => p.id === 'shield'),
  };
}

/** Add the gear billboards to a member's Sprite3D group (once). */
export function attachGear(spr, arch, owner) {
  const g = gearOf(arch);
  if (!g.sword && !g.shield) return null;
  const parts = {};
  if (g.shield) { parts.shield = billboard(tex(`shield:${owner}`, () => shieldTexture(owner)), 12, 14); spr.add(parts.shield); }
  if (g.sword) { parts.sword = billboard(tex('sword', swordTexture), 9, 22); spr.add(parts.sword); }
  return parts;
}

/**
 * Place the gear by the member's world facing: the shield on its left side a little forward, the
 * sword in its right hand. `front` and `right` are unit vectors in world X/Z.
 */
export function placeGear(parts, front, right, visible) {
  if (!parts) return;
  if (parts.shield) {
    parts.shield.position.set(-right.x * 0.44 + front.x * 0.3, 0.28, -right.z * 0.44 + front.z * 0.3);
    parts.shield.visible = visible;
  }
  if (parts.sword) {
    parts.sword.position.set(right.x * 0.5 + front.x * 0.22, 0.42, right.z * 0.5 + front.z * 0.22);
    parts.sword.visible = visible;
  }
}
