# Assignment 17 — Finish the installed multiplayer journey and make its records dependable

**Date:** 25 November 2026. **Parent goal:** Assignment 16, under human-feedback Addenda 07–08. **Review:** [Review 16](2026-11-25-desktop-p2p-review-16.md). **Reviewed head:** `82002e87dcd9540544c4b6db02d1e81c39a4dbbf`; implementation candidate `532643846f815106f7e33551099d02008e03c4d2`; engine `ba838cca09ba43afceda0452b63d28df4cbf7f72`.

## The outcome

A player can open the installed app, find or invite an opponent, recover from an interrupted start, commit one exact plan with one Ready, finish a match, and see a trustworthy durable result. A fresh installed player can obtain that result and both public profiles through the normal game UI while the original players are offline. An online player can still listen to their own locally available music. Failures explain what happened and leave a usable recovery action.

This is one completion batch of the selected Electron/P2P milestone. Keep the existing working runtime, packaged-app structure, game rules and scene. Do not restart the architecture or make another visual redesign. The first six review findings affect the connected path; the music and notice corrections complete already selected behavior in the same candidate.

## Read once and reconcile

1. Follow `AGENTS.md`, the local grounding it names, and [Loose Screws](../workflows/LOOSE_SCREWS.md). Inspect current branch/worktree and compare newer work with the pinned review before changing it.
2. Read Review 16 and its [probe/evidence notes](evidence/2026-11-25/review-16/README.md), then Response 16 for implemented connections and reused evidence. The review findings are specific failure cases, not a replacement game specification.
3. Consult the relevant sections of [P2P play](../integrations/p2p-matchmaking-v1.md) and [Electron delivery](../integrations/electron-desktop-v1.md) as each boundary changes. Existing archived gameplay and protocol meanings remain intact.
4. Reconcile the existing Overwatch `hapa-versus` card. Response 16 identifies HV-67; verify current state rather than copying a stale status. Append grouped progress/evidence to that card. CJ alone accepts Done.

Maintain one short current checkpoint: integrated outcome, completed attachments, current blocker, grouped tightening list and evidence identity. Continue through ready phases without repeatedly asking permission. Do not repeatedly reread unchanged documents, run the full suite per edit, or publish a separate review/commit for every assertion.

## Group A — Trustworthy results and recoverable finalization

Closes **R16-01 and R16-02**.

### Evidence must describe the agreed history

Complete the selected public-evidence boundary rather than adding only the missing receipt-field comparison. The importer must establish canonical participant/key association independently of the submitting archive, enforce schema/session/seat/context consistency, authenticate each exact Hypercore prefix, and verify matching terminal attestations binding both participants to the same session, outcome/state and transcript commitments.

Use non-circular prefix endpoints: agree the game-input history and its authenticated feed key/fork/length/root before adding terminal attestations outside those prefixes. Verify actual blocks/proofs rather than accepting a JSON claim about a root. Preserve the distinction among invalid evidence, unsupported evidence, equivalent reimports and genuinely contradictory authenticated histories. A malformed unilateral variant cannot remove a verified win. Retain evidence needed to explain a real dispute. A result archive remains a distributor, not a score oracle.

Version any changed online/result wire contract deliberately. Keep existing profile/rules semantics and archived bytes; old evidence which cannot meet the new proof must have an explicit legacy/insufficient status rather than silently inheriting a stronger verified label. The protocol's automatic terminal agreement must not become another human confirmation screen.

### A terminal game must finish recording after a restart

Make result/index/outbox finalization idempotent and reconstructible. At minimum cover both crash cuts: terminal journal/progress exists but result is absent; verified result exists but its outbox entry is absent. Use a durable finalization marker or derive pending work from journals. Reopening must complete the missing work under the original match identity without replaying user input, reminting Cards, asking another Ready or double-counting statistics. Keep completed journals; a projection can be rebuilt.

