# Review 16 — Complete the desktop play, recovery and public-record paths

**Date:** 25 November 2026. **Reviewed:** `main` at `82002e87dcd9540544c4b6db02d1e81c39a4dbbf`; implementation and latest reported DMG candidate `532643846f815106f7e33551099d02008e03c4d2`. **Engine:** unchanged at `ba838cca09ba43afceda0452b63d28df4cbf7f72`.

## Verdict

This is substantial implementation progress. The repository now contains an Electron application, a reusable peer runtime, authenticated discovery, challenges and invitations, signed match journals, a result verifier and a headless archive. Response 16 supplies evidence of an app installed from its DMG, native storage reopening, two installed instances playing, and several recovery paths on one Mac. Preserve that foundation.

**Assignment 16 is not complete, and the remaining work is not only signing and finding a second machine.** The review found defects in public-result trust, recovery, the visible commitment to a plan and the desktop history path. Online mode also removes the existing local music surface. Correct these as one connected completion batch, then qualify the resulting installed candidate and perform the outstanding external journeys. [Assignment 17](2026-11-25-next-agent-assignment-17.md) is the next coding handoff under the same selected goal.

This review changes no game rule, engine pin, owner implementation or acceptance decision. The current profile remains `hapa_open_10x9_v3_07`; one Ready commits one's own plan. Earlier UI closures in Review 15 remain closed in their reviewed scope.

## Publication recovery

This review, Assignment 17 and their evidence were recovered from the previous conversation's unpublished staging. GitHub still pointed to the reviewed `82002e87` source, and the new review/assignment/evidence paths were absent. All 11 recovered staged files matched their original size and hash manifest; all 70 entries in the source register matched the current GitHub tree. Five focused diagnostic groups were rerun against matching source and reproduced the recorded behavior. The current handoff pointers were reconciled before publication. See [recovery verification](evidence/2026-11-25/review-16/recovery-verification.json).

The recovered findings and required corrections remain the same. The recovery adds no installed-app, native-network or human-acceptance claim, and this publication does not implement the fixes.

## What the evidence establishes

| Layer | Evidence / conclusion |
| --- | --- |
| Source | Nine commits since reviewer publication `ca72e2f`; implementation ends at `5326438`, followed by Response 16 documentation. Reviewed files are pinned and Git-blob verified in the [source register](evidence/2026-11-25/review-16/source-register.json). |
| Installed candidate | The implementer's submitted Mac evidence records installation from the DMG on the build Mac, two app instances, native Hypercore reopen, public-DHT discovery, reload/relaunch and a utility-process crash. This reviewer did not execute the Mac app or download its DMG. |
| Existing checks | Response 16 reports `npm run check` passing 161 tests, bot smoke, the existing two-process peer check and build. Those checks were not repeated by this reviewer. Passing them does not cover the defects below. |
| Older journey evidence | The longer journey uses `3873073`. Comparison to `5326438` confirms no change to the network/rules runtime; the game change is the online Victory/Defeat heading, alongside build metadata, docs and a manifest tool. Reusing that evidence was reasonable. |
| Independent review checks | Five focused source-level probe groups cover result/index behavior, the terminal-save recovery selector, setup recovery and archive linkage, pending Ready, and desktop startup/packaging. Their dependency substitutions and limits are explicit in the [evidence notes](evidence/2026-11-25/review-16/README.md). |
| Internet / distribution | All submitted network runs used one Mac and one connection. No independent-network or clean second-Mac evidence, signed/notarized installer, published release artifact or operated public archive/relay is established. The repository release collection was empty when checked. |
| Human acceptance | Not recorded. The reviewer did not read or update current Overwatch state. Response 16 reports HV-67; the local agent should reconcile that existing card rather than invent another task board. |

The source is now pushed: Response 16's historical statements “Nothing is pushed” and “Nothing is pushed until CJ says so” describe its writing-time state, not the current repository. Installer publication remains separate; the reported DMG is still a local `out/` artifact.

## Findings and required corrections

P1 below means correct before presenting this as a dependable public multiplayer candidate. P2 means a concrete completion/reliability defect to fix in the same bounded batch, not a reason for an unrelated redesign.

### R16-01 · P1 — A participant can make an already counted result become disputed without a new joint agreement

**Why the player cares.** The public record is meant to let another player trust a win/loss entry. At present, a losing participant can change part of their own signed receipt, keep the other player's transcript and both session signatures unchanged, and submit a bundle which the verifier accepts as a different commitment. The index then removes the previously counted match from normal totals as “disputed.” Recomputing the same outcome is not sufficient proof that the submitted history is the jointly accepted one.

