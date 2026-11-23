# UI and design review 02 — 22 November 2026

## Recommendation

**Keep the recent changes. Give the next implementation slice one player-facing goal: make the opening decision easy to understand and complete, from assigning a Card to reviewing the resolved result.** Close the remaining playback and misleading-feedback defects, then improve the planning layout, compact-window behavior and keyboard route. Follow that with one finished terrain-and-party scene.

The prototype now has a more coherent visual vocabulary: corresponding public banks align, Card information has a consistent order, selection is stronger than routine ownership, and planned Supply has different feedback from Supply that actually landed. The remaining limitation is increasingly the allocation of attention and screen space. The player must be able to read the decision that the improved Ready protocol commits.

**Next implementation brief:** [Readable opening and planning — assignment 03](2026-11-22-next-agent-assignment-03.md). This review supplies the evidence and rationale. Neither document marks implementation accepted by CJ.

## Scope, authority and verification

- Reviewed `calderwong/hapa-verseUs-prototype/main` at **`a68cfd0b8af874498cdb3e617715f941e52b76f2`**.
- Compared the ten commits after the previous documentation handoff, `663e8f4cdcf0d76445cb9473e4ea6cc0c04826f0`. The earlier source baseline was `af6977d295dd0970a744bb65281f7ec4ea8c1457`.
- Read [implementation response 01](2026-11-22-ui-design-response-01.md), [response 02](2026-11-22-ui-design-response-02.md), their machine-readable after reports, relevant requirements and changed source. Inspected seven committed captures, including before/after home views, compact layout, Card inspection, the deep cutaway, and selection from two angles.
- Retrieved and checked all **88 non-image file blobs** in the reviewed prototype tree against their Git object hashes. The seven inspected image files also match their committed blob hashes. This is a reconstructed source snapshot, not CJ's running Mac checkout.
- Ran **76 tests from 12 test files: 76 passed** under Node v24.22.3. An initial Git-ignore boundary check failed because the reconstructed snapshot lacked Git metadata; initializing an empty local Git repository allowed that unchanged check and the complete 76-test subset to pass. `protocol.test.js` and the complete `npm run check` were **not** rerun: the required external packages and vendored engine runtime were not installed here. The implementing agent separately reports 80/80 tests, peer checks and build passing in response 02.
- Executed an isolated reproduction of the unchanged playback controller: **six of twelve cases demonstrate the selected-layer visibility overwrite** described below. This uses the original method and visibility predicate with a stub view; it is not a rendered game playthrough.
- A fresh browser probe was attempted but Chromium could not start because the execution environment rejected its socket operation. Consequently, new narrow-layout and keyboard findings remain source-supported risks pending a real application journey. Existing screenshots were inspected directly; they were not regenerated here.
- The prototype still pins **Lumina `ba838cca09ba43afceda0452b63d28df4cbf7f72`**. This update range changes presentation, diagnostic fixtures, review tooling and documentation; it does not change the authoritative rules, protocol modules, requirements documents or engine pin. [Comparison][compare]

Master Requirements v3 remains gameplay authority. The Design Companion supplies the presentation contract, including alternative controls, public information, text scaling and the distinction between camera direction and world-facing. The References Master supplies implementation advice. Keep plain JavaScript ES modules, deterministic headless rules and the existing engine-owner boundary. Overwatch `hapa-versus` remains task truth; CJ accepts work to Done. This review changes documentation and evidence only.

Fresh verification is recorded in [review-verification.json](evidence/2026-11-22/review-02/review-verification.json), with a [test log](evidence/2026-11-22/review-02/rules-tests.log) and [playback reproduction](evidence/2026-11-22/review-02/playback-layer-overwrite-result.json). Read the limitations with the results.

## What the updates accomplish

