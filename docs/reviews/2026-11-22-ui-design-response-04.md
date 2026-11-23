# Implementation response 04 — 22 November 2026

**Readable opening and public planning, compact and by keyboard.** This answers [UI and design review 02](2026-11-22-ui-design-review-02.md) (R2-01 to R2-08) through [assignment 03](2026-11-22-next-agent-assignment-03.md). The assignment asks for "response 03". That filename was already used by the parallel response to review 01, written from the same `a68cfd0` baseline before review 02 arrived. This is therefore response **04**; it supersedes response 03 only where the two overlap.

## Scope and source

- **CJ's goal for this slice:**
  - Repair the playback height filter, the concession feedback and the out-of-date Ready instructions.
  - Make the opening and public-planning journey readable at compact sizes and usable entirely through labeled controls and the keyboard.
  - Add explicit regression checks.
  - Keep the fitted camera provisionally.
- **Review addressed:** [review 02](2026-11-22-ui-design-review-02.md), findings **R2-01 to R2-08**. R2-09, the terrain and party scene, is the next visual slice and is not part of this one.
- **Branch and commits:** `main`, on top of `00c0f2e`, which merged review 02 with response 03.
  - `d04cee1`: the playback height filter (R2-01).
  - `a7a7471`: truthful concession and current help text (R2-07, R2-06).
  - `f6e56ab`: planning and response space, and the keyboard opening (R2-02 to R2-06).
  - `8a2ed9f`: the regression assertions (R2-08).
  - This report and its evidence are committed separately.
- **Working tree at capture:** clean at `8a2ed9f` for every "after" run (`report.json` records `dirty: false`). The "before" runs served `00c0f2e` from a separate worktree.
- **Engine:** Lumina `ba838cca09ba43afceda0452b63d28df4cbf7f72`, unchanged. Nothing in `vendor/lumina` was edited.
- **Overwatch `hapa-versus`:**
  - **HV-52**, this slice, is in Review.
  - **HV-53** is the protocol follow-up for concession at any phase, in Backlog.
  - Evidence comments were added to HV-44, HV-46, HV-48, HV-49, HV-50 and HV-26.
  - Event receipts are listed at the end of this report.
- **Starting point:** response 03 had already added the roster drawer, the Mana column below 1180 px, the labeled Move list, the Supply loader and the party identity header. This slice builds on those rather than redoing them.

## Outcome

1. **Height filter during playback (R2-01).** A tunnel inspected at band −2 stays filtered while the Tick plays: surface and flying bodies no longer reappear. Members who died in earlier Ticks also stay hidden.
   - Playback now asks a pure module (`src/hapa/presentation/playback.js`) for each moment's position, alive state and band, and `BoardView.sync` alone decides visibility.
   - **Ramp check:** in the real app, a party walking down a ramp was drawn at ground height for the whole Tick before this fix (marker y 0.04 throughout). It now stays on the hill top (y 0.94) until the rules record `elevation_changed` at quantum 1000, then descends.
2. **Room to read and commit plans (R2-02).** The plans left the 150 px bottom row. The right column is now the current decision: the inspector above, the public plans below, with the single Ready or Acknowledge button pinned at their foot.
   - Orders wrap in full. Each has a named Remove, and the last removed order can be restored.
   - At 1280×720 the plans get 291 px (previously 128). At 1600×1000 they get 341 px (previously 150).
   - "Expand plans" gives the plans most of the column.
   - **Stale acknowledgment:** the opponent's plan comes first with every NEW and REMOVED order marked, your frozen plan folds away, and a banner says your orders stay frozen and that Acknowledge changes nothing of yours.
3. **Response windows (R2-02).** The panel shows:
   - the pending effect, with its text and target;
   - each eligible response with its exact cost, the Cards it would burn to pay, and whether the source Card is consumed;
   - what Pass does.

   Focus starts on the first choice. While building this I found that the automatic payment used to burn Cards in bank order, so B would have lost a Supply-6 Card that has no Blue before using the 2-Blue Card. It now burns only Cards that pay a missing color.
4. **Compact layout (R2-03).** The roster drawer now starts at 1440 px instead of 1180 px.
   - **Board width at 1280×720:** 946×424 instead of 702×424, 35% wider.
   - **Board width at 1600×1000:** 994×638 instead of 1014×638, because the right column is 20 px wider.
   - At every measured size from 1600×1000 down to 1100×900, plus 150% browser zoom, for both seats:
     - both Mana pools, a labeled Burn and all nine bank positions in each ribbon are on screen, with corresponding positions sharing a physical column within 2 px;
     - the roster column or drawer, the plans and Ready are on screen.
