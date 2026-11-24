# UI and design review 08 — Preserve progress; make party growth reliable

**23 November 2026 · America/Los_Angeles**  
**Reviewed source:** `calderwong/hapa-verseUs-prototype@f7c4f0f69afbc22458c400f01521e5b468f5f602`  
**Current default profile:** `hapa_open_10x9_v3_06`  
**Next implementation:** [assignment 10](2026-11-23-next-agent-assignment-10.md)  
**Current decisions:** [addendum 04](../requirements/2026-11-23-human-feedback-addendum-04.md), together with compatible requirements in addenda 01–03.

## Verdict

The recent work substantially answers CJ's previous playability and information-density complaints. Keep the current design direction. Ordinary selection stays compact, deliberate close inspection reveals icon/value facts on the members, history is voluntary, and one Ready advances the local human-versus-bot match. The original opening diagonal now reaches the next territory center and absorbs its Pawn.

The most important remaining defect is **formation integrity during Pawn absorption**. A party can lose a living member from its formation slots, or be refused a refill that should fit after casualties. Repair this before further visual polish. The other confirmed findings are bounded inconsistencies between already-built components: bot traversal, copied match configuration, fallback definitions, and peer message ordering.

This review does not certify the entire game as feature complete or record CJ acceptance. It identifies a finite reliability pass on the current playable build; it is not a request to drain every historical board card.

## 1. Baseline and evidence

| Item | Reviewed evidence |
| --- | --- |
| Main | `f7c4f0f69afbc22458c400f01521e5b468f5f602`, response 09 addendum publication |
| Latest behavior implementation | `2286e17bc842947c72e3a3ec5ea4dfdd9b3ff32e`; then browser-test selector correction `80bf3d3794a2e8155e96267b79b49831967ced64` |
| Engine gitlink | `ba838cca09ba43afceda0452b63d28df4cbf7f72`, unchanged |
| Source review | 98 source, fixture, test and selected documentation files verified against their Git blob hashes |
| Independent rules checks | Existing `center-travel.test.js`: 8 passed. One actual-rules probe covers two absorption failures, the ordinary Queen opening and the bot's stale restriction |
| Other independent diagnostics | Exact-source launch-link probe; exact Peer class with substituted transport I/O; exact MemberLabels methods with minimal DOM stubs |
| Submitted visual evidence | Four repository images downloaded and blob-verified, covering shield definitions, inspection with history, planned Mana availability and the latest Knight switcher |
| Fresh live observation | Separate Chrome match on CJ's local server. Menu identified v3_06, A human/B bot, seed 1. One human Ready with an empty A plan and three bot orders advanced Tick 1 to Tick 2 without acknowledgment; History opened voluntarily; Knight selection/inspection showed compact controls and member icons |
| Live build identity | Profile was visible; source commit and working-tree cleanliness were not exposed. Live observations are supplementary, not proof that the server exactly equals the pinned GitHub commit |

The reviewer did not rerun the full `npm run check`, full browser matrix or network transport. An attempted focused recovery test could not import `hypercore-crypto` in the materialized review environment; no recovery assertion ran. That is a dependency limitation, not a movement-test failure. See [verification and diagnostics](evidence/2026-11-23/review-08/README.md).

The coding agent separately reports `npm run check` passing at `2286e17` with 131 tests, smoke/peers/build; selected browser checks were 112/113 there, followed by z16 at 17/17 after the selector correction at `80bf3d3`. These are **reported implementation results at those revisions**, not an independent full-suite pass at the reviewed head. Earlier 129-test counts belong to an earlier response 09 revision. [Response09](2026-11-23-ui-design-response-09.md) preserves the detailed chronology.

## 2. The newer gameplay decisions govern

Response09 records additional direct playtest instructions from CJ after review 07. They supersede the prior recommendation to retain neighboring friendly-body obstruction in the new default:

