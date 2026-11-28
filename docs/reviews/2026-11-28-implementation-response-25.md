# Implementation response 25 — friend.9 handoff, pending-renderer cancellation, truthful labels

**28 November 2026 · coding agent (Claude Code) · answers [Review 23](2026-11-28-friend-test-and-avatar-review-23.md) / [Assignment 25](2026-11-28-next-agent-assignment-25.md) · GitHub task [#7](https://github.com/calderwong/hapa-verseUs-prototype/issues/7)**

## Separate statuses

| # | Claim | Status |
| --- | --- | --- |
| 1 | Friend.9 human handoff prepared | **Done** — [two-home handoff sheet](../player/two-home-test-handoff.md): both direct downloads with sizes and SHA-256 (matching the release's `SHA256SUMS.txt`), a message CJ can send the friend, host/join steps, and the existing [evidence form](../player/two-network-evidence-form.md). |
| 2 | Actual consumer launch and two-home result | **Pending human test.** CJ and the friend have not played it yet. No automated game is presented as a substitute. |
| 3 | V23-01 and V23-02 | **Implemented and verified on main** (`fccb816`): focused regression with sabotage, real UI journey, one integrated check (below). |
| 4 | Candidate code, release bytes, platform qualification | **Unchanged: friend.9** (code `977f149`, Windows zip `83b3edb9…f2191`, Mac DMG `91c0ae80…30879`). **No new executable**, and friend.9 does **not** contain `fccb816`. The fixes affect only optional local Avatar presentation, not two-person online play. |
| 5 | Optional Slice A visual acceptance / Slice B online hosting | Slice A visual acceptance: CJ/owners, not claimed. Slice B (online Avatar hosting): unbuilt and disabled. |
| 6 | CJ acceptance | Not claimed. |

## N25-01 — the friend.9 handoff

[docs/player/two-home-test-handoff.md](../player/two-home-test-handoff.md) is ready to use:

- **Downloads.** The friend gets the Windows zip and CJ gets the Mac DMG. Both are direct release-asset links, and About should show build `977f14944cdb`.
- **Message for the friend.** Extract and open the app, SmartScreen "More info → Run anyway", note any firewall question, Play online, Accept CJ's challenge or join by invitation, Ready each turn, quit and reopen, Copy connection report.
- **Session steps.** These are the six things the form records: prompts, two homes, own side and Ready, finish or concession, matching saved result, persistence after reopen, plus both redacted reports.
- **Afterwards.** A failure is read from the report's attempt stage (`starting-discovery` → `finding-player` → `authenticating` → `negotiating` → `connected`) or from the named play/result/reopen step, and that chooses the next repair. A pass moves the work to CJ's gameplay and visual feedback.

The friend needs no terminal, source, owner app, provider file or CJ-operated VPS. I have not contacted the friend. The [player sheet](../player/play-with-a-friend.md) and README link to the handoff. The result stays **pending human test** until the two people play.

## N25-02 / V23-01 — a still-loading renderer is released completely

| Change | Where |
| --- | --- |
| The attach attempt owns its owner requests (one `AbortController`) and its pending renderer (`attempt.player`). `dispose()` calls `_cancelAttempt()`, which aborts the requests, disposes the loading renderer once and rejects the attempt's cancellation promise. Every wait in `_attach` (owner package/capabilities/voices, renderer module, `load()`) races that cancellation, so the attach settles at dispose even if a renderer's own load never settles. An example is Harbor's module, which this repository does not own. A renderer the cancel already released is not disposed again. | `avatar-opponent.js` |
| `FramedRedPlayer.dispose()` now settles a pending `load()` exactly once, as a rejection with `code: 'released'`. Before, it cleared the timer and left `_loading` pending. The frame and its message listener are removed in the same call, so later messages from that frame are not heard. | `red-bridge.js` |
| Kept as before: generation fencing (`live()`), one attempt at a time, an explicit retry after a real failure, a figure already bound wins, normal successful disposal. | — |

**Regression.** [`tests/hapa/avatar-loading.test.js`](../../tests/hapa/avatar-loading.test.js) uses the actual modules, with only the platform controlled:

1. Falka's frame stays loading and is disposed. Frames and listeners drop to 0 immediately, the frame receives `dispose`, and the attach resolves `false`.
2. Leo then binds normally, with one frame and one listener.
3. The old frame's late `loaded`, `failed` and `playback` change nothing: Leo's player, canvas size, audio time and rendering count are unchanged.
4. A bridge `load()` disposed twice settles once.
5. A renderer that never completes, and an owner request that never answers, each settle the attach at dispose. The request is aborted.
6. Control: a real failure → text-only → retry binds.

**Sabotage:** the same test against friend.9's sources fails 0/2 (`old frame removed at dispose`; `settled once, as a rejection`). It passes 2/2 on `fccb816`.

**Real page.** In the [UI journey](evidence/2026-11-28/response-25/n25-ui-journey.json), headless Chrome on the dev page holds Falka's `rig.json`, so her frame stays loading, and then starts a replacement match with Leo. Right after the replacement there were 0 frames and the old attach had settled `false`. Leo bound with one frame. Releasing the held request changed nothing, and Ready went Tick 1 → 2 with Leo still seated.

The archived [Review 23 probe](evidence/2026-11-28/review-23/avatar/avatar-probe.mjs) is unchanged. Its hash pins refuse the modified files by design.

## N25-03 / V23-02 — truthful owner, music and control names

| Label | Now |
| --- | --- |
| Who is playing | Names the binding's actual owner: Falka, Leo and Thor "via Mesh Avatar's player node"; Red "via Harbor". Controller and voice lines are unchanged ("Moves: the heuristic bot…", "Voice unavailable: Falka has no voice yet; captions only" / "Voice: Red · natural (Builder Voice Card, omnivoice)"). |
| Music | Roster entries carry sound capabilities (`soundOf`): only Red has a music library and a voice. The table's music sources and the setup sentence both use these capabilities. Setup now says "Your tracks (up to 3):" followed by "Red's library alternates with yours." / "Falka brings no music, so only your library plays." / "With no figure, only your library plays." This changes as the choice changes. The old fixed "alternating with Red's" is gone. |
| Accessible names | "Play this game with no figure", "Play this game with Red/Falka/Leo/Thor", "Falka in my roster", "Falka available online (not yet)", "Details for Falka", and the same for each Avatar. These were confirmed in Chrome's own accessibility tree. The visible text is unchanged, so the rows stay compact. |

Kept as before: one choice including No figure, eligibility at setup, reopen and Start, Red as the default, Details, and disabled "Available online". The [setup capture](evidence/2026-11-28/response-25/setup-falka-chosen.jpg) shows Falka chosen. Table captures with owner art stay private.

## N25-04 — qualification (once, for the changed scope)

| Level | Result |
| --- | --- |
| Focused | `avatar-loading` 2/2 (sabotage 0/2 on friend.9 sources); `roster` and `presentation-contracts` passing |
| Integrated `npm run check` | **203/203** (201 + 2 new), two-process peer-verified match agrees, build — [summary](evidence/2026-11-28/response-25/npm-check-summary.txt) |
| Real UI (dev page, this checkout, live local owners) | No figure / Falka / Leo / Thor / Red each chosen through the controls and started; labels, queues and the cancel path as above; no page errors — [journey](evidence/2026-11-28/response-25/n25-ui-journey.json) |
| Installed app / packages | Not rerun. No executable changed; friend.9's Windows gate (run 46124422768) and Mac installed reports keep their scope |

Reused with their recorded scope: native readiness (Response 24), relay carriage (Response 23, run 46101799012), and installed Red recovery (friend.5). No network code, wire or archive format, engine pin (`ba838cca`), profile (`hapa_open_10x9_v3_07`), seat or authority rule, standards mirror, or owner repository changed.

## Overwatch and GitHub

- **Overwatch.** Board `hapa-versus` card HV-68 (the friend task, in Review) gets this response's evidence and the pending human result. CJ alone moves it.
- **GitHub.** Issue #7 gets the handoff link and these statuses.

## Stop

The handoff and the bounded follow-up are done. The next multiplayer change should come from the two-home session's observed outcome or from CJ's playtest feedback, not from another speculative repair.