| Earlier finding | Evidence now available | Review disposition |
| --- | --- | --- |
| UX-01 — Ready must freeze the player's own plan | Shared `_can`, `_editRefusal`, `_setPlan` and `_addCommand` guards; response 01 records the unchanged revision through attempted deletion, keyboard edits and dragging. | Retain implementation. Protect the demonstrated behavior with explicit assertions; no broad rewrite is indicated. |
| UX-02 — one resolution while a response is pending | A single-resolution latch and common Ready eligibility; response 01 records one lock and one replay entry after shortcut spam. | Retain implementation. Add fail-on-mismatch regression protection. |
| UX-03 — select what is visible at the correct height | Height-aware body/surface picking, candidate chooser and elevated overlays; ten recorded selection cases. | Static selection is improved. Playback filtering still has the separate R2-01 defect below. |
| UX-04 — decoration must not hide excavation occupants | Framed scenery and the deep-layer capture; response 02 records zero tested points hidden after the change. | Original obstruction is addressed in the recorded cases. Material depth is still future work. |
| UX-05 — public banks correspond to the same physical columns | Viewer-relative ribbon order, owner/global aliases and tethers; report records matching centers for both seats. | Retain this mapping while changing responsive layout. |
| UX-06 — readable layout and one agreement action | One Ready in the plan panel and equal ribbon widths. | Partial. Plans and compact-width resource access are the next design priority. |
| UX-07 — dependable framing | Fitted Home/Tactical views and a longer lens; recorded measurements for both seats at three sizes. | Keep provisionally. Judge lens/board size again after the HUD gives the viewport adequate space. |
| UX-08 — consistent Card anatomy | Identity, bounded face, resources and ability bands; shared inspector face. | Retain anatomy. Compact labels, reserved-use text and multi-color payloads still need stress cases. |
| UX-09 — distinguish planned from resolved | Recorded planned cue with Supply still 0, followed by resolved cue with Supply 2; persistent links disappear at playback. | Retain this semantic pattern for future action effects. |
| UX-10 — distinguish ownership and selection | Quieter owner brackets, stronger ivory/slate selection and larger crests; home and rotated captures. | Better visual hierarchy in inspected captures. Check both seats and color-independent readability later. |
| UX-11/12 — terrain materials and authored party art | Not implemented in these responses. | Carry forward as one bounded visual scene after the playable interface slice. |
| UX-13 — plain-language hierarchy | Some improved action text; the inspector and reference help remain dense. | Partial; include with the next opening journey. |
| UX-14 — accessible interaction and reduced motion | Engine keyboard interception removed; focusable Card tiles; two recorded motion reductions. | Partial. A complete keyboard journey and enlarged-text layout remain unverified. |

These are dispositions of evidence, not CJ acceptance. Sources: [response 01](2026-11-22-ui-design-response-01.md), [response 02](2026-11-22-ui-design-response-02.md), [Ready guards][ready], [hand rendering][hand], [current layout][layout].

## Why layout comes before another camera or asset pass

The response-02 report contains these measured canvas dimensions. They explain the compact screenshot more clearly than the camera's board-fit percentage alone:

| Window in CSS pixels | Recorded canvas | Canvas share of window, calculated | Near / far territory width, reported |
| --- | --- | --- | --- |
| 1600 × 1000 | 1014 × 638 | 40.4% | 76.9 / 61.1 px |
| 1280 × 720 | 694 × 358 | 27.0% | 43.1 / 34.3 px |
| 1100 × 900 | 774 × 538 | 42.1% | 64.8 / 51.5 px |

The percentages above divide reported canvas area by window area. They are not measurements of visible terrain or occupied pixels. The larger share at 1100 px follows the sidebar breakpoint; it does not establish that the hidden/reflowed controls remain usable. [Recorded framing data][after-data]

At 1280×720, the full roster and long tutorial/legend remain prominent, while the public plan has room for about an order line. Card labels also truncate. These are direct observations of the [committed compact capture][compact-image]. A perfectly fitted board can still be too small to play comfortably.

**Working decision:** retain the fitted camera and 24-degree lens while improving the layout. Preserve the deliberate exclusion of world banks from the default fit; the screen ribbons remain alternate views of those same Card instances. Then compare the same near/far selection tasks at the same window sizes. CJ should judge the resulting playable view, rather than approve an isolated percentage before the HUD changes.

## Contextual findings

The R2 identifiers distinguish this follow-up from the original UX-01–UX-14 findings. Priority describes implementation order: **P1** is the next reliability/usability work; **P2** is the subsequent visual scene.

### R2-01 — Keep the selected height filter intact throughout playback

**P1. Executed controller defect; predates the recent updates.** A player inspecting a tunnel at band −2 expects the surface and flying members to remain filtered during resolution, just as during planning. `BoardView.sync()` applies that band condition, but `_stepPlayback()` immediately overwrites each interpolated sprite's visibility without it. A live off-layer member is set visible again until playback finishes. [Playback][playback] [Visibility predicate][visibility]