5. **Keyboard and no-drag opening (R2-04).** The opening was completed with the keyboard alone at 1280×720:
   1. Open the Parties drawer, which takes focus.
   2. Choose the C1 Castle; focus continues in the inspector.
   3. Load 2 Supply; focus moves to Move to….
   4. Choose "Move Castle R1C1 to R2C1: 1 step · 1 Supply · joins your Pawn"; focus lands on the new order.
   5. Remove it; focus lands on Restore. Restore it.
   6. Press Ready.
   7. After resolution, open the result "A loaded 2 Supply from A's 2♣ (C1) …" and then its Card.

   The result matches the rules: the party is at R2C1 with Supply 1 and nine members. Focus was visible (`:focus-visible`) at every step. Escape closes the drawer and menus and returns focus to where it came from.
6. **Card summaries (R2-05).** Every tile's accessible name carries the exact Supply, the exact Mana, the ability and any non-available state. A planned Card names its use in the tile and its label, for example "(planned: Burn planned)" or "Supply → Castle R1C1". Multi-color Cards keep the `+n` chip.
7. **Teaching and help (R2-06).**
   - Help points at Load Supply, Move to… and Burn, says Ready is in the Public plans panel, and qualifies Supply as available "while your plan is editable". The "at any time" wording is gone.
   - The summary's "You can" line names the labeled controls.
   - The party panel gives a different reason for each restriction: a frozen plan, an inactive column (with its next active Tick), an unmounted Pawn and missing Supply.
   - Result and event lines name Cards ("A's 2♣ (C1)") instead of record IDs.
8. **Concession (R2-07).**
   - "Concede as A…" opens an explicit confirmation, with focus on Cancel, that says what will happen.
   - Cancel and Escape change nothing.
   - Success is announced only after the order is accepted.
   - After Ready, in a response window or while resolving, the menu explains why concession is unavailable and never reopens the plan.
   - A confirmed concession ends the match when the Tick resolves (winner B, reason `A:conceded`).

   **Not done:** conceding at any phase, which needs protocol work (see Decisions).
9. **Regression checks (R2-08).** `tools/hapa/ui-regress.mjs` runs 282 assertions against independently stated expectations.
   - It fails on any mismatch, a missing control, or an error outside an explicit allow-list.
   - Each run goes to a new directory recording its provenance.
   - `--sabotage` shows the mechanism can fail.

**Status:** implemented and verified in the stated cases. **CJ acceptance: not yet recorded.**

## Finding disposition

