# Review 23 — friend.9 handoff and local Avatar follow-up

**28 November 2026 · independent review for CJ · repository `calderwong/hapa-verseUs-prototype`**

## Decision

**Go ahead with the bounded two-home human playtest using friend.9: CJ on the Mac, the friend on Windows, each on their own internet connection.** Review 22's three findings are closed at the reviewed boundaries. This pass found no new blocking multiplayer or delivery defect.

The remaining work below concerns optional Avatar loading cleanup and player-facing wording. It can proceed alongside the human test; it is not a prerequisite for that test. **Ordinary downloaded launch on the actual computers, successful Mac–Windows play across the two homes, and CJ's acceptance are still unobserved.** A passed CI VM or same-computer invitation journey does not establish those outcomes.

[Assignment 25](2026-11-28-next-agent-assignment-25.md) is the next coding-agent handoff. It preserves the current candidate for the human test and selects one small optional follow-up. End the speculative networking repair cycle here.

## Reviewed source and delivery

| Item | Identity |
| --- | --- |
| Reviewed main | `29c7c1d466f94b5534fce1634f775a4df944a93f` |
| Previous review publication | `53aae50b6df520ff8340d6a81adaca1b3b1e1959` — Review 22 / Assignment 24 |
| Changes inspected | Six commits; 123 changed files, including 26 implementation/configuration/test files; 242 selected current text files verified against the pinned Git tree |
| Current release | [v0.1.0-friend.9](https://github.com/calderwong/hapa-verseUs-prototype/releases/tag/v0.1.0-friend.9) |
| Release code | `977f14944cdb978a0ab456fc9878ddae4e72f78e`; package build reports `dirty:false` |
| Engine / profile | `ba838cca09ba43afceda0452b63d28df4cbf7f72` / `hapa_open_10x9_v3_07`, unchanged |
| Protocols | Online v2, lobby v1, `hvinv2` with v1 read, contact v1, services v1/policy v1; no wire change in this batch |
| Windows zip | 167,162,718 bytes; SHA-256 `83b3edb93f1b0ac154b66da08f6b6b1d38edb24a4a920f3876eb86eb7f1f2191` |
| Mac Apple Silicon DMG | 124,503,664 bytes; SHA-256 `91c0ae80adb69e12b51ab771472e55f1fdb0e67e88688d8cea9c07b423230879` |

The readiness/roster/harness repairs entered in `7efa3b9` (friend.7); Falka/Leo delivery in `73a74ee` (friend.8); Thor in `977f149` (friend.9). Main adds the current release evidence. [Response 24](2026-11-27-implementation-response-24.md) remains the historical friend.7 implementation report; the [friend.9 packet](evidence/2026-11-28/friend-9/README.md) identifies the current bytes. Do not rewrite the older report to imply it tested a later build.

## Review 22 disposition

| Finding | Disposition | Evidence that resolves it |
| --- | --- | --- |
| **V22-01 / N24-01 — attachment before both feeds are ready** | **Closed** | `OnlineMatch.attach()` defers before readiness, declines after closure and deduplicates connections. The opener selects the then-current live connection after readiness and respects cancellation. A hash-checked probe exercised the complete authenticated HELLO/AUTH → peer → connection callbacks, standby promotion, cancellation and finishing-authority replication. All three groups passed. |
| **V22-02 / N24-02 — contradictory Avatar selection** | **Closed** | One radio group includes No figure; all choices use the eligibility operation; reopen and Start reconcile saved state. The focused roster tests passed 3/3. Independent live UI: remove Red → No figure; reload preserves it; Start opens a figure-free game; restoring Red seats Red. |
| **V22-03 / N24-03 — missing third relay report could pass** | **Closed** | The stage aggregator now requires the exact known peer set and is invoked by the actual shell harness. Its two tests passed: both archived complete stages pass, and all 13 negative mutations fail, including missing Peer-c. No unchanged network experiment was repeated. |

The runtime probe also confirms that a finishing authority can continue replication without an active reservation or STARTED activation flag. That distinction preserves result recovery. Cancellation before readiness produces no replication, STARTED, opened event or match-topic join, leaves one tombstone, and releases the authority/reservation.

The submitted native regression now drives the real Lobby reconnect callback while holding the authority between own-feed readiness and remote-feed construction. Response 24 reports the old implementation fails that regression with the original `undefined.replicate` exception. Its 200/200 integrated check and later friend.9 201/201 claim remain implementation-agent evidence; this review did not install native dependencies or rerun the full suite.

Retain the earlier activation/provider fixes, current archive eligibility, relay-key identity reset, controlled relay carriage and installed Red recovery with their recorded scope.

## Current package evidence

The [current Windows run](https://github.com/calderwong/hapa-verseUs-prototype/actions/runs/46124422768), actual [job 140915741824](https://github.com/calderwong/hapa-verseUs-prototype/actions/runs/46124422768/job/140915741824), release target, tag and package build-info agree on `977f149`. The primary decoded job log confirms:

- The released zip's computed digest and size match the release metadata.
- All **six required reports** are present and passing; the gate prints **zero failures**.
- Native launch/reopen succeeds in isolated and OS user-data locations with retained identity.
- Two installed copies on the same Windows VM complete a Tick 4 concession with matching result hashes; reopening preserves both identities and recorded results.
- The late worker becomes ready on generation 2; the never-ready worker reaches a bounded failed state on generation 4.

Five committed report objects match the JSON actually printed in that primary log. The full decoded log hash was independently matched by the coordinating reviewer; selected public-safe excerpts are in this review's [delivery evidence](evidence/2026-11-28/review-23/delivery/primary-log-excerpts.txt).

The current submitted Mac reports identify the same clean source and released DMG: repeated launch/persistence, two-copy invitation/result/reopen, and all three Mesh figures drawn with one performer and Tick 1 → 2. These are reviewed producer execution reports, not a new independent macOS run.

Unsigned Windows consumer prompts and the Mac developer-verification exception remain actual-machine observations. The known distribution limitations do not make another identical CI run useful. Record what the two people encounter using the [player sheet](../player/play-with-a-friend.md) and [evidence form](../player/two-network-evidence-form.md).

## Optional players and visual review

**The optional work has progressed beyond a roster scaffold.** Falka/Mimi, Leo and Thor now have actual served owner presentations and local legal bot play. The source admits their package ID, revision and Avatar ID before constructing the renderer:

| Choice | Avatar ID | Owner package | Current behavior |
| --- | --- | --- | --- |
| Falka, alias Mimi | `avatar-8` | `falka-human-assisted` 2026-11-17.1 | Mesh Avatar figure, captions, heuristic controller |
| Leo / The Dig-Lamp | `avatar-46` | `leo-canine-assisted` 2026-11-17.1 | Mesh Avatar figure, captions, heuristic controller |
| Thor / The Oranginal | `avatar-39` | `thor-feline-assisted` 2026-11-17.1 | Mesh Avatar figure, captions, heuristic controller |
| Red | `red-reaper` | `red-pose-art` 2026-11-02.1 in the live preview | Supported default; existing Harbor presentation/voice/music path |

These are identity-field admission checks, not runtime content-digest attestation. The owner package receipts and candidate status stay explicit. The optional owner media is not bundled into the friend's installer; human online play does not require the friend to run Mesh Avatar, Harbor or models. Ordinary remote-human tables retain `avatarId:null`.

### Fresh live observations

The independent reviewer opened the existing local browser preview at `http://127.0.0.1:5199/versus.html` and used the actual controls. Unlike Review 22, the browser connection worked.

- The setup is easier to read: one choice, a clear selected row, explicit No figure, compact statuses and Details for technical information. Start match remains easy to find.
- Red was selected on entry. Removing it, reloading and starting produced the expected figure-free table. A Ready transition reached Tick 2.
- Each of Falka, Leo and Thor could be enabled, selected and visibly rendered at the table. Leo and Thor progressed from Tick 1 to Tick 2 through Ready. Falka's visible details correctly identified the heuristic controller and captions-only state.
- Red was restored and visibly rendered. Its details identified `red-pose-art-speech-v2-idle-v2`; the supported default has not disappeared. This is the existing 2D mesh over pose art, not a newly claimed 3D rig.
- Figure scale and seating were coherent at the observed 2223 × 1016 viewport. The board, Ready control and nameplate stayed usable. These short checks establish visible rendering and turn transitions, not measured animation smoothness, long-session performance or human aesthetic acceptance.
- The visible Falka details reproduced the incorrect “via Harbor” wording below. The error log was empty at the inspected points.
- Initial roster preferences were restored: Red in the roster/selected; the three optional entries off. The preview was reloaded to setup after review.

The live preview did not expose a verified Git revision in the inspected UI. Treat those observations as fresh UI evidence alongside the pinned source and exact release reports, **not** as proof that the local preview executed the released DMG or exact `977f149` bytes.

A [setup capture](evidence/2026-11-28/review-23/ui/setup.jpg) and [observation record](evidence/2026-11-28/review-23/ui/observations.json) are included. Screenshots containing private owner artwork are not published. Candidate rig aesthetics remain CJ/owner acceptance work; no scene or engine rewrite is indicated by this pass.

## New findings — optional follow-up

### V23-01 · P2 in the Avatar presentation slice: cancel a renderer that is still loading

**Does not block the human friend test.** This affects the shared framed presentation lifecycle, including the newly exercised Mesh path.

In [`avatar-opponent.js`](https://github.com/calderwong/hapa-verseUs-prototype/blob/29c7c1d466f94b5534fce1634f775a4df944a93f/src/hapa/presentation/avatar-opponent.js#L138-L141), the new player remains a local variable until `await player.load()` succeeds. [`dispose()`](https://github.com/calderwong/hapa-verseUs-prototype/blob/29c7c1d466f94b5534fce1634f775a4df944a93f/src/hapa/presentation/avatar-opponent.js#L302-L307) can release a bound player but cannot reach that pending player.

A controlled probe imports the actual AvatarOpponent and FramedRedPlayer modules, supplies correct owner responses, and delays the old frame's loaded message:

1. Start Falka; dispose it while the frame is still loading.
2. One old iframe and one window message listener remain; no dispose message reached the frame.
3. Start and bind Leo: **two frames and two listeners** coexist.
4. Complete the old Falka load: its generation fence correctly returns false, emits no stale rendering event and removes the old resources.
5. Dispose Leo: zero frames/listeners remain.

Without completion, the retained pending work can last until failure or the bridge's 45-second timeout. The observed impact is incomplete cancellation and retained presentation resources. No wrong seat, wrong move, visible stale avatar or GPU exhaustion was established.

**Repair both sides of cancellation.** Track the pending player so match disposal releases it immediately; retain the existing generation checks. Also settle the pending load promise exactly once. [FramedRedPlayer.dispose()](https://github.com/calderwong/hapa-verseUs-prototype/blob/29c7c1d466f94b5534fce1634f775a4df944a93f/src/hapa/presentation/red-bridge.js#L110-L119) currently clears its timer but leaves `_loading` unresolved, so merely calling dispose on the pending player would strand the attach promise. Use one focused delayed-load/replacement regression; no new lifecycle framework is needed.

Evidence: [probe](evidence/2026-11-28/review-23/avatar/avatar-probe.mjs), [results](evidence/2026-11-28/review-23/avatar/avatar-probe-results.json). Its DOM/owner/frame messages are controlled; the finding was not reproduced by deliberately breaking the live owner.

### V23-02 · P3: use the selected Avatar's actual owner and capabilities in copy

“Who is playing” hardcodes **via Harbor** for Mesh Avatar packages in `avatar-opponent.js`. The live Falka panel reproduces it. Setup also promises tracks “alternating with Red's” when another figure is selected, although runtime music routing already uses the appropriate policy.

Use the actual bound owner and selected figure's music/voice capabilities. Keep heuristic/model attribution truthful. As part of the same small setup-label edit, include the Avatar name in each radio/roster control's accessible name; the inspected DOM currently repeats “Play this game” and “In my roster” across rows. This is a limited wording/accessibility correction, not a roster redesign.

## Next test and stop condition

Keep friend.9 available as the identified test candidate. CJ and the Windows friend should:

1. Download/open their actual packages and record any security/firewall prompts.
2. Use Challenge/Accept or Open a table → Copy invitation / Join by invitation across their two homes.
3. Each control their own side and Ready; finish legally or concede.
4. Confirm the same saved result; quit/reopen both apps and check retained identities/history.
5. Supply both redacted connection reports through the existing evidence form.

Do not require developer tools, a source checkout, owner services, provider JSON or a CJ-operated VPS from the friend. If the session fails, record the named failing stage and make that observed boundary the next repair. If it succeeds, record the exact builds and outcome and move to CJ's gameplay/visual feedback. Do not convert an internal same-machine fixture into a claimed two-home result.

[Assignment 21](2026-11-26-next-agent-assignment-21.md) remains partially open for optional cleanup/visual acceptance and its unbuilt online hosting slice. It does not gate the two-human game. Base Hapa Node adoption remains targeting/unassessed; its immutable mirror is unchanged.

## Publication scope

This review adds documentation, review diagnostics and evidence. It does not change product source, engine pins, release artifacts or standards bundles. GitHub notes are not evidence that the local Overwatch board changed; the local agent must reconcile board `hapa-versus`. Independent review and CJ acceptance remain distinct.

See the [evidence README](evidence/2026-11-28/review-23/README.md) for exact reproduction commands and limits.

