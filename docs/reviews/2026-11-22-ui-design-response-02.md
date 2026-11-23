# Implementation response 02 — 2026-11-22

## Scope and source

- **CJ's requested goal and scope:** "keep working down the notes", continuing after [response 01](2026-11-22-ui-design-response-01.md), which closed UX-01 to UX-03.
- **Review addressed:** [22 November 2026 UI/design review](2026-11-22-ui-design-review.md).
- **Findings addressed:**
  - 2026-11-22 / UX-04, UX-05, UX-07, UX-08, UX-09 and UX-10.
  - Part of UX-06: one Ready and the ribbon layout.
  - Part of UX-14: keyboard-focusable cards and reduced motion on the board.
  - UX-11, UX-12 and UX-13 remain, together with the rest of UX-06 and UX-14.
- **Branch and starting point:** `main`, starting at `7ea3f0d` (response 01, already pushed to GitHub).
- **Implementation commits, in order:**

  | Commit | Finding | Change |
  | --- | --- | --- |
  | `8569829` | UX-04 | Decorative ground kept out of the excavation volume |
  | `2c238a0` | UX-05, UX-06 (part) | Aligned card ribbons; one Ready |
  | `a531b25` | UX-09, UX-07 | Planned vs. resolved Supply; fitted home view |
  | `0cb4efb` | UX-08 | One Card anatomy |
  | `d3a4a63` | UX-10 | Quiet ownership, strongest selection, larger crests |
  | `d770856` | UX-09 | Planned links cleared at playback; `ux09` journey |
  | `05de8fa` | UX-14 (part) | Reduced motion on the board |

  This report and its evidence are in the commit that follows.
- **Working tree:**
  - Each **before** capture ran on the code just before that finding's change, restored temporarily with `git stash` or `git checkout <commit> -- src/hapa/presentation` and then restored.
  - The **before** baselines are:
    - UX-04: `7ea3f0d`;
    - UX-07 and UX-09: `2c238a0`;
    - UX-10: `0cb4efb`.
  - Every **after** capture ran on `d770856` or later; the final suite ran at `d770856`.
  - No other uncommitted work.
- **Commit ID note:** `2c238a0` is the UX-05 commit after a message-only amend. Its earlier ID `50620f3`, used for the UX-07 and UX-09 before-captures, has an identical tree (`git diff 50620f3 2c238a0` is empty).
- **Engine:** `vendor/lumina` stays at `ba838cca09ba43afceda0452b63d28df4cbf7f72`. No engine edits.
- **Overwatch:** comments appended to `hapa-versus` HV-25, HV-26, HV-27, HV-28, HV-38 and HV-44. No cards moved. The receipt is in the commit that adds this report.

## Outcome

### UX-04: underground layers are visible

- An open cutaway now shows the underground occupants instead of the decorative dirt path.
- The meadow and path used to run underneath the whole board, above the floors of bands −2 and −3. They now form a frame around the plinth.

### UX-05: ribbons line up by column

- The two card ribbons line up by physical column for both seats.
- Each tile names:
  - your home column, plus the global column when it differs (`C1 · g9` for B);
  - for the opponent, the global column and their home alias (`g9 · A C9`).
- Hovering or focusing a tile lights its column on the board and brackets its world bank slot.
- Number keys still pick your fixed home slots.

### UX-06 (part): one Ready

- There is one Ready action, at the foot of the plan panel.
- Both ribbons span the battlefield's width, so their nine columns share x-positions.

### UX-09: planning is quiet, resolution celebrates

- Planning a Supply is quiet and reversible:
  - a dashed mint ring that settles;
  - "+2 planned";
  - a soft sound;
  - a dashed link from the card's bank slot to the recipient formation;
  - the card's tile says "Supply → Castle R1C1".
- The brass burst, sparks and coin are kept for the resolved event, which reads "+2 landed · Supply 2".

### UX-07: fitted home view

- The home and tactical views fit the playable board plus a one-member-width allowance to the actual viewport.
- They refit on resize while still at home.
- A longer lens (24°) eases perspective crowding.

### UX-08: one Card anatomy

- Ribbon tiles use the same order as the dragged and world-bank card:
  - identity (rank and suit);
  - a bounded Tarot face at full strength, or a deliberate suit fallback;
  - Supply and Mana;
  - the ability on its own band, wrapping to two lines instead of an ellipsis.
- The opponent's compact tiles now name the ability.
- Mana overflow shows an explicit "+n", so an overflow never reads as zero.
- The inspector opens with the same card face.

