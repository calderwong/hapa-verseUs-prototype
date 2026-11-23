# Implementation response 06 — 23 November 2026

**Select to command, approach to inspect, and one territory that becomes a place.** This answers:
- [human-feedback addendum 02](../requirements/2026-11-23-human-feedback-addendum-02.md) (HF2-01 to HF2-10);
- [UI and design review 05](2026-11-23-ui-design-review-05.md) (R5-01 to R5-06);
- [assignment 06](2026-11-23-next-agent-assignment-06.md) (Z01 to Z12).

Response 06 was unused, so it is this one. Earlier responses are preserved. **CJ acceptance: not yet recorded.**

## Scope and source

- **Starting point:**
  - Local `main` was clean at `b747d11` (response 05).
  - Review 05 arrived as `17752e0` and was integrated by fast-forward.
  - There was no unpublished work, and no other agent session had touched Versus since response 05.
  - On the Overwatch board, HV-54 to HV-56 were in Review and HV-57 in Backlog.
- **Commits, on top of `17752e0`:**

  | Commit | What it delivers |
  | --- | --- |
  | `eda7ed3` | Party/member inspection read model from the real combat logic (R5-04, HF2-05) |
  | `5f52e07` | Command selection separate from inspection; command bar; close inspection; member labels; Focus and Return (R5-01 to R5-03, HF2-01 to HF2-07) |
  | `c938e27` | One territory environment that survives the camera (R5-05, HF2-08 to HF2-10) |
  | `95c88bf` | Regression contract 3, and the label and focus fixes it found (R5-06) |

  This report and its evidence are committed separately; source and evidence commits are reported apart.
- **Revisions:**
  - **Source:** `95c88bf`, clean at every evidence run (`report.json`: `dirty: false`).
  - **Engine:** Lumina gitlink `ba838cca09ba43afceda0452b63d28df4cbf7f72`, verified as the `vendor/lumina` checkout. Unchanged; no engine work was needed, because no stencil portal was built.
  - **Profile:** `hapa_open_10x9_v3_02`. Fixtures are labelled where used: `terrain`, `corner`, `response`, `dig`, `stacked`, `cards`.
- **Scope boundary:** presentation and shared read-model work only. No movement, Supply, combat, terrain or turn rule changed; the 108 rules tests and the replay and peer checks are unchanged in outcome.

## What a person can do now

- **Command at ordinary zoom:**
  - Click a party, or choose it in **Parties & Cards** (N). A small command bar docks under the field. It holds **Supply ▾**, **Move to ▾**, **Face ▾**, **Work ▾**, **Inspect (F)**, **↩ Return (R)** and **Details**.
  - When the party can't move, the bar gives a short reason: "Needs a Mount", "C3 inactive: next active Tick 7", "Plan frozen after Ready", "No Supply for any route: load a Card first".
  - No party document opens, and the camera does not move. Loading Supply opens Move to, which lists every funded destination with its exact Supply need; right-click still works too.
  - Closing a Card or any other view never clears the selected party or its orders.
- **Approach to read:**
  - **F** or **Inspect** frames the party's real members at their real height, keeps yaw, and saves the prior view; **R** returns to it.
  - A wheel zoom over any party, including an opponent's, makes it the inspected party without changing your command selection.
  - Zooming well out or panning away releases inspection. **Escape** closes the top information layer, then an active tool, then inspection, in that order.
- **Read the real formation:**
  - Role and true health appear beside each visible member, and a combat summary when measured space allows.
  - Hovering one body expands its breakdown: attacks in words, protection by face with base plus applied sources, a labelled ranged preview, and conditions.
  - The party's collective facts appear once beside the formation: Mount, members out of nine, empty centre, facing, Supply held and planned, destination, band and exposure, shared pool.
- **The territory as a place:** at close range the inspected territory and its neighbours show a brushed-pixel ground, grass, stones, a rock outcrop on raised ground, and a broken-pillar landmark with a torn banner on a corner crossing. The scene stays in place through a full orbit.

