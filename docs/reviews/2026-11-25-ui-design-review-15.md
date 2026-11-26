# Review 15 — Close the selected corrections and hand the candidate to CJ

**Date:** 25 November 2026, America/Los_Angeles.  
**Repository:** `calderwong/hapa-verseUs-prototype`.  
**Reviewed main:** `73c62bd539e76c19c2c31c50962028f04fdf1788`.  
**Implementation:** `da76b0bb04ab7b8b6af6b25e6a0a8aafcf387b42`.  
**Engine:** `ba838cca09ba43afceda0452b63d28df4cbf7f72`; profile `hapa_open_10x9_v3_07`.

## Verdict

**Both corrections selected in Assignment 15 close in the reviewed scope. The current music/opponent/setting milestone is ready for CJ's ordinary playtest. No further automatic coding assignment is selected by this review.**

The fresh browser journey reproduced the previously failing resize and roster transitions successfully. The effect-lifecycle proof independently passed for expired and still-running effects. The implementation stayed within the agreed boundary: only `app.js`, `board-view.js` and `fx.js` changed in production source. The already-reviewed music transport and authored scene were preserved.

This closes the two selected findings, not every historical backlog item or complete-game requirement. CJ's art judgment and Done acceptance remain separate. Keep the current scene candidate and let actual play determine the next product priority. [Response 15](2026-11-25-ui-design-response-15.md) is the implementation report; [evidence](evidence/2026-11-25/review-15/README.md) identifies what was independently checked, retained or submitted.

## R14-01 — Closed: composition now responds to available-space changes

### Why it closes

The earlier defect was that Music and Orders could remain expanded after narrowing the window, and Parties & Cards could cover the music controls. The new `App._reconcilePanels` evaluates the current open panels when their available space changes. A world resize observer and a coalesced reservation signature feed that policy; roster opening/closing now refreshes the reserved band directly. It retains the most recently deliberately opened panel, allows other panels when they fit, and collapses conflicting optional panels through their existing state-preserving methods.

Required game decisions remain reserved space and are not dismissible by this policy. The signature excludes moving face/label measurements, so normal scene animation is not a trigger for continual panel collapse or focus changes. Relevant source: [app.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/73c62bd539e76c19c2c31c50962028f04fdf1788/src/hapa/presentation/app.js), `_initEngine`, `_syncFreeSpace`, `_toggleRoster` and `_reconcilePanels`.

### Fresh live results

| Player action | Observed result |
| --- | --- |
| Open Orders and Music at 1440×900, then narrow directly to 700×900 | Orders collapsed automatically. Music remained expanded at x=247..687, retaining Kept and the `lantern` filter. The filter retained focus. |
| Check the two filtered recording Play actions after narrowing | Both action-center hit tests reached their own buttons. |
| Open Parties & Cards while Music is expanded | Music collapsed to its compact deck. Previous, Pause, Next, Keep, Mute and Music all received their own center hit tests; the roster no longer covered Pause. |
| Press Pause with the roster open, then Play | The first action paused the current song; Play resumed it. |
| Close roster and reopen Music | Kept and `lantern` were preserved. |
| Switch conversation → Music → conversation with an unsent draft | The draft was retained, input focus returned, and Music state survived. The reviewer cleared the draft without sending it. |
| Return to 1440×900 and open roster, conversation and Music | All three coexisted again. |

This supplies direct closure of the two original live failures while preserving the useful existing behavior. [The live record](evidence/2026-11-25/review-15/live-observations.md) contains measurements, action boundaries and cleanup.

## R14-02 — Closed: the effect helper releases its dormant textures

The previous cleanup traversed attached scene objects and missed the per-board effect textures once their sprites had expired. `HitFX.dispose()` now owns that lifetime explicitly: it releases active-effect parts and its burst/rune/arrow textures, clears references, detaches its group and returns null on repeated disposal. BoardView calls it before generic scene collection, so the detached effects are not collected twice.