- Normal unobstructed travel reaches territory centers. A compatible unmounted friendly Pawn is absorbed when the moving Mount reaches its center, including along a longer route.
- Nearby friendly bodies in a different territory do not recreate the old half-step obstruction. Enemy body contact remains.
- Knights may choose either L and traverse friendly intermediate territories. A nonabsorbable friendly final destination remains forbidden.
- Repeated right-click on the same Knight destination flips its L without duplicating the order; visible switcher controls remain.
- Each side has two Queens around the central Commander. Column colors/Card bindings remain. Commander death and the existing Capital capture condition remain the victory rules.
- Knights turn freely while traveling, face each leg and may choose arrival facing. Other Mounts retain their existing turn rules. Speed and facing controls are visible.

[Addendum 04](../requirements/2026-11-23-human-feedback-addendum-04.md) consolidates that recorded direction and its provenance. It corrects the handoff's stale authority pointer without rewriting historical profiles or representing the reviewer's recommendations as new CJ decisions.

## 3. What has improved and should stay

### Movement now matches the ordinary opening expectation

The actual-rules opening reproduction loads six Supply into A's Queen in C6 and orders R4C9 at Tick 6. Under v3_06 it finishes that Tick at **R2C7's center**, absorbs Pawn C7, and has **five Supply**. Its replay verifies. The old 5.5-Supply half-step is not an unresolved default-profile bug. Legacy tests may still reproduce it intentionally under their pinned older profiles.

Existing center-travel checks pass for the Bishop diagonal, both Knight paths, occupied friendly endpoints, enemy contact, two Queens, free Knight turns and chosen arrival facing. Do not repair the remaining issues by reverting these decisions or increasing movement speed again.

### Ready and history now support play

The live human-A/bot-B match accepted a single Ready and advanced normally. It did not force the Orders drawer or ask for updated-plan acknowledgment. I then opened History explicitly and saw Tick navigation with grouped movement/resources entries. The source retains exact own-plan freezing, validation, a resolution latch and genuine response choices.

The peer integration finding below concerns a separate message-consumption path. It does not negate this observed local improvement.

### Inspection is developing a useful visual grammar

The submitted shield-definition image and live Knight inspection show a compact progression: role and health, attack and reach, then protection and coverage. Explanations appear on request. Selection and inspection remain distinct; the command bar and inspection strip identify their subjects. Keep this structure rather than restoring a permanent prose panel.

The current Knight switcher makes the route alternatives and arrival-facing control visible. Keep these discoverable controls alongside shortcuts. No material Speed/ETA defect was established in this review.

### Current-Tick Mana and bot controls are connected

Source inspection supports immediate current-plan Mana availability, ordered burn/payment projection, invalid dependent-order handling after undo, and accepted-event reconciliation. Submitted response 08 evidence shows the visible balance before Ready. The independent live check did not exercise a Mana-bearing burn/cast; the opening Cards observed had zero Mana, which is legitimate.

The development menu visibly exposes all four human/bot combinations and states that changing controllers starts a new match. Source contains saved preset validation and Pause/Step/Stop lifecycle guards. The copied-link omission below is a specific configuration problem, not evidence that the controller feature is absent.

## 4. Findings for the next pass

### R8-01 · P1 — Pawn absorption can omit a living member or reject a valid casualty refill

**Player consequence.** Combining surviving formations can silently change which members participate in the party, or leave two unmerged parties on the same center despite available capacity. This affects the central composition mechanic and must precede optional polish.

**Reproduction A.** A diagnostic Queen with only its center member and three Supply travels through two friendly Pawns, each with two survivors in slots 1/2. Both absorptions are legal. During the second merge, both incoming members are assigned slot 3; the second overwrites the first. The final state has **five living members owned by the Queen but only four referenced in its slots**. The merge event records both assignments to slot 3. This is a labeled diagnostic, not a claim that it occurred in the ordinary opening.