**Evidence.** `src/hapa/network/results.js:29–45,64–101,149–155` builds transcripts from JSON records plus feed-key labels, verifies signatures and replay, then hashes those submitted records. It does not verify authenticated Hypercore prefix roots/forks or a jointly signed final transcript commitment. Receipt validation does not check the expected `phaseId` and `priorStateHash`. `result-index.js:39–45` treats another accepted transcript commitment under the same descriptor as a dispute. The independent verifier/index probe, using real Ed25519 signatures through a Node-crypto adapter, confirmed: original accepted; a unilateral receipt-context rewrite accepted; same computed outcome; winning record changes from one win to no counted win. No native Hypercore or live peer was exercised by this probe.

There is a related identity validation gap at the same import boundary. `results.js:69–74` compares identities from the submitted manifest with identities from the submitted descriptor; `manifestError` receives those same supplied identities. Import must independently enforce the canonical `hv1:<full public key>` association, identity kind, signing-key identity, distinct seats and valid feed identities. Live HELLO already checks the canonical key association; importing archived evidence must not depend on a HELLO which the observer never witnessed. This identity observation is source review, not an additional live reproduction.

**Correction.** Complete the existing P2P companion's evidence contract: authenticate each exact feed prefix by key, fork, length and root, verify the supplied blocks/proofs, and bind the agreed session, computed terminal state/outcome and both prefix commitments in matching participant terminal attestations. Keep attestation records outside the prefixes they commit to so the commitment is not circular. Validate all record contexts, including choices and receipts. Preserve a canonical result identity which does not change merely because packaging or transport metadata changed. A unilateral malformed rewrite must not erase a valid result; a genuinely contradictory jointly authenticated history must still be retained and surfaced. Do not “fix” this by disabling dispute detection or trusting the archive.

Any changed online/result format needs an explicit compatibility boundary. Preserve old records and their meanings; do not automatically give older insufficient evidence the new verified badge. This does not require a new gameplay profile or another human Ready confirmation.

**Acceptance.** A valid game verifies and counts once; equivalent reimports/repackaging count once; bad identity/context/prefix evidence is refused without changing an existing verified total; an actual authenticated conflicting history is handled distinctly. Include a real Hypercore fork/prefix case when qualifying this changed boundary. See [probe results](evidence/2026-11-25/review-16/probe-results.json), `publicResultTrust`.

### R16-02 · P1 — Finishing a match and saving its public result have an unrecovered crash gap

**Why the player cares.** A player can finish a valid match, quit or crash at the wrong moment, and reopen with its result absent from local records and the sharing outbox even though both journals remain on disk.

**Evidence.** `online-match.js:153–158` persists `progress.status = complete` before invoking result finalization. `runtime.js:438–455` starts `_saveResult` asynchronously, after clearing the reservation. On restart, `_resumeMatches` at `425–435` skips sessions whose progress says complete. There is no corresponding completed-session repair scan. The focused probe put the startup selector at that durable cut point and observed zero recovery attempts; it was a selector test with sentinel session metadata, not an actual process-kill test of a complete game.

**Correction.** Make finalization recoverable and idempotent. Persist a finalization intent, or reconstruct pending finalization from completed journals on startup; repair both the verified result and its outbox entry. Do not classify terminal progress as fully recorded until the required durable writes exist. Never delete the journals to repair this state, reopen gameplay to obtain another Ready, or invent a second match identifier. Handle the separate cut point where the result exists but the outbox does not.

**Acceptance.** Interrupt after terminal journal/progress persistence and before result save, and after result save before outbox save. Reopen the same identity: one result, one logical sharing job and the original match identity. Reopening again changes neither totals nor recorded actions. Evidence: `completionRecovery` in [probe results](evidence/2026-11-25/review-16/probe-results.json).

### R16-03 · P1 — The desktop player cannot obtain the public records proven by the headless observer

**Why the player cares.** A fresh installed player can see an opponent and an archive in the lobby, yet read “no verified matches yet” because the app has never fetched that opponent's evidence. This fails CJ's visible matchmaking-profile requirement even if the backend archive itself works.

**Evidence.** `presentation/online.js:117,150–160,171` repeatedly calls `lobby.list` and renders locally held totals. Neither it nor `presentation/app.js` invokes `results.sync` or `profile.get`. `runtime.js:157–170` uses the local index and flushes outgoing results when an archive connects; it does not retrieve profiles. The actual-method probe observes one outbox flush and zero sync calls. Retrieval exists at `runtime.js:503–527`, but Response 16's observer uses explicit headless CLI calls (`tools/hapa/online.mjs:44–51`). That is useful backend evidence, not completion of the installed-player journey.

There is also a source gap in configured service discovery. `desktop/main.mjs:132–137` reduces configured archives to a number, and `peer-host.mjs:17` never passes their keys to the runtime. Filling `network.json.archives` alone therefore cannot select/dial the archive. The headless archive serves results but does not yet implement the selected live directory/candidate discovery path; `Lobby.roster()` lists direct authenticated peers. A running host alone will not fix those code omissions.

