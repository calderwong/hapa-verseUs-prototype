# Review 18 — Restore the representative demo and close recovery gaps

**26 November 2026 · CJ / Hapa Versus · source `b2a31f45baed1b70f0e1777eba93fe0267b09a5b`**

## Verdict and selected outcome

**Not ready for the requested representative human playtest/QE handoff yet.** Ordinary local play works, and Response 17 contains substantial implementation and useful installed evidence. The default Avatar is absent in the fresh local demo, several online recovery/result boundaries still fail bounded reproductions, and selected presentation work remains incomplete. Complete the related corrections and qualify the connected candidate before asking CJ to discover these known issues.

CJ requested another open-ended review, specifically reported the missing mesh Avatar, and asked for repository instructions plus the next prompt for the same coding agent. [Assignment 18](2026-11-26-next-agent-assignment-18.md) carries this review forward without restarting the project or discarding newer local work. The selected parent scope remains [the three-pass handoff](2026-11-26-three-pass-coding-handoff.md); this review refines its remaining work rather than reopening every corrected finding.

Readiness is scoped:

| Claim | Current decision | What would justify it |
| --- | --- | --- |
| Exploratory local play | Available; reviewer exercised it | Clearly identify the build and owner availability. This is not acceptance. |
| Representative local human playtest/QE | **Hold** | Restore the expected default appearance; finish the selected bounded scene and motion corrections; fit ordinary local/inspection/response/terrain journeys on the identified candidate. |
| Installed desktop/P2P QE | **Hold** | Close the decision, setup, worker, finalization and archive cases below with appropriate installed/native witnesses. |
| Complete selected multiplayer milestone | Incomplete | Include the remaining parent inventory explicitly; do not relabel unbuilt browser online, Rematch, diagnostics or directory work as an external gate. |
| Public release / independent internet qualification | Not claimed | Signing, artifact/source availability, separate hardware/networks and operated services remain separate facts. These are not prerequisites for a narrowly declared local playtest. |
| Done / aesthetic acceptance | CJ's decision | The reviewer can recommend a candidate for testing; CJ supplies human acceptance. |

## Baseline, methods and evidence

- GitHub main/report: `b2a31f45baed1b70f0e1777eba93fe0267b09a5b`; reported implementation candidate: `7cc30a141672ffedf5093bfd5695a39dca0532a5`.
- Compared with the preceding review publication `00e403afeef5a6d961c337f254765a75b622f037`: 12 commits and 57 changed files. The new implementation and Response 17 **are on GitHub**.
- Engine remains `ba838cca09ba43afceda0452b63d28df4cbf7f72`; default profile remains `hapa_open_10x9_v3_07`.
- Read [Response 17](2026-11-26-three-pass-implementation-response-17.md), its evidence and the relevant source. Its reported `npm run check` result is 174/174 plus smoke/peer/build; the reviewer did not rerun Node/Electron or that suite.
- Ran three bounded JavaScript diagnostics against exact retrieved methods/classes. Files, transport, rendering dependencies and previously verified result summaries are explicitly substituted where documented. These reproduce control-flow/contract defects; they are not native durability, cryptographic or GPU tests.
- Fresh connected Chrome interaction at `http://127.0.0.1:5199/versus.html`: default local match, Card supply, one Ready, next-Tick absorption, close inspection, Return/Home and compact header. Six original captures are retained.
- The live Vite demo did **not expose its Git revision**. Its observations are evidence about the running demo, separate from the pinned-source diagnoses. No assumption that this local process exactly equals `b2a31f4`.
- [Evidence README](evidence/2026-11-26/review-18/README.md), [source register](evidence/2026-11-26/review-18/source-register.json), [browser observations](evidence/2026-11-26/review-18/browser-observations.json). Source content and evidence bytes have independent Git-blob/SHA-256 identities.
- The reviewer did not inspect/update Overwatch or the Mac-only Hapa grounding. The local agent must reconcile the existing HV-67 workflow and grounding before implementation. No product or engine code changes are made by this review publication.

## What already improved

Preserve these corrections and reuse compatible evidence:

