# Implementation response 07 — 23 November 2026

**Close inspection you can trust, that never covers the formation, and one finished territory.** This answers [UI and design review 06](2026-11-23-ui-design-review-06.md) (R6-01–R6-06) and [assignment 07](2026-11-23-next-agent-assignment-07.md), under [human-feedback addendum 02](../requirements/2026-11-23-human-feedback-addendum-02.md) and the compatible parts of [addendum 01](../requirements/2026-11-22-human-feedback-addendum-01.md). Response 07 was the next unused number. Review 06 and its baseline evidence are unchanged. **CJ acceptance: not yet recorded.**

## Scope and source

- **Starting point.**
  - Local `main` was clean at `53481b9` (response 06, pushed), with no stashes, other branches or `HANDOFF.md`.
  - Review 06 / assignment 07 (`6e43c6c`) were fetched and fast-forwarded. No reset was needed and no local work was at risk.
  - On the Overwatch board `hapa-versus`, HV-58 and HV-59 were in Review, HV-60 in Backlog, and HV-44/HV-56 in Review. No other session had touched Versus since response 06.
- **Reproduced first.** Both review 06 probes, run against `6e43c6c`, reproduced every listed defect:
  - the ward and headcount came from the final state while the body was alive;
  - the pool and headcount came from the final state;
  - line contribution 1, applied 3 and helper 4 were not distinguished;
  - an excavated existing cube caused zero rebuilds;
  - the +2 hill's dressing stayed opaque at +1;
  - the navigator replaced the selection with B and moved the camera;
  - the expanded detail stayed stale;
  - zoom drifted 60 px at y = 6;
  - the party summary sat at x = 980 in a 960 px host;
  - the visible Home kept the old Return pose.

  Their outputs were not kept as new evidence, since the review already records them. The probes themselves remain unchanged: they assert the old defects.
- **Source commits (on `6e43c6c`):**

  | Commit | Slice |
  | --- | --- |
  | `ce26eda` | One displayed moment for inspection; terrain content invalidates scenery (R6-03, R6-04, R6-05): rules hook, read model, tests, scenery key |
  | `400de5a` | Keep the formation visible and the command selection steady (R6-01–R6-04): app, camera, labels, reading panel, inspection bar |
  | `1a9f0e9` | One territory as the Hapa benchmark (R6-06): shrine courtyard, quieter framing, one height label |
  | `9f28a2a` | Fit reading to the real text size and docked controls: the R6-01 follow-through found by the new checks |
  | `3344faa` | Regression contract 4 (z08–z11) and two labelled fixtures (`ward`, `surface_dig`) |
  | `b3a44af` | Cheaper scenery and label builds (from the measurement below) |

  This report and its evidence are committed separately.
- **Revision under test:** `b3a44af`, a clean tree. The final run's `report.json` records `dirty: false`.
- **Engine:** gitlink `ba838cca09ba43afceda0452b63d28df4cbf7f72`, verified as the `vendor/lumina` checkout. Unchanged; no engine work was needed.
- **Profile:** default `hapa_open_10x9_v3_02`. Other profiles appear only in Node tests (`…_party_maintenance`, `…_line_attacker`). Fixtures are labelled: `ward`, `surface_dig`, `terrain`, `stacked`, `corner`, `dig`, `response`, `cards`.
- **Rules boundary.** One rules-side change was made: `emit()` calls an optional, non-enumerable `observe` callback that `resolveTick` sets only when a presentation passes `ctx.observeEvents` (like the existing `ctx.trace`). Rules never read it. A test shows identical events and state fingerprint with and without it. Movement, Supply, combat, terrain and turn rules are unchanged.

## What a person can do now

- **Command one party while reading another.**
  - Clicking your own party selects it for commands, without a camera move.
  - Clicking anyone else's party reads it: its public summary is pinned with "Inspect up close (F)", and your selection and orders stay.
  - In **Parties & Cards**, your parties have **Select** and a separate **⌕ Inspect** button. Other parties' rows inspect them.
  - The event log's "Inspect the party" inspects without selecting.
  - The inspection bar names the party being read and adds "commanding your Castle".
