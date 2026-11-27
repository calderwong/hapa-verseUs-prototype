# Avatar opponents and music discovery — implementation checkpoint

**Started 24 November 2026** from `7cdd8e9` (the proposal docs). Working rule: Loose Screws. This file
records what is built, which owners it attaches to, the defaults CJ selected and what is still loose.
CJ's acceptance is separate from technical completion and is not recorded here on his behalf.

## Queued optional Avatar scope — 26 November 2026

[Addendum 11](../requirements/2026-11-26-human-feedback-addendum-11.md), [optional Avatar players v1](optional-avatar-players-v1.md) and [Assignment 21](../reviews/2026-11-26-next-agent-assignment-21.md) record CJ's request for Mimi/Falka, Leo and Thor Mesh Avatar player options. Separate local roster enablement, per-game controller/presentation selection and opted-in online availability. Preserve Red's existing default, one authority per seat and the two-player rules; use actual owner packages and distinguish Avatar-controlled outcomes from human-versus-human results.

**Queued, not built or newly reviewed.** CJ says the agents are waiting for an allowance window and are not ready to submit the previous work. Keep Assignment 20 current, preserve in-flight changes and qualify this scope later as local roster and online participation slices. No new asset discovery, runtime test, release, Overwatch update or readiness approval is claimed by this requirements publication.

## Current review and assignment — 26 November 2026

[Review 19](../reviews/2026-11-26-connectivity-review-19.md), pinned to `b42f555e35f7686dd3391e4f00f64a03875b5fb5`, qualifies [Response 19](../reviews/2026-11-26-friend-test-implementation-response-19.md). [Assignment 20](../reviews/2026-11-26-next-agent-assignment-20.md) is the next work: close six contact/provider/attempt findings, qualify the pertinent inherited native recovery cuts, verify the downloaded Windows candidate and complete the actual independent-network friend journey. Preserve newer local work and all corrected behavior.

The Mac friend.1 DMG and Windows friend.2 zip are published. The friend's Windows PC is confirmed. The Windows zip was cross-built and inspected; it has not run on Windows. The same-Mac installed invitation/concession/reopen evidence is not a two-network or Mac-to-Windows witness. **Candidate prepared; broad friend-test/desktop-P2P QE go-ahead withheld; human friend test pending.** No new executable is created by this review publication.

Built foundations include typed service-policy history and bootstrap/relay plumbing, asynchronous connection attempts/diagnostics, root-signed contact history and hvinv2, plus A18 corrections. Review 19 documents why the new edge cases remain material. A fresh unversioned browser match renders Red's pose-art output; that narrows the old empty-chair observation without establishing an installed owner frame or volumetric mesh.

[Addendum 10](../requirements/2026-11-26-human-feedback-addendum-10.md) and [Hapa Connectivity v0.1](../protocols/hapa-connectivity-v0.1.md) define shared contracts while game semantics stay application-owned. Stabilize the existing implementation before extracting a shared package. A CJ-maintained VPS and public archive remain optional for the first live friend game. Overwatch was not accessed by this reviewer; reconcile the local board when implementing.

## Historical Review 18 checkpoint

The observations below describe that earlier pinned review. Response 19 and Review 19 supersede their current-status wording where later evidence exists; unfinished compatible cases remain tracked in Assignment 20.

### Review 18, 26 November 2026

[Response 17](../reviews/2026-11-26-three-pass-implementation-response-17.md) is pushed at `b2a31f4`, implementation candidate `7cc30a1`. [Review 18](../reviews/2026-11-26-readiness-review-18.md) preserves its substantial corrections and withholds the representative-local/desktop-P2P QE handoff pending specific remaining boundaries. **Then-current work: [Assignment 18](../reviews/2026-11-26-next-agent-assignment-18.md)**, continuing [the three-pass scope](../reviews/2026-11-26-three-pass-coding-handoff.md) under Loose Screws.

