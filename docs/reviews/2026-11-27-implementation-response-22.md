# Implementation response 22 — lifecycle, provider and delivery correctness

**27 November 2026 · coding agent (Claude Code) · answers [Review 20](2026-11-27-connectivity-and-delivery-review-20.md) / [Assignment 22](2026-11-27-next-agent-assignment-22.md), and accounts for the in-progress Assignment 20 work (no separate Response 20 was published) · GitHub task [#4](https://github.com/calderwong/hapa-verseUs-prototype/issues/4)**

## Separate statuses

| Claim | Status |
| --- | --- |
| Candidate prepared | **Yes** — friend.5, clean source `aabb62a`, Mac and Windows. |
| Windows launch (VM) | **Passed** on Windows Server 2025 x64 (GitHub-hosted), gated: every required report present and ok. |
| Consumer Windows download/prompts | **Not observed** (a CI download has no Mark-of-the-Web; SmartScreen and firewall prompts stay a human-machine observation). |
| Forced second-relay carriage (FT-08 / HC-09) | **Pending** — selection corrected; the native namespace fixture runs but relay pairing never matches (below). |
| Real two-person, two-home game | **Pending** — needs CJ and the friend. |
| Assignment 21 optional players | **Not started** this iteration (status below). |
| Review / CJ acceptance | Not claimed. |

## Candidate identity

| Item | Value |
| --- | --- |
| Source | `aabb62a0a99b541b5bad41f54a827cbedbf102b6` (build-info `dirty: false` on both platforms), on reviewed base `676c335` |
| Engine / profile | `ba838cca09ba43afceda0452b63d28df4cbf7f72` / `hapa_open_10x9_v3_07` |
| Protocols | online v2, lobby v1, `hvinv2` (v1 read), contact v1, services v1 / policy v1 — unchanged |
| Windows | `Hapa-Versus-0.1.0-friend5-Windows-x64.zip` · 167,156,741 B · SHA-256 `c2ccca726b45d5c0a609dbbea1496064604c27de4ab3ddb109059306f36f1db9` · portable zip, not code-signed |
| Mac | `Hapa-Versus-0.1.0-friend5-macOS-AppleSilicon.dmg` · 124,520,594 B · SHA-256 `72e4fc0fe5fdd7255a79bd610e406c4c986ce29c95520824549b57550e6fa02e` · ad-hoc signed, not notarized |
| Download | [friend.5 pre-release](https://github.com/calderwong/hapa-verseUs-prototype/releases/tag/v0.1.0-friend.5) (README *Download and play*) |

## N22 → changes

| ID | Change | Commit(s) | Verification |
| --- | --- | --- | --- |
| **N22-01** cancel vs activation (V20-A) | One activation boundary: sending STARTED. Before it, a Cancel (even while the authority initializes) is durable at once (tombstone), the initializing authority is closed and left (`abandoned_setup`, `left`), nothing is published as opened, no STARTED is sent, restart does not resume it. After it, Cancel returns `connected` with "already started; use Leave this match". The panel shows that answer. | `a565f06` | Native test *V20-A / N22-01* (real `OnlineMatch.open()` held mid-initialization, duplicate cancel, restart, next attempt, post-activation cancel). Accepted-phase test HC-10 retained. |
| **N22-02** providers evaluated at use (V20-B) | `ServicePolicy.refresh(now)` re-projects the same history with the current clock (no append); the runtime calls it at join, new attempt, setup retry and every relay selection, and keeps a running DHT's bootstrap list to the eligible set. Diagnostics read the refreshed projection. | `a565f06` | Native test *V20-B / N22-02*: bootstrap and relay expiring after startup are excluded at the next join/relay use; explicit no-route; history length unchanged. HC-06 retained. |
| **N22-03** honest relay attribution | Hyperswarm's relay callback carries no attempt identity, so handouts are *unconfirmed* (never failures); *confirmed* only by an observed stream from the relay's endpoint; *suspected* only after ≥3 handouts over ≥30 s without confirmation (then 30 s→10 min cooldown); concurrent consumers rotate; when all cool down nothing is handed out (Hyperswarm makes its ordinary attempt). Relay list is read from the current policy at each use. | `a565f06` | Unit test HC-09 (concurrent burst, suspicion timing, exhaustion → none, expiry at use). **Carriage witness:** see below. |
| **N22-04** installed Avatar (V20-C) | Cause of the empty installed chair: the smoke ran with a **hidden** window, which Chromium throttles so the owner frame did not load in time — not a delivery defect. New installed journey (`desktop-avatar-journey.mjs` + smoke `avatar`) runs visibly: owner absent → recovered in the same match, Home / orbit 45° / orbit 90° / close, one performer, then Ready advances the Tick. Close framing corrected to head-and-shoulders. | `843ad08`, `6eac8db` | Installed friend.5 Mac app: owner absent (empty chair + Show Red), recovered (`red-pose-art` 2026-11-02.1, one frame, one performer, drawn), Tick 1 → 2 in the same match. Captures below. |
| **N22-05** handoff | This response; conformance record with immutable identities; `windows-smoke.yml` **fails on a missing or failed required report** (no `continue-on-error`); pointers updated to friend.5. | `a565f06`, this commit | Windows run [46074882482](https://github.com/calderwong/hapa-verseUs-prototype/actions/runs/46074882482): `qualification.json` required 6 reports, 0 failures. |

Also in this candidate: **the app no longer touches the macOS keychain** (`e349b6d`). Electron's cookie-encryption key lived in the keychain ("Hapa Versus Safe Storage"); every unsigned rebuild is a new binary to macOS, so CJ was asked to allow keychain access again and again. The game keeps nothing secret in Chromium storage (player keys are in its own files), so cookie encryption is off and Chromium uses a mock keychain. Verified: no `SecurityAgent` prompt during any of the friend.5 Mac installed runs.

## V20 dispositions

| Finding | Disposition |
| --- | --- |
| V20-A cancel opens the match | **Corrected** (N22-01), native regression. |
| V20-B expired provider reused | **Corrected** (N22-02), native regression. |
| V20-C installed Avatar empty chair | **Corrected/explained** (N22-04): hidden-window throttling; visible installed journey passes on friend.5 with owner outage and recovery. |
| V20-D handoff and pointers | **Corrected**: Response 22, `response-22/conformance-execution.json` with source/artifact/run identities, README/index/checkpoint/player pointers on friend.5. |

## Relay carriage — what was achieved and the exact remaining condition

`tools/hapa/relay-netns-witness.sh` (workflow `relay-witness.yml`, manual dispatch) builds five Linux namespaces routed by the host: a blind relay, three peers and the DHT testnet. The host firewall drops every packet between peer subnets; the control step proves peer→peer is blocked and peer→relay works. Each peer is a real PeerRuntime with an unreachable first relay and the live relay second, every connection relayed.

- First runs failed for fixture reasons, now fixed: the npm lockfile check, and the testnet replying from a different address than peers asked (dht-rpc discards those) — the testnet now has its own namespace; in-namespace DHT bootstrap then works (2 nodes, own address learned).
- Runs [46073160726](https://github.com/calderwong/hapa-verseUs-prototype/actions/runs/46073160726) and [46073663908](https://github.com/calderwong/hapa-verseUs-prototype/actions/runs/46073663908): discovery works, relay handouts happen on all peers (both relays in fallback mode), the live relay **accepts sessions, but pairings are requested and never matched** — including the single-relay control run (3 sessions, 3 pair requests, 0 matched, 3 cancelled). Only one side of each connection reaches the relay.
- HyperDHT's negotiation itself is sound (the server's handshake reply names its relay and token; the client follows it). The unresolved condition is why the second side's relay pairing does not arrive in this topology. **HC-09 carriage remains pending**; no claim is made from selection counts.

## Inherited Assignment 18/20 cuts

Credited and unchanged: contact proof/conflicts, delayed verification fencing, committed imports, retired-provider exclusions, accepted-phase cancellation, and the native witnesses in `recovery-native.test.js` (lost STARTED, delayed Ready, early terminal restart, delayed counterpart from retrieved evidence) — all pass in this candidate's `npm run check`. Worker late/never-ready: passed on the friend.5 Windows run (ready on generation 2; bounded `failed` on generation 4, shown to the page).

## Verification levels (friend.5 bytes)

| Level | Result |
| --- | --- |
| `npm run check` on `aabb62a` | 192/192, peer-verified match, build — [summary](evidence/2026-11-27/response-22/npm-check-summary.txt) |
| Installed Mac (macOS 26 arm64) | Clean runtime 2 launches ([json](evidence/2026-11-27/response-22/mac-installed-smoke.json)); two-copy invitation game over the public DHT, matching final hash, reopen keeps identities/results ([json](evidence/2026-11-27/response-22/mac-installed-invite-journey.json)); installed Avatar journey ([json](evidence/2026-11-27/response-22/installed-avatar-journey.json)); no keychain prompt |
| Windows Server 2025 x64 VM | Gated run 46074882482 — clean runtime (isolated and `%APPDATA%`), invitation game with matching hashes and reopen, late/never-ready ([evidence](evidence/2026-11-27/response-22/windows-run-46074882482/)) |
| Linux namespaces | Relay witness fixture runs; carriage not achieved (above) |
| Independent home networks / humans | Not performed |

Installed Avatar captures (friend.5 Mac): [owner absent](evidence/2026-11-27/response-22/installed-b1-owner-absent-home.jpg) · [recovered at Home](evidence/2026-11-27/response-22/installed-b2-recovered-home.jpg) · [orbit 45°](evidence/2026-11-27/response-22/installed-b3-orbit-45.jpg) · [orbit 90° (limited-2D policy fades to the chair)](evidence/2026-11-27/response-22/installed-b4-orbit-90.jpg) · [close](evidence/2026-11-27/response-22/installed-b5-close.jpg) · [after Ready, Tick 2](evidence/2026-11-27/response-22/installed-b6-after-ready.jpg).

**Owner package identity:** Harbor `red-pose-art` revision `2026-11-02.1`, renderer `red-pose-art-speech-v2-idle-v2`, 54 assets / 11 modules, integrity "verified-at-start-and-each-read"; package manifest as served: SHA-256 `fc2d4d6cf1ea70eb83403ab842a0d85374b71039bd5afc218677f14301be1098` (12,334 bytes); built from Mesh Avatar pin `a6fc511`. **Renderer kind:** 2D mesh — forward triangle rasterization over pose art (WebGL); not volumetric. Mesh Avatar Studio describes itself as producing rigged 2D mesh avatars, and no 3D model of Red exists in the owner checkout. Optional owners absent never block legal play (the owner-absent installed match continued and Ready advanced).

## Assignment 21 — truthful status

Not implemented this iteration. Owner data located, read-only: the Mesh Avatar checkout has player rigs for **Falka** (`apps/player/falka`, with `falka-package.json`, rig, motion catalog), **Leo** (`apps/player/leo`) and **Thor** (`apps/player/thor`); no entry named **Mimi** was found, so the Mimi/Falka alias is unresolved. No owner (Harbor or otherwise) currently serves these packages to Versus, so local roster, game selection and online hosting are all unbuilt. Next step: resolve the Mimi/Falka identity with the owner and an owner-served route per package, then the local roster. It does not gate the human friend test.

## Remaining gates

1. **Two-home human game** — CJ (Mac) and the friend (Windows) with friend.5; [Play with a friend](../player/play-with-a-friend.md) and the [evidence form](../player/two-network-evidence-form.md).
2. **Consumer Windows launch** — the friend's own download/extract/open, with whatever SmartScreen/firewall prompts appear, recorded on the form.
3. **Relay carriage** — resolve why only one side pairs at the relay in the namespace fixture; until then HC-09 stays partial.
4. **Signing** — Apple Developer ID / Authenticode remain unavailable; prompts stay.
5. Assignment 21 owner bindings (above).

Review acceptance and CJ acceptance remain separate.
