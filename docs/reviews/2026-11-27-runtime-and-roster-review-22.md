# Review 22 — friend.6, connection readiness and the Players roster

**27 November 2026 · independent review assistant · reviewed `164aa5dc6eb96ee4b4cc4eab6f0cdb2298554536` · released implementation `fe6584ae29d51809c87b128767d11b49f1818da4` · next work: [Assignment 24](2026-11-27-next-agent-assignment-24.md)**

## Decision

**One bounded multiplayer lifecycle correction remains before a dependable friend-test recommendation.** Response 23 corrects the previous STARTED activation bypass, configured-archive expiry and relay-descriptor caching findings. The relay qualification now demonstrates authenticated carriage in the stated controlled native topology. Preserve that progress; do not repeat the prior findings as unresolved.

The remaining multiplayer issue is a different boundary: the full authenticated-connection callback can attach a match while its remote feed does not yet exist. The source-level reproduction is deterministic; this review does not claim an observed installed-worker crash, a measured WAN failure rate, or failure of the normal friend.6 invitation journey.

Two smaller findings accompany it: the older Avatar checkbox bypasses the new local roster preference, and the relay stage-2 report gate accepts an absent third peer report. The roster is optional and does not gate human-versus-human play. The report-gate defect does not invalidate the successful run, which contains all expected reports.

Friend.6 remains available for an explicitly exploratory two-home test with these limits understood. For CJ's intended simple handoff to a Windows friend, fix V22-01, qualify the changed candidate once, then move to the concrete human test. Consumer downloaded launch, two-home success and CJ acceptance remain separate observations. No new VPS, archive, universal SDK or fleet-wide Base Node adoption is a prerequisite.

## Baseline and evidence

The comparison is from the Base Node documentation commit `a219c77ea3e114e4860da7b3ac9f6d243d0c5ff3` to the reviewed head: six commits, including [Response 23](2026-11-27-implementation-response-23.md), its evidence, and the roster slice. Friend.6 is built from clean `fe6584a`; the subsequent head adds its response and documentation. The engine remains `ba838cca09ba43afceda0452b63d28df4cbf7f72`; profile `hapa_open_10x9_v3_07` and the existing protocol versions remain unchanged.

The [review evidence packet](evidence/2026-11-27/review-22/README.md) includes:

- 211 source/document/evidence files verified against the pinned Git blob hashes; three unused desktop icon files and the engine submodule were not materialized.
- Five controlled runtime diagnostic groups using exact source bodies and real Ed25519 session/hello signatures, with controlled persistence, transport, feed readiness and game loops.
- A controlled setup-handler/roster reproduction and a controlled execution of the exact relay report aggregator. The coordinating reviewer reran all three probes; all exited 0 because their documented corrections and failures were reproduced.
- Primary GitHub release/tag/run/job/artifact metadata and decoded Windows/relay logs inspected by the delivery reviewer, plus submitted Mac reports and the roster screenshot.

The developer reports `npm run check` **195/195**, two-process peer match and build on the release source. This reviewer did not rerun the full suite or native packages; native dependencies and the engine checkout were unavailable in this workspace. The controlled diagnostics are not native, installed, or independent-network qualification. Release asset/archive hashes below are reconciled from GitHub metadata and primary CI logs; the reviewer did not independently download their binary bytes in this pass.

Fresh live UI navigation was attempted through the connected browser but blocked by the browser connection's HTTP 401. No live game state was reached. The UI assessment therefore uses the exact source handlers and the submitted screenshot, not a new browser observation. The private owner records and local Overwatch board were not independently read or updated; the local agent must reconcile actual board state through its configured workflow.

## Previous-pass dispositions