## Outcome

1. **Selection versus inspection (R5-01, R5-02, HF2-01, HF2-02, Z01, Z02, Z08).**
   - `this.selected` is now command selection only. References (Cards, basins, events, territories, an explicitly requested party **Details**) live in `this.pinned`. Closing one never touches the selection or the orders.
   - Party hover at ordinary distance is a one-line hint. Cards and basins keep their full views.
   - Any active Supply or ability targeting tool suspends unsolicited inspection.
   - The command bar reuses the same validated controls, and its Move list equals the rules' funded quotes exactly (z01 compares them).
2. **One truthful read model (R5-04, HF2-05, Z05)** — `src/hapa/rules/inspection.js`, pure selectors over the real combat functions:
   - `memberFacts`: health in the profile's form (member or shared pool); base attacks; protection per channel and face from `individualProtection` with base versus applied and named sources; line mode; conditions.
   - `partyFacts`.
   - `partyLineProtection`: the line-defense value over the members a hit reaches.
   - `rangedPreview`: from `rangedShot`, labelled a preview.
   - `healthAt`: playback-time health.

   The review's **Bound Standard** case is a test: base front Physical 1, applied 2, with the Standard named as the source.
3. **The formation carries its facts (R5-03, HF2-03, HF2-04, HF2-06, HF2-07, Z03, Z04).**
   - **Placement:** labels follow the displayed bodies by stable member id, upright and outside world post-processing. They are pointer-transparent, so a wheel or drag over a label still works the camera.
   - **Detail level:** set by the measured on-screen size of one member width and the row spacing at the party's real height, with hysteresis and a 140 ms settle. A full nine-member formation therefore stays compact (role and health); combat summaries appear only with real room.
   - **Composition:** no centre member is ever invented; an empty centre is stated. A roofed tunnel party is **not** x-rayed at close zoom: the label says to open its layer, and with the cutaway open its members are read.
   - **Playback:** labels show health from the pre-Tick state plus only the events already shown, marked "health as of the moment shown" (z06, during a mid-movement contact exchange).
4. **Territory environment (R5-05, HF2-08 to HF2-10, Z07, Z11, Z12)** — `src/hapa/presentation/territory-diorama.js`:
   - **Bounds:** one world-space environment around the inspected territory, a lighter dressing of its eight neighbours, faded in with the measured member size.
   - **Ground:** the decal sits at the true surface height, the hill top on raised ground. Squares open to the sky stay transparent, so a real pit is never floored over.
   - **Depth:** grass is world-fixed crossed quads with sides under orbit; stones have contact shadows; the landmark sits at a different depth from the field, so parallax is real.
   - **Decoration only:** it is never pickable (z07 compares picks with it hidden and shown), has no rule effect, hides under a below-surface cutaway, and is still under reduced motion.
   - **Not attempted:** an aperture or "window" through the opaque base plane, and an offscreen portal.
5. **Bugs found and fixed while building and testing:**
   - command menus whose state raced re-rendered `toggle` events;
   - a keyboard pick that left focus nowhere because the bar has no heading;
   - nine combat summaries burying the bodies;
   - the party label overlapping members after an orbit;
   - the null text nodes from the "nullnull" label.

## Finding disposition