The isolated reproduction selects −2 or +3 and samples progress 0.01, 0.50 and 0.99. In all six filtered partial-playback cases, the off-layer live member changes from hidden after `sync()` to visible after the controller override. The three completed-playback cases and three partial-playback All-layer cases have the expected result. This establishes the property overwrite; the real rendered appearance still needs the stacked-fixture journey. The same overwrite is present in the verified prior source at `af6977d`.

**Implementation direction:** have one presentation visibility decision combine selected band, casualty reveal and playback position. Preserve public access to off-layer parties through named markers/roster and Show all. Party markers are separately controlled; do not blanket-hide public information to repair the body filter.

**Acceptance:** run `fixture=stacked`, isolate −2, resolve a pass Tick, and sample member visibility throughout playback and at completion. Repeat at +3 and All. Off-layer bodies stay filtered, eligible casualty animation still works, and viewing settings leave authoritative outcomes unchanged. Also inspect one ramp ascent/descent: trace frames currently carry x/y while the renderer reads the final member band, so elevation timing is a specific source-supported risk, not a separately reproduced defect.

The [diagnostic script](evidence/2026-11-22/review-02/reproduce-playback-layer-overwrite.mjs) is pinned to the reviewed source and deliberately reproduces the bug. It is not the future passing regression test.

### R2-02 — Give players room to read the plans they are committing

**P1. Screenshot observation and source-confirmed constraint.** The 150-pixel lower row must contain the Public plans heading, both order lists, and Ready. At compact size the order lists become a thin strip. The new protocol correctly asks a player to review added/removed enemy orders before acknowledging, so those changes need an actual review surface. [Plan rendering][plans] [Layout][layout] [Compact capture][compact-image]

**Implementation direction:** make the current decision the right panel's main purpose. During planning, show the selected party's available actions and a readable order summary. When reviewing plans, give both complete lists a deliberate expanded view. When acknowledgment is stale, prioritize the changed opponent orders and explain that the player's own plan remains frozen. During a response, prioritize the pending effect, exact cost, eligible choices and Pass. Keep one primary agreement action. The full roster and long reference legend can move to accessible drawers/details.

**Acceptance:** with at least several orders on each side, every complete order, error, added order and removed order can be read before Ready/Acknowledge. The required action and its consequence are visible without shrinking primary text. Test both seats, a stale pair and a spell response at ordinary and compact size. Preserve the player's scroll/focus context during updates rather than repeatedly jumping to a different decision.

### R2-03 — Preserve Mana, Burn and party access below the layout breakpoint

**P1. Source-supported defect risk awaiting full-app reproduction.** At widths of 1180 pixels or less, CSS sets the first grid track to zero and hides the roster. The resources panel remains assigned to that track, and there is no substitute roster drawer in the reviewed implementation. This threatens both resource inspection and the existing drag-to-Burn surface. The exact rendered bounds and interaction consequences were not independently measured here. [Layout][layout] [Resource rendering][resources]

**Implementation direction:** move the roster into a named, keyboard-accessible drawer; relocate both public Mana pools and planned Mana to a compact visible or immediately accessible region. Provide a labeled Burn action in addition to dragging. Keep all nine bank positions discoverable and preserve correspondence between own and opponent banks if scrolling or a different compact arrangement is used.

**Acceptance:** at 1600×1000, 1280×720 and 1100×900, players can reach all parties, both pools, a legal Burn path, every bank slot, plan review and required responses. Record bounds and focus behavior immediately above/below 1180 px. Required controls must not be placed in a zero-width region. Repeat a representative compact journey with enlarged interface text; smaller text is not the remedy.

### R2-04 — Finish the keyboard and no-drag route through one complete decision

**P1. Source-confirmed missing controls; focus loss remains a runtime risk.** Card tiles now accept Tab/Enter/Space, which is useful progress. Roster rows, member slots and event entries remain click-driven elements, while Move is still taught as right-clicking. Card activation calls `_renderAll()`, which replaces the focused tile; focus restoration needs a direct check. [Hand][hand] [Roster][roster] [Party inspector][party] [Events][events]

**Implementation direction:** supply named party/member controls, a labeled Move action and an accessible territory/coordinate chooser. Follow the Companion's separation between a keyboard-focused board and camera controls, including a visible home-grid compass. Preserve logical focus across rendering and restore it after drawers, pickers and response sheets. Retain pointer shortcuts as optional fast paths. [Companion controls][controls]