**Reproduction B.** Begin with a full Queen, then use the actual casualty helper to kill four members. Five living members remain, with dead IDs still occupying slot fields. A four-member Pawn fits the living-member limit of nine and the destination validates. The allocator instead reports `over capacity`; the Queen nevertheless reaches the Pawn's center and the Pawn remains unmerged. Both broken outcomes replay deterministically, so replay agreement alone cannot establish member conservation.

**Cause.** `src/hapa/rules/movement.js:355–375` plans transfers without reserving each chosen slot. It also treats dead slot references as occupied. `mergeCandidate` at 420–423 uses living capacity, so permission and allocation disagree. `combat.js:376–389` retains casualty IDs; movement calls merge after arriving at 602–605.

**Required correction.** Compute one complete, unique assignment from living occupancy before committing transfers. Reserve chosen destinations as the allocation is built; preserve nonconflicting placements and resolve collisions into distinct valid slots. Historical casualty records may remain, but cannot count as living capacity. Retire the absorbed Pawn only after a valid complete transfer. A failed absorption cannot silently leave otherwise nonsharing parties coincident.

**Enough evidence.** Two focused cases—successive partial-Pawn pickups and casualty refill—assert living-member conservation, unique slot/ownership correspondence, correct retirement, capacity and replay. Reuse the established ordinary-opening control. If changing rules alters historical replay outcomes, apply the repository's explicit profile/version boundary rather than silently reinterpreting old records.

### R8-02 · P2 — The bot still rejects legal Knight travel through friendly parties

**Player consequence.** Human commands can use the newly allowed Knight route, while the bot needlessly rejects it and may leave the Knight inactive. This weakens the usefulness of the test opponent without requiring any new AI strategy to fix.

**Reproduction.** A funded Knight at R4C3 can legally travel through friendly Castles at R5C3 and R6C3 to R6C4. The shared validator accepts the route and clearance says clear. The bot still filters it out. In the diagnostic arrangement, the same extra filter removes every useful forward L and the Knight receives no destination.

**Cause.** `src/hapa/controllers/heuristic-bot.js:85–87` applies an unconditional intermediate-friendly blocker after the profile-aware checks.

**Required correction.** Base the bot's eligibility on the shared current-profile traversal/clearance rules. Preserve the prohibition on a nonabsorbable friendly final destination and legacy dispatch. One deterministic fixture must show a legal funded Knight route through a friendly intermediate territory remains available and can be selected. Do not start a bot-strength or model-service project.

### R8-03 · P2 — A copied match link can reopen old rules

**Player consequence.** Someone can copy a v3_06 match link yet reopen v3_02, including the old repeated acknowledgment behavior, if that browser has a saved legacy preset. This can look like a failed fix or a regression.

**Reproduction.** The current menu creates `/versus.html?autostart=1&a=human&b=bot&seed=1` for v3_06. Resolve that exact link with a saved v3_02 preset: roles and seed match the link, but the rules profile becomes v3_02 and agreement becomes `pair_acknowledgment_v3`.

**Cause.** `app.js:1694` removes the profile ID when it equals the current default. `dev-preset.js:51–68` correctly lets the saved profile fill an absent URL parameter. The shared link therefore omits part of the configuration it claims to reproduce.

**Required correction.** Include the resolved profile in copied links, even when it is the built-in default. Preserve saved-preset precedence for deliberately bare launch URLs; do not overwrite a user's intentional legacy preset. One cross-preset reproduction must reopen the copied profile exactly. Keep fixture configuration explicit if producing a diagnostic link.

### R8-04 · P2 — Fallback icon definitions can be missing or stale

**Player consequence.** When a member is roofed, offscreen or too small for an on-body label, the fallback buttons can show facts but fail to explain them. A definition may also retain a previous value after the current fact changes. That breaks the in-context learning requirement precisely when the fallback is needed.

