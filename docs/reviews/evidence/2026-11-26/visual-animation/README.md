# Evidence — visual, aesthetic and animation supplement

Supports the [review](../../../2026-11-26-visual-animation-review.md) and [feature brief](../../../2026-11-26-visual-animation-feature-brief.md).

## Reviewed boundary

- Repository: `calderwong/hapa-verseUs-prototype`.
- Source head: `bd66817326c6966d28c73b4cc06a144551077a1b`, the recovered Review 16 / Assignment 17 documentation commit.
- Underlying implementation candidate: `532643846f815106f7e33551099d02008e03c4d2`, as recorded in Response 16. The recovery commit did not change game implementation.
- Engine: `calderwong/lumina-hapa` at `ba838cca09ba43afceda0452b63d28df4cbf7f72`.
- Profile: `hapa_open_10x9_v3_07`.
- Review date: 26 November 2026, using CJ's America/Los_Angeles client date.

This was a source-and-submitted-capture review. The connected local browser was unavailable, and the fallback surface had no running game. No fresh browser, installed Mac app, owner service, network journey, GPU, frame-rate, animation-smoothness or human-acceptance result is claimed. Local Mac grounding and Overwatch were unavailable; Overwatch state was not changed.

## Source verification

[source-register.json](source-register.json) records **48 repository files**, **two engine files** and **nine submitted stills**. Repository file contents were hashed as Git blobs and compared with the pinned recursive tree; SHA-256 and byte counts are included. Engine contents were fetched at the submodule pin and locally rehashed against the returned blob identities. Capture identities match their existing blobs in the pinned repository tree; the stills remain at their original paths rather than being duplicated here.

The register combines presentation code, governing art/workflow references and the rules/fixtures used by the diagnostic. It is the bounded reviewed set, not a whole-repository or complete-engine certification. No implementation files, private media stores, credentials or installed artifacts are included in this publication.

## Submitted visual evidence

All were retrieved from the reviewed source head, but each was produced by its original response. The original reports retain their build/runtime qualifications. Image dimensions are not substituted for CSS viewport, device pixel ratio or text scale when those values were not recorded.

| Capture | Used to assess | Original context |
| --- | --- | --- |
| [Home](../../2026-11-25/response-14/01-home-desktop.jpg) | Table/seat scale, light, backdrop and board emphasis | [Response 14](../../../2026-11-25-ui-design-response-14.md), implementation `153b657` |
| [Close formation](../../2026-11-25/response-14/03-close-formation.jpg) | Member silhouettes, equipment, ground materials and on-body facts | Response 14 |
| [Low orbit](../../2026-11-25/response-13/02-low-orbit-table.jpg) | Constructed table, cedar/slate/brass relationship and across-table opponent | [Response 13](../../../2026-11-25-ui-design-response-13.md), implementation `c42649b` |
| [Excavation/layer](../../2026-11-25/response-13/05-excavation-band-minus3.jpg) | Layer/board composition; no inference about completion motion | Response 13 |
| [Compact music view](../../2026-11-25/response-15/02-narrowed-700-music-kept-orders-collapsed.jpg) | Existing compact arbitration and retained interface character | [Response 15](../../../2026-11-25-ui-design-response-15.md), implementation `da76b0b` |
| [Online lobby](../../2026-11-25/response-16/02-roster-opponent-available.jpg) | Entrance hierarchy and roster density | [Response 16](../../../2026-11-25-p2p-implementation-response-16.md); installed-journey qualifications remain in its report |
| [Online Ready](../../2026-11-25/response-16/04-ready-committing-vs-remote.jpg) | Remote identity, decision controls, board standards and destination cues | Response 16 |
| [Owners absent](../../2026-11-25/response-16/07-installed-local-match-owners-absent.jpg) | Honest fallback context for empty chair and unavailable music | Response 16; not a portrait-quality or music-animation witness |
| [Result](../../2026-11-25/response-16/08-result-cal.jpg) | Outcome hierarchy, statistics, archive state and player-facing wording | Response 16 |

These are still-image composition witnesses. They cannot establish that a motion is absent, smooth, correctly timed or pleasant to watch. The review's actor/clock findings come from source; its material judgments are explicitly aesthetic assessments of these images.

## VA-01 diagnostic

[timeline-end-probe.mjs](timeline-end-probe.mjs) executes the real unchanged rules and `playback.js`, using the same trace callback as `VersusApp._resolveAgreed` at the reviewed source. It proposes two legal commands: travel for one Castle and a formation-facing change for another. It requires actual traced movement, then reads the terminal event prefix.

The [recorded baseline result](timeline-end-probe.json), run with Node `v24.22.3`, is:

| Measure | Observed |
| --- | --- |
| Accepted commands | 2 |
| Movement trace frames | 51 |
| Last trace quantum | 1000 |
| Authoritative events | 8 |
| Terminal playback event prefix | 5 |
| Omitted from that playback dispatch | `supply_spent`, `formation_changed`, `tick_finished` |
| Formation facing | North before resolution; East after resolution |

This reproduces an incomplete presentation boundary. It does not demonstrate loss of authoritative history, a wrong match result or a live renderer failure. The connection from that prefix to effects/sound/social dispatch is established by the app source. The review's separate displayed-state and pause findings are source traces, not additional executed browser probes.

From a checkout root:

```bash
node docs/reviews/evidence/2026-11-26/visual-animation/timeline-end-probe.mjs
```

An explicit checkout root can be supplied as the positional argument. The script writes JSON to stdout and leaves the recorded evidence unchanged. Its `reviewBaseline` is the historical reference, not an assertion that a future caller is running that revision; record the actual checkout when rerunning.

After correcting the helper, use `--expect-fixed` to assert a complete prefix, adapting the harness if the presentation API changes. This is only a meaningful regression for the observed omission. A full implementation witness must also show final state coherence and once-only effect dispatch; the prefix assertion alone cannot prove either.

No broad implementation test suite was run for this documentation review. Required integrated qualification belongs to the implementation candidate described in the feature brief. The published source register hashes the portable diagnostic and its baseline output.
