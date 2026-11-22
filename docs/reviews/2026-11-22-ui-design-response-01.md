# Implementation response — 2026-11-22

## Scope and source

- **CJ's requested goal and scope:**
  - Fetch the latest review safely, without disturbing local work.
  - Compare UX-01 through UX-14 with the current checkout and the governing documents.
  - Validate the Ready/response findings (UX-01, UX-02) and the height-aware selection finding (UX-03) first.
  - Establish expected behavior, then implement and verify the changed player journeys.
  - Preserve the remaining findings for later work.
- **Review addressed:** [22 November 2026 UI/design review](2026-11-22-ui-design-review.md).
- **Findings addressed:**
  - Implemented: 2026-11-22 / UX-01, UX-02 and UX-03.
  - Also fixed, because it blocked the keyboard path UX-03 needs: one keyboard blocker in 2026-11-22 / UX-14.
  - All findings are dispositioned below.
- **Branch and commits:**
  - Branch `main`.
  - Review baseline `af6977d`. The review notes arrived as `663e8f4`, which is documentation only.
  - Implementation commit `d61d56d`, "Keep a Ready plan frozen, resolve once, and pick by visible height".
  - This report and its evidence are in the commit that follows it.
- **Working tree at capture time:**
  - The **before** captures ran on `663e8f4`'s presentation code (the slice's presentation files temporarily stashed). The two new diagnostic fixtures and the journey script were already present.
  - The **after** captures ran on the presentation code committed as `d61d56d`.
  - Nothing else was uncommitted.
- **Engine:**
  - Submodule `vendor/lumina` is at `ba838cca09ba43afceda0452b63d28df4cbf7f72` (Hapa fork, branch `hapa`), unchanged.
  - No engine edits. The keyboard fix uses the engine's existing, documented `inputTarget` option.
- **Overwatch:** comments appended to `hapa-versus` HV-27, HV-33, HV-22, HV-38 and HV-44 through the board's append-only event log. No card was moved. The receipt is recorded in the commit message that adds this report.
- **Starting assumptions:**
  - Nothing newer than the review baseline touched these areas.
  - No other branches or local changes existed: the checkout was clean on `main` and fast-forwarded from `af6977d` to `663e8f4`.

## Outcome

### Ready freezes the plan (UX-01)

- After a player's first Ready, nothing can change that player's own orders:
  - the order × control is gone;
  - key-driven card tools are refused;
  - a hand card can no longer be lifted;
  - the inspector's Supply, facing and Retreat buttons are disabled.
- If the opponent then revises their plan, the player sees:
  - **"🔒 Your plan is frozen. Review B's changes (NEW / REMOVED)"**, with the opponent's added orders marked NEW and removed ones struck through;
  - a green **Acknowledge ▶** action with the subtitle "Updated plan from B · yours stays frozen".
- Before Ready, the button text now tells the player what pressing it does: "Freeze my plan (n orders)", or "Continue with existing orders" for an empty plan.

### One resolution per Tick (UX-02)

- Pressing Ready (button or Ctrl/⌘+Enter) during a response window no longer starts a second resolution.
- A single latch now guards resolution, and the same rule as the buttons gates the shortcut. Held-key repeats are ignored.

### Selection by visible height (UX-03)

- A click selects what the player can see, at the height it is drawn:
  - a flyer's body at +3;
  - a party on a hilltop;
  - a member in the open cutaway layer.
- A layer hidden by the layer filter never wins a click.
- Several parties stacked in one territory open a chooser that works with the keyboard. Each entry shows owner, party, band, standing (flying, roofed tunnel …) and state.
- Choosing a covered party opens its layer.
- These now sit at the selected party's height: selection brackets, destination fills, routes, the hover outline and camera focus.

### Keyboard blocker (part of UX-14)

- The Luminati engine's adventure key bindings had been calling `preventDefault` on Enter, Space and Tab for the whole window. That meant no HTML button in Versus could be activated or reached by keyboard.
- Versus now points the engine's game input at a detached target. Versus already reads its own keys, so nothing else changes.
- The Space pause shortcut no longer swallows a focused button.

