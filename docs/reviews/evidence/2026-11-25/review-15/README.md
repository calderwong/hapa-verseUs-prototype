# Review 15 evidence

**Reviewed main:** `73c62bd539e76c19c2c31c50962028f04fdf1788`; implementation `da76b0bb04ab7b8b6af6b25e6a0a8aafcf387b42`; tree `f41b6500233f958b023c94715d751fe65077ef41`. Engine remains `ba838cca09ba43afceda0452b63d28df4cbf7f72`. Review date: 25 November 2026, America/Los_Angeles.

Read [Review 15](../../../2026-11-25-ui-design-review-15.md) and [Response 15](../../../2026-11-25-ui-design-response-15.md). Both selected Assignment 15 findings close in the stated scope; the next action is CJ's playtest, not another automatic coding assignment.

| Evidence | Meaning and limits |
| --- | --- |
| [Source register](source-register.json) | Current fetched/reused file bytes match the pinned Git tree. Unchanged dependency blobs identify the earlier evidence retained. This is provenance, not an exhaustive audit. |
| [Response identity check](response-15-identity-check.json) | All three reported production-source SHA-256 values match the fetched files. It does not identify source held by the live browser/process. |
| [Independent helper result](helper-lifecycle-result.json) | One run of the author's focused helper-lifecycle probe against actual current source. Active and expired effects release all cached textures once; repeated teardown is harmless; shared Sprite quad is untouched. Fixtures, no renderer/network/owner calls. |
| [Live observations](live-observations.md) | Independent fresh local-browser reproduction of desktop→compact reconciliation, roster opening, reachable transport, state preservation and desktop coexistence. |
| [Author's journey](../response-15/layout-transition-journey.json) and [check summary](../response-15/npm-check-summary.txt) | Submitted evidence. The full integrated check, short post-effect restart measurements and required-decision source check were not independently repeated as broad campaigns. |

## Focused lifecycle reproduction

The probe already published with the implementation was read and run once:

```bash
node --experimental-vm-modules docs/reviews/evidence/2026-11-25/response-15/helper-lifecycle-probe.mjs .
```

Use a checkout containing the reviewed source. The probe loads actual HitFX, BoardView disposal and the resource collector, with Three/canvas and unrelated imports supplied as fixtures. It preserves independent texture handles before disposal because the corrected helper clears its own cache references. The original Review 14 probe/result were not rewritten.

The independent run exited 0 with `pass: true` and zero network requests. Both the expired-effect and still-running-effect cases dispose burst/rune/arrow exactly once; both repeated board/helper disposal return null. The shared Sprite quad receives zero disposal calls. The emitted source hashes identify the exact files executed.

## Retained evidence and limits

Only three production files changed. Transport, player/deck, social Table/opponent UI, scenery, resource collector and soundtrack tests retain the previous reviewed blobs. Review 14's six soundtrack tests and corrected transport diagnostics are reused, not represented as newly executed.

Response 15 reports the required integrated check passing 158 tests plus smoke/peer/build. Its post-effect renderer series has small residual differences that were not traced individually; the suggestion that shared-cache warming explains them remains an inference. No universal GPU plateau or CPU-heap stability is claimed here.

The fresh browser did not expose its running Git commit. The selected layout cases were checked at 1440×900 and 700×900, with center hit tests and real Pause/Play clicks. Required-decision layout remains source-qualified, not newly exercised live. The scope is sufficient to close the selected findings without a device matrix, performance campaign or repeated historical suite.

No fresh local screenshot is uploaded in this text publication. No Keep/save operation, Ready action or conversation message was submitted in the live review. The temporary draft was cleared, viewport overrides reset, and the separate review tab closed. Current Overwatch state and CJ's Done/art acceptance were not changed by the reviewer.
