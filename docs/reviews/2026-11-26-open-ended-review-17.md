# Review 17 — Protect accepted actions and keep the player view recoverable

**Date:** 26 November 2026. **Request:** CJ asked for one more open-ended review and a prompt for the same coding agent to pick up the last three passes. The [combined coding handoff](2026-11-26-three-pass-coding-handoff.md) is now the current execution prompt. It brings the earlier reliability work, selected visual work and this review into one milestone.

## Assessment

The implementation has useful foundations: a shared deterministic rules engine, signed peer journals, a desktop host, a physical table, contextual inspection and an established presentation vocabulary. The remaining work should make those connections dependable and then finish their visual expression.

This pass adds **six concrete findings**. Two concern rules/content admission; four concern the relationship among durable authority, the renderer and match lifecycle. The important distinction is that valid signatures or deterministic replay do not by themselves make resource accounting correct, and a correct authority does not by itself ensure the player sees the current public state or has usable recovery controls.

The next action is implementation through the combined handoff, with focused checks during assembly and one integrated qualification. The earlier visual direction remains selected; these new correctness issues determine its dependency order.

## The three passes being handed off

| Pass | Documents | What carries forward |
| --- | --- | --- |
| 1 — Desktop/P2P reliability | [Review 16](2026-11-25-desktop-p2p-review-16.md), [Assignment 17](2026-11-25-next-agent-assignment-17.md) | R16-01–08: trustworthy public evidence, recoverable finalization/setup, configured discovery and visible profiles, exact Ready, host recovery, local online music and notices |
| 2 — Visual/aesthetic/animation | [Visual review](2026-11-26-visual-animation-review.md), [feature brief](2026-11-26-visual-animation-feature-brief.md) | VA-01–04 presentation corrections; the core entrance/material/Card/actor/spell/absorption/terrain pass; conditional layout/density trials and optional flourishes remain labelled |
| 3 — This open-ended review | This document and its [evidence](evidence/2026-11-26/review-17/README.md) | R17-01–06 below, folded into the same rules, decision, recovery and lifecycle connections |

CJ's request to have the same agent pick up all three passes selects the core visual follow-on that was previously recorded as a recommendation. The combined handoff reconciles that newer scope with Assignment 17's earlier instruction to avoid a new visual redesign. Preserve the existing game, scene and ownership boundaries while completing the selected refinements.

## Source and evidence boundary

