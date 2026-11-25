# Review 13 — Finish the music experience and make the setting read from Home

**Date:** 25 November 2026, America/Los_Angeles.  
**Reviewed repository:** `calderwong/hapa-verseUs-prototype`.  
**Reviewed main:** `e04286188e13800e588557bd5cb53a9b0e3724c0`.  
**Implementation:** `c42649b7127e49addba68a82101dff5046913f74`.  
**Engine:** `ba838cca09ba43afceda0452b63d28df4cbf7f72`; default profile `hapa_open_10x9_v3_07`.

## Verdict

**The music-and-setting milestone has substantially landed. Preserve it and complete a bounded correction pass.** Queue, Played this match and Kept now form a usable collection; retained recordings can be replayed; Return restores the table mix; Keep has a quiet, dedicated state; and the authored environment has a physical cedar/brass table with a separate music-response layer. This is meaningful progress against CJ's request.

The remaining work has a clear boundary: correct transport state and cancellation, make Previous follow recent listening, fit the panels at compact widths, dispose replaced boards, and refine the ordinary Home composition. The strongest defect is a controlled reproduction in which a delayed audio start undoes Pause while the interface still says Paused. The live player also needed two presses of Play to start, and compact panels moved essential controls off-screen.

The selected design remains [addendum 06](../requirements/2026-11-25-human-feedback-addendum-06.md) and the [dusk-island companion](../integrations/dusk-island-table-and-music-v1.md). This review does not select a new world, new music architecture or different game rules. [Assignment 14](2026-11-25-next-agent-assignment-14.md) defines the completion pass. CJ's art and Done acceptance remain separate from implementation and tests.

## What was reviewed

The review compared the published implementation and [Response 13](2026-11-25-ui-design-response-13.md) with Review 12 / Assignment 13, inspected the relevant source and submitted evidence, independently ran the three supplied soundtrack tests once, and used two focused actual-source diagnostics. The diagnostics use controlled audio/context/fetch fixtures and make no external network or owner calls.

A fresh local-browser match at `http://127.0.0.1:5199/versus.html` used human A, heuristic bot B, seated Red, seed 1 and the current profile. Live checks covered initial Play, Kept replay, Return, the player and collection at 1440×900, a useful orbit, and competing panels at 700×900. Temporary viewport overrides were restored and the review tab was closed. No Keep/save action, conversation, Ready action or match Tick was submitted by the reviewer. Existing owner libraries were only read and played.

**The local UI did not expose its running source commit.** Its observations are attributed to that live instance, not asserted to be a byte-identical deployment of the Git pin. Source diagnostics are pinned. The report's broader 155-test check, performance sample and resource measurements are submitted evidence, not a fresh reviewer execution of those campaigns. [Evidence and reproductions](evidence/2026-11-25/review-13/README.md) record these distinctions.

## What should stay

| Area | Review disposition |
| --- | --- |
| R12-01, conversation beside the opponent | The source now constrains desktop candidates against both reserved edges. Preserve that correction. Compact panel composition is a distinct remaining issue below. |
| R12-02, quiet Keep | The fixed player slot and collection updates preserve the intended separation from transport. The supplied focused tests pass independently; the author reports live successful retention. The reviewer did not add another owner record merely to repeat it. |
| R12-03, playable music collection | The core feature is present. Live Kept contained playable recordings, distinguished recording identity/introductions, and retained replay plus Return worked. Qualify the transport edge states below before calling the experience complete. |
| R12-04, authored place | Physical table construction and a coastal scene are delivered. Angled viewing makes the cedar/brass apron and legs legible. The normal Home composition still needs one art pass. |
| R12-05, response to music | The source has one owned analysis path, bounded sampling/particles, elapsed-time updates, mode controls and scenery disposal. Preserve these. The asynchronous start race below is a transport boundary defect. No broad perceptual or performance acceptance is inferred from source alone. |

## R13-01 — P1: an old start can resume sound after the player presses Pause

**Player context.** A browser audio context may take time to resume. If the player presses Play and then Pause while that is pending, Pause must remain effective. A late completion must not start audio behind a paused interface.

**Evidence.** The focused diagnostic runs the actual `Soundtrack` and `MusicSignal` modules with a deferred suspended-context fixture. Play begins at generation 1. Pause advances to generation 2 and sets listening false. Resolving the old resume still calls `audio.play()`. The final state has listening false and status paused, but the audio fixture is playing. This is a controlled scheduling proof, not an assertion that the reviewer heard the race in the live browser.

