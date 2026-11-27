# Review 20 — connectivity and delivery, 27 November 2026

Reviewed repository: `calderwong/hapa-verseUs-prototype`.

Pinned head: `da8c9e062984aa7ee870b61e771da38460f57854`; tree `6add5f2d1735b064b507acf9ac71188201f8360b`.

Compared with requirements publication `2acecc19e5d53cf4b3f156975416a129612885b7`: eight commits, 24 changed paths. Implementation changes are focused on contact evidence, provider policy, relay scheduling, cancellation, Windows smoke, and targeted recovery tests. Optional Avatar roster code was not added in this interval. At the reviewed head, pointers still name Review 19 and Response 19; a dated Response 20 report is absent, although `response-20/` contains screenshots and a conformance execution record.

## Conclusion

The agent made substantial progress on the actual prior findings. The earlier contact-proof, symmetric-conflict, retired-provider fallback, partial-import and accepted-phase cancellation failures are corrected in the inspected source and bounded independent diagnostics. Preserve these corrections.

Two remaining implementation defects have exact-source controlled reproductions: cancellation during active match initialization can still open the supposedly cancelled match, and a provider that expires after app startup remains eligible for a later lobby join. An actual authenticated connection carried by the second relay remains an explicitly reported missing witness. The delivery and visual sections below evaluate release metadata, the actual Windows evidence archive and submitted screenshots; a fresh local-browser check is separately scoped.

No broad readiness approval follows from this source pass. The target should remain a concrete, correct two-person candidate; optional Mimi/Falka, Leo and Thor work stays queued without gating the human friend test.

## Review method and evidence limits

- Read current `AGENTS.md`, review index, Assignment 20, changed implementation/tests and the conformance execution record.
- The local Mac grounding and Overwatch board are unavailable in this cloud workspace. No board update is claimed.
- Retrieved and verified 20 exact Git blobs in `source-register.json`.
- Ran `node review-probe.mjs` against the pinned source; exit 0, eight diagnostic groups. The success means the expected repairs and the two remaining bugs were reproduced as asserted; it is not product acceptance.
- The diagnostic strips only module import/export declarations and executes the retrieved bodies with controlled dependencies. Actual canonicalization, fingerprints, signing-domain bodies and Ed25519 signatures are used. Hypercore/persistence and match startup are controlled fixtures. The cancelled-start fixture pre-admits descriptor compatibility because that is outside the lifecycle cut; both session signatures are genuinely verified by the real `_openMatch` body.
- No fresh native replication, full test suite, Electron run, Windows execution or WAN match was performed by this source diagnostic pass. The reviewer separately checked submitted artifacts/CI/screenshots as described below.

## Credited corrections

| Prior finding | Current evidence | Status in the inspected boundary |
| --- | --- | --- |
| R19-01: snapshot inherits older core proof | `contact.js` 148–194, 217–245; probe C1 keeps accepted revision 1 snapshot-only while checkpoint remains revision 0; cache reopen retains it | Corrected |
| R19-02: equal-revision snapshot/core conflict | `contact.js` 162–184, 232–244; probe C2 refuses both arrival orders and preserves previously accepted routes | Corrected |
| Delayed verification | Probe C3 completes older core verification after newer snapshot admission; accepted revision remains newer and snapshot-only | Corrected for staged cut |
| R19-03: retired defaults reappear through fallback | `services.js` 162–184; probe P1 hands only the accepted replacement to runtime policy, then returns an explicit empty/no-route state when it is disabled | Corrected |
| R19-04: interrupted multi-record import counted complete | `services.js` 130–149, 198–254; probe P2 interrupts at 1/2/3 durable records, reopens, applies completed batch once and retains incomplete history unapplied | Corrected in controlled storage; new submitted test uses actual Hypercore |
| R19-05: formerly successful relay never yields | `lobby.js` 65–92 now introduces failure/cooldown rotation; targeted test exists | Selector improved; actual second-relay carriage and truthful concurrent-attempt attribution remain to qualify |
| R19-06: accepted cancel relabeled failed | `runtime.js` 408–421; probe A1 retains cancelled, writes one tombstone and releases accepted reservation | Corrected for accepted cut; active-opening cut remains below |

