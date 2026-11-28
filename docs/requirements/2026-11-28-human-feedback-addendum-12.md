# Human feedback addendum 12 — Let the environment dance with the song

**Date:** 28 November 2026, America/Los_Angeles.  
**Status:** Selected presentation follow-up; implementation and CJ's aesthetic acceptance are pending.  
**Baseline:** Reviewed main `f39fc01ec69bad98a8725a2cab48c583e759a4b7`.  
**Evidence:** [Focused music review](../reviews/2026-11-28-music-environment-follow-up.md).  
**Continues:** [Addendum 06 / HF6-05](2026-11-25-human-feedback-addendum-06.md) and the [dusk-island companion](../integrations/dusk-island-table-and-music-v1.md).

## CJ's clarified intent

> I want the environment to sort of dance with the telemetry of the songs.

CJ also asked whether the earlier visualizer request had been implemented. It had: actual music feeds lighting, reflections, shimmer and occasional accents. The initial implementation chose restrained effects; neither those defaults nor the existence of changing signal values established acceptance of the visible result. This addendum selects a more clearly musical environment, building on that working foundation.

The desired experience is easy to recognize: while an actual song plays, the surrounding world participates in its rhythm, texture and dynamics. A quieter passage settles; a stronger rhythmic passage produces a visibly different response. This should be apparent from the ordinary Home play camera without searching below the tabletop or moving to a scenic inspection view.

This is a focused presentation/music iteration. [Assignment 25](../reviews/2026-11-28-next-agent-assignment-25.md), [Response 25](../reviews/2026-11-28-implementation-response-25.md), and the existing friend.9 two-home handoff retain their scope and evidence. Human connection testing can proceed alongside this work. This document publishes requirements, not a new application build or release.

## Selected requirements

### HF12-01 — Make Expressive visibly musical

Expressive must deliver a recognizable song-driven response through at least two distinct scenic behaviors, including spatial movement or traveling light. Raising every light by the same slowly changing amount is insufficient. Keep the baseline scene coherent and attractive when response is Off.

The response must reach features visible in the ordinary Home composition. Existing below-table inlays and distant water can support it, but cannot be the only witnesses. Decorative tabletop edging and the near surroundings may participate; playable geometry and semantic overlays retain their meaning.

**Working art direction, adjustable by the implementation agent:**

| Measured cue | Suggested scenic response | Boundary |
| --- | --- | --- |
| Fast low-band rise / musical onset | A bounded pulse or traveling highlight on a noninteractive table perimeter; a small near-shore ripple or scenic sway | Keep the tactical grid, pieces, hit targets and camera fixed. An onset is not automatically a detected beat or BPM. |
| Broad energy or mid-band envelope | Slower lantern/reflection breathing and a gentle environmental swell | Preserve enough range to distinguish quiet and strong passages; avoid normalization that makes everything nearly constant. |
| High-band texture | Finer water shimmer, small reflection detail or occasional pooled sparks | Avoid constant particle showers or sharp flashes. |

Choose a small coherent set, reuse suitable existing scene objects, and tune it in motion. Separate fast transient response from slow atmosphere. Retain the rare-particle budget; continuous low-amplitude rhythmic response does not need a new particle burst on every beat. Any music-driven wave/sway speed must keep phase continuous when values change.

These mappings are implementation defaults, not a request for new art libraries, instrument separation, a whole-scene replacement, or a custom engine rewrite. The visible outcome governs the final choice.

### HF12-02 — Use the song that is actually playing

Extend the existing music-only analyzer, Soundtrack ownership and render update. Continue using one audible player. Analyze its source before local volume/mute/voice-duck gain; Avatar speech and game sounds must not drive the music environment.

Keep exact source identity, generation and audio time with the signal. Distinguish measured silence, paused/stopped playback, blocked playback and unavailable analysis. Unsupported analysis returns a neutral response and a truthful status. Ambient motion can continue, but must not be labeled as song-driven telemetry.

Use bounded normalized energy and low/mid/high envelopes, plus a separate short-lived onset/accent value if useful. State the measurement method: the current mean spectral-byte estimate is not time-domain RMS. True BPM, beat phase, song sections, vocals or stems are optional later capabilities and must remain absent/unknown until actually supported; do not invent them from a timer.

Music timing remains independent of the game's Tick clock and playback-speed control. Pause/end release the response toward neutral. Seek, Next, replay, Return to table mix and generation changes reset stale transients. Hidden-tab resume must not replay missed accents. Preserve ordinary playback if analysis is unavailable.

