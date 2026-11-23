# Review 04 evidence and design proposal

This directory supports [review 04](../../../2026-11-22-ui-design-review-04.md) and the [human-feedback addendum](../../../../requirements/2026-11-22-human-feedback-addendum-01.md). User-facing date: 22 November 2026, America/Los_Angeles.

## Repository/check-in boundary

At discovery, the connected GitHub repository `calderwong/hapa-verseUs-prototype` had `main` at `a388bcf9b56fb873eec5862d32fc5dbaaeb092d0`, only that branch, and no open pull requests. No response 05 or newer implementation was pushed. That head adds review documents to implementation `164b8dfe46d2b6b8ec0975cc8f53ea5428770230`; engine gitlink remains `ba838cca09ba43afceda0452b63d28df4cbf7f72`.

The local source snapshot used for analysis was already reconstructed and verified in review 03. Its implementation file identities were compared with the current head tree. This review did not inspect unpublished local work, rerun the unchanged 82-test result, start a fresh browser, measure GPU performance or fetch current Overwatch task state. Prior results retain their original scope. See [review 03 evidence](../review-03/README.md).

## Current movement-policy observation

[current-policy-probe.mjs](current-policy-probe.mjs) imports the actual scenario, route, economy and command-validation modules, with relevant file blobs pinned. [current-policy-observation.json](current-policy-observation.json) records three cases:

- Castle with zero Supply can store a four-step destination.
- Castle with two Supply can store that four-step destination.
- Knight with two Supply can store its three-step L destination.

These are explicitly prepared diagnostic states, not ordinary play traces or browser observations. They establish why CJ's requested endpoint cap is a new policy rather than an old-spec defect: v3 permits a farther destination to persist while travel pauses for Supply.

**A zero exit means the historical behavior was reproduced.** This is not a permanent acceptance test for the new policy. It rejects changed source blobs deliberately. To run it against a separate pinned checkout:

```bash
node docs/reviews/evidence/2026-11-22/review-04/current-policy-probe.mjs /path/to/pinned-checkout
```

Without an argument, it uses the repository root five directories above the script. Preserve active local work when obtaining a historical checkout. The local agent should add new-profile regression tests that assert the newly selected funded-endpoint behavior while keeping appropriate legacy replay coverage.

## Layout schematic

[board-contextual-ui.svg](board-contextual-ui.svg) is an original vector **proposal**, not a runtime screenshot or finished game art. It shows quiet default play, anchored Card inspection and party/destination inspection. Counts use placeholders. Bank families and party bodies are simplified for the diagram; the implementation must include the complete actual bank layout and truthful member composition.

The SVG was rendered to a temporary PNG and visually inspected for layout/readability. The durable source is the SVG here. Do not cite it as evidence that the interaction is implemented, that a depicted movement is legal, or that any performance target was reached.

## External implementation references

The review consulted primary accessibility/browser references for the narrow hover/focus distinction:

- [W3C content on hover or focus](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html): dismissible, hoverable and persistent content.
- [W3C tooltip pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/): definitions versus focusable interactive views; the page labels its pattern as work in progress.
- [MDN Popover API usage](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using): a possible browser primitive, not a mandated dependency or a substitute for world-anchor, identity and focus management.

The specific Hapa timing, placement, visual treatments and workflow defaults are design proposals in the addendum. They are not values mandated by those sources.

[review-verification.json](review-verification.json) records source scope, observations and artifact identity. This publication changes notes/specification addenda and review evidence only; it implements no game change and records no CJ Done acceptance.
