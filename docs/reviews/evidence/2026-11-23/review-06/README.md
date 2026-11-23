# Review 06 evidence

**23 November 2026.** Supports [review 06](../../../2026-11-23-ui-design-review-06.md) and [assignment 07](../../../2026-11-23-next-agent-assignment-07.md). These files preserve the reviewed baseline, not current implementation status.

## Source identity

- Repository: `calderwong/hapa-verseUs-prototype`.
- Main/report revision: `53481b90f0909f16108b30b163acb69c8649d6ea`.
- Implementation revision: `95c88bf3dbb412df8388f99391ed293d5ae6ed44`.
- Engine gitlink: `ba838cca09ba43afceda0452b63d28df4cbf7f72`, unchanged.
- Default profile: `hapa_open_10x9_v3_02`.
- [Source manifest](source-files.json): 83 extracted text files verified against the recursive remote tree's Git blob hashes. Extraction was initialized as an isolated Git worktree for the repository-boundary test; no local commit was represented as the reviewed source identity.

## Independent headless checks

[Command and verification metadata](verification.json) records the exact 17 test files. [Complete output](headless-tests.txt) records **104 passed, 0 failed**, about 20.7 seconds.

The four cases in `tests/hapa/protocol.test.js` were not executed in this environment because `hypercore-crypto` was unavailable. This is not a claim that `npm run check`, build, smoke or peers ran here. The implementer's response separately reports its full 108-test check and related commands.

## Targeted diagnostic reproductions

Run from a checked-out repository or supply its root explicitly:

```sh
node docs/reviews/evidence/2026-11-23/review-06/inspection-terrain-probe.mjs /path/to/hapa-verseUs-prototype
node docs/reviews/evidence/2026-11-23/review-06/interaction-probe.mjs /path/to/hapa-verseUs-prototype
```

Both print JSON to stdout. Save new output outside this historical evidence directory. The probes assert behavior of the reviewed baseline, including defects. They are **diagnostic evidence, not a proposed regression suite**: fixing the defect should invalidate the corresponding old expectation.

| Probe | Method and result | Scope limit |
| --- | --- | --- |
| Default-profile playback ward/headcount | A legal funded `runTick` kills the front Mage at first contact, quantum 250. Before that event is displayed, `healthAt` reports the Mage alive at 3 HP while the Archer ward is already 0 instead of 1 and party count 2 instead of 3. | Actual rules/read-model calls, not a recorded browser fight. |
| Pooled health | Real `applyCardHit` produces a 15→13 shared-pool change and maintenance casualty; zero shown events still exposes the final pool/headcount. | Existing compatibility profile, not default health semantics. |
| Line protection scope | Actual exchanges apply front-line protection 3; a member's own contribution is 1; the unused all-member helper gives 4. | Demonstrates scope distinction; does not ask to change combat. |
| Existing-cell excavation | Real work validation/start/completion changes an existing cube solid→empty without changing count. Actual `TerritoryDiorama.sync` does not rebuild its closed-cell mask. | Geometry constructors are stubbed. Stale input is reproduced; visual obstruction is inferred from the source's opaque decal. |
| Raised-ground cutaway | Actual diorama update leaves decoration opacity 1 at cutaway +1 while a +2 hill is the selected context. | Source-method visibility mismatch; rendered extent not measured. |
| Navigator enemy activation | Actual row callback replaces selected A with B and invokes camera focus. | Source-method probe plus separate independent live reproduction below. |
| Stale expanded detail | Actual text-builder/cache methods retain old rendered detail despite changed same-target preview output. | The preview results are substituted to isolate invalidation; it is not a real combat transition. |
| Zoom at height | Actual camera zoom ignores target y; an isolated representative projection demonstrates vertical drift for elevated/underground points. | Projection example, not live-game pixel measurements. |
| Summary containment | Actual label update places an unhidden summary at x=980 in a 960px host. | Minimal DOM double; demonstrates absent bounds handling, not measured font rectangles. |
| Visible Home state | Actual button callback leaves old inspection/Return state in place, unlike the keyboard path. | Source-method reproduction. |

Files: [inspection/terrain probe](inspection-terrain-probe.mjs), [its results](inspection-terrain-results.json), [interaction probe](interaction-probe.mjs), [its results](interaction-results.json).

## Independent live UI observations

The reviewer reached the connected browser and opened a fresh local match at `http://127.0.0.1:5199/versus.html?autostart=1&a=human&b=human&seed=1`. The menu identified `hapa_open_10x9_v3_02`. **The app did not expose its commit or dirty-tree state.** These captures establish what was visible in that running app; they are not a byte-level verification of the reviewed source.

The session initially used the normal 2223×1076 viewport, then an explicit **1280×720 CSS-pixel** override for comparable close-inspection captures. Browser/OS version, DPR and independent text scaling were not recorded in this live session; no claim of enlarged-text qualification is made. The viewport override was reset afterward. No Ready, concession or combat resolution was submitted.

1. Ordinary board selection of the friendly Bishop at R1C3 exposed the compact command group and inactive-column reason, without the old full composition document.
2. Intentional Inspect framed the four actual members. Once the camera settled, role and HP labels were visible.
3. Hovering the center Bishop displayed an expanded explanation over neighboring member labels.
4. With the friendly Bishop selected, activating B's Bishop at R10C7 through Parties & Cards changed the command group to B's Bishop and panned the camera. Closing the navigator did not restore friendly selection.

| Capture | What it demonstrates |
| --- | --- |
| [Compact members](live-bishop-compact.jpg) | The successful compact role/health layer and separate friendly command group. |
| [Expanded member](live-bishop-expanded.jpg) | A full explanation occupying neighboring member/label space at 1280×720. |
| [Navigator result](live-navigator-replaces-selection.jpg) | B's Bishop now occupies the command group after opponent inspection. |

The files are the original tool-returned JPEG bytes, preserved without visual edits. The tool's content wrapper labeled them PNG; the actual JPEG signature/decoder determined the correct `.jpg` extension.

## Reviewed implementer evidence

Seven checked-in JPGs were downloaded and their bytes verified against remote blob hashes; the [capture manifest](supplied-captures.json) lists them. The compact/expanded nine-member stills are **1600×1000**. The four-member default/close/orbit135, hill and tunnel stills are **1280×720**. The larger nine-member still does not establish smaller-viewport density.

The supplied [normal regression report](../response-06/regress/after-95c88bf/report.json) records 18 checks, 270 assertions, zero failures at clean `95c88bf`. The [sabotage report](../response-06/regress/sabotage-95c88bf/report.json) records two intended assertion failures. These were read, not rerun in the review environment.

The [before](../response-06/perf/before-b747d11.json) and [after](../response-06/perf/after-95c88bf.json) performance JSONs were read. Their frame intervals are vsync-limited, and their recorded call count describes the final postprocess pass rather than full-scene draw calls. No independent GPU/headroom acceptance is claimed.

Journey scripts/logs and video paths were inventoried. Binary video retrieval was unavailable through this review connector; this review does not claim to have watched the supplied recordings. No complete live 360° orbit, pause/resume fight, touch run, assistive-technology session or 150%/200% text-scale run was independently performed here. The report names these limitations explicitly so the next agent can supply the right evidence.

## Preservation and ownership

Only review/handoff documents and their evidence are published by this review. Production source, rules, profile values and the engine pin are unchanged. Overwatch remains the task system; its current state was not independently read or updated here. CJ acceptance is not recorded by this evidence package.
