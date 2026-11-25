/**
 * Chess identities and destination intent (human-feedback addendum 01 §5–6; review 04, R4-03).
 *
 * Each party carries one large movement standard drawn from authored vector glyphs (not a platform
 * symbol font): Rook/Castle, Knight, Bishop, King, Queen, a distinct Commander (crown and star) and
 * Pawn for unmounted parties. It is a visual standard anchored to the party's logical center — not
 * a member, not a collider, not a pick target. Ownership uses value and shape, never hue alone:
 * A is a solid ivory piece with a slate edge on one base bar, B a slate piece with an ivory edge on
 * two base bars (the board's single/double vocabulary).
 *
 * Semantic zoom: the standard dominates at overview distance, recedes at tactical distance and is
 * quiet at inspection distance, with hysteresis so orbit and zoom do not flicker.
 *
 * Destination intent: every public destination gets the same glyph in a hollow, dashed style at
 * its endpoint, with a status word (Planned / Travelling / Paused / Blocked / Unfunded). Several
 * parties aiming at one territory fan out with a count. Endpoints never enter rules occupancy.
 */
import * as THREE from 'three';
import { shared } from './resources.js';

const INK = { slate: '#17212D', ivory: '#F5F0E3', brass: '#C9A65E', a: '#7FB2E8', b: '#E8857A', bad: '#EF6A5B' };

/** Authored glyph outlines in a 100 × 120 box (base at y 108). */
const GLYPHS = {
  castle(g) { // rook: crenellated tower
    g.moveTo(22, 108); g.lineTo(78, 108); g.lineTo(74, 94); g.lineTo(68, 94); g.lineTo(66, 48); g.lineTo(76, 40);
    g.lineTo(76, 20); g.lineTo(65, 20); g.lineTo(65, 29); g.lineTo(56, 29); g.lineTo(56, 20); g.lineTo(44, 20); g.lineTo(44, 29);
    g.lineTo(35, 29); g.lineTo(35, 20); g.lineTo(24, 20); g.lineTo(24, 40); g.lineTo(34, 48); g.lineTo(32, 94); g.lineTo(26, 94); g.closePath();
  },
  knight(g) { // horse head
    g.moveTo(24, 108); g.lineTo(80, 108); g.lineTo(76, 94); g.lineTo(70, 94); g.bezierCurveTo(74, 70, 80, 50, 70, 32);
    g.bezierCurveTo(62, 18, 48, 12, 38, 14); g.lineTo(36, 6); g.lineTo(30, 18); g.bezierCurveTo(22, 26, 16, 40, 14, 54);
    g.bezierCurveTo(13, 62, 20, 66, 26, 60); g.lineTo(36, 52); g.bezierCurveTo(40, 58, 36, 70, 30, 80); g.lineTo(30, 94); g.lineTo(28, 94); g.closePath();
  },
  bishop(g) { // mitre with slit
    g.moveTo(24, 108); g.lineTo(76, 108); g.lineTo(72, 94); g.lineTo(62, 94); g.bezierCurveTo(74, 80, 74, 52, 58, 34);
    g.lineTo(50, 46); g.lineTo(54, 30); g.bezierCurveTo(52, 26, 50, 24, 50, 24); g.arc(50, 16, 7, Math.PI / 2, Math.PI / 2 + 2 * Math.PI);
    g.bezierCurveTo(34, 38, 26, 66, 38, 94); g.lineTo(28, 94); g.closePath();
  },
  king(g) { // crown with a cross
    g.moveTo(22, 108); g.lineTo(78, 108); g.lineTo(74, 94); g.lineTo(68, 94); g.lineTo(76, 50); g.lineTo(60, 44); g.lineTo(54, 34);
    g.lineTo(54, 26); g.lineTo(62, 26); g.lineTo(62, 18); g.lineTo(54, 18); g.lineTo(54, 8); g.lineTo(46, 8); g.lineTo(46, 18); g.lineTo(38, 18);
    g.lineTo(38, 26); g.lineTo(46, 26); g.lineTo(46, 34); g.lineTo(40, 44); g.lineTo(24, 50); g.lineTo(32, 94); g.lineTo(26, 94); g.closePath();
  },
  queen(g) { // five-pointed coronet
    g.moveTo(22, 108); g.lineTo(78, 108); g.lineTo(74, 94); g.lineTo(68, 94); g.lineTo(82, 30); g.lineTo(66, 52); g.lineTo(62, 22);
    g.lineTo(50, 48); g.lineTo(38, 22); g.lineTo(34, 52); g.lineTo(18, 30); g.lineTo(32, 94); g.lineTo(26, 94); g.closePath();
  },
  pawn(g) {
    g.moveTo(26, 108); g.lineTo(74, 108); g.lineTo(70, 96); g.lineTo(62, 96); g.bezierCurveTo(62, 78, 58, 66, 56, 58);
    g.arc(50, 42, 15, Math.PI * 0.3, Math.PI * 0.7 + 2 * Math.PI, false); g.bezierCurveTo(42, 66, 38, 78, 38, 96); g.lineTo(30, 96); g.closePath();
  },
};
GLYPHS.commander = (g) => { GLYPHS.king(g); };
const QUEEN_POINTS = [[82, 30], [62, 22], [38, 22], [18, 30]];