### UX-10: ownership quiet, selection strongest

- Ownership brackets are quieter but keep their shapes: single brackets for A, double for B.
- The selection is the strongest mark.
- Mount crests are larger.

### UX-14 (part): keyboard and reduced motion

- Hand tiles are keyboard-focusable buttons with full accessible names.
- With reduced motion set, the board's drop-target pulse and Supply-token pop stand still.

### Status of this work

- **Implemented:** all of the above.
- **Verified:** in the stated cases (scripted Chrome journeys, the in-app browser and `npm run check`).
- **Accepted by CJ:** not yet recorded.

## Finding disposition

| Dated finding ID | What current inspection established | Change or reason no change was needed | Evidence and verification limits | Follow-up |
| --- | --- | --- | --- | --- |
| 2026-11-22 / UX-04 | **Reproduced.** Stacked fixture with the cutaway at −2 and −3, camera focused on the occupant. Ray tests from the camera to points on each member (feet + 0.1, 0.45 and 0.8 world units) found 2 of 6 points hidden behind scenery at −2 and 9 of 9 at −3. With scenery off: 0 hidden. | `scenery.js`: the meadow and path are now frames (four strips with continuous tiling) around the plinth's footprint. The stacked fixture gains B's deep gallery party at −3 (R7C7). | Journey `ux04`. After: 0/6 and 0/9 hidden, scenery on or off; the state fingerprint is unchanged by toggling. Home view inspected for seams in the app's browser: none seen. | UX-11 can give the volume real strata and floors; there is still empty slate under the field. |
| 2026-11-22 / UX-05 | **Reproduced** at the response-01 baseline. For viewer A the opponent ribbon read C1 g9 … C9 g1, so global 9 sat above own C1. See `response-01/before-ux01-2-A-stale.jpg`. | `app.js` `_renderHand`: both ribbons follow `viewSeat`'s home columns. New labels, `aria-label`s and keyboard focus. `board-view.js` `tether()`. CSS grid: the opponent ribbon spans the battlefield column. | Measured in the app's browser at 1600×1000: the nine tile-center deltas between ribbons are 0 px for viewer A and viewer B. Mapping verified for both viewers (A: `g1 · B C9` above `C1`; B: `g9 · A C9` above `C1 · g9`). Tether verified by hover; programmatic focus did not fire while the browser pane was unfocused, but Tab focus is wired the same way. | — |
| 2026-11-22 / UX-06 | **Part done.** Two Ready controls existed, and the own ribbon shared its width with the big button. | One Ready (`.ready-big`) at the foot of the plan panel, where the Companion places the agreement action; the pinned duplicate was removed. Equal ribbon widths (above). | Captures in `response-02/`. Not done: a roster drawer at narrow widths, a text-size/reflow policy, and checks at enlarged text. The plan list is still small at 1600×1000. | The rest of UX-06. |
| 2026-11-22 / UX-07 | **Reproduced in part.** The home view used a fixed distance (`size × 1.55`) and a 7% near-edge bias regardless of aspect. At 1600×1000 it showed all four board corners, but the C1–C9 labels at the near edge were cut off, and the far row was crowded (near-row territory 83 px wide, far-row 60 px, ratio 0.73). | `camera.js` `fit()`: binary-search the distance so the subject (playable board plus one member width) fits inside margins, then slide the focus to balance top and bottom margins. Refit on resize while at home or tactical; any pan, orbit, zoom, tilt or focus leaves home; 45° turns from home refit. FOV 32° → 24°. Subject defined in `board-view.js`. | Journey `ux07`, both seats, 1600×1000 / 1280×720 / 1100×900 windows. 1600×1000: corners 4/4 both before and after; board share 0.69 → 0.61; near/far 83.2/60.4 → 76.9/61.1 (ratio 0.73 → 0.79). 1280×720: share 0.57 → 0.50. 1100×900: 0.76 → 0.68. **Trade-off:** the board is ~11% smaller in exchange for labels in frame, gentler perspective and correct fitting at any aspect. A first attempt that also framed the world banks halved the board (share 0.33), so I rejected it. | CJ's judgment on the trade-off. The world banks stay outside the default frame; the hand ribbons show the same cards. |
| 2026-11-22 / UX-08 | **Reproduced.** Hand art was a full-tile background at 22% behind text; ability names ellipsized ("Wheel Forma…"); the opponent tile omitted the ability; the inspector showed text plus a small art credit, not the card face. | `app.js`: tile anatomy with `.thead`, a `_faceBand()` (bounded art or suit fallback), resources with `_manaCompact()` (max 3 own / 2 opponent chips plus "+n"), and a two-line `.abil` band. The inspector leads with `drawCardCanvas` (the same face as drag and world bank), and keeps the Tarot face credit separate from the ability definition and creator. | Journey `ux08` at Tick 9, seed 1: 2 Tarot faces and 7 fallbacks in the hand; the opponent's ability labels are present; the inspector face is labeled "2 of Wands: Supply 2, no Mana, ability Wheel Formation". **Not exercised:** the "+n" overflow, because seed 1 mints only single- or no-Mana cards. Rendition index SHA-256 prefix `5854de5785678063` (12 faces), unchanged. | Add a fixture with a multi-color card to show the overflow. |
| 2026-11-22 / UX-09 | **Reproduced.** A drop at planning fired the same brass `supply` burst, sparks and coin as the resolved event (effect list `["supply"]` at the drop). | `fx.js` `planned()`: a dashed ring with "+n planned". `card-drag.js` plays it with a soft blip instead of the coin, and burns also use the quiet sound. `board-view.js` `syncPlanLinks()` draws a dashed link from the bank slot to the formation, cleared at playback. `app.js` `_plannedUse()` names the reserved use on the tile, and the resolved label reads "+n landed · Supply total". | Journey `ux09`, a real pointer drag. Before: `["supply"]` at the drop. After: `["planned"]` at the drop, 3 plan links at rest (A's and the bot's), 0 links and `["supply" ×3]` at resolution (A's plus the bot's two). Close-camera captures for drop, rest and landing. Reduced-motion variant: `planned()` holds still (code path), not captured. | — |
| 2026-11-22 / UX-10 | **Reproduced.** Persistent owner brackets were drawn at 0.85–0.95 opacity, close to the selection outline's weight. | `board-view.js`: owner brackets at ~40% weight with the same single/double shapes. Selection: ivory brackets over a slate keyline plus a soft footprint (draw order fixed after the first attempt rendered the ivory under its keyline). Crests 0.38 → 0.46 member widths. | Journey `ux10`: a selected Castle among its neighbours, home and rotated 90°, before and after. Not checked: a reduced-color view and the B seat's view. | — |
| 2026-11-22 / UX-11 | Not started. | — | — | The terrain material pass (strata, cut edges, floors under the cutaway). |
| 2026-11-22 / UX-12 | Not started. | — | — | One art-directed party through a full camera orbit. |
| 2026-11-22 / UX-13 | **Touched only:** tile labels and the reserved-use wording ("Supply → Castle R1C1", "pays Ember Strike"). | — | — | Plain-language inspector header, roles with names, first-use teaching, plan-diff wording. |
| 2026-11-22 / UX-14 | **Part done.** Response 01 fixed the engine's key capture. Here, hand tiles get `tabindex`, `role=button`, full `aria-label`s, and Enter/Space to select. `BoardView.update` honors `prefers-reduced-motion` for the drop-ring pulse and the token pop, as the review named. | `app.js`, `board-view.js`. | Journey `ux14rm` (headless Chrome with emulated preference): drop-ring scale 1.000 throughout and token scale 1.000 under `reduce`; 1.023–1.05 and up to 1.34 without. Not done: a keyboard-only full journey, enlarged text, color-reduced views, sound-free equivalents. | The rest of UX-14. |