### Status of this work

- **Implemented:** all of the above in `d61d56d`.
- **Verified:** in the stated cases below (scripted Chrome journeys, the in-app browser and `npm run check`).
- **Accepted by CJ:** not yet recorded.

## Finding disposition

| Dated finding ID | What current inspection established | Change or reason no change was needed | Evidence and verification limits | Follow-up |
| --- | --- | --- | --- | --- |
| 2026-11-22 / UX-01 | **Reproduced.** Hotseat run: after A's Ready and B's revision, A's frozen plan went r1 → r2 (deleted with ×) → r3 (a new Burn added). A's new Ready then acknowledged r3, so B's Ready went stale. | `app.js`: `_can()` is the one agreement reading. `_setPlan` and `_addCommand` refuse edits when the seat is frozen or busy. The × is shown only while editable. `card-drag.js` `canLift` uses the same rule. Ready records the acknowledged plans, and the panel marks NEW / REMOVED orders. | Journey `ux01`: before r1→r2→r3, after r1 held through the ×, keyboard and drag attempts. Captures below. Covered: hotseat, mouse plus keyboard plus drag. Not covered: a stale pair across the two-process peer path (unchanged code, covered by `protocol.test.js`). | The UI still keeps its own `rev`/`ready` objects rather than using `PhaseAgreement`; it now applies the same freeze rule. Unifying them is a later refactor. |
| 2026-11-22 / UX-02 | **Reproduced, with a worse consequence than the review inferred.** During B's response window (choice `C9.1`), Ctrl/⌘+Enter started a second `resolveTick` on the same state. The Tick advanced 9→10 and Tick 9 was recorded in the replay while the first resolution's response was still pending. That window was then answered during Tick 10, and the match reached Tick 11 with two `plans_locked` events and two replay entries. | `_tryResolve` has a `resolving` latch, cleared in `finally`. `_pressReady` refuses unless `_can().ready` (not busy, not already current). Key repeat is ignored. Response buttons still work. | Journey `ux02`: before = Tick 9→10 during the window, 2 locks, replay Ticks [9, 10], Tick 11 at end. After = Tick 9 held through 10 shortcut presses, then one Pass each resolves exactly once: 1 lock, replay [9], one `card_damage`, Tick 10. Human vs Bot spot-check in the app's browser: Ctrl+Enter twice gave one Tick. | — |
| 2026-11-22 / UX-03 | **Reproduced in part.** At home, rotated and tactical views the old picker usually found the intended party, because of its 1.6-member-width party fallback. It did fail in these cases: (a) with only band +3 shown, clicking where the hidden tunnel party lies selected B's tunnel party and switched the view to −2; (b) a click on R6C5's surface silently chose the flyer, with no chance to pick the covered tunnel party; (c) selection brackets were drawn at ground height (y = 0.05) for a flyer at +3 (members at y = 1.83) and a hill party (members at 0.93). | `board-view.js` `pick()` tests visible bodies by ray distance at their drawn height, honoring the layer filter and roofs. Otherwise it uses the surface under the pointer (hill tops, ground, or the cutaway floor) and its occupants in shown layers. Several candidates return `candidates[]`, which `app.js` shows as a chooser. `partyY`, `surfaceY` and `travelY` place overlays. `camera.focusOn` keeps height. A rules-level stacked fixture was added. | Journey `ux03`, ten cases with selected IDs, bands, layer, bracket y versus member y, and yaw/pitch/distance (table below). Not covered: hover and route visuals across a hill ramp were only inspected in code; the destination fill height was not checked on a hill by capture; the reviewer's "covered member" case was checked for parties, not Alt-click member selection. | A drag-to-Supply over a stacked territory with two own candidates is refused with an explanation rather than offering a chooser. |
| 2026-11-22 / UX-04 | Not reproduced in this slice. At layer −2 (`after-ux03-2c`) the tunnel occupants remain visible under the see-through board. The brown underlay is consistent with the decorative plane at y −1.6, but no scenery on/off comparison was run. | None. | Needs the same camera and layer with scenery on and off. | Next slice. |
| 2026-11-22 / UX-05 | Observed and unchanged: the opponent ribbon reads C1 g9 … C9 g1 for viewer A (visible in every capture). | None. | Screenshot observation only. | Next layout slice. |
| 2026-11-22 / UX-06 | Observed. At 1600×1000 the public-plans list gets 24–35 px of height while A's acknowledgment is stale, so the NEW marker needs scrolling. This slice replaces the pinned Ready button with a compact notice and acknowledge row only in that state, and scrolls the first change into view. Both Ready controls otherwise remain. | Partial mitigation only. | Measured `scrollHeight` 74 / `clientHeight` 35 in the app's browser. | One primary Ready control and a readable plan area are still UX-06 work. |
| 2026-11-22 / UX-07 | Not examined. | — | — | Later slice. |
| 2026-11-22 / UX-08 | Observed: hand ability titles truncate ("Wheel…", "Ember…") in the captures. | None. | Screenshot observation. | Later slice. |
| 2026-11-22 / UX-09 | Not examined. | — | — | Later slice. |
| 2026-11-22 / UX-10 | Not examined. | — | — | Later slice. |
| 2026-11-22 / UX-11 | Outside this slice. | — | — | Material pass after selection and cutaway are stable. |
| 2026-11-22 / UX-12 | Outside this slice. | — | — | — |
| 2026-11-22 / UX-13 | Touched only by the Ready wording ("Freeze my plan", "Continue with existing orders", "Acknowledge updated plan"). | Wording in `_readyLabel`. | Visible in the captures. | The rest of UX-13 remains. |
| 2026-11-22 / UX-14 | **New concrete defect found and fixed.** The engine's `Input` claimed Enter, Space and Tab on `window` (`vendor/lumina/src/engine/core/Input.js`, `_onKeyDown`), so focused HTML buttons could not be activated by keyboard and Tab did not move focus in headless Chrome. | `new Engine({ …, inputTarget: new EventTarget() })`. Versus never read `engine.input`. The Space pause skips a focused button. | Verified: Tab moves focus and Enter activates the candidate chooser (journey `ux03`, keyboard case). Not verified: full keyboard, large-text and reduced-motion journeys. The animations named in the review are unchanged. | Remaining UX-14 work. |

