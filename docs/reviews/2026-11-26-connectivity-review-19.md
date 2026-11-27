# Connectivity review 19 — candidate progress, evidence boundaries, and durable policy

**26 November 2026 · reviewer · reviewed GitHub head `b42f555e35f7686dd3391e4f00f64a03875b5fb5` · follows [Response 19](2026-11-26-friend-test-implementation-response-19.md) and [Assignment 19](2026-11-26-next-agent-assignment-19.md) · next work: [Assignment 20](2026-11-26-next-agent-assignment-20.md)**

## Readiness decision

**No broad readiness go-ahead yet.** The candidate has made substantial progress toward CJ's actual target: CJ and a friend on separate home networks open packaged apps, connect, play, finish, and reopen their retained identity/history. Windows x64 and macOS Apple Silicon artifacts now exist. The friend's platform is already known: **Windows PC**. Do not ask that question again.

Six bounded diagnostics reproduce current correctness gaps in contact proof state, conflict handling, provider retirement, interrupted policy import, relay retry selection, and cancellation status. They are source-method reproductions with controlled dependencies; they are not native Hypercore replication, Electron, Windows, or WAN results. Windows has not yet been executed according to the published implementation evidence. The actual two-network human test remains pending.

An exploratory connection experiment can be useful when its limitations are explicit. It does not confer a representative QE pass, a forced-relay success, or a verified Windows release. Complete the applicable known corrections and agent-side package checks before handing the friend the candidate as ready. Do not make the friend the first tester of known implementation faults.

The shared foundation direction is to stabilize the contracts in [Hapa connectivity v0.1](../protocols/hapa-connectivity-v0.1.md) and its conformance work, then extract proven primitives. This review concerns public Versus material only.

## What this pass inspected

The pinned source is `b42f555e35f7686dd3391e4f00f64a03875b5fb5`. Response 19 identifies macOS app source `c7a00c1308321a79d9bba1bcacf68382cf6626df` and Windows packaging source `fa51315b773e3d336991849a7d868bde0453163c`; those are distinct from the documentation head. The engine remains `ba838cca09ba43afceda0452b63d28df4cbf7f72`, with profile `hapa_open_10x9_v3_07`.

[Evidence and reproduction instructions](evidence/2026-11-26/review-19/README.md) distinguish:

- Pinned source and the implementation agent's published reports.
- Six independent exact-source-method diagnostics. Source imports are supplied by a controlled fixture; actual canonicalization and signing/verification bodies are retained. Ed25519 signatures use Node's implementation with the same raw-key format; tampering is rejected.
- A fresh local browser observation. Its build identity was not exposed, so the image is not attributed to the pinned commit or a released package.
- Evidence not performed: native tests in this reviewer environment, installed Windows execution, an actual forced second-relay session, and the friend's separate-network session.

The source register lists the reviewed GitHub blobs. The diagnostic is reproducible and deliberately asserts the present undesired outcomes; its successful exit means those reproductions completed, not that the app passed acceptance.

## Improvements credited

| Area | What is now present | Remaining evidence boundary |
| --- | --- | --- |
| Native distribution | Published macOS Apple Silicon DMG and Windows x64 portable ZIP; player instructions and evidence form | Windows executable/native modules were inspected on Mac but not run on Windows |
| Provider policy | Typed bootstrap/relay/archive/gateway descriptors, local Hypercore adoption history, configuration forwarded through desktop main and utility host into the runtime | Retirement/import semantics and reliable fallback need the corrections below |
| Contact history | Persistent root identity separated from transport and contact-core keys; signed records, sequence/hash chain, cached snapshots and replication path | Per-revision evidence and cross-source conflict handling are incomplete |
| Join interaction | Stable attempt IDs, immediate return, staged progress, duplicate fencing, cancellation and retry; automatic discovery from Play online | Accepted-attempt cancellation reports the wrong terminal state |
| Prior recovery work | A18 implementation is committed; Response 19 lists completed changes and stages its evidence honestly in the per-finding table | Several installed/native failure cuts remain unstaged; do not describe them all as unimplemented |
| Same-host engineering witness | Installed Mac copy/paste invitation, scripted Ready/concession, matching final result, identity/history after reopening | Automated same-host evidence does not establish a human two-network match |
| Avatar availability | Owner retry/rebind and honest unavailable-owner presentation are implemented; fresh browser shows the owner-rendered Red | Expected appearance and installed owner delivery remain separate questions |

## Current findings

### R19-01 · A newer snapshot inherits an older checkpoint's “core verified” status — P1

**Source:** `src/hapa/network/contact.js:132–148,194`.

After sequence 0 has been verified from a one-record contact core, admitting a valid root-signed sequence 1 snapshot replaces the current routes but retains `evidence: 'core-verified'` whenever an older checkpoint exists. The summary counts the contact as core verified even though the only fetched checkpoint still has length 1.

