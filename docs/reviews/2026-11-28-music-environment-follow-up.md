# Focused follow-up — What happened to the music visualizer?

**28 November 2026 · Independent source/history review and bounded live UI observation**  
**Reviewed main:** `f39fc01ec69bad98a8725a2cab48c583e759a4b7` (Response 25).  
**Selected direction:** [Human feedback addendum 12](../requirements/2026-11-28-human-feedback-addendum-12.md).  
**Scope:** CJ asked whether the earlier environment-visualizer work happened and clarified that the environment should dance with song telemetry. This supplement preserves Review 23 / Assignment 25 and the ready-to-attempt friend.9 two-home handoff.

## Answer and disposition

**The real music-to-scene connection was implemented. Its authored response is a restrained ambient layer, and the more clearly musical experience CJ describes has not been demonstrated or accepted.** This is a targeted expression/coverage follow-up, not evidence that all music integration was omitted.

[Addendum 06 / HF6-05](../requirements/2026-11-25-human-feedback-addendum-06.md) records the earlier background-visualizer requirement. Its Subtle default and three bounded effects were explicitly reviewer implementation defaults. [Response 13](2026-11-25-ui-design-response-13.md) identifies implementation `c42649b7127e49addba68a82101dff5046913f74` and reports actual-player analysis and scenic effects. Its remaining limitations disclose that the main mode comparison predates a late normalization adjustment, final normalization was only briefly observed, and quiet-versus-loud track tuning was not completed. [Reviews 13](2026-11-25-ui-design-review-13.md), [14](2026-11-25-ui-design-review-14.md) and [15](2026-11-25-ui-design-review-15.md) retain the perceptual/human-acceptance limit; later transport and layout closures did not establish aesthetic acceptance.

## Current source findings

The referenced paths below are pinned to the reviewed main, not an assertion about an installed executable.

| Finding | Source evidence | Effect on the experience |
| --- | --- | --- |
| Actual-song analysis is connected | [music-signal.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/f39fc01ec69bad98a8725a2cab48c583e759a4b7/src/hapa/presentation/music-signal.js), [Soundtrack sample](https://github.com/calderwong/hapa-verseUs-prototype/blob/f39fc01ec69bad98a8725a2cab48c583e759a4b7/src/hapa/presentation/soundtrack.js#L615-L621), [frame attachment](https://github.com/calderwong/hapa-verseUs-prototype/blob/f39fc01ec69bad98a8725a2cab48c583e759a4b7/src/hapa/presentation/app.js#L1930-L1944) | One music element feeds a separate pre-gain analyzer; voice/game sounds are excluded. Music is sampled in the existing frame independently of game playback speed. |
| Slow, small response is deliberate | Music signal envelopes; [scenery update](https://github.com/calderwong/hapa-verseUs-prototype/blob/f39fc01ec69bad98a8725a2cab48c583e759a4b7/src/hapa/presentation/scenery.js#L595-L640) | Subtle scales the response to 0.42. Broad energy uses 0.9 s attack / 2.2 s release, then 0.35 s scene smoothing. This favors breathing light over clear rhythmic motion. |
| Few scenery channels participate | Same scenery update | Energy changes lanterns, light pools/reflections and brass apron trim. Low/high bands share one shimmer value. Rare accents spawn embers and a trim glint, with 6 s Subtle / 3 s Expressive gaps and busy-interaction suppression. |
| Most environmental movement is ambient | Water `uTime`, scenery clock and skiff updates | Water phase and skiff bobbing follow wall-clock animation. Song values affect shimmer/brightness, not a broad song-driven movement vocabulary. No mid-band, BPM/beat phase, section or stem signal is supplied. |
| Some mapped surfaces are poorly placed for the play camera | Thin apron inlays and practicals below the tabletop; live Home composition | Much of the response is below or peripheral to the normal play view. There is no evidence that these details alone can communicate the requested dance. |
| Local No figure skips music ownership | [app._attachTable](https://github.com/calderwong/hapa-verseUs-prototype/blob/f39fc01ec69bad98a8725a2cab48c583e759a4b7/src/hapa/presentation/app.js#L514-L541) | The local branch returns without Table/Soundtrack when Avatar ID is absent, bot count is not one, or the session is a fixture. Online human play separately constructs an Avatar-free Table with music. This is a normal-local-session coverage gap, not a broken analyzer for an already playing song. |

Energy here is a normalized mean spectral-byte estimate, not time-domain RMS. The existing system does not claim instrument stems, semantic song structure or true beat tracking. Song/generation resets, pause release, music-only ownership, mute-before/after-analysis separation and Off/Still behavior are useful existing foundations to preserve.

## Bounded live observation

The reviewer opened `http://127.0.0.1:5199/versus.html`, started an ordinary local Red match, opened Music, and played an available actual song from the queue. The visible playback clock advanced through approximately 2:06–2:44 while the reviewer selected Expressive, Off and then restored Subtle. Still atmosphere was unchecked. The ordinary Home view contained the board, near terrace, lamps and fire; the music controls were reachable in the drawer. Playback was paused after inspection, the initial Subtle/Still settings were retained, and the Music drawer was left open for CJ.

This confirms real playback and working exposed mode controls. The observed captures are consistent with restrained scenery. They do **not** establish beat alignment, musical quality, controlled same-timestamp differences or an exact live-build revision. This was not an audio listening test, a full playtest, a packaged friend.9 check or a performance measurement. The local No figure finding is source-confirmed; it was not separately exercised live in this focused pass.

Only a controls-only capture is published; no private song title, audio or owner art is included:

![Existing music response controls, restored to Subtle with Still unchecked](evidence/2026-11-28/music-environment/music-controls.jpg)

Capture scope: direct browser screenshot crop of the UI controls, 438 × 38 screenshot pixels. It demonstrates the controls, not visualizer effectiveness. Browser/OS/DPR and exact served revision were not recorded for this supplemental observation.

## Selected implementation follow-up

- **ME-01 — Perceptible musical expression:** extend the current signal and scene mapping so Expressive has a clearly visible rhythmic/spatial response in Home, a slower dynamic swell, and distinguishable texture. Demonstrate contrasting passages; internal signal values alone do not close it.
- **ME-02 — Independent local music:** retain music in normal No figure games without creating an Avatar or a second audible player. Preserve optional owner capability and online human behavior.
- **ME-03 — Understandable state and qualified evidence:** retain Off/Subtle/Expressive/Still, make active/unavailable response understandable, preserve source/lifecycle/gameplay boundaries, and show a short real-song comparison plus an ordinary turn.

The exact requirements, proposed mappings, modular seam and bounded qualification are in [Addendum 12](../requirements/2026-11-28-human-feedback-addendum-12.md). No new server, shared SDK release, networking rewrite or new executable is implied. The coding agent should reconcile current local work and append actual progress to Overwatch; this reviewer has not accessed the owner's Mac checkout or updated that board. This publication changes documentation/evidence only and makes no new implementation or CJ-acceptance claim.
