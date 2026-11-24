# Review 09 evidence

**24 November 2026.** Supports [Review 09](../../../2026-11-24-ui-design-review-09.md). Reviewed snapshot: `2d8a5ff2a1c5686101b3dc3c2c8e0cee33c6df4f`; implementation `44bf90b706a4e55dd740fd3276f077aac3ea5aa1`; default `hapa_open_10x9_v3_07`.

## Source identity

[source-manifest.json](source-manifest.json) lists the 116 source/document files verified as Git blobs against the exact reviewed tree. This is an assembled review snapshot, not a claim that every repository file was downloaded or semantically audited. The engine gitlink is `ba838cca09ba43afceda0452b63d28df4cbf7f72`, unchanged. No game source was edited by the reviewer.

## Independent checks

| Evidence | Execution and result |
| --- | --- |
| [movement-tests.txt](movement-tests.txt) | `node --test tests/hapa/absorption.test.js tests/hapa/center-travel.test.js`: 14 passed, 0 failed, 0 skipped, exit 0. Exercises actual rules/session/replay code. |
| Presentation contract tests | `node --test tests/hapa/presentation-contracts.test.js`: 2 passed, exit 0. Reported from the independent reviewer run; raw console output was not retained separately. |
| [flow-probe.mjs](flow-probe.mjs), [flow-results.json](flow-results.json) | Actual-source launch expression and real Peer methods, with in-memory publication and preverified inbox bodies. Five peer sequences, agreement freeze/duplicate guards and the conflicting-preset launch case pass. No network or signature-verification claim. |
| [presentation-probe.mjs](presentation-probe.mjs), [presentation-results.json](presentation-results.json) | Exact MemberLabels methods with minimal DOM stubs, plus the exact changed pointer-leave handler extracted from app.js. Five hidden-member/current-fact/focus checks pass. Not a browser or device test. |
| [live-observations.md](live-observations.md) | Fresh temporary local A-human/B-bot opening: funding, one Ready, Castle/Pawn absorption, inspection/return, continued travel, arrival, voluntary History. Effective v3_07 observed; running source revision not exposed. |

The probes were executed from the verified review snapshot. For publication their import paths were relocated to the repository layout, and the flow probe's automatic write to its committed result file was removed. The assertions are unchanged. Both published scripts print JSON to stdout and do not overwrite these historical results. Syntax and relocated paths were checked as part of packaging; this did not trigger another gameplay qualification run.

To reproduce the targeted probes from a checkout of the reviewed code:

```bash
node --test tests/hapa/absorption.test.js tests/hapa/center-travel.test.js
node --test tests/hapa/presentation-contracts.test.js
node docs/reviews/evidence/2026-11-24/review-09/flow-probe.mjs
node docs/reviews/evidence/2026-11-24/review-09/presentation-probe.mjs
```

These are historical evidence probes, not new permanent release gates. Their `snapshot` output identifies the reviewed baseline; it does not detect the current checkout. If running on later code, report the actual revision alongside the output. Do not overwrite this evidence or rerun unchanged checks merely to prepare a human playtest.

## Submitted evidence inspected and reused

[submitted-image-manifest.json](submitted-image-manifest.json) records verified Git blobs for three coding-agent screenshots. They already exist in the repository and are linked here rather than duplicated:

- [Final roofed-formation fallback explanation](../response-10/regress/2026-11-24T19-45-16-057Z-44bf90b/z17-roofed-fallback.jpg): protection definition is available despite the absence of on-body labels.
- [Knight arrival-facing toast](../response-10/stills/01-knight-arrival-toast.jpg): full feedback text is readable above the world counter.
- [Navigator and basin after positive Burn](../response-10/stills/02-navigator-fire-pit-after-burn.jpg): 2 Red available this Tick; the fixture is explicitly labelled.

All three are 1280×720 submitted captures, not fresh reviewer images. [submitted-browser-extract.json](submitted-browser-extract.json) retains the relevant final report identity and z17 assertions, marked as reported/not rerun. Full sources remain under response 10, including its [final focused report](../response-10/regress/2026-11-24T19-45-16-057Z-44bf90b/report.json) and [stills log](../response-10/stills/stills-log.json).

[Response 10](../../../2026-11-24-ui-design-response-10.md) reports the full `npm run check` at `44bf90b` (140/140 tests, smoke, real peer transport and build), the 451/453 initial browser run, and 70/70 after the two targeted corrections. The reviewer reused those records and did not rerun the full suite or browser matrix. The real transport smoke does not exercise edited peer plans.

## Limits and stopping point

The bounded review closes R8-01–R8-06 with the evidence levels stated in Review 09. It makes no claim about touch hardware, high-DPI coverage, every historic replay, all combat combinations, live transport edits, full-match completion, full MVP completion, or CJ acceptance. No current Overwatch read or mutation was performed by the reviewer. R9-01 is a nonblocking wording observation with a live example and direct source confirmation; no additional test was needed to establish what the summary counts.
