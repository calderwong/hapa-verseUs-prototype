# Assignment 14 — Finish transport, compact layout and the Home composition

**Date:** 25 November 2026, America/Los_Angeles.  
**Reviewed baseline:** main `e04286188e13800e588557bd5cb53a9b0e3724c0`; implementation `c42649b7127e49addba68a82101dff5046913f74`; engine `ba838cca09ba43afceda0452b63d28df4cbf7f72`; profile `hapa_open_10x9_v3_07`.  
**Read with governing requirements:** [Review 13](2026-11-25-ui-design-review-13.md), [addendum 06](../requirements/2026-11-25-human-feedback-addendum-06.md), and the [dusk-island companion](../integrations/dusk-island-table-and-music-v1.md). [Response 13](2026-11-25-ui-design-response-13.md) records the delivered candidate and its evidence limits.

## 1. Selected outcome

Preserve the delivered music collection, quiet Keep, retained playback, local replay/Return, seated Red and coastal setting. Complete the six findings below as one connected correction. The current table construction and owner integrations are useful foundations. No new world, player architecture, playlists, sharing/export, synchronized listening, owner redesign or gameplay change is selected.

Read AGENTS, shared local grounding, the review index and linked documents. Reconcile the actual checkout, uncommitted work, dependency pins and running server before editing. A listening port alone does not prove which source it serves. Preserve later work and report material differences from this baseline. Use the existing owner connections; missing live access limits that witness, not independent implementation.

## 2. Required corrections

### R13-01 — A delayed graph resume must respect a subsequent Pause

**P1.** The actual-source diagnostic reproduced Play waiting on AudioContext resume, then Pause, then the old resume completing and calling `audio.play()`. Sound restarted while listening intent and UI remained paused.

Carry the selected item, generation and listening/disposal identity through the start operation. Validate before waiting and again immediately after graph resume, **before the audio-play side effect**. Abandon stale starts quietly. Keep the existing post-result/error fencing and finite deadline for a current attempt. Apply the same boundary to load and resume callers, table playback and local replay. A new selection, Pause or disposal must invalidate the earlier start without affecting the current valid attempt.

### R13-02 — The main transport action must perform its displayed verb

The fresh live review found initial **Play** first changed the prepared player to paused; the second press played. The focused diagnostic reproduced the related failed/finished-state mismatch. Finished table playback resumed near the recording’s end instead of usefully restarting it.

Make the action state-aware rather than blindly flipping persisted listening intent. One Play starts a prepared selection or retries a recoverable stopped selection. Pause pauses an actually playing or pending start. For a completed table track, expose **Play again** and restart that selected recording at zero. Preserve deliberate replay-end stop and the table bookmark’s listening intent.

Treat browser/context activation blocks separately from unusable media. Keep the valid recording selected and offer real gesture-based Play recovery; do not mark it skipped or advance the queue because the audio device requires activation. Preserve finite handling for genuinely unavailable media. Labels, accessible names and state feedback must describe the action that will occur.

### R13-03 — Previous must follow actual recent listening

Near the beginning of a table song, Previous currently reads the unique collection’s first-heard order. Hearing 1, 2, 3, replaying 1, returning to 3, then pressing Previous near its beginning selects 2 instead of the recently heard 1.

Track a bounded playback chronology or reliable latest occurrence independently of collection membership. Previous should select the most recently heard eligible other recording. Keep the existing restart-after-three-seconds behavior, captured replay-list navigation and contribution queue order. Saving, browsing and acquiring a song are not listening events.

### R13-04 — Compact panels must leave every control reachable

At 700×900, the closed deck covers Red’s eyes. With Orders and Music open, the 440px Music element spans approximately x=-85..355, clipping Previous/Pause and collection Play actions outside the viewport. The corrected desktop beside-face placement should remain.

Use available width for both positioning and sizing. When expanded side panels cannot coexist, use **one active expanded side panel**: opening the requested panel collapses the previous expanded panel while preserving its draft, search, tab and scroll position. Reopening restores that state. Apply this coherently to Music, Orders and expanded conversation, and account for other reserved panels.

