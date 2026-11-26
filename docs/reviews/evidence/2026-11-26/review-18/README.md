# Review 18 evidence — 26 November 2026

Supports [Review 18](../../../2026-11-26-readiness-review-18.md) and [Assignment 18](../../../2026-11-26-next-agent-assignment-18.md).

## Source identity and method

Repository: `calderwong/hapa-verseUs-prototype`. Reviewed main/report: `b2a31f45baed1b70f0e1777eba93fe0267b09a5b`. Reported implementation: `7cc30a141672ffedf5093bfd5695a39dca0532a5`. Engine: `ba838cca09ba43afceda0452b63d28df4cbf7f72`. Profile: `hapa_open_10x9_v3_07`.

[Source register](source-register.json) records 44 retrieved text files, their Git blob and SHA-256 digests, and the original screenshot identities. Each source's actual UTF-8 bytes was checked against its fetch metadata and the pinned recursive Git tree. This is a source-integrity check, not a claim of a local checkout/build.

Three reviewers independently inspected decision/recovery, records/lifecycle and visual/avatar behavior. Complete diagnostic bodies were executed against the retrieved source in the functions JavaScript V8 isolate. The coordinating reviewer also executed all three bodies and inspected the retained artifacts. Filesystem wrappers are supplied for reproduction; **the Node CLI wrappers were not executed in this review**. Native/Electron execution was unavailable. Response 17's submitted native and installed evidence is credited with its stated boundaries; the review does not claim to have rerun it or `npm run check`.

## Diagnostic artifacts

| Program / output | What it executes | Explicit substitutions and limits |
| --- | --- | --- |
| [Decision/recovery program](decision-recovery-probe.mjs) · [recorded output](decision-recovery-probe.json) | Exact OnlineClient class and app/runtime/main methods: stale snapshot/dispute; ambiguous Ready; lost STARTED/departure; startup timeout; v1 active reservation | Controlled host replies, authenticated-event inputs, persistence and timers. No Electron process, native journal or real network. |
| [Records/recovery program](records-recovery-probe.mjs) · [recorded output](records-recovery-probe.json) | Exact terminal resume/join/attach methods; ResultIndex and archive query/get/sync/profile methods; actual standalone content validator | Controlled files/transport, already-verified result summaries/bundles, injected archive timeout. Cryptographic verification and native storage are not executed; validator uses a minimal catalog. |
| [Presentation program](visual-presentation-probe.mjs) · [recorded output](visual-presentation-probe.json) | Exact hit dispatch, board update, playback start/step and frame-delta statement | Synthetic rule-shaped events, pose/render/view stubs. No GPU/browser/native claim. Fresh browser evidence is separate below. |

The programs assert the **historical failures**. Exit 0 means those assertions reproduced; it does not mean the product passed. The records diagnostic additionally checks the corrected validator accepts valid content and rejects missing power/invalid channel. Product fixes should have positive regressions in the normal suite; preserve these published historical records.

To rerun a wrapper, use a checkout at the documented baseline and record the actual revision. The baseline string in the output is a historical label, not automatic source authentication:

```bash
node docs/reviews/evidence/2026-11-26/review-18/decision-recovery-probe.mjs /absolute/path/to/pinned-checkout
node docs/reviews/evidence/2026-11-26/review-18/records-recovery-probe.mjs /absolute/path/to/pinned-checkout
node docs/reviews/evidence/2026-11-26/review-18/visual-presentation-probe.mjs /absolute/path/to/pinned-checkout
```

### Recorded conclusions

- Decision projection changes disputed → active when a stale snapshot binds; editing and Ready become enabled.
- A pending Ready freezes editing, but a host timeout plus an early empty snapshot unlocks it; late `ownCommitted` leaves the view unfrozen.
- Leaving the starting challenger does not release the already-active joiner in the asymmetric STARTED case.
- A v1 active reservation is retained with no authority and neither existing Leave boundary can act on it.
- Startup timeout followed by late Ready leaves the same worker current and the readiness API permanently rejected.
- A reopened terminal authority is owned in `finishing` but receives no match topic join/attachment; an active control does.
- An archive excludes a genuine conflict while fresh/prior observers retain one counted win through the actual distribution path.
- Archive timeout is returned and cached as synced/checked zero.
- A rule-shaped terrain event triggers no terrain FX; a non-rule-shaped column/row control does.
- A late action settles to idle with gear still hidden.
- Mid-playback speed changes actor/FX delta while movement keeps the starting rate.