## Independent expectation and observed result

### UX-04 — scenery and the excavation volume

1. **Expected (Companion, "Seeing a six-band volume"):**
   - "A selected band cuts away obstructing terrain."
   - Decorative elements are never targets and must not obscure meaning.
   - Turning scenery or cutaway on or off changes no rules state.
2. **Starting state:** fixture `stacked`, Tick 5. B's tunnel party is at −2 (R6C5) and B's deep party at −3 (R7C7).
3. **Actions:**
   1. Set layer −2, then −3.
   2. Focus the camera on the occupant at its band height.
   3. Cast rays from the camera to three points on each member.
   4. Repeat with `scenery.group.visible = false`.
4. **Observed:**
   - Before: 2/6 and 9/9 points hidden behind scenery.
   - After: 0/6 and 0/9.
   - The fingerprint is unchanged in every case.
5. **Comparison:** pass.

### UX-05 — physical-column order

1. **Expected (Companion, "Stable ownership beneath a freely rotating camera"):**
   - Your ribbon is in fixed home order.
   - "The opponent ribbon uses those same physical columns so corresponding resources can be compared vertically."
   - Each tile identifies owner and global column, with an alias when needed.
   - Number keys select your fixed positions.
2. **Starting state:** Human vs Human, seed 1, Tick 1.
3. **Actions:** read both ribbons' labels and tile centers as viewer A, press Ready, read them again as viewer B, then hover a tile.
4. **Observed:**
   - Labels as listed above; the column deltas are 0 px for all nine.
   - Hovering showed the tether band at the hovered tile's column.
