# Assignment 24 — finish connection readiness and coherent local setup

**27 November 2026 · follows [Review 22](2026-11-27-runtime-and-roster-review-22.md) at `164aa5dc6eb96ee4b4cc4eab6f0cdb2298554536` · released baseline friend.6 / `fe6584ae29d51809c87b128767d11b49f1818da4`**

## Goal and working method

Finish one small repair batch, qualify the changed candidate once, then hand CJ and the Windows friend a concrete two-home test. The target remains: download/extract/open matching bundled apps, connect by challenge or invitation, play and reopen with the same identities and matching results. The friend's ordinary flow needs no terminal, provider JSON, owner application, source checkout or operated VPS.

Read AGENTS, the current review index, Response 23, Review 22 and its [evidence](evidence/2026-11-27/review-22/README.md). Compare the pinned source with current local/GitHub work; preserve newer work. If a finding is already fixed or cannot be reproduced, give the relevant revision and observation instead of implementing it again.

Use Loose Screws. Group the related changes and focused regressions, then perform one integrated qualification. Continue through the authorized work without repeated permission checkpoints. Preserve corrected activation/cancellation, current provider eligibility, relay-cache identity, genuine relay-carriage evidence, installed Red, the hard Windows gate, engine/profile pins and archived signatures.

## N24-01 — readiness-aware authenticated attachment (P2, first priority)

Fix V22-01. The actual Lobby auth path calls `_onPeer` and then `_onConnection`; the latter can reach `OnlineMatch.attach` before both feeds exist. `_openMatch` exposes the match before awaiting `open()`. The new STARTED guard works and must remain.

- Give replication attachment an explicit readiness boundary. Defer or safely decline fresh authenticated and standby-promotion attachment while the authority opens. After readiness, attach only the current eligible connection and current nonclosed authority/generation.
- Preserve cancellation/tombstone ownership, cleanup and truthful connection status. Do not report connected after only one feed attached, and do not merely swallow the exception.
- Do not use STARTED activation as a blanket replication gate: finishing authorities must continue result recovery. The existing post-open current-peer lookup may allow a small correction; no new generalized queue architecture is required.
- Add one focused native regression through the complete authenticated callback sequence while own/remote readiness is held, including `_onConnection`, then release it. Verify no exception, both feeds attach to the current connection, cancellation/closure cannot revive the abandoned setup, and fresh/activated play plus finishing-result recovery remain usable. Reuse the existing STARTED/restart controls.

**Done for this slice:** the reproduced callback failure is gone at its real asynchronous boundary and current connection ownership is demonstrated. A `_onPeer`-only test does not establish that.

## N24-02 — one coherent local Avatar choice (P2, optional-player lane)

Fix V22-02: disable Red in the roster, then check the older top Avatar toggle, reopen setup and Start. Today the two preference records permit selected Red with roster membership false and a checked/disabled radio.

- Centralize the selection operation. Consolidate the redundant checkbox where practical, or explicitly enable-and-select/reject consistently. A selected entry must satisfy the declared roster policy at setup, reopen and Start.
- Preserve explicit play without a figure, clean-state Red default, existing controller choice and controller/performer separation. Roster edits cannot trigger advertising, networking, model work or an extra match.
- Keep unavailable optional figures unselectable with a short reason; keep online availability visibly unsupported until actually implemented. Do not substitute Red for a requested unavailable figure.
- In the same setup edit, keep name/status readable and move raw renderer/package/revision data into Details or a disclosure, as the existing optional-player contract requests. Avoid a broader art/animation redesign.
- One focused preference/handler regression plus a fresh actual UI journey of disable/select/reopen/Start is adequate. Confirm the default and unavailable-figure controls while there.

**Assignment 21 remains partial:** the roster scaffold is delivered; actual Mimi/Falka, Leo and Thor presentation/owner routes and online hosting remain separate work. Preserve Response 23's reported owner bindings and add actual source-linked owner evidence when completing that slice. These dependencies do not gate human-versus-human play.

## N24-03 — exact relay-report membership (P3, harness only)

Fix V22-03 in the stage aggregator: stage 1 must contain its exact two expected peers; stage 2 its exact three. Reject absent, duplicated/misidentified or invalid required reports rather than accepting any two surviving files. Refresh stale forceRelay/failure comments.

Use a bounded aggregation regression with complete and missing/invalid cases. The successful published run already contains all expected peers and authentic carriage; retain that evidence. Do not repeat unchanged network experiments, deploy a relay or rebuild an app solely for this harness correction. Native exhaustion remains explicitly unproven if no new evidence is collected; unit evidence is not relabeled as a native run.

## N24-04 — one coherent qualification and handoff

1. Run the affected source/native checks during assembly. At final integration run `npm run check` once for the coherent candidate, then exercise the changed connected/native lifecycle and actual setup UI journeys. Repair related failures together and broaden only for a concrete remaining risk or required gate.
2. If application code changes, publish matching Mac arm64/Windows x64 artifacts from one identified clean source and qualify the actual candidate. Use the existing Windows released-artifact workflow with its hard six-report gate; retain identity/storage, invitation/result/reopen and late/never-ready coverage. Exercise the Mac installed path and changed boundaries. Do not claim normal consumer prompts or cross-home success from same-host/CI tests.
3. Reuse unchanged Red rendering/owner recovery and relay-carriage evidence with its dependency scope. A roster setup change needs its own UI observation; it does not automatically require a new animation benchmark or the entire owner-recovery campaign.
4. Publish `2026-11-27-implementation-response-24.md` (use the actual later date if appropriate), mapping every N24/V22 item to implementation, actual checks or a precise remaining dependency. Record source/build/engine/profile/protocol, clean state, artifact size/hash, workflow and evidence references. Keep technical review, consumer launch, two-home play and CJ acceptance separate.
5. Reconcile README, review index, AGENTS, checkpoint, runbook and player status. Preserve historical reports and the immutable Base Node/connectivity bundles. Update the already configured local Overwatch board through its real interface if accessible; record a blocker instead of claiming a write that did not happen.
6. Finish with the next concrete two-home test and the existing evidence form. Do not begin another unrelated polishing or standards-compliance project. If the repaired candidate is technically ready but the humans have not played, report exactly that state and stop the internal repair cycle.

## Scope boundary

This assignment does not require a provider editor, new archive/VPS, framework change, engine edit, gameplay rewrite, paid service, broader SDK extraction or Base Hapa Node conformance implementation. The standard remains a pinned target. Existing source access, owner allowlists, privacy and identity/history preservation remain binding.
