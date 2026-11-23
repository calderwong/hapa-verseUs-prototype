# Assignment 07 — Make close inspection trustworthy and unobstructed

**23 November 2026 · Follow-up to [review 06](2026-11-23-ui-design-review-06.md).**

## Goal

Preserve the new command/inspection architecture and finish its practical contract: the player can command one party, inspect another, read the actual members without covering them, and trust that every current fact belongs to the displayed moment. Real excavation and cutaways must remain visually truthful. Once these corrections work, finish one territory as the Hapa art benchmark.

The reviewed pushed baseline is `53481b90f0909f16108b30b163acb69c8649d6ea`, containing implementation `95c88bf3dbb412df8388f99391ed293d5ae6ed44`; the engine gitlink is `ba838cca09ba43afceda0452b63d28df4cbf7f72`. Compare with current local/pushed work before making changes. The reviewer observed a running app too, but its commit and dirty-tree state were not exposed. Reproduce against your identified checkout.

## 1. Recover context and preserve ongoing work

Read the local Hapa grounding and `AGENT_START.md` named by `AGENTS.md`, then `AGENTS.md`, this repository's README, `docs/reviews/README.md`, human-feedback addenda 01 and 02, review 06, and implementation response 06. Master Requirements v3 and the selected profile govern game rules; this assignment corrects presentation and does not authorize new mechanics.

Inspect the current branch, worktree, relevant local handoffs and Overwatch board `hapa-versus`. Fetch shared documentation without resetting or replacing uncommitted work. A finding already fixed should be answered with its revision and evidence, not implemented again. Continue the existing relevant cards; the response reported HV-58/HV-59 in Review and HV-60 as follow-up, but read current board state rather than assuming those statuses persist. Append evidence through the existing interface; CJ accepts Done.

The review includes executable diagnostic probes under `docs/reviews/evidence/2026-11-23/review-06/`. They assert the old defects and explain their scope. Use them to reproduce the baseline; do not turn assertions that preserve a bug into permanent regression expectations. After a fix, a formerly successful defect probe may intentionally fail. Keep dated evidence immutable and write new results to response 07's directory.

## 2. First slice: correct the facts and terrain the player sees

### A. One displayed moment for inspection — R6-03

`healthAt` currently reconstructs member HP/alive, while protection, membership, pools and other facts read the completed Tick. In the supplied legal v3_02 reproduction, before a front Mage dies at contact quantum 250, its inspection snapshot still reports alive at 3 HP but the Archer facts already lose the ward and the party count already falls from 3 to 2. This was reproduced in the read model; record the corresponding visible playback journey after fixing it.

Create one coherent presentation-time read surface for the inspected facts. Include the facts actually displayed or used by their previews: member/party membership and survival, individual or shared health, ward/effect providers, conditions, and relevant position/exposure/terrain context. Ensure a party that dies later does not lose all labels before its displayed death. Keep the authoritative resolver and accepted state untouched by presentation playback.

If a particular fact cannot yet be reconstructed, explicitly present it as a final accepted result or omit its current-state claim. The visible contract must not pair an earlier living body with an unlabeled future outcome. Do not silently weaken the whole inspection experience to final-only data when the existing events can support the required moment.

Verify before/after the ward provider's death, full party elimination, a pooled-health maintenance event, pause/resume, final convergence and New match cleanup. Preserve deterministic replay and profile compatibility.

### B. Complete cache dependencies and label statistic scope — R6-04

The expanded text's cache key omits target-dependent preview values, condition changes and some source changes. Keep an explanation open while those facts change and ensure it refreshes. Derive a stable signature or model revision from all rendered facts/context; separate cheap anchor movement from text/DOM updates. Build detailed content only when needed.

In line-defense profiles, label a member's unqualified value as its **contribution**, not the applied protection of a particular hit. The review's example is contribution 1, actual front-line protection 3, and whole-party helper 4. An applied preview needs the real reached-line context. Do not change combat or replace the correct combat result with the helper's all-members total.

Target-specific previews must identify their target and relevant context. Prefer deliberate targeting/comparison context; when no useful target is chosen, showing the base attack and its conditions is preferable to implying a legal attack on an arbitrary remote enemy. This is a presentation choice, not a new targeting rule.

### C. Terrain content invalidates scenery — R6-05

The diorama key currently includes the terrain-cell count. Change detection must respond when an existing entry changes solid→empty or empty→solid. Use the relevant terrain revision/content or accepted change events, with bounded neighborhood invalidation. Preserve the distinction between planned work, running work and accepted geometry.

Stay in the same inspected territory while an already-recorded filled surface cube is excavated, then fill and excavate it again. The decorative mask, visible cut and real terrain/picking must agree at the accepted event. Qualify higher hill decorations under a lower selected cutaway, including +2 ground viewed at +1. Decoration must not create collision, cover, resources or changes to exposure.

## 3. Second slice: finish selection, inspection and reading space

### D. Consistent intent across controls — R6-02

Make public inspection from Parties & Cards preserve the friendly command selection and draft orders. Give ordinary own-party selection and intentional Inspect/Focus clear, consistent actions. An explicit inspection journey may move the camera and save a Return pose; ordinary selection must not silently pan/zoom. Keep the same enemy facts reachable by keyboard and touch.

Route visible Home and keyboard Home through the same app-level state transition. Start a fresh Return journey after Home. Correct cursor-directed zoom to honor the chosen party's actual height, and qualify hilltop, flyer and tunnel approaches. Preserve view yaw where practical, actual facing, the chosen layer and command selection.

### E. Protect the actual formation from its explanations — R6-01