5. **Comparison:** pass.

### UX-09 — planned vs. resolved

1. **Expected:**
   - The Companion: "Plan actions display a separate projected result … the actual allowance does not change before execution."
   - The review: a restrained cue while planning, the stronger effect only when the event resolves.
2. **Starting state:** Human vs Bot, seed 1, Tick 1. The camera is focused on A's C1 Castle.
3. **Actions:** drag A's C1 card from the ribbon onto the Castle, wait, then press Ctrl+Enter.
4. **Observed:**
   - The planned cue appears and the Castle's Supply stays 0 during planning.
   - The landing effect plays once Supply becomes 2.
   - The link disappears at playback.
5. **Comparison:** pass.

### UX-07 — framing

1. **Expected (review):**
   - Fit the playable territory plus a deliberate allowance to the actual viewport.
   - Compare against the near-edge bias.
   - Keep home dependable for both seats.
2. **Starting state:** seed 1, at each window size and seat.
3. **Actions:** press Home.
4. **Observed:** the measured table in the disposition row above.
5. **Comparison:** pass for fitting and both seats. The board-size trade-off is a judgment call, so it's listed under decisions for CJ.

### UX-08, UX-10 and UX-14 (part)

These are recorded in the disposition table with their journeys.

## Visual evidence

- **Browser / OS:** headless Chrome 157.0.8103.80 (puppeteer-core 25.12.0, ANGLE Metal), macOS 26.2. Spot checks in the Claude desktop app's built-in browser pane.
- **Viewport:**
  - 1600×1000 CSS px, DPR 1, browser zoom 100%, default text size.
  - UX-07 also ran at 1280×720 and 1100×900.
  - Captures are clipped to the battlefield where noted.
- **Camera:** recorded in `after-report.json` for `ux07`. UX-04 and UX-09 focus the camera on the subject; UX-10 focuses the selected party. All are home yaw unless the capture is the rotated one.
- **Card renditions:** local ignored `public/renditions/index.json`, SHA-256 prefix `5854de5785678063`, 12 faces. Image hashes were not recorded.
- **Reports:**
  - [after-report.json](evidence/2026-11-22/response-02/after-report.json) holds the full final suite (ux01, ux02, ux03, ux04, ux07, ux08, ux09, ux10) at `d770856`.
  - [before-ux09-report.json](evidence/2026-11-22/response-02/before-ux09-report.json) holds the last before-run.
  - The other before numbers are quoted in this report from runs at the baselines named above. The script overwrites its report per label, so a single before-file does not hold all runs.

**UX-04 — layer −3, scenery on.**

- Before: [before-ux04-band-3-scenery-on](evidence/2026-11-22/response-02/before-ux04-band-3-scenery-on.jpg) shows dirt covering the gallery.
- With scenery off: [before-ux04-band-3-scenery-off](evidence/2026-11-22/response-02/before-ux04-band-3-scenery-off.jpg) shows the occupants.
- After: [after-ux04-band-3-scenery-on](evidence/2026-11-22/response-02/after-ux04-band-3-scenery-on.jpg) shows the occupants and selection visible.

**UX-07 — home view.**

- 1600×1000: [before](evidence/2026-11-22/response-02/before-ux07-home-A-1600x1000.jpg) → [after](evidence/2026-11-22/response-02/after-ux07-home-A-1600x1000.jpg). The after capture also shows the aligned ribbons (UX-05) and the single Ready (UX-06).
- 1280×720: [before](evidence/2026-11-22/response-02/before-ux07-home-A-1280x720.jpg) → [after](evidence/2026-11-22/response-02/after-ux07-home-A-1280x720.jpg).

**UX-08 — anatomy:** [after-ux08-hand-and-inspector](evidence/2026-11-22/response-02/after-ux08-hand-and-inspector.jpg) shows the ribbons with faces and fallbacks, the opponent abilities, and the inspector face. The response-01 captures show the earlier tiles.

**UX-09 — the same drop, before and after.**

