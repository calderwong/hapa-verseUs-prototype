# Review 14 — Transport closes; finish two boundary cases and play

**Date:** 25 November 2026, America/Los_Angeles.  
**Repository:** `calderwong/hapa-verseUs-prototype`.  
**Reviewed main:** `3fc3f1b386a03ea2d3f307adc4391e090de4592a`.  
**Implementation:** `153b657ad28f640f6efa42739e3d1bc7f70ebc4d`.  
**Engine:** `ba838cca09ba43afceda0452b63d28df4cbf7f72`; profile `hapa_open_10x9_v3_07`.

## Verdict

**This is a successful, focused response to Assignment 14. The three transport defects close, the ordinary compact layout works, the large board-resource leak is addressed, and the requested Home refinement is delivered.** Preserve those results. The next coding run should complete two concrete boundary cases, then hand the candidate back for ordinary playtesting.

The remaining cases are (1) re-evaluating the current layout when the window or reserved panel space changes, and (2) releasing a small per-board effect-texture cache after its sprites have expired. They do not justify another player rewrite, general memory campaign or automatic scenery-polish cycle.

[Assignment 15](2026-11-25-next-agent-assignment-15.md) is the two-item handoff. [Addendum 06](../requirements/2026-11-25-human-feedback-addendum-06.md) and the [dusk-island companion](../integrations/dusk-island-table-and-music-v1.md) remain the selected music/presentation direction. This review does not establish complete-game feature readiness or CJ's Done/art acceptance.

## What now closes

| Previous finding | Review disposition and evidence |
| --- | --- |
| **R13-01 — A delayed audio start undoes Pause** | **Closed in inspected source/fixture scope.** The original race diagnostic now reports no stale play and no reversal of paused intent. The shared start path checks item, generation, listening intent and disposal after the audio-context wait and before `audio.play()`. |
| **R13-02 — Play requires two presses / completion resumes at the tail** | **Closed in inspected scope.** One Play worked in the fresh live game. The original diagnostic now starts after failure on the first click and restarts finished table playback at zero. The label and action share `primaryAction()`. Activation blocks preserve the recording; real browser refusal remains fixture-qualified. |
| **R13-03 — Previous follows first-heard collection order** | **Closed.** The original 1→2→3, replay-1, Return-3, Previous diagnostic now selects 1. Bounded actual-playback chronology supplies navigation while the collection and contribution queue keep their own ordering. |
| **R13-04 — Compact controls clip and cover Red** | **Original opening sequence repaired.** At 700×900, reopening Music collapsed Orders and preserved Kept plus the filter. Conversation/Music switching preserved an unsent draft and focus. Closed Home placed the deck at x=407..687, clear of Red's face. Layout changes after panels are already open remain R14-01 below. |
| **R13-05 — New match retains the old board** | **Dominant defect repaired; small helper omission remains.** Ownership-aware teardown and idempotence are present. The author reports stable GPU allocations through six fresh-match replacements. R14-02 covers an effect-cache case outside that fresh-match sequence. |
| **R13-06 — One Home composition refinement** | **Implementation delivered; CJ judges the art.** The live view has quieter paving, integrated moss and a more legible cedar edge. The coast remains a restrained far-edge cue. Preserve this candidate rather than prescribing another refinement automatically. |

The six supplied soundtrack tests passed independently once. Both unchanged Review 13 diagnostics were rerun once against current bytes, with their output transitions inspected. [Transport closure evidence](evidence/2026-11-25/review-14/README.md) identifies the precise executed sources and limits.

## R14-01 — P2: layout must reconcile when available space changes

### What a player experiences

On a wide desktop, Music and Orders can coexist. If the player then narrows the window, the game must reconsider which expanded panel fits. Likewise, opening Parties & Cards changes the space available to music and conversation. The current layout policy handles opening Orders, Music and conversation, but not these other changes to the same composition.

### Fresh live reproductions

**Resize with existing panels open:** at 1440×900, the reviewer opened Orders and Music, selected History in Orders, selected Kept in Music and entered the filter `lantern`. After changing the viewport to 700×900, both panels stayed expanded. The Music deck occupied x=13..272 (259px wide), with Orders still covering the right side. The remaining central strip was too narrow to satisfy the selected one-expanded-panel policy. Closing and reopening Music immediately applied the policy correctly: Orders collapsed and Kept/filter survived.

**Open Parties & Cards after Music:** at 700×900 with Music expanded and Orders collapsed, opening the roster covered the left portion of the music deck and collection. The Pause button occupied x=292..328 and y=119..151. A read-only DOM hit test at its center returned the `NAV` labeled **Parties and Cards**, not the Pause button or its child. This confirms a covered control, not just a crowded-looking screenshot. The same view showed the song-row actions behind the roster.

The normal compact behavior is worth preserving. After clearing the panels, the closed deck sat to the right of Red's face; conversation/Music switching retained state and focus. One Ready press advanced Tick 1 to Tick 2 while music continued. [Live observations](evidence/2026-11-25/review-14/live-observations.md) record the journey and cleanup.

### Source explanation

