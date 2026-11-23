# UI and design review 03 — 22 November 2026

## Decision

**Keep the improved interface. Finish three specific interaction repairs, then make one terrain-and-party scene look unmistakably like Hapa.** The opening/planning work has advanced enough to use as the working foundation for that visual scene. This is a recommendation to move the next implementation scope forward, not CJ's acceptance of all prior requirements.

The new compact layout gives the battlefield useful room. The decision column makes public plans and the single Ready action easier to find. The source and evidence address the earlier playback-layer defect, truthful concession feedback, and a keyboard route through Supply, movement and resolution. The new regression command is a substantial improvement over an evidence recorder that could finish without checking its results.

Three remaining correctness issues deserve focused attention: an unaffordable mixed-color response can be offered; an old match's pending work can survive starting a new match; and modal dialogs do not actually contain keyboard focus. These are separate from the largest visual opportunity: making terrain read as physical, excavatable ground and making one party read as authored Hapa characters.

## Baseline, authority and limits

| Item | Reviewed identity or scope |
| --- | --- |
| Prototype | `calderwong/hapa-verseUs-prototype` at **`164b8dfe46d2b6b8ec0975cc8f53ea5428770230`** |
| Last review | [Review 02](2026-11-22-ui-design-review-02.md), which examined `a68cfd0b8af874498cdb3e617715f941e52b76f2` |
| Last published notes | `06c54f979846c5ad7e15365030a1e74231a8f678`; fourteen subsequent commits reach this review's pin |
| Implementation responses | [Response 03](2026-11-22-ui-design-response-03.md), the parallel continuation of original UX findings; [response 04](2026-11-22-ui-design-response-04.md), the answer to review 02 / assignment 03 |
| Engine gitlink | **`ba838cca09ba43afceda0452b63d28df4cbf7f72`**, unchanged |
| Browser evidence | Committed response 03/04 screenshots and reports; response 04's after run identifies clean implementation commit `8a2ed9fd593015632400367c571eda10b10735e7` |
| Task authority | Overwatch `hapa-versus`; response 04 reports HV-52 in Review and HV-53 in Backlog. This review did not independently fetch or update the board. |

Master Requirements v3 continues to govern gameplay. The Design Companion proposes presentation; the References Master supplies implementation advice. The older shorthand in chat is not a replacement for those resolved specifications. Keep deterministic rules, public information, plain JavaScript modules and the engine ownership boundary. A visual proposal must not change collision, income, movement, timing, Card use or definition lineage.

**Independent work in this review:** reconstructed and Git-blob-verified all 107 non-image file blobs in the pinned tree; inspected source, reports and thirteen committed captures; ran 82 existing Node tests across thirteen test files, all passing; reproduced the response-payment and match-lifecycle issues with extracted current controller methods and the real rules/session modules. Those reproductions use minimal DOM/render adapters, not a rendered browser. The modal finding is source-supported and still needs browser reproduction. See the [verification record and reproducible probes](evidence/2026-11-22/review-03/README.md).

**Not independently rerun:** `npm run check`, four external-dependency protocol tests, the full browser suite, GPU performance, CJ's running Mac build, or a human playtest. Browser execution was unavailable in this review environment. Response 04 reports 86/86 tests plus simulation, peer and build checks; its browser report records eight journey groups, 282 assertions and zero failures. Those are the implementation author's results, not fresh independent browser results. CJ acceptance remains unrecorded.

## What improved, and what should remain

