# Review 21 evidence

Reviewed application head: `d0be02d0e4a7b6f6132ce499bf0d45d82b30327f`, 27 November 2026. See [Review 21](../../../2026-11-27-lifecycle-and-delivery-review-21.md) and [Assignment 23](../../../2026-11-27-next-agent-assignment-23.md).

## Contents and evidence level

- `source-register.json`: 20 retrieved application/test/review blobs, verified against the reviewed tree, with byte sizes and SHA-256.
- `review-probe.mjs` / `review-probe-results.json`: seven exact-source diagnostic groups. Four corrected cases, two remaining runtime findings and one qualified dynamic-component finding.
- `primary-source-register.json`: pinned HyperDHT/Hyperswarm/blind-relay references for the relay experiment. The OPEN/direct explanation is a hypothesis requiring native instrumentation.
- `root-source-register.json`: exact files read for release, workflow, current-pointer and visual review.
- `delivery-observations.json`: immutable artifact/run identities and explicit evidence limits. Windows workflow archive was independently downloaded and SHA-256 checked; actual mandatory JSON reports were inspected.
- `browser-red-home.jpg`: fresh unversioned local-browser screenshot. No inspected local source/build identity ties it to a release.

## Reproduce the source diagnostic

Use an isolated checkout of the **reviewed** commit, preserving any active worktree. With Node, run this archived diagnostic against that checkout:

```bash
node /path/to/review-21/review-probe.mjs /path/to/checkout-at-d0be02d
```

The diagnostic checks the loaded files' Git blob identities. It executes actual source methods, canonicalization and Ed25519 signing/verification. Storage, transport, Hypercore and awaited match initialization are controlled fixtures. It does not install dependencies or execute a native/public network. Output is written beside the diagnostic; keep a copy of this archived result when experimenting. It intentionally reproduces the reported bugs, so **exit 0 is not product acceptance**. Use new implementation regressions to demonstrate fixes on later source; do not change the archived provenance to make it run against modified files.

The reconnect fixture includes the counterpart's exact signed STARTED acceptance and activation paths. It establishes an actionable premature message, not a native reconnection trace or observed game loss. The archive defect is a configured extension path; bundled defaults have no archives. Live relay-key replacement is not exposed by the current packaged UI.

## Delivery scope

The Windows run uses two instances on one GitHub-hosted Windows VM over public DHT. It does not establish independent networks, consumer SmartScreen/firewall handling, or human acceptance. Mac reports and images were inspected, not rerun by the reviewer. The live browser checks local play only; still images do not prove animation smoothness or reduced-motion behavior. The reviewer did not update the local Overwatch board.

Historical implementation evidence is retained under `response-22/`; this packet does not rewrite it or mark its entire conformance catalog passed.