- **Default appearance:** fresh local human/bot play has Red selected but an empty chair after `/capabilities 502`; music also reports its owner unavailable. Identify the live build/expected owner renderer and restore the existing default, including retry/rebind. The source still selects Red; no deleted mesh mode is established.
- **Connected correctness:** ambiguous Ready, asymmetric/legacy reservation release, stale dispute snapshots, worker-deadline recovery, reconnecting terminal ownership, distribution of genuine result conflicts and truthful archive failure states.
- **Selected presentation:** work-cell terrain FX, shared speed/pose/FX time, equipment settlement and the remaining bounded territory/party/Red scene and effect-density work.
- **Evidence already usable:** ordinary local supply/one Ready/merged-party inspection and compact header observed fresh; Response 17 supplies installed same-Mac evidence. Review 18 registers 44 source files, three controlled diagnostics and six captures. The live demo revision is unverified; no new native/internet or CJ acceptance claim.
- **Scope/gates:** keep remaining browser online, Rematch, diagnostics, live directory and lifecycle inventory explicit. External signing/hardware/services/approved distribution and installed Harbor origin remain distinct from independent implementation and local-playtest readiness.

Reconcile newer local work and HV-67 on the real Overwatch workflow before editing. Historical entries below retain their original revision/evidence limits; read their broad completion summaries with the newer Review 18 qualifications.

## Defaults CJ selected (not re-asked)

| Area | Default |
| --- | --- |
| Opponent | Red (`red-reaper`). Until Milestone C, Red's moves come from the heuristic bot, and Red's binding says so. |
| Presence | Superseded by addendum 05 (response 11): Red is seated in the scene across the table, beyond the opponent's banks; a nameplate and short captions follow the face; the conversation opens only by deliberate click or keyboard. |
| Talk | Normal (sparse) by default, with Quiet and Talkative settings. |
| Music | Whole tracks alternate between contributions, opponent first. One explicit queue controller (the host seat); every change bumps the revision. Volume, mute and listening are local to each listener. |
| Keep | Keep saves the reference durably, then starts verified retention of the exact heard asset. |
| Memory | Through Second Brain only where enabled; dialogue is never promoted into canon automatically. |
| Owners | The actual installed Music Library owner (Hapa Song Registry). Adapters are as small as possible. |

## Owner attachments (actual, this workstation)

| Need | Owner | How Versus reaches it |
| --- | --- | --- |
| Red's renderer package, puppet, voice | Harbor Storefront `127.0.0.1:8862` (`can/work/hapa-harbor-storefront`) | Vite host proxy. The token is added server-side from Harbor's `data/api-token`. |
| Voice synthesis | Avatar Builder Voice Cards, through Harbor's scoped consumer grant `hapa-versus-harbor` | Harbor only. The grant covers `red-reaper`, dialogue only, and expires 2026-12-02. |
| Music libraries | Hapa Song Registry, one node per library: CJ's on `8811` (peer `8812`) and Red's on `8801` (peer `8802`, data root `~/.hapa-music-libraries/red-reaper`) | Vite host proxy `/music/cj/*` and `/music/red/*` → `/api/peer/*`. A bearer token is added server-side from each node's `api-token`. |
| Model decisions (Milestone C) | Hapa Harness, with local models through LM Studio | See Milestone C. |

Rules for these attachments:
- No token, provider credential or owner-level authority reaches page code.
- Versus never uses the global Mesh broadcast. Every utterance names `roleId: versus-opponent`, the
  Avatar, the request ID, the session and the epoch.
- Harbor refuses an Avatar it has not admitted, and the page refuses a reply whose Avatar, package
  revision or Voice Card differs from the binding.

## Milestone A — Red shares the table

Built:
- `src/hapa/presentation/avatar-opponent.js`
  - The binding: seat ↔ Avatar ↔ renderer package ↔ Voice Card ↔ controller.
  - Red's `RedPlayer` (since response 11 rendered offscreen and seated in the scene by `seated-avatar.js`), captions, one speaking line and one waiting line, Stop, voice mute and the Talk mode.
  - Reduced motion and epoch fencing; Harbor cancel and receipts.