**Attachment checks:** one valid signed match, equivalent reimport, invalid identity/context/prefix evidence with an existing counted result, a real fork/prefix boundary, and the two finalization cuts. Use real Hypercore/native code for the changed storage/proof boundary at qualification; the review's source-level probes are not a substitute for it.

## Group B — Recoverable setup, configured discovery and visible profiles

Closes **R16-03 and R16-04**.

### Make an interrupted start usable

Serialize the local reservation decision around asynchronous work. Validate a proposed session before persisting active state. Accepted/starting attempts must recover after disconnection/restart and visibly explain failure to progress beyond the existing setup deadline. Provide Retry/Resume and **Leave this attempt**, bound to the specific attempt.

Explicitly leaving persists an abandonment/cancellation tombstone before releasing the local reservation. Late START/STARTED messages from that attempt cannot resurrect it or create a second active seat. Do not automatically convert a timeout or app exit into a loss, and do not add a human thinking timer. No recovery should require deleting identity/player data.

### Deliver records to the actual installed UI

Pass configured directory/archive identities and dialable transport references through main, peer-host and the shared runtime; currently the desktop only passes an archive count. Authenticate those services normally. Complete the small configured directory/candidate path selected in the companion, with bounded pagination and separate labels for directory-observed, locally connected, stale and offline. A shared DHT topic alone does not prove an exhaustive roster.

Use the existing verifier/index to fetch evidence for visible or deliberately opened profiles. Provide a compact profile/recent-games view and an ordinary way to find archived players' records after those players go offline. Expose syncing, unavailable and incomplete states; show verified totals known to the relevant source, not an unqualified lifetime record. Separate controller and rules compatibility buckets.

Coalesce requests, cache verified evidence and bound verification/cache work. Give active gameplay priority. Do not replay everyone's history every three seconds because the lobby repaints. Do not create a second statistics database or expose any local owner service to remote peers.

**Attachment checks:** interrupt setup in both ACCEPT→START and START→STARTED windows; recover/leave and start another match; replay late messages and restart safely. For history, a fresh installed observer must retrieve archived profiles through the UI with both original players offline. Exercise the configured service path, not only lucky topic discovery or the headless observer's manual API call.

## Group C — Exact Ready and bounded host recovery

Closes **R16-05 and R16-06**.

Freeze own-plan editing at the instant Ready starts; snapshot the intended commands. Reconcile the UI with the runtime's exact committed plan/revision/hash after durable success. A recoverable error or lost acknowledgment must inspect the existing authority before retrying; it must not create another commitment. Reset transient pending state when a view generation is replaced, without clearing committed state in the authority. All keyboard, mouse, drag and command-panel entry points must share this rule.

In Electron main, settle startup promises on ready, fatal, exit and timeout for the worker generation they belong to. A replacement worker becoming ready must not strand a request waiting on its predecessor. Retain the bounded restart policy; return a recoverable result to pending callers rather than silently replaying mutating calls. The UI must leave Busy/Committing and expose a valid retry or reattach state.

**Attachment checks:** deliberately delay Ready acknowledgment and attempt edits; replace/reattach the view during the wait; lose an acknowledgment; stop the peer process before its first ready message and let a replacement start. Show that the original action settles and the current UI can continue. A source-level promise check can be early; perform the connected packaged recovery path once on the integrated candidate.

## Group D — Preserve local music and package the notices

Closes **R16-07 and R16-08**.

Allow the existing local MusicDeck/Soundtrack to exist without a local bot/Avatar. An online human seat with its music owner configured keeps local playback, Previous, Played/Kept, quiet Keep where the owner supports it, Return, and the existing music signal driving the scenery. The real remote identity remains the opponent; Red must not speak or act for that person. Owner absence is quiet and understandable. Keep existing gesture, async-generation and teardown protections.

Remote synchronized listening, song transfer, internet voice, additional models and new art are outside this correction. Reuse existing library/retention contracts; do not create a competing music store.

Build a self-contained notices payload for exactly the bundled engine/dependencies/fonts. Exempt it from the Markdown filter and include its installed path/hash in the artifact manifest. Verify it in the actual next package. A notice-only change does not require another gameplay qualification cycle.

