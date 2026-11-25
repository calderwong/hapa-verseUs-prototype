# Review 13 evidence

**Source baseline:** `calderwong/hapa-verseUs-prototype` main `e04286188e13800e588557bd5cb53a9b0e3724c0`, implementation `c42649b7127e49addba68a82101dff5046913f74`, root tree `8ae32b344284124a8c1ccaec83f02fa8058d07d9`. Engine remains `ba838cca09ba43afceda0452b63d28df4cbf7f72`. Reviewed 25 November 2026, America/Los_Angeles.

Read [Review 13](../../../2026-11-25-ui-design-review-13.md), [Assignment 14](../../../2026-11-25-next-agent-assignment-14.md), and the author's [Response 13](../../../2026-11-25-ui-design-response-13.md) together. This folder contains text evidence and diagnostics, not production changes.

## Evidence levels

| Evidence | Method and practical limit |
| --- | --- |
| [Source register](source-register.json) | Fetched source bytes were hashed against the pinned Git tree. The register establishes provenance, not an independent exhaustive audit of every line. |
| [Response identity check](response-13-identity-check.json) | All 11 source SHA-256 entries reported in Response 13 were compared with the fetched files. This does not identify the source held in a running local process. |
| [Existing soundtrack tests](soundtrack-test-results.txt) | The supplied three soundtrack tests passed independently once. Audio, fetch and storage are fixtures; the broader 155-test `npm run check` remains the author's submitted result. |
| [Transport diagnostic](transport-state-probe.mjs) / [result](transport-state-result.json) | Actual Soundtrack code with controlled audio/fetch/storage. Demonstrates two-press failed/finished Play, finished playback at 99.5/100 seconds, and Previous choosing first-heard order. No real network, owner calls or audible playback. |
| [Resume/Pause diagnostic](resume-pause-race-probe.mjs) / [result](resume-pause-race-result.json) | Actual Soundtrack and MusicSignal with a deferred context fixture. Demonstrates stale `audio.play()` after Pause. This is a controlled schedule, not a live browser reproduction. |
| [Live observations](live-observations.md) | Fresh local match, Play, saved replay, Return, desktop/orbit and compact panel checks through rendered UI. Running commit was not exposed. No fresh local screenshots are included in this publication. |

The review also inspected the author's source/evidence for scene construction and ownership. Three existing repository images (Home/Subtle, low orbit and -3 layer selection) were reviewed for scene context. Selecting the -3 layer over a mostly flat board does not prove a completed deep excavation. The report's Off/Expressive frame sample, final energy sample and approximately 1,100-geometries-per-restart result are labeled submitted measurements; they were not rerun as a broad benchmark.

## Run the focused diagnostics

From a checkout of the reviewed baseline, with a Node version supporting the repository:

```bash
node --test tests/hapa/soundtrack.test.js
node docs/reviews/evidence/2026-11-25/review-13/transport-state-probe.mjs .
node --experimental-vm-modules docs/reviews/evidence/2026-11-25/review-13/resume-pause-race-probe.mjs .
```

These probes print diagnostic JSON. A successful process exit means the diagnostic ran, **not that the product behavior passed**. The checked-in JSON records the failing baseline. The scripts record the actual source blob identities; their `reviewBaselineCommit` field is historical metadata. On a later checkout, compare the recorded source hashes and interpret the observed behavior against the intended contract. Do not replace the historical result files to make a later response look green.

The transport result's absolute source path identifies the temporary reviewer fixture checkout. It is not a required local path. Both scripts accept the repository root as an argument. The transport probe performed 21 intercepted fixture fetches and zero network requests; the race probe rejects unexpected network access.

## Verification discipline

The review ran the supplied focused tests once and each new diagnostic once. No production implementation, full regression campaign, retention write, message to Red or match progression was performed by the reviewer. Source inspection identified browser/context activation failure being routed to generic skip; that failure was not separately triggered in the live owner environment.

Use Assignment 14's three focused transport proof families and one combined compact-layout/restart/art journey. Preserve the required integrated final check. Carry evidence limitations honestly; do not expand into the historical gameplay or owner matrix without a changed dependency or concrete remaining risk.

Overwatch remains canonical task state. The reviewer did not inspect or append the current board in this pass. Response 13 contains its author's board receipt and describes its own handoff limits; it does not establish a reviewer board update or CJ acceptance.