Keep the successful compact role/HP annotations on the actual members. The expanded explanation must occupy a measured, stable adjacent space with a clear link to its member, rather than covering the formation. Measure its actual rectangle at the current text scale. Reserve the command group, relevant target cues and necessary navigation. Keep the collective summary reachable near viewport edges.

Collapse repeated rows such as identical all-face ward values into a concise explanation with a deliberate breakdown. Preserve actual exceptions and named sources. Honor the addendum's readable core type target; reflow/simplify or offer an intentional compact reading mode when space is insufficient. Do not solve density by shrinking text or spreading the real formation apart.

Passive labels continue to pass through wheel/pinch/camera gestures. Provide a deliberate keyboard/touch path to detailed member facts and definitions, with stable focus, dismissal and return. Preserve Card hover as an independent interaction; it must not require camera zoom. Required response controls and action reasons remain accessible.

Test four and nine members, one expanded, at 1280×720 and a larger viewport, every 45° bearing, lower pitch, viewport edges and actual 150%/200% browser or text scale. Record the scaling method; DPR/viewport emulation alone is not proof of text-only scaling. Verify body/label rectangles and readable captures, not only presence or text strings.

Also qualify general occlusion beyond the roof special case: an open pit at low pitch and a party behind raised terrain. A member whose body is hidden needs an intentional access route rather than a misleading floating label. Apply reduced-motion behavior consistently to camera transitions as well as scenery.

## 4. Third slice: finish one inhabited territory — R6-06

Once the corrected reading and terrain behavior work, improve the same one-territory study into a coherent Hapa scene. A weathered shrine courtyard is a useful working example, not required lore. Use the existing owned asset pipeline and choose materials that belong with the brushed-pixel sprites: ground composition, contact shadows, small near detail and one recognizable landmark with plausible side/back views.

At close zoom, reduce redundant bright brackets and large arrows while keeping one clear legal rim and a facing cue. Replace the stacked HILLTOP/HILL/RAMP signs with one primary height/status annotation and a smaller cue at the real ramp. Keep feet, routes, openings and actual members readable. Color-alignment light must remain distinct from ownership, legal movement and active effects.

Deliver a before/after pair at identical camera settings and one short continuous journey through overview → close inspection → member detail → orbit → return. Include a relevant terrain variation in the same visual family. Prove this sample before multiplying biome recipes. A new portal renderer, independent per-tile worlds, new game effects or an engine migration is outside this slice. Any required engine change follows the existing Lumina fork workflow; do not edit the vendor checkout in place.

## 5. Verification targets

| Journey or case | Required observation |
| --- | --- |
| Friendly command → enemy inspection → command again | Friendly selection and both queued orders survive; inspection/camera movement is deliberate. Repeat with keyboard. |
| Four/nine members, expanded detail, camera orbit and screen edges | Role/health stays readable; the expanded explanation leaves the formation visible; collective facts and command controls remain reachable. |
| Enlarged text and touch/keyboard equivalents | Actual detail is reachable without hover; focus/dismissal is stable; no clipped sole access to a fact or action. |
| Same target changes elevation/open sky while its preview is open | Power/range/blocked/context text refreshes without re-hover. Conditions and source changes also refresh. |
| Mage dies during default-profile playback | Before death: alive body/HP, original headcount and ward agree. After death: all change at the appropriate displayed event. |
| Pool maintenance and full party elimination | Pool, membership and label lifetime belong to the displayed moment; final facts match accepted state. |
| Existing solid override → dig → fill → dig | Scenic mask and real opening change together; same entry count cannot keep stale ground. |
| Raised ground/cutaway and low-angle occlusion | Scenery follows real height/visibility, openings remain visible, picking and rules are unchanged. |
| Visible Home / keyboard Home / Focus / Return | Equivalent transitions restore the correct immediately preceding pose. Elevated wheel approach stays anchored. |
| Existing rules and resource journeys | Funded endpoint quotes/validation, Card hover, Fire Pit/Mana, public intentions, Ready freeze, response windows, stale acknowledgments and replay/agreement remain correct. |

Run `npm run check` and the focused browser regressions needed for these cases. Extend the existing regression contract with a few meaningful assertions for the actual failures; do not add screenshot counts or tests that merely duplicate the implementation. Keep a targeted negative control where it establishes that a new check detects its defect.

Use the same bounded performance scenario before/after the label/cache and art work. Record source/dirty state, viewport, DPR, browser/OS, text scale and camera/layer. Measure interaction and text/layout work; state unavailable GPU or full-scene draw-call measurements explicitly. Vsync-limited frame intervals alone do not establish rendering headroom. Broaden profiling only to resolve a concrete issue.

## 6. Report and handoff

Publish the next unused implementation response, expected `docs/reviews/2026-11-23-ui-design-response-07.md`, using the existing template. For each R6 finding, state what was reproduced, what changed, exact commits, observed verification and any remaining limitation. If work completes on a later date, use that date while keeping the next response number.

Save bounded evidence under the corresponding dated response directory. Include exact source identity, tested profile, unchanged/moved engine pin, and a short ordinary player journey with real inputs. Attribute scripted/fixture evidence honestly. Include readable 1280×720 and enlarged-text captures for the dense layout; do not substitute a larger nine-member still as proof of the smaller viewport.

Update the review index's current-response entry and append evidence to the relevant Overwatch cards. Keep review 06 and its baseline evidence unchanged. Leave human acceptance unclaimed. Surface a blocker precisely if one remains; routine authorized implementation should continue without waiting for CJ to choose thresholds or individual CSS values.
