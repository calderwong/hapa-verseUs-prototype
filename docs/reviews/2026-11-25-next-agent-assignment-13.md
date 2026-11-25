# Assignment 13 — A dusk island table with music worth keeping

**Date:** 25 November 2026, America/Los_Angeles.  
**Baseline:** main `8308ea15df3ef844ade37b24a0097f915ac7ba6c`, implementation `4dc271d506e97c83836dbc108ad3804f30cdcc81`; engine `ba838cca09ba43afceda0452b63d28df4cbf7f72`; default profile `hapa_open_10x9_v3_07`.  
**Authority:** [Review 12](2026-11-25-ui-design-review-12.md), [addendum 06](../requirements/2026-11-25-human-feedback-addendum-06.md), and the [design and implementation companion](../integrations/dusk-island-table-and-music-v1.md).

## 1. Authorized outcome and priorities

Deliver one coherent candidate: a redesigned music player with replayable Queue, Played this match and Kept views; quiet, reliable Keep; a fully composed dusk coastal setting; and restrained response to the music actually playing. The whole environment is required work. A player upgrade followed by indefinite atmosphere deferral does not complete this assignment.

CJ has selected this scope. The linked companion supplies concrete defaults, source references and owner contracts; ordinary implementation and art-tuning decisions can proceed without another product question. Prioritize truthful listening/saving behavior, a readable and usable match, and the complete authored setting together. Fine polish follows their connection.

Preserve seated Red, the useful Home composition, orbit/tactical/inspection behavior, conversation drafts and gestures, existing owner identity/permission boundaries, and one Ready. Change no movement, economy, combat, historical profile, model-admission or recorded game-replay semantics. Addendum 06 supersedes the previous exclusion of atmosphere and retained-library UI work; it does not reopen closed gameplay repairs.

## 2. Reconcile the actual checkout and attachments

Read AGENTS, the review index, the documents above, and [response 12](2026-11-25-ui-design-response-12.md) with its scoped evidence. Inspect current branches, status and local work before editing; preserve later or uncommitted changes. Identify which reported evidence still matches the dependencies you will use.

Reuse the existing Song Registry proxy and owner contracts for encounters, retained membership, exact audio and Keep. Respect the returned retained-ID format, including the route's literal-colon caveat. Use the installed listener owner; keep credentials server-side. Do not rebuild Song Registry, Harbor, Avatar Builder or the engine to obtain this candidate. Necessary engine work belongs in the Hapa fork under its existing ownership rules.

Check only attachment facts needed for the next connection. A missing owner blocks that particular live witness, not independent player, layout or scenery work. Finish what is available, name the exact missing capability and keep its acceptance gate visible. A stub is not proof of live retention or playback.

## 3. Required implementation

### A. One usable music deck and collection

Build a compact navy/cedar/brass listening deck, visually related to the table, with readable identity, stable transport positions and a deliberate Music drawer. Reserve space for changing status text. Keep, listening state and long titles must not move hit targets beneath the pointer or replace a focused control. Opening or filtering a collection does not start music.

The drawer has Queue, Played this match and Kept views, with local title/creator filtering and scrolling through the owner-returned collection. Played derives from actual playback starting, not queue position or saving. It is current-match history; do not promise cross-session Played.

Kept reads durable saves and retained membership from the owner. Provide Play for verified retained audio, including after a new match or reload with the introducing peer unavailable while the listener owner remains running. Use listener library plus returned `libraryId` as the durable playback address. Never persist blob URLs or substitute a queue ID. Reference-only, acquiring, failed and unavailable rows need honest states; do not invent replay or retry from an incomplete historical offer.

Show title, duration, supplied version, creator or “creator not stated,” and introduction information. Preserve exact recording/asset identity and distinct discoveries. Generic matching titles do not establish identical songs; storing a recording does not make the listener its creator. Put detailed provenance behind disclosure. Re-sharing, export and owner-library redesign remain outside this assignment.

### B. Explicit local replay, using the existing player

Use the same audio element for table playback and collection replay. On the first switch into replay, bookmark the table queue/cursor, playback time and listening intent once. Keep that bookmark while the player chooses other replay items; do not overwrite it with a replay position or mutate the contribution snapshots.

Capture the ordered collection list when replay begins. Manual Previous/Next navigate that captured list. A replay stops at the selected song's end: it neither automatically advances through the collection nor silently returns to the table. Expose an explicit **Return to table mix**, restoring the bookmarked table position and listening intent under the companion's transport policy. Natural completion in table mode continues the table mix normally.

Retain entry/generation/listening/disposal fences and finite acquisition/start handling across both contexts. A late response cannot replace the current selection. Unavailable replay is a truthful terminal state with usable navigation, not an unbounded retry loop.

### C. Keep changes saved state only

Capture the exact target when Keep is activated. Show Saving, then Kept after durable owner acknowledgement; distinguish acquisition progress and Available offline. A failed save exposes Retry without interrupting playback. Repeated Keep is not a delete toggle.