`App._onePanel` runs when Orders, Music or conversation opens. It does not run when viewport width changes or when `_toggleRoster` changes the Parties & Cards reservation. `_toggleRoster` also does not refresh `_syncFreeSpace`. Table's per-frame positioning can therefore receive stale reservations or a composition whose open panels no longer fit. Repositioning an individual deck cannot resolve the higher-level conflict by itself.

Relevant pinned source: [app.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/3fc3f1b386a03ea2d3f307adc4391e090de4592a/src/hapa/presentation/app.js), `_freeSpace`, `_syncFreeSpace`, `_onePanel`, `_toggleRoster`; [table.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/3fc3f1b386a03ea2d3f307adc4391e090de4592a/src/hapa/presentation/table.js), `update` and `_placeDeck`.

### Bounded correction and closure

Reconcile the current composition when viewport or reserved panel space changes, including opening/closing Parties & Cards. Use the most recently deliberately used eligible panel as the working default when choosing what remains expanded. Refresh measurements/reservations after the choice. Preserve panel drafts, tabs, filters, scroll and sensible focus. Mandatory game-decision UI retains its priority; layout must not dismiss a required decision.

Use one bounded transition journey: desktop coexistence → narrow viewport → roster open/close → reopen preserved Music/conversation state. Controls must remain reachable through actual hit testing or pointer interaction. Keep the existing face-clear closed deck and wide-layout behavior. Avoid per-frame collapse/focus churn, a new layout framework or a broad device matrix.

## R14-02 — P3: release effect textures even after their sprites have disappeared

### Context and impact

Supply and combat effects are brief. Their sprites disappear after the animation, while the current board's HitFX helper keeps three textures for later effects in that same match. Starting another match should release those per-board textures even if no effect sprite remains attached at that moment.

The new BoardView teardown fixes the large scene-resource problem. This is a much smaller ownership omission, suitable to finish alongside R14-01. It is not evidence that the approximately 1,100-geometry leak has returned, and its GPU growth was not measured by this review.

### Source and focused proof

`HitFX` in [fx.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/3fc3f1b386a03ea2d3f307adc4391e090de4592a/src/hapa/presentation/fx.js) creates per-instance `burst`, `rune` and `arrow` textures. Its expiry path removes effect sprites/materials while retaining those reusable textures. [BoardView.dispose](https://github.com/calderwong/hapa-verseUs-prototype/blob/3fc3f1b386a03ea2d3f307adc4391e090de4592a/src/hapa/presentation/board-view.js) collects resources reachable from the attached scene subtree but has no explicit HitFX cleanup or independent registration of that cache.

One actual-source diagnostic created a Supply effect, verified 14 sprite references to the burst texture, ran the real expiry path until there were zero effect children, then called the real BoardView disposal and resource collector. The previously used burst texture received **zero disposal calls**. The other dormant helper textures likewise received none. A second BoardView disposal correctly returned null. [Probe and result](evidence/2026-11-25/review-14/README.md) disclose the Three/canvas fixtures and absence of a real renderer/network.

### Bounded correction and closure

Give HitFX an idempotent owner cleanup path or register its owned resources independently of scene attachment. Cover both active and already-expired effects without releasing shared module caches or Three's shared Sprite quad. The minimum proof exercises the expired-effect case and repeated disposal. One short restart witness after a real Supply/hit effect has rendered and expired can qualify the affected GPU boundary; do not launch a general memory benchmark.

The author's seven fresh-match renderer samples remained at 1,275 geometries, 119 textures and 41 programs. That submitted result is credible for the original defect but precedes the effect-cache case. Preserve it with this qualification rather than discarding useful evidence. [Response 14](2026-11-25-ui-design-response-14.md) contains the series and its CPU-heap limitation.

## Design assessment and working default

The Home refinement is a clear improvement. The floor has less visual competition, the warm table edge establishes a crafted object, and the angled view makes the table's thickness and structure convincing. The skiff and quay remain peripheral, with the boat partly cropped as the author discloses. That is a reasonable quiet setting candidate for this stage.

**My recommendation is to keep this composition for the next ordinary playtest.** Do not move the boat again or add more effects merely to keep polishing. CJ can judge whether the setting feels sufficiently inhabited while actually playing. The music-response system was not retuned in this pass; its previously disclosed mode-comparison limit remains. No new excavation, broad performance or photometric claim is made.

## Evidence and handoff

The review combines pinned source, six independently passing soundtrack tests, two unchanged diagnostic reruns, one new effect-disposal diagnostic, submitted evidence, and a fresh local-browser journey. The live UI did not expose a running commit; it is not asserted to be byte-identical to the Git pin. The author's integrated `npm run check` result is 158/158 plus smoke/peer/build; this review did not repeat that full campaign.

The live reviewer submitted one Ready action, no Keep/save actions and no conversation message. A temporary unsent draft was cleared, viewport overrides were reset and the review tab was closed. No fresh local screenshots are uploaded in this publication. The reviewer did not inspect or append current Overwatch state or accept work to Done.

Complete the two bounded corrections under Loose Screws, run the focused changed proofs and required integrated final check, publish one response, append the canonical board workflow with a receipt or access limitation, and stop automatic continuation. Then let CJ's playtest determine the next product priority. [Assignment 15](2026-11-25-next-agent-assignment-15.md) contains the actionable handoff.