| Earlier scope | Current assessment |
| --- | --- |
| R17-01 repeated fuel | Shared validation and defensive once-only payment are corrected, with meaningful positive and refusal tests. No need to implement the same fix again. |
| R17-02 executable content | Schema validation is corrected. The actual standalone validator accepted a minimal valid Card and rejected missing `power` and an invalid damage channel in this review. The live import-to-play witness remains outstanding. |
| R16-01 unilateral result rewrite | v2 authenticated-prefix/dual-closing boundary addresses the original unilateral rewrite. Local genuine-conflict tests exist. Distribution of genuine conflict remains R18-07. |
| R16-02 / R17-06 finalization and ownership | Recorded-result/outbox repair and normal finishing ownership are implemented. The submitted test starts from journals already containing the remote closing record; the earlier disconnected terminal cut remains R18-06. |
| R17-03 response persistence | Definite append refusal retains the pending choice and supports identical retries. Preserve it; supply current installed/native failure and ambiguous-ack evidence for this changed boundary. |
| R17-04 future-Tick public plans/Ready | The original lost projection is corrected. R18-04 is a different status-ordering race; do not undo the per-Tick projection fix. |
| R16-03 profiles; R16-07 music; R16-08 notices | Configured archive dialing, installed profile UI, online local music and packaged notices have implementation/submitted evidence. Correct the remaining archive truthfulness and conflict distribution boundaries. |
| VA-01 / VA-02 | Terminal event inclusion and displayed-state selection are corrected. Fresh local play also settles to the merged party correctly. A settled still does not prove the timing of every transition cue. |
| VA-04 / VA-05 / VA-09 | Ordinary hint connection exists; entrance and compact controls are improved; enlarged Card inspection is visible in the fresh demo. Keep the small hover and own/opponent pin/compare witnesses in final fit. |

Response 17's installed journey has an observer automation failure, and it explicitly supplies a corrected fresh observer run on the final candidate. Do not count the earlier script race as an unresolved observer failure while ignoring that rerun. Conversely, earlier response-window evidence does not independently qualify the subsequently changed choice persistence path.

## Findings

P1 means a blocker for the relevant declared playtest journey; P2 means a concrete correction needed in this selected completion pass. Priorities are not claims of a public security incident.

### R18-01 · Restore the expected default Avatar and recovery from an owner outage — P1 for the representative demo

**Fresh observation.** Red was checked by default, seat A was human and B the heuristic bot, but the Home view showed an empty chair with Red's nameplate/greeting. The owner request failed:

```text
[versus] Avatar opponent in text-only mode: /capabilities 502
[versus] music contribution unavailable (red): /music/red/songs 502
```

The visible **Who is playing** panel said Red `red-reaper`, heuristic-bot controller, renderer unavailable `/capabilities 502`, voice unavailable/captions only. See [default Home](evidence/2026-11-26/review-18/02-default-home-avatar-fallback.jpg) and [browser observations](evidence/2026-11-26/review-18/browser-observations.json).

**Source distinction.** Red remains the default in setup and `startMatch`; `_tableSetup()` is unchanged from the preceding publication and `avatar-opponent.js` is byte-identical. This repository requests Harbor's performer and puppet, then uses the owner-rendered canvas on a seated plane. It does not establish that a particular 3D mesh renderer mode was deleted. `attach()` falls back to text-only after an owner failure, and no retry/rebind path is connected through the inspected Versus flow.

**Correction.** Identify the actual running build and owner package/renderer CJ expects by “mesh avatar.” Restore that existing integration and its expected default appearance. Diagnose owner availability, route/configuration, mount origin and package identity separately. Add a usable retry/rebind after transient failure, fenced by match/view generation, without requiring a page reset. Preserve truthful owner-absent fallback and the neutral remote-human identity. Do not invent a generic substitute or copy an unapproved private owner store into the installer.

**Acceptance.** Fresh default local launch shows the intended Avatar at Home and close/orbit; owner loss is honest; owner recovery can restore it in the same match without duplicate performers, leaked listeners or stale attachment. Record package/source identity and whether this is browser-only or installed. Harbor's `app://versus/` or an approved packaged snapshot remains a separate installed-delivery dependency; first inspect existing approved options.

