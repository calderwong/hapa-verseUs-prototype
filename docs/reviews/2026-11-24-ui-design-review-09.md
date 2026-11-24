# Review 09 — Repair pass complete; play the connected game

**24 November 2026. All six findings from Review 08 are corrected in the reviewed scope. Assignment 10 is technically complete, and the candidate is ready for CJ's connected playtest.** No new blocking defect was found in this pass. One small History wording issue is recorded below for a later coherent UI batch. It does not justify keeping the completed repair assignment running.

This is an implementation-review conclusion, not CJ's acceptance to Done, a full MVP-completeness audit, or proof that every gameplay combination works. The next useful evidence is how the game reads and feels during human play.

## 1. Exact baseline and authority

| Item | Reviewed identity |
| --- | --- |
| Repository | `calderwong/hapa-verseUs-prototype`, `main` |
| Pushed source and documents | `2d8a5ff2a1c5686101b3dc3c2c8e0cee33c6df4f` |
| Latest implementation commit | `44bf90b706a4e55dd740fd3276f077aac3ea5aa1` |
| Implementation interval | `4657188` through `44bf90b`, after Review 08 publication `b7ef249` |
| New-match default | `hapa_open_10x9_v3_07`, revision 1; rules `hapa-versus-rules/0.7.0` |
| Engine gitlink | `ba838cca09ba43afceda0452b63d28df4cbf7f72`, unchanged |
| Response reviewed | [Implementation response 10](2026-11-24-ui-design-response-10.md) |
| Current gameplay direction | [Human-feedback addendum 04](../requirements/2026-11-23-human-feedback-addendum-04.md), with compatible requirements from addendum 03 and earlier |
| Next step | [Playtest guide 01](2026-11-24-playtest-guide-01.md) |

This review follows [AGENTS.md](../../AGENTS.md) and [Loose Screws](../workflows/LOOSE_SCREWS.md). It examines the changed implementation and the six prior findings, reuses relevant evidence, and adds a short live connected journey. It does not restart every historical review. The publication contains documentation and review evidence only; no game implementation or engine changes.

**Start a new v3_07 match when evaluating these repairs.** Earlier profiles preserve their recorded movement and absorption semantics so archived matches are not silently reinterpreted. In particular, a v3_06 match does not receive the new absorption allocator merely because the code was updated.

The exact launch configuration is:

<http://127.0.0.1:5199/versus.html?autostart=1&a=human&b=bot&seed=1&profile=hapa_open_10x9_v3_07>

## 2. What is now corrected

The finding IDs link this review to [Review 08](2026-11-23-ui-design-review-08.md). Each description below stands on its own.

| Prior issue | Result and reason for closure | Evidence level |
| --- | --- | --- |
| **R8-01 — Picking up successive Pawns could lose a member's formation reference; refilling a party after casualties could fail despite available capacity.** | The v3_07 allocator computes the complete assignment before transfer, counts living occupancy, and reserves each chosen slot. Eligibility and execution use the same allocation. Successive partial pickups now account for all five living members exactly once; five survivors plus four recruits produce nine consistent members and retire the absorbed Pawn. A Pawn that will not fit is rejected as an endpoint and blocks continued line travel before co-location. | Independent headless rules/replay tests; source inspection; a separate live ordinary Castle/Pawn pickup. |
| **R8-02 — The bot still rejected some legal Knight routes through friendly intermediate territories.** | The obsolete intermediate-friendly filter is confined to older body-sweep profiles. Current Knights use shared clearance while illegal final destinations remain excluded. The previously blocked fixture now receives a valid funded route. This repairs eligibility; it does not claim stronger strategic play. | Independent rules/controller regression and source inspection. |
| **R8-03 — Copying a match link could omit its effective default profile and reopen different rules because of a saved development preset.** | Both setup and match-menu links carry the effective profile. The exact current menu expression produces a v3_07 / A human / B bot / seed 1 link that overrides a conflicting saved v3_02 preset. A deliberately bare URL still follows saved preferences. | Independent actual-source launch probe and presentation test; live menu showed the profile-bearing link. |
| **R8-04 — A member hidden by terrain could have unusable fallback icon definitions, and an open explanation could become stale.** | Definitions are rebuilt from every inspected member's current facts before on-body visibility filtering. A hidden member's tooltip works from the outset, updates when its Health changes, and closes when its fact disappears. Pointer departure restores a keyboard-focused symbol's definition. | Independent presentation test and five method-level checks; inspected the agent's final roofed-formation screenshot and submitted browser record. |
| **R8-05 — The peer loop could read Ready before an already queued revised opponent plan, rejecting an otherwise valid one-Ready commitment.** | The current agreement path consumes the opponent's plan revisions and Ready in inbox order until the pair locks. The edited plan resolves once, with one own Ready and one agreed receipt. Duplicate handling, own-plan freeze and match/phase/prior-state binding still hold in the focused checks. | Independent execution of the exact Peer methods with a preverified in-process inbox. This is not a live transport edit test. |
| **R8-06 — Arrival feedback could hide behind a Mana counter, and the navigator could disagree with the basin about available Mana.** | The bounded, pointer-transparent toast renders above world counters and below drawers. The navigator and basin use the same available-pool selector. The submitted positive-Burn still shows 2 Red available this Tick in the navigator, matching the basin. | Source inspection and three verified submitted screenshots across R8-04/R8-06. The positive Burn was not repeated in the reviewer's live opening. |

