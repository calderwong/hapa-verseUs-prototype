# Implementation response 03 — 2026-11-22

## Scope and source

**CJ's request:** "keep going down the notes and requirements (and don't forget to also track with the Overwatch board)". This continues [response 01](2026-11-22-ui-design-response-01.md) and [response 02](2026-11-22-ui-design-response-02.md).

**Review addressed:** [22 November 2026 UI/design review](2026-11-22-ui-design-review.md).

**Findings addressed, by dated ID:**
- The rest of 2026-11-22 / UX-06 and UX-14.
- 2026-11-22 / UX-11 and UX-13.
- The verification part of UX-12.
- A UX-08 follow-up: a Mana overflow fixture.
- The requirements card HV-41 (rules and experiments panel), now verified in the browser.

**Code:**
- Branch `main`, starting from `a68cfd0` (response 02, pushed).
- Implementation commits, in order:

  | Commit | What it covers |
  | --- | --- |
  | `00089e5` | UX-13 |
  | `7ad548f` | UX-06 |
  | `fe27f66` | UX-14 |
  | `b680189` | UX-08 follow-up |
  | `b1a9062` | HV-41 journey |
  | `c9daf55` | UX-12 orbit journey |
  | `46e8249` | UX-11 |

- This report, the final suite report and the evidence are in the commit that follows.

**Working tree:**
- The UX-06 **before** captures ran on `00089e5`, before the layout change.
- The other findings in this round had no earlier implementation to capture, so their evidence is after-only and states that.
- No other uncommitted work.

**Engine:** `vendor/lumina` stays at `ba838cca09ba43afceda0452b63d28df4cbf7f72`, with no engine edits.

**Overwatch (`hapa-versus`):**
- **New cards**, created with the board's append-only `task_created` events so the review findings are tracked as tasks, not only as comments:

  | Card | Findings | Status |
  | --- | --- | --- |
  | HV-46 | UX-01 to UX-04 | Review |
  | HV-47 | UX-05, UX-07, UX-08, UX-09, UX-10 | Review |
  | HV-48 | UX-06 | Review |
  | HV-49 | UX-13 | Review |
  | HV-50 | UX-11 | Backlog (gated) |
  | HV-51 | UX-12 | Backlog (awaiting art decision) |

- **Moves:**
  - HV-44 (accessibility) went from Backlog through In progress to Review.
  - HV-41 kept its evidence comment, but the board's dependency gate refused moving it to Ready: it depends on HV-32, which still awaits CJ's acceptance. No readiness waiver was invented.
  - HV-50 stays in Backlog for the same reason (it depends on HV-46).
- Event IDs are in the report commit's message.

## Outcome

### UX-13: plain language

- **When nothing is selected**, an "at a glance" panel answers the review's questions in words:
  - what is active;
  - what you can do;
  - what pressing Ready will commit or acknowledge.
- **The party inspector** leads with identity and state ("Castle · yours", "waiting · faces North", "4 members · capacity 9 · Supply 0 → 2 planned"). Coordinates and record IDs are behind Details.
- **The formation grid** names roles ("Sword", "Pike", "Archer"…).
- **Plans read as actions** ("+2 Supply from 2♣ (C1) → Castle R1C1", "Move Castle R10C9 → R7C9").
- **The match bar** says "you".

### UX-06: narrow, short and enlarged-text layouts

- Below 1180 px wide (which includes 1600×1000 at 150% browser text), the roster becomes a drawer.
- The Mana pools (the Burn drop target) keep a 150 px column. They used to collapse to 18 px there.
- Short windows give the battlefield more height.

### UX-14: keyboard, color and motion

- **Keyboard-only main journey:** select a party, add Supply, choose a Move, press Ready.
  - Roster rows, formation slots and events are keyboard buttons.
  - Choosing a party moves focus to the inspector, and a re-render returns focus to the same control.
  - A "Move to…" list makes movement possible without a right-click.
- **Grayscale check:** a capture showed that response 02's quieter owner brackets lost the A/B cue without hue. Ownership now also differs by value and shape: A has a solid disc with a dark edge, B an open ring with a dark centre.

### UX-11: terrain materials and digging

- **Materials:**
  - Hills have turf caps and earth strata on their cut faces.
  - Open pits have strata walls and a floor.
  - A cutaway shows the shown band's floor as a ghosted, labeled grid.
