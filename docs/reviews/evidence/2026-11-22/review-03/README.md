# Review 03 evidence — 22 November 2026

This directory supports [UI/design review 03](../../../2026-11-22-ui-design-review-03.md). It records independent source/test work and an audit of already committed implementation evidence. It does not contain a new rendered-browser session or CJ acceptance.

## Source identity

- Prototype: `calderwong/hapa-verseUs-prototype`, commit **`164b8dfe46d2b6b8ec0975cc8f53ea5428770230`**.
- Engine gitlink: **`ba838cca09ba43afceda0452b63d28df4cbf7f72`**.
- Controller Git blob: **`a95383d275d7133e16022767c97227174241355a`**.
- All 107 non-image file blobs in the pinned tree were reconstructed through repository reads and verified against Git blob hashes. This was a review snapshot, not CJ's working checkout.

The [machine-readable verification record](review-verification.json) lists scope, limitations and hashes of the thirteen inspected committed screenshots. Images remain in their original response 03/04 locations; no copies or new image-generation work were needed. The `c2-after-spam.jpg` screenshot is post-resolution aftermath, not the pending response sheet.

## Existing tests rerun independently

[test-command.json](test-command.json) records the exact Node command, runtime and excluded protocol file. [rules-and-playback-tests.log](rules-and-playback-tests.log) contains the result: **82 passed, zero failed**, across thirteen existing test files.

The review environment lacked the full dependencies/vendor checkout required to rerun the four protocol tests and complete `npm run check`. Minimal local Git metadata was initialized solely for the existing Git-ignore boundary check. Do not conflate these 82 passing tests with response 04's separately reported 86-test full check.

## Historical controller/rules reproductions

**These scripts intentionally reproduce defects in the pinned source. A successful exit means the historical defect was reproduced, not that the game passed an acceptance test.** They pin the exact controller blob and refuse different source bytes. Do not add them as permanent passing regression tests. Corrected-behavior tests belong in the implementation's normal regression coverage.

Each script extracts current controller methods without rewriting their algorithm, imports actual rules/session modules and uses minimal UI/render adapters. Neither exercises browser rendering, native keyboard traversal, WebGL, or performance.

### Mixed-color response payment

[response-payment-probe.mjs](response-payment-probe.mjs) creates a legal diagnostic derivative through the content adapter, validates it, asks the real response panel for its offered action and submits that answer to actual resolution. [response-payment-result.json](response-payment-result.json) records:

- Red 1 + Blue 1 paid by Rainbow 1: UI enables the response; authoritative payment fails; rejection becomes Pass and incoming damage resolves.
- The same cost with Rainbow 2: counter succeeds.
- Original Blue 2 cost with Blue 2 available: counter succeeds.

### Match replacement while a response is pending

[new-match-lifecycle-probe.mjs](new-match-lifecycle-probe.mjs) executes the same `startMatch` controller reached by the visible New match/setup route, with scene/camera/asset adapters stubbed. [new-match-lifecycle-result.json](new-match-lifecycle-result.json) records:

- Old response fixture waits at Tick 9.
- New terrain fixture opens at Tick 5, but the old choice remains and blocks editing.
- Completing old choices writes old spell events and a Tick 9 replay record into the new session.
- Actual replay verification fails: `tick numbering differs (5)`.

### Running either reproduction

In a checkout with the reviewed controller bytes and these evidence files:

```bash
node docs/reviews/evidence/2026-11-22/review-03/response-payment-probe.mjs
node docs/reviews/evidence/2026-11-22/review-03/new-match-lifecycle-probe.mjs
```

Both scripts also accept an explicit path to a separate pinned review checkout. Use an isolated checkout/worktree if current implementation has advanced; preserve active local work. The default repository root is five directories above the script.

The modal-focus issue has no browser reproduction here. Its evidence is the source path plus the standard browser interaction semantics described in review 03. The local acceptance task must use real Tab/Shift+Tab and native activation.

## Audit of the implementation author's committed browser results

[committed-regression-summary.json](committed-regression-summary.json) extracts case counts, provenance and keyboard navigation steps from the response 04 reports. The after run has **eight journey groups, 282 assertions, zero failures**. The deliberate-failure run has **25 assertions with the two intended failures**. These reports were inspected, not rerun here.

Keep these qualifications with the results:

- 153 after assertions are repeated layout checks; the count does not measure independent player journeys.
- The before report's runtime-engine identity repeats the outer prototype SHA because Git searched upward from a copied engine folder. Treat that runtime identity as unverified; the parent gitlink is a separate fact. Preserve the original report and append a correction in the next implementation response.
- C2 chooses Pass; it does not validate a paid counter. C8 checks matching resource strings without binding the expectation to the correct Card/seat/slot or ability. Review 03 gives bounded improvements.
- C5 demonstrates a valid keyboard route but includes programmatic blur resets and long Tab sequences. The viewport/DPR zoom emulations do not establish independent text scaling; the 200% capture is a disclosed clipping observation.

The review publication adds documentation and evidence only. It changes no game behavior, engine pin or canonical task status.
