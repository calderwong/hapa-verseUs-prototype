# Assignment 16 — From a fresh clone to a verified remote match

**Selected by:** CJ's request for P2P play, matchmaking and public player records.  
**Date:** 25 November 2026, America/Los_Angeles.  
**Baseline inspected:** `8036a3df0e4289ef203e54838df76ef22e053e53`.  
**Current default:** `hapa_open_10x9_v3_07`, `hapa-versus-rules/0.7.0`, `own_plan_ready_v1`; engine `ba838cca09ba43afceda0452b63d28df4cbf7f72`.  
**Status:** New selected implementation assignment. Review 15's earlier UI corrections remain closed in their reviewed scope; this is a new goal.

## Deliver one connected MVP

A person on a different computer and internet connection can obtain the game, install and launch it with the documented short path, discover available players, host/join/accept a challenge, play their own seat over Hypercores, recover a restart, finish a match, and see its verified result reflected once in public profiles. A third observer can retrieve that evidence from an independent seeder while both authors are offline.

The game must work without CJ's owner services or credentials. The multiplayer UI must retain one Ready per own plan, optional history, current-Tick Mana, deliberate unit inspection and the delivered music/scene experience where those optional integrations are present.

Read [Addendum 07](../requirements/2026-11-25-human-feedback-addendum-07.md), then [P2P play and matchmaking v1](../integrations/p2p-matchmaking-v1.md). The companion contains the standalone requirements, working defaults, source findings, data/trust rules, user journeys and contextual remaining decisions. Use its [source register](../integrations/p2p-matchmaking-v1-sources.json) for targeted reference rather than rereading the entire historical review stack.

## Start from actual local reality

Follow `AGENTS.md`, its local Hapa grounding and [Loose Screws](../workflows/LOOSE_SCREWS.md). Inspect git status/branch, fetch current origin, and preserve another agent's uncommitted work. Compare the inspected baseline with newer commits and current owner handoffs before changing source. Do not reset/clean/force-pull to obtain these notes.

Read the existing Overwatch `hapa-versus` state through its installed owner workflow. Append progress/evidence to relevant cards at meaningful milestones; CJ accepts Done. These documents do not replace the board. If that owner is unavailable, state the limit and continue independent work.

Early inspection should concentrate on `protocol/{peer,messages,agreement}.js`, `rules/{state,session,match,stats}.js`, `presentation/app.js`, `tools/hapa/{peers,peer,history}.mjs`, `vite.config.js`, package/lock files and `.gitmodules`. Read the exact relevant functions; do not repeatedly load every requirement document after compaction.

## Required findings to address

1. **The public clone has a private engine dependency.** The parent repo is public; `lumina-hapa` is private and required by static imports. Prepare/use an accessible approved pinned runtime distribution, with explicit code/asset notices. An invited-tester install with engine access is a useful interim claim, not the full stranger-install result. Do not publish the private fork/history or change visibility automatically. Resolve the exact artifact boundary before requesting any missing owner decision.
2. **The existing peer check is loopback bots.** Retain it as a fast regression. Add real discovery and browser participation; replacing its socket alone is insufficient.
3. **Browser and Node have different session paths.** Create an online session boundary with one authoritative Node runtime per player. Browser sends own-seat intent and renders events. It must not switch into hotseat or locally simulate the remote opponent.
4. **Restart recovery is missing.** Current Peer recreates initial state/sequence. Reconstruct from persisted signed session/input/checkpoint history, including partially completed Ticks and lost local acknowledgments. Production storage must be isolated from the `.data/peers` fixture reset.
5. **Remote record admission is incomplete.** Add shared strict envelope/session/seat/phase/range/bounds checks for all types, and digest-based duplicate/conflict detection before queueing. Bind identity, transport and feed ownership during negotiated start. Reject rewrites of agreed feed prefixes.
6. **Public outcome trust needs a new boundary.** The existing verifier calculates outcome/hash, while the history CLI imports the replay's claimed outcome. Verify complete evidence and compare those values before public statistics. Use calculated results and deduplicate by match/evidence identity; quarantine conflicts.

## Working implementation map

Choose files that fit the actual code; these are seams, not a required one-file-per-task checklist.

