# Review 07 evidence

Reviewed repository revision: `4fd5eaf9c0f9750242d9d3d013ac36801d96a92f`; implementation `b3a44af90704bc0a0871cdecd56a9533e8894006`; engine `ba838cca09ba43afceda0452b63d28df4cbf7f72`.

## What was independently checked

- Exact Git blob hashes for 94 selected source, fixture, test and requirement/review files: [source-files.json](source-files.json).
- Thirteen existing inspection/moment tests passed: `node --test tests/hapa/inspection-moment.test.js tests/hapa/inspection.test.js`. This is not a full `npm run check`, peer run or browser regression.
- [movement-probe.mjs](movement-probe.mjs) and [movement-results.json](movement-results.json): ordinary-opening half-step with 5.5 Supply, actual blocking bodies, next-Tick nonprogress, two clear-diagonal controls and three blocked recovery attempts. Ordinary opening and clear controls verified their replays.
- [flow-mana-probe.mjs](flow-mana-probe.mjs) and [flow-mana-results.json](flow-mana-results.json): same-Tick burn/cast with replay; next-boundary expiry; invalid dependencies/duplicate burn; the existing agreement's repeated Ready requirement.
- [overlay-probe.mjs](overlay-probe.mjs) and [overlay-results.json](overlay-results.json): actual `_avoidRects()` method with synthetic rectangles. Confirms drawer reservations are absent; not a live screenshot reproduction.

The probes are retained as baseline diagnostics. They intentionally describe/assert the old behavior, including known failures. Run them against the reviewed revision, from repository root:

```bash
node docs/reviews/evidence/2026-11-23/review-07/movement-probe.mjs
node docs/reviews/evidence/2026-11-23/review-07/flow-mana-probe.mjs
node docs/reviews/evidence/2026-11-23/review-07/overlay-probe.mjs
```

They emit JSON to stdout and do not edit game files. Do not change their expectations to fabricate historical evidence. Corrected implementation acceptance belongs in the normal tests/response.

## Supplied screenshots

CJ attached three captures named `Screenshot 2026-11-23 at 4.15.01 PM.png`, `4.17.46 PM.png`, and `4.20.16 PM.png` (the uploaded names use a narrow space before PM). They show, respectively, the forced acknowledgment, the halfway Queen with 5.5 Supply, and close member reading underneath Orders. All visible launch URLs explicitly use `a=human&b=human&seed=1`.

[supplied-captures.json](supplied-captures.json) records original filenames, sizes, dimensions and SHA-256 hashes. The originals remain in CJ's chat attachments; they are not duplicated here with their surrounding desktop/chat content. The images do not establish the running commit, browser CSS viewport, device-pixel ratio or any click sequence beyond what is visible.

## Limits and attribution

No fresh live browser session was run by this review. No current Mac worktree, ignored art, private runtime store or current Overwatch state was read. Response 07's 114/114 final checks and 345/345 browser assertions are the implementer's recorded results, not independently rerun counts. Review probes use the exact current source in a separate snapshot; they do not alter the implementation or constitute CJ acceptance.
