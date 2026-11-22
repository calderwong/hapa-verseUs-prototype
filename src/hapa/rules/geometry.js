/**
 * Board geometry (Master Requirements v3, Chapter 6 and Appendix A "Starting army and movement").
 *
 * Integer coordinates at `scale` units per member width. A territory body is 3 wide, the contact
 * strip 1, so territory centers are a pitch of 4 apart: global R r C c is centered at
 * (4c − 2, 4r − 2). A advances toward +y, B toward −y. Members are unit squares at offsets
 * −1, 0, +1 from the party anchor, rotated by the party's facing.
 */

/** Four cardinal facings: forward and right-hand vectors on the board plane. */
export const FACINGS = Object.freeze({
  N: { fx: 0, fy: 1, rx: 1, ry: 0 },
  S: { fx: 0, fy: -1, rx: -1, ry: 0 },
  E: { fx: 1, fy: 0, rx: 0, ry: -1 },
  W: { fx: -1, fy: 0, rx: 0, ry: 1 },
});

/** Slots 1–3 front, 4–6 middle, 7–9 rear, left to right as seen from behind. */
export function slotLocal(slot) {
  const row = Math.floor((slot - 1) / 3);
  const col = (slot - 1) % 3;
  return { lx: col - 1, ly: 1 - row };
}

/** World offset (in member widths) of a slot for a facing. */
export function slotOffset(slot, facing) {
  const { lx, ly } = slotLocal(slot);
  const f = FACINGS[facing];
  return { dx: lx * f.rx + ly * f.fx, dy: lx * f.ry + ly * f.fy };
}

/** Facing from a direction of travel (dx, dy in any units; the dominant axis wins). */
export function facingOf(dx, dy) {
  if (Math.abs(dy) >= Math.abs(dx)) return dy >= 0 ? 'N' : 'S';
  return dx >= 0 ? 'E' : 'W';
}

export class Geometry {
  /** @param {any} profile */
  constructor(profile) {
    this.U = profile.geometry.scale;
    this.pitch = profile.geometry.pitch * this.U;
    this.columns = profile.board.columns;
    this.rows = profile.board.rows;
    this.quanta = profile.geometry.quantaPerTick;
  }

  /** Global center of a territory. */
  center(column, row) {
    return { x: (4 * column - 2) * this.U, y: (4 * row - 2) * this.U };
  }

  onBoard(column, row) {
    return column >= 1 && column <= this.columns && row >= 1 && row <= this.rows;
  }

  /**
   * Region (territory) of an anchor; on an exact boundary keep the previous assignment until the
   * anchor crosses it (Appendix A "Party center").
   */
  region(x, y, prev) {
    const axis = (v, prevIdx) => {
      if (v % this.pitch === 0) return prevIdx ?? v / this.pitch;
      return Math.floor(v / this.pitch) + 1;
    };
    return { column: axis(x, prev?.column), row: axis(y, prev?.row) };
  }

  /** Home-relative (local) coordinates of a global territory for a seat. */
  toLocal(seat, column, row) {
    if (seat === 'A') return { column, row };
    return { column: this.columns + 1 - column, row: this.rows + 1 - row };
  }

  toGlobal(seat, column, row) {
    return this.toLocal(seat, column, row); // the transform is its own inverse
  }

  /** Forward coordinate of a y position for a seat (larger = further from home). */
  forward(seat, y) {
    return seat === 'A' ? y : -y;
  }

  homeFacing(seat) {
    return seat === 'A' ? 'N' : 'S';
  }
}