Relevant source anchors: [movement allocation and travel](../../src/hapa/rules/movement.js), [bot route selection](../../src/hapa/controllers/heuristic-bot.js), [profile definitions](../../fixtures/hapa/profiles.js), [launch configuration](../../src/hapa/presentation/dev-preset.js), [member definitions](../../src/hapa/presentation/member-labels.js), [presentation integration](../../src/hapa/presentation/app.js), [toast styling](../../src/hapa/presentation/versus.css), and [peer phase consumption](../../src/hapa/protocol/peer.js). The evidence manifest pins the actual blobs used for this review.

## 3. What the reviewer actually played

A separate temporary local match used A human, B bot, seed 1 and the explicit v3_07 URL. Existing user game tabs were left alone. The menu exposed the expected profile and launch link; it did not expose a source commit, so the live observation is kept separate from the exact pushed-source verification.

The connected sequence was:

1. At Tick 1, select A's Castle at R1C1, which has four members and no Supply.
2. Load the C1 **2 of Wands** as 2 Supply. Choose R3C1, whose quoted route costs 2 Supply over 2 Ticks and picks up the Pawn at R2C1 on the way.
3. Press **Ready once**. The game resolves and returns to Tick 2 planning without a second acknowledgment screen.
4. The Castle is at R2C1 with **1 Supply**. Close inspection visibly shows a **nine-member party** and the continuing R3C1 destination.
5. Return to the board and press Ready once for Tick 2, without issuing a replacement route. The existing route continues while C1 is inactive for new orders.
6. At Tick 3, the Castle is at **R3C1 with 0 Supply**. History is opened deliberately to read the previous Tick; it is not a progression gate.

That sequence connects funding, destination choice, commitment, Pawn absorption, inspection, continuation and arrival. It supports the playtest recommendation more directly than another isolated assertion about each control. The original Queen diagonal regression was checked separately in the headless tests: its first Tick reaches the next territory center, absorbs the Pawn with all nine members accounted for, and retains the expected Supply.

The full live observation and its metadata limitations are in [the evidence record](evidence/2026-11-24/review-09/live-observations.md). No fresh reviewer screenshot is included in this publication; the retained image evidence is explicitly identified as the coding agent's captures.

## 4. Design assessment

**Keep the current interaction direction.** Overview chess markers, a compact command surface, close inspection with member symbols, definitions on demand, and voluntary History now form a coherent progression from commanding to learning. The latest changes remove contradictions within that progression without bringing back the permanent details dashboard.

Two distinctions matter for the next playtest:

- **Inspecting and commanding serve different intentions.** The live Castle sequence let the reviewer inspect the expanded party, return, and continue its existing route. The human question now is whether this transition feels obvious and whether the player can read the unit composition quickly. More permanent panels are not needed to answer that question.
- **Available Mana must feel usable in the current Tick.** While a plan is editable, the interface shows the projected resources after planned actions. The committed state can remain unchanged until resolution while a Burn already funds a later action in that same plan. Matching the basin and navigator removes one contradiction; the remaining human test is whether the Burn-to-spend sequence communicates this timing clearly.

The repair pass does not establish that the entire aesthetic, onboarding, combat readability or MVP feature set is complete. It does establish enough consistency to gather useful human feedback from a connected game. The next design batch should respond to what CJ actually struggles to perceive, predict or do during that session.