New `recovery-native.test.js` stages meaningful inherited boundaries: lost STARTED, delayed Ready append, early terminal restart and delayed counterpart evidence after retirement. This is appropriate tightening work. Source test presence is not itself proof that every relevant run passed, and these same-host fixtures do not establish two-home play.

## Finding V20-A — Cancel can report success while the same match opens

**Priority:** high. This affects the consent/lifecycle boundary of the friend connection flow.

**Paths:** `src/hapa/network/runtime.js` 408–421 (`cancelAttempt`), 576–589 (`_onStart`), 632–652 (`_openMatch`).

The joiner accepts START, persists an active session, changes its reservation to active, creates `this.match` and awaits `m.open()`. The connection attempt still says negotiating during this await. `cancelAttempt` reports cancelled immediately, but its durable cleanup only handles reservation phases accepted/starting. An active reservation is skipped both immediately and after the queued setup step. `_openMatch` then emits `match/opened`, and `_onStart` sends STARTED. `_setStage` correctly keeps the already-cancelled attempt terminal, making the contradiction persistent.

Controlled reproduction A2:

1. Supply a valid already-admitted START with real session signatures.
2. Hold the `OnlineMatch.open()` completion after the reservation becomes active.
3. Cancel the still-negotiating attempt.
4. Release match initialization and wait for serialized cleanup.

Observed: `attempt=cancelled`, `reservation=active`, live authority retained, zero tombstones, one opened event, one STARTED message, and durable `session.phase=active`.

**Direction:** choose a single atomic activation boundary shared by runtime, persistence, attempt state and UI. Either cancellation still owns this cut and must fence/close the initializing authority and durably leave it, or this cut is already connected and Cancel must clearly report that it is no longer cancellable. Never return cancelled while publishing an active match. Avoid a new writer or a fabricated loss/concession. Carry cancellation/generation fences through awaited initialization and completion events, and make restart reconciliation agree with the selected outcome.

**Focused acceptance:** delay actual native match initialization; exercise cancellation before and after the selected activation boundary; assert returned status, events, messages, durable session/progress/tombstone and reopened state agree. Include duplicate cancellation and a subsequent new attempt. Preserve the corrected accepted-phase case. This strengthens the current HC-10 scope rather than replacing its useful tests.

## Finding V20-B — Time-expired providers can be reused after runtime startup

**Priority:** medium. Provider policy truth becomes stale in a long-running app.

**Paths:** `src/hapa/network/services.js` 130–150, 231–233, 264–280; `src/hapa/network/runtime.js` 94–95, 176–184, 240–246.

Expiry is applied when `project()` executes. `ServicePolicy.open()` caches `projection` and `effective`, and `PeerRuntime.open()` caches that result as `this.policy`. A later `joinLobby()` constructs its transport options directly from the cached policy. No refresh occurs before that new join, relay selection, or the subsequent retry path. Diagnostics also retain the old active state.

Controlled reproduction P3:

1. Adopt one bootstrap that expires a minute later and retire the bundled defaults.
2. Open the policy/runtime while the provider is valid.
3. Advance the controlled clock past expiry, then invoke the exact `joinLobby()` body.

Observed: the expired bootstrap is passed into the newly constructed Lobby, and summary still reports active. Reprojecting the same history at join time returns no eligible bootstrap.

**Direction:** compute eligibility at new-use boundaries using a current clock, including new join/rejoin/attempt and relay selection. Preserve stable provider history and identity; a clock transition is not a reason to append duplicate adoption events. Keep diagnostics consistent. Define separately whether an existing healthy session may finish; expiry of a discovery route should not automatically eject players or fabricate a game outcome.

