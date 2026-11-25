# Review 11 evidence — 24 November 2026

This record supports [Review 11](../../../2026-11-24-ui-design-review-11.md) and [Assignment 12](../../../2026-11-24-next-agent-assignment-12.md). It distinguishes verified pushed source, fresh local observations, deterministic probes, submitted evidence and unverified claims. This publication contains text only; new local screenshots are not included.

## Source identity

| Item | Identity |
| --- | --- |
| Repository | calderwong/hapa-verseUs-prototype |
| Reviewed head | `7d4a96bd753f8b0e79ac46e3ad0c1e206e54ea36` |
| Reviewed tree | `ddfd3718c650fd27a902fad3cd4cb593d297254d` |
| Implementation | `bafc36f1e40c46ab69cd8b239e6014acbc1393df` |
| Previous review publication | `4a6979547819ab9cdf4d6151a7a51ee7a64a46bd` |
| Engine gitlink | `ba838cca09ba43afceda0452b63d28df4cbf7f72` |
| Profile | `hapa_open_10x9_v3_07` |

[source-register.json](source-register.json) records byte-verified files and the source identity for this review. Inclusion of unchanged dependencies records provenance and does not mean each dependency was separately audited line by line. The reviewed Avatar implementation blobs are identical between implementation and reviewed head; [avatar-blob-comparison.json](avatar-blob-comparison.json) records that comparison.

## Fresh local browser observation

A separate temporary tab was opened at `http://127.0.0.1:5199/versus.html`; the user's existing tab was not changed. Visible setup: A human, B heuristic, Red at the table, Red's moves heuristic, v3_07, seed 1, no human tracks selected. Avatar sound was not enabled, no question was submitted, no music was started or kept, and no model-assisted move was requested by this review. The temporary tab was closed afterward.

Viewport: 2838 × 1076 CSS px. Observed world canvas: 2828 × 984 CSS/intrinsic px. Browser zoom, OS display scale and devicePixelRatio were not separately recorded. The live source commit was not exposed; no claim is made that the currently served bytes are identical to the reviewed tree.

| Action | Observation |
| --- | --- |
| Home | Full board/banks and seated Red visible; readable head/torso above the far edge; adjacent caption/nameplate; music strip separate |
| Drag across an unsent conversation draft | Text selection changed to positions 2–18, while the nameplate x-coordinate moved from 1541.140625 to 1664.796875 CSS px. The scene visibly panned. Draft was later cleared. |
| Wheel over the open conversation | The board and opponent visibly zoomed. This was not scrolling a long history fixture; source confirms the unconditional world wheel handler. |
| Close conversation and Home | Restored the seated framing |
| Turn left 45 degrees | Board rotated; opponent stayed attached to the far seat and could leave the frame |
| Tactical overhead | Board remained usable; opponent body faded and small social controls docked |
| Ready once | Committed/resolving, then Tick 2 Planning; no additional acknowledgment. Bot B supplied its own plan. |
| Fresh restart and settled load | Initial attachment briefly showed a pre-fit view; settled to full seated framing automatically. Startup framing is not filed as a defect. |

The conversation gesture failure is independently reproduced live. Expanded-panel clipping is source-confirmed from the 260 px placement reserve, 300 px panel and overflow clipping; it was not separately forced live. Dark world lighting and the photographic/pixel art contrast are visual observations with no isolated regression cause.

## Existing targeted tests

Command executed once in the exact-source checkout:

```sh
node --test tests/hapa/model-decider.test.js
```

Result: **10 passed, 0 failed**, including joint-funding rejection, malformed/abstained proposals, actual response hash/shape handling and detach cancellation. See [model-decider-test-results.txt](model-decider-test-results.txt). No full suite or long match was repeated by the reviewer.

## Focused model-wrapper diagnostic

[model-null-response-results.json](model-null-response-results.json) is the result of one probe against actual pinned controller/rules code. Fetch was stubbed to return HTTP 200 and parsed JSON `null`. The plan deadline was 20 ms and the observation guard 150 ms.

Observed: unsettled decision, an unhandled null-property error, one request, no cancellation, no receipt, zero remaining inflight/settlement handles. Source shows the deadline was cleared before the throw, so this is a lost recovery path rather than an insufficiently long wait.

[model-null-response-probe.mjs](model-null-response-probe.mjs) packages that diagnostic with repository-root imports and current source-byte metadata. Its recorded result is from the original pinned-source run. From a repository root, a later agent may run it with:

```sh
node docs/reviews/evidence/2026-11-24/review-11/model-null-response-probe.mjs .
```

It is a diagnostic witness, not a production module or a requirement to repeat historical tests. The assigned permanent regression belongs in the existing focused model-decider test file. No live Harness null reply or live response-window hang is claimed.

## Focused music-resume diagnostic

[music-resume-results.json](music-resume-results.json) records the actual pinned Soundtrack module in a local VM, with a controlled pending Audio.play promise and manually advanced timers. DOM rendering and network acquisition are fixtures; actual resume, opt-out, Next and failure methods execute unchanged.

| Interrupted pending resume | After rejecting old promise | After firing its scheduled skip |
| --- | --- | --- |
| A → Not listening | A marked failed/skipped | Queue advances to B despite opt-out |
| A → Next, B loading | B marked failed/skipped | Queue advances again to C |

Zero network requests occurred. This isolates the stale callback/entry binding and does not claim real-browser playback timing or owner integration coverage. The source Git blob matches `3b014bcb0b85c63f350a0c924c6793aeb5baa9be`.

The [portable probe](music-resume-probe.mjs) reads the actual module from the supplied repository root and prints its current blob identity:

```sh
node --experimental-vm-modules docs/reviews/evidence/2026-11-24/review-11/music-resume-probe.mjs .
```

Review-baseline metadata is labeled as such in the packaged probe. A later run's module hash determines whether its source matches the reviewed bytes. The result beside it remains the original executed witness.

## Submitted evidence retained

Read [implementation response 11](../../../2026-11-24-ui-design-response-11.md) and [witnesses.json](../response-11/witnesses.json) for the implementer's source/running declarations and owner-backed journeys. Seven existing captures were examined, including [normal Home](../response-11/01-home-1440x900.jpg), [close inspection](../response-11/05-close-inspection.jpg), [owner unavailable](../response-11/06-harbor-unavailable.jpg) and [wide Home](../response-11/07-wide-2838x1020.jpg). They are submitted captures from `bafc36f`, downscaled by that capture tool to 800 px wide; they are not new reviewer screenshots.

The report supplies full-check success, a Quiet question, preserved draft/focus, malformed current voice reply recovery, switch/pending/opt-out playback, Keep retry and an unheard save, a short model-assisted journey, detach cancellation and owner-down playability. These were read and qualified, not all repeated live. The report discloses no live voice-deadline, corrupt-track skip, model response decision or two-introducer witness. Owner code was not independently available for audit here; truncated digest prefixes cannot identify complete source bytes.

`controller-probe-after.json` has new `probes` results but inherited baseline aggregates in its trailing `evidence` block. Its old `respond: 0` does not describe the current test file. Keep that historical distinction in the next response.

## Boundaries

No production source, gameplay profile, engine pin or owner process was changed by this review. No new local images are part of this text publication. Current Overwatch state and unpublished owner checkouts were not read; the local coding agent retains the existing append/handoff responsibility. This review records technical and visual observations, not CJ's acceptance to Done.