| Previous concern | Current evidence | Disposition |
| --- | --- | --- |
| Playback ignored the selected height layer; height timing was suspect | `playback.js` carries alive/band/height poses; `BoardView.sync` owns body visibility. Four new playback tests pass in the independent run. C4 and the ramp report supply recorded browser evidence. | Keep the fix. The recorded ramp example is a descent; it is not an exhaustive vertical-motion test. |
| Public plans competed with Ready in a shallow bottom strip | A right decision column contains the inspector and plan dock. Orders wrap; Expand plans is available; stale review elevates changed enemy orders while preserving the frozen own plan. | Retain this layout provisionally. Scrolling a full plan is acceptable when the route is obvious. |
| Compact roster/resource access was weak | A drawer is available through the 1440 px breakpoint. Mana stays accessible. At 1280×720 the recorded canvas grows from **702×424 to 946×424**. | Material improvement in inspected captures. At 1600×1000 the new canvas is 994×638, versus 1014×638 before: a small width tradeoff for the decision column. |
| Keyboard opening was incomplete | C5 supplies a real Tab/Enter/Escape route and checks the final Castle at R2C1, one Supply remaining and nine members after merging. | The tested route works. Fluent keyboard navigation and full targeting parity are still partial. |
| Concede reported success even when refused | Menu explanation, confirmation, cancellation and truthful accepted/refused feedback are present. | Keep these repairs. Phase-independent terminal concession remains the separate HV-53 protocol follow-up. |
| Important labels were implementation shorthand | Party identity leads the inspector; plan verbs and help are clearer; Card use and planned quantities have accessible labels. | Preserve the plain language and exact details. Some Card edge cases remain untested. |
| Browser recording could pass without validating behavior | `ui-regress.mjs` compares expected/actual values, fails missing controls/errors and preserves unique runs. Its deliberate failure run fails the two planted expectations. | Retire the old recorder-only finding. Tighten a few specific assertions rather than replacing the suite. |
| Terrain could only be shown schematically, with no UI command | Strata, pit floors, a labeled cutaway grid, planned/running work markers and legal terrain-work controls now exist. | This is a useful foundation for the already requested authored scene. It has not yet achieved the material or character art direction. |

The compact and full-size opening captures are [1280×720][compact] and [1600×1000][desktop]. The [stale-review capture][stale] shows the changed-plan presentation. These are committed implementation captures, not new screenshots produced by this review.

## Findings for the next implementation

### R3-01 — An offered counter must have a payment the rules can actually make

**P1. Reproduced with current controller methods and actual rules; browser confirmation still required.** The response panel estimates affordability separately for each cost color, adding the entire Rainbow pool to every color. That spends the same Rainbow unit more than once in its estimate. The authoritative `planPayment` function correctly allocates each unit once. [Controller][app] · [Economy][economy]

The reproduction uses a valid diagnostic derivative of Blue Denial whose cost is **one Red plus one Blue**, with **one Rainbow** in the responding player's pool and no other usable payment Card. Content validation accepts that definition. The UI enables the response; the rules cannot pay it. Submitting the offered response produces `command_rejected` followed by `passed`, and the incoming Ember damage resolves. With two Rainbow, the same counter succeeds. The ordinary two-Blue control also succeeds. This is a custom/mixed-cost case; it does not mean the default Blue Denial always fails. [Recorded reproduction](evidence/2026-11-22/review-03/response-payment-result.json)

**Required behavior:** derive final availability from the same non-mutating payment calculation used by the rules, after the exact proposed burns. The visible cost, proposed burns, source consumption and enabled state must agree. Preserve the rule that the response source cannot also be burned as payment. Do not change the payment rules or silently substitute a Pass in the interface for a response the interface claimed was available.

**Acceptance:** one Rainbow cannot offer the Red+Blue response; two Rainbow can; a suitable colored Card plus Rainbow can pay only the missing portion. Actually cast a paid counter through the browser and assert the chosen source, exact burns, remaining pool, `counter_applied` and replay result. Keep the existing Pass/Ready-spam test, but recognize that it never casts a response and did not cover this new payment logic.

### R3-02 — Starting a new match must detach the previous match's unfinished work

**P1. Reproduced with current controller methods and actual rules/session modules; no rendered-browser claim.** Match menu exposes New match while a human response is pending. `startMatch` replaces `this.session` and resets playback/resolving, but leaves `pendingChoice` attached to the old resolution. The new match is then blocked from editing. Answering that old choice resumes `_resolveAgreed`, which captured the old state but appends its events/replay through the now-current `this.session`. [Controller: `startMatch`, `_askResponse`, `_resolveAgreed`, `_tryResolve`][app]

The diagnostic reproduction starts the response fixture, replaces it with the terrain fixture, then answers the old requests. The new session receives old Tick 9 replay content; authoritative replay verification fails with **`tick numbering differs (5)`**. This seam also exists in the prior reviewed source: it is a current defect, not a claim that response 04 introduced it. [Recorded reproduction](evidence/2026-11-22/review-03/new-match-lifecycle-result.json)

**Required behavior:** give pending choices, playback, asynchronous initialization and scheduled continuation clear ownership by one match/session. On replacement, cancel or detach that work. A late result from the prior session must not write into the new session, release its busy latch, change its view, or advance its Tick. A session-generation guard or equivalent captured-session ownership is an implementation choice; merely clearing the visible panel does not address the continuation.

**Acceptance:** use the visible menu to start a new match from planning, from a pending response and during paused playback. The new match is immediately usable, has only its own history and passes replay verification after a normal Tick. Old callbacks/choices cannot mutate it. Starting a local new match is not a concession and must not manufacture a terminal event for a peer match. Do not fold HV-53's protocol redesign into this repair.