The disclosed Knight behavior of ending a Tick within a friendly-held intermediate territory remains unchanged under addendum 04. This review does not turn that disclosure into a new blocking rule change. Likewise, the toast briefly covering part of a counter while its short message is visible is an acceptable prototype tradeoff in the supplied capture, not grounds for another layout project.

## 5. One new, nonblocking observation to retain

### R9-01 — History counts Supply-loading actions but labels the count like a Supply quantity

**Priority: P3. Deferred to a later coherent UI/ledger batch.** This is a wording issue, not a resource calculation defect or a reason to keep Assignment 10 open.

**Context and reproduction:** In the live match, Tick 2 History summarized the results as **“Tick 2: 1 arrived · 2 Supply loaded.”** Its detailed entries showed B loading 2 Supply from one Card and another 2 Supply from a second Card. There were **two loading actions totaling four Supply**. A reader can reasonably interpret the summary as saying only two Supply were added.

**Source:** The summary in `src/hapa/presentation/app.js`, line 2055 at the reviewed commit, inserts `count('supply_loaded')` before the words `Supply loaded`. It counts events. The detailed entries preserve the actual amounts. This expression predates response 10; it is newly noticed in this review, not a new regression introduced by the repair.

**Recommended adjustment when the ledger is next touched:** label the existing count **“2 Supply loads”**, or deliberately calculate and label the resource total, such as **“4 Supply loaded.”** Keep event counts and resource quantities distinguishable. No resource rules or confirmation behavior need to change.

**Adequate eventual check:** the same two loads of 2 Supply should produce an unambiguous summary that agrees with the detail. A focused formatting check and reading that ledger state are enough for this change; this wording alone does not call for another movement suite or browser matrix.

## 6. Verification and practical limits

| Evidence | What was established | What is not claimed |
| --- | --- | --- |
| Exact source snapshot | 116 source/document blobs verified against the reviewed Git tree; three submitted image blobs verified separately. | Not a fresh semantic audit of every file in the repository. |
| Independent movement tests | `absorption.test.js` and `center-travel.test.js`: **14 passed**, zero failed/skipped. Includes allocation failures, capacity agreement, the original diagonal, bot traversal, selected Knight behavior and legacy dispatch. | Not every historical replay or every combat arrangement. |
| Independent presentation tests | `presentation-contracts.test.js`: **2 passed**. An additional method probe passed all five hidden-member/focus scenarios. | Not a touch-device or full browser interaction test. |
| Independent flow probe | Exact launch expression, five peer sequences, and agreement freeze/duplicate guards passed. | No Hypercore socket, signature-verification, reconnect or live two-human edit journey in this probe. |
| Independent live opening | Castle funding → one Ready → nine-member absorption → inspection/return → one Ready → arrival and optional History. | Running commit and dirty state were not exposed. No full match, live positive-Mana cast or device matrix. |
| Agent's submitted qualification, reviewed and reused | Response 10 reports `npm run check` at `44bf90b`: 140/140 tests plus bot smoke, two-process peer match and build. Browser run at `7919bd8`: 451/453; the two caught issues were fixed, then affected checks at `44bf90b` passed 70/70. | The reviewer did not rerun that full qualification. The 70/70 is a focused rerun, not a new 453-assertion run. Transport smoke uses one plan per Tick. |

See [evidence and reproduction instructions](evidence/2026-11-24/review-09/README.md). No broad rerun was triggered merely by this documentation publication. Current Overwatch state and unpushed local changes were not read; no task-board mutation or CJ acceptance is claimed.

## 7. Next handoff and stopping point

Use [Playtest guide 01](2026-11-24-playtest-guide-01.md) for one short A-human/B-bot session. Focus on movement intent, immediate Mana confidence, and learning a member icon without losing command context. These are observations to guide the next meaningful batch, not an exhaustive matrix to run until everything looks polished.

**Assignment 10 has reached its technical handoff. Do not automatically create Assignment 11 to repair R9-01 alone, repeat unchanged qualification, or drain unrelated board work.** If the local agent is needed now, its bounded task is to reconcile the local candidate, provide the exact play link and a short status handoff, and stop that work item. The playtest guide contains a copyable prompt.

CJ's feedback determines whether the next batch addresses an observed obstacle or advances the next agreed gameplay milestone. CJ still accepts work to Done through the established Overwatch workflow.