Keep must cause no source, selection, time, pause, listening, gain, drawer or navigation change. Remove its automatic Red voice acknowledgement and resulting music ducking. An independently requested conversation retains the established voice policy. Already-retained bytes must still permit saving a new introduction/encounter without duplicate audio acquisition; avoid an asset-level guard that suppresses discovery.

If a song ends or the player presses Next during saving, that independent transport action stands; the save result remains attached to the original recording. Review 12's diagnostic found no direct audio mutation in Keep, but it did not explain CJ's reported switch. If reproduced locally, record cause, entry and generation rather than disabling natural end or assuming Keep caused it.

### D. The complete dusk island setting

Replace the meadow-and-camps composition with a sheltered coastal terrace: a crafted cedar/slate table, dark water, wet stone and moss, wooded silhouettes, warm practical light, linen and restrained aged brass. Compose table construction, board materials, shore, depth, silhouettes and lighting together. The baseline must look complete with musical response off; reactive glow alone is insufficient.

Preserve field geometry, semantic colors, legible units and Cards, banks, height bands, excavation clearance and Red's opposite seat and useful scale. Keep tactical and close inspection clear through ordinary orbit. Use existing presentation/scenery attachment points and bounded scene resources. Borrow selected visual/signal patterns from the companion's references; do not transplant whole visualizer renderers or build the complete island.

### E. Actual music response and shared layout

Attach a small read-only music signal boundary to the existing player and scene update. Bind signals to exact active item/generation and actual audio time, independent of Tick or game Playback speed. Analyze music alone; voice and game sounds are not music features. A full-mix spectrum is not isolated instrument stems.

Give the first response only three bounded jobs: slow practical/trim glow, subdued shoreline/reflection motion, and rare peripheral accents. Keep tactical illumination stable. Do not modulate rule colors, global exposure, camera, targets or interaction geometry. Selection changes, pause, unavailable audio and disposal must not leave a previous song's response running.

Implement Off, default Subtle, bounded Expressive, and Still/reduced-motion behavior from the companion. These controls do not stop music. Use one audible player, bounded analysis/resources and explicit disposal; no new analysis service, full-frame visualizer or parallel animation owner.

Include the Music drawer in the existing free-area composition. Complete R12-01: either beside-face candidate must satisfy `left >= freeLeft && left + width <= freeRight`; otherwise use the measured dock. Preserve native scrolling, keyboard focus, drafts and access to input/settings/collapse while drawers open or the viewport changes.

## 4. Loose Screws cadence

**Frame briefly.** Reconcile source, inspect required owner seams, and record one short checkpoint covering the whole candidate and genuine blockers.

**Assemble the whole.** Connect player, collections, replay, quiet Keep, authored setting and actual-audio response before broad qualification or fine tuning. Work on available visual composition while an attachment is unavailable. Do not drain the board or spend successive cycles adding tiny music tests while the scene remains unchanged.

**Fit, then tighten.** During assembly use the smallest check that resolves a contract uncertainty or observed defect. Once the connected candidate exists, run one focused changed journey below, batch related corrections, and run the AGENTS-required `npm run check` at the complete candidate. Reuse unchanged evidence. Rerun affected checks after fixes; broaden only for a concrete remaining risk or required gate. No automatic historic browser matrix, long comparative match, model benchmark or decorative-coordinate test campaign is requested.

## 5. Bounded acceptance journey

Use an ordinary human-versus-bot match with Red and available owners. Combine these into one short journey, including a new-match/reload segment where needed. A bounded seek near a song's end is sufficient to observe completion behavior:

- Play music; Keep during playback and through acknowledgement. Confirm continuity, gain and stable controls; exercise one failure/Retry boundary and distinguish an independent natural end.
- Open Played, replay an earlier song, use manual Previous/Next, observe replay-end stop, then explicitly Return. Confirm the table bookmark survives navigation.
- Open Kept after reload/new match and play a retained recording with its source peer unavailable and listener owner available. Use a scoped test connection or an already unavailable peer; do not disrupt a shared owner service merely to obtain this witness. Show truthful unavailable/acquiring rows and distinguish similar titles/provenance.
- Open Music and Orders, pan toward a relevant edge, select conversation text and scroll. Controls remain reachable; exposed-board gestures and one Ready still work.
- Inspect Home, a useful orbit/tactical view and close territory inspection in the new setting. Compare music response, pause/selection change, Off and Still. The game remains readable and audio keeps its own time.

Use a few purposeful captures showing the complete setting, open collection and tactical/close readability. Label simulated failures and submitted versus independently observed owner behavior. Missing live evidence stays explicit; it is not silently converted into completion.

## 6. One handoff and stop

Publish one dated response using the repository template: exact implementation/running identity and dirty state, effective settings, changes against R12-01–R12-05, check results, captures, owner revisions/full checksums, live evidence limits and remaining gates. Update the review index/checkpoint without rewriting historical evidence.

Append the existing canonical Overwatch board workflow and include its actual receipt, or state the access limitation. Put qualified work into Review; CJ accepts Done. Hand over the complete candidate and the next useful human art decision. Then end this work item and its automatic continuation. Do not start unrelated polishing, new features or another board-drain cycle.