**Focused acceptance:** with a controlled clock, cover bootstrap and relay expiry between open and join/retry; ensure expired entries are excluded and the next compatible eligible route or an honest no-route state is used. Preserve the retired/disabled exclusions already corrected.

## Relay qualification direction

The submitted conformance record correctly marks HC-09 partial. Its note says no authenticated session was forced through the second relay with direct upgrade prevented. Keep that limitation explicit and avoid repeating the same unchanged single-host fixture.

`Lobby._nextRelay()` 76–92 also treats every new callback as evidence that each previous unobserved handout failed. The selection state is global, not associated with a peer/attempt. A new handout can be requested for another concurrent connection before the preceding connection has had time to succeed. When all entries cool down the method immediately returns one anyway; the scheduler does not itself wait for that cooldown. The current test deliberately expects immediate selection in this exhaustion branch. These are source-level attribution/scheduling concerns, not a demonstrated public-relay outage.

The native witness should therefore cover both provider failure and concurrent consumers. Separate handed-out, awaiting-outcome, confirmed-carrying, timed-out, and exhausted states; do not report an unrelated handout as a measured network failure. If the upstream callback cannot supply per-attempt outcomes, document a conservative unconfirmed-rotation policy instead of overstating it. Demonstrate the selected second provider actually carries the authenticated stream in a feasible fixture, or report the exact external boundary after completing available implementation.

## Evidence and handoff corrections

`docs/reviews/evidence/2026-11-27/response-20/conformance-execution.json` names its commit as `see Response 20`, but no Response 20 exists at this head. It also still says no second consumer exists, although the companion application now has an implementation. Replace the placeholder with exact source identities and links to actual commands/runs/artifacts. Preserve the honest per-case evidence levels and explicit pending WAN/relay cases. Qualify HC-10 and HC-06 with the newly reproduced cuts above.

Current docs still point to old responses and Windows status. The Windows/release checks below supersede the old Windows-never-run wording in current pointers. A test filename, screenshot filename or green aggregate job is insufficient evidence for a broader unasserted behavior.

## Verified delivery progress — Windows execution now exists