**Sources:** [src/hapa/presentation/app.js:302-335](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/presentation/app.js#L302-L335), [src/hapa/presentation/app.js:452-465](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/presentation/app.js#L452-L465), [src/hapa/presentation/avatar-opponent.js:69-102](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/presentation/avatar-opponent.js#L69-L102), [src/hapa/presentation/seated-avatar.js:126-150](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/presentation/seated-avatar.js#L126-L150), [src/hapa/host/owner-routes.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/host/owner-routes.js).

### R18-02 · An ambiguous Ready timeout unlocks an unresolved commitment — P1

The host RPC deadline rejects without cancelling the worker append. The renderer queries once while that append is still pending, interprets an empty commitment as failure, tells the player to press Ready again and releases editing. A later `ownCommitted` event does not reconcile the client/app.

The [decision diagnostic](evidence/2026-11-26/review-18/decision-recovery-probe.json) shows: pending/edit-disabled before timeout; pending false/edit true afterward; a late authoritative commitment still leaves edit true and the view unfrozen. An early “not committed yet” snapshot is not proof of a durable refusal.

**Correction.** Represent pending/unknown, durably refused and durably committed outcomes distinctly. Preserve the exact frozen intent throughout uncertainty; reconcile late events and reattachment to the same commitment. Fence by match/generation/intent. Keep one human Ready and prevent a second competing commitment or mutation replay.

**Acceptance.** Delay the actual installed append beyond the RPC deadline, allow an early pending snapshot, then complete it. The UI stays safely frozen and settles to the exact one recorded plan without another Ready. A genuine refusal releases editing with accurate wording.

**Sources:** [desktop/main.mjs:160-167](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/desktop/main.mjs#L160-L167), [src/hapa/presentation/app.js:747-786](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/presentation/app.js#L747-L786), [src/hapa/presentation/online.js:69-83](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/presentation/online.js#L69-L83), [src/hapa/presentation/online.js:119-125](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/presentation/online.js#L119-L125), [src/hapa/network/online-match.js:283-334](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/network/online-match.js#L283-L334). Carries R16-05.

### R18-03 · Reconcile stranded reservations across asymmetric setup and legacy upgrade — P1

**Lost STARTED.** The joiner is already active while the challenger remains starting. Challenger Leave writes a tombstone and sends `decline(reason: left)`; the active joiner ignores it because the receive path handles only earlier phases. The ordinary active UI does not offer the disputed-only Leave route. The diagnostic leaves the joiner active/reserved after the challenger has departed.

**Existing v1 state.** Startup correctly declines to execute v1 as v2, but retains an active reservation for the skipped session. The diagnostic has no open match, availability `joining`, `setup.leave → NO_ATTEMPT`, and `match.leave → NO_MATCH`.

**Correction.** Reconcile durable session/progress, attempt identity and reservation as a whole. Include the boundary where only one side is active and offer a safe explicit departure for stranded/unsupported state. Preserve identity, journals and legacy bytes; classify unsupported execution and durably retire only the live reservation. Never require manual deletion or fabricate a concession/loss.

**Acceptance.** Drop STARTED, depart from the challenger, and make both players able to leave/recover and start a supported match. Upgrade a real-shaped v1 reservation fixture: identity/records survive, unsupported status is explicit, and availability becomes usable. Retain protection against late messages and an unrelated newer attempt.

**Sources:** [src/hapa/network/runtime.js:76-90](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/network/runtime.js#L76-L90), [src/hapa/network/runtime.js:250-259](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/network/runtime.js#L250-L259), [src/hapa/network/runtime.js:355-359](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/network/runtime.js#L355-L359), [src/hapa/network/runtime.js:412-425](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/network/runtime.js#L412-L425), [src/hapa/network/runtime.js:495-513](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/network/runtime.js#L495-L513), [src/hapa/network/runtime.js:661-674](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/network/runtime.js#L661-L674), [src/hapa/presentation/online.js:168-172](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/presentation/online.js#L168-L172). [Diagnostic](evidence/2026-11-26/review-18/decision-recovery-probe.json); carries R16-04.

### R18-04 · A stale snapshot can erase a newer dispute — P1

`OnlineClient` records an event before binding, but `bind()` overwrites status/reason with the snapshot. Resume reads a snapshot, awaits asset loading, then binds it. A dispute received during that interval is rolled back to active. The actual eligibility method then enables editing and Ready.

**Correction.** Establish ordering between authoritative snapshots and events, including match/worker generation. A stale active snapshot cannot erase an observed dispute or terminal transition. Preserve its reason and useful inspection/departure routes. Still admit a genuinely newer snapshot under explicit ordering; merely keeping every old field forever is not a fix.

**Acceptance.** Delay attachment, deliver dispute after snapshot capture and before bind, then attach: reason persists, mutations remain disabled, View/Leave works. Include a newer-snapshot control.

**Sources:** [src/hapa/presentation/online.js:53-83](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/presentation/online.js#L53-L83), [src/hapa/presentation/app.js:335-365](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/presentation/app.js#L335-L365), [src/hapa/presentation/app.js:609-620](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/presentation/app.js#L609-L620), [src/hapa/presentation/app.js:689-698](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/presentation/app.js#L689-L698). [Diagnostic](evidence/2026-11-26/review-18/decision-recovery-probe.json); carries R17-05, adjacent to corrected R17-04.

### R18-05 · Startup timeout strands a live but permanently failed worker generation — P2

The deadline rejects `peer.ready` but neither retires nor replaces the process. A late Ready updates status while the promise remains rejected forever. The diagnostic records one fork, zero kills/restart timers, the same live process and `RUNTIME_NOT_READY` both before and after its late Ready.

**Correction.** Retire/fence the expired generation and enter bounded replacement or expose an explicit usable recovery action. Settle original callers, reject stale messages and retain the no-mutation-replay rule.

**Acceptance.** Controlled late-start and never-ready workers both reach a usable replacement or truthful bounded failure with Retry; no permanently contradictory “ready status / failed API.”

**Source:** [desktop/main.mjs:104-143](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/desktop/main.mjs#L104-L143). [Diagnostic](evidence/2026-11-26/review-18/decision-recovery-probe.json); carries R16-06.

### R18-06 · Reopened finishing authorities lack the connection path needed to finish — P1

Terminal progress is persisted before both closing attestations necessarily exist locally. Startup reopens a terminal authority into `finishing`, leaving `this.match` null. Lobby join and connection attachment route only through `this.match`. The [records diagnostic](evidence/2026-11-26/review-18/records-recovery-probe.json) shows one owned finishing authority with zero topic joins/attachments; the active control joins and attaches normally.

The submitted native recovery fixture demotes an already-completed journal to terminal. Its remote closing record is already replicated, so it does not exercise this earlier cut. In addition, the fixed three-second retirement grace is not a proof that the other participant has received the closing evidence; recorded sessions are skipped at restart. That is a related source-supported recovery risk requiring the delayed-counterpart witness, not a fresh native failure claim by this reviewer.

**Correction.** Route reconnect/replication to every authority that still owns unfinished work, and provide a bounded durable way to retrieve/serve terminal evidence after normal retirement. Keep active play independent, preserve once-only finalization, and expose useful finishing/recovery state. A longer arbitrary sleep or an indefinitely open core does not establish the required guarantee.

**Acceptance.** Interrupt after local terminal/closing but before remote closing is locally present; reopen/reconnect and finish the original match. Delay the other peer beyond ordinary retirement, then recover it, including after the first app has restarted. Both end with one verified result/outbox, no new game inputs, settled waiters and no authority leak; a subsequent match works. Use actual native storage/replication for this boundary.

**Sources:** [src/hapa/network/online-match.js:166-190](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/network/online-match.js#L166-L190), [src/hapa/network/runtime.js:146-192](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/network/runtime.js#L146-L192), [src/hapa/network/runtime.js:468-549](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/network/runtime.js#L468-L549), [tests/hapa/online-native.test.js:68-78](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/tests/hapa/online-native.test.js#L68-L78). Carries R16-02 and R17-06.

### R18-07 · Genuine result conflicts do not propagate to observers — P1

The index stores multiple verified contradictory histories and correctly excludes the conflicted session locally. Its listing advertises only the first verified commitment; the query/get/sync path therefore sends only that history. A fresh observer counts it as a win. An observer already holding it skips retrieval as a duplicate and also retains the win.

The diagnostic uses controlled **already-verified** summaries to exercise the actual index/query/get/sync methods: archive disputed=1/count=0; fresh observer win=1/disputed=0; prior observer win=1/disputed=0. It does not claim new signature verification. Existing source tests separately establish local admission of a genuine both-attested twin.

**Correction.** Advertise and retrieve a bounded conflict evidence set, including when the first commitment is already known, and verify each history locally. Preserve deduplication and bucket denominators. An unsupported remote “disputed” flag alone must not erase a counted win.

**Acceptance.** Real verified contradictory bundles propagate through an archive to both fresh and previously synced observers. All exclude the same session, display the dispute and keep unrelated records; a unilateral malformed rewrite still cannot poison a valid result.

**Sources:** [src/hapa/network/result-index.js:40-46](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/network/result-index.js#L40-L46), [src/hapa/network/result-index.js:77-107](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/network/result-index.js#L77-L107), [src/hapa/network/runtime.js:575-614](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/network/runtime.js#L575-L614), [tests/hapa/online.test.js:174-183](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/tests/hapa/online.test.js#L174-L183). [Diagnostic](evidence/2026-11-26/review-18/records-recovery-probe.json); carries R16-01/03.

### R18-08 · An archive request timeout is presented and cached as a checked zero — P2

`syncResults()` catches a failed request and continues with an empty success-shaped aggregate. `profile()` marks the result synced and, with no local records, checked zero. The diagnostic injects a timeout from the only configured archive: the first response reports synced/checkedZero; the next call returns the same cached assertion with no new request.

**Correction.** Track source completion and partial/failure state. A checked zero requires successful relevant enumeration; failure/deferred/partial results need truthful source/freshness labels and appropriate retry/cache behavior. Do not discard valid local records when a source is unavailable.

**Acceptance.** Test one unavailable source, mixed success/failure and later recovery through the profile UI. A successful empty answer may say checked zero; a failed query may not.

**Source:** [src/hapa/network/runtime.js:596-642](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/network/runtime.js#L596-L642). [Diagnostic](evidence/2026-11-26/review-18/records-recovery-probe.json); carries R16-03.

### R18-09 · Excavation/fill effects ignore the rule event's coordinates — P2

Rules and the work UI use `cell: {x, y, band}` in work-cell coordinates. The new effect dispatch requires `cell.column` and reads `cell.row`, scaled as a territory. The exact-method diagnostic produces zero terrain calls for a rule-shaped event and one for a deliberately non-rule-shaped control.

**Correction.** Consume the actual work-cell contract and use a shared conversion to the cell center and correct band/height. Do not change rules to match the incorrect visual branch or introduce new terrain abilities.

**Acceptance.** One actual excavation and one fill show geometry and cue at the same accepted cell/band, including a cutaway. A focused dispatch regression and this short live witness suffice.

**Sources:** [src/hapa/rules/terrain.js:103-114](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/rules/terrain.js#L103-L114), [src/hapa/rules/terrain.js:142-179](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/rules/terrain.js#L142-L179), [src/hapa/presentation/app.js:995-996](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/presentation/app.js#L995-L996), [src/hapa/presentation/app.js:2964-2983](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/presentation/app.js#L2964-L2983), [src/hapa/presentation/board-view.js:219](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/presentation/board-view.js#L219). [Diagnostic](evidence/2026-11-26/review-18/visual-presentation-probe.json); carries VA-08.

### R18-10 · Complete the shared animation clock and restore equipment at settlement — P2

**Equipment.** `g.visible = g.visible && !act` derives future visibility from a value already suppressed by an action. If a pose crosses the final sync, the body returns to idle during planning while the weapon/shield remains hidden until another sync. The terminal-path diagnostic ends with idle body, invisible gear and only the expected final sync.

**Speed.** Playback duration captures the starting speed, while actor/FX delta uses the current selector value. Starting at 1× then selecting 4× leaves positions advancing the same 71.43 quanta per 0.1 s while actor/FX time advances 0.4 s. Stable preselected speed is not the failing case.

**Correction.** Derive equipment eligibility from current body/layer/life/pose state rather than prior visibility. Use one presentation-time advance for positions, pose phase, accepted-event reveal and battle FX. Preserve the displayed moment on speed change; paused speed changes must not advance it. Ambient scenery/music remains independent. No engine change is demonstrated as necessary.

**Acceptance.** A gear-bearing survivor settles from a late exchange into correctly equipped idle planning without a view refresh. In the same short witness, change 0.5× → 4× mid-action, pause, change speed while paused and resume: movement, bodies and marks remain aligned, without repeated events or expired cues. Include an opposed view and reduced motion.

**Sources:** [src/hapa/presentation/board-view.js:382-385](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/presentation/board-view.js#L382-L385), [src/hapa/presentation/board-view.js:491-521](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/presentation/board-view.js#L491-L521), [src/hapa/presentation/gear.js:93-102](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/presentation/gear.js#L93-L102), [src/hapa/presentation/app.js:935](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/presentation/app.js#L935), [src/hapa/presentation/app.js:1020-1043](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/presentation/app.js#L1020-L1043), [src/hapa/presentation/app.js:1790-1800](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/presentation/app.js#L1790-L1800), [src/hapa/presentation/app.js:1956](https://github.com/calderwong/hapa-verseUs-prototype/blob/b2a31f45baed1b70f0e1777eba93fe0267b09a5b/src/hapa/presentation/app.js#L1956). [Diagnostic](evidence/2026-11-26/review-18/visual-presentation-probe.json); carries VA-03/07.

## Finish the selected visual whole

The default Home still has a promising board/coastal composition, the Card trial is readable, and the settled merged party is inspectable. Preserve those choices. Complete the bounded material trial across the representative territory, party and restored Red so the delivered scene can actually be judged as a whole. Preserve likeness, brush-pixel character, foot anchors, warm/cool lighting relationship and contextual controls.

Response 17 explicitly leaves blocked-hit brace expression unbuilt. A restrained compatible block/deflection response can satisfy the existing semantic need without a new engine project or injury pose. Its [submitted combat still](evidence/2026-11-26/response-17/b1-combat-paused-poses.jpg) visibly stacks numbers, stars and direction cues across members' heads and upper bodies. Apply bounded aggregation/spacing at the dense exchange; CJ should judge the resulting design rather than inherit an already-visible legibility problem. Do not broaden this into a complete art replacement.

The fresh reviewer journey supplied a Pawn and Castle, moved the Castle from R1C1 to R2C1, pressed Ready once and reached Tick 2 with a 9/9 merged Castle and Supply 3. [Settled Home](evidence/2026-11-26/review-18/04-absorption-settled.jpg) and [close inspection](evidence/2026-11-26/review-18/05-absorption-close.jpg) establish that settled state. They do not close absorption cue timing. Keep one short actual absorption, Ember Strike/counter and excavation/fill sequence, matched Home/orbit/close, own/opponent Card pin/compare, and 960-pixel installed layout in candidate fit. Reuse unchanged adequate evidence.

## Completion and open dependencies

Follow [Assignment 18](2026-11-26-next-agent-assignment-18.md). Assemble related fixes under Loose Screws, fit the connected journeys, then run the required integrated check and affected browser/installed/native witnesses. The review diagnostics assert historical failures; a zero exit is not a product pass.

Answer the following in the implementation response without turning routine investigation into a CJ approval gate:

1. Which exact running source/build and owner package explain CJ's missing default Avatar? Can the existing approved renderer/snapshot restore it in browser and installed delivery?
2. Which of the early setup/terminal and ambiguous-decision cuts were actually staged on the new candidate, and which remain only controlled-method evidence?
3. Which selected parent items remain unbuilt, which are implemented but not qualified, and which are waiting on a specific external resource?

Complete independent selected work before stopping. Preserve browser online, direct Rematch, redacted diagnostics, live directory discovery and lifecycle/platform inventory explicitly; do not conceal them under signing/hardware or silently call the whole multiplayer milestone done. Likewise, do not make those external release gates a reason to withhold a narrower local-playtest recommendation after its actual requirements pass.

Publish one coherent response with exact source/artifact identity, findings disposition, short useful visual/native evidence and a concrete candidate entry point. Update the existing board through its real interface and read back GitHub. CJ retains Done and aesthetic acceptance.
