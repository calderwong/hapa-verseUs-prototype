# Review 21 — reconnect boundaries and friend.5 delivery

**27 November 2026 · independent review assistant · reviewed `d0be02d0e4a7b6f6132ce499bf0d45d82b30327f` · next work: [Assignment 23](2026-11-27-next-agent-assignment-23.md)**

## Decision

**Changes required before a dependable friend-test recommendation.** Response 22 delivers substantial corrections and much stronger installed evidence. The original cancellation-during-open cut is repaired, current bootstrap/relay eligibility is re-evaluated, the Windows qualification is now gated, and installed Red is visibly demonstrated. Those findings should not be repeated as if no work happened.

Two related source boundaries still fail: reconnect can send STARTED for a cancelled, initializing attempt; newly initiated archive connections still consume a startup cache after the provider expires. Relay carriage remains unqualified. A separate dynamic relay-key cache finding concerns the reusable component interface, not a currently exposed friend.5 UI operation.

The current builds may be used for an explicitly exploratory test with these limitations understood. This review does not certify the complete across-town journey, and the optional Avatar roster is not a prerequisite for human-versus-human play.

## Source and evidence

The comparison is from review publication `676c3352ce17a101161f7ad9b48aded9710d1c34` to the reviewed head: ten commits, including [Response 22](2026-11-27-implementation-response-22.md). Release **friend.5** is built from clean source `aabb62a0a99b541b5bad41f54a827cbedbf102b6`; the reviewed head adds its report/evidence.

The [evidence packet](evidence/2026-11-27/review-21/README.md) contains seven controlled diagnostics, exact source identities, primary dependency references, release/CI observations and a separately qualified fresh browser screenshot. The diagnostics use the real source bodies, canonicalization and Ed25519 signing/verification with synthetic persistence, transport and awaited match initialization. They are not native, installed-app or WAN tests. Exit 0 means that the documented corrections and remaining failures were reproduced.