- **Digging stages:**
  - Planned: a dashed "PLANNED DIG" cube.
  - Running, for multi-Tick work: an amber cube labeled with its completion Tick.
  - Completed: the void, as before.
- **New "Terrain work…" list:** the party inspector lists exactly the dig, fill and mine actions the rules allow. Until now the UI had no way to issue terrain work.

### UX-12: a party through a full orbit

- The shield stays on each Swordsman's left and the sword on the right through a full orbit; no swaps were found.
- Art direction of a real Hapa party is not done; it needs owner art and CJ's choice.

### UX-08 follow-up: Mana overflow

- Own tiles show at most three Mana chips, then "+n".
- Opponent tiles show at most two, then "+n".
- Every "+n" names the full breakdown in its title.

### HV-41: rules and experiments panel

- The panel works in the browser:
  - edit a field;
  - save a fingerprinted revision;
  - compare it with its base;
  - run a bot batch with replays verified.

### Status of this work

| Item | Status |
| --- | --- |
| All of the above | **Implemented** |
| The stated cases (scripted Chrome journeys, the in-app browser, `npm run check`) | **Verified** |
| CJ's acceptance | **Not recorded** |

## Finding disposition

### 2026-11-22 / UX-06

**What current inspection established:** **Reproduced.** Journey `ux06`, before (`00089e5`):
- At 1100×900, and at 1600×1000 with 150% text (a 1067×667 CSS viewport at DPR 1.5), `#resources` was 18 px wide and the roster was hidden with no way to reach it.
- At 1280×720 the battlefield was 696×360 px.

**Change:**
- At ≤1180 px wide (the CSS grid change):
  - a "☰ Parties" drawer, which closes on pick or Escape;
  - a 150 px Mana-pools column;
  - aligned ribbons;
  - a one-line match bar.
- At ≤760 px tall:
  - compact rows;
  - the opponent ribbon drops the ability and plan tags;
  - own tiles drop the art face and forecast, keeping the ability;
  - Ready shows its main label only.

**Evidence and limits:**
- After, all four sizes keep 9/9 visible tiles, a usable Mana pools panel (≥150 px), the plans and Ready.
- Battlefield size: 1280×720 went 696×360 → 704×426; 150% text went 743×307 → 755×373.
- The drawer opens, closes when you pick (selecting the party) and closes on Escape.
- Text size follows browser zoom; there is no in-app text-size setting.
- Not checked: below 1024 px wide, and OS-level font scaling separate from zoom.
- Own tiles are narrower in narrow layouts (57–60 px).

**Follow-up:** CJ's view on hiding the art face in short windows.

### 2026-11-22 / UX-11

**What current inspection established:** before this change:
- the terrain was schematic (flat-colored boxes, plain shafts);
- there was no visible planned or underway stage for digging;
- the UI had **no way** to issue terrain work at all — dig, fill and mine existed only in rules and tests.

**Change:** `terrain-view.js`:
- `strataTexture`, used for hill faces (turf cap) and shaft walls;
- pit floors;
- a cutaway floor grid with a label;
- `syncWork`, which draws the planned and running stages.

`app.js`:
- `_workList`: legal work only, filtered by `validatePlan`;
- plan wording for work.

A labeled `dig` fixture was added.

**Evidence and limits:** journey `ux11`.
- **Terrain fixture:** hill/pit capture; floor grid visible at layer −2.
- **Dig fixture:**
  - The legal options are Mine 3,10 · Dig 1,10 / 2,11 / 2,9 (all band −3) · Fill 2,10 (band −2).
  - Planning shows one marker.
  - Ready produces `work_started` and `terrain_changed` and clears the marker.
  - A replay test passes.
- **Limits:**
  - The fixture profile's work takes one Tick, so the amber "running" stage is code-path only. A multi-Tick profile would show it.
  - A newly dug roofed cube shows only as the surface's dashed tunnel outline, not as a drawn cavity.
  - Enhancement traces (source → surface) were not attempted.

**Follow-up:** HV-50 is gated on HV-46 being accepted.

### 2026-11-22 / UX-12

**What current inspection established:** verified the risk the review raised: gear sides under orbit.

**Change:** none needed for the gear. The `ux12` journey was added.

