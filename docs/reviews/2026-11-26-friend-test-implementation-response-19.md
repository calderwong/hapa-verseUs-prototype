# Implementation response 19 — A friend opens the app and plays across town

**26 November 2026 · coding agent (Claude Code) · answers [Assignment 19](2026-11-26-next-agent-assignment-19.md), [Addendum 09](../requirements/2026-11-26-human-feedback-addendum-09.md), [connectivity companion](../integrations/friend-test-and-resilient-connectivity-v1.md); reconciles [Assignment 18](2026-11-26-next-agent-assignment-18.md) / [Review 18](2026-11-26-readiness-review-18.md) · GitHub task [#1](https://github.com/calderwong/hapa-verseUs-prototype/issues/1)**

## Status in three separate claims

| Claim | Status |
| --- | --- |
| **Candidate prepared** | **Yes.** Clean build of `c7a00c1`, macOS Apple Silicon, published as a GitHub pre-release (below). Installed copy passes the clean-runtime smoke and an installed two-instance invitation game on this Mac over the public DHT. |
| **Ready for the friend to try** | **Conditionally.** Two inputs are outside the agent's reach: (1) the friend's computer type (this build runs only on Apple Silicon Macs), and (2) Apple Developer ID signing/notarization — without it macOS shows "cannot verify the developer" and the friend must approve the app once under System Settings → Privacy & Security → **Open Anyway**. If CJ accepts that one documented step for this test and the friend has an Apple Silicon Mac, the build is ready to try now. |
| **Friend test passed** | **Pending.** No two-network human session has happened. Nothing here simulates it. |

## Identity of the candidate

| Item | Value |
| --- | --- |
| Source | `c7a00c1308321a79d9bba1bcacf68382cf6626df` (clean; build-info `dirty: false`), on top of A18 checkpoint `7ebe1c5` and tasking `911f1c4` |
| Engine | Luminati Hapa fork `ba838cca09ba43afceda0452b63d28df4cbf7f72` |
| Profile | `hapa_open_10x9_v3_07` |
| Protocols | online `hapa-versus-online/v2`, lobby `hapa-versus-lobby/v1`, invitations `hvinv2` (signed contact snapshot; `hvinv1` still read), contact `hapa-versus-contact/v1` + snapshot v1 under signature domain `HAPA-VERSUS CONTACT v1`, services `hapa-versus-service/v1` / policy v1, peer runtime `0.2.0` |
| Platform | macOS 26 arm64 (Apple Silicon), Electron 45.3.0 |
| Artifact | `Hapa-Versus-0.1.0-friend1-macOS-AppleSilicon.dmg` · 124,514,266 bytes · SHA-256 `5bc9778ff980e7a09bc516fa7b5b0f4fd4d3d8b380ba06adacfdb83023b35369` |
| Signing / notarization | Ad-hoc signature, no Team ID, not notarized. A quarantined (downloaded) copy is rejected by `spctl` (`source=no usable signature`). No quarantine removal or security change was used for any acceptance evidence. |
| Download | GitHub pre-release **[friend-test-1](https://github.com/calderwong/hapa-verseUs-prototype/releases/tag/v0.1.0-friend.1)**, linked from the README's *Download and play* section |
| Friend instructions | [Play with a friend](../player/play-with-a-friend.md) · [two-network evidence form](../player/two-network-evidence-form.md) |

## Windows build for the friend (added after CJ confirmed a Windows PC)

| Item | Value |
| --- | --- |
| Artifact | `Hapa-Versus-0.1.0-friend2-Windows-x64.zip` · 167,148,994 bytes · SHA-256 `28b147741db6a7b515bce46e9aaa11daa2909f6e4e52d6bde8eddce168c97650` · portable zip (extract, open `Hapa Versus.exe`) |
| Source | `fa51315b773e3d336991849a7d868bde0453163c` — app source identical to `c7a00c1`; adds only the win32 zip target, `.ico` and exe metadata (`npm run desktop:make:win`). Same rules/compatibility as the Mac candidate, so the two play each other. |
| Download | GitHub pre-release **[friend-test-2](https://github.com/calderwong/hapa-verseUs-prototype/releases/tag/v0.1.0-friend.2)** |
| Signing | None (no Authenticode certificate). Expected SmartScreen "Windows protected your PC" → More info → Run anyway; Windows Defender Firewall may ask to allow network access. |
| Verified | Built on this Mac and inspected only: PE32+ x86-64 GUI exe; all six native modules from their `win32-x64` prebuilds (PE32+ x86-64 DLLs); fuses identical to the Mac build; the embedded `ELECTRONASAR` integrity resource matches the recomputed asar header hash. **Not run on Windows** — no Windows machine or VM is available here. FT-01/FT-02 for Windows remain open until the first launch on a Windows PC; the friend's first launch is that run. |

Status: candidate prepared for Windows x64. Ready for the friend to try, with three stated caveats: it has never been run on Windows; SmartScreen and the firewall will each ask once; and your Mac needs Open Anyway the first time. Friend test passed: pending.

## What changed

**N19-03 — replaceable providers, end to end.** `src/hapa/network/services.js` defines typed descriptors (`bootstrap`, `relay`, `archive`, `gateway`) with role, adapter version, overlay scope and real provenance: the three public HyperDHT entries are recorded as *bundled defaults copied from hyperdht@6.37.0* (no operator signature is claimed), `desktop/network.json` as bundled configuration, `userData/network.json` as a local adoption. Accepted decisions (seed/add/update/disable/retire/mode) are appended to a local single-writer Hypercore (`cores/service-policy`); importing the same content again appends nothing; an invalid update is refused and the last valid policy stays. Modes: `default`/`extend` (public overlay plus accepted nodes of the same overlay), `replace` (only accepted non-default nodes; an empty replacement is refused rather than isolating the player), `isolated` (an explicitly named development overlay). Electron main now forwards the raw sections; the utility host passes them on; the runtime validates and hands the **effective bootstrap list and every relay candidate** to Hyperswarm (before: no bootstrap forwarding, only `relays[0]`). The Lobby rotates relay candidates per relayed attempt and prefers one observed carrying a connection. `tools/hapa/relay-serve.mjs` is a native blind relay any operator (friend, community, third-party VPS) can run. Future adapters are retained as data and never executed.

**N19-02 — online as a normal in-app flow.** Play online starts discovery itself (after an explicit Leave lobby it waits). Joins (lobby table or invitation) return at once with a stable **attempt id** and advance through visible stages — starting discovery, looking for the player, checking who answered, agreeing the table, connected — or end failed/cancelled with a stage-specific reason; **Cancel** and **Retry** are on screen. The same attempt id never makes a second seat; a cancelled attempt's late completion leaves no reservation; a cancel after the accept leaves that setup durably (tombstone + `left`). The 20 s host deadline versus 45 s join mismatch is gone (joins no longer block the host call; archive lookups get 120 s). "Discovery running" is no longer shown as "Connected"; incompatible-peer and failed-authentication counters are kept. **Copy connection report / Save diagnostics** produce a redacted text: build/platform, compatibility, discovery/DHT state, service policy with provenance, relays tried/observed, attempt, reservation/match state, fingerprints only — no keys, tokens, addresses, paths or invitations.

**N19-04 — signed contact history.** `src/hapa/network/contact.js`: one persistent single-writer contact Hypercore per player, bound by a root-signed first record; later records carry sequence and previous-record hash. A transport-key change appends a record and retires the old key; `hv1` never changes. Snapshots are compact root-signed capsules (they authorize content; they are not proof that a core checkpoint was fetched — evidence is recorded as `snapshot` vs `core-verified`). Open a table now issues `hvinv2` invitations carrying a snapshot; `hvinv1` still decodes. After authentication peers exchange snapshots and replicate/verify each other's cores; the cache rejects forged bindings, known rollback (older sequence, shorter core than verified) and forks (same sequence, other content; a different core; truncation below a checkpoint). Cached contact transports are dialed in addition to the invitation's, but never extend an invitation, challenge or reservation. Nothing claims knowledge of unseen revocations.

**N19-01 — packaged player path.** The installed app needs no Node, npm, checkout or Hapa owners; identity, contact core, service history and matches live under the OS userData folder outside the app (the smoke and journey use isolated data roots). Native Hypercore storage and networking run inside the packaged utility process.

## Assignment 18 reconciliation

The A18 work in progress was preserved and committed as `7ebe1c5` (174/174 then). Dispositions — *implemented* means code plus focused tests; native/installed staging is stated separately:

| Finding | Disposition |
| --- | --- |
| R18-01 default Avatar | Cause identified: Harbor (owner of Red's renderer `red-pose-art` 2026-11-02.1, built from the Mesh Avatar pin `a6fc511`) was not running, so `/capabilities` returned 502. Not a code regression. Implemented: epoch-fenced retry with backoff + **Show Red**, entrance owner notice, `npm run owners`, desktop loopback renderer frame. Browser witness: owner down → empty chair; owner back → Red seated in the same match, one performer. Installed Red rendering through the frame is **not yet witnessed** (needs owners.json pointing at a running Harbor). |
| R18-02 ambiguous Ready | Implemented (explicit committing/committed/refused/none; frozen intent; late events settle). Installed staging of a delayed append: **not staged**. |
| R18-03 reservations | Implemented (unstarted release on `left`, Leave for unstarted matches, startup release of an orphaned active reservation, v1 kept as `unsupported`). Covered by existing recovery tests; lost-STARTED native staging **not staged**. |
| R18-04 stale snapshot | Implemented (authority boot/sequence ordering). Controlled tests only. |
| R18-05 worker deadline | Implemented (retire + bounded replacement + Start it again; test hooks `HAPA_VERSUS_PEER_STARTUP_MS`/`_DELAY_MS`). Installed late/never-ready run **not staged**. |
| R18-06 terminal recovery | Implemented (finishing authorities get topics/connections; evidence retrieval from the counterpart's stored verified bundle). Native two-match finalization test passes; the early missing-closing cut and delayed counterpart **not natively staged**. |
| R18-07 / R18-08 archive | Implemented (all commitments advertised; per-source completion, no cached false zero). Controlled only. |
| R18-09 / R18-10 presentation | Implemented (work-cell terrain cue; one presentation clock; gear eligibility; brace; party hit totals; brush-pixel slabs/discs; Red's scene light). Browser-checked at Home; the full combat/speed/terrain witness set is **not captured**. |

These unstaged cases are agent-side qualification still owed before a broad QE handoff. They do not block the simple first friend game (they are recovery paths), and the friend is not asked to exercise them.

## FT dispositions

| FT | Result |
| --- | --- |
| FT-01 Artifact | macOS arm64 DMG with manifest/checksum above. Normal downloaded open **not met without Developer ID**: Gatekeeper rejects the quarantined copy; the documented OS flow requires Open Anyway. Friend platform unknown. |
| FT-02 Clean runtime | **Pass (installed, this Mac).** [installed-smoke.json](evidence/2026-11-26/response-19/installed-smoke.json): two launches from the DMG copy with a minimal environment — board renders, native core append/close/reopen, identity stable, store grows, transport start/stop. |
| FT-03 Connect | **Human two-network: pending.** Engineering evidence: [installed-invite-journey.json](evidence/2026-11-26/response-19/installed-invite-journey.json) — two installed copies on ONE Mac over the public HyperDHT, `hvinv2` invitation copied/pasted with the real buttons, stages finding-player → negotiating → opened, both seats human. |
| FT-04 Play/result | Human: pending. Same journey: Ready pressed by each seat (4 each), deliberate concession at Tick 4, identical final hash `sha256:3f986a81…c1e8`, result recorded on both. |
| FT-05 Persistence | **Pass (installed, this Mac):** both copies reopened with the same fingerprints and `recorded` results. |
| FT-06 Recovery | Attempt fencing (duplicate id, cancel, late completion) — controlled native test. Relevant R18 cuts: see table above (several not staged). |
| FT-07 Bootstrap policy | **Pass (controlled native fixture):** an accepted isolated overlay with one dead bootstrap entry beside working ones reaches the native options and both peers authenticate. Public-overlay extension semantics: policy tests. |
| FT-08 Service fallback | **Partial.** Candidate rotation past an unreachable first relay to the second is verified in the running Lobby, and sessions authenticate with relays configured. A session forced through the second relay was **not** achieved: on a loopback testnet HyperDHT upgrades to the direct path. A NAT/firewalled fixture (two network namespaces or VMs) is needed for that witness. No public relay is qualified or configured. |
| FT-09 Contact trust | **Pass (controlled native):** restart without appends, transport rotation with stable `hv1`, snapshot/core replication and verification between peers, forged binding/rollback/fork/tamper rejection, expired invitation not revived by cached contact, invalid/truncated invitation creates no reservation. |
| FT-10 Delivery | Friend sheet, evidence form, README download link and in-app redacted report: **done**. Human outcome: pending. |

## Checks

- `npm run check` on the candidate source: see [npm-check-summary.txt](evidence/2026-11-26/response-19/npm-check-summary.txt).
- New product tests: `tests/hapa/connectivity.test.js` (policy, FT-07, FT-08 partial), `tests/hapa/contact.test.js` (FT-09, attempts).
- Installed: `tools/hapa/desktop-smoke.mjs` (FT-02/05), `tools/hapa/desktop-invite-journey.mjs` (FT-03/04/05 engineering witness on one machine).

## Remaining, separately

**External inputs (CJ):**
1. ~~The friend's computer~~ — CJ answered: Windows PC. Windows x64 build published (above); its first real run is on the friend's PC.
2. Apple Developer ID signing + notarization credentials, **or** CJ's acceptance of the one-time Open Anyway step for this test.
3. The two-network session itself (CJ + friend), recorded on the evidence form.

**Agent-side work still owed:** installed staging of the R18 recovery cuts listed above; a NAT fixture for FT-08; the installed Red frame witness; the remaining VA capture set.

**Parent scope, unchanged and not claimed:** browser online adapter, direct Rematch, live directory/profile beyond archive-known players, offline third-observer/archive availability, anonymous public source build (the engine submodule is private), lifecycle/platform checks.

If the real networks fail to connect: run Copy connection report on both machines and diagnose the stage (discovery not reaching the network, no connection opening, authentication, compatibility, setup) before choosing infrastructure. A relay is adopted as a typed `relay` service; nothing is rented automatically, and a hotspot result would not pass the home-network target.

CJ retains Done and human acceptance.