**Acceptance:** complete party selection → member inspection → Card-to-Supply → legal destination → review/remove/re-add an order → Ready → opponent revision → acknowledgment → result inspection using only the keyboard. A separate response fixture must allow response or Pass without losing focus. Escape returns to a meaningful prior control. Repeat a representative path muted and with reduced motion. Do not claim complete accessibility from these bounded checks.

### R2-05 — Make compact Cards reveal the full decision without shrinking the text

**P1. Observed compact clipping; overflow case untested.** The new full-strength face and dark ability band improve the Card's hierarchy. In the compact capture, the opponent ability/reserved-use band and the player's long ability title still clip. The inspected Tick-9 scene has two rendition faces and seven fallbacks; it does not exercise multi-color Mana overflow. [Compact capture][compact-image] [Card inspection capture][card-image] [Card CSS][card-css]

**Implementation direction:** define a deliberate compact Card view with rank/suit, resource values and available/reserved state, plus complete inspection on selection. Keep the full ability title, exact Mana payload and planned recipient available by keyboard as well as pointer. A `+n` chip must clearly mean additional entries, not extra spendable Mana or a hidden zero. Preserve the distinction between Tarot-face attribution and gameplay definition/creator.

**Acceptance:** test both owners with a long title, no Mana, several Mana colors, available/reserved Cards and a replaced bank Card. Use a valid diagnostic fixture for the multi-color case; do not change the production mint rules to manufacture a screenshot. Confirm the same Card instance and use remain identifiable across ribbon, inspector, drag/selection and resolved event.

### R2-06 — Teach the next action in plain language and correct moved-control help

**P1. Confirmed stale copy plus hierarchy work.** The quick-start still says Ready is “at the end of your hand,” although it moved into Public plans. The party inspector leads with coordinate aliases and internal state, and formation roles are abbreviated. The Supply help also says “at any time,” which needs the editable-plan qualification now that Ready correctly freezes changes. [Help and inspector][help]

**Implementation direction:** lead with “Your Knight,” “4 members · capacity 9,” current Supply, planned Supply and the current legal action. Use exact coordinates, revisions, fractions and source IDs in a consistent Details view. Keep world-facing distinct from the camera's orientation. Offer one short first-use instruction appropriate to the selected party and current phase; move the full legend to reference help. Retain the underlying public information.

**Acceptance:** a new player can explain which columns accept new orders, what is selected, what can be done now, which resources are only planned, and what Ready will freeze. Help points to the actual controls. Inactive-column and frozen-plan messages describe different restrictions correctly. An unmounted Pawn's inability to move is explained without suggesting that assigning Supply alone supplies a Mount.

### R2-07 — Make concession feedback truthful; preserve the existing terminal-action requirement

**P1 for feedback/confirmation; bounded protocol follow-up for timing.** The menu currently calls `_addCommand(...concede...)` and then always displays “Concession planned,” even when the edit guard refuses it. The same callback lacks the Companion's explicit match-ending confirmation. [Menu callback][menu] [Companion concession][concession-ui]

Concession itself is already specified in Master Requirements v3 and Appendix B. The open design detail is how the participant's terminal action is accepted and recorded during frozen planning or a pending response—not whether concession should exist. [Master concession][concession-rule]

**Implementation direction:** add the specified confirmation, report success only after acceptance, and expose the actual limitation when an action is unavailable. Do not reopen a frozen ordinary plan as a shortcut. If making concession available across phases requires protocol changes, document a small separate proposal covering accepted event ordering, pending-response cancellation, idempotence and replay/peer agreement. Keep that distinct from the presentation slice.

**Acceptance:** cancel confirmation with no state/plan change; attempt concession while editing, after Ready and during a response; never show a success toast for a refused action. Record which cases actually end the match, which are unsupported, and the existing requirement still needing completion. A broken connection must remain different from surrender.

### R2-08 — Protect confirmed behavior with explicit checks and preserve evidence runs

**P1. Source-confirmed verification gap.** `ui-journeys.mjs` records valuable observations, but it does not compare them to independent expected results through ordinary assertions. A missing click target can return false and the journey continues; page errors are recorded; output is written and the process exits normally. The report also acknowledges that reusing a label overwrote earlier numeric reports. Exit zero therefore proves the recorder completed, not that a user journey passed. [Journey recorder][journeys]

