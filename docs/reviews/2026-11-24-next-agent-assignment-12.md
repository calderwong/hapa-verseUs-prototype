# Assignment 12 — Finish the seated table's interaction boundaries

**Date:** 24 November 2026 (America/Los_Angeles)  
**Reviewed source:** `7d4a96bd753f8b0e79ac46e3ad0c1e206e54ea36`  
**Implemented scene baseline:** `bafc36f1e40c46ab69cd8b239e6014acbc1393df`  
**Read first:** AGENTS.md and available local grounding; [review index](README.md); [Review 11](2026-11-24-ui-design-review-11.md); [Loose Screws](../workflows/LOOSE_SCREWS.md). Addendum 05 remains the selected presentation; default gameplay remains v3_07.

## Outcome and scope

Keep the delivered Red seated across the table. Complete three concrete boundaries: conversation input/placement, music resume cancellation, and malformed model-reply settlement. Assemble them as one bounded patch, fit the changed journeys, then qualify and hand off. This assignment does not reopen the scene design, prior gameplay repairs or the whole integration backlog.

Inspect the current branch, local changes and recent work once. Fetch the notes without resetting, cleaning or overwriting another agent's work. Reconcile later changes against the reviewed pin. If a finding is already fixed or cannot be reproduced, record the relevant revision and observations rather than implementing a duplicate correction.

Read the existing Overwatch `hapa-versus` board through its actual local interface and use its existing append-only workflow at material milestones. If unavailable, state that and continue the useful authorized work. These files preserve review evidence; they are not another task-state system.

## 1. Conversation owns its gestures and fits the screen — R11-01

The reviewer selected text in Red's conversation field and the camera panned at the same time. Wheel input over the conversation also zoomed the board. `BoardCamera._bind()` currently excludes buttons but not the conversation's input/history from drags, and its wheel handler always performs camera input.

Give the social surface ownership of its pointer, text-selection and scroll gestures, using the existing overlay/input pattern. History must scroll normally. Board pan, zoom and orbit must remain usable when started on the exposed game canvas; blocking the entire world while conversation is open is not the intended behavior. Preserve keyboard open/close, focus and the draft.

In the same change, fit or dock the actual expanded conversation bounds. `Table.update()` reserves 260 px at the right edge while `.opp-panel` is 300 px wide; the game world clips overflow, and bottom placement is not bounded. Do not merely substitute another fixed width. Account for the current expanded size and available area so the question field, settings and collapse route remain reachable near screen edges and on resize. Keep the small face-adjacent nameplate/caption when collapsed.

**Witness:** Open conversation, type an unsent draft, drag-select it, scroll enough history to prove ordinary scrolling, use camera gestures on the uncovered board, then open/position the conversation near an edge and resize once. Confirm camera stability during panel input and useful board controls outside it. One short live journey is enough; do not add tests for decorative pixel coordinates.

## 2. A cancelled resume cannot fail the new song — R11-02

`Soundtrack._resume()` calls `audio.play()` and its eventual rejection uses the mutable `this.now`. If the player chooses Not listening or Next while play is pending, that old rejection can mark the current entry failed and schedule an unintended skip.

Capture the resumed entry and generation. Apply the same supersession, listening and disposal checks used by initial playback to every resume completion path. Only a still-current attempt can fail its own entry. Give resume the existing finite playback-start policy; clean up its attempt/deadline when it settles or is superseded. Preserve the current queue authority, local listening preference, heard evidence and owner-backed Keep. No retry chain or new music coordinator is needed.

**Witness:** Use one controlled pending-play case, interrupt it with Not listening/Next, then reject the old promise. The current selection and listening intent must survive without an erroneous failure or skip. Establish that a genuinely current failed/timed-out start still reaches the finite existing failure policy. Use a focused stub where deterministic timing helps; briefly check ordinary resume in the existing local game if the owner is available. Do not rerun all prior Keep/peer/music experiments when their dependencies are unchanged.

