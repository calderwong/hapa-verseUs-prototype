/**
 * The rules context: the agreed profile and catalog plus derived helpers. Not part of the state
 * (it is fixed by the manifest), so it is rebuilt from the manifest on every peer.
 */
import { Geometry } from './geometry.js';

/** @param {any} manifest */
export function createContext(manifest) {
  const profile = manifest.profile;
  const geo = new Geometry(profile);
  return {
    manifest,
    profile,
    catalog: manifest.catalog,
    geo,
    U: geo.U,
    /** optional: seats whose damage allocation is asked as a choice (otherwise the standing policy) */
    interactiveAllocation: { A: false, B: false },
  };
}

/** Append an identified event. */
export function emit(state, events, type, data = {}) {
  state.eventSeq += 1;
  const e = { id: `${state.matchId}:${state.eventSeq}`, seq: state.eventSeq, tick: state.tick, phase: state.phase, type, ...data };
  events.push(e);
  return e;
}

export const COLORS = ['red', 'green', 'purple', 'yellow', 'blue', 'orange', 'black', 'white', 'rainbow'];