- `src/hapa/presentation/reactions.js`: lines grounded in displayed events only.
- `src/hapa/presentation/soundtrack.js`
  - The contribution snapshots and the alternating queue.
  - Playback through the listener's own library node.
  - The now-playing strip with local volume, mute and listening; Next for the queue controller.
  - Ducking driven by Red's actual playback events.
- `src/hapa/presentation/table.js`: the per-match lifecycle.
- `app.js` hooks:
  - setup choice and track search;
  - create on `startMatch`, dispose on `_detachMatch` and `pagehide`;
  - reveal-driven reactions, the result line and Red's committed orders.
- Harbor: a `POST /v1/utterance` role-scoped route with its owner test.
- Song Registry: `src/peer-music.js` and bearer `/api/peer/*` routes.

Evidence: see the handoff and `docs/integrations/evidence/`.

## Milestone B — Keep song

Keep flow: `POST /music/cj/keep` → the owner appends the discovery durably (fsync), then starts the
idempotent acquisition job `acq-<sha>`. The job pulls the Hypercore offer, verifies length, SHA-256
and the media header, writes atomically, and then commits a library receipt.

The strip shows only the owner's states:
- Saving…
- Saved · downloading
- Saved · waiting for source
- Saved · reference only
- Verifying…
- Available offline
- Download failed · reference saved

## Milestone C — model-assisted decisions

- **Harness owner:** a separate participant-game view, `hapa.participant-view/v1`, in
  `hapa-harness` (`src/game-participant.mjs` and `docs/GAME_PARTICIPANT.md`).
  - It has no owner memory, shared memory, history, skills or tools.
  - It makes one request per decision, under a deadline, and journals a receipt for each.
  - It refuses duplicate requests, tampered packets, a foreign Avatar and any memory in the view.
  - The author-only `participant_context_unqualified` refusal is unchanged; no participant is
    relabelled as an author.
- **Versus:** `src/hapa/controllers/model-decider.js`.
  - The heuristic plan is stored first as the fallback.
  - The immutable packet carries: match, epoch, seat, Avatar, Tick, phase or choice, the request
    ID, the state fingerprint and the input digest.
  - The model chooses among the heuristic's legal, fundable destination shortlist
    (`HeuristicBot.options`).
  - The shared validator admits the result. A result is consumed once, and stale epoch, Tick or
    state is fenced.
  - Deadlines: 5 s for planning, 1.5 s for a response, configurable through `table.deadlines`
    rather than the rules.
  - There is no repair loop. Receipts are kept apart from the replay.
  - Responses: the model chooses between Pass and the heuristic's prepared counter.
- **Turning it on:** setup → "Red's moves: Model-assisted". The manifest records
  `model-assisted/0.1.0+heuristic-bot/0.2.0`, and Red's "Who is playing" panel says so.
- **Provider:** LM Studio `qwen/qwen3.8-27b` (the model Harbor already uses for Red), with
  `reasoning_effort: none`. It is reached through a Harness supervisor on 61290 with its own state
  root, `~/.hapa-harness-versus`.

Evidence: `evidence/milestone-c-model-decisions.json`.
- 30 model decisions admitted in one real match.
- 5 deadline fallbacks, each with its late reply receipted and ignored.
- 7 unavailable fallbacks while the Harness was stopped.
- A live stale-epoch fence on reset.
- Live duplicate (409), tampered-packet (409) and memory-in-view (403) refusals.
- The replay verifies (111 Ticks) with no provider diagnostics in it.

Invalid output is covered by the owner tests (Harness and Versus) because the strict schema
prevented shape-invalid output live.

## Response 11 (24 November 2026)

Review 10 / Assignment 11 delivered at `bafc36f`: [response 11](../reviews/2026-11-24-ui-design-response-11.md). Owner revisions in use: Harbor `1ab09d9`, Song Registry `49a441a` (encounter-idempotent Keep), Harness `16dc700`.

## Response 12 (25 November 2026)

