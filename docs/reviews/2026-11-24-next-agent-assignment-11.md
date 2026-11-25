# Assignment 11 — A seated opponent and reliable table interactions

**Date:** 24 November 2026  
**Starting reviewed source:** 3b812f1877c3d00b080268e57fce5137e574669d.  
**Read first:** AGENTS.md and available local grounding; [review index](README.md); [Review 10](2026-11-24-ui-design-review-10.md); [addendum 05](../requirements/2026-11-24-human-feedback-addendum-05.md); [current integration checkpoint](../integrations/IMPLEMENTATION_CHECKPOINT.md); [Loose Screws](../workflows/LOOSE_SCREWS.md).

## 1. Outcome

Make Red feel like an opponent seated directly across the Hapa Versus table. His face and upper body must read at normal Home framing, with a fixed seat in the environment, believable table occlusion and camera behavior that preserves the game.

Retain the already connected Harbor performer, music owners and optional model controller. Tighten the concrete conversation, playback/Keep and decision-admission defects from Review 10 in this same bounded candidate. A larger corner portrait is not the required result.

This is a successor to the integration attachment, not a restart of Assignment 10 or a goal to drain every open card. Existing gameplay repairs and default v3_07 remain in force.

## 2. Reconcile the current checkout once

Inspect git status, branch, recent commits and relevant local/owner work before changing anything. Fetch the notes without resetting, cleaning or overwriting another agent's changes. Compare later local work with the reviewed pin; a finding already corrected needs a revision and evidence, not another implementation.

Read the existing Overwatch hapa-versus state through its actual local interface. Use its append-only workflow for material progress and the handoff. Do not invent board commands or a second task system. If unavailable, state that limitation and continue useful authorized work.

Reuse the running dev server and owner services where practical. Record the exact live setup and any owner-source differences. Existing source/identity boundaries remain intact; changing the Avatar's scene placement does not require broadening voice, memory or tool permissions.

## 3. Assemble the coherent whole

### A. Spatial opponent and camera — R10-01

Implement the addendum's seated composition as a real presentation attachment.

- Anchor the bound Avatar seat on the table centerline beyond that seat's full legal territory, banks and effects/interactions.
- Reuse the owner's rendered output on a transparent scene surface. Inspect its alpha/frame/cleanup seam before building the consumer. No vendor/lumina edit or engine pin change is expected.
- Author torso/head dimensions, pivot and seat/table relationship. Eliminate the default upper-right portrait card; the figure should persist quietly in the environment.
- Fit the Home camera to actual elevated Avatar bounds together with the useful board. Keep tactical and close-member fits independent. Preserve Return, Home, rotation and zoom behavior.
- Keep the seat fixed during orbit. Define a frontal-rig side/back fallback without restricting 360-degree camera control. Use depth and a restrained overlap fade; do not draw the body through the board.
- Keep input routing separate: social interaction cannot become a board command. Preserve keyboard access, concise captions and an unobtrusive way to mute or open conversation.
- Detach the music strip from the Avatar's body/panel. A small independent Now Playing surface is enough; a decorative music device is optional and must not delay this candidate.

Treat the addendum's size ratios as starting art guidance. Fit one convincing composition with a readable board; do not turn every ratio into a separate optimization loop.

### B. Conversation and performer lifecycle — R10-02

Initialize the repeat/state structures for a first question in Quiet mode. Preserve draft text, selection and focus while the performer changes state. Give the current preparation a finite deadline and a clean error/finish path for a malformed current reply. Keep stale/disposed callbacks fenced.

Clean up successful, failed and superseded attachment paths. Reuse one performer/audio owner. Voice off must leave the opponent present; use supported silent reactions only if the owner exposes them.

### C. Playback identity, Keep and recovery — R10-03/04

Make the selected queue entry, active audio and actual heard evidence agree. On track changes, pending fetches, Not listening and resume, prevent old audio from playing under a new title or resuming after the listener opted out. Fence by a per-request/entry generation, not only an array index that might repeat.

Bound the wait for acquisition/playback start. Let the queue controller advance past an unusable entry once; do not create an indefinite retry chain or a separate queue authority. Local mute/listening remains local.

Make the displayed retry action retry initial Keep failure and saved-reference acquisition failure. Preserve owner idempotency. Separate asset retention from discovery encounter identity so two introducers can be recorded for one retained file. Never invent heardAt for an offer that did not actually play.

Preserve creator/generator/source/introducer distinctions and owner-reported offline status. Do not build remote synchronized listening, library UI, export or re-sharing in this assignment.

### D. Admission and cancellation — R10-05

The focused review probes are supplied under the evidence folder. Use them as witnesses, not as a demand to grow the suite indiscriminately.