| Previous item | Review 22 disposition |
| --- | --- |
| V21-01 / N23-01, reconnect first-activation | **Corrected at the reviewed cut.** Held initialization and cancelled attempts emit no STARTED through reconnect or duplicate START; cleanup leaves one tombstone, no authority/reservation and no opened event. Legitimate retransmission after activation is preserved. V22-01 concerns the following connection-attachment callback, not a persistence of the old STARTED bypass. |
| V21-02 / N23-02, archive expiry | **Corrected.** A later join uses current configured eligibility, omits the expired archive, preserves explicit precedence and adds no history merely because time passed. Already healthy transports remain distinct from new configured dials. |
| V21-03 / N23-02, relay cache identity | **Corrected.** Same-id key/endpoint replacement uses new key bytes and resets endpoint-specific confirmation/suspicion/cooldown. |
| V21-04 / N23-03, relay carriage | **Credited at controlled native-fixture scope.** Successful run 46101799012 contains both stage-1 peers and all three stage-2 peers, authenticated relayed paths, and respectively one and three matched relay pairings. Dead preferred relay and concurrent live alternative are observed. Exhaustion remains unit-level evidence; public two-home relay service and all NAT types are not established. |
| N23-04, packaged delivery | **Credited at the recorded boundaries.** Windows released-zip workflow is genuinely gated and passes six mandatory reports; submitted Mac installed smoke/invitation/reopen evidence agrees with the same source/artifact. Ordinary consumer launch and two-home human play remain pending. |
| Red and owner recovery | Preserve the prior installed 2D mesh/pose-art evidence where rendering/owner/delivery dependencies are unchanged. This pass does not establish new animation performance or a volumetric renderer. |
| Assignment 21, new optional players | **Partial.** Local roster scaffold/preferences are present; Falka/Mimi, Leo and Thor presentations are not yet served/playable, and online availability is explicitly unimplemented. Response 23's phrase “local slice done” must be narrowed to the delivered roster scaffold. |

## V22-01 — P2: authenticated reconnect attaches a match before its remote feed exists

**Source:** `src/hapa/network/lobby.js:243–246,257–258`; `src/hapa/network/runtime.js:300–304,701–717`; `src/hapa/network/online-match.js:62–67,82–85`; the new regression at `tests/hapa/connectivity.test.js:343–403`.

After successful authentication, Lobby calls `_onPeer(peer, 'joined')` and then `_onConnection(peer, conn)`. The new activation guard makes the first callback safe for STARTED. The second callback attaches each matching nonclosed authority, including `this.match`, while `_openMatch` has already made that authority visible before awaiting `open()`.

`OnlineMatch.open()` creates and awaits the own feed before creating the remote feed. `attach()` immediately calls `replicate()` on both. Holding `own.ready()` creates a real asynchronous boundary at which the remote feed is undefined.

**Reproduced:** a valid signed synthetic hello reaches the actual Lobby authentication dispatch while the actual OnlineMatch opening body waits at that boundary. Authentication succeeds; STARTED is correctly withheld; own-feed replication begins; remote replication throws `TypeError: Cannot read properties of undefined (reading 'replicate')`. The exception escapes the handshake to the probe's outer catcher. Releasing readiness after that catch allows both feeds to attach. Controlled transport/storage/Hypercore readiness are used; no native-worker termination or real internet failure is claimed.

**Required direction:** defer or safely reject connection attachment until the authority is ready, then use only its current eligible connection and current generation. Apply the rule to fresh authentication and standby promotion. Preserve closure/cancellation/tombstone ownership and truthful connection state. `_openMatch` already retrieves the current peer after readiness, so a small deferral may be enough.

Do not blanket-gate attachment on the STARTED `activated` flag: finishing authorities still need replication for result recovery. Do not swallow the exception and report a connected match after only one feed attached.

**Acceptance:** one focused native regression traverses the complete authenticated reconnect callback while feed readiness waits, including the following `_onConnection`; release readiness and verify both feeds attach to the current connection without an exception. Include cancellation/closure while deferred and preserve fresh play, activated retransmission and finishing-result recovery. The existing `_onPeer`-only regression remains useful but does not cover this full callback.

## V22-02 — P2, local setup only: the legacy Avatar checkbox bypasses roster eligibility

**Source:** `src/hapa/presentation/app.js:324,331–337,363,488–493`; `src/hapa/presentation/roster.js`.

Normal-control sequence: disable Red's **In my roster** checkbox, which correctly clears the selection; then check the older **An Avatar plays the bot seat … Red by default** checkbox. That handler unconditionally writes `avatarId = 'red-reaper'`. Red becomes selected while its roster flag remains false, and **Play this game** is simultaneously checked and disabled. Reopening setup preserves the contradiction in the two preference records. The ordinary Start path consumes `_tableChoice` without rechecking roster eligibility.

The probe runs the exact setup method and roster module with controlled DOM-shaped elements, storage and an owner-capability response. It directly establishes handler/persistence inconsistency; it does not claim an installed or freshly rendered game observation.

**Required direction:** use one coherent selection operation for both entry points, preferably consolidating the redundant top checkbox with the roster choice. Alternatively, explicitly enable-and-select or reject an ineligible selection with useful guidance. Validate the choice at Start and preserve an explicit play-without-figure option. Reopening setup must retain a consistent state.