| Item | Identity or observation |
| --- | --- |
| Reviewed GitHub main | [`d113216c8473cf8fc1809e7720cd7a09ad76fa6b`](https://github.com/calderwong/hapa-verseUs-prototype/commit/d113216c8473cf8fc1809e7720cd7a09ad76fa6b) |
| Latest reported implementation | `532643846f815106f7e33551099d02008e03c4d2`; intervening commits are documentation/evidence |
| Engine | `calderwong/lumina-hapa` at `ba838cca09ba43afceda0452b63d28df4cbf7f72` |
| Default profile | `hapa_open_10x9_v3_07` |
| Executed evidence | One actual-rules/content diagnostic and two source-method orchestration diagnostics |
| Unobserved in this pass | CJ's local unpushed work, live browser/Electron gameplay, native Hypercore faults, real peer timing, GPU/performance, installed appearance and human acceptance |

The [source register](evidence/2026-11-26/review-17/source-register.json) pins the reviewed files and diagnostic inputs. The source-method probes use exact application methods with controlled substitutes; their limits are stated alongside each finding. They are attachment evidence, not substitutes for the required installed journey.

## New findings

| ID | Priority | Finding | Evidence |
| --- | --- | --- | --- |
| R17-01 | P1 | A single Card instance can pay Mana twice in one cast or response | Actual shared rules; ordinary and counter variants |
| R17-02 | P2 | A hash-valid imported damage Card can pass validation and create non-finite HP | Actual bundle adapter, match construction, validation and resolution |
| R17-03 | P1 | Failed response persistence loses the pending decision while the renderer continues | Exact authority and renderer methods with an injected append failure |
| R17-04 | P2 | Public plan/Ready events can be discarded while local presentation is on an earlier Tick | Actual client and selected app methods; delayed/current controls |
| R17-05 | P2 | A disputed session lacks persistent blocked status and an accessible departure path | Shared eligibility-gate probe plus UI/runtime source trace |
| R17-06 | P2 | Completed match authorities are replaced without lifecycle teardown | Exact lifecycle methods with counted fake authority handles |

### R17-01 — Enforce one consumption per Card instance

`abilityError()` checks every entry in `cmd.burns` against the same available state and adds the referenced Mana for each occurrence. It does not require distinct Card-instance IDs. `pay()` then burns every entry, and `burnCard()` grants Mana again without checking whether that same instance was consumed by an earlier entry.

The real-rules diagnostic prepares Ember Strike, which costs 2 Red, an empty pool and one burnable Card worth 1 Red. Using that fuel once is rejected as unaffordable. Listing its ID twice passes `validatePlan`; actual resolution emits two burns for the single Card, pays 2 Red and applies the 2-point hit. The input state remains unchanged during validation, so this is a resolution defect as well as an affordability defect.

The response variant prepares Blue Denial costing 2 Blue with one fuel Card worth 1 Blue. The honest response is rejected and the original spell resolves. Repeating that fuel ID accepts the counter and emits two burns. Both variants use the shared authoritative rules.

The normal UI payment chooser may generate unique lists; the diagnostic does not claim that it generates the repeated payload. The authority and public result replayer nevertheless admit client-supplied commands through these rules. A signed, replayable command can still violate the game's one-use resource invariant. R16-01's evidence work must therefore be accompanied by correct shared input accounting.

**Required correction:** validate the complete burn-list shape, distinct identities, current availability, ownership and bank relationship before consuming anything. Apply the invariant to both casts and responses, with a defensive once-only consumption check at the shared payment boundary. Reject repeated signed inputs with a named error rather than silently changing the submitted intent. Preserve legitimate distinct-Card payments and current-Tick Mana.

**Bounded acceptance:** repeated fuel is rejected in both ordinary casting and Blue Denial without consuming the source Card, fuel or pool. A legitimate distinct-Card payment still succeeds, each Card burns once, and preview/admission/events/replay agree. Coordinate rule compatibility as described below.

Source: [match.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/d113216c8473cf8fc1809e7720cd7a09ad76fa6b/src/hapa/rules/match.js), lines 117–125, 196–210 and 330–343; [online-match.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/d113216c8473cf8fc1809e7720cd7a09ad76fa6b/src/hapa/network/online-match.js), lines 202 and 257; [results.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/d113216c8473cf8fc1809e7720cd7a09ad76fa6b/src/hapa/network/results.js), lines 140–143. [Rules/content probe result](evidence/2026-11-26/review-17/rules-content-probe.json).

### R17-02 — Validate the executable content, in addition to its hash

The current content validator recognizes operation names but does not enforce their required payload fields. The installed damage operation declares `hits`, `power`, `channel` and `incomingFace`; a missing `power` is still admitted.

The diagnostic removes that field from a fixture damage Card, gives it a valid zero Mana cost and exports a correctly hashed bundle. Content validation and `loadBundle()` both succeed. Match creation from the returned catalog and plan validation also succeed. Resolving the Card passes `undefined` into damage arithmetic, produces non-finite damage/HP, and fingerprinting then throws `non-finite number at $.members.B.target.s5.hp`.

The existing user path is Cards & decks → Exchange → Import a bundle → bind the Card → start a local match. Source shows the successful import being persisted and labelled hash verified; the shared validator is reused at local catalog and manifest boundaries. The headless diagnostic uses prepared Card/combat state to isolate the failure and does not claim a live click-through.

**Scope:** public online alpha currently requires the bundled catalog fingerprint. This is a confirmed existing local import/editor/playability defect; the evidence does not establish arbitrary custom-Card injection into the default online preset.

**Required correction:** validate each executable operation against its installed schema, required fields, supported enums and safe numeric ranges before storage and match admission. Return errors naming the definition and field. Reject an invalid batch without modifying the existing catalog or running game. Keep semantic validity separate from strategic balance so unusual but valid Cards remain allowed. Add defensive arithmetic boundaries that fail predictably without poisoning authoritative state.

**Bounded acceptance:** reject the missing-power definition before it is stored or offered as playable; a valid counterpart still imports, binds, plays and replays with finite safe-integer state. Cover the required damage fields through the shared schema rather than patching only the demonstrated field. One ordinary import-to-local-play UI witness completes the path.

Source: [content declarations](https://github.com/calderwong/hapa-verseUs-prototype/blob/d113216c8473cf8fc1809e7720cd7a09ad76fa6b/fixtures/hapa/content.js), lines 63–72; [validate.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/d113216c8473cf8fc1809e7720cd7a09ad76fa6b/src/hapa/rules/validate.js), lines 104–123; [content adapter](https://github.com/calderwong/hapa-verseUs-prototype/blob/d113216c8473cf8fc1809e7720cd7a09ad76fa6b/src/hapa/adapters/content.js), lines 48–72; [editor.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/d113216c8473cf8fc1809e7720cd7a09ad76fa6b/src/hapa/presentation/editor.js), lines 99–110; [local-content.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/d113216c8473cf8fc1809e7720cd7a09ad76fa6b/src/hapa/presentation/local-content.js), lines 27–36; [combat.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/d113216c8473cf8fc1809e7720cd7a09ad76fa6b/src/hapa/rules/combat.js), lines 89 and 335–349. [Probe result](evidence/2026-11-26/review-17/rules-content-probe.json).

### R17-03 — Keep a response pending until the authority has recorded its answer

`OnlineMatch.choice()` clears `cur.pendingChoice` before awaiting the journal append. If append fails, it never resolves the waiting authority and never restores the choice. Retry returns `NO_CHOICE`; a reattached snapshot also sees no pending prompt.

The renderer then compounds the problem: `_resolveAgreed()` catches the rejected choice call, shows an error toast, accumulates the unrecorded answer and advances its local generator. It can start playback while the authority is still waiting for a response that the UI can no longer submit.

The orchestration diagnostic runs those exact methods with one injected append failure and a one-choice sentinel generator. It observes pending choice `null`, authority resolver not called, retry `NO_CHOICE`, renderer generator advanced and renderer playback started. This proves the durability/continuation connection failure; it is not a native-storage fault test or proof of a particular live spell outcome.

**Required correction:** retain an explicit pending/submitting response until the exact answer is durably established. Serialize submissions for that choice. A definite failure leaves a usable retry; an ambiguous acknowledgment reconciles the journal before retrying. Preserve choice identity, Tick and request hash; resolve once. The renderer advances only after confirmation or recovery of the recorded answer. Use structured state/errors rather than treating an error message containing `already` as sufficient success.

**Bounded acceptance:** force append failure during a real response, retry, and observe exactly one recorded choice and continuation. Then lose an acknowledgment after persistence succeeds and show recovery of that same answer without duplicate spend. This extends the decision boundary already being repaired for R16-05/06; it concerns responses inside a locked Tick rather than Ready.

Source: [online-match.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/d113216c8473cf8fc1809e7720cd7a09ad76fa6b/src/hapa/network/online-match.js), lines 307–322 and 335–340; [app.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/d113216c8473cf8fc1809e7720cd7a09ad76fa6b/src/hapa/presentation/app.js), lines 805–830. [Response/lifecycle probe result](evidence/2026-11-26/review-17/response-lifecycle-probe.json).

### R17-04 — Retain public updates until their Tick becomes visible

The runtime can begin its next Tick while the renderer is still playing or pausing the preceding Tick. This is appropriate independence, but the client only retains locked pairs, choices and agreed receipts. Remote public drafts and Ready are forwarded without a retained per-Tick projection. The app applies them only when their count equals its currently displayed Tick. Its initial attachment snapshot is consumed once, with no equivalent reconciliation when later Ticks become visible.

The diagnostic delivers remote Tick 5 revision 2 and Ready while the view remains on Tick 4, then opens Tick 5 through the relevant app method. The resulting view has zero remote commands, revision 0 and Ready false. Delivering those same events while already viewing Tick 5 yields one command, revision 2 and Ready true.

The authority's plan remains intact and a later locked pair is still retained. The demonstrated failure is the public-plan/readiness display: it can be stale until another event or reattachment. This can affect ordinary slow/fast presentation without a transport failure.

**Required correction:** retain a bounded authoritative public-state projection per Tick, or reconcile an authoritative snapshot when each Tick becomes visible with ordering that closes the snapshot/subscription race. Apply the right Tick and latest revision; fence by match/generation. Do not make peer progress wait for the other player's animation or add another human acknowledgment.

**Bounded acceptance:** one installed pair with a paused/slow view and a fast peer. Let the fast side edit and commit the next Tick first. When the slower view catches up, show the latest exact plan, intent and Ready without another remote edit or reload. One focused event-order regression is enough during assembly.

Source: [online.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/d113216c8473cf8fc1809e7720cd7a09ad76fa6b/src/hapa/presentation/online.js), lines 39–59; [app.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/d113216c8473cf8fc1809e7720cd7a09ad76fa6b/src/hapa/presentation/app.js), lines 679–699 and 765–773; [online-match.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/d113216c8473cf8fc1809e7720cd7a09ad76fa6b/src/hapa/network/online-match.js), lines 146–148 and 247–250. [View-state probe result](evidence/2026-11-26/review-17/view-state-probe.json).

### R17-05 — Give a disputed match a persistent state and a usable way out

The client records `status = 'disputed'` and the app shows a transient toast, but the common eligibility gate ignores that status. At an otherwise editable planning phase the probe records `edit=true` and `ready=true` even while the actual client says disputed. Existing busy/frozen conditions can disable those controls in other phases; this finding does not claim they remain enabled in every dispute.

The persistent phase text has no disputed branch. The runtime already exposes a durable `match.leave`, but the renderer never calls it. The lobby's Return to the table route is offered only for `active`, so a disputed match loses that route while its reservation can still prevent another online start. This is distinct from R16-04's interrupted setup: it concerns an established match.

**Required correction:** represent blocked/disputed/recovery state persistently, with the reason and appropriate action. Guard play mutations in both renderer eligibility and authority where needed, while preserving inspection and diagnostics. Keep a View/Return route for disputed or recoverable records. Expose explicit **Leave this match**, bound to the current match and distinct from concession or leaving the lobby. Use durable abandonment while preserving the unfinished/disputed record and identity; do not manufacture a loss.

A genuine authenticated-history conflict must not be erased by Retry. Transient write/restart faults should use reconciliation and an accurate recovery classification. Coordinate those states with R17-03 and R16-06 rather than turning all failures into a generic dispute.

**Bounded acceptance:** one controlled dispute during planning produces persistent status and disabled mutations. The player can inspect the record, explicitly leave, reopen and start another match with the same identity and preserved prior evidence. Share this witness with the decision/recovery journey.

Source: [online.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/d113216c8473cf8fc1809e7720cd7a09ad76fa6b/src/hapa/presentation/online.js), lines 55 and 136; [app.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/d113216c8473cf8fc1809e7720cd7a09ad76fa6b/src/hapa/presentation/app.js), lines 590–598, 702, 1837 and 1936–1950; [runtime.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/d113216c8473cf8fc1809e7720cd7a09ad76fa6b/src/hapa/network/runtime.js), lines 535–542 and 600. [Probe result](evidence/2026-11-26/review-17/view-state-probe.json).

### R17-06 — Retain lifecycle ownership of every completed authority

Completion clears the reservation, leaves the discovery topic and starts asynchronous result saving, but does not close the completed `OnlineMatch`. Opening another match overwrites `this.match` without closing or retaining lifecycle ownership of its predecessor. Runtime shutdown closes only the newest match.

The exact runtime lifecycle methods, exercised with counted fake authority handles, open/complete/save three matches. There are no close calls before shutdown; shutdown closes only match 3. The earlier authorities never receive a close call. The actual authority owns two Hypercores and a read loop that ends on closed/disputed, rather than completed, state.

This establishes missing teardown and a native-resource retention risk. The diagnostic allocates no native cores and does not claim measured memory or descriptor growth.

**Required correction:** keep ownership through terminal agreement and durable result finalization, then stop readers/replication, settle waiters and close native cores once. If another match starts while finalization is pending, retain a bounded finishing set and drain it during shutdown. A lightweight completed snapshot can support result inspection. Coordinate with R16-01/02: closing feeds before authenticated evidence is assembled would trade one failure for another. Preserve the stored journals.

**Bounded acceptance:** finish two successive installed matches and shut down. Verify that prior and current authorities are closed after their required finalization, shutdown drains remaining ownership, and both durable results remain readable. The source-method call trace is early attachment evidence; one native repeated-match witness covers the actual changed resource boundary.

Source: [runtime.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/d113216c8473cf8fc1809e7720cd7a09ad76fa6b/src/hapa/network/runtime.js), lines 409–455 and 617–624; [online-match.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/d113216c8473cf8fc1809e7720cd7a09ad76fa6b/src/hapa/network/online-match.js), lines 55–70, 86–98 and 368–375. [Probe result](evidence/2026-11-26/review-17/response-lifecycle-probe.json).

## Compatibility and archive treatment

The two rule/content corrections can change admission or outcomes for historical malformed payloads. Online compatibility already hashes the rule/content sources, and the public result verifier classifies an unsupported implementation separately. Preserve that honest boundary while coordinating the stronger proof/wire contract required by Assignment 17.

Local replay uses the recorded manifest/checkpoints with the installed resolver. Choose an explicit supported-version/legacy-replay policy or an honest unsupported result when older semantics are required. Preserve archived bytes and their evidence; a new verifier's inability to execute an old version must not silently rewrite the history or erase an existing counted record. New games should enforce the corrected resource invariant. A cosmetic change alone does not need a new gameplay profile.

Source: [compat.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/d113216c8473cf8fc1809e7720cd7a09ad76fa6b/src/hapa/network/compat.js), lines 27–47; [results.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/d113216c8473cf8fc1809e7720cd7a09ad76fa6b/src/hapa/network/results.js), line 71; [session.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/d113216c8473cf8fc1809e7720cd7a09ad76fa6b/src/hapa/rules/session.js), lines 89–103.

## How the implementation should fit together

| Connected group | Scope | Why this order |
| --- | --- | --- |
| Rules and admitted content | R17-01/02, with deliberate compatibility handling | Strong evidence must attest a valid game; accepted content must remain executable |
| Durable decisions and recoverable views | R16-04/05/06 plus R17-03/04/05 | Ready, responses, snapshots and recovery must describe one authority before visual choreography depends on them |
| Results, discovery and lifecycle | R16-01/02/03 plus R17-06 | Finish the exact record, keep finalization owned, retrieve it through the actual UI |
| Existing local experience and delivery | R16-07/08 and preserved parent inventory | Restore local music online, include notices, retain explicit remaining release and feature gates |
| Selected visual completion | VA-01–04, then the core feature brief | Fix the displayed moment before actor/spell/terrain motion; finish materials and player hierarchy as a coherent candidate |

Some work can proceed in parallel where its dependency is ready. These are implementation groups, not five mandatory separate publication or full-test cycles. Reuse the prior layout/music/rules evidence until a relevant source change invalidates it.

Two scope clarifications help the next agent avoid waste. First, the current desktop window has a 960-pixel minimum width: exercise the 700-pixel compact trial in the browser where supported, and test the installed app at its actual supported minimum. Second, the selected playable terrain witness is excavation/fill; raised fixture geometry does not establish a new player ability to raise terrain. Preserve the existing rules while improving its presentation.

The combined handoff explicitly selects the core visual work, so the agent should not stop after reliability fixes merely because the earlier feature brief called it a proposal. Conversely, optional minting flourishes, cinematic result replay, broad asset expansion and additional atmosphere remain optional. The completed coastal composition, likeness and board-first interaction remain the foundation.

## Qualification and stop

Use the smallest meaningful checks for changed contracts during assembly. The historical probes assert current failures; turn the relevant cases into positive regressions when fixing them. Their passing execution here is evidence of defects, not passing product qualification.

Fit the player path through entrance, online setup/recovery, exact Ready and response, differently paced views, match completion, reopened records, public profile retrieval and a subsequent match. Add the selected short visual witnesses and local content-import path. Run the required `npm run check` when the integrated candidate fits, then the changed browser/installed journeys. Native fault/recovery and resource behavior require native evidence; a stub-based probe does not close those gates.

Signing/notarization, a clean second Mac, different internet connections, operated directory/archive/relay services, approved engine distribution and Harbor/Avatar delivery remain the concrete external gates recorded in Assignment 17. The browser online adapter, direct Rematch, redacted diagnostics and remaining lifecycle/platform checks remain visible in the selected parent inventory. No external deployment, new running service or release acceptance is claimed by this review.

Publish one coherent implementation response covering R16, VA and R17 with exact source/build/artifact evidence and unresolved dependencies; append material progress to the existing Overwatch `hapa-versus` workflow. CJ accepts Done and visual quality. End the implementation continuation after that handoff, or after independent work is complete and a concrete external dependency remains. The [same-agent prompt](2026-11-26-three-pass-coding-handoff.md) gives the operational instructions.