## Independent expectation and observed result

### Journey 1 — frozen plan and opponent revision (UX-01)

1. **Expected (Master Requirements v3 ch.16 "Ready names … the exact pair"; Design Companion, "Public planning Ready and response choices"):**
   - The first Ready freezes the player's own plan for the phase.
   - If the opponent publishes a new revision, the earlier acknowledgment becomes stale. The player must acknowledge the new pair while their own plan stays frozen.
   - Show "Your plan is frozen. Review the opponent's changes", highlight added and removed actions, and offer "Acknowledge updated plan".
   - No Unready control.
   - The Card section adds: "Supply still enters the agreed action sequence; a frozen plan stays frozen."
2. **Starting state:** `versus.html?autostart=1&a=human&b=human&seed=1`, base profile `hapa_open_10x9_v3_01`, Tick 1 Prologue, active C1/C9, viewer A.
3. **Actions:**
   1. A presses `1`, `B` (Burn A's C1 card) and clicks the big Ready.
   2. B presses `1`, `B` and clicks Ready; the view returns to A.
   3. A clicks the × on its order.
   4. A presses `9`, `B`.
   5. A drags its remaining hand card onto the Mana pool panel.
   6. A clicks Ready (Acknowledge).
4. **Observed after:**
   - A stays r1 with `[burn A.C1.T1.0]` through steps 3–5. No × is rendered, and the key and drag attempts are refused.
   - The big button reads "Acknowledge ▶ · Updated plan from B · yours stays frozen".
   - B's order carries a NEW tag.
   - Step 6 resolves Tick 1 and opens Tick 2.
5. **Comparison:** pass for this case. Before, the first divergence was at step 3 (A r1 → r2).

### Journey 2 — Ready shortcut during a response (UX-02)

1. **Expected (Master Requirements v3 `public_stack_v1`, "Choices pause game time"; Companion, "During agreement or a required choice, game time does not advance"):**
   - While a response window awaits a human choice, no Ready input starts another resolution.
   - Responding or passing resumes exactly one sequence.
2. **Starting state:**
   - `versus.html?autostart=1&fixture=response&a=human&b=human`, a new **labeled diagnostic fixture**: Tick 9, C1 active.
   - A's Castle sits at R4C1 with Ember Strike (C2) and a 2-Red card (C4); B's Swordsman is at R5C1.
   - B holds Blue Denial (C7) and a 2-Blue card (C6).
3. **Actions:**
   1. A presses `2`, `C`, clicks its Castle, then clicks B's Swordsman (Ember Strike planned, auto-burning the Red card).
   2. A clicks Ready, then B clicks Ready, and B's response window `C9.1` opens.
   3. With focus on the page, B presses Ctrl+Enter and ⌘+Enter five times each.
   4. B passes, then A passes.
4. **Observed after:**
   - Tick stays 9, phase `responding`, the pending choice stays `C9.1`, the replay stays empty, and the event count is unchanged through step 3.
   - Step 4 resolves once: one `plans_locked`, one `card_damage`, replay Ticks `[9]`, and the next Tick is 10.
5. **Comparison:** pass. Before, the first divergence was at step 3: a second `plans_locked`, the Tick went to 10 and the replay recorded Tick 9 while `C9.1` was still unanswered.

### Journey 3 — selection by visible height (UX-03)

1. **Expected (Companion, "Seeing a six-band volume"):**
   - When several objects lie under the cursor, show a candidate list with owner, name, territory, band and state.
   - Never silently choose; picking an obscured candidate opens its slice.
   - A hidden layer must not silently win.
   - Markers and routes sit on the meaningful surfaces.
   - Visually removed terrain remains solid for the rules: these queries are presentation-only.
2. **Starting state:** `versus.html?autostart=1&fixture=stacked&a=human&b=human`, a new **labeled diagnostic fixture**. Tick 5, C5 active.
   - In R6C5, A's flying Queen (+3) sits directly above B's roofed-tunnel Castle (−2).
   - A's Archer Castle stands on a raised hill at R5C3 (+2).
   - B's Knight stands on open ground at R6C3.
3. **Actions:** real mouse clicks at the projected body of a named member (feet + 0.45 world units) or at a territory's ground center. The camera views are home, rotated 90°, and tactical. The layers used are All, +3 only and −2 only. For the keyboard case, the chooser opens focused, then ArrowDown and Enter.
4. **Observed (before → after):**

| Case (camera yaw / pitch / distance) | Before: selected · bracket y | After: selected · bracket y (member y) |
| --- | --- | --- |
| Home 0° / 56° / 93 · flyer body | A.fly · 0.05 | A.fly · 1.85 (1.83) |
| Home · hilltop Archer | A.hill · 0.05 | A.hill · 0.95 (0.93) |
| Home · open-ground Knight | B.walk · 0.05 | B.walk · 0.05 (0.03) |
| Home · R6C5 ground surface | A.fly, silently | Chooser: "A's Queen at R6C5 · band +3 · flying · idle"; "B's Castle at R6C5 · band −2 · roofed tunnel · idle · under a roof" |
| Keyboard: ArrowDown, Enter in the chooser | n/a (no chooser) | B.tunnel, and the layer switches to −2 · −1.75 (−1.77) |
| Rotated 90° / 56° · flyer body | A.fly · 0.05 | A.fly · 1.85 |
| Rotated · hilltop Archer | A.hill · 0.05 | A.hill · 0.95 |
| Tactical 0° / 84° / 81 · flyer above tunnel | A.fly · 0.05 | A.fly · 1.85 |
| Layer +3 only · click over the hidden tunnel party | **B.tunnel (hidden layer won; view switched to −2)** | A.fly (the only occupant in the shown layer) |
| Layer −2 only · tunnel Pikeman | B.tunnel · 0.05 | B.tunnel · −1.75 (−1.77) |

5. **Comparison:** pass for these ten cases.

## Visual evidence

- **Browser / OS:** headless Chrome 157.0.8103.80 (puppeteer-core 25.12.0, ANGLE Metal) on macOS 26.2. Spot checks were made in the Claude desktop app's built-in browser pane.
- **Viewport:** 1600×1000 CSS px; DPR 1; browser zoom 100%; default text size.
- **Camera:** recorded per UX-03 case in the table above. UX-01/02 captures use the seat's home view (yaw 0°, pitch 56°, distance 93) and layer All.
- **Scenarios:** seed 1 base profile (UX-01); fixtures `response` (UX-02) and `stacked` (UX-03), both labeled **FIXTURE** in the match bar.
- **Card renditions:**
  - Local ignored `public/renditions/index.json`, SHA-256 prefix `5854de5785678063`; 12 faces present.
  - The cards in these scenes are mostly fixture or Wildcard instances without faces, so renditions do not affect these comparisons.
  - Image hashes were not recorded.
- **Captures:** JPEG (quality 78) converted from PNG. Full raw observations are in [before-report.json](evidence/2026-11-22/response-01/before-report.json) and [after-report.json](evidence/2026-11-22/response-01/after-report.json); some files they list were not kept, to save space.

**UX-01: A's view after B revised its plan.**

- Before:
  - [before-ux01-2-A-stale](evidence/2026-11-22/response-01/before-ux01-2-A-stale.jpg) shows a gold "Ready ▶ Resolve Tick 1", with the × still offered on A's order.
  - [before-ux01-3-A-after-attempts](evidence/2026-11-22/response-01/before-ux01-3-A-after-attempts.jpg) shows A's plan rewritten to r3.
- After:
  - [after-ux01-2-A-stale](evidence/2026-11-22/response-01/after-ux01-2-A-stale.jpg) shows the green "Acknowledge ▶", 🔒 plan heads, and the frozen notice with the acknowledge action.
  - [after-ux01-3-A-after-attempts](evidence/2026-11-22/response-01/after-ux01-3-A-after-attempts.jpg) shows the plan unchanged.

**UX-02: B's response window after ten shortcut presses.**

- Before: [before-ux02-2-after-shortcut](evidence/2026-11-22/response-01/before-ux02-2-after-shortcut.jpg) shows the match bar at Tick 10 with the response window still showing.
- After: [after-ux02-2-after-shortcut](evidence/2026-11-22/response-01/after-ux02-2-after-shortcut.jpg) shows Tick 9 and the window intact.

**UX-03: height-aware selection.**

- **Hill party:**
  - Before, [before-ux03-2-hill-click-home](evidence/2026-11-22/response-01/before-ux03-2-hill-click-home.jpg): brackets at the foot of the hill.
  - After, [after-ux03-2-hill-click-home](evidence/2026-11-22/response-01/after-ux03-2-hill-click-home.jpg): brackets on the hilltop.
- **Stacked territory:**
  - Before, [before-ux03-2b-stacked-candidates](evidence/2026-11-22/response-01/before-ux03-2b-stacked-candidates.jpg): the flyer was chosen silently.
  - After, [after-ux03-2b-stacked-candidates](evidence/2026-11-22/response-01/after-ux03-2b-stacked-candidates.jpg): the candidate chooser.
- **Covered candidate chosen by keyboard:** [after-ux03-2c-chose-tunnel](evidence/2026-11-22/response-01/after-ux03-2c-chose-tunnel.jpg) shows the −2 layer opened and B's tunnel Castle selected, with the inspector reading "▭ TUNNEL −2 · not exposed (roofed)".
- **Layer −2:**
  - Before: [before-ux03-5-layer-minus2](evidence/2026-11-22/response-01/before-ux03-5-layer-minus2.jpg).
  - After: [after-ux03-5-layer-minus2](evidence/2026-11-22/response-01/after-ux03-5-layer-minus2.jpg).

To reproduce:

```bash
npm run dev
PUPPETEER_CORE=/path/to/node_modules/puppeteer-core node tools/hapa/ui-journeys.mjs --out <dir> --label after
```

`puppeteer-core` is not a dependency of this repository. These captures used the copy installed in the local Luminati checkout.

## Verification record

| Command or manual check | Revision / environment | Actual result | What it establishes and what remains untested |
| --- | --- | --- | --- |
| `npm run check` | `d61d56d` working tree, Node 25.2.1 | Exit 0. 80/80 rules tests, including 2 new fixture tests. Bot-vs-bot smoke match, two-process peer match (`peersAgree: true`) and build all passed. | Rules, replay, peers and build are intact. It does not exercise the browser UI. |
| `node --test tests/hapa/ui-fixtures.test.js` | same | 2/2 pass | The response fixture opens B then A windows and resolves once; both new fixtures replay-verify. |
| `node tools/hapa/ui-journeys.mjs --label before` | `663e8f4` presentation plus the new fixtures, dev server 127.0.0.1:5199 | Exit 0; observations in `before-report.json` | Reproduces UX-01, UX-02 and UX-03 as described above. |
| `node tools/hapa/ui-journeys.mjs --label after` | `d61d56d` presentation | Exit 0; `after-report.json`; console errors: `favicon.ico` 404 (confirmed by curl) plus one unidentified 404 in the hotseat page, both present before and after | The three journeys pass as stated. Headless Chrome only, one viewport, default text size, motion not reduced. |
| Built-in browser pane: Human vs Bot, seed 1 | `d61d56d` | Burn by keys, Ctrl+Enter twice gave one "Resolving…", then Tick 2 | The ordinary single-human path still resolves once. |
| Built-in browser pane: stale acknowledgment layout | `d61d56d`, pane about 800×563 | NEW tag visible beside the acknowledge row; plans list scrollable | The change review is readable but cramped (UX-06). |
| Not run | — | — | Reduced-motion and enlarged-text variants; B-seat home view; a real (non-headless) Chrome window at CJ's size; screen-reader names for the chooser beyond the `aria-label` and visible text. |

## Decisions and next handoff

**Design choices made within the existing requirements:**

- **One agreement reading in the UI (`_can`):**
  - Every edit path and both Ready controls use it.
  - Changes are refused at the mutation boundary, so a missed affordance still cannot edit a frozen plan.
  - No Unready control was added.
- **Acknowledging records what was seen:** `ready[seat].seen` keeps the plans the player saw, so the panel can mark the opponent's later changes. It is presentation data, outside the rules state and fingerprints.
- **Candidate chooser triggers:** it appears only when several **parties** qualify. Bodies a player can see take precedence over the surface under them, and the surface fallback is limited to the clicked territory's body (1.6 member widths around the anchor).
- **Disabling the engine's game input:** Versus does not use Luminati's adventure input. The fix uses the engine's documented option; no engine edit was made.
- **Diagnostic fixtures:** `response` and `stacked` are labeled fixtures. `stacked` makes no claim that ordinary movement reaches a flyer directly above a tunnel party.

**Proposed requirement decision for CJ — concession while frozen:**

- Concession is currently a plan command, so after Ready the "Concede as A" menu action is now refused like any other edit.
- The Companion calls concession "a separate menu action with an explicit match-ending confirmation".
- Recommendation: make concession its own public record outside the plan, which is a protocol change. Until then, a frozen player can concede only on the next Tick.

**Findings remaining for later slices:**

- UX-04 to UX-13.
- The rest of UX-14.
- Unifying the UI's agreement state with `PhaseAgreement`.
- A chooser for drag-to-Supply over stacked own parties.

**What the reviewer should inspect next:**

- Branch `main`: commit `d61d56d` and the report commit after it.
- Evidence in `evidence/2026-11-22/response-01/`.
- The three journeys above in a visible Chrome window, including the stacked chooser and the frozen notice at CJ's usual window size.

**CJ acceptance:** not yet recorded.