| Dated finding ID | What current inspection established | Change | Evidence and limits | Follow-up |
| --- | --- | --- | --- | --- |
| 2026-11-22 / R2-01 | **Reproduced.** At baseline `00c0f2e`, C4 fails for −2 and +3: off-layer bodies are visible during playback. The ramp is drawn at the final band for the whole Tick (y 0.04 while on the hill top). | `d04cee1`: `playback.js` (snapshot, timeline, poseAt, bodyVisible); `BoardView.sync` reads the pose; trace frames carry band. | C4 passes at `8a2ed9f`: 42 playback samples per layer, each showing exactly the expected bodies. `tests/hapa/playback.test.js` covers −2, +3, All, earlier casualties, death timing and the ramp. Ramp capture: [before](evidence/2026-11-22/response-04/ramp/before-00c0f2e.json), [after](evidence/2026-11-22/response-04/ramp/after-8a2ed9f.json), [mid-descent image](evidence/2026-11-22/response-04/ramp/after-descent-mid.jpg). No casualty case was exercised in the browser, only in the unit test. | None. |
| 2026-11-22 / R2-02 | **Confirmed.** Plans had 128–150 px, and stale changes and response costs were hard to read. | `f6e56ab`: side column, plan dock, stale banner, Remove/Restore, Expand plans, response panel, payment that burns only useful Cards. | C1 (stale review: opponent first, NEW marked, own plan frozen, Acknowledge), C2 (response focus and a single resolution), C6 (plan height ≥ 110 px and Ready on screen at all sizes). Screen-reader reading order was not tested. | CJ: judge the dock against the full-height inspector at your window size. |
| 2026-11-22 / R2-03 | **Partly fixed already** by response 03 (Mana column and drawer below 1180 px); the baseline passes C6. | Drawer from 1440 px; the board takes the roster's width. | C6: 153 assertions over 8 sizes × 2 seats. 200% zoom (800×500 CSS px) was observed, not asserted: everything is reachable, but the board is 466×204 and tiles are 26 px wide and clip ([capture](evidence/2026-11-22/response-04/regress/after-8a2ed9f/c6-800x500-observe.jpg)). | 200% reflow needs its own layout (ribbons as scrolling lists); deferred. |
| 2026-11-22 / R2-04 | **Confirmed.** Baseline C5 fails: no named Supply or Move controls, no Restore, no focus hand-off. | `f6e56ab`: names, focus routing, drawer focus, result list, event→Card link. | C5: 31 assertions, keyboard only, every step `:focus-visible`. **Partial:** it starts from a blurred document, not a cold page load. There is still no keyboard-focused board with a compass cue, and the camera is keyboard-driven only through Q/E/Z/X/V/Home. Ability targeting by keyboard is untested. | Board focus and compass, and keyboard ability targeting, remain. |
| 2026-11-22 / R2-05 | **Confirmed** that labels lacked planned use and state. | Tile labels name exact Supply, Mana, ability, state and planned use; visible planned tag; Card link from events. | C8 (10 assertions on the `cards` fixture). **Not covered:** a long-title Card (no valid catalog Card has one; none was invented), bank replacement, and a reserved Card in the browser. | Add a valid long-title definition if CJ wants that case. |
| 2026-11-22 / R2-06 | **Confirmed:** the Supply text said "at any time", Move was taught as right-click, and the "Ready at end of hand" comment was stale. The quick-start's Ready line had already been fixed in response 02. | `a7a7471` (help), `f6e56ab` (party reasons, You can, event names). | Read in the browser; C5 uses the new names. No first-time-user test. | — |
| 2026-11-22 / R2-07 | **Confirmed:** an unconditional success toast and no confirmation. | `a7a7471`. | C7: 29 assertions covering editable, cancel, Escape, confirmed concession ending the match, after Ready, response window, and no false success. | **HV-53:** concession at any phase needs an accepted terminal record (see Decisions). |
| 2026-11-22 / R2-08 | **Confirmed:** the recorder never fails. | `8a2ed9f`: `ui-regress.mjs`. | After `8a2ed9f`: 282/282, exit 0. Sabotage: 23/25, exit 1, failing exactly the two planted expectations. Before `00c0f2e`: 222/256 (no 200% observation then). | — |
| 2026-11-22 / UX-10 (correction) | Review 02 notes that the response-02 "Castle" captures selected `A.mount.C3`, the opening **Bishop**. That is correct. | No code change. The earlier files are preserved unchanged. | See "Correction to response 02". | — |

## Independent expectation and observed result

1. **R2-01 playback filter.**
   - **Expected** (Design Companion, "Seeing a six-band volume"; review R2-01): with one band shown, only live members on that band are drawn, during and after playback. The ramp height follows the rules' `elevation_changed` timing.
   - **Start:** the `stacked` fixture, human against human, at −2, +3 and All. The ramp uses the `terrain` fixture against the bot, Ticks 7 and 8, with A.hill ordered to R4C3.
   - **Actions:** choose the layer on the rail, press Ready twice, and sample `sprite.visible` every 25 ms.
   - **Observed after the fix:** every sample equals the live set on that band computed from the fixture as built. The ramp marker stays at y 0.94 until 98% of playback, then descends to 0.04.
   - **Before the fix:** off-layer bodies were visible, and the ramp marker sat at 0.04 throughout.
   - **Result:** pass.
2. **Public plan revision (C1).**
   - **Expected** (Master Requirements v3 ch.16; Companion "Public planning Ready"): after Ready, A's plan and revision cannot change. B's revision makes A's acknowledgment stale, and A acknowledges the new pair without changing A's orders.
   - **Start:** seed 1, both seats human.
   - **Actions:** A loads C1 Supply through the labeled controls and presses Ready. B burns slot 1 and presses Ready. A tries to Burn slot 2.
   - **Observed:** A's plan and revision are unchanged, there are no Remove controls on it, B's order is marked NEW, the banner says "stay frozen", and the resolved Tick used exactly A's frozen plan.
   - **Result:** pass.
3. **Required response (C2).**
   - **Expected:** a single resolution however often Ready is pressed.
   - **Actions:** with the response window open, 12 × Ctrl+Enter, 3 clicks on Ready, then Pass for each seat.
   - **Observed:** 1 replay entry and 1 `plans_locked`. The final fingerprint and event count equal those of a run without the spam.
   - **Result:** pass.