Review 11 / Assignment 12 delivered at `4dc271d`: [response 12](../reviews/2026-11-25-ui-design-response-12.md).

- The social layer and music strip own their pointer, wheel and context-menu gestures.
- The conversation is placed from its measured size inside the free area: beside the face, on its other side, or docked below the music strip.
- Music resume is bound to its entry and generation, under the same 8 s start policy as initial playback.
- A Harness reply that is not a JSON object settles once as `rejected-malformed-reply` with the stored fallback.

Owners are unchanged: Harbor `1ab09d9`, Song Registry `dadb049` (peer-music bytes as `49a441a`), Harness `16dc700`.

## Response 13 (25 November 2026)

Review 12 / Assignment 13 delivered at `c42649b`: [response 13](../reviews/2026-11-25-ui-design-response-13.md).

- **Music deck and drawer:** a fixed-slot deck and a Music drawer with Queue, Played this match (actual playback starts) and Kept. Kept is the owner's retained membership plus saved discoveries; Play uses listener library + `libraryId` over the literal `retained:` route.
- **Local replay:** one bookmark of the table mix, manual Previous/Next over the captured list, a stop at the song's end and an explicit Return. All of it runs on the same element and fences.
- **Quiet Keep:** Keep changes saved state only. The automatic Red acknowledgement and its ducking are removed.
- **Music signal:** `music-signal.js` taps the music element only. It owns the effective gain once attached and feeds the dusk island setting's glow, water shimmer and rare accents (Off/Subtle/Expressive/Still).
- **Owners:** unchanged. Harbor `1ab09d9`, Song Registry `dadb049`, Harness `16dc700`; engine `ba838cc`.

## Response 14 (25 November 2026)

Review 13 / Assignment 14 delivered at `153b657`: [response 14](../reviews/2026-11-25-ui-design-response-14.md).

- **Transport:** one fenced start path (`_play(gen, item)` validates before and after the graph resume, right before `audio.play()`); `primaryAction()` drives the button's glyph, name and action; `blocked` is distinct from unusable media; finished table playback restarts from zero.
- **Previous:** a bounded chronology of actual playback starts, separate from Played.
- **Layout:** `Table._placeDeck` places the deck from both reserved edges and clear of the face; `App._onePanel` keeps one expanded side panel when Orders, Music and the conversation cannot coexist, each keeping its state.
- **Teardown:** `BoardView.dispose()` with `resources.js` ownership (shared module caches marked; the setting and seated Avatar released by their owners first). GPU allocations plateau across replacements.
- **Setting:** quieter coursed paving with moss in the joints, a cedar top rail with a brass line, and a high-tide quay with a moored skiff, bollards and rope behind the opponent.
- **Owners:** unchanged. Harbor `1ab09d9`, Song Registry `dadb049`, Harness `16dc700`; engine `ba838cc`.

## Response 15 (25 November 2026)

Review 14 / Assignment 15 delivered at `da76b0b`: [response 15](../reviews/2026-11-25-ui-design-response-15.md).

- **Layout:** `App._reconcilePanels` keeps the most recently used panels that fit and collapses the rest with their state. It runs on deliberate opens (Orders, Music, conversation, Parties & Cards) and, coalesced, on world-size or fixed-reservation changes. Parties & Cards refreshes the free band on open and close.
- **Teardown:** `HitFX.dispose()` releases running effect parts and its three reusable textures once; `BoardView.dispose()` calls it first and reports `fx`.
- **Owners:** unchanged. Harbor `1ab09d9`, Song Registry `dadb049`, Harness `16dc700`; engine `ba838cc`.

## Status (24 November 2026)

| Milestone | Technical status | Evidence |
| --- | --- | --- |
| A — Red shares the table | Built and verified in a full match | `evidence/milestone-a-full-match.json`: 34-Tick match, three real Red voice performances, music ducked during each, alternating tracks, owner-down degradation |
| B — Keep song | Built and verified, **local-only topology** | `evidence/milestone-b-keep.json`: live Keep → Available offline; source disconnected and receiver restarted, then offline play; waiting-for-source → complete (757 blocks); partial-transfer resume proven in the owner test |
| C — model-assisted decisions | Built and verified | `evidence/milestone-c-model-decisions.json` |