/** The authored outlines as SVG path data (DOM glyphs: member labels and the inspection bar). */
function svgPath(draw) {
  const out = [], f = (x, y) => `${x.toFixed(1)} ${y.toFixed(1)}`;
  const g = {
    moveTo: (x, y) => out.push(`M${f(x, y)}`),
    lineTo: (x, y) => out.push(`L${f(x, y)}`),
    bezierCurveTo: (a, b, c, d, x, y) => out.push(`C${f(a, b)} ${f(c, d)} ${f(x, y)}`),
    // canvas arc semantics: a span of 2π or more is the whole circle, ending where it started
    arc: (cx, cy, r, a0, a1, ccw = false) => {
      let span = ccw ? a0 - a1 : a1 - a0;
      if (span >= 2 * Math.PI) span = 2 * Math.PI; else span = ((span % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const dir = ccw ? -1 : 1, steps = Math.max(1, Math.ceil(span / (Math.PI / 2)));
      out.push(`L${f(cx + r * Math.cos(a0), cy + r * Math.sin(a0))}`);
      for (let i = 1; i <= steps; i++) { const a = a0 + dir * span * (i / steps); out.push(`A${r} ${r} 0 0 ${ccw ? 0 : 1} ${f(cx + r * Math.cos(a), cy + r * Math.sin(a))}`); }
    },
    closePath: () => out.push('Z'),
  };
  draw(g);
  return out.join(' ');
}
export const GLYPH_PATHS = Object.fromEntries(Object.keys(GLYPHS).map((k) => [k, svgPath(GLYPHS[k])]));

/** The movement family a party shows. */
export const pieceOf = (p) => (!p.mount ? 'pawn' : p.commander ? 'commander' : p.mount);
export const PIECE_NAME = { castle: 'Castle (Rook)', knight: 'Knight', bishop: 'Bishop', king: 'King', queen: 'Queen', commander: 'Commander', pawn: 'Pawn' };

/**
 * Paint a standard or an endpoint ghost on a canvas.
 * @param {'A'|'B'} owner @param {string} piece
 * @param {{ ghost?: boolean, status?: string|null, bad?: boolean, count?: number }} o
 */
export function paintPiece(owner, piece, o = {}) {
  const W = 128, H = o.status ? 196 : 150;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.save(); g.translate(14, 10);
  const draw = GLYPHS[piece] ?? GLYPHS.pawn;
  g.beginPath(); draw(g);
  const fill = owner === 'A' ? INK.ivory : INK.slate, edge = owner === 'A' ? INK.slate : INK.ivory;
  if (o.ghost) {
    g.setLineDash([9, 6]); g.lineWidth = 6; g.strokeStyle = o.bad ? INK.bad : edge === INK.ivory ? INK.ivory : INK.slate;
    g.fillStyle = owner === 'A' ? 'rgba(245,240,227,0.18)' : 'rgba(23,33,45,0.35)'; g.fill(); g.stroke();
    g.setLineDash([]); g.lineWidth = 2; g.strokeStyle = owner === 'A' ? INK.ivory : INK.slate; g.stroke();
  } else {
    g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 8; g.shadowOffsetY = 3;
    g.fillStyle = fill; g.fill();
    g.shadowColor = 'transparent'; g.lineWidth = owner === 'A' ? 5 : 3; g.strokeStyle = edge; g.stroke(); // B: a thin light edge so the dark body carries the value cue
  }
  if (piece === 'commander') { // a star on the crown: distinct from an ordinary King
    star(g, 50, 66, 13, o.ghost ? 'rgba(217,184,106,0.6)' : INK.brass, edge);
  }
  if (piece === 'queen' && !o.ghost) for (const [x, y] of QUEEN_POINTS) { g.beginPath(); g.arc(x, y, 4.5, 0, 2 * Math.PI); g.fillStyle = INK.brass; g.fill(); }
  // owner base bars: one for A, two for B (value, not hue)
  g.fillStyle = owner === 'A' ? INK.a : INK.b; g.strokeStyle = INK.slate; g.lineWidth = 2;
  for (let i = 0; i < (owner === 'A' ? 1 : 2); i++) { g.beginPath(); g.rect(20, 112 + i * 9, 60, 6); g.fill(); g.stroke(); }
  g.restore();
  if (o.count > 1) { g.fillStyle = INK.brass; g.beginPath(); g.arc(W - 18, 18, 15, 0, 2 * Math.PI); g.fill(); g.fillStyle = INK.slate; g.font = '800 18px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(`×${o.count}`, W - 18, 24); }
  if (o.status) {
    g.font = '800 24px system-ui, sans-serif'; g.textAlign = 'center';
    let fs = 24; while (g.measureText(o.status).width > W - 8 && fs > 14) { fs -= 1; g.font = `800 ${fs}px system-ui, sans-serif`; }
    const tw = Math.min(W, g.measureText(o.status).width + 12);
    g.fillStyle = o.bad ? 'rgba(90,30,25,0.94)' : 'rgba(23,33,45,0.92)'; g.beginPath(); g.roundRect((W - tw) / 2, H - 44, tw, 38, 8); g.fill();
    g.fillStyle = o.bad ? '#ffd0c8' : INK.ivory; g.fillText(o.status, W / 2, H - 17);
  }
  return cv;
}

function star(g, cx, cy, r, fill, edge) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; g[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  g.closePath(); g.fillStyle = fill; g.fill(); g.lineWidth = 2; g.strokeStyle = edge; g.stroke();
}

const textures = new Map();
/** A cached texture per owner / piece / ghost state (no per-frame canvas work). */
export function pieceTexture(owner, piece, o = {}) {
  const key = `${owner}:${piece}:${o.ghost ? 1 : 0}:${o.status ?? ''}:${o.bad ? 1 : 0}:${o.count ?? 1}`;
  let t = textures.get(key);
  if (!t) { t = new THREE.CanvasTexture(paintPiece(owner, piece, o)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; textures.set(key, shared(t)); }
  return t;
}

/**
 * A screen-sized standard: `px` is its on-screen height in CSS pixels whatever the camera
 * distance (sizeAttenuation off), so overview identity stays legible.
 */
export function standardSprite(owner, piece, o = {}) {
  const tex = pieceTexture(owner, piece, o);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false, toneMapped: false }));
  sp.renderOrder = o.ghost ? 8 : 9;
  sp.center.set(0.5, 0);
  sp.userData.aspect = tex.image.width / tex.image.height;
  sp.userData.key = `${owner}:${piece}`;
  return sp;
}

/** Semantic zoom with hysteresis: 'overview' | 'tactical' | 'inspection' from the projected territory size. */
export function zoomLevel(prev, territoryPx) {
  const up = { overview: 70, tactical: 150 }, down = { tactical: 60, inspection: 135 };
  if (prev === 'overview') return territoryPx > up.overview ? 'tactical' : 'overview';
  if (prev === 'tactical') return territoryPx < down.tactical ? 'overview' : territoryPx > up.tactical ? 'inspection' : 'tactical';
  return territoryPx < down.inspection ? 'tactical' : 'inspection';
}
export const STANDARD_PX = { overview: 46, tactical: 40, inspection: 36 };
export const STANDARD_OPACITY = { overview: 1, tactical: 0.75, inspection: 0.45 };
