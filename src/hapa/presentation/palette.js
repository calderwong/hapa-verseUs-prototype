/**
 * Visual tokens and identity emblems (Design Companion v1 ch.5 "Color and visual vocabulary").
 * Base: slate #17212D, ivory #F5F0E3, secondary slate #9AA8B2. Each identity hue is paired with
 * its written name and an emblem — wave Blue, flame Red, leaf Green, doubled chevron Orange, ray
 * cluster Yellow, branching Purple, crescent Black (ivory rim), four-point star White (dark rim),
 * and an eight-segment Rainbow with a neutral center. Suits are separate marks.
 */
export const INK = { slate: '#17212D', slate2: '#223040', slate3: '#2E3E50', ivory: '#F5F0E3', mist: '#9AA8B2', brass: '#C9A65E', ink: '#0D131B' };
export const HUE = {
  blue: '#58B8F0', red: '#EF6A5B', green: '#71BE83', orange: '#E6A05D', yellow: '#E7D26A',
  purple: '#AA8DE1', black: '#40394B', white: '#F3E9D2', rainbow: '#C9B8E8',
};
export const OWNER = { A: '#7FB2E8', B: '#E8857A' }; // crests also differ by bracket shape
export const COLOR_NAME = { blue: 'Blue', red: 'Red', green: 'Green', orange: 'Orange', yellow: 'Yellow', purple: 'Purple', black: 'Black', white: 'White', rainbow: 'Rainbow' };
export const SUIT_GLYPH = { wands: '♣', pentacles: '✪', cups: '♥', swords: '♠', wildcard: '✱' };
export const SUIT_NAME = { wands: 'Wands', pentacles: 'Pentacles', cups: 'Cups', swords: 'Swords', wildcard: 'Wildcard' };
const RAINBOW_SEGMENTS = ['#EF6A5B', '#E6A05D', '#E7D26A', '#71BE83', '#58B8F0', '#AA8DE1', '#40394B', '#F3E9D2'];

/** The rim a hue needs to stay visible (Black on slate, White on ivory). */
export const rimFor = (color) => (color === 'black' ? INK.ivory : color === 'white' ? INK.ink : 'rgba(13,19,27,0.85)');

/**
 * Draw a color emblem centered at (x, y) with radius r on a 2D canvas context: a filled disc in
 * the hue, its rim, and the glyph in contrasting ink.
 */
export function drawEmblem(g, color, x, y, r) {
  g.save();
  g.translate(x, y);
  if (color === 'rainbow') {
    for (let i = 0; i < 8; i++) {
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, (i / 8) * Math.PI * 2 - Math.PI / 2, ((i + 1) / 8) * Math.PI * 2 - Math.PI / 2); g.closePath();
      g.fillStyle = RAINBOW_SEGMENTS[i]; g.fill();
    }
    g.beginPath(); g.arc(0, 0, r * 0.42, 0, Math.PI * 2); g.fillStyle = INK.mist; g.fill();
  } else {
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fillStyle = HUE[color] ?? INK.mist; g.fill();
  }
  g.lineWidth = Math.max(1, r * 0.16); g.strokeStyle = rimFor(color);
  g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke();
  const ink = color === 'black' ? INK.ivory : INK.ink;
  g.strokeStyle = ink; g.fillStyle = ink; g.lineCap = 'round'; g.lineJoin = 'round';
  g.lineWidth = Math.max(1, r * 0.15);
  const s = r * 0.55;
  g.beginPath();
  switch (color) {
    case 'blue': // wave
      g.moveTo(-s, s * 0.15); g.bezierCurveTo(-s * 0.5, -s * 0.55, 0, s * 0.6, s * 0.15, -s * 0.05); g.bezierCurveTo(s * 0.35, -s * 0.5, s * 0.7, -s * 0.2, s, s * 0.1); g.stroke(); break;
    case 'red': // flame
      g.moveTo(0, -s * 1.05); g.bezierCurveTo(s * 0.9, -s * 0.2, s * 0.7, s * 0.9, 0, s * 0.9); g.bezierCurveTo(-s * 0.7, s * 0.9, -s * 0.8, 0, -s * 0.2, -s * 0.25); g.bezierCurveTo(-s * 0.1, s * 0.1, s * 0.15, -s * 0.4, 0, -s * 1.05); g.fill(); break;
    case 'green': // leaf
      g.moveTo(-s * 0.85, s * 0.85); g.quadraticCurveTo(-s * 0.9, -s * 0.8, s * 0.85, -s * 0.85); g.quadraticCurveTo(s * 0.8, s * 0.8, -s * 0.85, s * 0.85); g.fill();
      g.strokeStyle = HUE.green; g.beginPath(); g.moveTo(-s * 0.6, s * 0.6); g.lineTo(s * 0.5, -s * 0.5); g.stroke(); break;
    case 'orange': // doubled chevron
      for (const dy of [-0.35, 0.35]) { g.moveTo(-s * 0.7, s * (dy + 0.3)); g.lineTo(0, s * (dy - 0.3)); g.lineTo(s * 0.7, s * (dy + 0.3)); }
      g.stroke(); break;
    case 'yellow': // ray cluster
      g.arc(0, 0, s * 0.32, 0, Math.PI * 2); g.fill();
      g.beginPath();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.moveTo(Math.cos(a) * s * 0.55, Math.sin(a) * s * 0.55); g.lineTo(Math.cos(a) * s * 0.95, Math.sin(a) * s * 0.95); }
      g.stroke(); break;
    case 'purple': // branching arrangement
      g.moveTo(0, s * 0.9); g.lineTo(0, -s * 0.1); g.lineTo(-s * 0.65, -s * 0.75); g.moveTo(0, -s * 0.1); g.lineTo(s * 0.65, -s * 0.75); g.moveTo(0, s * 0.35); g.lineTo(s * 0.55, -s * 0.05); g.stroke();
      for (const [px, py] of [[-s * 0.65, -s * 0.75], [s * 0.65, -s * 0.75], [s * 0.55, -s * 0.05]]) { g.beginPath(); g.arc(px, py, s * 0.16, 0, Math.PI * 2); g.fill(); }
      break;
    case 'black': // crescent
      g.arc(0, 0, s * 0.85, 0, Math.PI * 2); g.fill();
      g.globalCompositeOperation = 'destination-out';
      g.beginPath(); g.arc(s * 0.38, -s * 0.2, s * 0.72, 0, Math.PI * 2); g.fill();
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = HUE.black; g.beginPath(); g.arc(s * 0.38, -s * 0.2, s * 0.72, 0, Math.PI * 2); g.fill();
      break;
    case 'white': // four-point star
      g.moveTo(0, -s); g.lineTo(s * 0.22, -s * 0.22); g.lineTo(s, 0); g.lineTo(s * 0.22, s * 0.22); g.lineTo(0, s); g.lineTo(-s * 0.22, s * 0.22); g.lineTo(-s, 0); g.lineTo(-s * 0.22, -s * 0.22); g.closePath(); g.fill(); break;
    default: break;
  }
  g.restore();
}

const cache = new Map();
/** A data URL of an emblem for HTML chips (cached per color and size). */
export function emblemURL(color, size = 28) {
  const key = `${color}:${size}`;
  if (!cache.has(key)) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size * 2;
    drawEmblem(cv.getContext('2d'), color, size, size, size * 0.9);
    cache.set(key, cv.toDataURL());
  }
  return cache.get(key);
}

/** A seeded generator for repeatable brush clusters (presentation only; never the rules RNG). */
export function brushRng(seed) {
  let x = seed >>> 0 || 0x9e3779b9;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}
