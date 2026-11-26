# Evidence — open-ended Review 17

Supports [Review 17](../../../2026-11-26-open-ended-review-17.md) and the [three-pass coding handoff](../../../2026-11-26-three-pass-coding-handoff.md).

## Identity and method

The reviewed repository is `calderwong/hapa-verseUs-prototype` at `d113216c8473cf8fc1809e7720cd7a09ad76fa6b`. The latest reported implementation remains `532643846f815106f7e33551099d02008e03c4d2`; the intervening commits recovered Review 16 and added the visual supplement. Engine pin is `ba838cca09ba43afceda0452b63d28df4cbf7f72`; profile is `hapa_open_10x9_v3_07`.

[source-register.json](source-register.json) identifies **47 repository source/reference files**, their Git blob hashes, byte counts and SHA-256 hashes. Local bytes were checked against the exact pinned recursive tree. It also records the full static local-module closure used by the actual-rules diagnostic and the hashes of all three portable scripts and their recorded outputs. The engine was not newly audited in this pass.

Three diagnostics were run against that verified source using Node `v24.22.3`. These were bounded reproductions after source inspection, not a broad test suite. No production implementation was modified. No live browser, installed Electron app, native Hypercore failure, remote peer, GPU, performance or human-acceptance observation is claimed. CJ's local unpushed work, Mac-only grounding and Overwatch operating state were not available to this reviewer.

## Diagnostic boundaries

| Script | Review findings | What is real | Controlled or unobserved boundary |
| --- | --- | --- | --- |
| [rules-content-probe.mjs](rules-content-probe.mjs) | R17-01/02 | Rules, validation, fixture construction, content export/import, manifest creation, resolution and fingerprinting | Explicitly prepared Card/resource/combat states; no ordinary opening, UI import clicks, online peer or native storage |
| [response-lifecycle-probe.mjs](response-lifecycle-probe.mjs) | R17-03/06 | Exact extracted authority, renderer and runtime methods | Injected journal failure, sentinel rules generator, fake rendering/signature checks and counted fake authority handles; orchestration only |
| [view-state-probe.mjs](view-state-probe.mjs) | R17-04/05 | Actual OnlineClient class and extracted app event/tick/eligibility methods | Synthetic already-authenticated runtime events and fake rendering/publication helpers; no validation of those events by a live peer |

The scripts' assertions describe the reviewed failures. Exit 0 means the diagnostic reproduced its asserted case; it does not mean the game passed qualification. Future fixes should adapt relevant cases into positive regression checks. Method-extraction diagnostics intentionally fail loudly if the source structure changes; update the harness to the new boundary rather than bypassing it.

## Observed results

### Rules and executable content

[Recorded result](rules-content-probe.json).

- Ember Strike costs 2 Red. One unique fuel Card supplies 1 Red. Referencing it once is rejected; repeating its ID twice is accepted, emits two burns, pays 2 Red and causes the actual 2-point hit.
- Blue Denial costs 2 Blue. One unique fuel Card supplies 1 Blue. The honest response is rejected; repeating its ID accepts the counter, emits two burns and counters the original spell.
- Validation leaves the original state unchanged. The repeated consumption is observed during actual resolution.
- A correctly hashed imported damage definition missing `power` passes the content validator and bundle loader. Match construction and plan validation succeed. Resolution creates non-finite target HP; fingerprinting throws `non-finite number at $.members.B.target.s5.hp`.

The normal UI is not claimed to generate duplicate burn lists. The shared authoritative input boundary admits them. Arbitrary custom content is not shown to bypass the default online preset's catalog fingerprint restriction; the malformed import case establishes the local content path described in Review 17.

### Durable response and completed authority lifecycle

[Recorded result](response-lifecycle-probe.json).

- One injected response-append rejection leaves the authority's pending choice `null` and its resolver uncalled. Retrying returns `NO_CHOICE`. The actual renderer orchestration still advances its sentinel generator, starts playback and returns success after an error toast.
- Three authorities are opened, completed and saved through the actual runtime methods with fake native-handle owners. No close calls occur before shutdown. Shutdown closes only the third authority; the first two never receive a close call.

The first result proves an orchestration failure, not a measured live spell outcome. The second proves missing ownership/teardown calls. Native-resource retention is a source-supported risk; no memory, file-descriptor or replication growth was measured.

### Public-state projection and disputed controls

[Recorded result](view-state-probe.json).

| Case | Remote commands | Revision | Remote Ready |
| --- | ---: | ---: | --- |
| Tick 5 revision 2/Ready delivered while the view shows Tick 4, then view opens Tick 5 | 0 | 0 | false |
| Same events delivered while the view already shows Tick 5 | 1 | 2 | true |

The runtime's authoritative commands are not lost by this demonstration; their visible projection is. Separately, a disputed client in an otherwise editable planning phase returns `edit=true` and `ready=true`. The source also shows that the runtime exports `match.leave`, the renderer never calls it, and the lobby Return route checks only `active` status. No browser rendering of that state was executed here.

## Reproduce from a checkout

Run from the repository root, or append the root path as the first positional argument:

```bash
node docs/reviews/evidence/2026-11-26/review-17/rules-content-probe.mjs
node docs/reviews/evidence/2026-11-26/review-17/response-lifecycle-probe.mjs
node docs/reviews/evidence/2026-11-26/review-17/view-state-probe.mjs
```

Each script writes JSON only to stdout and leaves these recorded outputs unchanged. Its source-baseline field identifies this historical review, not the future caller's checkout; record the actual source revision for reruns. No peer is started by these scripts.

## Qualification still required on implementation

The combined handoff requires real installed observations for response persistence/recovery, different presentation speeds, disputed-session departure, repeated-match native teardown and archived-profile retrieval. The local content path needs an ordinary import-to-play witness. Existing visual evidence belongs to the earlier supplement; this pass adds no new captures or claims about motion quality.

Use these probes to resolve the specific connections while assembling. Run the repository's required integrated check and changed browser/installed journeys when the candidate fits. Preserve separate external release gates and CJ's acceptance. This evidence package and the review are documentation; they do not close the defects or update the canonical Overwatch task state.