| Seam | Suggested home / reuse | Deliverable |
| --- | --- | --- |
| Launcher and configuration | `tools/hapa/play.mjs`, package scripts, existing Vite configuration | One supervised launch; supported Node pin; separate real/test data roots; public network configuration; local-only fallback |
| Persistent peer host | A small `src/hapa/network/` or equivalent Node-only module group | Identity/store lock; single Hyperswarm; typed control channel; explicit core replication allowlists; lifecycle |
| Lobby and challenges | Same network group, using shared canonical signing primitives | Fresh presence, profile feeds, Available/Busy, targeted/open/invite challenges, one reservation per identity, compatible signed session start |
| Match session | Extend/share the existing protocol coordinator and pure rules | Async human plan/choice inputs, Ready once, receipts, events/replay, pause/recovery and signed evidence |
| Browser bridge | Small loopback authenticated API/WebSocket + presentation adapter | Own-seat commands/snapshots; idempotent command IDs; epoch/Tick fencing; familiar playback/UI |
| Result verification and projection | Existing session/replay/stats code with a strict network importer | Computed outcome comparison, participant evidence, bounded replay worker, conflict-aware durable public history |
| Public seeder | Reuse runtime/network contracts in a headless `lobby:serve` mode | Paginated known profiles/results, recent presence assertions, bounded retained public evidence, restart-safe index |
| Game UI | Existing setup/table/nameplate/panels | Lobby, challenge actions, compact network state, correct remote identity, result record and rematch |
| Operations and evidence | README, concise online/operator guide, response report | Clean install, relay/archive configuration, supported network limits, reproducible actual remote journey |

Do not add a framework, import Roomlet's UI shell, make a new generic Hapa identity service, migrate storage for its own sake or create a global Autobase ledger. Roomlet is a scoped reference for sidecar/invitation/network patterns, not a production authentication module to copy without review.

## Assemble in four connected batches

### Batch 1 — Establish a runnable identity and the real human Tick

Declare the install/runtime/distribution path. Add persistent identity and a local peer runtime; connect the browser. Establish actual network discovery, a fresh authenticated connection, one targeted challenge and jointly signed session descriptor. Both browsers render the same opening and control only their own seat. Resolve one human Tick with matching receipts.

Use the bundled default profile/catalog/decks first. A peer's localStorage cards, arbitrary executable content or unavailable art must not silently alter a remote match. Keep explicit protocol/schema versions and exact supported rules/content fingerprints. Retain old replay meanings.

The small checks here establish new trust/data boundaries and enough confidence for dependent work. Do not polish roster cards while the two boards cannot agree on a Tick.

### Batch 2 — Complete all requested user journeys

Connect Available/Busy/expiry, open tables, copy/paste invite, race-safe reservations, async response choices, full match, replay export and durable result publication. Add verified profile W/L/draws/rate and the headless public archive. Finish reconnect and real process restart, including a committed Ready and a partially answered Tick. Preserve browser-refresh reattachment.

After match completion restore availability, save results automatically and support Rematch/Return. Missing archive evidence remains pending; duplicate uploads do not increment totals. The network record must carry no private local owner capabilities or service data.

### Batch 3 — Tighten the connected boundary

Batch corrections for schema/context checks, equivocation/rollback, reservation recovery, result verification, cache/queue limits, local bridge authorization, busy/expired states, failure messaging and responsive board interaction. Give active matches priority over background verification/downloads.

Integrate the maintained configured blind-relay path and prepare the archive/relay operator runbook. A directory is not a relay, a relay is not storage, and an invitation is not a firewall bypass. Keep HTTP local and never expose Harbor/Music/Harness proxies or local secrets to remote peers.

Use working design defaults from the companion. Change a tuning limit when actual evidence requires it and record why; do not turn provisional numbers into endless micro-optimization gates.

### Batch 4 — Qualify the exact candidate and hand off once

Run required `npm run check` against the integrated candidate. Run the changed connected game journey and the actual separate-machine/different-network acceptance, including independent result retrieval with authors offline and a demonstrated relay path. Reuse unaffected gameplay/visual evidence; a docs change does not require another gameplay run.