- **Read the real members without losing them.**
  - Compact role and health labels stay on the bodies.
  - Opening a member (hover, a tap on its body, or its button in the inspection bar) highlights its label in gold and puts the full explanation in one reading panel beside the formation, joined by a dashed leader line. The panel never sits over the bodies, the labels or the docked controls.
  - Identical rows are grouped, for example "Magic protection 1 on all six faces: 1 from the party Mage (ward)". Real exceptions keep their own rows.
- **A keyboard and touch route.** The inspection bar lists every member as a button:
  - ←/→ moves between members.
  - Enter opens or closes that member's explanation; the button is described by the reading panel.
  - Esc closes the explanation first, then the inspection.
  - It also has Return and Close.
- **Facts that belong to the moment shown.** During playback, every inspected fact comes from the state right after the last event shown: health, survival, wards and other providers, conditions, headcount, pool and position. The open explanation refreshes the moment those facts change.
- **Honest scope.**
  - In line-defense profiles, a member's value is labelled its *contribution*, with an applied front-line preview from the rules.
  - A ranged preview names an engaged target, or says there is none; it never implies a shot at an arbitrary remote enemy.
- **One camera story.**
  - The Home button and the Home key are one transition: inspection and the old Return pose are cleared.
  - Wheel zoom keeps a hilltop, flyer or tunnel party under the cursor at its real height.
  - Reduced motion makes camera transitions immediate.
  - Inspect frames the formation above the docked bars.
- **The benchmark territory.**
  - A weathered wayside shrine stands on the corner crossing, with a flagstone pad, plinth, posts, a shingled gable roof, a closed back wall, an offering stone, a torn banner and a lantern post.
  - Up close, the selection apron, brackets and arrows recede.
  - A hill carries one height label on its face; the ramp is quiet timber with small chevrons.
  - Dressing follows the cutaway by each territory's own height.

## Finding disposition