The reviewer independently downloaded Windows Actions artifact `15233744634` from run [46074882482](https://github.com/calderwong/hapa-verseUs-prototype/actions/runs/46074882482), verified its SHA-256 and inspected the actual reports. The submitted macOS results and images were read and visually inspected; macOS/Electron execution was not repeated by the reviewer. No broad suite was rerun. The developer's `npm run check` summary reports 192/192 plus peer match/build on the candidate.

## Disposition of the previous pass

| Previous item | Current assessment |
| --- | --- |
| V20-A, cancel while `OnlineMatch.open()` waits | **Original cut corrected.** One tombstone, no opened event or STARTED, authority released, `abandoned_setup`. Post-activation Cancel answers connected/use Leave. V21-01 below identifies a different reconnect path bypassing that boundary. |
| V20-B, expiry after app startup | **Bootstrap and relay cuts corrected.** Fresh join sees no-route after expiry without adding history. Archive-use caching remains in V21-02. |
| Concurrent relay requests/exhaustion | **Selection semantics corrected.** A burst rotates without immediately calling previous handouts failures; all-cooling returns no relay. Successful carriage is still not established. |
| V20-C, installed Red proof | **Delivery evidence now adequate for the shown 2D owner renderer on Mac.** Visible outage/recovery in the same match, Home/orbit/close and Tick 1→2 are recorded. This does not establish a volumetric model or distribution of the owner assets to the Windows friend. |
| V20-D, missing response and weak Windows gate | **Response and gate delivered.** Source/build/artifact identities now exist and all six mandatory Windows reports passed. Active README/player/runbook/index text still contradicted this evidence; this publication reconciles it. |
| Older contact proof, committed import, accepted-cancel and recovery cases | Preserved and credited at their previously recorded scope. No new broad rerun was performed in this review. |

## V21-01 — P1: reconnect can activate the counterpart after Cancel

**Source:** `src/hapa/network/runtime.js:273–280,426–448,603–626,644–665,675–685` (`_onPeer`, `_resendStart`, cancellation and activation paths); exact reproduction is in the diagnostic packet.

The first-send path now checks cancellation after opening the authority. `_resendStart()` separately sends STARTED when the reservation is active and `this.match` exists. An initializing authority already satisfies those conditions, and peer reconnect invokes this resend outside the setup queue. The resend does not enforce the same tombstone/activation ownership check.

**Reproduced sequence:** hold match initialization; cancel the attempt and observe its durable tombstone; invoke the exact reconnect resend path before initialization completes. The exact resend emits a correctly signed STARTED. Delivering that message through the counterpart's exact `_onStarted()` path produces an active reservation/session and one opened event. When the cancelled side's initialization is released, it cleans up and sends decline. The observed wire order is **STARTED → decline**, while the originating attempt remains cancelled.

The local original fix still works; the missing invariant is across all send, resend and recovery entrances. This is not an observed internet match, but the controlled receiver demonstrates that the message is actionable, not just an unused log entry.

**Required direction:** centralize or consistently enforce activation ownership. A resend must only repeat an already established, current, non-cancelled activation; existence of an authority object is insufficient. Persist/reconcile that distinction as needed for restart and lost-STARTED recovery. Preserve the existing successful lost-STARTED behavior. Add one native regression for reconnect while opening, both before and after Cancel, including delayed completion and counterpart observation. Do not invent a concession or loss from cancellation/disconnection.

## V21-02 — P2: expired configured archive is still dialled at later use

**Source:** `src/hapa/network/runtime.js:105–106,183–189,206–207`, initialization of `this.archives`, `_policyNow` and `joinLobby`; inspect archive-result paths in the same correction.

`ServicePolicy.refresh()` removes the expired archive from the effective policy, but `this.archives` was copied at startup and is not refreshed alongside it. A subsequent join automatically dials that cached archive. The diagnostic observes eligible archive count **0**, cached archive count **1**, provider state **expired**, and a dial to the expired configured transport.

The default packaged configuration has no archive providers. This is a configured-service extension-path defect, not a requirement to deploy an archive or a blocker in the default human game flow.

**Required direction:** new automatic configured-service operations must use current eligibility for every applicable role. Separate those choices from explicitly supplied archives, retained evidence and already healthy transports; document their precedence/lifetime rather than silently treating all as permanently adopted. Check new join, retry, result submission/query and any other new archive dial. Keep identities, old signed records and provider history unchanged. Do not disconnect a healthy human game merely because a discovery provider ages out.

## V21-03 — P3 component finding: changed relay key retains old cached bytes

**Source:** `src/hapa/network/lobby.js:67–74,105`, `_relayList()` and `_nextRelay()`.

A dynamic list replacing a relay descriptor under the same service id updates its displayed key/endpoint but retains its old cached key buffer. The component diagnostic lists key prefix `bbbbbbbb` while handing out `aaaaaaaa`.

**Scope:** friend.5 does not expose live policy editing in its packaged UI; a fresh runtime imports configuration into a new cache. This is not evidence that ordinary friend.5 players encounter live rotation. It is relevant to the selected replaceable-provider foundation and is inexpensive to correct alongside V21-02.

**Direction:** key cache identity by the actual descriptor/key revision, or rebuild key bytes and reset endpoint-specific evidence when the adopted descriptor changes. Preserve suitable stable service history without attributing the old endpoint's confirmations to the replacement. Add a same-id/key-change component regression. Do not add a live provider editor as part of this task.

## V21-04 — relay carriage remains partial; change the next experiment

Response 22 correctly retains HC-09 as partial. The latest inspected [namespace run 46073663908](https://github.com/calderwong/hapa-verseUs-prototype/actions/runs/46073663908) failed its witness: DHT discovery and relay sessions existed, but only one side of each pairing arrived. The single-relay control also failed. Selection counts do not prove authenticated traffic through the second relay.

There is a concrete **hypothesis**, not yet a proven cause: the fixture routes DHT packets freely while dropping only peer-to-peer packets. In pinned HyperDHT `v6.37.0`, [connect.js](https://github.com/holepunchto/hyperdht/blob/v6.37.0/lib/connect.js) sets the advertised firewall state to OPEN when `dht.remoteAddress()` exists (432–456). [server.js](https://github.com/holepunchto/hyperdht/blob/v6.37.0/lib/server.js) returns through its OPEN/direct branch before `_relayConnection()` (437–445). Pairwise packet filtering can therefore disagree with the reachability classification used by negotiation. This is consistent with the observed one-sided pairing and should be instrumented before another broad fixture rerun.

**Next experiment:** two peers and one live relay; record both endpoints' advertised firewall state, selected direct/relay branch and redacted pairing correlation. Use a topology or supported test fixture that actually exercises relay negotiation while preventing direct carriage. First prove the single-relay authenticated stream. Then add the unreachable preferred relay, eligible alternative, concurrent consumers and cooling exhaustion. Preserve identity and verify actual payload exchange. If still blocked, report the exact branch/topology and smallest next experiment; do not repeatedly rerun an unchanged setup or buy a VPS to mask a fixture error.

HC-09 completion qualifies provider fallback. It is not a blanket prohibition on an explicitly scoped exploratory direct-route friend test.

## Installed delivery and visual assessment

### friend.5 artifacts

| Platform | Source / artifact | Inspected evidence |
| --- | --- | --- |
| Windows x64 | `aabb62a…`; 167,156,741-byte zip; SHA-256 `c2ccca726b45d5c0a609dbbea1496064604c27de4ab3ddb109059306f36f1db9` | Windows Server 2025 x64 run: isolated and OS-data two-launch checks, stable identities, stores outside bundle, native transport, same-VM two-instance invitation game, matching result/reopen, late/never-ready lifecycle. All six required reports present and passing. |
| macOS Apple Silicon | same source; 124,520,594-byte DMG; SHA-256 `72e4fc0fe5fdd7255a79bd610e406c4c986ce29c95520824549b57550e6fa02e` | Submitted installed clean-runtime, invitation/result/reopen and visible Avatar outage/recovery evidence. Ad-hoc signed, not notarized. |

The downloaded Windows evidence ZIP is 6,541,714 bytes, SHA-256 `073ea6e99c45e5ab9dc5177a1c770e4a2e4934141622deb11c5263483908d046`. Both seats recorded final hash `sha256:686e649aede96c67f4a9c0da0f4e961b426e242b552b429031cd04fd77394b03` after four Ready clicks and B's explicit concession; identities/results persisted on reopen. This is a Windows VM with two instances, not two homes or a human playtest. The CLI download carries no Mark-of-the-Web; ordinary consumer SmartScreen/firewall handling remains unobserved.

The new installed Red captures show a visible performer at Home and a usable head-and-shoulders close view. The side view remains constrained by the 2D pose-art presentation. The owner package is identified as `red-pose-art` revision `2026-11-02.1`, renderer `red-pose-art-speech-v2-idle-v2`, manifest SHA-256 `fc2d4d6cf1ea70eb83403ab842a0d85374b71039bd5afc218677f14301be1098`. The report describes a rigged 2D mesh over pose art; no volumetric Red model is demonstrated. Keep that wording in the roster/renderer UI. The clean Windows run has optional owner routes absent and still plays legally.

A fresh local Chrome visit to `http://127.0.0.1:5199/versus.html` showed Red selected by default, a visible Home performer, three available songs, and one Ready leading from resolving to Tick 2 planning without a second acknowledgement. The local checkout/build identity was not established, so [this screenshot](evidence/2026-11-27/review-21/browser-red-home.jpg) is an **unversioned live-browser witness**, not proof of the release payload. It does not establish animation smoothness, audio output, reduced-motion performance or multiplayer behavior.

## Handoff and optional roster

Response 22 exists and accounts for the earlier Assignment 20 work. Current docs still mixed friend.4, friend.5, the old `bd35cec` source, the old empty-chair conclusion and an absent-Response-20 claim. This review publication fixes current pointers while retaining dated reports/evidence unchanged. Future handoffs should reconcile all active pointers as a single small final step.

Assignment 21 remains selected and queued: Mimi/Falka, Leo and Thor, local enablement, per-game selection and separate explicit online availability. Response 22 reports owner rigs for Falka, Leo and Thor and an unresolved Mimi/Falka alias, with no serving routes or roster implementation. Do not invent ids/assets or start multiple model sessions. Resolve owner bindings through the available local owner records, record the precise unresolved identity question if needed, and implement only dependency-ready roster work. It does not gate the human friend test.

## Shared Hapa direction and exit

The shared connectivity v0.1 contract and catalog remain byte-identical across both applications. Keep game authority in Versus. The next useful common work is a small evidence-envelope schema and adapter fixtures for generation lifecycle, current provider eligibility and durable-operation/receipt distinctions. A mirrored document is not shared executable adoption; a transport receipt is not permanence. No new CJ-operated VPS or broad runtime SDK is required by this review.

Finish Assignment 23's bounded corrections, run focused regressions during assembly, then `npm run check` and affected installed/native journeys once the integrated candidate is ready. Preserve keys, `hv1`, own-seat journals, archived signatures, profile/engine pins and optional owner boundaries. Publish Response 23 with actual source/build/artifact identities and per-finding outcomes. Keep review recommendation, platform execution, two-home success and CJ acceptance separate. The reviewer did not read or update the local Overwatch board.