CJ's acceptance is pending for all three; it is not recorded here.

## Loose screws (tighten list)

- The topology is **local-only**: two Song Registry processes with separate data roots, tokens and
  Hypercore keys over loopback. It is not two machines.
- Red's songs are YuE2 generations. Their creator is recorded as *not stated*, because the job
  recorded no author; the generator is credited as a tool, not as a creator.
- Red's owner canvas is opaque (rgb 146 gray baked in by every stage); the seated plane uses a bounded border-connected matte of that exact color until the owner offers a transparent output (response 11).
- Voice preparation takes about 9–10 s per line (OmniVoice). Captions show at once; voices arrive
  later. A line older than 35 s is dropped.
- The launch link and saved preset do not carry the table choices (Red, tracks, controller). Those
  are stored separately in this browser (`hapa-versus.table.v1`).
- The model-assisted run with seed 1 stalled at Tick 98–111 with all parties idle, while the human
  seat stayed idle. It is not established whether the model's choices caused this; the
  heuristic-only run with seed 1 ended at Tick 34.
- No model response decision arose live: the human never cast a Spell. Correction (review 10, R10-05/06):
  at `3b812f1` the host tests did **not** exercise `respond()`; since response 11 they do (input-digest
  binding, exactly one choice, prepared fallback).
- Music scope (R10-06): the table queue, its revision and Next are local to one browser. Two library
  processes on one Mac played and kept songs; this is not synchronized listening between clients.
- Listening replicas of peer offers stay in the receiving node's `peer-music/remote/` until pruned.
  Pruning is not built.
- Export and re-share, and retained songs in the Song Registry's Electron UI, are not built.
- Second Brain match memory was not written; it was not enabled for this run.
- The Builder voice grant expires 2026-12-02 and must be renewed through Builder.
- Harbor's current Avatar package is pinned to a snapshot of Mesh `a6fc511`. The live Mesh checkout
  holds another agent's uncommitted edit.



## New selected scope — P2P matchmaking (25 November 2026)

CJ has selected [Addendum 07](../requirements/2026-11-25-human-feedback-addendum-07.md) and [Assignment 16](../reviews/2026-11-25-next-agent-assignment-16.md). The standalone [P2P specification](p2p-matchmaking-v1.md) covers clone/launch, discovery/availability, challenges, remote human matches, restart recovery and verified public records, with a minimal public archive and configurable relay.

This is a planning selection against game `8036a3df0e4289ef203e54838df76ef22e053e53`, not a claim of implementation or deployed infrastructure. The local-only owner/media qualifications above remain true. Base online play must work without those optional services; their localhost APIs and tokens must never be exposed to opponents. New public Avatar associations use a safe projection rather than whole owner references. Keep remote media transport as separate owner work.

The required private engine dependency needs an accessible approved distribution before an unaffiliated clone can be called playable. The existing peer smoke remains loopback evidence. Assignment 16 requires actual separate-machine/separate-network play, restart and third-observer result verification; pending operator/distribution gates must be reported honestly.

## Delivery amendment — Electron (25 November 2026)

CJ selected an Electron wrapper with required runtime/assets included. [Addendum 08](../requirements/2026-11-25-human-feedback-addendum-08.md), [Electron desktop delivery v1](electron-desktop-v1.md) and amended [Assignment 16](../reviews/2026-11-25-next-agent-assignment-16.md) extend the same P2P milestone. This is a planning amendment against `698070b`, not an installed-app claim.

The package must include the game/engine/native peer runtime and approved starter content; use stable OS userData and a sandboxed renderer with a narrow IPC bridge. Existing Vite-only owner proxies and Harbor's unbundled Red puppet module require explicit desktop adapters/content snapshots. Private owner data/models/credentials remain optional and outside the installer. Actual relay/archive operation remains an external service fact. Qualify the real installed macOS arm64 artifact through the selected network/recovery journey before claiming the desktop promise delivered.

