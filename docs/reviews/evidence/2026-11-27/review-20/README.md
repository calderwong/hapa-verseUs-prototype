# Review 20 evidence — 27 November 2026

Pinned application source: `da8c9e062984aa7ee870b61e771da38460f57854`. Review: [connectivity and delivery](../../../2026-11-27-connectivity-and-delivery-review-20.md).

## Source diagnostics

`source-register.json` records 20 retrieved files with Git blob IDs, SHA-256 and bytes. `review-probe.mjs` checks the source identities it executes and runs eight controlled groups: six repaired boundaries and two remaining bugs. Actual encoding and Ed25519 signatures are used; persistence, Hypercore and asynchronous match initialization are controlled fixtures.

From a checkout containing these evidence files, pass a checkout of the reviewed application source:

```sh
node docs/reviews/evidence/2026-11-27/review-20/review-probe.mjs /path/to/reviewed-versus-checkout
```

The saved `review-probe-results.json` is the actual review run. Exit zero means the diagnostic assertions, including the two expected failures, reproduced. It is not a product acceptance pass and must not be reused as a green regression after code changes.

## Delivery and visual observations

`delivery-observations.json` retains a redacted summary of release metadata, the verified Windows workflow evidence ZIP, identity/result/reopen and worker-start JSON, plus exact limits. The reviewer downloaded/read existing artifacts; no new Windows execution is claimed.

`browser-red-home.jpg` is a fresh screenshot of the live local browser preview. Its source commit is unversioned; it proves visible pose-art Red in that browser session only. The same session moved from Tick 1 through one Ready/resolving transition to Tick 2 planning. It is not an installed, mesh-geometry, animation-performance or WAN witness.

The committed response-20 screenshots were inspected separately: browser Home has Red; the installed-Mac image has an empty chair. References remain in the review. No owner secrets, invitation capabilities, private media stores or raw download credentials are included here.