**Correction.** Wire configured service identities/transport keys through the host into the shared runtime. Retrieve bounded evidence for visible or deliberately opened profiles, verify it locally through the existing index, and expose a compact profile with recent games and controller/rules buckets. Provide access to archived players' profiles while those players are offline. Coalesce/cache retrieval and give the active match priority; a three-second repaint is not a reason to replay an entire history. Distinguish “not synced,” “archive unavailable,” “verified games known here,” and an actually checked zero count. Complete the minimal configured directory/candidate path with bounded pagination and honest freshness labels; a directory observation is not a direct proof that a player is currently reachable.

**Acceptance.** Two installed players finish and archive a game. Both quit. A fresh installed observer uses only the normal app UI to find both profiles and independently obtain one win and one loss, a recent-game entry and sync/source status. Revisit/restart without duplication. An unavailable service leaves readable incomplete status. Test configured archive reachability separately from opportunistic shared-topic discovery. Do not create another score database.

### R16-04 · P1 — An interrupted match start can occupy the only match slot indefinitely

**Why the player cares.** Accept a challenge and lose the other connection during setup: the screen can stay at “Starting a match…” with no usable way to leave that attempt and play someone else. Restarting preserves the stuck reservation.

**Evidence.** `runtime.js:185–192` expires open/offered requests, but an accepted request only emits `startSlow`, which `presentation/online.js` does not handle. A starting request has no timeout branch. Cancel only handles offered, Close table only handles open, and Leave match requires an existing active/disputed match. `leaveLobby` preserves the reservation. The focused probe observes accepted/Joining after 31 seconds with all three recovery calls refused; starting/Joining after 119 seconds without a failure event.

**Correction.** Treat setup as a durable, serialized state machine. At the existing setup deadline, explain the lack of progress and offer Retry/Resume and **Leave this attempt**. Persist an attempt-specific abandonment/cancellation tombstone before freeing the reservation; late START/STARTED messages must not revive it. Do not blindly free a possibly committed remote seat on timeout. Validate the whole proposed session and both signatures before persisting active state. Keep the reservation decision serialized around feed creation and other awaits. Established-match departure remains separate and never creates a competitive loss by itself.

**Acceptance.** Disconnect between ACCEPT/START and START/STARTED, then recover or explicitly leave through the app; start another match without deleting data. Reconnect the old peer and deliver its late messages: no second match or revived attempt. Restart while the failed-attempt state is visible and retain these controls. Evidence: `setupRecovery` in [probe results](evidence/2026-11-25/review-16/probe-results.json).

### R16-05 · P1 — Ready permits edits while saving, so the displayed commitment can differ from the sent one

**Why the player cares.** Clicking Ready should commit the plan the player just saw. While the host is saving it, the current UI still allows changes. When the acknowledgment returns, the UI marks its then-current plan committed, although the runtime received the earlier one. A slow disk or delayed IPC makes this more likely.

**Evidence.** `app.js:590–599` does not include `_readyPending` in its edit/Ready gate. `_pressReadyOnline` at `710–720` sends the current commands and later calls `_publish` against mutable `this.plans`. The source-method probe delays the host acknowledgment, successfully changes an empty plan to a concession through `_setPlan`, and observes different host-submitted and UI-committed commands. It tests UI orchestration with rule/rendering dependencies stubbed, not native play. A second case changes the view generation while waiting: the old finally callback fences itself out, but no new-match initialization clears `_readyPending`; another Ready call is then suppressed.

**Correction.** Snapshot/freeze own-plan editing as soon as Ready starts. On durable acknowledgment, show the exact returned committed revision/hash and corresponding plan; on a recoverable failure, reconcile with the runtime before permitting a retry. Reset pending UI state when the view/session generation changes, while retaining actual committed state in the authority. Gate every editing entry point consistently. Do not add another human acknowledgment screen.

**Acceptance.** With a deliberately delayed host acknowledgment, mouse/keyboard/Card edits cannot change the in-flight commitment. A failed or lost acknowledgment recovers to the actual durable state. Reattach/change view during the wait, then act normally in the current session without a stuck Committing label or a second authoritative commitment. Evidence: `readyBoundary` in [probe results](evidence/2026-11-25/review-16/probe-results.json).

### R16-06 · P2 — A peer process that exits before Ready can leave an app action pending forever

**Evidence and effect.** `desktop/main.mjs:103–124` creates a startup promise whose resolver/rejecter is handled for ready/fatal messages, but not for process exit. IPC at `155–161` awaits it before entering the ordinary call timeout. The focused supervisor probe exits the first worker before ready, starts a replacement and marks that worker ready: the original request remains pending while a fresh request succeeds. In `onlinePanel`, an action waiting for that promise retains `busy = true` and can leave Join disabled until reload. This is a source-level supervisor test with Electron stubbed.