- If jointly selected model destinations cannot all be realized, reject that proposal to the stored fallback with an accurate reason. Do not claim selections were admitted after silently substituting or dropping them.
- Validate proposal shape inside the decider. Malformed choices must use the request's stored fallback and produce a rejection receipt; avoid host recomputation of a second heuristic plan.
- Bind response receipts to input hash as well as request ID and current decision state. Accept exactly one recognized response choice; retain the prepared fallback for rejection.
- Cancel outstanding requests when a match is detached. Keep deadline and generation checks because cancellation alone cannot guarantee a reply disappears.
- Keep accepted plans/actual response answers in replay and provider diagnostics outside it. Preserve the single Ready path.

This is admission correctness, not an assignment to improve playing strength, explain the old long-match stall or design a new coordination planner.

## 4. Fit, then tighten with bounded evidence

During assembly, check only uncertain interfaces, changed critical boundaries and observed failures needed for the next dependency. A file edit or commit is not a full-suite trigger.

Once the connected candidate fits:

| Witness | What it must establish |
| --- | --- |
| Home composition | Readable seated Red opposite the human, actionable board/banks, no portrait-card notification treatment |
| Orbit / reverse view / tactical | Stable world seat; deliberate limited-art behavior; existing camera freedom; board remains usable |
| Member inspection → Return → Home | Unit details own the close view, command context survives, prior pose and Home composition have distinct correct behavior |
| Conversation | First Quiet question works; typing survives a speech transition; late/malformed/failed preparation clears without stalling play |
| Music switch/listening | A → next pending → Not listening → resume never pairs the wrong source/title/Keep or plays after opt-out |
| Keep | One failure/retry recovers; one file can retain distinct discovery attribution; unheard save has truthful provenance |
| Model boundary | Joint-funding witness, malformed plan and response hash/shape cases use accurate admission or the exact stored fallback; detach cancels and still fences |
| Connected owner | One actual bound performance and current owner playback/Keep interaction when available; unavailable-owner fallback remains playable |

Combine witnesses where one short journey proves several points. Use focused automated checks for the reproduced admission and asynchronous identity defects where useful. Do not unit-test decorative coordinates or write tests that restate the implementation.

Run the AGENTS-required npm run check at the integrated candidate. Fix related failures in a batch and rerun affected checks; broaden only for concrete remaining risk or a required gate. Do not automatically rerun all historic browser contracts, repeat the 34/111-Tick campaigns or benchmark models.

Use a normal desktop size around 1440×900 or 1920×1080 for the main visual evidence, with one useful wide-view check if practical. Capture Home, a representative orbit/side policy and close inspection; add another only if it proves a distinct unresolved point.

## 5. Handoff and closure

Add one dated response using the repository report template. Include:

- Implementation revision, running revision/dirty state, default profile and effective A/B controllers, Avatar, model and soundtrack settings. The current URL/preset does not carry all Table choices; state them explicitly.
- What changed for R10-01–R10-06, exact checks and observed results, and any genuinely blocked requirement.
- Captures from the declared candidate and a short live link/setup for CJ.
- Owner revision/digest or bounded local diff reference for the Harbor renderer, music peer module and Harness adapter. Do not claim unpublished owner code was independently reviewed.
- Corrected response-test coverage and music scope wording. Local two-process playback is not remote synchronized listening; retained API entries are not a finished library/export UI.
- Overwatch append receipt or a clear statement that it could not be updated. Put qualified work into Review; CJ accepts Done.

Keep the current review index pointed at Review 10 until the next review, add the implementation-response link and update the integration checkpoint to match the delivered state. Preserve earlier evidence as history.

After the handoff, end this work item and any automatic continuation created for it. Do not begin an unrelated polish or board-drain cycle. If a required owner capability is genuinely blocked, finish independent work, name the exact missing seam, and leave the blocked gate visible rather than retrying unchanged experiments.

## Copyable kickoff

Continue the current Hapa Versus checkout under Loose Screws. Read AGENTS.md, docs/reviews/README.md, Review 10, human-feedback addendum 05 and Assignment 11 dated 2026-11-24. Reconcile with reviewed commit 3b812f1 and preserve later/local work.

The selected outcome is Red seated in the game environment across the table, at a believable opponent scale. Reuse the real Harbor Mesh performer, attach it to the scene outside the opponent's Card banks, and compose its head/torso, seat/table occlusion and Home camera together. Preserve 360-degree orbit, tactical play, close member inspection, Return and keyboard access. The old corner portrait card is superseded.

Complete the assignment's bounded conversation, music identity/Keep/retry and model-admission corrections while assembling that scene. Preserve current gameplay, owner identity/permission boundaries and one Ready. Do not rebuild owners or add remote music sync, library/export UI, a new model planner or unrelated polish.

Assemble the connected candidate first, then fit/tighten it with the supplied focused witnesses, the required final npm run check and a short actual changed-journey playtest. Reuse unchanged evidence. Publish one response with exact revisions/settings, before/after visual evidence, check results and remaining limits; append the existing board workflow and hand off to CJ for acceptance. End the work item after that handoff.