### HF12-03 — Make music independent of the local figure choice

Normal local play, including **No figure**, must retain the available music deck and environment response. Current main skips Table/Soundtrack creation when the local Avatar is absent; separate music ownership from the optional Avatar attachment without creating duplicate players or render loops.

Preserve online human play's existing music path and the selected Red/Falka/Leo/Thor owner capabilities. No figure must not silently instantiate an Avatar or introduce a new controller. Empty or unavailable music libraries get truthful states; this requirement does not fabricate a song, add a service prerequisite or make optional owners a prerequisite for a human game. Diagnostic fixtures need not start music automatically.

### HF12-04 — Keep understandable, independent controls

Retain **Off / Subtle / Expressive** and **Still atmosphere**, keyboard operation, saved choices and reduced-motion behavior. Preserve saved settings across this change. Subtle remains a gentle but observable option; Expressive is the clear demonstration of the requested dance. Keep the existing initial default unless a documented visual decision changes it; do not silently migrate saved users to stronger motion.

Off disables music response without pausing audio. Still freezes decorative motion and music modulation while music controls continue to work. Mute changes local listening volume, not the source analysis. Preserve those distinctions in concise help text.

Make the scene setting easy to find from Music. A compact optional drawer indicator can show whether response is following this song, paused, off/still or unavailable, with a few live band meters for inspection. Keep technical method/source detail in expanded diagnostics; do not add per-frame announcements or intrusive overlays during play.

### HF12-05 — Preserve game clarity and resource ownership

Music may animate decorative perimeter/surroundings, light and reflections. It must not change rules, legal-move meaning, team/lane colors, selection/Mana/damage indicators, readable text, unit positions, camera state or pointer targets. Keep interaction stable during card drags and camera movement; lowering distracting flourishes while busy is valid, but hiding every visible response during ordinary play would defeat the experience.

Reuse the existing render loop and pooled resources. Keep one audio graph for its owned element, bound particle counts, and dispose listeners/objects once on replacement. Preserve the recently delivered pending-Avatar cancellation. Follow the existing Luminati ownership boundary if an engine change is genuinely required.

## A small reusable foundation

Keep the measured music frame independent of Versus scene objects, and keep scene mappings in the presentation consumer. Version an expanded shape if needed; include source/generation/time, playing/analysis status, bounded envelopes and clearly named measurement method. An optional later prepared-analysis provider must identify the exact recording/content digest and method, fall back to live analysis, and reset on source changes.

This creates a reusable attachment point for other Hapa visual experiences without requiring a shared package, a new server, song uploads, or a protocol migration now. High-frequency samples are transient presentation data, not primary durable records and not match-authority traffic. If a reusable analysis artifact is later persisted, its provenance can reference the owner song and immutable content; do not append 30-Hz samples to match or I/O ledgers as part of this iteration.

## Bounded implementation and evidence

1. Reconcile the actual local checkout, Response 25 and the existing Overwatch board. Confirm the normal camera/current settings and reproduce the local No figure music gap before changing it. Credit any newer fixes instead of repeating them.
2. Assemble the independent local music path and a small Expressive treatment. Use focused checks only for changed signal/lifecycle behavior while assembling. Do not reopen unchanged networking qualification.
3. Demonstrate one repeatable Home-view comparison of Off, Subtle and Expressive using the same actual song and timestamps spanning contrasting passages. A short motion capture, or a witnessed timed playback if capture is unavailable, must show the relationship to the song. Static images and internal numbers alone do not prove that the environment dances. Also check a second available track with different energy/texture to avoid tuning to one recording.
4. Complete one ordinary turn with music active; check local No figure and an existing Avatar path, pause/resume, seek/Next, mute, Off/Still and scene replacement. Reuse valid unchanged evidence. Run the required `npm run check` once at final integrated qualification, broadening only for an observed risk or failure. If distributing a new executable, verify the changed journey in that exact package; do not describe main-only changes as present in friend.9.
5. Publish a focused music-environment implementation response with source, observed mappings, camera/settings/track timestamps, checks, relevant limitations and the delivery surface. Keep private audio, owner art, identifiers and full diagnostics out of the public repo; use public-safe assets or retain private captures with their owner and publish a written observation. Append the actual local board progress and leave aesthetic acceptance for CJ.

**Completion condition:** implemented signal and normal-session coverage, observed visible song response during play, retained controls/game clarity, and accurate delivery evidence. CJ's judgment that the environment now feels right remains separate from the agent's technical verification.