## 3. Every malformed model wrapper settles through fallback — R11-03

A stubbed HTTP 200 response containing parsed JSON `null` left the actual controller waiting after its deadline. `_ask()` sets `done`, deletes its settlement handle and clears the timer before dereferencing the wrapper. The throw therefore bypasses both normal settlement and deadline recovery.

Validate/normalize the outer reply before irreversible completion, and route interpretation exceptions into one explicit settlement path. Return the request's existing prepared fallback and an accurate receipt. Cover the shared arrival/late-reply handling without creating another planner, recomputing heuristic fallback or weakening the request/input/hash/generation checks. Preserve detach cancellation and the single Ready flow.

**Witness:** Add the successful-HTTP/null-wrapper case to `tests/hapa/model-decider.test.js`. It must settle within its bound, produce no unhandled rejection, and return the exact stored fallback with a truthful outcome. The ten existing targeted tests already pass at the reviewed pin; retain their admission, response and detach coverage. No paid-model call or long match is required to prove this transport correction.

## Assemble, fit and tighten once

During assembly, use focused checks only for an uncertain contract, an observed failure or the changed critical boundary. A file edit, commit or compaction is not a full-suite trigger. Batch related fixes and keep one short checkpoint.

After the three connections fit together, run the AGENTS-required `npm run check` at the integrated candidate, plus the short changed UI journey above. If a related failure appears, batch the repair and rerun affected checks; broaden only for a remaining concrete risk or required gate. Reuse the existing seated-composition, Quiet/draft, Keep, original music-switch and model-admission evidence unless the relevant dependencies changed. Do not repeat historical browser campaigns, 34/111-Tick matches or model benchmarks.

No production engine pin change, owner rewrite, replacement Avatar art, remote music synchronization, retained-library/export UI, playing-strength tuning or general lighting redesign belongs to this assignment. Preserve worthwhile observations in the handoff for CJ to choose later.

## Handoff and stop

Publish one response using the existing report template, covering R11-01 through R11-03. Include exact implementation and running source/dirty state, profile and effective A/B/Avatar/music settings, focused check results and the required final gate result. A small capture or textual interaction witness is sufficient; reuse prior composition captures rather than producing another full gallery.

Record complete owner module digests/source identities where referenced, with running-process match or an explicit limit. Abbreviated hashes do not prove the bytes. Clearly separate historical aggregate metadata from new checks; the trailing old `respond: 0` block in response 11's controller probe does not describe the current test file. No private owner source publication is required.

Append the existing Overwatch workflow and include the actual receipt/link, or say it was unavailable. Put qualified work into Review; CJ accepts Done. Update the current implementation-response pointer while keeping Review 11 as the review until another review occurs. Preserve dated history and update the checkpoint only where this patch changes it.

**After that handoff, end this work item and any automatic continuation created for it.** Do not drain unrelated cards or start a new polish loop. An unchanged failure with no new hypothesis is a blocker to report, not a reason for indefinite repeated experiments.

## Copyable kickoff

Continue the current Hapa Versus checkout under Loose Screws. Read AGENTS.md, docs/reviews/README.md, Review 11 and Assignment 12 dated 2026-11-24. Reconcile reviewed commit 7d4a96b with later/local work without overwriting it.

The seated Red composition has landed; preserve it. Complete only the three bounded repairs: conversation gestures must stay with the panel and its expanded bounds must fit or dock; superseded music-resume callbacks must not fail/skip the current song and resume must have the existing finite start policy; a successful HTTP reply containing JSON null must settle through the model request's stored fallback with an accurate receipt instead of bypassing its deadline.

Assemble these together, run the focused witnesses and required final npm run check once the candidate fits, and play the short changed UI journey. Reuse unchanged evidence. Preserve current gameplay, owner boundaries, one Ready and the existing Avatar art. Publish one response with exact revisions/settings, actual verification and remaining limits, append the existing board workflow, and hand off to CJ. End this work item after the handoff; do not begin another design, benchmark or board-drain cycle.

