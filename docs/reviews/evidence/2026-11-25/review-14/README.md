# Review 14 evidence

**Repository/source:** `calderwong/hapa-verseUs-prototype` main `3fc3f1b386a03ea2d3f307adc4391e090de4592a`, implementation `153b657ad28f640f6efa42739e3d1bc7f70ebc4d`, root tree `7f7b0a81ddf199e0b8d29344ca685cd74331a58d`. Engine remains `ba838cca09ba43afceda0452b63d28df4cbf7f72`. Reviewed 25 November 2026, America/Los_Angeles.

Read [Review 14](../../../2026-11-25-ui-design-review-14.md), [Assignment 15](../../../2026-11-25-next-agent-assignment-15.md), and the author's [Response 14](../../../2026-11-25-ui-design-response-14.md). This publication contains review text and diagnostic evidence.

| Evidence | What it establishes |
| --- | --- |
| [Source register](source-register.json) | Downloaded/reused bytes verified against the pinned Git tree, plus the engine dependency and existing submitted images. Provenance does not mean an exhaustive audit of every line. |
| [Response identity check](response-14-identity-check.json) | The 15 reported source SHA-256 entries match the fetched files. This does not prove the source in a live browser or process. |
| [Soundtrack tests](soundtrack-test-results.txt) | Six supplied tests independently pass once, using actual Soundtrack with fixture audio/fetch/storage. |
| [Transport diagnostic rerun](transport-state-probe-rerun.json) | The unchanged Review 13 script now starts on the first failed/finished Play, restarts completion at zero and chooses q1 in the chronology sequence. Its second Play-button press now correctly pauses. Zero network requests; 22 intercepted fixture fetches. |
| [Race diagnostic rerun](resume-pause-race-probe-rerun.json) | The unchanged Review 13 script now reports no stale play and no reversal of Pause after the graph wait. Controlled scheduling, not a live device refusal/race. |
| [Expired-effect diagnostic](expired-fx-disposal-probe.mjs) / [result](expired-fx-disposal-result.json) | Actual HitFX supply/expiry, BoardView disposal and resource collector omit disposal of the dormant helper textures. Three/canvas and unrelated imports are fixtures; no real renderer, GPU measurement, network or owner operation. |
| [Live observations](live-observations.md) | First-press Play, compact state preservation, one Ready transition, revised Home/orbit, and the two remaining layout transitions observed in the local browser. Running commit was not exposed. |

## Reproduction commands

From an appropriate checkout with the repository's Node requirements:

```bash
node --test tests/hapa/soundtrack.test.js
node docs/reviews/evidence/2026-11-25/review-13/transport-state-probe.mjs .
node --experimental-vm-modules docs/reviews/evidence/2026-11-25/review-13/resume-pause-race-probe.mjs .
node --experimental-vm-modules docs/reviews/evidence/2026-11-25/review-14/expired-fx-disposal-probe.mjs .
```

The original two probes and their baseline results were preserved. Their `reviewBaselineCommit` metadata remains the original Review 13 pin; the emitted source hashes identify the actual bytes executed for these reruns. Current Soundtrack blob is `47e24706ff5c373df830b545f9a1a37210c526f6`; MusicSignal remains `5972a736aebf27794cf8ecabf94f4eeafdfaf77a`.

The effect probe records current BoardView blob `5bee9a45967b567ac0d1b60010456f45f67414db`, HitFX blob `c7dbd60c9d78c9d846c917308727c6ea7cb9dfa1`, and resource helper blob `6a6451b5442fbe664755fc18c01c2000fa4be0f6`. It starts with 14 burst-texture references, expires all effect children, and then records zero texture disposal calls. A second board disposal returns null.

These scripts print diagnostic observations. A zero process exit alone is not a passing product assertion. The records here preserve what happened at the reviewed baseline; later fixes should add their own response evidence rather than rewrite these records. Temporary source paths in diagnostic output are provenance, not required checkout locations.

## Scope and limits

The supplied test suite, each original diagnostic and the new focused effect diagnostic ran once. The reviewer did not repeat the full integrated check, owner retention matrix or long stress benchmarks. The author's 158/158 check, smoke/peer/build, renderer plateau and short frame sample remain submitted measurements. The plateau covers fresh replacements before the dormant-effect case; CPU heap was not measured.

Four existing repository captures were reviewed for submitted scene/layout evidence. Fresh local screenshots were used for UI inspection but are not uploaded in this text publication. No new excavation or full music-response-mode qualification is asserted. The reviewer did not access or update current Overwatch state, send a message to Red or create a Keep record.

The current candidate's implementation, verification and CJ's acceptance are separate. Assignment 15 narrows the remaining work to two concrete corrections and one handoff, not a new automatic review/polish campaign.
