# UI and design review 07 — Keep play moving

**23 November 2026 · CJ playtest plus source review.** The latest implementation has strengthened inspection, but the next priority is the ordinary play loop: reliable movement and recovery, one-press Ready, a useful bot opponent, immediate current-Tick Mana, and member facts read through symbols rather than paragraphs.

**Reviewed source:** `main` at [`4fd5eaf9c0f9750242d9d3d013ac36801d96a92f`](https://github.com/calderwong/hapa-verseUs-prototype/commit/4fd5eaf9c0f9750242d9d3d013ac36801d96a92f), including [response 07](2026-11-23-ui-design-response-07.md) and implementation `b3a44af90704bc0a0871cdecd56a9533e8894006`. Engine gitlink: `ba838cca09ba43afceda0452b63d28df4cbf7f72`, unchanged. Ninety-four local source/document files were checked against their Git blob hashes. Three CJ screenshots are identified in the [evidence record](evidence/2026-11-23/review-07/README.md); their running revision is not known.

This review used the pushed source, supplied screenshots, targeted actual-rules reproductions and an isolated layout-method probe. It did not launch CJ's local application or read unpublished Mac work/current Overwatch. Implementer results below are attributed separately. **CJ acceptance is not recorded.**

## 1. Preserve what response 07 improved

The source now separates friendly command selection from inspection, reads combat facts at the displayed event moment, keeps complete member-detail signatures, reserves space around several controls, unifies Home/Return behavior, anchors zoom at real height, and invalidates diorama content from real terrain changes. The shrine/material treatment and quieter close framing are useful progress toward an inhabited formation.

Response 07 reports **114/114** `npm run check` tests and **345/345** browser assertions at `b3a44af`. This review independently ran the **13 inspection/moment tests**, all passing. It did not rerun that complete build/peer/browser qualification. The new behavior should reuse these improvements, not replace them with a second stat model or a permanent inspector.

The screenshots still give too much space to procedural explanation: the Orders wall, repeated member headings, attack/defense clauses, collective facts, an inspection strip and a command strip. The close scene is now capable of carrying the information; its reading vocabulary needs to become compact.

## 2. Findings and selected direction

### R7-01 — The apparent half-speed diagonal is a collision, and recovery really is broken

**P1 · Exact ordinary-opening rules reproduction; not a live recording of CJ's session.**

Start the default match, pass through Tick 5, and in Tick 6 load the C6, C5 and C4 Cards into A's Queen at R1C6: **6 Supply**. Set destination **R4C9**. Every command validates. The Queen moves halfway toward R2C7 and stops at `(24,4)` member-width coordinates with **5.5 Supply**, matching the visible destination and balance in CJ's screenshot. Tick 7 makes no further progress or debit. The legal opening replay verifies.

The Queen's left Pikeman would overlap the right-rear Archer of the friendly Pawn at **R2C6**. The unrelated friendly body blocks its sweep. On a separate clear flat board, both a Queen and a Bishop move **one complete diagonal square in one Tick for one Supply**, reach the center and replay correctly. Diagonal speed/debit are not generally halved.

There is a genuine trap after the obstruction. At the next eligible C6 activation, Tick 13:

| Player's attempted recovery | Observed result |
| --- | --- |
| Return to starting R1C6 | Accepted, quoted 1.5 Supply, but routes toward the blocked R2C7 first and never moves |
| Move/merge into Pawn R2C6 | Accepted, quoted 1.5 Supply, but also routes toward R2C7 first and never moves |
| Finish at R2C7 | Rejected as “already there,” although the anchor is still halfway short |

`nearestNode()` says its exact ties choose lower coordinates but uses `Math.round`, choosing the forward node in this case. `routeOrigin()` marks recovery `back:true`, yet `setDestination()` prepends that unreachable node. `_fundedTargets()` additionally removes the current *region*, hiding the displaced party's return-to-center destination. Simply changing a rounding tie will not establish correct recovery in every direction; use the actual reachable traversal node/segment.

The view already adds a generic **BLOCKED** at the destination. It does not identify the blocking party/body, where contact occurs or how to recover. An unobstructed chess pattern and a funded route are being presented as too nearly the same thing.

**Required outcome:** retain body collision and exact Supply debit, expose the first known obstruction, and make backtracking to a reachable prior node a real quoted/selectable route. Follow that with ordinary legal travel or a compatible merge. Share the result across board, keyboard, bot and rules paths. Preserve active-column eligibility. Do not double speed, teleport, increase Supply or erase collision. Version changed replay-affecting traversal semantics where required.

Sources: [movement.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/4fd5eaf9c0f9750242d9d3d013ac36801d96a92f/src/hapa/rules/movement.js) (`nearestNode`, `routeOrigin`, `quoteRoute`, `setDestination`, `moveQuantum`); [app.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/4fd5eaf9c0f9750242d9d3d013ac36801d96a92f/src/hapa/presentation/app.js) (`_fundedTargets`, destination rendering); [movement reproduction](evidence/2026-11-23/review-07/movement-results.json). V3 Appendix A permits fractional movement and unrelated friendly obstruction; the repair must respect that distinction.

### R7-02 — Repeated Ready is the old contract; explicitly replace it

**P1 · Source and protocol reproduction; CJ selects a new default rule.**

The current app records both plan revisions when Ready is pressed. If the opponent then edits, it declares the first player's Ready stale, opens Orders, disables its Close control and asks for **Acknowledge updated plan**. `PhaseAgreement` independently requires both players to acknowledge the final pair. The browser and protocol tests assert this behavior. It is not an accidental extra dialog that can safely be removed only in CSS.

The protocol probe submits A plan r1, B plan r1, A Ready, B plan r2 and B Ready. Each player has pressed Ready once, but no lock occurs; A must Ready again. This is exactly the interaction CJ rejects.

**Replacement rule:** Ready freezes my own exact valid plan for this Tick. The opponent may finish their editable plan without revoking my commitment. Once both own plans are frozen, lock the final pair and resolve once. Keep genuine response decisions, validation, signatures, phase/state binding, replay and duplicate-input protection.

Addendum 03 explicitly supersedes the old v3/addendum 01 flow. New default matches need a declared, validated agreement policy shared by the app and peer path; archived policy remains identifiable. A possible new schema field is `planning.agreement: 'own_plan_ready_v1'`; this is a proposal, not an existing setting. Automatic transport receipts may bind the final pair under that contract without another human action. Update old tests for the new default, retaining legacy cases under their original policy.

**History:** the bottom ticker currently reads the last Tick/current playback prefix and keeps only the last 60 events. It is not the requested browsable ledger. Use existing `session.events` and replay records for optional Tick navigation and expandable outcomes, with current Orders distinct from completed history. No normal Ready, opponent edit or Tick completion forces this drawer open.

Sources: [app.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/4fd5eaf9c0f9750242d9d3d013ac36801d96a92f/src/hapa/presentation/app.js) (`_readyValid`, `_pressReady`, `_renderOrders`, event ticker); [agreement.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/4fd5eaf9c0f9750242d9d3d013ac36801d96a92f/src/hapa/protocol/agreement.js); [protocol tests](https://github.com/calderwong/hapa-verseUs-prototype/blob/4fd5eaf9c0f9750242d9d3d013ac36801d96a92f/tests/hapa/protocol.test.js); [flow reproduction](evidence/2026-11-23/review-07/flow-mana-results.json).

### R7-03 — Human/bot selection exists, but the test launch selects two humans

**P1 for the requested development workflow · Source and screenshot evidence.**

All three supplied URLs explicitly contain `a=human&b=human`. The current boot path, setup selectors and controller factory already support independent roles, default to A human/B bot and automatically watch two bots. The next agent should expose/save a dev preset and correct the launch workflow, not create a new bot subsystem.

Use `/versus.html?autostart=1&a=human&b=bot&seed=1` for CJ's ordinary test. Also support A bot/B human, both bots and explicit hotseat. Document valid URL overrides over saved preset over built-in default, and make effective settings discoverable. Existing URL values are forwarded with little validation; invalid roles or seeds must not produce uncontrolled seats.

Space currently pauses an existing playback, not the between-Tick scheduler. Both-bot dev runs need durable Pause/Step/Stop at stable Tick boundaries and cancellation on restart. Reuse the generation ownership already present. The heuristic's occupied-node filtering misses the sideways body collision above and its recovery inherits the origin defect; share the corrected clearance/recovery facts without turning this into a strategy project.

Sources: [versus.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/4fd5eaf9c0f9750242d9d3d013ac36801d96a92f/src/versus.js); `app.js::showSetup/startMatch/_newTick`; [heuristic-bot.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/4fd5eaf9c0f9750242d9d3d013ac36801d96a92f/src/hapa/controllers/heuristic-bot.js).

### R7-04 — Close inspection needs a visual grammar, including real icon interaction

**P1 for the selected experience · Visual judgment grounded in supplied captures and source.**

Replace the repeated word strings with consistent **role, health, attack channel, hits × power, range, shield/covered-face and condition symbols plus exact numbers**. Use one dictionary and the existing glossary. Words appear when the player hovers/focuses/taps the particular fact. A learned player reads the formation directly; a learner gets that fact's definition and current value.

Keep `2 × 1` separate from one hit of 2, front protection separate from all-face protection, and a member's contribution separate from applied party/line protection. The current source calls the channels Physical and Magic; an icon change does not rename the rules. Ownership, Mana alignment and damage channel retain separate visual meanings. Use silhouette and contrast as well as color, including Black/White alignment and grayscale readability.

The current labels are `aria-hidden` and pointer-transparent. Inserting icons alone will not create their requested tooltips. Give them a stable semantic hover/focus/touch path that preserves camera and board gestures. Keep the active member stable while the pointer moves from the body to an icon/definition. Do not open the entire member essay for each hovered stat.

Remove duplicate role/HP prose from the inspection strip when on-body facts are readable, while preserving member navigation, inspected-versus-commanded identity and Return/Close. When on-body details step back because of space or scaling, the same facts remain accessible through that strip. Preserve the displayed-moment read model and cache corrections from response 07.

Sources: `app.js::_memberText/_renderInspectBar`; [member-labels.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/4fd5eaf9c0f9750242d9d3d013ac36801d96a92f/src/hapa/presentation/member-labels.js); [glossary.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/4fd5eaf9c0f9750242d9d3d013ac36801d96a92f/src/hapa/presentation/glossary.js); icon contract in [addendum 03](../requirements/2026-11-23-human-feedback-addendum-03.md#6-members-symbols-and-exact-values-first).

### R7-05 — Mana already funds a same-Tick cast; the presentation says it arrives later

**P1 · Actual-rules reproduction and source-confirmed messaging.**

In the existing response fixture, projecting a burn yields **2 Red**, while the settled authoritative pool remains unchanged. Appending Ember Strike validates and spends those 2 Red. Resolution records the burn, payment and damage in **Tick 9**, and replay verifies. A separate burn-only case leaves 2 Red through resolved Tick 9 and expires it at the Tick 10 boundary. Removing its funding invalidates the cast; a duplicate burn is rejected. This does not support a claim that the rules wait until the next Tick to allow spending.

The UI nevertheless makes that interpretation natural: the main basin stays **Empty → plan**, the expanded table says **Now / After plan**, the Card floats as a planned offering, and drag/button text says Mana arrives **when the Tick resolves**. One tooltip even says it expires at that Tick's end without explaining the current planning spending opportunity.

**Required outcome:** a validated burn immediately reserves its Card, makes the exact net current-plan balance primary as **Available this Tick**, animates its real colored yield and enables a later same-Tick cast. Use the existing ordered projection. Queueing a cast immediately reserves its cost. Undo reverses draft credit and visibly invalidates dependent orders. Accepted execution reconciles once, response choices use actual resources, and ordinary leftovers expire before next-Tick spending. Update the stale messaging, glossary and C9 expectation.

Preserve zero-yield truth: opening Supply-2 Cards can contain **0 Mana**. Their rank must not become invented Mana. Do not implement authoritative resource mutation in the UI or count the preview again at resolution.

Sources: [match.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/4fd5eaf9c0f9750242d9d3d013ac36801d96a92f/src/hapa/rules/match.js) (`validatePlan`, `projectPlan`, `burnCard`, `resolveTick`); [economy.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/4fd5eaf9c0f9750242d9d3d013ac36801d96a92f/src/hapa/rules/economy.js); `app.js::_renderMana/_plannedPool`; [card-drag.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/4fd5eaf9c0f9750242d9d3d013ac36801d96a92f/src/hapa/presentation/card-drag.js); [firepit.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/4fd5eaf9c0f9750242d9d3d013ac36801d96a92f/src/hapa/presentation/firepit.js); [probe results](evidence/2026-11-23/review-07/flow-mana-results.json).

### R7-06 — Open drawers still conceal parts of inspection

**P1 within the icon/history pass · Visible in CJ's close capture; isolated source-method reproduction.**

The member explanation and inspection strip extend underneath the open Orders drawer. `_avoidRects()` reserves the command strip, inspection strip, camera, layers, pinned view and match bar, but omits Orders, navigator and decision drawers. Another inspection component already has a separate reservation callback that includes those drawers. CSS places drawers above member reading and the inspection strip.

The bounded probe executes the real method against synthetic rectangles and confirms the omission. It is not a fresh live rendering capture at the pinned revision.

**Required outcome:** one effective free-space contract for these existing surfaces. An explicitly opened history panel must reflow or compact secondary inspection rather than conceal it or be covered by it. Required controls stay reachable. Verify inspect → open history → rotate → close history → command original selection, preserving orders. Include this in the same layout pass; no new UI framework is needed.

Sources: `app.js::_avoidRects` and `InspectController` setup; [versus.css](https://github.com/calderwong/hapa-verseUs-prototype/blob/4fd5eaf9c0f9750242d9d3d013ac36801d96a92f/src/hapa/presentation/versus.css); [overlay probe](evidence/2026-11-23/review-07/overlay-results.json).

## 3. Workflow change: assemble this whole loop before final tightening

CJ's [Loose Screws protocol](../workflows/LOOSE_SCREWS.md) is now the default for large work in this repository. First establish the real connections required for this play loop; use focused checks for dependency readiness, real uncertainty and changed critical boundaries. Then fit the whole journey and tighten it as a system. Preserve mandatory final checks, useful prior evidence and honest remaining gaps.

Response 07 says `npm run check` ran after each slice. That report does not quantify waste, but it is not a cadence the next assignment should inherit automatically. A coherent implementation checkpoint need not trigger the full tests, peer match, build, browser matrix, new captures and another report before the next related change. Group final verification around the playable candidate; broaden only when a concrete risk requires it.

Keep one short current plan. Do not create a ticket, approval or report for each icon, function or screw. Update the existing task board at material integration/handoff boundaries. Do not re-read every historical review after compaction when a current checkpoint and targeted source suffice.

The previous first-build scenery frame drop, untouched art recipes and broad device gaps remain visible limitations. They do not justify displacing this round's requested gameplay work or opening an unlimited optimization loop. Changed icon/control paths still require accessible equivalents and the focused qualification in assignment 08.

## 4. Next delivery

Implement [assignment 08](2026-11-23-next-agent-assignment-08.md) under [addendum 03](../requirements/2026-11-23-human-feedback-addendum-03.md). Publish the next unused response, expected 08, and append evidence to the appropriate existing Overwatch cards. Keep prior dated evidence unchanged. Baseline probes here assert the diagnosed old behavior; a green baseline probe is not proof that the repair is complete.

No new blocking question is required. The useful next human review is the corrected playable loop: one side controlled by CJ, clear movement/recovery, one Ready, visibly usable Mana, and an icon-led close view with voluntary history.
