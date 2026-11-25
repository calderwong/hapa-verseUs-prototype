# Human feedback addendum 06 — Music worth keeping, a table worth inhabiting

**Date:** 25 November 2026, America/Los_Angeles.  
**Authority:** Records CJ's current request and identifies the reviewer's implementation defaults.  
**Companions:** [Review 12](../reviews/2026-11-25-ui-design-review-12.md), [design and implementation companion](../integrations/dusk-island-table-and-music-v1.md), [Assignment 13](../reviews/2026-11-25-next-agent-assignment-13.md).

## The intended experience

A player can enjoy the opponent's music, keep a song without interrupting it, return to music heard earlier, and play saved music again. The player sits at a crafted Hapa game table in a convincing place. Music gives that place life while the battlefield remains easy to read and operate.

This is a selected new presentation and music milestone. It supersedes Assignment 12's exclusions of atmosphere and retained-library UI work. [Addendum 05](2026-11-24-human-feedback-addendum-05.md) continues to govern the seated opponent; [addendum 04](2026-11-23-human-feedback-addendum-04.md) and compatible earlier addenda govern gameplay. This addendum changes no movement, economy, combat, Ready, historical profile or model-admission semantics.

## CJ's selected requirements

### HF6-01 — Redesign the music player as part of the game

The music player needs a cosmetic overhaul and usable transport controls. Its identity, materials, type, state changes and spacing should belong to Hapa. A player should immediately understand what is playing, who made or introduced it when that information is known, whether it has been kept, and how to pause, revisit or change songs. Keep this compact during play; show the collection when deliberately opened.

### HF6-02 — Make previously heard and kept songs playable

Expose a way to return to earlier songs, especially kept songs. A saved entry must have a usable Play action when its audio is available. Preserve creator attribution and the player or Avatar who introduced it. Similar titles are not evidence that recordings are identical.

**Working scope for this milestone:** `Played this match` records actual playback in the current match. `Kept` reads the persistent owner library and remains useful after a new match or reload. The inspected owner does not expose complete cross-session listening history, so do not present one as implemented. Unretained past offers can be played while their source is available; unavailable audio gets a truthful state.

### HF6-03 — Keeping a song must preserve listening

Pressing Keep changes its saved state. It must not cause a track change, restart, seek, pause, volume dip, spoken interruption, drawer opening or navigation. Preserve the current source and playback position while the save is pending and after it completes. If the user changes songs independently, the save still belongs to the original song.

Natural song completion and a separately requested Next action remain independent transport events. A save acknowledgement arriving near one of those events must not be mistaken for an instruction to switch or restart music. A failed save offers Retry while playback continues.

**Working treatment:** Keep becomes `Saving…`, then `Kept ✓` when the owner confirms the durable save. Show acquisition progress or `Available offline` separately. Do not equate a saved reference with a locally retained recording. Keep is not a toggle that silently deletes a saved song when clicked again.

### HF6-04 — Overhaul the board's setting and atmosphere

Improve the whole scene: table construction, board materials, surroundings, lighting, depth and composition. Take cues from Papa's Island, Echo Album and existing Hapa visualizer work. Preserve the current board's geometry, semantic colors, chess readability, zoom inspection, height bands, Card banks and the opponent's seat across from the player.

**Working art direction:** a sheltered island terrace at dusk, with a cedar/slate table, dark coastal water, wet stone, moss, wooded silhouettes, warm lanterns, linen and restrained aged brass. This is a coherent first setting, not a requirement to build the complete Papa's Island environment. The companion turns this direction into implementable visual rules.

### HF6-05 — Let music animate the place around the match

The game board and surrounding scene should act as a background music visualizer. Actual music playback may gently influence decorative table trim, practical light, reflections, shore shimmer and occasional peripheral particles. The music must remain audible through the existing player and retain its own playback time.

Legal movement, team and lane meaning, selections, Mana state, damage, text and camera behavior must remain dependable. Music cannot change a rule result, move the camera, obscure a target or make a normal tile resemble an available move. Provide a still/reduced-motion option and a way to turn musical response off without stopping music.

## Defaults the agent can implement without another design question

| Decision | Working default and reason |
| --- | --- |
| Compact player | A crafted navy/cedar/brass listening deck in the existing music area, with stable transport positions. A deliberate Music drawer holds the collection. |
| Collection views | Queue, Played this match, Kept. Search title/creator locally in the owner-returned collection. |
| Replaying an earlier or saved song | A local replay context using the same audio player. Bookmark the table mix and expose Return to table mix. The companion defines transport and completion behavior. |
| Keep acknowledgement | Visual only. Remove the automatic Red voice acknowledgement and its caused ducking. |
| Music response | Subtle by default; Off, Subtle, Expressive and Still/reduced-motion behavior. The baseline scene must look complete with response off. |
| First visual response | Three bounded jobs: slow practical/trim glow, subdued water/reflection motion, rare peripheral accents. No full-screen equalizer. |
| Existing scene opponent | Preserve its seat, useful scale, conversation and camera policies. Fit the new setting around it. |
| Owner boundaries | Reuse Song Registry retention/playback and Avatar/Harbor performance. Visual references supply selected patterns; they do not justify transplanting whole renderers or rewriting owners. |

These are implementation defaults, not a claim that CJ has accepted a finished image or numerical art setting. The agent may adjust composition and tuning to achieve the stated experience, recording material deviations. No unresolved product question blocks the first complete candidate. CJ's next useful decision is a reaction to that candidate in play.