## Fit and qualification — one integrated candidate

Use the smallest check that resolves a concrete boundary while assembling the groups. Once connected, qualify the candidate rather than each intermediate screw. Group related failures before rerunning; reuse evidence when its relevant source did not change.

| Journey | Required observation |
| --- | --- |
| Installed base | Local play with owners absent; packaged native store reopens under the same identity; notices are present; no private owner files or credentials enter the bundle. |
| Start → failure → recovery | Both handshake interruption windows produce usable recovery/leave controls; a different match can start; late old messages and restart preserve one active reservation. |
| One exact Ready | A delayed acknowledgment cannot admit later edits into the displayed commitment; lost acknowledgment/reattach reflects the durable plan; one Ready per own plan remains the interaction. |
| Finish → interrupted save → reopen | Each finalization crash cut repairs to exactly one verified result and sharing job; a repeat reopen adds nothing. |
| Public evidence → fresh installed observer | Actual authenticated prefixes and terminal attestations verify; malformed variants do not erase totals. The app UI retrieves both archived profiles with authors offline and renders truthful sync status. |
| Online local music | One online game with the local music owner exercises playback/history/quiet Keep/Return and music response; owner absence has no gameplay effect. |

Run the required `npm run check` once the batch fits. Run affected checks again only for relevant fixes or a concrete remaining risk. Record source/build hashes and the exact artifact for installed evidence. Do not replace required user-facing journeys with only direct runtime or developer-console calls.

The genuine internet gate still requires two installed clients on different internet connections, plus retained evidence obtainable by a fresh installed observer while authors are offline. An operated relay requires its own actual reachable-path proof. Same-Mac checks remain useful attachment evidence but never satisfy these gates.

## What still needs an external resource or explicit owner delivery

Finish independent coding and prepare a concrete candidate before stopping for any of these. If the required resource is available and already authorized, use it; do not manufacture another permission gate.

| Gate | Concrete handoff if unavailable |
| --- | --- |
| Second machine / separate internet connection | Exact candidate, concise tester procedure, expected hashes/statuses and fields to record. Keep result explicitly “not run.” |
| Apple release credentials | Ready build/signing configuration and the exact signing/notarization step needing the configured account. Do not label an ad-hoc build a normal signed release. |
| Always-on directory/archive and relay | Runnable services, real configuration format with public identities/transport keys, persistence/restart instructions and explicit provisioning need. Do not claim hosts are operated merely because code/config exists. |
| Public engine source artifact | The exact pinned 105-file manifest and needed accessible artifact/build integration, preserving private history and owner boundaries. Bundling compiled code in a private/local DMG does not make an unaffiliated source clone buildable. |
| Harbor app origin / approved Avatar snapshot | A precise owner contract handoff for `app://versus/` or an approved manifest-listed snapshot; preserve the neutral fallback meanwhile. |

The original browser online adapter, direct Rematch, redacted diagnostics and remaining lifecycle/platform checks stay in the selected milestone's unfinished inventory. Do not silently delete them or mark Assignment 16 Done. Prioritize closing the reviewed installed-player path and state exactly what remains at this handoff; this assignment does not demand a new Windows release or unrelated owner work.

## Handoff and stop

Publish one implementation response against this review using the existing report template. For R16-01 through R16-08, state what changed, the connected behavior it enables, evidence and any remaining limit. Distinguish implemented, tested locally, packaged, signed/notarized, installed elsewhere, internet-verified, operated, published and accepted by CJ. Include a compact remaining-selected-scope list so an unbuilt feature cannot disappear into an “external gates only” summary.

Update pointers/runbook and append grouped evidence to the existing Overwatch card. Preserve historical reports. Supply the installed candidate or its authorized distribution location when available, exact hashes, and a small tester handoff. **End this work item and automatic continuation after that report.** If an external gate is unavailable, stop with that precise blocker after finishing independent work; do not spend the remaining budget repeatedly proving the same local path or refining unrelated art.
