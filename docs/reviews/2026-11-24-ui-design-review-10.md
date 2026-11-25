# Review 10 — Seat the opponent at the table

**Review date:** 24 November 2026 (America/Los_Angeles)  
**Reviewed source:** [3b812f1877c3d00b080268e57fce5137e574669d](https://github.com/calderwong/hapa-verseUs-prototype/commit/3b812f1877c3d00b080268e57fce5137e574669d), main.  
**Delta:** One implementation commit after integration-design publication 7cdd8e9; 14 changed files.  
**Default profile:** hapa_open_10x9_v3_07. Engine gitlink remains ba838cca09ba43afceda0452b63d28df4cbf7f72.  
**Next:** [Human-feedback addendum 05](../requirements/2026-11-24-human-feedback-addendum-05.md), [Assignment 11](2026-11-24-next-agent-assignment-11.md), [review evidence](evidence/2026-11-24/review-10/README.md).

## 1. Assessment

The new integration is substantial: the code attaches the real Harbor Mesh performer, scoped voice, owner-backed music playback/Keep, and an optional Harness decision adapter. Preserve those connections.

The central design change is equally clear: **Red needs a physical seat across the game table, with a face and upper body large enough to read at Home.** The current corner card communicates status or a companion widget. It does not make the player feel that the opponent is sitting there.

The reviewer recommended the earlier compact perch. The coding agent followed that direction. CJ's latest feedback changes the composition target; enlarging the same HUD card would not meet it. The next version needs a stable scene position, table-relative scale, depth/occlusion and deliberate camera behavior.

Review 09/Assignment 10's historical repairs remain technically complete in their reviewed scope. This pass does not reopen center travel, Pawn absorption, Ready acknowledgment, current-Tick Mana or the previous member-inspection work.

## 2. What was actually inspected

The review read the exact pushed implementation, current owner/checkpoint claims and submitted integration evidence. Source copies used for findings and probes were verified against Git blob IDs.

A fresh local browser inspection opened a temporary match with A human, B heuristic, seed 1, default v3_07, Red enabled and model assistance off. It inspected Home, rotated once and restored Home. It did not enable Sound, advance Ready/Ticks, Keep a song or ask Red a question. The existing user match was left untouched, and the temporary match tab was closed.

Observed viewport: 2838×1020 CSS pixels. The board canvas occupied 2828×928. The Avatar canvas was intrinsically 673×841, but its rendered content was only 62×78 inside a 64×80 portrait box. The upper-right dock was 340 pixels wide. The board rotated while the dock remained at the screen corner. This directly supports CJ's placement/scale critique. Live source identity was not exposed, so the browser observation is not an attestation that every running byte matched 3b812f1.

Only the six existing model-decider tests and focused source-only controller probes were run independently. All six existing tests passed. No full check, long match, live model request, new voice generation or repeat owner-transfer qualification was performed during this review.

Local screenshots were not published to the repository. The evidence folder contains the text observations, measured layout, source register, controller probes and results. Automatic approval review blocked the screenshot upload because explicit permission for publishing the local images was not established; publication continued with text-only material.

## 3. Credit the connected work, with its actual limits

| Area | Supported progress | Qualification boundary |
| --- | --- | --- |
| Avatar | Real RedPlayer import, scoped utterance route, Avatar/renderer/Voice-Card checks, match disposal and actual-playback ducking hooks | The submitted 34-Tick voice run is recorded evidence; this review did not replay voice. It used an automated no-order human seat and does not qualify seated presentation. |
| Music | Playback and Keep route through the listener's owner; retained state comes from that owner. Source/introducer and unknown creator versus generator are distinguished. | Submitted evidence records source shutdown, receiver restart, matching retained bytes and 2.51 seconds of browser playback. It is two processes on one Mac, not two machines or a completed library/export UI. |
| Model controller | Bounded board/option packet, host deadlines, legal-plan validation, heuristic fallback and separate diagnostics/replay inputs | The reported 111-Tick run was unfinished. Response admission was not exercised live. The current host test file does not exercise respond(), despite the checkpoint's test-coverage wording. |

Primary records: [implementation checkpoint](../integrations/IMPLEMENTATION_CHECKPOINT.md), [Milestone A](../integrations/evidence/milestone-a-full-match.json), [Milestone B](../integrations/evidence/milestone-b-keep.json), [Milestone C](../integrations/evidence/milestone-c-model-decisions.json).

## 4. Findings and bounded corrections

Priority describes this handoff's ordering, not a claim of production severity. R10-01 is the selected design outcome; the others tighten concrete defects in the newly attached paths.

### R10-01 — P1 / selected design: the opponent has no seat in the scene

**Context:** Table receives a world HTMLElement and appends a fixed dock. AvatarOpponent creates a DOM portrait canvas. CSS places it at the upper-right. There is no scene transform, table-relative size, perspective relationship or world occlusion for the body.

**Change:** Reuse the owner performer and attach its output to a scene-owned surface outside the opponent's full Card-bank footprint. Compose the chair/upper body/table and Home camera together. Preserve orbit, tactical play and close inspection. The full behavior and working art targets are in addendum 05.

**Evidence:** Fresh browser observation above; [Table](https://github.com/calderwong/hapa-verseUs-prototype/blob/3b812f1877c3d00b080268e57fce5137e574669d/src/hapa/presentation/table.js), [AvatarOpponent](https://github.com/calderwong/hapa-verseUs-prototype/blob/3b812f1877c3d00b080268e57fce5137e574669d/src/hapa/presentation/avatar-opponent.js), [CSS](https://github.com/calderwong/hapa-verseUs-prototype/blob/3b812f1877c3d00b080268e57fce5137e574669d/src/hapa/presentation/versus.css).

### R10-02 — P2 / source defects: conversation state can fail or disappear

**Context and evidence:** In say(), the repeat Map is initialized only for non-question lines, then written unconditionally. Quiet mode filters the greeting, so the first question can reach an undefined Map. Separately, speech start/end and preparation rerender the expanded panel, replace its input and can erase a draft or move focus. A returned job with the wrong current request ID/epoch is silently ignored without finishing the still-current preparation; the 35-second staleness check runs only after the request resolves and is not a fetch deadline.

**Change:** Initialize conversation state unconditionally; retain draft/selection/focus across performer updates; distinguish an obsolete callback from a malformed reply to the current operation; bound and cancel preparation, then clear its state. Keep captions and ordinary gameplay available. These are static code findings, not live question reproductions.

**Source:** [avatar-opponent.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/3b812f1877c3d00b080268e57fce5137e574669d/src/hapa/presentation/avatar-opponent.js), especially say(), _start(), _setSpeaking() and _render().

### R10-03 — P1 / source defect: the song shown and kept can differ from the song heard

**Context:** _playAt() changes the selected queue entry before stopping/replacing old audio. While the next blob loads, the previous song can still play under the new title and Keep target. A second path is Play A → Not listening → Next → Listening: the old audio.src can resume A under B's title. Switching to Not listening during a pending fetch does not prevent that fetch's completion from calling play(). Keep stamps heardAt even if the selected entry never played.

**Change:** Track selected entry, active audio and actual playback evidence explicitly. Stop/detach the old source on a committed switch, cancel/fence replaced requests, recheck listening before play and resolve the correct current source when listening resumes. Saving an unheard offer must preserve that fact. Bound playback acquisition/start and give the queue controller one finite failure/skip policy; a late response must not overwrite a newer entry. These paths are source findings, not independently replayed audio tests.

**Source:** [soundtrack.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/3b812f1877c3d00b080268e57fce5137e574669d/src/hapa/presentation/soundtrack.js), _playAt(), toggleListening(), _fail() and keep().

### R10-04 — P2 / source defects: Keep retry and discovery attribution are inconsistent

**Context:** A failed initial Keep stores keep-failed and offers “Keep (retry),” but keep() immediately returns that existing state. The other failure state permits retry in code but renders no retry action. Also, the page keys Keep solely by assetId, so another introduction of the same bytes can be suppressed before the owner records its distinct encounter.

**Change:** Make both relevant failure states retryable using the owner's idempotency behavior. Distinguish byte acquisition/storage identity from encounter/introducer identity: one file can have more than one discovery record without downloading twice. Duplicate clicks on one encounter remain idempotent. Keep “saved reference,” “acquiring” and “available offline” truthful. No owner storage redesign is required by this finding.

**Source:** [soundtrack.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/3b812f1877c3d00b080268e57fce5137e574669d/src/hapa/presentation/soundtrack.js), keep(), _poll(), _render(); compare the owner-reported dedup evidence in Milestone B.

### R10-05 — P2 / reproduced and source defects: model admission overstates what was accepted

Three focused probes establish a bounded correction set:

1. **Joint funding:** After six ordinary resolved opening Ticks, the model chooses two offered destinations at Tick 7. Funding the first prevents the second. The generated commands contain only the first destination, but the receipt claims both choices were admitted. The shared validator correctly accepts the remaining legal commands. A legality check does not establish faithful application of every selection.
2. **Response binding:** A prepared response snapshot with a valid counter receives Pass with a matching request ID and an all-zero wrong input hash. respond() admits it. Unlike planning, it omits the digest comparison and examines only the first response choice.
3. **Malformed proposal:** A choices object instead of an array throws from plan() without a rejection receipt. The host catch recomputes the heuristic plan instead of using the fallback already stored for that request. This loses the exact-fallback guarantee; the probe does not claim its particular opening commands necessarily changed.

**Change:** Reject unfulfilled jointly selected destinations to the stored fallback with a reason; this is the smallest acceptable route and does not require a new planner. Validate proposal shapes at the boundary. Bind response receipts as strictly as planning and require exactly one recognized response choice. Return the request's stored fallback on every rejection. Define explicit abstention semantics if empty planning choices are supported; do not mistake “no requested move” for a demonstrated model destination change.

The existing generation fence prevents old work from entering a new match, but reset does not cancel outstanding decider work until its deadline. Add disposal/cancellation while touching that lifecycle; retain the fence because cancellation is cooperative.

**Evidence:** [focused probe results](evidence/2026-11-24/review-10/controller-probe-results.json), [probe source](evidence/2026-11-24/review-10/controller-probe.mjs), [six test results](evidence/2026-11-24/review-10/model-decider-test-results.txt), [ModelDecider](https://github.com/calderwong/hapa-verseUs-prototype/blob/3b812f1877c3d00b080268e57fce5137e574669d/src/hapa/controllers/model-decider.js), [heuristic planner](https://github.com/calderwong/hapa-verseUs-prototype/blob/3b812f1877c3d00b080268e57fce5137e574669d/src/hapa/controllers/heuristic-bot.js), [host](https://github.com/calderwong/hapa-verseUs-prototype/blob/3b812f1877c3d00b080268e57fce5137e574669d/src/hapa/presentation/app.js).

No finding establishes why the submitted model match became idle at Ticks 98–111. Strategy tuning and long comparative matches are outside this assignment.

### R10-06 — P2 / handoff accuracy: distinguish attached scope from completed experience

The current soundtrack queue/revision/index is local to one JavaScript instance. The inspected code has no remote queue subscription or room clock. The evidence establishes a local soundtrack using two library processes, not synchronized playback across human clients. Scope “shared/everyone” wording accordingly until that connection exists.

The published Song Registry snapshot checked by this review does not contain the checkpoint's new peer-music module. This does not disprove the local implementation. It limits independent audit of that owner contract. Record the owner commit, or a bounded source digest/diff when publication is not authorized. The same principle applies to the live Harbor renderer and Harness adapter.

The checkpoint explicitly leaves library UI, export, re-sharing and remote-replica pruning incomplete. Preserve those limits. Correct the unsupported host-response test claim and identify the actual candidate/owner revisions in the next handoff. Do not publish other repositories merely to fill a traceability field.

## 5. Next scope and stop condition

Use Assignment 11 to build one integrated candidate: seated opponent composition, stable conversation, truthful music playback/Keep, and the bounded admission corrections. Assemble the visible whole early, fit it, then tighten the concrete defects. Do not finish every cosmetic detail of the chair before fitting the camera and board.

Reuse unchanged integration evidence. Run the repository's required final check once the candidate fits, with affected reruns only for actual failures. A short changed-journey playtest and the targeted boundary checks are sufficient; there is no assignment to repeat the 34/111-Tick campaigns, benchmark model strength or drain the whole board.

Hand off the exact candidate and evidence, mark appropriate work for Review through the existing Overwatch workflow, and stop this work item. CJ's visual/play acceptance remains separate. The reviewer did not inspect or update current Overwatch state, local unpushed changes, or the local shared-grounding files unavailable in this review environment.