**Evidence and limits:**
- Corner fixture, A.mid Castle (three shield-bearing Swordsmen and a Priest), captured every 45°.
- Shield on the member's left and sword on its right wherever that axis faces the screen (0°, 45°, 180°, 225°, 315°).
- The other angles are edge-on and look correct by eye (captures at 0°, 90° and 180°).
- Not done: Hapa character art, distant representation, animation transitions beyond idle.

**Follow-up:** CJ decision — which Hapa character set to art-direct (owner art).

### 2026-11-22 / UX-13

**What current inspection established:** **Observed** (screenshot and source):
- raw IDs in plan entries (`Supply A.C1.T1.0 → …`);
- role abbreviations ("Sw", "Ar");
- coordinates leading the inspector;
- the quickstart still pointed at Ready "at the end of your hand" after response 02 moved it.

**Change:** `app.js`:
- `_nowPanel`;
- the party identity header plus Details;
- `ROLE_NAME`;
- `describeCmd` in words;
- territory and event panels in words, with the raw record behind Details;
- "you" on the crest;
- the quickstart corrected.

**Evidence and limits:**
- Checked in the in-app browser (Human vs Bot, seed 1):
  - "Tick 1 · you are A"…;
  - "Castle · yours · waiting · faces North · 4 members · capacity 9 · Supply 0 → 2 planned";
  - plan "+2 Supply from 2♣ (C1) → Castle R1C1";
  - grid "Pike, Castle, Mage, Priest".
- Not done:
  - a first-use drag invitation beyond the quickstart;
  - an explained replay of a resolved action;
  - observing a first-time player.