**Cause and correction.** `Soundtrack._play()` awaits `signal.resume()` and then calls `audio.play()` without checking the current item, generation, listening intent or disposal state immediately before that side effect. The callers' later result/error checks cannot undo a side effect they have already allowed. Bind the start to its item and generation, validate before waiting and again after graph resume, and abandon stale attempts before playing. Preserve finite handling and current-result fencing for valid attempts.

**Enough evidence to close.** The delayed-resume/Pause sequence produces no late play; the current valid start still succeeds. Apply the same contract to table playback, local replay, replacement and teardown through the shared start path. [Pinned soundtrack source](https://github.com/calderwong/hapa-verseUs-prototype/blob/e04286188e13800e588557bd5cb53a9b0e3724c0/src/hapa/presentation/soundtrack.js); [diagnostic result](evidence/2026-11-25/review-13/resume-pause-race-result.json).

## R13-02 — P2: Play must perform the action its label promises

**Player context.** A visible Play button should start or retry the selected song on the first press. After a complete song ends, replay should begin at the start rather than at its last half-second.

**Live evidence.** After the fresh match prepared its table mix, the reviewer pressed Play. Opening Music showed Paused, Play music and 0:00. The second press started the recording and changed the button to Pause. The review did not read hidden listening state or storage to establish the cause of this particular startup.

**Controlled and source evidence.** The actual-source probe establishes the related mismatch after failed replay and finished table playback: listening intent remains true, the deck displays Play, and `togglePlay()` first turns that intent off. The second press starts audio. For a completed table track the probe then resumes at 99.5 seconds of a 100-second recording. `MusicDeck.patch()` derives the label from activity while the click action blindly toggles persisted intent.

There is a related source-only recovery issue: graph activation failure throws a message asking the user to press Play, but the generic failure path marks the table entry skipped and schedules advancement. That conflicts with retaining a valid selection for the requested gesture-based retry. The generic skip path predates this implementation; the new graph-activation failure enters it.

**Correction.** Make transport actions state-aware. One Play starts ready media or retries a recoverable stopped selection; Pause cancels playing or pending playback. For completed table playback, the working default is **Play again from zero**. Keep the deliberate replay-end stop and table bookmark intent. Classify browser/context activation blocks separately from unavailable media: retain the selected recording and offer one-gesture retry without skipping it.

**Enough evidence to close.** Cover ready, recoverable failure, finished and activation-blocked states in one focused family of proofs. The displayed verb, accessible name and resulting action agree. [Pinned player source](https://github.com/calderwong/hapa-verseUs-prototype/blob/e04286188e13800e588557bd5cb53a9b0e3724c0/src/hapa/presentation/music-deck.js); [transport results](evidence/2026-11-25/review-13/transport-state-result.json).

## R13-03 — P2: Previous should follow what was heard most recently

**Player context.** Listen to songs 1, 2 and 3, replay song 1 from the collection, and Return to song 3. Pressing Previous near the beginning of 3 should return to the recently heard song 1. A collection's original insertion order does not represent that listening sequence.

**Evidence.** The actual-source probe selects song 2 instead. The unique Played collection keeps first-heard order while updating `lastAt`; `previous()` reverses the collection array rather than following actual recent listening.

**Correction.** Maintain bounded playback chronology or an equivalent reliable latest-occurrence ordering independently of unique collection membership. Keep the existing restart-after-three-seconds behavior, captured replay-list navigation and contribution queue order. Browsing or saving a recording must not count as hearing it.

**Enough evidence to close.** The exact 1→2→3, replay-1, Return-3, Previous sequence selects 1. Preserve the ordinary restart behavior. [Pinned soundtrack source](https://github.com/calderwong/hapa-verseUs-prototype/blob/e04286188e13800e588557bd5cb53a9b0e3724c0/src/hapa/presentation/soundtrack.js); [diagnostic result](evidence/2026-11-25/review-13/transport-state-result.json).

## R13-04 — P2: compact panels must preserve the opponent and reachable controls

**Player context.** Music, Orders and conversation share space around the board. Red's face should remain a usable social focal point, and opening a panel must not push transport or song actions outside the window.

**Live evidence.** At 700×900 in Home, the closed deck measured x=247..687 and y=61..173 and covered Red's eyes/upper face. With Orders and Music open, the 440px deck measured x=-85..355. Previous/Pause and collection Play actions were clipped beyond the left edge. This is consistent with source sizing and reservation logic; it is not merely a screenshot preference.

**Correction.** Account for both reserved edges when sizing and positioning. When expanded panels cannot coexist, use one active expanded side panel: opening the requested panel collapses the previous panel while preserving its draft, search, selected tab and scroll. Give the compact deck a reserved position that avoids Red's face at normal Home. Essential transport, Ready, panel controls and conversation input remain reachable. Preserve native scrolling, focus and exposed-board gestures.

**Enough evidence to close.** Check ordinary desktop and 700×900 in one connected journey, including reopening preserved panel state. Do not add a broad device matrix or hide essential controls to conceal overflow. [Pinned styles](https://github.com/calderwong/hapa-verseUs-prototype/blob/e04286188e13800e588557bd5cb53a9b0e3724c0/src/hapa/presentation/versus.css); [live observations](evidence/2026-11-25/review-13/live-observations.md).

## R13-05 — P2: replacing a match should release its old board resources

**Player context.** New match is part of development and ordinary repeated play. Replacing a table repeatedly should not retain every previous board's GPU allocations.

**Evidence.** `app.js` removes the old `view.root` but has no complete BoardView disposal path. Response 13 reports about 1,100 additional geometries per New match. This is an existing BoardView lifecycle defect, not evidence that the newly authored scenery leaks: that scenery has explicit disposal and a late-result fence. The numerical growth comes from the author's measurement, not a repeated reviewer benchmark.

**Correction.** Add idempotent teardown for resources actually owned by BoardView and its helpers. Establish order with table/avatar teardown; preserve working scenery/audio cleanup. Release owned geometry, materials, textures and any targets/listeners, fence pending work, and avoid disposing shared caches or owner-managed avatar resources.

**Enough evidence to close.** A short sequence of replacements after warmup should plateau within explained caches while the current board, Red and music still work. Zero retained resources is not an arbitrary acceptance requirement. [Pinned app source](https://github.com/calderwong/hapa-verseUs-prototype/blob/e04286188e13800e588557bd5cb53a9b0e3724c0/src/hapa/presentation/app.js); [author's response](2026-11-25-ui-design-response-13.md).

## R13-06 — One art refinement: make the place recognizable from normal Home

**Design judgment from live review.** The table's construction is a good foundation. An angled view shows cedar, brass, thickness and legs much better than the former floating board. At ordinary desktop Home, however, broad dark paving seams and flat green moss patches dominate the frame. The coastal setting largely falls outside that composition. The experience currently reads more strongly as a board over oversized paving than as an inhabited coastal table.

**Selected refinement.** Quiet the floor's contrast and tune its visual scale. Integrate moss along joints/edges and with the surrounding material/value treatment. Give normal Home at least one recognizable coastal cue without requiring the player to hunt with the camera. Reveal enough crafted table structure and contact to establish the place. Preserve readable pieces, Red's opposite-seat scale, the banks, close inspection and the board's cubic ground/air space.

This is one composition/material refinement within the delivered scene. It does not require a new island, a camera redesign, extra visualizer systems or more bloom. Source geometry places the underside well below the deepest band; the submitted -3 capture shows layer selection over a mostly flat field, not a completed excavation witness. Do not turn that evidence limit into an unrelated terrain campaign.

Musical response should remain subordinate to gameplay. The author discloses that much of the mode-comparison evidence precedes final normalization. If the art pass changes response, make one brief final Subtle check with quieter and louder music, then stop tuning. CJ should judge the integrated Home candidate; passing tests cannot establish its visual quality. [Pinned scenery](https://github.com/calderwong/hapa-verseUs-prototype/blob/e04286188e13800e588557bd5cb53a9b0e3724c0/src/hapa/presentation/scenery.js).

## Next milestone and stop condition

Assemble R13-01–06 together under [Loose Screws](../workflows/LOOSE_SCREWS.md), using small checks only for concrete uncertainty during assembly. Then run the three transport proof families, one compact-layout/restart/art journey and the required integrated `npm run check`. Reuse unchanged owner and gameplay evidence. Do not rerun the historical matrix after every edit or extend the task into new features.

Publish one response with exact source/running identity, focused results, purposeful captures, resource observations and remaining limits. Update the review index/checkpoint and append the canonical Overwatch workflow with its receipt or access limitation. Handoff to CJ for review, then end this work item and automatic continuation. The reviewer did not read or alter current Overwatch state in this review.
