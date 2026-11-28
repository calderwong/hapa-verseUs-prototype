# Assignment 25 — run the two-home test; finish the small Avatar follow-up

**28 November 2026 · next local coding-agent handoff for CJ · follows [Review 23](2026-11-28-friend-test-and-avatar-review-23.md)**

## Goal and decision already made

Review 23 closes V22-01, V22-02 and V22-03. **Friend.9 is ready for the bounded CJ Mac / friend Windows two-home human test.** No additional speculative networking repair or unchanged internal qualification cycle is required before that test.

The review assessed main `29c7c1d466f94b5534fce1634f775a4df944a93f`, current release code `977f14944cdb978a0ab456fc9878ddae4e72f78e`. Preserve the release identity even when main advances with documentation. Actual consumer launch, Mac–Windows independent-home success and CJ acceptance remain pending until observed.

Prepare the handoff immediately. The optional Avatar cleanup below may proceed while humans arrange the session; it must not delay trying friend.9. If a later candidate is actually used instead, record that exact candidate and its changed qualification scope.

## Read and preserve

Read local Hapa grounding/agent instructions, this repository's AGENTS.md, [Loose Screws](../workflows/LOOSE_SCREWS.md), Review 23 and its [evidence](evidence/2026-11-28/review-23/README.md), [Response 24](2026-11-27-implementation-response-24.md), [friend.9 evidence](evidence/2026-11-28/friend-9/README.md), the [player sheet](../player/play-with-a-friend.md), [evidence form](../player/two-network-evidence-form.md), and [optional Avatar contract](../integrations/optional-avatar-players-v1.md).

Survey recent work and preserve other agents' changes. Reconcile these tasks with the actual local Overwatch board `hapa-versus`, append evidence and read back the resulting board state. Do not claim the reviewer updated that local board. CJ owns final acceptance.

Preserve engine `ba838cca09ba43afceda0452b63d28df4cbf7f72`, profile `hapa_open_10x9_v3_07`, two seats, one authority per seat, existing wire/archive semantics, readiness-aware replication, activation ownership, finishing-result recovery, current provider eligibility and valid relay evidence. Keep the Base Node/connectivity mirrors unchanged.

## N25-01 — hand off the existing friend.9 candidate for the actual test

Use the existing [release](https://github.com/calderwong/hapa-verseUs-prototype/releases/tag/v0.1.0-friend.9), downloads/player instructions and evidence form. Give CJ the two direct platform downloads and a short host/join sequence. The friend should only download/extract/open, connect, play and report the outcome. No terminal, source checkout, owner app, provider file or new CJ-operated VPS is required for human multiplayer.

Record the session only when it occurs:

- Both app filenames/builds and actual computers/OSes.
- Ordinary downloaded launch and actual Mac/Windows security/firewall prompts.
- Two people on two separate home internet connections; how they connected.
- Each controls their own side and uses Ready; legal finish or concession.
- Matching saved result; retained identity/history after quitting/reopening both.
- Both redacted connection reports.

Do not invent a pass, wait indefinitely for the people, or substitute another same-machine automated game. If the humans have not run it, submit the concrete handoff and leave its result **pending human test**. Do not contact the friend on CJ's behalf without explicit instruction.

**Acceptance:** a ready-to-use handoff with exact current downloads and the existing form; subsequently an honest observed pass/failure record. A failure selects its specific next repair by the connection-report stage. A success moves the work to human gameplay/visual feedback.

## N25-02 — V23-01: cancel pending Avatar renderer loads completely

Repair the bounded shared AvatarOpponent/FramedRedPlayer ownership gap:

- Give the current attachment attempt ownership of its pending renderer, so dispose/replacement promptly removes its frame/listener and cancels pending owner/render work that can be cancelled.
- Settle a pending load promise exactly once on disposal. Clearing the timer while leaving `_loading` pending is insufficient.
- Preserve generation fencing: old success/error/cancellation must not attach an old figure, emit stale rendering, overwrite new binding state or dispose the new player's renderer.
- Preserve current retry, correct-owner admission, normal successful disposal and one renderer per selected seat. Use the existing lifecycle, not a new framework.

Add one focused regression at the real owner of this behavior: delay load, dispose/replace before completion, assert old resources promptly reach zero, the old attach settles, the new player remains valid, and late old messages are ignored. Cover a no-completion case so a never-settled promise cannot hide behind the existing 45-second timeout. A small Red/Mesh control case is sufficient if needed by shared-code changes.

The archived [review probe](evidence/2026-11-28/review-23/avatar/avatar-probe.mjs) demonstrates the old behavior and intentionally pins reviewed hashes. Do not weaken its hash checks or claim it should pass against modified source; write the production regression for the new behavior.

**Acceptance:** immediate pending-work release, settled attachment, preserved correct replacement and retry, no wrong-seat events. This remains optional presentation work and does not block N25-01.

## N25-03 — V23-02: truthful owner/music labels

Use the actual binding owner in Who is playing: Mesh Avatar figures must not say via Harbor. Derive the setup music sentence from the selected Avatar's capabilities; do not promise Red's alternating library for Falka/Leo/Thor or No figure. Keep current controller and voice attribution explicit.

Give the choice/roster controls accessible names that include the Avatar (and a distinct No figure name). Preserve the compact rows and Details disclosure, one selection, eligibility checks at setup/reopen/Start, initial Red default and separate disabled online availability. A focused real UI check suffices; do not add tests that merely duplicate label text.

**Acceptance:** the displayed owner, controller, voice and music claims agree with the selected/bound figure; controls are distinguishable without relying only on neighboring visual text.

## N25-04 — qualify the changed scope once and publish Response 25

If this batch changes app code, run focused meaningful checks while implementing and one final `npm run check` for the coherent candidate, as required by AGENTS.md. Exercise the changed loading/disposal path and actual setup through a short real UI/owner journey. A normal short render alone does not demonstrate cancellation of a pending renderer.

If publishing a new executable for those changes, build both platforms from one identified clean code commit, verify hashes and the existing mandatory package gates, and identify the actual candidate in the player handoff. Do not claim friend.9 contains a later fix. Do not require a new release merely to deliver documentation or begin the already-qualified friend.9 human test.

Reuse unchanged relay-carriage, native readiness, installed Red and other evidence with their scope. Rerun only what a changed dependency invalidates or a required gate demands. Do not repeat the network experiment, add infrastructure, broaden SDK/standard work, implement online Avatar hosting, or redesign gameplay in this batch.

Publish `docs/reviews/2026-11-28-implementation-response-25.md` (or the actual later execution date), update current pointers and append evidence links to the task issue/Overwatch record. Push and read back the GitHub commit, changed documents and issue/board updates before claiming delivery.

Report separate statuses for:

1. Friend.9 human handoff prepared.
2. Actual consumer launch and two-home result, or pending.
3. V23-01 and V23-02 implementation/verification.
4. Candidate code, release bytes and platform qualification, if changed.
5. Optional Slice A visual acceptance and Slice B online hosting.
6. CJ acceptance.

Keep private owner art and raw user diagnostics out of the public repository. Use public-safe metadata and the existing redacted report path. Do not mark the full optional-player milestone or Hapa Node conformance complete.

## Stop

Once the handoff and this bounded follow-up are concrete and verified, stop. Do not generate another speculative repair list to occupy the time before the human session. The next multiplayer change should be driven by an observed failure or CJ's playtest feedback.