## Response 16 (25 November 2026) — desktop app and P2P play

[Response 16](../reviews/2026-11-25-p2p-implementation-response-16.md), candidate `5326438`.

**Delivered:**
- An Electron 45.3.0 / Forge 8.0.1 macOS arm64 app: `app://versus`, a sandboxed renderer with a CJS bridge, and the peer runtime in a utility process, with data under OS userData.
- A Hyperswarm lobby with authenticated HELLO, presence, signed challenges, open tables, invitations and a jointly signed session.
- Journal-replay recovery.
- Verified public results with a headless archive (`lobby:serve`).
- Shared owner routes (`src/hapa/host/owner-routes.js`, used by Vite and the desktop through `owners.json`).

**Owner notes:**
- Music and Harbor capabilities forward in the desktop app.
- Red stays text-only there, because Harbor's renderer accepts only http(s) mount URLs; this needs Harbor's change or an approved snapshot.
- No owner repository was changed.

**Open:**
- Developer ID signing and notarization.
- A different-network run.
- Operated archive and relay hosts.
- The public engine snapshot ([engine-runtime-manifest.json](engine-runtime-manifest.json)).
- CJ's acceptance.

Operations are in the [runbook](online-desktop-runbook.md).


## Review 16 (25 November 2026) — candidate needs connected-path corrections

[Review 16](../reviews/2026-11-25-desktop-p2p-review-16.md) reviews `82002e8`, implementation `5326438`, against the selected desktop/P2P contracts. The source and submitted installed-local evidence establish substantial foundation work, but Assignment 16 is not complete. [Assignment 17](../reviews/2026-11-25-next-agent-assignment-17.md) supplied its coding batch; those requirements are now carried forward by the [three-pass handoff](../reviews/2026-11-26-three-pass-coding-handoff.md).

- Public-result import lacks the selected authenticated prefix/final commitment boundary; a unilateral receipt-context rewrite can remove a counted result as disputed. Canonical imported identity binding also needs independent validation.
- A terminal-save crash window has no restart repair for the missing result/outbox.
- The desktop UI never fetches archived public profiles; configured archives are counted but not dialed, and the live directory path is incomplete.
- Accepted/starting reservations can leave the player stuck without a recovery/leave action.
- Ready does not freeze pending edits, and view replacement can retain a stale pending flag. Worker exit before startup Ready can strand IPC.
- Online mode removes the local MusicDeck/Soundtrack. Preserve local owner-backed playback without assigning Red to a stranger.
- The package filter removes explicitly allowed notice files.

Five focused source-level probe groups and scope limits are recorded in the [review evidence](../reviews/evidence/2026-11-25/review-16/README.md). No new native Mac, distinct-network, operated-service or human acceptance claim is made by the reviewer. Signing/notarization, accessible artifact/source distribution, independent-network play, configured operated services and the Harbor app-origin dependency remain distinct gates. Browser online, direct Rematch, diagnostics and remaining lifecycle/platform evidence stay visible as incomplete selected scope. The reviewer did not read/update Overwatch; reconcile Response 16's reported HV-67 on the owner board.

## Response 17 (26 November 2026) — three passes, current checkpoint

[Response 17](../reviews/2026-11-26-three-pass-implementation-response-17.md); candidate `7cc30a1` (DMG `bf261869…`).

**Combined outcome:** an installed play-and-record journey with:
- attested v2 results and crash-safe finalization;
- recoverable setup, an exact Ready and durable responses;
- the opponent's latest public state retained for a lagging view;
- a dispute/leave route, owned teardown, configured archives and in-app profiles;
- local music online and packaged notices;
- the presentation corrections VA-01–04 and the core visual pass.

**Remaining selected scope:** browser online adapter, Rematch, diagnostics export, lifecycle/platform checks, installed witnesses for the fault cases, and the rest of VA-06.

**Blockers:** signing, a second Mac on another connection, operated hosts, the engine snapshot, and Harbor's app origin.
