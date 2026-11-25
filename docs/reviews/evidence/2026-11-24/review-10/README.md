# Review 10 evidence

**Reviewed implementation:** calderwong/hapa-verseUs-prototype at 3b812f1877c3d00b080268e57fce5137e574669d.  
**Local review date:** 24 November 2026, America/Los_Angeles. Some diagnostic timestamps are 25 November UTC.  
**Purpose:** Support [Review 10](../../../2026-11-24-ui-design-review-10.md) and the next bounded handoff. This folder is evidence, not task-state authority.

## Files and provenance

| File | What it establishes |
| --- | --- |
| [source-register.json](source-register.json) | 39 exact source/document/dependency blobs verified against the pinned Git tree; primary URLs and hashes |
| [live-layout.json](live-layout.json) | Raw read-only DOM geometry from the temporary local match: viewport, canvas sizes and dock/portrait/music bounds |
| [controller-probe-results.json](controller-probe-results.json) | Actual pinned-controller/rules results with stubbed fetch: joint funding, response digest and malformed proposal witnesses |
| [controller-probe.mjs](controller-probe.mjs) | Packaged diagnostic source for those witnesses, with imports adapted to a repository checkout and actual worktree revision reporting |
| [model-decider-test-results.txt](model-decider-test-results.txt) | Independent run of the existing six model-decider tests: six passed, zero failed |

The diagnostic results were produced by the original script against exact copies of the reviewed implementation. The packaged script changes import locations and adds worktree revision/dirty-state reporting; it is not a claim that the repackaged copy was a second executed probe. Its syntax and relative source paths were checked when packaging.

## Browser observation

The existing user match was read without changing its controls. A separate temporary tab opened the current local Versus setup and started a fresh match using A human, B heuristic, seed 1, hapa_open_10x9_v3_07, Red enabled and model assistance off.

At Home, Red appeared in a small upper-right bordered portrait card, with a music strip beneath. The viewport was 2838×1020; the main canvas was 2828×928; the Avatar's intrinsic canvas was 673×841 but the visible content measured 62×78 inside a 64×80 portrait box. The dock width was 340.

One 45-degree camera control step rotated the board while the Avatar/music dock stayed in the same screen corner. Home was restored and the temporary tab closed. No Ready, music Keep, direct question or Sound enable action was performed. No gameplay progression, audible voice or listening outcome is claimed from this inspection.

The live UI did not expose a running source commit. These observations establish placement and layout, not exact source equality. The missing .world selector in the raw geometry record means only that this selector did not match; the measurements of canvases and named dock elements remain explicit.

Local screenshots were excluded from repository publication after automatic approval review rejected that upload because explicit permission for publishing local screenshots was not established. No image bytes are included in this text-only handoff.

## Executed controller checks

The original source-only commands were:

    node probe-controller.mjs > probe-results.json
    node --test tests/hapa/model-decider.test.js

The second command ran in the pinned source directory. No model, Harness or other service was called; fetch was replaced with a deterministic stub.

The joint-funding witness advances six real opening Ticks through the actual rules before requesting two Tick-7 destinations. The response witness deliberately prepares a diagnostic response state with a legal counter; it is not a played response history. Proposal-shape cases exercise the same current decider. All are labeled in the JSON.

To inspect the packaged witness in a checkout containing this evidence file:

    node docs/reviews/evidence/2026-11-24/review-10/controller-probe.mjs

A rerun records that checkout's revision/dirty state and may differ after repairs. Do not relabel fresh results as the original reviewed commit. This diagnostic emits observations rather than imposing a new permanent suite.

## Limits

The submitted Milestone A/B/C reports were read, not re-executed. The six passing tests do not cover respond(); the wrong-input-hash response witness does. The supplied aggregate replay result was not independently recomputed from a full replay artifact. No new broad rules qualification, full-match run, owner security audit, performance benchmark, current Overwatch update or CJ acceptance occurred.

The newer local music peer module, live Harbor renderer and Harness owner adapter need a pinned owner revision/digest in the implementation handoff for independent traceability. Their limited publication evidence does not imply that the reported local integrations are absent.