### R3-03 — A modal sheet must contain focus and prevent background actions

**P1. Source-supported defect risk, awaiting browser reproduction.** `_sheet` focuses its first button and sets modal semantics on menu/confirmation content. The window key handler returns while the overlay is open, but it neither contains Tab/Shift+Tab nor makes the background inert. Background native buttons remain in the document's tab sequence; returning from a window key handler does not prevent native button activation. Some element handlers execute before that handler. [Controller: `_sheet`, `_closeSheet`, `_bindKeys`][app]

This matters because a player considering concession should not tab into an obscured Supply, order-removal or Ready control and activate it. The W3C modal pattern specifies an inert background, a contained tab sequence and logical focus restoration; `aria-modal` alone supplies none of that behavior. [W3C modal-dialog guidance](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) · [MDN inert behavior](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert)

**Acceptance:** open menu and concession confirmation using the keyboard; cycle forward/backward beyond their controls; focus remains visibly inside. Enter/Space and the Ready shortcut cannot activate obscured game controls. Cancel/Escape changes no orders and returns focus to a sensible live opener. Use one coherent lifecycle for menu, confirmation and other blocking sheets; retain their intentional dismissal rules. Verify this in a real browser rather than asserting only that `aria-modal` exists.

### R3-04 — Make the next visual scene a physical, readable Hapa battlefield

**P2. Visual recommendation; the main design assignment after the focused repairs.** In the inspected [hill capture][hill], the raised surface is still a flat ochre block with a simple ramp. Strata add useful depth, but large labels do much of the explanatory work. The [planned dig][dig] and [cutaway floor][floor] show where work happens, while the roofed result is still largely a dashed surface representation. The party is consistent Lumina placeholder art, not yet the brushed-pixel Hapa treatment described in the Companion.

Build the previously named R2-09 scene, keeping the HUD and rules intact:

1. **One material construction:** ordinary ground, a supported rise/ramp, an open trench and a roofed passage. Paint broad material planes, a readable cap, strata and cut faces. Keep the legal contact strips and formation spacing. The playable interior should read as connected ground with fitted territory seams, while the banks/frame can read as a crafted object.
2. **One convincing excavation:** point to the exact face/cube; preview the real duration and cost; show planned work while the face stays solid; show the accepted change at completion; reveal the cavity, floor and retained roof before dust obscures them. Rejection must leave the solid intact. Use an existing operation and valid fixture. A cinematic effect is not proof that a roofed cavity is geometrically understandable.
3. **One authored asymmetric party:** shield-bearing and ranged members with a shared Hapa proportion/material style. Use approved owned assets where available; otherwise create a clearly provisional sample through the existing authorized asset workflow. Keep shield handedness, world-facing, silhouettes, slot spacing and contact grounding through a full orbit. Do not produce a large roster yet.
4. **A restrained state hierarchy:** retain slate/ivory/brass UI; material hue does not identify Mana. Alignment lives on a bounded edge inlay and glyph. Selection, legal target, planned action, accepted change and required response remain different signals. Quiet routine glow and oversized terrain labels only where the physical form and existing inspector carry the meaning; preserve explicit text access.
5. **Three useful distances:** overview for territory/party/height, tactical for formation/facing/route, inspection for character and material detail. Compare at 1280×720 and 1600×1000 with the same state and camera. Check a full orbit, all/isolated height views, and one muted/reduced-motion route.

The Companion already resolves an important spatial ambiguity: there are six occupied bands (+1/+2/+3 and −1/−2/−3), with Ground 0 a boundary, not a seventh occupied layer. A supported hill occupant and a flyer can share +2 while having different movement/exposure. A cutaway changes visibility, not the roof's rules state or income eligibility. Preserve that distinction in every visual treatment. [Design Companion, chapters 3–4 and production guidance][companion]

Do not make the scene depend on a new broad art questionnaire. Use the existing asymmetric fixture party as a provisional representative, document the asset choice and show CJ the result. Canonical character selection can refine that sample afterward. Respect actual Overwatch dependencies and acceptance gates; this review does not move a gated card or waive a dependency.

### R3-05 — Correct evidence identity and keep the remaining promises precise