The [friend.4 prerelease](https://github.com/calderwong/hapa-verseUs-prototype/releases/tag/v0.1.0-friend.4) contains Mac arm64 and Windows x64 artifacts from clean source `bd35cecb6dcefb67fcd47ecac7a9ad8eca07bcc1`. The reviewed HEAD adds evidence only. This reviewer inspected [run 45967513759](https://github.com/calderwong/hapa-verseUs-prototype/actions/runs/45967513759), its job logs and downloaded evidence artifact 15182873616. The 6,541,094-byte ZIP matched SHA-256 `e278290903944b2616bb82e4bf769042f58ce6e4ab08b13cfa047c3439f6bf3b`.

The archived JSON supports concrete credits:

- Windows Server 2025 x64 executed the released Windows ZIP after matching its 167,153,853-byte size and SHA-256 `3e2df857dacb52826a289f2a1eab3e1bda787b58dae9e655c812e88c5d5faaff`.
- Two launches in an isolated data root and two in the OS user-data folder retained their respective player identities, grew their stores, started the native transport and kept data outside the bundle.
- Two installed instances on that VM used the public DHT with a test namespace, joined by invitation, each issued four Ready actions, and finished by an explicit seat-B concession. Both recorded the same final hash and reopened with the same identities and retained result. This is an automated two-human-seat journey, not two people or independent networks.
- The late worker-start case reached ready on generation 2. The never-ready case reached a bounded failed state on generation 4 and exposed that state to the page. Both archived assertions passed.

The workflow uses `continue-on-error` on some steps; this review read their JSON instead of relying on the green aggregate job. The workflow should assert those required results and fail on a missing/failed report at future release qualification.

**Remaining delivery limits:** no ordinary browser download/Mark-of-the-Web/SmartScreen/firewall witness on a consumer Windows machine, no Mac-to-Windows independent-home session, no CJ acceptance, and no forced second-relay carriage. The ZIP is unsigned. A CI download does not establish a frictionless first-player launch. Preserve these distinctions while crediting the real Windows execution.

## Finding V20-C — reconcile the actual installed Avatar and its evidence

**Priority:** medium; required selected presentation/delivery follow-through, separately tracked from human connectivity correctness.

The committed browser home image visibly renders Red. The submitted `a7-installed-red-mac.jpg` visibly shows an empty chair, despite its filename. No matching installed-Red JSON or owner/package manifest accompanies it in the response-20 tree. The new `desktop/smoke.mjs:65–75` checks player/frame flags, but those flags and a filename do not establish a visible figure in the installed scene.

A fresh reviewer browser visit to the documented local preview independently showed the setup status **red-pose-art 2026-11-02.1, ready**, Red at Home, music ready, and a single Ready transition through resolving to Tick 2 planning. That live preview has no inspected commit stamp, so it is not evidence that a particular release contains the renderer. Its captured home view is in this review's evidence folder.

Use the actual owner package; record its real renderer kind/revision and approved asset path through the installed app. A pose-art package is not proof of volumetric geometry. Qualify owner available, absent, and recovered in the same installed match; show one performer, visible Home/close/orbit composition, and truthful degradation. The submitted close shot crops the face, so assess framing against the intended camera task rather than asserting that any emitted frame is usable. An optional owner outage must not block legal human play, and the human friend test must not acquire an unrelated requirement for the new optional roster.

Mimi/Falka, Leo and Thor remain selected in Addendum 11 / Assignment 21. Their roster implementation is not present in this diff. Preserve that task; do not mark the new players delivered from Red evidence.

## Finding V20-D — make the implementation handoff and current pointers agree

**Priority:** medium evidence/handoff correction.

Publish the missing Assignment 20 accounting or explicitly incorporate it into Response 22. The execution ledger's `commit: "see Response 20"` must become exact source/build/artifact identities and actual result paths. HC-06 and HC-10 retain the corrected cases but must disclose the new expiry and active-opening cuts. HC-24 should say that a second application implementation exists while shared code adoption/extraction remains unproved.

Keep current README/download/player/runbook pointers on friend.4 and this review, with the qualified Windows evidence above. Historical Response 19 and old reviews remain unchanged historical records. The source, executable, screenshot, test report and claimed evidence level must be independently identifiable.

## Shared Hapa direction

The shared connectivity contract and catalog remain unchanged. A second application implementation now exists; this is an opportunity to demonstrate common semantics, not proof of a common SDK. First standardize a small conformance evidence envelope: app/source commit, contract and catalog digests, protocol/schema/dependency versions, implementation path, case ID, exact command/result, evidence level and limits.

Prove three small boundaries through application adapters: attempt/cancellation lifetime, provider adoption/retirement/current eligibility, and durable append/remote receipt stages. Keep local intent, local durable append, remote signed head, remote available blocks, application admission and retained copy distinct. Game authority and archived signature domains remain Versus-owned. Extract a pinned module only after the same cases pass in both consumers. No new CJ-operated VPS or framework migration is justified by these findings.

## Current direction and readiness

[Assignment 22](2026-11-27-next-agent-assignment-22.md) continues and consolidates the remaining Assignment 20 work. Correct V20-A/B, qualify relay attribution/carriage, finish installed Avatar delivery, and publish an exact handoff. Preserve all credited fixes and the useful Windows evidence. [Assignment 21](2026-11-26-next-agent-assignment-21.md) stays queued for optional players after the relevant foundation is reconciled.

**Status: substantial candidate progress; changes required before a dependable friend-test recommendation.** A controlled exploratory network attempt remains useful, but it must be labeled as such. Review acceptance, consumer launch qualification, the real two-home human game, broader QE and CJ acceptance are separate.

This publication changes review documents, pointers and diagnostic evidence, not application code, releases or the Overwatch board. Evidence and reproducible commands: [Review 20 evidence](evidence/2026-11-27/review-20/README.md).