Keep clean-state Red as the supported default, two seats, one authority per seat, controller/performer separation, unavailable packages disabled and online availability unadvertised. A roster edit must not start networking/inference, alter an active match or select another figure silently.

**Presentation note:** the submitted roster screenshot exposes long renderer/package/revision tokens in ordinary setup rows. The selected optional-player contract already calls for concise rows and inspectable detail. While unifying the controls, use a short name/status and place owner/renderer/revision detail behind Details or a disclosure. This is a small readability adjustment, not a new art or animation project.

This finding and the unserved optional packages are **not human-versus-human friend-test gates**.

## V22-03 — P3, evidence harness: stage 2 can pass with a missing third report

**Source:** `tools/hapa/relay-nat-witness.sh:69–71`.

The aggregator filters absent files and requires `len(peers) >= 2` for both stages. Running the exact embedded Python aggregator against the successful stage-2 evidence after removing `peer-c.json` still produces `ok: true` and exit 0.

| Controlled report set | Expected | Observed |
| --- | --- | --- |
| All three stage-2 peers | Pass | Pass |
| Missing Peer-c | Fail | **Pass** |

**Required direction:** require the exact expected peer membership/report count for each stage; reject missing, duplicate or invalid required reports. Refresh comments that still describe the old forced-relay/failing topology. A small aggregation regression is sufficient.

Run 46101799012 actually contains all expected reports and primary-log evidence. This finding does not revoke that success, require rebuilding friend.6 by itself, or create a new public-relay prerequisite. Reuse the carriage evidence unless the relevant networking/topology dependencies change.

## Delivery and optional-owner boundaries

| Evidence | Observed identity and scope |
| --- | --- |
| [friend.6 release](https://github.com/calderwong/hapa-verseUs-prototype/releases/tag/v0.1.0-friend.6) | Tag resolves to clean `fe6584ae29d51809c87b128767d11b49f1818da4`; Mac arm64 and Windows x64 assets. |
| Windows ZIP | 167,159,216 bytes; SHA-256 `5de102acd5d3846bbdf2e0c374e6d33b0130a177e70e53abee5e90f25a7e1624`. |
| Mac DMG | 124,517,204 bytes; SHA-256 `2b48c1cd8d889fee7c0503950f75006218f3b35b75944f4ceab61a2c56557616`. |
| [Windows run 46102314253](https://github.com/calderwong/hapa-verseUs-prototype/actions/runs/46102314253) | Primary job 140847288357 verifies the released ZIP hash/size, two-launch identity/store behavior in isolated and OS data folders, same-VM invitation/result/reopen, late/never-ready startup and all six required reports with zero failures. Windows Server 2025 is not the friend's consumer machine. |
| [Relay run 46101799012](https://github.com/calderwong/hapa-verseUs-prototype/actions/runs/46101799012) | Primary job 140845683278 verifies randomized-NAT stage 1 and 2 with actual relay pairings and authenticated streams. Fixture service, not a bundled/public relay. |
| Mac installed reports | Submitted source/artifact-bound two-launch and same-host invitation/reopen results inspected; macOS execution was not repeated here. |
| Actual two-home journey | Still pending: CJ on Mac and the known Windows friend, normal download/extract/open, connection, human game and retained matching result. |

Response 23 records Falka `avatar-8` with Mimi as a user-authorized alias, Leo `avatar-46`, Thor `avatar-39`, and candidate Mesh Avatar package references. This review preserves those reported bindings; it did not independently retrieve the private owner records. Attach the source-linked owner worksheet/receipts when implementing the actual served presentations. Do not fabricate routes or substitute figures to make the optional roster look complete.

The current checkpoint still said “the reviewed diff has no roster implementation.” This publication corrects that stale statement and updates the README, review index, AGENTS, integration index, checkpoint, runbook and player status together. Historical reviews/responses remain intact.

## Next milestone and stop condition

[Assignment 24](2026-11-27-next-agent-assignment-24.md) is one bounded batch: readiness-aware attachment; coherent roster selection; exact relay-report membership; then one integrated qualification and a source/build/artifact-bound Response 24. Publish a new candidate if application code changes. Preserve unchanged evidence and all ownership/protocol boundaries.

After that batch, the next decision-changing step is the real two-home human test. If it exposes a failure, use the actual connection report and observed boundary to choose the next repair. Optional Avatar owner delivery and standards adoption remain recorded work, not reasons to postpone the human test indefinitely.