The diagnostic returns accepted sequence 1, verified checkpoint length 1, and `coreVerified: 1`. The new snapshot is legitimately signed; the defect is the proof claim attached to its newer contents.

**Required correction:** Track the accepted snapshot and verified checkpoint/revision separately. A current descriptor must carry the evidence appropriate to its exact revision. Retain the useful older verified checkpoint without promoting new snapshot contents. Do not refresh a “verified core” freshness timestamp merely because a new signed snapshot arrived.

**Acceptance:** Verify sequence 0, admit sequence 1 without fetching its record, and observe snapshot-only evidence for revision 1. Fetch and validate revision 1, then promote that revision. Preserve rollback rejection and fresh connection-bound identity authentication.

### R19-02 · A conflicting signed snapshot and core record at the same sequence silently overwrite one another — P1

**Source:** `src/hapa/network/contact.js:174–191`.

`admitSnapshot()` rejects a later snapshot at the same sequence with different transports. `verifyCore()` only rejects a core that is older than the accepted snapshot. An equally numbered, independently valid root-signed core record with different transports passes and overwrites the cached route without recording a conflict.

The diagnostic admits a sequence 0 snapshot naming route A, then supplies a valid sequence 0 core record naming route B. Verification returns `{ ok: true, length: 1 }`, the cache changes to B, and the rejection list remains empty. This is a signer contradiction/equivocation case; the test does not demonstrate that a stranger can forge the root signature.

**Required correction:** Compare the authenticated semantic state at equal revisions across snapshot and core sources before advancing the cache. Record a bounded conflict with sufficient evidence to diagnose it, preserve the last accepted usable state, and keep contradictory data from silently becoming normal routing state. Fence concurrent verification/cache updates so a stale completion cannot erase newer accepted knowledge.

**Acceptance:** Valid snapshot/core disagreement at the same revision is refused as a conflict in both arrival orders; matching state succeeds; a genuinely newer continuous history advances; replay, truncation, fork change, malformed records, and delayed verification do not reduce the checkpoint.

### R19-03 · Explicitly retired bootstrap providers are put back into runtime options — P1

**Source:** `src/hapa/network/services.js:121–142,145–166`.

Projection correctly marks retirement as final for a service ID. Effective selection then substitutes `PUBLIC_BOOTSTRAP` whenever no active bundled default remains. In the diagnostic, all three bundled providers are retired and one accepted replacement is active; effective runtime options contain all three retired providers plus the replacement.

The warning acknowledges this behavior but does not make it consistent with CJ's provider retirement requirement. Protecting the user from an accidentally empty replacement must not undo an explicit trust/adoption decision. The same issue affects disabled or expired defaults when the active default set is empty.

**Required correction:** Respect retirement, disablement, expiry, and overlay scope in effective options. Reject an invalid/empty candidate policy before adoption, or enter an honest bounded no-route state. Where the last valid policy is retained, it must still respect accepted retirement decisions. Do not silently move an isolated/replacement policy back to public services or reintroduce a provider by embedding its address outside the policy projection.

**Acceptance:** Retire/disable/expire each default and all defaults with and without an accepted alternative. Inspect the actual options passed to Hyperswarm. No excluded provider is contacted. Empty/invalid replacement has a visible, documented outcome without erasing the adoption history.

### R19-04 · A crash halfway through a policy import permanently marks the whole import complete — P2

**Source:** `src/hapa/network/services.js:126,190–208`.

Every individual imported event carries the digest of the complete configuration. Projection considers that digest imported as soon as any event exists; reopening skips the rest of the same configuration.

The controlled persistence diagnostic imports a two-node replacement policy and interrupts before its second event. Reopening the same configuration retains only its first node, skips the second node and mode change, and stays in default mode. The missing events are not retried.

**Required correction:** Give an adoption batch an unambiguous completion boundary. An atomic append of the accepted batch or a resumable transaction with an explicit completion marker are possible implementations; use the actual installed storage API. Projection should expose the last complete valid policy, and restart must either complete or safely discard an incomplete batch without treating it as fully imported.

**Acceptance:** Interrupt before/between/after the batch's durable steps. Reopen with the same configuration. Observe exactly one complete adopted policy, or the prior complete policy plus an explicit resumable/refused state; never a silently permanent half import. Reapplying a completed configuration appends nothing.

### R19-05 · Recent success pins all retries to a relay that may now be unavailable — P2

**Source:** `src/hapa/network/lobby.js:46–55,64–72`.

The source comment promises candidates not cooling down, but selection has no failure/cooldown feedback. For ten minutes after a relay was observed working, `_nextRelay()` always prefers it. Repeated later requests cannot reach another candidate during that period even if the formerly good relay is now unavailable.