**Correction / acceptance.** Settle each worker generation's startup promise on exit, fatal and a bounded startup timeout. Give pending callers a recoverable error, preserve the existing bounded restart policy and never blindly replay a mutating request. Exercise this boot failure once, then confirm the real packaged app returns to a usable retry/reattach state. Evidence: `desktopBoundaries.workerBoot` in [probe results](evidence/2026-11-25/review-16/probe-results.json).

### R16-07 · P2 — Online play removes the local music experience rather than only removing the local bot

**Evidence and effect.** `app.js:343–352` forces `table = null` for every online match. `_attachTable` at `435–446` requires exactly one local bot and an Avatar. The `Table` constructor owns the Soundtrack and MusicDeck (`table.js:31–63`), so no online seat receives those controls or the music signal which drives the setting. The submitted online captures are consistent with that source behavior. The P2P companion explicitly retains listening to one's locally available soundtrack while playing remotely.

**Correction / acceptance.** Separate the local music surface from the optional speaking/playing Avatar. An online human seat with a connected music owner should retain local playback, Previous, Played/Kept, quiet Keep where applicable, Return and the existing music-responsive scenery. Show the actual remote identity and a neutral visual fallback; do not let Red speak or choose moves for a stranger. If no music owner is available, stay unobtrusively unavailable. This is not a request for remote queue synchronization, cross-player audio transport, a new music database or new scene art. Verify one installed online game with the local owner present and one graceful absence case.

### R16-08 · P2 — The package excludes its explicitly allowed notice files

**Evidence and effect.** `forge.config.cjs:22–38,41–52` allows `/NOTICE.md` and `/LICENSES.md`, then the earlier generic Markdown deny rule removes both. The existing NOTICE also points into the intentionally excluded engine vendor tree. The filter probe confirms both files are ignored. The submitted content manifest does not identify a standalone installed notice payload for the compiled engine, renderer dependencies or bundled fonts. This is not a claim that every dependency license or minified attribution comment is missing.

**Correction / acceptance.** Assemble a self-contained notices payload for the exact bundled closure, preserve it through the filter and list its actual packaged path/hash in the content manifest. Verify its presence in the next artifact. No gameplay rerun is needed solely for this text/package correction. Evidence: `desktopBoundaries.packaging` in [probe results](evidence/2026-11-25/review-16/probe-results.json).

## Delivery gates remain explicit

| Remaining item | Meaning for the next handoff |
| --- | --- |
| Corrected code above | These are implementable source defects; a host or signing credential does not fix them. |
| Real two-network journey | Two actual installed clients on separate internet connections, recovery during play, then a fresh installed observer with authors offline. Same-Mac or same-LAN evidence cannot substitute. |
| Signing / clean installation / publication | The reported candidate is ad-hoc sealed and rejected by Gatekeeper. Obtain normal signing/notarization through the configured release account, test the exact artifact on another supported Mac and provide an actual distribution location. A checksum without an accessible artifact is not download/install delivery. |
| Operated archive and relay | Concrete reachable hosts, keys/configuration and operational proof. Keep directory/archive, relay and DHT bootstrap roles distinct. Fix the configured-service code path before treating provisioning as the only remaining action. |
| Unaffiliated source build | The compiled desktop engine does not remove the private submodule from source builds. The 105-file pinned manifest is a useful concrete distribution proposal; an accessible approved artifact and build path are still required. Preserve private history and the fork ownership boundary. |
| Harbor portrait | The reported `app://versus/` mount is unsupported by the current owner; voice/music route checks do not prove the portrait. Coordinate that exact owner contract or an approved packaged snapshot. Neutral remote-player presentation is already acceptable. |
| Other selected scope | Browser online adapter, direct Rematch, redacted diagnostics, and the remaining platform/lifecycle checks are unbuilt/unproved, not silently completed by this review. Keep them visible in the milestone inventory; prioritize the installed connected path first. No new Windows claim is needed. |

The submitted captures retain the game board as the principal play surface, name the actual opponent and correctly show Victory/Defeat from the local seat. The lobby still exposes contributor profile/seed/policy controls prominently. Moving advanced setup behind a deliberate control can be a later presentation pass; it is not a new prerequisite for this repair batch. Restoring the selected local music path is required behavior, not cosmetic scope expansion.

## Next action

Use [Assignment 17](2026-11-25-next-agent-assignment-17.md). Assemble the four coherent repair groups, use only checks that resolve the specific changed boundaries during assembly, then run one integrated qualification and the required final gate. Keep the current engine, local gameplay and accepted scene work. Do not turn unavailable signing/remote machines/hosts into an excuse for repeated unchanged local tests. Hand off the corrected candidate with exact evidence and remaining gates, append material progress to the existing Overwatch card, and stop automatic continuation.