| Moment | Before | After |
| --- | --- | --- |
| At the drop | [before-ux09-1-drop](evidence/2026-11-22/response-02/before-ux09-1-drop.jpg): brass "+2 Supply" burst | [after-ux09-1-drop](evidence/2026-11-22/response-02/after-ux09-1-drop.jpg): dashed mint "+2 planned" ring and link |
| At rest, planning | [before-ux09-2-planned](evidence/2026-11-22/response-02/before-ux09-2-planned.jpg) | [after-ux09-2-planned](evidence/2026-11-22/response-02/after-ux09-2-planned.jpg) |
| Resolution | [before-ux09-3-landing](evidence/2026-11-22/response-02/before-ux09-3-landing.jpg) | [after-ux09-3-landing](evidence/2026-11-22/response-02/after-ux09-3-landing.jpg): the brass landing, link gone |

**UX-10 — selected Castle.**

- Home: [before](evidence/2026-11-22/response-02/before-ux10-selected-castle-home.jpg) → [after](evidence/2026-11-22/response-02/after-ux10-selected-castle-home.jpg).
- Rotated 90°: [before](evidence/2026-11-22/response-02/before-ux10-selected-castle-rotated90.jpg) → [after](evidence/2026-11-22/response-02/after-ux10-selected-castle-rotated90.jpg).

## Verification record

| Command or manual check | Revision / environment | Actual result | What it establishes and what remains untested |
| --- | --- | --- | --- |
| `npm run check` | `05de8fa`, Node 25.2.1 | Exit 0. 80/80 rules tests; bot-vs-bot smoke, two-process peers and build all pass. | Rules, replays, peers and build are intact. No browser coverage. |
| `node tools/hapa/ui-journeys.mjs --label after --journeys ux01,ux02,ux03,ux04,ux07,ux08,ux09,ux10` | `d770856`, dev server 127.0.0.1:5199 | Exit 0. Response 01's journeys still pass after the layout changes (ux01 r1 held, × absent; ux02 one resolution; ux03 the same ten selections). ux04 0 hidden; ux07, ux08, ux09 and ux10 as reported. Console: 404s only (`favicon.ico`; one unidentified in the hotseat and card pages, also present before). | Regression coverage for response 01, and the stated cases here. Headless Chrome only. |
| `--journeys ux14rm` (the same checks first ran as an ad-hoc script) | `05de8fa` | Under `reduce`: ring 1.000 ×6, token 1.000 ×4. Under `no-preference`: ring 1.023–1.05, token up to 1.338. | The reduced-motion preference reaches these two board motions. Other motion (card flight, hit marks) already had paths; not re-verified here. |
| Built-in browser pane | `2c238a0`–`d3a4a63` | Ribbon label and center measurements; tether band visible on hover; no seams in the meadow frame; card tiles at Tick 7 (2 faces, 7 fallbacks). | Spot checks at the pane's roughly 800×563 size. |
| Not run | — | — | B-seat captures for UX-08 and UX-10; enlarged text; a keyboard-only full journey; color-reduced views; a real, non-headless Chrome window at CJ's size; reduced-motion captures of `planned()`. |

## Decisions and next handoff

**Design choices made within the existing requirements:**

- **Framing subject (UX-07):**
  - The default subject is the playable territory plus one member width, not the world banks. Fitting the banks too halved the board.
  - The ribbons already show the same card instances, and the tether connects them to their columns.
  - A 24° lens trades some near-row size for a less crowded far row.
- **The single Ready lives in the plan panel:** the Companion places the agreement action there. The big button keeps its states (Ready, Acknowledge, Waiting, Response window, Resolving).
- **Planned links are presentation only:** they follow the public plan and vanish when playback starts. A cancelled order removes only its link and tag.
- **The Tarot face and the ability are separate identities:**
  - The face band and the inspector credit describe art only.
  - The ability band, and the inspector's definition and creator lines, describe rules.

**Decisions for CJ:**

- Is the UX-07 trade acceptable: about 11% less board area for in-frame labels, a less crowded far row and aspect-correct fitting?
- The concession question from response 01 is still open.

**Findings remaining:**

- UX-11 terrain materials.
- UX-12 party art through an orbit.
- UX-13 plain-language hierarchy.
- The rest of UX-06: narrow-window drawer and text-size policy.
- The rest of UX-14: full keyboard, enlarged-text and color-reduced journeys.
- A multi-color-card fixture to show the Mana overflow.

**What the reviewer should inspect next:**

- `main` from `8569829` to `05de8fa`, plus this report's commit.
- Evidence in `evidence/2026-11-22/response-02/`.
- The ribbon alignment and tether, the planned/landed Supply sequence, and the home framing in a visible Chrome window at CJ's usual size.

**CJ acceptance:** not yet recorded.