The exact-method diagnostic makes eight successive selections with A recently observed and B available as an alternative. All eight choose A; B's handed count remains zero. This is a deterministic selection finding, not an actual simulated network outage or proof of blind-relay operation.

**Required correction:** Bound how a historical success influences a new unsuccessful attempt. Use installed-library failure/attempt evidence or a bounded selection policy to reach accepted alternatives, with cooldown and recovery behavior that is observable. Preserve a healthy existing session rather than tearing it down for provider selection.

**Acceptance:** Cover unreachable-first candidate and previously-good-then-unavailable candidate. A controlled native fixture must prevent a direct upgrade and demonstrate an authenticated live session through the second relay. Record that transport witness separately from candidate-selection counts. If this environment cannot run the fixture, leave that acceptance pending with the exact blocker; do not replace it with a passing selector test.

### R19-06 · Cancelling an accepted join ends as “failed,” despite successfully leaving — P2

**Source:** `src/hapa/network/runtime.js:170–173,333–342,393–415`.

For an accepted/starting reservation, cancellation invokes `setupLeave()`, which writes the tombstone and clears the reservation. Clearing it calls `_setStage(..., 'failed')`. The subsequent attempt to set `cancelled` is ignored because the attempt is already terminal.

The diagnostic confirms that the tombstone exists and reservation is null; its public attempt still says `failed` with “the table setup ended before the match started,” rather than recording the user's cancellation.

**Required correction:** Carry the intended terminal reason through reservation release. Preserve the durable leave-before-release behavior and exactly-once tombstone. A user cancellation must remain cancelled through late network/worker completions.

**Acceptance:** Cancel while discovering, negotiating, accepted and starting; repeat cancellation; deliver late setup messages. Show the correct terminal state, no revived seat, no fabricated loss, no duplicate terminal side effect, and a usable next attempt.

## Avatar/default appearance clarification

The fresh local browser shows Red present and the renderer reported ready, using the owner's pose art. That is better than the previous empty chair. It is **not a volumetric mesh witness**, and the browser's source revision is unidentified.

Pinned source still selects `red-reaper` by default (`app.js:301–323,346`). It imports Harbor's RedPlayer, binds the returned owner package, and samples that canvas into the seated scene. `seated-avatar.js:4–27,153–164` explicitly documents `red-pose-art 2026-11-02.1`, a frontal 2D rig on a CanvasTexture plane. The empty chair is the owner-unavailable fallback; the rendered portrait is the current normal owner path.

[Addendum 05](../requirements/2026-11-24-human-feedback-addendum-05.md) explicitly recommended reusing that performer on a transparent scene surface and required a deliberate limited-2D orbit policy. Review 18 and Addendum 09 also preserve CJ's expected “mesh/Red” appearance. Response 19 identifies the owner package as built from Mesh Avatar pin `a6fc511`; this does not prove that a separately expected volumetric renderer has been restored or that such a renderer was deleted.

Resolve the expected package/mode using the existing local owner and prior user reference. Show the identified default at Home, close/orbit and in the installed app. If the remaining choice is a product expectation, present the concrete alternatives/evidence to CJ after the investigation. Do not invent a replacement asset or silently bless the photographic plane as a volumetric mesh. Keep a remote human's neutral identity distinct from the local bot's Red performer.

## Qualification still owed

Response 19 explicitly leaves several A18 cuts unstaged: installed Red rendering, delayed Ready append, lost STARTED recovery, worker late/never-ready startup, early terminal closure before remote evidence, delayed counterpart recovery, and the complete selected presentation capture set. These are qualification gaps for the implemented paths. They are not proof that every A18 fix remains broken, and they are not a reason to repeat every old test before any exploratory connection experiment.

Use the candidate and relevant failure boundaries to choose the required cuts for the next readiness claim. Preserve own-seat private journal/terminal semantics, jointly verified result evidence, and archive attribution. One side's local result or an archive lookup must not become a stronger result claim than its actual evidence.

| Claim | Current status |
| --- | --- |
| Candidate source and distributions prepared | Yes, reported and linked in Response 19 |
| Same-host installed Mac invitation and game | Published automated evidence; credited within that scope |
| Windows downloaded artifact launches, native peer works, store reopens | **Pending** |
| Current source correctness for the six findings above | **Reproduced failures; correction required** |
| Actual forced second-relay fallback | **Pending** |
| Two humans on separate normal home networks connect, play, finish and reopen | **Pending** |
| Expected Avatar appearance and installed owner delivery | Browser pose-art presence observed; expected mode and installed witness still require qualification |
| Broad representative QE, full parent milestone and CJ acceptance | **Not granted** |

The next iteration should fix the concrete semantics first, qualify them in the appropriate native/installed layer, then run the friend's actual target. It should not purchase infrastructure, add a hosted account dependency, or use a hotspot as proof that the two original home networks work.