**Follow-up:** HV-45 (CJ's playtest) is the real test.

### 2026-11-22 / UX-14

**What current inspection established:**
- **Reproduced in part:** roster rows, formation slots and events were click-only `div`s, and moving needed a right-click.
- **New:** a grayscale capture exposed weak ownership cues after UX-10.

**Change:**
- A `kbd()` helper gives Enter/Space, `role` and an accessible name.
- Focus is preserved across `_renderAll`; a keyboard roster pick moves focus to the inspector.
- `_moveList`.
- Ownership bases differ by value and shape.

**Evidence and limits:** journey `ux14kb`, keyboard only:
1. Tab and Enter on "Your Castle at R1C1".
2. 7 Tabs to its "+2 C1" Supply button, Enter.
3. 8 Tabs to "Move to…" and R1C2, Enter.
4. Ctrl+Enter resolves Tick 1 with `supply_loaded` and `destination_set` for that Castle.

The grayscale contact capture (corner fixture) shows the disc/ring difference. Reduced motion and enlarged text are covered in responses 02 and 03 (`ux14rm`, `ux06`).

Not done:
- ability targeting by keyboard, which needs a member picker;
- a screen-reader pass.

**Follow-up:** the rest of HV-44 after CJ's review.

### 2026-11-22 / UX-08 (follow-up)

**What current inspection established:** response 02 could not exercise the overflow, because seed 1 mints only single-color cards.

**Change:** a labeled `cards` fixture with 0-, 1-, 3- and 5-color cards, plus a replay test.

**Evidence:** journey `ux08b`:
- own 5-color card: 3 chips + "+2";
- opponent 3- and 5-color cards: 2 chips + "+1" / "+3";
- each "+n" titled with the full breakdown;
- 0 Mana reads "no Mana".

**Follow-up:** none.

### HV-41 (requirements)

**What current inspection established:** the panel was built in `52a9ed8` but never checked in a browser.

**Change:** journey `hv41`.

**Evidence and limits:**
- 13 documented fields.
- Ranged base range 2 → 3 saved revision `hapa_open_10x9_v3_01~c9b20ec1` (sha256:17067b40…).
- The comparison listed exactly `combat.ranged.baseRange 2 3`.
- A bot batch (seeds 1–2, 60 Ticks) gave 2 unfinished runs, first contact at Tick 10, both replays verified.
- Limits:
  - the editor covers the 13 registered fields;
  - batches run on the page's main thread.

**Follow-up:** moving HV-41 is blocked by the board's dependency gate (HV-32 still awaits acceptance).

### Earlier findings

| Finding | Status |
| --- | --- |
| UX-01 to UX-05 | Responses 01 and 02 |
| UX-07 | Responses 01 and 02 |
| UX-09 | Responses 01 and 02 |
| UX-10 | Responses 01 and 02, plus this round's grayscale follow-up |

Response 01's journeys (`ux01`–`ux03`) still pass in the final suite.

## Independent expectation and observed result

### UX-06

1. **Expected (review UX-06; Companion layout text):**
   - "Collapse the roster into an accessible drawer before compressing the battlefield."
   - "Preserve access to all nine bank positions and the current decision."
   - "Keep resources and required response buttons reachable."
   - The Mana drop target must remain usable.
2. **Starting state:** Human vs Bot, seed 1, Tick 1.
3. **Actions:** load at each size, measure the panels, open the drawer, pick a party, open it again, press Escape.
4. **Observed:** the numbers above.
5. **Comparison:** pass at the four sizes tested.

### UX-14 keyboard

1. **Expected (review UX-14):** "Complete the main journey without dragging"; no focus trap; required actions reachable.
2. **Starting state:** the same as UX-06, at 1600×1000.
3. **Actions:** Tab and Enter only, plus Ctrl+Enter.
4. **Observed:** the sequence above. Focus never returned to the page top after an action.
5. **Comparison:** pass for select, Supply, Move and Ready. Ability targeting was not covered.

### UX-11 dig stages

1. **Expected (review UX-11):**
   - "For digging, show the proposed affected volume, work underway, and the completed void/support state as distinct stages."
   - Do not promise unapproved mechanics through art.
2. **Starting state:** the `dig` fixture, Tick 9, A's worker at band −3.
3. **Actions:** select the worker, open "Terrain work…", click Dig 1,10, then both Ready.
4. **Observed:** the planned marker appears, and the Tick resolves with the cube emptied. The underway stage is not reachable with one-Tick work.
5. **Comparison:** pass for planned and completed. Underway is untested in play.

### UX-13

1. **Expected (review UX-13):** a newcomer can answer what is active, what is selected, what they can do, and what Ready commits.
2. **Starting state:** seed 1.
3. **Actions:** read the panel with nothing selected, then with a Castle selected.
4. **Observed:** the words listed above.
5. **Comparison:** pass for the wording. Comprehension by a real first-time player is not observed.

## Visual evidence

**Setup:**
- Headless Chrome 157.0.8103.80 (puppeteer-core 25.12.0, ANGLE Metal), macOS 26.2.
- 1600×1000 at DPR 1 unless stated. The UX-06 sizes are listed above.
- Captures are clipped to the battlefield where noted.
- Card renditions: index SHA-256 prefix `5854de5785678063` (12 faces).
- [after-report.json](evidence/2026-11-22/response-03/after-report.json) is the **final full suite** at `46e8249`.
- [before-ux06-report.json](evidence/2026-11-22/response-03/before-ux06-report.json) holds the UX-06 before-run.

**UX-06**
- 150% text: [before](evidence/2026-11-22/response-03/before-ux06-1600x1000-at-150-text.jpg) (Mana pools collapsed, no roster) → [after](evidence/2026-11-22/response-03/after-ux06-1600x1000-at-150-text.jpg) → [the same with the drawer open](evidence/2026-11-22/response-03/after-ux06-1600x1000-at-150-text-drawer.jpg).
- 1280×720: [before](evidence/2026-11-22/response-03/before-ux06-1280x720.jpg) → [after](evidence/2026-11-22/response-03/after-ux06-1280x720.jpg).

**UX-14**
- [Planned by keyboard](evidence/2026-11-22/response-03/after-ux14-keyboard-planned.jpg).
- [Grayscale, A and B in contact](evidence/2026-11-22/response-03/after-ux14-grayscale-contact.jpg).
- [Selection still strongest, in color](evidence/2026-11-22/response-03/after-ux10-selected-castle-home.jpg).

**UX-11**
- [Hill and pit](evidence/2026-11-22/response-03/after-ux11-1-hill-pit.jpg).
- [Cutaway floor at −2](evidence/2026-11-22/response-03/after-ux11-2-cutaway-floor.jpg).
- [Planned dig](evidence/2026-11-22/response-03/after-ux11-3-planned-dig.jpg).
- [After the dig resolved](evidence/2026-11-22/response-03/after-ux11-4-dug.jpg).

**UX-12 orbit:** [0°](evidence/2026-11-22/response-03/after-ux12-orbit-0.jpg) · [90°](evidence/2026-11-22/response-03/after-ux12-orbit-90.jpg) · [180°](evidence/2026-11-22/response-03/after-ux12-orbit-180.jpg).

**UX-08:** [Mana overflow](evidence/2026-11-22/response-03/after-ux08-mana-overflow.jpg).

**HV-41:**
- [Fields](evidence/2026-11-22/response-03/after-hv41-1-fields.jpg).
- [Revision, compare and batch](evidence/2026-11-22/response-03/after-hv41-2-revision-compare-batch.jpg); the batch is below the fold, and its text results are in the report.

## Verification record

| Command or manual check | Revision / environment | Actual result | What it establishes and what remains untested |
| --- | --- | --- | --- |
| `npm run check` | `46e8249`, Node 25.2.1 | Exit 0. 82/82 rules tests, including 4 UI-fixture tests. Smoke match, two-process peers (agreed) and build passed. | Rules, fixtures, replays, peers and build. No browser coverage. |
| `node tools/hapa/ui-journeys.mjs` (all journeys) | `46e8249`, dev server 127.0.0.1:5199 | See "Final suite" below. | Regression across responses 01–03 in headless Chrome. |
| Built-in browser pane | `00089e5`–`46e8249` | UX-13 wording; dig-fixture work list (5 legal options); Ready state at narrow sizes. | Spot checks. |
| Not run | — | — | A real visible Chrome window at CJ's size; a screen reader; widths under 1024 px; a multi-Tick work profile; first-time players. |

### Final suite

Exit 0 at `46e8249` (report: `after-report.json`). Console errors in every journey were only `Failed to load resource: 404` messages, as in earlier runs (`favicon.ico` is confirmed missing; the rest were not individually traced).

| Journey | Result |
| --- | --- |
| ux01 (response 01) | A's revisions held at r1 through ×, keys and drag; × not offered; acknowledged and resolved |
| ux02 | One resolution: one `plans_locked`, replay Ticks [9], one `card_damage` |
| ux03 | The same ten selections as response 01 (flyer, hill, walker, stacked chooser of 3 entries, keyboard choice of the tunnel, …) |
| ux04 | 0 hidden points at −2 and −3, scenery on and off |
| ux06 | 9/9 tiles, a usable Mana pools panel (220 or 150 px) and Ready at all four sizes; the drawer closes on pick (selects A.mount.C1) |
| ux07 | All 4 board corners in view; share 0.61 (1600×1000), 0.59 (1280×720, up from 0.50 thanks to the compact rows), 0.67 (1100×900) |
| ux08 / ux08b | Inspector face labeled; overflow: own C5 3+2, opponent 2+1 and 2+3, C2 "no Mana" |
| ux09 | Effects: `planned` at the drop; none at rest; `supply` ×3 at resolution |
| ux10 | Selected Castle captured |
| ux11 | Floor grid visible; 5 legal work options; `work_started` and `terrain_changed` |
| ux12 | Shield left / sword right in every non-edge-on frame |
| ux14rm | Reduced motion: ring and token scale 1.000 throughout |
| ux14kb | Keyboard only: Supply, Move, Ready, then `supply_loaded` and `destination_set` |
| hv41 | Revision saved, diff `combat.ranged.baseRange 2 3`, batch replays all verified |

## Decisions and next handoff

**Design choices within the requirements:**
- **Text size follows browser zoom.** Below 1180 px wide, the layout switches to a drawer and a narrow Mana pools column.
- **The terrain work list offers only rules-legal actions**, through the same `validatePlan` the plan uses.
- **Response 02's UX-10 weight was walked back partway** after the grayscale check. The selection remains the strongest mark.

**Decisions for CJ:**
- **Which Hapa character set to art-direct for UX-12.**
- **The UX-07 framing trade.** This is from response 02.
- **The board's gate on HV-41 and HV-50.** They can move only after HV-32 and HV-46 are accepted, or with your readiness waiver.
- **Concession.** This is from response 01.

**Remaining:**
- UX-12 art direction.
- UX-11 enhancement traces, and drawn underground cavities.
- UX-13 first-use teaching and an explained replay.
- UX-14 ability targeting by keyboard, and a screen-reader pass.
- HV-45, CJ's playtest.

**What the reviewer should inspect next:**
- `main` from `00089e5` to `46e8249`, plus this report's commit.
- Evidence in `evidence/2026-11-22/response-03/`.

**CJ acceptance:** not yet recorded.