4. **Keyboard opening (C5):** described in the Outcome. **Result:** pass for the stated route.
5. **Compact public information (C6):** see the Verification record. **Result:** pass at 8 sizes. 200% was observed, not asserted.
6. **Concession (C7).**
   - **Expected** (Master v3 "Terminal conditions"; Companion "Concession … explicit match-ending confirmation"): a confirmed concession ends the match as a concession, Cancel changes nothing, and refusals never claim success.
   - **Result:** pass for the cases listed. Conceding during a response or after Ready is unsupported and says so.

## Visual evidence

- **Browser and OS:** headless Chrome/157.0.8103.80 on Darwin 25.2.0 arm64. I also inspected the app visibly in the Claude desktop app's browser pane, a real Chromium pane separate from CJ's Chrome, at 1280×720: opening, stale review, response window and concession.
- **Viewports:** 1600×1000, 1441×900, 1440×900, 1280×720, 1181×900, 1180×900 and 1100×900, all at DPR 1. 150% zoom is emulated as 1067×667 at DPR 1.5, and 200% as 800×500 at DPR 2. The HUD uses px type, so it has no separate text-size setting: browser zoom is the text scale here.
- **Camera:** the fitted Home view. Layers are as stated per check.
- **Renditions:** no local Tarot renditions were present (`public/renditions` is empty), so all faces are procedural. This does not affect the comparison.
- **Before** (`00c0f2e`): [regress/before-00c0f2e](evidence/2026-11-22/response-04/regress/before-00c0f2e/) ([report.json](evidence/2026-11-22/response-04/regress/before-00c0f2e/report.json)). Its `dirty: true` comes from the baseline worktree's copied engine folder and linked packages; the served source is `00c0f2e`.
- **After** (`8a2ed9f`, clean): [regress/after-8a2ed9f](evidence/2026-11-22/response-04/regress/after-8a2ed9f/) ([report.json](evidence/2026-11-22/response-04/regress/after-8a2ed9f/report.json)).
  - 1280×720 opening with the plan dock: [before](evidence/2026-11-22/response-04/regress/before-00c0f2e/c6-1280x720.jpg) / [after](evidence/2026-11-22/response-04/regress/after-8a2ed9f/c6-1280x720.jpg).
  - Keyboard-planned orders: [after](evidence/2026-11-22/response-04/regress/after-8a2ed9f/c5-planned.jpg). Result and its Card: [after](evidence/2026-11-22/response-04/regress/after-8a2ed9f/c5-result-card.jpg).
  - Stale review: [before](evidence/2026-11-22/response-04/regress/before-00c0f2e/c1-stale-review.jpg) / [after](evidence/2026-11-22/response-04/regress/after-8a2ed9f/c1-stale-review.jpg).
  - Concession confirmation: [after](evidence/2026-11-22/response-04/regress/after-8a2ed9f/c7-confirm.jpg). Menu during a response: [after](evidence/2026-11-22/response-04/regress/after-8a2ed9f/c7-response-menu.jpg).
  - 150% zoom: [before](evidence/2026-11-22/response-04/regress/before-00c0f2e/c6-1067x667.jpg) / [after](evidence/2026-11-22/response-04/regress/after-8a2ed9f/c6-1067x667.jpg). 200% (observed): [after](evidence/2026-11-22/response-04/regress/after-8a2ed9f/c6-800x500-observe.jpg).
- **Sabotage run:** [regress/sabotage-8a2ed9f](evidence/2026-11-22/response-04/regress/sabotage-8a2ed9f/report.json).

All images are live application captures, converted to JPEG (quality 78).

## Verification record

| Command or manual check | Revision / environment | Actual result | What it establishes and what remains untested |
| --- | --- | --- | --- |
| `npm run check` | `8a2ed9f` and each intermediate commit (`npm test` and `vite build` on the staged tree) | exit 0; **86/86** tests (82 + 4 playback); smoke, peers and build pass | Rules and replay unchanged; the new pose module is tested headless. |
| `node tools/hapa/ui-regress.mjs` | `8a2ed9f`, clean, dev server 127.0.0.1:5199 | **282/282**, exit 0; only allowed error: `/favicon.ico` 404 | C1–C8 as described. One run per configuration; no repeat runs for flakiness. |
| `… --sabotage --only c1,c3` | `8a2ed9f` | **23/25**, exit 1; fails exactly "A revision unchanged" (expected 2, actual 1) and "layer −2 … selects" (expected A.fly, actual B.tunnel) | The assertions can fail. |
| `… --base :5198 --source-dir <baseline worktree>` | `00c0f2e` | **222/256**, exit 1: C1 ×4, C2 ×1, C4 ×2, C5 ×12, C7 ×14 (missing controls), C8 ×1; C3 and C6 pass | Before evidence for the same expectations. |
| Ramp capture (`evidence/…/ramp/ramp-capture.mjs`) | `00c0f2e` and `8a2ed9f` | before: y 0.04 for the whole Tick; after: 0.94 until q≈980, then 0.04 at q 1000 | The drawn height follows the authoritative event, for one descent. No ascent was captured. |
| `tools/hapa/ui-journeys.mjs` (ux01, ux02, ux09, ux14kb, ux08b, ux11) | working tree before the docs commit | all six completed; plans and events as in response 03 | The earlier recorder still runs against the new layout and names. |
| Visible inspection in the browser pane | 1280×720 | opening, stale review, response window and concession menu looked as described; one "null" text node and the wasteful auto-burn were found and fixed before commit | Not CJ's browser, window size or display scaling. |