| ID | What inspection established | Change | Evidence and limits |
| --- | --- | --- | --- |
| R5-01 / HF2-01 / Z01 | Reproduced: selection auto-pinned the party view, and closing it cleared the selection. | `5f52e07` | z01: select with no document and no camera move; Move list equals the rules' quote; closing a Card keeps the selection. |
| R5-02 / HF2-02 / Z02 / Z08 | Party hover was the full document; tools didn't suspend it. | `5f52e07` | c6 (hint, not a document), z01 (Pawn and frozen reasons), z03 (labels pass the wheel). **Partial:** Card drag and targeting suspension is code-path only, not asserted in a browser. |
| R5-03 / HF2-03 / HF2-06 / HF2-07 / Z03 / Z04 / Z07 | Zoom changed only crest size; no member facts. | `5f52e07`, `95c88bf` | z03 (enemy inspected, own selection kept; five-member Pawn, nine-member merged party, expanded member, Return); z07 (orbit, roof, cutaway). **Not tested:** helper-away label following, 150%/200% text, high DPI, touch. |
| R5-04 / HF2-05 / Z05 / Z06 | Reproduced: the panel printed raw archetype values (the Bound Standard omission). | `eda7ed3`, `95c88bf` | `tests/hapa/inspection.test.js` (7: Bound Standard, directional shield, ward as applied, member versus pool, line defense, elevation-aware preview, playback health); z06 in the browser. |
| R5-05 / HF2-08 to HF2-10 / Z11 / Z12 | The territory read as a slab. | `c938e27` | z07 (landmark position and rotation identical through 8 bearings; picking unchanged; roofed and cutaway); dig planned versus accepted; captures and journey. **Not done:** a work-in-progress animation beyond dust (the current profile's work takes one Tick, so no running state was observed in the browser); a territory-enhancement visual. |
| R5-06 / Z09 / Z10 | Evidence needed a continuous journey. | `95c88bf` | Regression contract 3: 270/270; the recorded continuous journey. **Not tested:** Z09 Major/row Card fixtures; Z10 high DPI, 150%/200% text, touch. |

## Independent expectation and observed result

- **Z01 ordinary movement.**
  - **Expected:** select without a document; reach every funded target with the exact quote; closing information keeps the selection.
  - **Observed (z01):** 1280×720, seed 1; click the C1 Castle → the command bar, no pinned view, camera goal unchanged; Supply → the bar's funded list equals `_fundedTargets` exactly; Move to R2C1 planned after its load; a Card pinned and closed with Escape → selection and both orders kept.
  - **Result:** pass.
- **Z02.**
  - **Observed:** the C3 Pawn shows "Needs a Mount: a Pawn cannot move on its own"; after Ready, "Plan frozen after Ready".
  - **Result:** pass.
- **Z03 correct subject.**
  - **Observed:** a wheel zoom over B's Commander party with A's Castle selected → inspection is B's, selection stays A's, plans unchanged.
  - **Result:** pass.
- **Z04 real composition.**
  - **Observed:** the five-member Pawn shows 5 labels and "empty center"; the merged Castle shows 9 compact labels (role and health only).
  - **Result:** pass. Helper-away following was not exercised.
- **Z05 accurate stats.**
  - **Observed:** in the Node tests, all as expected (see Finding disposition). In the browser, the hovered Archer shows "Bow: 2 × 1 Physical, base range 2", the ward as applied Magic protection with its source, and a labelled preview.
  - **Result:** pass.
- **Z06 playback.**
  - **Observed (corner fixture):** the contact damaged the inspected party; the first sample showed pre-Tick health; the sum only fell; it ended at the accepted value. New match leaves no labels, subject, return pose or diorama.
  - **Result:** pass. Paused playback was not exercised.
- **Z07 camera and layers.**
  - **Observed (terrain fixture):** 8-step orbit; facing unchanged; labels attached throughout. The tunnel shows 0 labels until layer −2 is opened, then members are labelled and the surface dressing hidden.
  - **Not exercised:** the flyer band and the open pit's members.
- **Z11 living territory.**
  - **Observed:** the landmark's position and rotation are identical at every bearing, and picking with and without the dressing is identical.
  - **Result:** pass.
- **Z12 terrain truth.**
  - **Observed:** a planned dig is drawn while the cube stays solid; the accepted dig empties it (`terrain_changed`); New match clears the diorama.
  - **Not exercised:** repeated zoom/orbit leak measurement beyond the renderer counts.

## The continuous journey

Recorded with real pointer and keyboard input by [scripts/journey-06.mjs](evidence/2026-11-23/response-06/scripts/journey-06.mjs) at `95c88bf`: dev server 127.0.0.1:5199, profile v3_02, seed 1, A human against the B bot, 1280×720 at DPR 1, Home camera.
- [journey-opening.mp4](evidence/2026-11-23/response-06/journey/journey-opening.mp4) (21.6 s): click the C1 Castle → Supply ▾ → Load 2♣ (C1) → Move to R2C1 (funded) → Ready → merge playback → Inspect (F): nine labels → hover an Archer → orbit 360° → Return (R) → Supply ▾ again on the same party.
- [journey-terrain.mp4](evidence/2026-11-23/response-06/journey/journey-terrain.mp4) (15.6 s, labelled terrain fixture): A.hill on raised ground → F → half orbit → Home → the roofed B.tunnel (no x-ray) → layer −2 (members read, dressing aside) → All → Return.

[journey-log.json](evidence/2026-11-23/response-06/journey/journey-log.json) records each step with the tick, selection, inspection subject, detail level, bearing, plan and label count. The selection stays A.mount.C1 throughout clip 1.

## Visual evidence and asset provenance

- **Same-state captures:** [states/](evidence/2026-11-23/response-06/states/), before at `b747d11` and after at `95c88bf`, 1280×720. For the opening's C3 mount party (`A.mount.C3`) and the terrain fixture's `A.hill`, each pair shows:
  1. selection at default zoom (before: the large party document; after: the command bar);
  2. the same close camera (before: enlarged sprites on a slab; after: labelled members and the environment);
  3. that camera orbited 135°.
- **Regression screenshots:** in [regress/after-95c88bf](evidence/2026-11-23/response-06/regress/after-95c88bf/).
- **Asset provenance — all procedural, no external, AI-generated or owner media:**
  - ground textures, grass, banner cloth, stones, landmark and outcrop geometry are painted or built in `territory-diorama.js`;
  - member labels are DOM text;
  - characters, chess standards, frame, pits and scenery are unchanged from response 05.
- **Status:** the environment is a **study of one recipe** and remains a provisional sample. Its art direction (how much the frame recedes, the material palette, the landmark vocabulary) is CJ's to judge.

## Measurements

Headless Chrome/157 on Darwin 25.2.0 arm64, 1280×720 at DPR 1, the same route on both builds. Files: [perf/before-b747d11.json](evidence/2026-11-23/response-06/perf/before-b747d11.json) and [perf/after-95c88bf.json](evidence/2026-11-23/response-06/perf/after-95c88bf.json).

| Measure | Before `b747d11` | After `95c88bf` | Note |
| --- | --- | --- | --- |
| Click a party to feedback | 197 ms (party view) | 178 ms (command bar) | includes CDP round-trips |
| Zoom entry (F): worst frame interval over 2.5 s | 16.8 ms | 16.8 ms | vsync-capped: no visible stall, not a capacity measure |
| F to first member label | — | ≈ 500 ms | includes the camera's damped approach and the 140 ms settle |
| Frame interval, home / close (median, p95) | 16.7 / 16.8 | 16.7 / 16.8 | vsync-capped |
| Geometries / textures at the close view | 1316 / 140 | 1391 / 144 | the environment adds about 75 geometries; returns to baseline on New match (z06) |
| DOM elements at the close view | 532 | 513 | labels replace the party document |
| CPU over an 8-step orbit (script / layout / style) | 894 / 34 / 56 ms | 1077 / 23 / 55 ms | label projection each frame adds about 180 ms of script over about 4 s |
| Draw calls | **unavailable** | **unavailable** | post-processing resets `renderer.info` to its final pass (reads 1) |

No GPU timing is available headless. No performance target has been approved.

## Verification record

| Command or check | Revision | Result | What it establishes / misses |
| --- | --- | --- | --- |
| `npm run check` | `95c88bf` | exit 0; **108/108** tests (101 earlier plus 7 inspection); smoke match; two-peer match agrees; build | Rules unchanged in outcome; the read model is tested |
| `node tools/hapa/ui-regress.mjs` | `95c88bf`, clean | **270/270**, exit 0; only allowed error: favicon 404 | c1 to c14 (contract 2, updated) and z01, z03, z06, z07 (contract 3) |
| `… --only c1,c3 --sabotage` | `95c88bf` | **24/26**, exit 1 (the two planted failures) | The assertions can fail |
| Journey recorder | `95c88bf` | two clips and a step log | Continuous select → command → zoom → inspect → orbit → return → command |
| Visible play in the browser pane | working tree before each commit | the issues fixed before commit are listed in Outcome item 5 | Not CJ's browser |

**Untested or not done:**

| Priority | Gap |
| --- | --- |
| P1 | Z10: 150%/200% text and high-DPI label reflow; touch input; a keyboard-only route through member labels (the navigator and Details reach member facts, but labels themselves are not focusable). |
| P1 | Z09: Major and row Card fixtures with the new interaction. |
| P2 | Helper-away label following; flyer and open-pit label cases; paused playback. |
| P2 | A work-in-progress animation (one-Tick work never shows a running state in this profile); a territory-enhancement visual; more than one environment recipe. |
| P2 | Compact comparison, grayscale ownership, the remaining HV-57 items. |

## Decisions and next handoff

- **Working defaults used (addendum 02 "Working default"):**
  - **Detail levels:** identity at 64/54 px per member; combat at 150/135 px per member and 120 px per row; 140 ms settle.
  - **Labels:** 14 px text.
  - **Framing:** the focus fit keeps yaw, raises pitch to at least 38° and leaves room for labels.
  - **Release:** below 36 px per member, or when the party leaves the central 90% of the view.
- **For CJ's review, using the journey and the captures:**
  - Is selection now unobstructed?
  - Do role and health beside the bodies give enough before hovering?
  - How much should the board frame recede up close? The study keeps the slab outline and a thin legal rim.
  - Does the one-territory diorama feel like a place, or should a deeper portal be explored? That would require engine work on the fork, since stencil is disabled.
- **Next:** the P1 gaps above, then a second environment recipe and a running-work animation in a profile with multi-Tick work.
- **CJ acceptance:** **not yet recorded.**

## Overwatch receipts

These events were appended to board `hapa-versus` through the kanban's `appendEvent`, and the board state was read back afterwards. No card was moved to Done.

| Card | Events | State after |
| --- | --- | --- |
| **HV-58** — select to command, approach to inspect (HF2-01 to HF2-07, R5-01 to R5-04, R5-06) | created `evt_1795437423131_be53f21e`; ready `…142_6af75435`; in progress `…161_92cdddb4`; evidence comment `…166_41f9edcf`; review `…173_edd76e4d` | Review |
| **HV-59** — one territory environment (HF2-08 to HF2-10, R5-05) | created `evt_1795437423179_846e7721`; ready `…185_9e36a28e`; in progress `…194_06fdd061`; evidence comment `…200_2696f75a`; review `…205_c1df2d9a` | Review |
| **HV-60** — inspection follow-ups (the P1 and P2 gaps above) | created `evt_1795437423212_af986db7` | Backlog |
| HV-56 | comment `evt_1795437423217_91e87940`: party hover and pin superseded by addendum 02; Card and basin views unchanged | Review (unchanged) |
| HV-57 | comment `evt_1795437423222_c2746799`: still open | Backlog (unchanged) |
| HV-44 | comment `evt_1795437423227_f092eb17`: keyboard route and label accessibility status | unchanged |
| HV-50 | comment `evt_1795437423232_939fb574`: environment study; authored scene still open | unchanged |