These bounded reproductions determine where implementation/native/live checks are needed. They do not certify every surrounding path.

## Fresh connected-browser observations

[Browser observations](browser-observations.json) records the actions, visible status, relevant console messages and capture metadata.

The reviewer used a dedicated connected Chrome tab at `http://127.0.0.1:5199/versus.html`. Default configuration: human A, heuristic bot B, Red selected, profile `hapa_open_10x9_v3_07`, no diagnostic fixture. Browser version, OS, text scale, rendition-index identity and owner package identity were not recorded. DPR was 1; original viewport 2223×1016 CSS pixels, compact trial 960×720.

**The running Vite demo did not expose a Git revision.** Do not equate the live screenshots with the pinned GitHub candidate. They establish the current local symptom and interaction, while the source diagnoses remain pinned independently.

| Original capture | Observed state |
| --- | --- |
| [01 — entrance](01-entrance-default-red.jpg) | Default local entrance with Red selected; human A / bot B. |
| [02 — default Home](02-default-home-avatar-fallback.jpg) | Tick 1; empty seated-Avatar location, Red nameplate/greeting, unavailable music. `/capabilities` and `/music/red/songs` both return 502. |
| [03 — Card inspection](03-card-inspection-actions.jpg) | Pinned 2 of Wands with enlarged face, complete visible facts and contextual actions. |
| [04 — settled absorption](04-absorption-settled.jpg) | One Ready advances the planned Castle/Pawn merge to Tick 2; Castle R2C1, Supply 3. |
| [05 — close merged party](05-absorption-close.jpg) | Merged Castle 9/9; close inspection presents nine member controls. |
| [06 — compact header](06-compact-header.jpg) | 960×720; observed decision controls remain within the viewport and document width is 960. |

All six captures are original JPEG bytes, uncropped and unannotated. Hashes, dimensions and provenance are in the register. Five are 2223×1016; the compact one is 960×720.

The fresh local interaction supplied the Pawn and Castle, planned Castle R1C1 → R2C1, selected 0.5× before playback, pressed Ready once, inspected the next-Tick 9/9 party, then restored 1×, Home and the original viewport. The review tab was left at Tick 2 Planning. A click tool timed out while starting the first match; the reviewer inspected the resulting page and confirmed the match opened rather than issuing a duplicate start.

The Avatar panel explicitly reported renderer unavailable `/capabilities 502`, captions-only voice and the heuristic-bot controller. This proves fallback/owner failure in that demo, not removal of a specific mesh mode. Unrelated browser-extension warnings are omitted.

Settled absorption and a readable compact header are limited observations. They do not establish precise absorption-cue timing, live terrain completion, every responsive case, accessibility, a human playtest or installed behavior.

## Submitted evidence inspected

Response 17 and its pinned source/test/evidence were reviewed. In particular:

- [b1 combat still](../response-17/b1-combat-paused-poses.jpg) is coding-agent-submitted evidence, not a fresh reviewer capture. It visibly stacks numerical/star/direction effects over members and motivates bounded density refinement.
- The installed journey's first observer automation step failed; the report supplies a separate corrected observer UI run on the final candidate. Preserve that distinction.
- The native terminal-repair fixture begins with completed replicated journals. It establishes repair when both closings are already present, not reconnection after an earlier missing-remote-closing cut.
- Existing response-window clicks from Response 16 are not an independent installed qualification of the changed Response 17 choice-persistence path.

## Publication boundary

This package publishes findings, evidence and coding instructions only. It does not change game/engine source, update Overwatch, start owner services, sign/distribute an installer, establish internet play, or supply CJ's aesthetic/Done acceptance.

The next coding response must identify the actual tested candidate and close the specific local/installed/native gaps. Signing, approved distribution, operated infrastructure, independent networks and human acceptance remain separate from implementation correctness.