The independent focused proof ran once against the actual current HitFX, BoardView disposal and resource collector with the disclosed Three/canvas fixtures:

| Case | Result |
| --- | --- |
| Effect already expired, with no children left attached | All three cached textures received exactly one disposal call. |
| Effect still running | Running-part materials and the cached textures were released once. |
| Board/helper disposed again | Both returned null; no duplicate texture disposal. |
| Shared Three Sprite quad | Zero disposal calls. |

The result is `pass: true`, exit 0, with zero network requests. The new probe keeps its own texture handles before teardown because the corrected helper clears those references; this is a valid adaptation of the old observation method. Historical results remain unchanged. [Independent result](evidence/2026-11-25/review-15/helper-lifecycle-result.json); [pinned effect source](https://github.com/calderwong/hapa-verseUs-prototype/blob/73c62bd539e76c19c2c31c50962028f04fdf1788/src/hapa/presentation/fx.js); [pinned board source](https://github.com/calderwong/hapa-verseUs-prototype/blob/73c62bd539e76c19c2c31c50962028f04fdf1788/src/hapa/presentation/board-view.js).

The author's short restart witness follows a rendered Supply effect and its expiry. It supports the relevant cleanup path, but its small remaining renderer-count differences were not individually traced. This review does not claim a universal GPU plateau or measured CPU-heap stability. That limit does not reopen the demonstrated texture-ownership defect.

## Evidence retained rather than repeated

The soundtrack, signal, deck, Table, opponent UI, scenery, resource collector and soundtrack tests are byte-identical to the preceding reviewed implementation. Review 14's six passing soundtrack tests and corrected transport diagnostics remain applicable. The current source register records those unchanged dependencies.

The author reports the required integrated check passing 158 tests plus smoke match, peer match and build. That is submitted evidence; the reviewer did not repeat the broad campaign. The fresh UI did not expose its running commit, so live observations are not asserted to identify the pinned Git bytes. Source verification and the helper proof are pinned separately.

Required-decision layout was source-inspected rather than newly exercised live. The two tested CSS viewport sizes and control-center hit tests are a focused closure, not a device matrix or every-pixel guarantee. Earlier response-mode, excavation and art limits remain as disclosed. No new broad campaign is selected merely to eliminate every qualification.

## Next action: ordinary human play

Use the current default setup: human A, heuristic bot B, seated Red, seed 1 and profile `hapa_open_10x9_v3_07`. Play a normal session at your usual window size. Use music, inspection and optional panels when you naturally want them; this is not another prescribed engineering matrix.

Useful feedback is a concrete moment and its consequence:

- **During movement or card use, what did you expect to happen, what happened instead, and did that interrupt the turn?** This separates a rules mismatch from information that is merely hard to find.
- **When inspecting a piece or card, could you understand the needed action without losing the board or your place?** Note the zoom level or panel that made the interaction awkward.
- **When keeping, replaying or returning to the table's music, did the player preserve what you wanted to hear?** Record the visible mode and control if the outcome was surprising.
- **While actually playing, did Red and the coastal table feel present without pulling attention away from decisions?** This is the next useful art judgment; the current quiet far-edge coastal cue remains the working candidate.

For a defect, a short expected/actual description plus the Tick, viewport, panel sequence and optional screenshot is enough to begin triage. Do not require CJ to produce a complete diagnostic package before feedback is useful. Record worthwhile lower-priority ideas separately from blockers without abandoning them.

## Local-agent handoff and stop

The review index now points to human playtesting. There is no Assignment 16 generated merely to continue the cycle. The local agent should reconcile this review with any later work, preserve the current candidate, and wait for CJ's concrete feedback or a new selected goal. It should not restart a board-drain loop, broad test campaign, scene-polish cycle or unrelated enhancement.

Overwatch remains canonical task state and CJ accepts Done. This reviewer did not inspect or append current board state; Response 15 reports HV-66 in Review and its creation receipt. Source review, testing, the playtest recommendation and human acceptance must remain distinguishable.
