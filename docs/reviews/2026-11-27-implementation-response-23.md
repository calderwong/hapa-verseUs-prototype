# Implementation response 23 — reconnect activation, current provider use, relay carriage

**27 November 2026 · coding agent (Claude Code) · answers [Review 21](2026-11-27-lifecycle-and-delivery-review-21.md) / [Assignment 23](2026-11-27-next-agent-assignment-23.md) · GitHub task [#5](https://github.com/calderwong/hapa-verseUs-prototype/issues/5)**

## Separate statuses

| Claim | Status |
| --- | --- |
| Candidate prepared | **Yes** — friend.6, clean source `fe6584a`, Mac and Windows. |
| Windows launch (VM) | **Passed** on Windows Server 2025 x64 (GitHub-hosted) against the released zip, gated: run [46102314253](https://github.com/calderwong/hapa-verseUs-prototype/actions/runs/46102314253), 6 required reports, 0 failures. |
| Consumer Windows download/prompts | **Not observed** (a CI download carries no Mark-of-the-Web; SmartScreen/firewall prompts stay a human-machine observation). |
| Relay carriage (HC-09) | **Witnessed in a controlled native fixture** — two and three peers behind randomized NATs, authenticated through the live relay, including a dead preferred relay. Not a public relay, not every NAT type. |
| Real two-person, two-home game | **Pending** — needs CJ (Mac) and the friend (Windows). |
| Assignment 21 optional players | **Local slice done** — owner identities resolved, local Players roster with three separate controls; only Red is served, so only Red can be chosen. |
| Review / CJ acceptance | Not claimed. |

## Candidate identity

| Item | Value |
| --- | --- |
| Source | `fe6584ae29d51809c87b128767d11b49f1818da4` (build-info `dirty: false` on both platforms; release target is this commit), on reviewed base `d0be02d` |
| Engine / profile | `ba838cca09ba43afceda0452b63d28df4cbf7f72` / `hapa_open_10x9_v3_07` |
| Protocols | online v2, lobby v1, `hvinv2` (v1 read), contact v1, services v1 / policy v1 — unchanged |
| Windows | `Hapa-Versus-0.1.0-friend6-Windows-x64.zip` · 167,159,216 B · SHA-256 `5de102acd5d3846bbdf2e0c374e6d33b0130a177e70e53abee5e90f25a7e1624` · portable zip, not code-signed |
| Mac | `Hapa-Versus-0.1.0-friend6-macOS-AppleSilicon.dmg` · 124,517,204 B · SHA-256 `2b48c1cd8d889fee7c0503950f75006218f3b35b75944f4ceab61a2c56557616` · ad-hoc signed, not notarized |
| Download | [friend.6 pre-release](https://github.com/calderwong/hapa-verseUs-prototype/releases/tag/v0.1.0-friend.6) (README *Download and play*); `SHA256SUMS.txt` attached |

## N23 → changes

| ID | Change | Commit(s) | Verification |
| --- | --- | --- | --- |
| **N23-01** one activation owner (V21-01) | The reservation carries an explicit, persisted `activated` flag. It is set only at the two real activation points — the joiner after its authority opens and the cancel fence passes (`_onStart`), the challenger after `_openMatch` and a re-check of the tombstone (`_onStarted`) — and when persisted recovery resumes a non-terminal match. Every STARTED send (first send, duplicate-START answer, reconnect `_resendStart`) goes through `_activated(r)`: flag set, phase active, not tombstoned, and a live, unclosed match with the same id. A reconnect during initialization therefore sends nothing; Cancel still owns the cut; once activated, retransmission works as before. | `489b896` | Native test *V21-01 / N23-01* (real `OnlineMatch.open()` held; `_onPeer(…,'joined')` reconnect before **and** after Cancel; any emitted messages delivered to the counterpart): no STARTED, counterpart has no match and no `opened` event, one tombstone, restart does not resume, a fresh attempt opens and retransmits STARTED after activation. V20-A, HC-10 and the lost-STARTED witnesses in `recovery-native.test.js` retained. |
| **N23-02** current provider use (V21-02) | Configured archives are no longer merged into a startup list. `runtime.archives` is computed at each use: explicitly supplied archives (tools/tests, `source: 'explicit'`) first, then configured archives eligible **now** (`ServicePolicy.refresh` on the current clock — disabled/retired/expired excluded, no history append). Join dials only these. Diagnostics label each service `explicit`, `configured` or `connected` (an archive already connected as a healthy transport keeps serving result queries/submissions until it disconnects; a new dial needs current eligibility). The packaged default still has no archive and none was added. | `489b896` | Native test *V21-02 / N23-02*: an archive that expires after startup is not dialled by a later join; an explicit archive keeps precedence; history length unchanged. HC-06 and V20-B retained. |
| **N23-02** relay cache identity (V21-03) | The per-relay state in the Lobby is keyed by id but bound to its key and endpoint: a changed key or endpoint under the same id resets handout/confirmation/suspicion/cooldown and the cached key bytes. | `489b896` | Unit test *V21-03 / N23-02* (same id, new key and endpoint → new bytes, fresh evidence); HC-09 unit retained. |
| **N23-03** relay carriage with a valid control | New topology (not a repeat of the failed one): each peer in a private subnet behind its own NAT router namespace (`MASQUERADE --random-fully`, unsolicited inbound dropped), so both peers are genuinely firewalled **and** randomized — the case where HyperDHT itself refuses holepunching and Hyperswarm uses the configured relay, without forced relaying. The relay and DHT testnet sit on routable segments; `relay-serve --public` lets an operator declare a routable relay so its DHT node starts OPEN. Peers are instrumented (firewall classification, server relay-branch calls, client connect errors). | `13e7b18`, `4e0e5b3`, `fe6584a` | Run [46101336764](https://github.com/calderwong/hapa-verseUs-prototype/actions/runs/46101336764): **diagnosis** — both sides reached the relay branch (server `_relayConnection` called; client `HOLEPUNCH_ABORTED`), but peer→relay timed out (`ETIMEDOUT`/`CHANNEL_CLOSED`, 0 pairings): the relay's own DHT node was firewalled. Fixed with `--public`. Run [46101799012](https://github.com/calderwong/hapa-verseUs-prototype/actions/runs/46101799012): **stage 1** (control: two peers, one live relay) — both firewalled+randomized, relay pairings requested 2 / **matched 1**, each peer authenticated the other over a stream from the live relay's endpoint in ~10 s; **stage 2** (unreachable preferred relay `gone`, live alternative, three concurrent peers) — pairings requested 6 / **matched 3**, every pair relayed via `live`; `gone` was handed out once and nothing was suspected. [Evidence](evidence/2026-11-27/response-23/relay-witness-46101799012/). |
| **N23-04** integration | `npm run check` on the candidate source, the native reconnect/cancel journey (in the check), installed Mac smoke and invitation journeys on the released DMG, the gated Windows workflow on the released zip, this response and the conformance record; README, review index, checkpoint, runbook and player sheet reconciled. | this commit | Below. |

## V21 dispositions

| Finding | Disposition |
| --- | --- |
| V21-01 reconnect resend first-activates a cancelled/initializing authority | **Corrected** (N23-01), native regression with counterpart observation and restart. No concession or loss is produced by a connection or cancellation event. |
| V21-02 startup-adopted archive used after expiry | **Corrected** (N23-02), native regression. |
| V21-03 same-id relay keeps stale key/evidence | **Corrected** (N23-02), unit regression. |
| V21-04 relay carriage unproven | **Witnessed at controlled-fixture level** (N23-03). Exhaustion is covered by the HC-09 unit test only; the fixture did not exhaust all relays. |

## Verification levels (friend.6 bytes)

| Level | Result |
| --- | --- |
| `npm run check` on `fe6584a` | 195/195, two-process peer-verified match, build; includes V21-01/02/03, V20-A, HC-09, HC-10 — [summary](evidence/2026-11-27/response-23/npm-check-summary.txt) |
| Installed Mac (macOS 26 arm64), released DMG | DMG downloaded from the release and hash-verified, app copied out of the image: 2 clean launches, same identity, store grows, no data inside the bundle, owner routes 503 when Harbor is absent ([json](evidence/2026-11-27/response-23/mac-installed-smoke.json)); two-copy invitation game over the public DHT, Tick 4 concession, matching final hash `sha256:8e3c0ad9…45cd`, both reopen with the same identities and the result recorded ([json](evidence/2026-11-27/response-23/mac-installed-invite-journey.json)); no `SecurityAgent` (keychain) prompt |
| Windows Server 2025 x64 VM | Gated run [46102314253](https://github.com/calderwong/hapa-verseUs-prototype/actions/runs/46102314253) on the released zip (hash matched): clean runtime twice, isolated and under `%APPDATA%`, same identity, store grows; two-copy invitation game, Tick 4 concession, matching final hash `sha256:573f98be…a843`, reopen keeps identities and result; late worker ready on generation 2, never-ready worker bounded `failed` on generation 4 ([evidence](evidence/2026-11-27/response-23/windows-run-46102314253/)) |
| Linux namespaces behind randomized NAT | Relay carriage witnessed, stage 1 and 2 (above) |
| Independent home networks / humans | Not performed |

**Red (reused, unchanged dependencies).** Rendering, the owner package and delivery paths did not change in this candidate, so the friend.5 installed Avatar journey and captures in [Response 22](2026-11-27-implementation-response-22.md) stand: Harbor `red-pose-art` revision `2026-11-02.1`, a **2D mesh over pose art** (forward triangle rasterization, WebGL), one performer, owner outage and recovery in the same match, Red the supported default. The new roster leaves the bot-seat Avatar default on Red.

**HC-06 / HC-10 boundaries.** HC-06: retired, disabled and expired configured bootstraps, relays and archives are excluded from new use (startup, join, relay selection, archive dial), with no history append; an already connected healthy transport is not torn down by expiry. HC-10: Cancel is durable at discovery, negotiation, after accept and during authority initialization including reconnect; after activation it answers *use Leave this match*. These are the boundaries exercised — not a guarantee about every possible interleaving.

## Assignment 21 — local slice

Resolved from the owners' own records (read-only): **Falka** is Avatar Builder `avatar-8`, whose echo cast registry lists **Mimi** among Falka's user-authorized aliases — so Mimi = Falka; **Leo / The Dig-Lamp** is `avatar-46` (a dog); **Thor / The Oranginal** is `avatar-39` (a cat). Mesh Avatar has a package for each (`falka-human-assisted`, `leo-canine-assisted`, `thor-feline-assisted`, revision 2026-11-17.1, forward-mesh renderers, status *candidate*).

The table setup now has a **Players** list (`src/hapa/presentation/roster.js`, local preference key `hapa-versus.roster.v1`) with three separate controls: **In my roster** (local preference; Red on, others off), **Play this game** (one Avatar for the bot seat; only a figure an owner actually serves can be chosen) and **Available online** (shown disabled — not built). Red is the only served figure, so Falka, Leo and Thor are listed with the reason they cannot be chosen yet. Two seats, one authority per seat; moves come from the declared controller, never the figure. [Capture](evidence/2026-11-27/response-23/browser-players-roster.jpg) (browser, source build). Next: an owner-served route for each package. This does not gate the human friend test.

## Remaining gates

1. **Two-home human game** — CJ (Mac) and the friend (Windows) with friend.6; [Play with a friend](../player/play-with-a-friend.md) and the [evidence form](../player/two-network-evidence-form.md).
2. **Consumer Windows launch** — the friend's own download/extract/open, recording the SmartScreen and firewall prompts.
3. **Relay beyond the fixture** — a real relay on the public network between two homes is not witnessed; none is bundled (no VPS).
4. **Signing** — Apple Developer ID / Authenticode remain unavailable; prompts stay.
5. Assignment 21: owner-served routes for Falka, Leo and Thor; online availability.

Review acceptance and CJ acceptance remain separate.
