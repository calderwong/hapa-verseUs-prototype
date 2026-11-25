# Assignment 15 — Finish layout transitions and effect cleanup

**Date:** 25 November 2026, America/Los_Angeles.  
**Reviewed baseline:** main `3fc3f1b386a03ea2d3f307adc4391e090de4592a`; implementation `153b657ad28f640f6efa42739e3d1bc7f70ebc4d`.  
**Engine/profile:** `ba838cca09ba43afceda0452b63d28df4cbf7f72`; `hapa_open_10x9_v3_07`.  
**Read together:** [Review 14](2026-11-25-ui-design-review-14.md), [Response 14](2026-11-25-ui-design-response-14.md), and the [review evidence](evidence/2026-11-25/review-14/README.md), under AGENTS and the governing requirements.

## 1. Complete two remaining corrections

The transport fixes, ordinary compact-panel opening behavior, large BoardView allocation repair and one Home art refinement are delivered. Preserve them. The scene is now an art candidate for CJ; another environment-polish cycle is not selected.

Read the current review index and shared local grounding. Reconcile the checkout, later commits, uncommitted work and running application with the baseline before editing. Preserve other agents' work. Use the existing owner contracts and services. This assignment completes two concrete boundary cases; it adds no world, music architecture, owner integration or gameplay rule.

## 2. R14-01 — Reconcile panels when the available space changes

**Player context.** A player can open Music and Orders in a wide window, then make the window narrower. They can also open Parties & Cards while Music is open. Controls must remain usable after these actions without requiring the player to discover a special close-and-reopen sequence.

**Observed failure.** Opening Music and Orders at 1440px, then narrowing to 700×900, left both expanded. Music shrank to x=13..272, width 259px; the interface did not choose the compact single-panel composition. Closing and reopening Music did correctly collapse Orders and preserve its Kept tab/filter. Separately, opening Parties & Cards after Music covered the Pause button: its rectangle was x=292..328, y=119..151, and hit-testing its center returned the navigator rather than the music control.

The source policy runs on opening Orders, Music or conversation. Viewport changes and navigator visibility can change the same reservations without invoking that policy; navigator toggling also leaves the stored free-space values stale until another update.

**Required behavior.** Reconcile the composition when the world viewport or relevant panel reservations actually change, including Parties & Cards. When panels cannot coexist, retain the most recently deliberately used eligible expanded panel and collapse the competing optional panels. Opening the navigator must give it usable space and keep essential transport reachable. Preserve required decision access and the existing normal desktop coexistence.

Retain each panel's tab, filter, unsent draft, text selection and scroll where applicable. Keep focus with the user's current action; if a focused panel must collapse, move focus to a usable control in the surviving requested panel. Do not repeatedly collapse/reopen panels, steal focus or recalculate policy every animation frame merely because a face or label moves. A coalesced reconciliation on actual viewport/reservation changes is sufficient.

Use one consistent measurement of the remaining band for reservations and placement. Do not rely on a fixed minimum width when less space remains, or leave a visually present control underneath another pointer surface. Preserve the repaired clear-face Home deck placement, normal Music/Orders/conversation switching, and native scrolling/board gesture isolation.

**Enough proof.** In one short UI journey, open the desktop combination, narrow to 700×900, then exercise Music → Parties & Cards and reopen the preserved Music state. Verify Pause and the relevant row actions both fit and receive pointer input. Confirm ordinary compact conversation/Music switching still preserves an unsent draft and the selected collection/filter. Clear the draft without sending it. Capture only the purposeful corrected transition states.

## 3. R14-02 — Dispose effect textures even after their sprites expire

**Player context.** Supply delivery and combat effects briefly attach sprites to the board. Their helper caches textures for reuse during the match. Those cached resources still belong to the old board after the visible effect ends and must be released when the match is replaced.

The focused source diagnostic created a Supply effect with 14 sprites, let it expire to zero items/children, then called the actual BoardView disposal. The cached burst, rune and arrow textures received zero disposal calls. Scene traversal cannot find a resource once the effect that referenced it has been detached.

Give `HitFX` an explicit idempotent cleanup path, or register its owned cached resources independently of scene attachment. Integrate it with BoardView teardown so active and already-expired effects are safe. Release each owned resource once, clear helper references, and preserve shared module caches, Three's shared Sprite geometry and owner-managed subtrees.

This is a narrow omission after the dominant geometry leak was repaired. The diagnostic did not measure GPU growth; do not describe it as another 1,100-geometry leak or start a general renderer/heap overhaul.

**Enough proof.** Use one focused helper-lifecycle proof: create/use the effect, expire its sprites, dispose the board, and dispose again. Confirm the cached textures are released once despite being absent from the scene and that repeated teardown is harmless.

## 4. Assemble, qualify, hand off and stop

Assemble both corrections under Loose Screws. Use small checks during assembly only for a concrete uncertainty. Then run the narrow transition journey, the helper-lifecycle proof and the AGENTS-required integrated `npm run check`. Reuse transport and unchanged owner evidence unless a relevant dependency changes. Do not repeat historical matrices, long stress runs or scene benchmarks.

Publish one response stating exact implementation/running identity, dirty state, closure evidence for R14-01–02 and remaining limits. Update the review index/checkpoint and append the canonical Overwatch workflow once, citing its receipt or access limitation. Keep implementation, verification and CJ's acceptance separate. Hand the candidate back to CJ, then end this work item and automatic continuation.
