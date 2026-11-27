/**
 * Procedural painting of the battlefield surface (Design Companion v1 ch.2 "material and lighting
 * direction", ch.6 "Territory identity"): painted stone slabs on worked earth, broad planes and
 * sparse wear rather than high-frequency noise; geography as a thin glowing inlay plus an emblem
 * plaque — never a flood fill; cedar-and-brass bank trays outside the field. Deterministic: the
 * same profile paints the same board (seeded brush clusters). Presentation only.
 */
import { territoryColors } from '../rules/economy.js';
import { INK, HUE, SUIT_GLYPH, SUIT_NAME, drawEmblem, brushRng } from './palette.js';

export const PX = 28; // canvas pixels per member width
export const MARGIN = { x: 6, y: 12 }; // member widths around the field (banks and labels)

const mix = (a, b, t) => {
  const pa = a.match(/\w\w/g).map((h) => parseInt(h, 16)), pb = b.match(/\w\w/g).map((h) => parseInt(h, 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`;
};

/** Paint the ground. Returns { color, emissive, px, py, W, H } canvases and coordinate helpers. */
export function paintGround(ctx, { cols, rows }) {
  const w = cols * 4, h = rows * 4;
  const W = w + MARGIN.x * 2, H = h + MARGIN.y * 2;
  const color = document.createElement('canvas'); color.width = W * PX; color.height = H * PX;
  const glow = document.createElement('canvas'); glow.width = W * PX; glow.height = H * PX;
  const g = color.getContext('2d'), e = glow.getContext('2d');
  e.fillStyle = '#000'; e.fillRect(0, 0, glow.width, glow.height);
  e.lineCap = 'round';
  const px = (x) => (x + MARGIN.x) * PX;
  const py = (y) => (H - (y + MARGIN.y)) * PX;
  const rnd = brushRng(0x5eed ^ (cols * 131 + rows));

  // --- the table around the field: dark slate with broad brushed bands
  g.fillStyle = INK.slate; g.fillRect(0, 0, color.width, color.height);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(${rnd() < 0.5 ? '40,56,74' : '12,18,26'},${0.15 + rnd() * 0.2})`;
    const x = rnd() * color.width, y = rnd() * color.height;
    g.fillRect(x, y, 40 + rnd() * 160, 3 + rnd() * 6);
  }

  // --- worked earth under the field (the contact strips), with strata
  const ex = px(-0.5), ey = py(h + 0.5), ew = (w + 1) * PX, eh = (h + 1) * PX;
  g.fillStyle = '#3B3024'; g.fillRect(ex, ey, ew, eh);
  for (let i = 0; i < 520; i++) {
    const x = ex + rnd() * ew, y = ey + rnd() * eh;
    g.fillStyle = rnd() < 0.55 ? `rgba(92,74,52,${0.25 + rnd() * 0.3})` : `rgba(24,18,13,${0.25 + rnd() * 0.3})`;
    g.fillRect(x, y, 10 + rnd() * 34, 2 + rnd() * 3);
  }
  // a raised lip around the field
  g.strokeStyle = '#1A140F'; g.lineWidth = 6; g.strokeRect(ex, ey, ew, eh);
  g.strokeStyle = 'rgba(201,166,94,0.55)'; g.lineWidth = 2; g.strokeRect(ex - 5, ey - 5, ew + 10, eh + 10);

  const mana = new Set([...ctx.profile.board.manaRows, ...ctx.profile.board.dualRows]);
  for (let c = 1; c <= cols; c++) for (let r = 1; r <= rows; r++) {
    const colors = territoryColors(ctx.profile, c, r);
    const x0 = px(4 * c - 3.5), y0 = py(4 * r - 0.5), S = 3 * PX;
    // stone slab in the cedar/slate trial's brush-pixel language (VA-06, review 18): a stepped
    // limestone ramp, two or three broad value planes laid along the slab, clustered wear snapped to a
    // 2-pixel grid, and one rubbed edge highlight; no speckle. The inlay, joints and plaque stay as they were.
    const RAMP = ['#8e8472', '#9d927f', '#ab9f8b', '#b9ad98', '#c6baa4']; // dark → light limestone
    const snap = (v) => Math.round(v / 2) * 2;
    const tone = 1 + Math.floor(rnd() * 3);
    g.fillStyle = RAMP[tone]; g.fillRect(x0, y0, S, S);
    for (let k = 0; k < 3; k++) {
      g.fillStyle = k === 1 ? RAMP[Math.min(4, tone + 1)] : RAMP[Math.max(0, tone - 1)];
      g.globalAlpha = 0.55;
      const hy = snap(y0 + 4 + rnd() * (S - 18)), hx = snap(x0 + rnd() * S * 0.4);
      g.fillRect(hx, hy, snap(S * (0.35 + rnd() * 0.5)), snap(4 + rnd() * 8));
    }
    g.globalAlpha = 1;
    // lit upper-left plane and shaded lower-right plane, stepped (two values), not a smooth wash
    g.fillStyle = 'rgba(255,248,230,0.09)'; g.fillRect(x0, y0, snap(S * 0.62), snap(S * 0.34));
    g.fillStyle = 'rgba(20,16,12,0.13)'; g.fillRect(x0 + snap(S * 0.42), y0 + snap(S * 0.7), S - snap(S * 0.42), S - snap(S * 0.7));
    // clustered wear: two or three compact clusters of stepped 2-pixel blocks
    for (let k = 0; k < 3; k++) {
      if (k === 2 && rnd() < 0.5) continue;
      const dark = rnd() < 0.6, bx = snap(x0 + 8 + rnd() * (S - 26)), by = snap(y0 + 8 + rnd() * (S - 20));
      g.fillStyle = dark ? RAMP[0] : RAMP[4]; g.globalAlpha = dark ? 0.6 : 0.5;
      for (let q = 0; q < 5; q++) g.fillRect(bx + q * 2, by + (q % 2) * 2 - (q > 2 ? 2 : 0), 2 + (q % 3) * 2, 2);
    }
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(232,214,180,0.30)'; g.fillRect(snap(x0 + 6 + rnd() * S * 0.4), y0 + 4, snap(10 + rnd() * 16), 2);
    // broken edges: chip one or two corners into the earth
    g.fillStyle = '#3B3024';
    for (let k = 0; k < 2; k++) {
      if (rnd() < 0.5) continue;
      const corner = Math.floor(rnd() * 4), cs = 4 + rnd() * 7;
      const cx = corner % 2 ? x0 + S : x0, cy = corner < 2 ? y0 : y0 + S;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + (corner % 2 ? -cs : cs), cy); g.lineTo(cx, cy + (corner < 2 ? cs : -cs)); g.closePath(); g.fill();
    }
    // 3×3 slot joints: an inset line with a light lip
    for (let i = 1; i < 3; i++) {
      g.strokeStyle = 'rgba(22,18,14,0.55)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x0 + i * PX, y0 + 2); g.lineTo(x0 + i * PX, y0 + S - 2); g.moveTo(x0 + 2, y0 + i * PX); g.lineTo(x0 + S - 2, y0 + i * PX); g.stroke();
      g.strokeStyle = 'rgba(255,248,230,0.16)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x0 + i * PX + 1.5, y0 + 2); g.lineTo(x0 + i * PX + 1.5, y0 + S - 2); g.moveTo(x0 + 2, y0 + i * PX + 1.5); g.lineTo(x0 + S - 2, y0 + i * PX + 1.5); g.stroke();
    }
    // a painted bevel: lit top-left lip, shaded bottom-right lip (the slab sits proud of the earth)
    g.fillStyle = 'rgba(255,248,232,0.28)'; g.fillRect(x0, y0, S, 3); g.fillRect(x0, y0, 3, S);
    g.fillStyle = 'rgba(18,13,9,0.45)'; g.fillRect(x0, y0 + S - 4, S, 4); g.fillRect(x0 + S - 4, y0, 4, S);
    g.fillStyle = 'rgba(10,8,6,0.35)'; g.fillRect(x0 + 4, y0 + S, S, 4); g.fillRect(x0 + S, y0 + 4, 4, S); // cast shadow on the earth
    // slab outline (ink) and the geographic inlay: a thin emissive line, one segment per color
    g.strokeStyle = 'rgba(14,11,8,0.75)'; g.lineWidth = 2; g.strokeRect(x0 + 1, y0 + 1, S - 2, S - 2);
    const inset = 6, len = S - inset * 2;
    // Black needs an ivory rim to stay visible; Rainbow is drawn as segments, never one pale hue
    if (colors.includes('black')) { g.strokeStyle = 'rgba(245,240,227,0.9)'; g.lineWidth = 4.5; g.strokeRect(x0 + inset, y0 + inset, len, len); }
    if (colors.includes('rainbow')) {
      const SEG = ['#EF6A5B', '#E6A05D', '#E7D26A', '#71BE83', '#58B8F0', '#AA8DE1'];
      const per = len / 6;
      for (const ctx2 of [g, e]) {
        ctx2.lineWidth = ctx2 === e ? 3 : 2.5;
        for (let side = 0; side < 4; side++) for (let i = 0; i < 6; i++) {
          ctx2.strokeStyle = SEG[(i + side * 2) % 6];
          const t0 = i * per, t1 = (i + 1) * per;
          const P = [[x0 + inset + t0, y0 + inset, x0 + inset + t1, y0 + inset], [x0 + S - inset, y0 + inset + t0, x0 + S - inset, y0 + inset + t1],
            [x0 + S - inset - t0, y0 + S - inset, x0 + S - inset - t1, y0 + S - inset], [x0 + inset, y0 + S - inset - t0, x0 + inset, y0 + S - inset - t1]][side];
          ctx2.beginPath(); ctx2.moveTo(P[0], P[1]); ctx2.lineTo(P[2], P[3]); ctx2.stroke();
        }
      }
    }
    colors.filter((c) => c !== 'rainbow').forEach((col, i, arr) => {
      const a = (i / arr.length) * len, b = ((i + 1) / arr.length) * len;
      for (const ctx2 of [g, e]) {
        ctx2.strokeStyle = HUE[col]; ctx2.lineWidth = ctx2 === e ? 3 : 2.5;
        ctx2.beginPath();
        // a split along the top and bottom edges; the full side edges belong to the end colors
        ctx2.moveTo(x0 + inset + a, y0 + inset); ctx2.lineTo(x0 + inset + b, y0 + inset);
        ctx2.moveTo(x0 + inset + a, y0 + S - inset); ctx2.lineTo(x0 + inset + b, y0 + S - inset);
        if (i === 0) { ctx2.moveTo(x0 + inset, y0 + inset); ctx2.lineTo(x0 + inset, y0 + S - inset); }
        if (i === arr.length - 1) { ctx2.moveTo(x0 + S - inset, y0 + inset); ctx2.lineTo(x0 + S - inset, y0 + S - inset); }
        ctx2.stroke();
      }
    });
    // plaque: the alignment emblem(s) in the lower-left slot; a brass Mana badge on Mana rows
    const ppx = x0 + 11, ppy = y0 + S - 11;
    colors.forEach((col, i) => { drawEmblem(g, col, ppx + i * 11, ppy, 5.5); drawEmblem(e, col, ppx + i * 11, ppy, 5.5); });
    if (mana.has(r)) {
      const mx = x0 + S - 12, my = y0 + S - 12;
      g.fillStyle = INK.brass; g.strokeStyle = INK.ink; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(mx, my - 5); g.lineTo(mx + 5, my); g.lineTo(mx, my + 5); g.lineTo(mx - 5, my); g.closePath(); g.fill(); g.stroke();
      e.fillStyle = 'rgba(201,166,94,0.6)'; e.beginPath(); e.moveTo(mx, my - 4); e.lineTo(mx + 4, my); e.lineTo(mx, my + 4); e.lineTo(mx - 4, my); e.closePath(); e.fill();
    }
  }

  // --- Capitals: a brass dashed frame and an ivory label
  for (const seat of ['A', 'B']) {
    const cap = ctx.geo.toGlobal(seat, ctx.profile.board.capitalColumn, 1);
    const x0 = px(4 * cap.column - 3.5), y0 = py(4 * cap.row - 0.5), S = 3 * PX;
    for (const c2 of [g, e]) { c2.strokeStyle = INK.brass; c2.lineWidth = 3; c2.setLineDash([9, 5]); c2.strokeRect(x0 - 5, y0 - 5, S + 10, S + 10); c2.setLineDash([]); }
    g.fillStyle = INK.ivory; g.font = '600 12px system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText(`${seat} CAPITAL`, x0 + S / 2, seat === 'A' ? y0 + S + 18 : y0 - 10);
  }

  // --- column headers with both alignment emblems and the suit; row numbers
  g.textAlign = 'center';
  for (let c = 1; c <= cols; c++) {
    const info = ctx.profile.board.columnMap[c - 1];
    const pair = [territoryColors(ctx.profile, c, 1)[0], territoryColors(ctx.profile, c, rows).slice(-1)[0]];
    for (const [yy, near] of [[py(-0.75), true], [py(h + 0.75), false]]) {
      const cx = px(4 * c - 2);
      g.fillStyle = INK.ivory; g.font = '700 15px system-ui, sans-serif'; g.fillText(`C${c}`, cx - 12, yy + 5);
      drawEmblem(g, near ? pair[0] : pair[1], cx + 9, yy, 6.5);
      g.fillStyle = INK.mist; g.font = '12px system-ui, sans-serif'; g.fillText(`${SUIT_GLYPH[info.suit]} ${SUIT_NAME[info.suit]}`, cx, yy + 20);
    }
  }
  g.font = '700 14px system-ui, sans-serif'; g.fillStyle = INK.mist;
  g.textAlign = 'right'; for (let r = 1; r <= rows; r++) g.fillText(`R${r}`, px(-0.7), py(4 * r - 2) + 5);
  g.textAlign = 'left'; for (let r = 1; r <= rows; r++) g.fillText(`R${r}`, px(w + 0.7), py(4 * r - 2) + 5);

  // --- banks: cedar trays with brass (Major) or linen (hand) slot plates; Enchantment side slots
  const tray = (x, y, ww, hh, plate) => {
    const X = px(x), Y = py(y + hh), Wd = ww * PX, Hd = hh * PX;
    g.fillStyle = '#5A3E28'; g.fillRect(X - 3, Y - 3, Wd + 6, Hd + 6);
    g.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < 4; k++) g.fillRect(X - 3, Y + (k + 0.5) * (Hd / 4), Wd + 6, 1);
    g.fillStyle = plate; g.fillRect(X + 2, Y + 2, Wd - 4, Hd - 4);
    g.strokeStyle = 'rgba(13,19,27,0.8)'; g.lineWidth = 1.5; g.strokeRect(X + 2, Y + 2, Wd - 4, Hd - 4);
  };
  for (let c = 1; c <= cols; c++) {
    tray(4 * c - 3.4, -3.6, 2.8, 2.6, '#3A3320');
    tray(4 * c - 3.4, -7.6, 2.8, 3.4, '#2C3440');
    tray(4 * c - 3.4, h + 1, 2.8, 2.6, '#3A3320');
    tray(4 * c - 3.4, h + 4.2, 2.8, 3.4, '#2C3440');
  }
  for (let r = 1; r <= rows; r++) { tray(-4.6, 4 * r - 3.2, 2.6, 2.4, '#2A2F36'); tray(w + 2, 4 * r - 3.2, 2.6, 2.4, '#2A2F36'); }
  g.fillStyle = INK.mist; g.font = '600 12px system-ui, sans-serif'; g.textAlign = 'left';
  g.fillText('A · MAJOR ARCANA', px(-5.5), py(-2.2)); g.fillText('A · HAND (MINOR ARCANA)', px(-5.5), py(-6));
  g.fillText('B · MAJOR ARCANA', px(-5.5), py(h + 2.4)); g.fillText('B · HAND (MINOR ARCANA)', px(-5.5), py(h + 6));
  g.save(); g.translate(px(-5.2), py(h / 2)); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillText('A · ROW ENCHANTMENTS', 0, 0); g.restore();
  g.save(); g.translate(px(w + 5.2), py(h / 2)); g.rotate(Math.PI / 2); g.textAlign = 'center'; g.fillText('B · ROW ENCHANTMENTS', 0, 0); g.restore();
  return { color, emissive: glow, px, py, W, H };
}