**Implementation direction:** retain recording mode and add a small assertion mode or separate regression entry point for the confirmed risks: frozen own revisions, one resolution during a pending response, intended height targets, visibility throughout playback, and essential controls in the revised journey. Compare response-fixture replay/state with and without Ready shortcut spam. Fail on missing required controls and unexpected application errors; identify any deliberately allowed asset failures explicitly rather than ignoring every 404. Use unique run directories/manifests so evidence is preserved.

One small provenance correction: the UX-10 labels say “Castle,” but the script selects `A.mount.C3`, the opening Bishop. The captures still show selection contrast, but the caption does not verify Castle identity. Record actual selected ID/Mount/seat in the next report and add a correction there; preserve the published earlier report. [Selection journey][selection-journey]

**Acceptance:** demonstrate that a deliberately mismatched expected revision/target makes the new checks fail, then run the corrected application against independently specified expectations. Include the actual source commit, scenario, viewport, zoom/text scale, seat, layer and camera with each unique report. A screenshot filename alone is not evidence that its named subject was selected.

### R2-09 — After the playable interface, make one convincing cubic battlefield scene

**P2. Art-direction recommendation grounded in inspected captures.** The deep occupants are now visible, but the cutaway still reads as a translucent schematic. The desired Hapa experience needs material thickness, a readable selected floor and a party whose identity survives orbit. [Deep cutaway capture][deep-image] [Selection captures][selection-image]

Build one authored reference scene with ordinary ground, a raised surface, an open trench, a roofed passage and one asymmetric shield/ranged party. Show an existing dig or enhancement action as preview, execution and resulting state, using only operations the rules already implement. Give cut edges, strata, exposed faces and floors a shared material treatment. Keep alignment glow bounded to the territory edge/emblem so it does not compete with selection, valid targets or responses. Carry forward the Companion's brushed-pixel/comic direction and slate/ivory/brass palette.

Capture overview, tactical and inspection distances through a full orbit. Check shield handedness, silhouettes, sprites against each material, selected-height readability, and muted/reduced-motion presentation. Supply asset provenance, local rendition hashes and measured frame time on the declared machine. Scale up the asset library after this scene works. This is visual treatment of existing rules, not a request for new mining rewards, enchantment mechanics or a different engine.

## Decisions and questions, with the necessary context

### Should the new fitted camera remain while the layout is revised?

The new camera fits the playable area and its labels, but the reported board bounding-box share at 1600×1000 falls from roughly 0.69 to 0.61 of the canvas. At compact size, fixed side panels and rows already leave only 27% of the window for that canvas. **Recommendation: retain the fitted camera provisionally and compare playability after reclaiming HUD space.** This does not need to block implementation. CJ's useful later choice is between recorded playable views at the same size and state, not between isolated percentages.

### What should happen when a player confirms concession after Ready or during a response?

The requirements already say explicit concession ends the match and is recorded distinctly from Commander death or a lost connection. The current implementation instead places a concession into the normal editable plan, which is unavailable after Ready. **Recommendation: keep the UI truthful immediately, then propose a distinct accepted terminal record with deterministic ordering and replay behavior.** The local agent should identify which timing/order cases are already defined before asking CJ about any remaining product choice. Do not ask CJ to re-approve the existence of surrender.

### Which real window should be the final usability checkpoint?

The available captures include 1600×1000, 1280×720 and 1100×900, but CJ's current browser size, text preference and display scaling have not been supplied with this update. **Working default: use those three existing sizes, including below the 1180-pixel breakpoint, and add CJ's actual viewport when locally available.** This is an additional observation to collect, not a reason to pause work.

## Handoff outcome

Implement the reliability repairs and the readable opening/planning journey in reviewable commits, publish **response 03** using the existing template, and append evidence to the relevant Overwatch cards. Include one short visible walkthrough, compact/enlarged-text captures, the assertion results and remaining limitations. Preserve all earlier reviews and evidence. Keep the terrain/party scene as the next named visual slice, with CJ acceptance recorded separately.

