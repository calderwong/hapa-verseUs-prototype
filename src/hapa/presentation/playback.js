/**
 * Playback poses for a resolved Tick (presentation only; the rules never read this).
 *
 * During resolution the app records a frame whenever the event list grows (and at least every 20
 * quanta): each member's and party's position, whether it is alive and its band at that quantum.
 * Playback then asks for the pose at a moment, and BoardView.sync makes the single visibility
 * decision from it — the selected layer, the casualty reveal and the playback position together
 * (design review 02, R2-01: the controller used to overwrite the layer filter afterwards).
 *
 * Height follows the rules' own timing: `elevation_changed` happens on arrival at a node, so a
 * member reaches its new band at that frame. Between the two frames that bracket the change the
 * drawn height ramps in world units; the band used for layer filtering stays the authoritative
 * band of the latest frame at or before the moment.
 */

/**
 * @typedef {[x: number, y: number, alive: boolean, band: number]} FrameEntry
 * @typedef {{ q: number, pos: Record<string, FrameEntry>, evLen: number }} Frame
 * @typedef {[x: number, y: number, alive: boolean, band: number, height: number]} PoseEntry
 */

/** A frame's entries for a state: members by id, parties as `party:<id>`. @returns {Record<string, FrameEntry>} */
export function snapshot(state) {
  const pos = {};
  for (const m of Object.values(state.members)) pos[m.id] = [m.x, m.y, !!m.alive, m.band ?? 1];
  for (const p of Object.values(state.parties)) pos[`party:${p.id}`] = [p.x, p.y, !!p.alive && !p.retired, p.band ?? 1];
  return pos;
}

/**
 * The playback timeline: the state before resolution at q 0, then the traced frames. A Tick in
 * which nothing moved records no frames, so the start is held to the end (q 1000).
 * @param {Record<string, FrameEntry>} start @param {Frame[]} frames @param {number} eventCount
 * @returns {Frame[]}
 */
export function timeline(start, frames, eventCount) {
  const all = [{ q: 0, pos: start, evLen: 0 }, ...frames];
  if (all.length === 1) all.push({ q: 1000, pos: start, evLen: eventCount });
  return all;
}

/**
 * The pose at quantum q of the Tick.
 * @param {Frame[]} frames ordered by q, the first being the state before resolution (q 0)
 * @param {number} q 0…1000
 * @param {(band: number) => number} heightOf world height of a band's floor
 * @returns {{ pos: Record<string, PoseEntry>, evLen: number }}
 */
export function poseAt(frames, q, heightOf) {
  let i = 0;
  while (i < frames.length - 1 && frames[i + 1].q <= q) i++;
  const a = frames[i], b = frames[Math.min(i + 1, frames.length - 1)];
  const f = b.q > a.q ? Math.min(1, Math.max(0, (q - a.q) / (b.q - a.q))) : 1;
  const pos = {};
  for (const id of new Set([...Object.keys(a.pos), ...Object.keys(b.pos)])) {
    const pa = a.pos[id] ?? b.pos[id], pb = b.pos[id] ?? pa;
    const alive = pa[2];
    // a member that dies before the next frame stays where it fell rather than sliding on
    const t = alive && pb[2] ? f : 0;
    const ha = heightOf(pa[3]), hb = heightOf(pb[3]);
    pos[id] = [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t, alive, pa[3], ha + (hb - ha) * t];
  }
  return { pos, evLen: a.evLen };
}

/** Whether a body is drawn: alive at this moment and in the shown layer (null = all layers). */
export const bodyVisible = (alive, band, layer) => !!alive && (layer === null || band === layer);