| Finding | What inspection established | Change | Evidence and limits | Follow-up |
| --- | --- | --- | --- | --- |
| **R6-03** playback facts | Reproduced (review probe): Mage alive at 3 HP with the Archer's ward already 0 and headcount 2; pool 13/15 with 0 events shown; the final `p.alive` gate in `_updateLabels`. | `ce26eda` (`momentSlice`, `stateAt`, observer hook); `400de5a` (labels, party facts and survival gate read the displayed moment) | `tests/hapa/inspection-moment.test.js`: the Mage case before/after the displayed death; pooled health and maintenance; a party defeated later stays alive until its defeat is shown; outcomes identical with the hook. Browser z10 (fixture `ward`): the before/after invariants, pause, final convergence, New match. [probe-07](evidence/2026-11-23/response-07/probe/probe-07-b3a44af.json). Pool and elimination are Node-tested only: the default profile has no pool. | — |
| **R6-04** cache and scope | Reproduced: the detail key lacked preview, condition and source dependencies; contribution 1, applied 3 and helper 4 were conflated; an auto-chosen remote target. | `ce26eda` (`linePreview`, `rangedTargets`); `400de5a` (full signature: all facts plus the open member's targeting and line context; detail built only when open) | z10: the open Archer explanation changes at contact from "No engaged target" to "engaged … Preview vs Queen R6C5" with no pointer movement. Node: contribution 1 / front line 3 equals a real exchange. A same-target elevation or sky change was not staged in the browser; it is covered by the signature, which includes the preview's power, range, elevation and blocked fields. | — |
| **R6-05** terrain and cutaway | Reproduced: count-based key, zero rebuilds; +2 hill dressing opaque at +1. | `ce26eda` (neighbourhood open/solid and surface-band signature; per-territory cutaway visibility) | z11 (fixture `surface_dig`): rules, scenery and terrain view agree at solid → empty → solid → empty with an unchanged entry count. The +3 hill dressing hides at layer +1, while the hill turns see-through and flat ground keeps its own; picking is unchanged. Sabotage restoring the count key fails. | Open pit at low pitch: not separately captured |
| **R6-02** intent and camera | Reproduced (source probe and the review's live capture). | `400de5a` (navigator, board, event log, `_goHome`, real-height zoom, reduced motion); `9f28a2a` (stacking) | z08: a keyboard navigator inspection of B keeps A's selection and orders, the camera Return works, then a third order goes to A without reselecting. Board click on an enemy, then F. Home → Focus → Return comes back to home for both the button and the key. Wheel drift for hilltop / flyer / tunnel (layer −2): **0 / 0.1 / 0 px**, selection and layer unchanged. Also found: the A basin counter could cover the Home button after a 45° turn, and the command bar sat above blocking sheets; both fixed. | Touch: no real device |
| **R6-01** unobstructed reading | Reproduced: the expansion covered neighbours (live and supplied captures); summary off-screen; 12–12.5 px detail; `aria-hidden`-only access. | `400de5a` (reading panel, measured placement, leader line, grouping, inspection bar); `9f28a2a` (rem text from the browser text size, measured label box, free-region fitting, framing above the bars, compact bar) | z09: 44 measured cases, all passing with DOM rectangles and independently projected bodies. Covered: four- and nine-member formations, 1280×720 and 1600×1000, 8 bearings, low pitch, screen edge, and 150% and 200% browser text size (CDP `Page.setFontSizes`). The explanation never covers a body, a label or a docked control; labels never overlap; facts stay reachable; core text is ≥ 14 px at 100% and scales. At 1280×720 the on-body labels step back at 150%/200% text and at low pitch (including the screen-edge case, measured at that pitch), and role and health are then read in the inspection bar. | Screen reader not run; only inspection text, the command and inspection bars, and hints use rem — Card tiles, the navigator and the match bar are still px |
| **R6-06** benchmark territory | Agreed: decorated plates; a beige pillar; HILLTOP/HILL/RAMP stacked. | `1a9f0e9`; `b3a44af` | [Same-state captures](evidence/2026-11-23/response-07/states/) before `53481b9` / after `b3a44af` at identical camera settings, with and without member detail, at 0°/45°/135°. [Territory journey](evidence/2026-11-23/response-07/journey/journey-territory.mp4). Art judgment is CJ's. | A second recipe only after CJ's view |

## Independent expectation and observed result

1. **Friendly command → enemy inspection → command again** (z08 and journey clip 1; seed 1, 1280×720).
   - **Expected:** A's selection and both queued orders survive; inspection and camera movement happen only when asked for.
   - **Observed:**
     - The pointer queued Load and then Move for A's C1 Castle.
     - N, Tab to "Inspect B's Bishop", Enter: B's Bishop was inspected, A's Castle stayed selected, the orders were unchanged, and focus went to the inspection bar.
     - Esc, → and Enter opened a member; Esc closed it; Esc ended the inspection; R returned to the exact prior pose.
     - Face ▾ then added a third order for A's Castle.
   - **Result:** pass. Both Home paths: pass.
2. **Four and nine members, explanation open, orbit, edges and text scale** (z09).
   - **Expected:** role and health readable; the explanation leaves the formation visible; facts and controls reachable.
   - **Observed:** all 44 cases passed. At 1600×1000 the labels stayed on the bodies in every case. At 1280×720 they stayed at all eight bearings; at low pitch (and the screen-edge case, measured at that lowered pitch) and at 150%/200% text they stepped back to the bar instead of overlapping.
   - **Result:** pass for the stated cases.
3. **Mage dies during default-profile playback** (z10, fixture `ward`, 0.2×).
   - **Expected (from the events shown, not the inspection code):** before the death is shown, the Mage is labelled, the Archer warded and the party at 3/9; after it, no Mage label, no ward and 2/9.
   - **Observed:** exactly so in every sample. The open Archer explanation refreshed at contact. Pausing held the moment and the text. The end state equalled the accepted state, and New match left no label, panel, bar or subject.
   - **Result:** pass.
4. **Existing solid cube → dig → fill → dig** (z11, fixture `surface_dig`).
   - **Expected:** the scenery mask and the real opening change together, with the same entry count.
   - **Observed:** the rules, the dressing and the terrain view agreed at all four steps; the entry count stayed constant.
   - **Result:** pass.
5. **Raised ground and cutaway** (z11, fixture `terrain`).
   - **Expected:** at layer +1, the +3 hill's dressing steps aside with the see-through hill; picking is unchanged.
   - **Observed:** as expected.
   - **Result:** pass. A low-angle hill occlusion is drawn as a dashed "behind terrain" label. That path is implemented, but no regression assertion stages a body hidden behind a hill.
6. **Existing journeys** (c1–c14, z01–z07 unchanged in intent).
   - **Observed:** funded quotes and refusals (c8, z01), Card hover/pin/compare (c6), Fire Pit and Mana (c9), public intentions (c10), Ready freeze and response window (c1, c2), stale acknowledgments (c1), replay verification (c11), concession (c14), and two-peer agreement (`npm run check`) all pass.
   - **Contract-4 updates:** own navigator rows are now named "Select …"; an opponent click is a read (c3 checks the clicked identity through either path); and the explanation is in the reading panel (z03).

## The continuous journeys

These were recorded with real pointer and keyboard input by [journey-07.mjs](evidence/2026-11-23/response-07/scripts/journey-07.mjs) at `b3a44af`: 1280×720 @1, browser default text size, profile v3_02. [journey-log.json](evidence/2026-11-23/response-07/journey/journey-log.json) records, after each step, the selection, the inspected party, the open member, the label level, the bearing, the plan and the label count.

1. **[journey-command-inspect.mp4](evidence/2026-11-23/response-07/journey/journey-command-inspect.mp4)** (30.2 s; seed 1, A human vs B bot). Overview, then select the C1 Castle, then:
   1. Supply ▾ → Load 2♣ → Move to R2C1 → Ready, and the merge plays.
   2. N, keyboard to "Inspect B's Bishop", Enter.
   3. Esc; → and Enter open a member; Esc, Esc, R.
   4. F inspects the nine-member Castle; hover an Archer.
   5. Orbit 360°, R, then Supply ▾ on the same party.

   A's Castle stays selected at every step.
2. **[journey-playback-moment.mp4](evidence/2026-11-23/response-07/journey/journey-playback-moment.mp4)** (11.5 s; labelled `ward` fixture). Keyboard inspection of B's Castle, its Archer opened from the bar, both Ready at 0.3×. The Mage falls; the labels go from 3 to 2 and the ward ends at the displayed death.
3. **[journey-territory.mp4](evidence/2026-11-23/response-07/journey/journey-territory.mp4)** (18.7 s; labelled `terrain` fixture). A.hill, F, an orbit in eight 45° steps, layer +1 (the hill dressing steps aside), All layers, an Archer opened, R.

## Visual evidence and asset provenance

- **Same-state captures:** in [states/](evidence/2026-11-23/response-07/states/) — before at `53481b9` (a baseline worktree with the same engine pin) and after at `b3a44af`. Headless Chrome/157 on Darwin 25.2.0 arm64, 1280×720 @1, default text size.
  - **Camera:** identical on both builds — home yaw (+45° / +135° for the bearing shots), pitch 50°, focus at the party's real height, distance 0.30 × board size.
  - **Subjects:** the opening's four-member Bishop (`A.mount.C3`, member Mage) and the terrain fixture's `A.hill` (member Archer).
  - **For each subject:** the close view; the close view with that member open by hover; 45°; 135°.
  - **Before:** the open member's expanded label covers the Castle and two Archers; "HILLTOP +2 / HILL +2 / RAMP" stack across the front; the preview implies a shot at "Castle R6C5"; the beige pillar.
  - **After:** the label is highlighted and the explanation sits beside the formation with a leader; there is one height label on the hill face; "No engaged target"; the shrine.
- **Dense layout at 1280×720:** in [regress/after-b3a44af](evidence/2026-11-23/response-07/regress/after-b3a44af/).
  - `z09-nine-1280-b*` — nine labels side by side, a long role cut as "Swords…" (its full name in the bar and the panel), explanation beside.
  - `z09-*-text-150` and `-text-200` — enlarged text: bars, the fitted scrolling explanation, labels stepped back.
  - `z09-*-low-pitch`, `z09-*-edge`, `z08-enemy-read-friendly-kept`, `z10-after-death`, `z11-dug-again`, `z11-hill-at-layer-plus1`.
- **Provenance:** all procedural and painted in code. This covers the shrine, flagstones, timber, shingles, flowers, chevrons and stone materials (`territory-diorama.js`, `terrain-view.js`), and the DOM text. There is no external, AI-generated or owner media, and characters and the board are unchanged. The environment remains one provisional study for CJ's art judgment.
- **File format:** the PNG screenshots were converted to JPEG (quality 82) after the runs to keep the repository small. The reports note this.

## Measurements

The same bounded route ran on both builds ([perf-07.mjs](evidence/2026-11-23/response-07/scripts/perf-07.mjs)). Environment: headless Chrome/157, Darwin 25.2.0 arm64, 1280×720 @1, 100% text, Home camera, then F on `A.mount.C1`, then one member open by hover. Files: [before](evidence/2026-11-23/response-07/perf/before-53481b9.json) and [after](evidence/2026-11-23/response-07/perf/after-b3a44af.json).

| Measure | Before `53481b9` | After `b3a44af` | Note |
| --- | --- | --- | --- |
| Click a party → command bar | 198 ms | 192 ms | single samples including CDP round-trips |
| F → first member label | 469 ms | 484 ms | camera approach + 140 ms settle |
| Worst frame in the 2.5 s after F | 16.8 ms | **33.4 ms** | one dropped frame the **first** time a territory's environment is built; repeat Inspects of the same territory: none over 20 ms ([inspect-frames](evidence/2026-11-23/response-07/perf/inspect-frames-after-b3a44af.txt)) |
| Close view frame median / p95 | 16.7 / 16.8 | 16.7 / 16.7 | vsync-capped: no headroom claim |
| Close view geometries / textures / DOM elements | 1391 / 144 / 513 | 1404 / 149 / 586 | +5 painted textures; DOM includes the inspection bar and reading panel |
| 8-step orbit CPU, script / layout / style | 1121 / 22 / 54 ms | 1079 / 24 / 67 ms | |
| 3 s idle with a member open, script / layout / style | 880 / 13 / 20 ms | 807 / 16 / 27 ms | the signature cache rebuilds nothing while idle |
| 8-step orbit with a member open, script / layout / style | 1104 / 20 / 55 ms | 1081 / 26 / 67 ms | measured placement adds about 12 ms of style over about 4 s |
| Draw calls / GPU time | unavailable | unavailable | post-processing resets `renderer.info`; no GPU timer headless |

The long frame was traced:

- Neither the inspection handler (7.5 ms measured), the page's own per-frame script (≤ 4 ms) nor the WebGL render (≤ 12 ms) accounts for it.
- About 15 ms falls elsewhere in the animation-frame callback during the first environment build (the trace shows a 42 ms animation frame, against 28 ms in the baseline).
- Keeping the built environment removed it for repeat visits. Shared materials, spreading neighbours over frames and batching label measurement did not remove the first one.
- **It is reported, not solved.** No performance target is approved.

## Verification record

| Command or check | Revision | Result | Establishes / misses |
| --- | --- | --- | --- |
| `npm run check` | `b3a44af` (also after each slice) | exit 0; **114/114** tests (108 + 6 new); bot smoke match; two-process peer match agrees; build | Rules outcomes and replay unchanged; the moment read model tested |
| `node tools/hapa/ui-regress.mjs` | `b3a44af`, clean | **345/345**, 22 checks, exit 0 ([report](evidence/2026-11-23/response-07/regress/after-b3a44af/report.json)); only the allowed favicon 404 | Contracts 2–4 |
| `… --only c1,c3,z10,z11 --sabotage` | `b3a44af` | **47/52**, exit 1 ([report](evidence/2026-11-23/response-07/regress/sabotage-b3a44af/report.json)); fails exactly: two swapped expectations (c1, c3) and the three z10/z11 assertions for the reinstated review 06 defects | The new checks detect their defects. Its `dirty: true` is only the previous run's 46 untracked evidence files; the tracked diff is empty (empty-diff hash) |
| `probe-07.mjs` | `b3a44af` | all corrected expectations hold ([output](evidence/2026-11-23/response-07/probe/probe-07-b3a44af.json)) | Review 06's cases against the fixed code; the review's own probes are unchanged |
| Visible play in the browser pane | working tree during the slices | The issues found and fixed before commit are listed under **Decisions** | Not CJ's browser |

## Decisions and next handoff

- **Working defaults chosen within the addendum** (CJ can change any):
  - Core label text is 14 px (`0.875rem`) and follows the browser text size.
  - A compact label is never wider than the gap to its neighbour; long roles are ellipsized on the body only.
  - Labels appear only when a formation row has room for the measured label height (hysteresis 0.92).
  - The explanation goes beside the formation: right, left, above, below. Failing that, it goes in the largest free region, scrolling. It docks only as a last resort (never needed in z09).
  - The party facts step aside to the inspection bar when crowded.
  - Inspect lifts the formation above the docked bars, at most about 9% farther away.
  - The inspection bar compacts to one scrolling row above 20% of the view's height.
- **Bugs found by the new checks and fixed before commit:**
  - the rem base inherited the UI's 14.5 px, so text was 12.7 px;
  - the docked explanation covered bodies at 200% text;
  - the inspection bar re-rendered every frame;
  - labels overlapped at 1280×720 nine-member;
  - the A basin counter could cover the Home button;
  - the command bar drew above blocking sheets.
- **Remaining limitations:**

  | Priority | Gap |
  | --- | --- |
  | P1 | Real touch device and screen reader not exercised. Text scaling reaches inspection, the command and inspection bars and hints, but not Card tiles, the navigator or the match bar (still px). |
  | P1 | One dropped frame on the first build of a territory's environment (above). |
  | P2 | Not staged in the browser: a same-target elevation or sky change while open; an open pit at low pitch; a body hidden behind a hill. |
  | P2 | Helper-away and flyer label cases; Major/row Card fixtures with the new interaction (HV-60). |
  | P2 | Compact comparison and grayscale items (HV-57). |
  | P2 | A running-work animation (one-Tick work in this profile). |
  | P2 | A second environment recipe, only after CJ judges this one. |
- **For CJ:**
  - Is the reading panel beside the formation the right reading model?
  - Are ellipsized role names on the bodies acceptable at 1280×720, with full names one hover away?
  - Does the shrine courtyard set the right material language before more recipes?
- **CJ acceptance:** **not yet recorded.**

## Overwatch receipts

These comments were appended to board `hapa-versus` through the kanban's `appendEvent` (task_comment events), and the state was read back. No card was created, moved or marked Done.

| Card | Event | State after |
| --- | --- | --- |
| **HV-58** — select to command, approach to inspect | comment `evt_1795475748212_25dee45c`: R6-01–R6-04 evidence | Review (unchanged) |
| **HV-59** — territory environment | comment `evt_1795475748221_86a8c1c3`: R6-05, R6-06 evidence | Review (unchanged) |
| **HV-60** — inspection follow-ups | comment `evt_1795475748228_1da19c61`: what response 07 covered, and what stays open | Backlog (unchanged) |
| **HV-44** — accessibility | comment `evt_1795475748235_9fde8d0f`: keyboard route and text scale | Review (unchanged) |