If a required external machine, reachable service or approved engine artifact is unavailable, finish independent implementation, record exact remaining actions and prepare a runnable handoff. Do not manufacture Internet evidence through repeated loopback variants or grow unrelated polish to stay busy.

## Focused acceptance and evidence

The companion defines the six acceptance journeys. Combine them into one planned integration session plus a small durable fault regression set. Required evidence should answer:

- Which exact source/runtime/OS/artifact/network configuration was used, and was the checkout dirty?
- Could an unaffiliated player install without private engine credentials? If not, precisely which distribution gate remains?
- Did two computers on genuinely different internet connections discover, accept and play as separate humans with matching receipts? Were direct and relay paths distinguished by actual observations?
- Did a restarted process recover the same key, sequence, committed plan, pending choice and agreed progress without duplicate spending/minting?
- Did full evidence reject a forged outcome or wrong context, and did duplicate publication leave both profiles' totals unchanged?
- Could a fresh third observer verify a completed result and retrieve it from the retained public archive while both authors were offline?
- Did local human/bot play, optional-owner absence and the current UI/game loop remain usable?

Capture only sufficient redacted evidence: per-peer log summaries, matched state/result digests, source/runtime identity, test summaries and a few UI captures when useful. No private keys, bearer tokens, raw IP lists, model prompts or private owner data in the repo. Do not turn evidence into an enormous transport benchmark campaign.

## Concessions, statistics and scope guardrails

- `own_plan_ready_v1` stays one human Ready. Automatic network acknowledgments must not become a new player confirmation screen.
- Existing concession remains an editable-plan order resolved by an agreed Tick. Closing/disconnecting/suspending is not a loss. No new immediate resignation, timed forfeits or adjudication service in this assignment.
- Default public statistics use independently replay-verified completed evidence. Peer-confirmed but not yet replay-verified, unfinished and disputed records stay visibly separate. Human/declared-bot/rules buckets stay separate; win rate uses wins divided by wins plus losses with the denominator shown.
- Preserve the owner boundaries for Avatar/voice/music and local memory. Show the actual remote player's identity at the table; do not automatically leave Red controlling or speaking as a stranger. A neutral portrait is an acceptable fallback.
- Broad music/voice internet transfer, hidden information, ratings, tournaments and generic Hapa account recovery are not this goal.

## Handoff and stop condition

Add `docs/reviews/2026-11-25-p2p-implementation-response-16.md` (use the actual local date in the filename if delivery occurs later) with the [implementation report template](IMPLEMENTATION_REPORT_TEMPLATE.md). Link it from the review/integration indexes. Append material progress/evidence to Overwatch through its actual owner workflow. Do not mark CJ acceptance yourself.

Distinguish **implemented**, **locally verified**, **verified across different internet networks**, **operated/deployed**, **publicly installable**, and **accepted by CJ**. These are separate claims. Report clean source/engine/dependency identities, owner changes if any, final operating state, known support limits and remaining concrete gates.

At completion—or a real external gate after all independent selected work is finished—publish the coherent response through the authorized workflow and **stop the active work item and automatic continuation**. A pending human/host/artifact decision is not permission to launch unlimited tests, reviews or refinements. Resume from the short checkpoint when CJ supplies the missing input or selects the next task.

## Copyable kickoff

> Implement Assignment 16: a complete casual P2P matchmaking and remote-play MVP. Fetch the current review index without disturbing local work; read Addendum 07 and `docs/integrations/p2p-matchmaking-v1.md`. Use Loose Screws: establish a real two-browser, one-seat-each network Tick early, then assemble discovery/availability, targeted/open/invite challenges, persistent recovery, full-match evidence, verified public profiles and the headless result seeder before a grouped tightening pass. Reuse the current deterministic engine, signed Hypercore protocol and `own_plan_ready_v1`; address the documented validation, recovery and outcome-import gaps. Keep the base install independent of Hapa owner services. Resolve the private engine distribution as a concrete delivery boundary. Prepare/configure supported relay and archive operation without inventing deployed infrastructure. Finish with required checks and actual different-network evidence; distinguish blockers honestly. Publish one response with exact source/evidence/operating state, update the existing board, and stop automatic continuation. Do not expand into ranked play, media transport or unrelated polishing.