**Untested:**
- a screen reader;
- Windows narrower than 1100 px other than the 200% observation;
- ability targeting by keyboard;
- a keyboard-focused board;
- reduced motion and muted sound with this layout, since the earlier checks at `46e8249` predate it;
- real first-time players.

## Correction to response 02

[Response 02](2026-11-22-ui-design-response-02.md) captioned its UX-10 captures ("after-ux10-selected-castle…") as the selected Castle. The journey actually selected `A.mount.C3`, which at the opening is A's **Bishop**, not a Castle. The captures still show the intended contrast between selection and ownership, but they do not verify Castle identity. The published files and captions are left unchanged; this note is the correction. The new regression checks name the selected record ID in each assertion rather than relying on a filename.

## Decisions and next handoff

- **Design choices within the requirements:**
  - The plans moved into the decision column rather than growing the bottom row, so the board keeps its height.
  - The drawer breakpoint moved to 1440 px; the board takes the freed width. The fitted camera and its 24° lens are unchanged, as the assignment asked.
  - Focus follows each decision (Supply → Move to… → the new order → Ready) instead of returning to the top.
- **Concession at any phase (HV-53, a protocol proposal, not implemented).** Master Requirements v3 already says concession ends the match. What's missing is a way to accept one after Ready or during a response. The proposal:
  - a signed terminal record outside the plan, `concede {seat, tick, phaseSeq}`, accepted at any point;
  - ordering: it takes effect at the next deterministic boundary (the current choice point, or the end of the current event batch); a pending response stack is cancelled without resolving; it is idempotent per seat;
  - both peers record it, and replay applies it at the same sequence number;
  - a lost connection remains a different, interrupted record.

  No product decision is needed from CJ to start this; it is bounded protocol work for its own card.
- **For CJ to judge:**
  - the dock against the full-height inspector at your actual window and display scaling;
  - whether the 20 px narrower board at 1600×1000 is acceptable.
- **Later slices:**
  - 200% zoom reflow;
  - a keyboard-focused board with a compass cue, and keyboard ability targeting;
  - a screen-reader pass;
  - **next visual slice (R2-09):** one finished terrain and party scene (cards HV-50 and HV-51).
- **What to inspect:** `main` at the docs commit after `8a2ed9f`.
  - Open `http://127.0.0.1:5199/versus.html?autostart=1&a=human&b=human&seed=1` at 1280×720 and play the opening by keyboard.
  - Then `…&fixture=response` to see the response window.
  - Run `node tools/hapa/ui-regress.mjs` with `PUPPETEER_CORE` set.
- **CJ acceptance:** **not yet recorded.**

## Overwatch receipts

Recorded on board `hapa-versus` (append-only):

| Card | Event | ID |
| --- | --- | --- |
| HV-52 | created; moved ready → in_progress | `evt_1795408799901_150e6a64`, `evt_1795408799909_c58134de`, `evt_1795408799925_ceeb5df1` |
| HV-52 | evidence comment; moved to **review** | `evt_1795408799931_2a6fbfed`, `evt_1795408799937_bd15eae8` |
| HV-53 | created (backlog): concession at any phase | `evt_1795408799943_34ac5aa4` |
| HV-46 | R2-01 and UX-01–03 re-verification | `evt_1795408799948_c6ac8439` |
| HV-44 | keyboard evidence and limits | `evt_1795408799953_bed94ed6` |
| HV-48 | layout measurements | `evt_1795408799958_14f5e21a` |
| HV-49 | teaching and help | `evt_1795408799964_97be480b` |
| HV-50 | R2-09 named as the next visual slice | `evt_1795408799969_04fee27c` |
| HV-26 | response published; UX-10 correction | `evt_1795408799975_e3aca3b7` |

Board state after these events: HV-52 in Review, HV-53 in Backlog, and no rejected events. Cards go to Done only on CJ's acceptance.