Choose a compact deck position that avoids Red’s face at normal Home. Keep Ready, transport, panel collapse and conversation input/settings reachable; preserve native scroll, keyboard focus and exposed-board gestures. Do not squeeze panels into a negative-width band or solve overflow by hiding essential controls.

### R13-05 — Release the previous BoardView’s owned resources

New match removes the old board root without complete disposal. Response 13 reports approximately 1,100 additional GPU geometries per restart. This existing defect is separate from the new scenery, whose cleanup is already explicit.

Add idempotent BoardView teardown with clear ownership for its helpers, geometries, materials, textures and any render targets/listeners. Establish teardown order with the social/music table and preserve the working scenery/audio cleanup. Cancel or fence pending results. Do not dispose shared engine caches or Avatar-owned resources merely because their objects were attached beneath the board root.

After warmup, repeated match replacement should stop accumulating old board resources while the current board, Red and music remain functional. A plateau with explained retained caches is the target; an arbitrary zero counter is not.

### R13-06 — Refine the Home view once

The coastal assembly exists, and low orbit reveals its cedar/brass structure well. At normal desktop Home, oversized high-contrast flagstones and flat moss polygons dominate; the coastal setting is difficult to recognize.

Make one cohesive refinement: quiet the floor seams and tune their scale; integrate moss with the stone’s material/value treatment; provide a visible coastal cue from normal Home; and reveal enough crafted table structure to establish the place. Preserve Red’s useful opposite-seat scale, field size, tactical clarity, banks, deep-band clearance and close inspection. Keep musical response subordinate to play.

Retain the current setting and camera behavior. Adjust composition/materials and, if necessary, bounded Home framing without sacrificing readability to display more scenery. CJ judges the resulting art candidate; no screenshot-similarity score or endless polish loop is requested.

## 3. Loose Screws execution

Frame the six corrections briefly, then assemble them together. Use small focused checks only when a contract uncertainty or observed defect would otherwise block assembly. Batch related corrections before qualification. Preserve quiet Keep and exact recording/provenance behavior; do not repeatedly re-prove unchanged ownership contracts.

Once connected, perform the changed proofs below and the AGENTS-required final `npm run check` on the integrated candidate. Rerun affected checks after a correction; do not repeat the full historical browser matrix or broad suite after each edit.

## 4. Bounded evidence

Use three focused transport proof families:

1. Delayed graph resume followed by Pause, with no late play; confirm the current valid attempt still starts.
2. Initial-ready, recoverable failure, finished and activation-blocked actions: one displayed Play works, completed playback restarts usefully, and activation recovery retains the selected recording.
3. The 1→2→3, replay-1, Return-3, Previous chronology above.

Then combine compact layout, restart and art into **one short UI journey**: ordinary desktop and 700×900; open the competing panels, preserve/reopen draft/search/scroll, use reachable transport and one Ready; replace matches enough to distinguish warmup from accumulation; inspect normal Home, useful orbit and close formation. Capture the revised Home and compact panel state.

Distinguish actual browser/owner observations from fixtures. Earlier -3 imagery showed a selected cutaway, not a completed digging exercise. Earlier response-mode comparison mostly predates final normalization; carry that limit forward unless changed dependencies require a targeted recheck. If this refinement changes musical response, make one brief final Subtle check with quieter and louder music. No new benchmark campaign is selected.

## 5. Handoff and stop

Publish one dated response with exact implementation/running identity, dirty state, changes against R13-01–06, focused results, final check, purposeful captures, resource observations and remaining limits. Reuse verified unchanged owner identities. Update the review index/checkpoint and append the canonical Overwatch workflow once, citing its receipt or access limitation. Work goes to Review; CJ accepts Done and the art direction.

Give CJ the complete candidate and one concise art decision to assess. End this work item and automatic continuation after handoff. Do not start another board-drain cycle or unrelated enhancement.