**Reproduction.** The exact `MemberLabels.update` method receives an unavailable member with a health chip of 3/3. No registry entry is created and `showTip` returns false. Seed an older 3/3 definition, then supply current 1/3 facts while the body remains unavailable: the registry still holds 3/3. This is a method-level diagnostic with DOM stubs, not a fresh browser recording of a roofed-unit journey.

**Cause.** `member-labels.js:274–291` skips invisible labels before registering their definitions, while `showTip` at 192–194 requires that registry. The fallback buttons in `app.js:1392,1410–1413` call the same lookup.

**Required correction.** Maintain current inspected-member definitions independently of whether labels render. Remove obsolete references when the subject/snapshot changes. Refresh or close an open definition when its source changes. Keep the current compact layout.

**Enough evidence.** A focused registry update regression and one keyboard or deliberate-touch inspection journey in which the body's label is absent from the outset. Current role, health and protection definitions must work without requiring a prior zoom into a visible label.

### R8-05 · P2 — The peer runner skips an opponent's edited plan before Ready

**Scope.** This is a protocol integration defect, not a blocker in the independently observed local A-human/B-bot loop. Addendum 03 explicitly required both local and peer paths to honor own-plan commitment.

**Reproduction.** Feed the exact Peer class an ordered, verified-body inbox containing B plan revision 1, a legal revision 2, then B's sole Ready for revision 2. `Peer.playTick()` consumes revision 1 and Ready 2, leaves revision 2 queued and throws `B's Ready names its own revision 2, current is 1`. Direct `PhaseAgreement` given the same records in order locks A1/B2 correctly.

**Cause.** `src/hapa/protocol/peer.js:118–130` takes one remote plan, then searches independently for Ready. `_take` at 95–105 can skip a queued plan revision. The existing peer smoke uses one bot plan per Tick and does not exercise editable public plans.

**Required correction.** Consume the applicable phase's plan/Ready records in order through the agreement until both own commitments lock. Retain signature/hash, match/phase/state binding, duplicate handling and frozen-own-plan rules. One peer-level edit-sequence regression must resolve once with the final pair. No lobby, new transport, reconnection project or multiplayer UI is included.

**Evidence limit.** The diagnostic uses actual rules/current profile/agreement and exact Peer class methods, substituting transport publication and verified inbox delivery. It does not claim a live Hypercore/socket test.

### R8-06 · P3 — Two small feedback inconsistencies

These fit the final presentation pass; they do not justify a new design milestone.

1. **Arrival-facing toast is covered by a Mana counter.** The latest submitted `80bf3d3` Knight capture visibly shows `B AVAILABLE 0` obscuring the toast's final shortcut text. `.toast` uses z-index 5 while `.basin-counter` uses 20 (`versus.css:178,63`). Place transient feedback in measured free space or give it appropriate noninteractive stacking. Preserve usable fixed controls. One normal-home-camera capture is sufficient.
2. **Navigator Fire Pit text can disagree with current availability.** `app.js:1808–1809` formats the authoritative pool, while the main basin uses current-plan availability. After a positive planned burn the navigator can say empty while the board balance is spendable. Reuse the same read model, or explicitly name the different quantity; do not reintroduce a second resource panel. This is source-supported; the reviewer did not independently burn a positive-Mana Card in the live check.

## 5. Limits and decisions to retain for later

Response09 openly records that a Knight can finish an intermediate Tick inside a friendly-held territory while continuing its L. That may warrant a later presentation or occupancy decision if playtesting shows confusion. It is not permission to restore neighboring friendly-body blocking or invent a waiting penalty in this repair.

No material camera-relative route-glyph, Speed/ETA or post-absorption preview-shape failure was demonstrated in this pass. Those suspicions are not assigned work. Keep the next run focused on confirmed findings.

The next handoff should identify the fixed candidate, the relevant evidence, remaining real limitations, running profile and publication state. CJ acceptance remains separate. The [assignment](2026-11-23-next-agent-assignment-10.md) supplies the bounded execution and stopping conditions.