[compare]: https://github.com/calderwong/hapa-verseUs-prototype/compare/663e8f4cdcf0d76445cb9473e4ea6cc0c04826f0...a68cfd0b8af874498cdb3e617715f941e52b76f2
[ready]: https://github.com/calderwong/hapa-verseUs-prototype/blob/a68cfd0b8af874498cdb3e617715f941e52b76f2/src/hapa/presentation/app.js#L231-L307
[playback]: https://github.com/calderwong/hapa-verseUs-prototype/blob/a68cfd0b8af874498cdb3e617715f941e52b76f2/src/hapa/presentation/app.js#L319-L424
[visibility]: https://github.com/calderwong/hapa-verseUs-prototype/blob/a68cfd0b8af874498cdb3e617715f941e52b76f2/src/hapa/presentation/board-view.js#L297-L368
[layout]: https://github.com/calderwong/hapa-verseUs-prototype/blob/a68cfd0b8af874498cdb3e617715f941e52b76f2/src/hapa/presentation/versus.css#L10-L31
[plans]: https://github.com/calderwong/hapa-verseUs-prototype/blob/a68cfd0b8af874498cdb3e617715f941e52b76f2/src/hapa/presentation/app.js#L931-L985
[resources]: https://github.com/calderwong/hapa-verseUs-prototype/blob/a68cfd0b8af874498cdb3e617715f941e52b76f2/src/hapa/presentation/app.js#L922-L930
[hand]: https://github.com/calderwong/hapa-verseUs-prototype/blob/a68cfd0b8af874498cdb3e617715f941e52b76f2/src/hapa/presentation/app.js#L855-L900
[roster]: https://github.com/calderwong/hapa-verseUs-prototype/blob/a68cfd0b8af874498cdb3e617715f941e52b76f2/src/hapa/presentation/app.js#L902-L920
[party]: https://github.com/calderwong/hapa-verseUs-prototype/blob/a68cfd0b8af874498cdb3e617715f941e52b76f2/src/hapa/presentation/app.js#L1030-L1085
[events]: https://github.com/calderwong/hapa-verseUs-prototype/blob/a68cfd0b8af874498cdb3e617715f941e52b76f2/src/hapa/presentation/app.js#L987-L995
[help]: https://github.com/calderwong/hapa-verseUs-prototype/blob/a68cfd0b8af874498cdb3e617715f941e52b76f2/src/hapa/presentation/app.js#L997-L1085
[menu]: https://github.com/calderwong/hapa-verseUs-prototype/blob/a68cfd0b8af874498cdb3e617715f941e52b76f2/src/hapa/presentation/app.js#L810-L822
[card-css]: https://github.com/calderwong/hapa-verseUs-prototype/blob/a68cfd0b8af874498cdb3e617715f941e52b76f2/src/hapa/presentation/versus.css#L363-L381
[controls]: https://github.com/calderwong/hapa-verseUs-prototype/blob/a68cfd0b8af874498cdb3e617715f941e52b76f2/docs/requirements/design-companion-v1.txt#L358-L417
[concession-ui]: https://github.com/calderwong/hapa-verseUs-prototype/blob/a68cfd0b8af874498cdb3e617715f941e52b76f2/docs/requirements/design-companion-v1.txt#L490-L494
[concession-rule]: https://github.com/calderwong/hapa-verseUs-prototype/blob/a68cfd0b8af874498cdb3e617715f941e52b76f2/docs/requirements/master-requirements-v3.txt#L1217-L1220
[journeys]: https://github.com/calderwong/hapa-verseUs-prototype/blob/a68cfd0b8af874498cdb3e617715f941e52b76f2/tools/hapa/ui-journeys.mjs
[selection-journey]: https://github.com/calderwong/hapa-verseUs-prototype/blob/a68cfd0b8af874498cdb3e617715f941e52b76f2/tools/hapa/ui-journeys.mjs#L316-L330
[after-data]: https://github.com/calderwong/hapa-verseUs-prototype/blob/a68cfd0b8af874498cdb3e617715f941e52b76f2/docs/reviews/evidence/2026-11-22/response-02/after-report.json
[compact-image]: evidence/2026-11-22/response-02/after-ux07-home-A-1280x720.jpg
[card-image]: evidence/2026-11-22/response-02/after-ux08-hand-and-inspector.jpg
[deep-image]: evidence/2026-11-22/response-02/after-ux04-band-3-scenery-on.jpg
[selection-image]: evidence/2026-11-22/response-02/after-ux10-selected-castle-rotated90.jpg