**P2. Evidence and bounded completion work; not a request to restart the test matrix.** Preserve the new regression command. Its count means eight journey groups and 282 assertions in one after run; 153 are repeated layout checks. The 34 before failures are failed contract checks, sometimes cascading from a missing control, not 34 independently reproduced bugs. The deliberate failure run has two expected failures out of 25 assertions. [Regression source][regress] · [Committed reports][reports]

Three small corrections have high value:

- **Engine provenance:** the before report's engine field is the outer prototype SHA `00c0f2e…`. `git -C vendor/lumina rev-parse HEAD` searches upward when the copied engine has no Git metadata. Record the parent gitlink separately from a verified runtime engine checkout; mark copied bytes unverified or hash them. Preserve the old report and append the correction. This does not discard its screenshots or require a blanket rerun.
- **Card identity:** C8 searches all labels for matching Supply/Mana; it does not bind the assertion to a particular Card, seat and slot, and does not assert the ability despite the case title. Bind those checks to the expected instance and exact ability/overflow. C6's “every party listed” checks at least four rows; either compare the expected set or narrow the claim. Test labels should describe their actual predicate.
- **Real response use:** add the paid-counter case from R3-01. A visible response panel and two Pass choices do not validate response payment or source consumption.

The following remain explicit follow-ups, with no new CJ decision required to discover their expected behavior:

| Remaining work | Context and boundary |
| --- | --- |
| Faster keyboard navigation | C5 records 29 Tabs to the first hand Card and 36 from a result to Inspect the Card, with programmatic blur resets. Improve the local result-to-inspector handoff and bank entry when touching focus; record one uninterrupted route with focus in view. Passing that route is not full keyboard parity. |
| Full destination/ability targeting | The Move list truncates to twelve nearest destinations. That does not expose every legal destination. Board keyboard focus, retreat/ability targeting and screen-reader validation remain separate work. |
| Card edge cases | Long titles, reserved Cards and bank replacement were already requested in assignment 03. Use a valid diagnostic definition and exact identity assertions; preserve production mint behavior. They are partial, not newly optional. |
| Enlarged text/reflow | The 150% case is a viewport/DPR emulation, not independent text scaling. The 200% observation shows 26 px Card tiles and clipped text. Keep this as a known gap; do not report 200% acceptance. |
| Terrain timing wording | `_workList` says work completes at the end of the Tick. That is true of the current one-Tick fixture but not every supported multi-Tick profile. Derive the scene's duration/finish label from the actual work/profile. The amber running stage is currently code-path evidence only. |
| Phase-independent concession | HV-53 owns the signed terminal-input, cancellation/ordering and replay work. Confirmation feedback is repaired; the broader terminal behavior is not complete. |
| Human acceptance | A first-time player and CJ still need to judge the interface and scene. Automated checks cannot establish that judgment. |

## Next handoff

Use [assignment 04 — reliable interactions and the first Hapa visual scene](2026-11-22-next-agent-assignment-04.md). Keep the repairs and art study in separable commits. Extend tests for the demonstrated failures, fix evidence identity, and proceed to the scene without another general HUD redesign.

The next local report should be **response 05**, since responses 03 and 04 both exist. Use the template, append Overwatch evidence through the real local workflow, and preserve all earlier records. Report implementation, observed verification and CJ acceptance separately. Where a board dependency blocks a status move, record it honestly rather than inventing a waiver.

[app]: https://github.com/calderwong/hapa-verseUs-prototype/blob/164b8dfe46d2b6b8ec0975cc8f53ea5428770230/src/hapa/presentation/app.js
[economy]: https://github.com/calderwong/hapa-verseUs-prototype/blob/164b8dfe46d2b6b8ec0975cc8f53ea5428770230/src/hapa/rules/economy.js
[regress]: https://github.com/calderwong/hapa-verseUs-prototype/blob/164b8dfe46d2b6b8ec0975cc8f53ea5428770230/tools/hapa/ui-regress.mjs
[reports]: evidence/2026-11-22/response-04/regress/
[companion]: ../requirements/design-companion-v1.txt
[compact]: evidence/2026-11-22/response-04/regress/after-8a2ed9f/c6-1280x720.jpg
[desktop]: evidence/2026-11-22/response-04/regress/after-8a2ed9f/c6-1600x1000.jpg
[stale]: evidence/2026-11-22/response-04/regress/after-8a2ed9f/c1-stale-review.jpg
[hill]: evidence/2026-11-22/response-03/after-ux11-1-hill-pit.jpg
[dig]: evidence/2026-11-22/response-03/after-ux11-3-planned-dig.jpg
[floor]: evidence/2026-11-22/response-03/after-ux11-2-cutaway-floor.jpg
