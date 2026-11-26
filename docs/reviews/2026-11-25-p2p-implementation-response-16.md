# Implementation response 16 — a packaged desktop app and verified P2P play — 2026-11-25

## Scope and source

- **CJ's requested goal and scope:** amended [Assignment 16](2026-11-25-next-agent-assignment-16.md) under [Addenda 07](../requirements/2026-11-25-human-feedback-addendum-07.md)–[08](../requirements/2026-11-25-human-feedback-addendum-08.md), with [Electron desktop delivery v1](../integrations/electron-desktop-v1.md) and [P2P play and matchmaking v1](../integrations/p2p-matchmaking-v1.md). The default experience is download, install, open and play. That means a bundled Electron runtime, game, engine and native peer dependencies; one reusable peer runtime behind a sandboxed renderer; and stable OS user data. Browser development and headless operation are retained.
- **Starting point:**
  - I fetched origin `73c62bd..ca72e2f` and fast-forwarded with nothing local.
  - There was no Assignment 16 work in this checkout or in any other worktree, stash or recent Codex session, so there was no earlier work to preserve.
  - The engine stays at `ba838cca09ba43afceda0452b63d28df4cbf7f72`.
- **Implementation commits (local, on `ca72e2f`):**
  - `9a76b2b`: first attachment.
  - `95dce9d`: lobby, session and remote Ticks.
  - `81e27c9`: verified results and the archive.
  - `c918ec3`: tables, invitations, relay configuration and the journey.
  - `3873073`: ad-hoc seal.
  - `07a2b0b`: online result headline.
  - `b48ef7d`: README, runbook and manifest tool.
  - `5326438`: dirty flag.

  This documentation follows. **The candidate is `532643846f815106f7e33551099d02008e03c4d2`, clean.** Nothing is pushed.
- **Changed areas:**
  - `desktop/`: main, CJS preload, utility peer host, smoke automation, network configuration, entitlements, icon.
  - `forge.config.cjs`.
  - `src/hapa/network/`: store, identity, compatibility, control, lobby, online match, results, result index, runtime.
  - `src/hapa/host/owner-routes.js` and `src/hapa/protocol/admission.js`.
  - `src/hapa/presentation/online.js`, plus hooks in `app.js` and `versus.js` and styles in `versus.css`.
  - `tools/hapa/`: `online`, `lobby-serve`, `desktop-smoke`, `desktop-journey`, `desktop-manifest`, `engine-closure` and `make-icon`; `history.mjs` corrected.
  - `tests/hapa/online.test.js`.
  - `package.json` and `package-lock.json`.
  - `vite.config.js` now uses the shared route table.
- **Pinned tools:** Electron 45.3.0 (Node 24.22.2 inside), Electron Forge 8.0.1, Hyperswarm 4.17.2, Protomux 3.13.1, Hypercore 11.40.4.
  - `three` and the fonts moved to devDependencies, since they are compiled into `dist/`.
  - `npm audit --omit=dev` reports 0 vulnerabilities. The 4 high findings are in a dev-only build tool (`image-size`, via the DMG maker).
- **Overwatch:** new card HV-67 (In Progress), created with `evt_1795659602969_dbd7db16`. The first-attachment note is `evt_1795659602978_d7fe7cc4`. The handoff note follows this commit.
- **CJ acceptance:** not recorded.

## Outcome

The installed app now works as a player app on one Mac:
- it opens to Play online and Play on this computer;
- it plays locally with every Hapa owner absent;
- it finds other players over the public HyperDHT, challenges, opens a table or joins by pasted invitation;
- it plays one's own seat against a remote player through signed Hypercores;
- it survives reload, quit/relaunch and a crash of its peer process;
- it saves a result that any observer can recompute, including from a headless archive while both authors are offline.

The separately gated claims are:

| Claim | Status |
| --- | --- |
| **Implemented** | Yes: everything listed below. |
| **Locally verified** | Yes, on this Mac: two app instances, headless peers, a local archive and a local relay. |
| **Packaged** | Yes: macOS arm64 DMG and ZIP from clean `5326438`. |
| **Signed / notarized** | **No.** Ad-hoc seal only. No Developer ID exists on this Mac, and Gatekeeper rejects the app. |
| **Installed on a clean supported machine** | **No.** Installed from the DMG into a scratch folder on the build Mac, launched with no Node on PATH. |
| **Verified across different internet networks** | **No.** Every run was on one Mac and one connection. |
| **Operated / deployed** | **No.** No public archive or relay is running. |
| **Published** | **No.** The artifacts exist only in the ignored `out/` folder. |
| **Accepted by CJ** | **No.** |

## What was built

### Desktop shell (Batch 1 attachment, then tightened)

- **Process model:**
  - Electron main owns the `app://versus/` origin, served from the bundled `dist/`, with built files taking precedence over owner routes.
  - Main also owns the window (remembered on-screen bounds), the menu (About, Show Player Data Folder), the single-instance lock and the peer utility process. That process restarts under a bounded policy of 3 restarts per 60 s, and the page reattaches.
  - A graceful quit stops the peer runtime with a 4 s bound.
  - After sleep, presence is refreshed.
- **Renderer boundary:**
  - The renderer is sandboxed, with `contextIsolation`, no `nodeIntegration` and web security on, under a restrictive CSP.
  - The CJS preload exposes only `call(op, args)`, `host(op)` and `onEvent`.
  - Main checks that the sender frame is the main frame on `app://versus`, and checks the operation name against an allowlist.
  - Fuses are set: no RunAsNode, no `NODE_OPTIONS`, no inspect arguments, ASAR integrity on, app only from ASAR.
- **Packaging:**
  - Forge runs the existing Vite build in a hook. There is no second bundler.
  - Packaging uses an allowlist that excludes `dist/renditions` (owner media), docs, tests and the vendored engine source.
  - Only darwin-arm64 prebuilds are included, and native addons are unpacked from ASAR.
  - All six native addons (rocksdb, sodium, udx, fs-native-extensions, quickbit, simdle) load in the utility process unchanged, because they are N-API, so no ABI rebuild was needed.
- **Player data:** everything lives under `~/Library/Application Support/Hapa Versus/state/<network>/` (identity, transport key, matches, results, outbox, settings, reservation), behind an OS file lock. Nothing is written inside the bundle.
- **First-attachment fixes:**
  - The `app` scheme needs `corsEnabled` for module scripts.
  - Harbor's `/assets` route shadowed the build's `/assets/`. The same collision affects `vite preview`, which is not changed here.

### Peer runtime and network (`src/hapa/network/`), one per player process, used by desktop and headless hosts

- **Identity and lobby:**
  - The persistent player key is `hv1:<ed25519>`, with a short fingerprint.
  - There is one Hyperswarm per process. The lobby topic is `hapa-versus/lobby/v1/<network>`; matches also join `…/match/v1/<id>`.
  - HELLO/AUTH has each side sign the other's fresh nonce together with both Noise transport keys before the peer enters the roster.
  - Presence is a 15 s heartbeat with 45 s expiry on a monotonic clock. States are Available, Busy, joining, in-match and reconnecting.
- **Challenges and invitations:**
  - Challenges are signed (120 s expiry). There is one durable reservation per identity, with decline or busy answers.
  - An open table seats the first compatible joiner and declines later ones as `taken`.
  - An invitation is a signed `hvinv1.` capsule: network, player, transport key, table, offer hash and expiry. It carries no secret and no loopback address.
- **Session descriptor:** both players sign it with domain separation. It binds:
  - the network, challenge and acceptance hashes;
  - the bundled-preset manifest hash and initial state hash;
  - an exact rules-implementation fingerprint (sha256 of `src/hapa/rules/*.js` plus the bundled content);
  - the players, and the feeds bound to each owner.

  The joiner validates the manifest against its own bundled preset.
- **Online match (`online-match.js`):**
  - Each player's own Hypercore is the command journal. A Ready, a choice or a receipt is appended before it is reported.
  - On reopen, the loop consumes recorded records before asking the player anything. Restart recovery is therefore a replay of signed history, with no second Ready and no re-asked choice.
  - Draft plan revisions are coalesced and serialized in the append queue.
  - Choices are bound to Tick, choice id, index and request hash.
  - Receipts must match the locked pair, state and outcome, or the match pauses as disputed.
  - Remote records pass `admitRecord` (schema, match, author key, feed position as sequence, plausibility, 64 KiB bound, signature) before any queue. Unconsumed remote input is bounded at 512 records.
  - A feed truncated below the agreed position is a dispute.
- **Results:**
  - A `hapa-versus-result/v1` bundle holds the signed session, the manifest and both feeds through the final receipts.
  - `verifyBundle` recomputes every Tick from the records and refuses any claimed outcome it does not calculate.
  - `ResultIndex` counts one result per commitment and quarantines forgeries. Only the same signers' contradictory transcripts make a dispute; evidence that reuses the match id under other keys is a separate record. The index can be rebuilt from stored bundles.
  - Participants save locally first. An idempotent outbox then shares with archives (4 MiB result frames; a 15-Tick bundle is 87 KB).
  - Observers pull and verify. Records are separated into buckets: human-vs-human, human-vs-bot and bot-vs-bot.
- **Headless:** `npm run online` and `npm run lobby:serve`. The latter is the archive role: it verifies, stores and serves, and never plays.
- **Relay:** Hyperswarm `relayThrough` is used with keys from `desktop/network.json` (currently empty) or a user-data override. A path is labelled `relayed` only when the connection endpoint is a configured relay endpoint; otherwise it is `unknown`. The earlier `direct` label is removed because it overclaimed.

### Game page

- **Play online section:** join with a name, Available/Busy, a roster showing availability, declared controller, rules compatibility and each player's verified W–L–D with bucket and denominator, Challenge, Join table, Open a table with Copy invitation, and Paste invitation. Archive status is shown.
- **Online seat:**
  - It sends only own-seat drafts, Ready and choices through the bridge.
  - It replays the runtime's locked pair and recorded choices for presentation, and checks each agreed receipt before opening the next Tick. On a mismatch it reopens the match from its record.
  - The match bar shows "vs <name>" and the connection state; the Ready button reads "Ready · waiting for <name>".
  - The opponent seat is `remote`: never a local bot, never Red.
  - The result sheet shows Victory or Defeat from your own seat, then "Result saved on this computer · archive pending" or "archived by …", with Return to lobby.
- **Unchanged local play:** local human/bot play, fixtures, the lab, the editor and the music/table setup are untouched. `?debug` adds `_devPlanWithBot`, which the journeys use to enter an ordinary plan revision.

### Owner adapters and starter content

- **Owner routes:** one table (`src/hapa/host/owner-routes.js`) serves both Vite and the desktop. Desktop owners come from an explicit `owners.json` in user data (loopback `http` only, tokens read by the host). Unconfigured owners answer 503 with a reason.
- **With CJ's owners configured:** Harbor capabilities and the music library answer 200. Red's renderer package, voice and music bind.
- **Red's portrait in the desktop app:** it falls back to text-only. Harbor's `resolveResources` accepts only `http:`/`https:` mount URLs, and the desktop origin is `app://versus/`. This is an owner dependency (below), not a game change.
- **Bundled starter content:** the procedural unit kit, scenery, fallback Card faces, 15 font files, the engine runtime compiled into `dist/`, and an app icon drawn by `tools/hapa/make-icon.py`. Card renditions and a Red snapshot are not bundled.
- **Content checks:** [installed-content-manifest.json](evidence/2026-11-25/response-16/installed-content-manifest.json) records 613 files, the hashes of the 6 native addons, and zero forbidden paths (no keys, tokens, `.env`, player stores, owner media, docs or engine source).

## Assignment findings

| Finding | Disposition | Evidence and limits |
| --- | --- | --- |
| 1. Private engine dependency | **Players:** the installer bundles the compiled engine, so no submodule or token is needed. **Source builds:** `tools/hapa/engine-closure.mjs` lists the exact 105 engine files the game imports (3.3 MB, revision `ba838cc`, MIT licence hash) in [engine-runtime-manifest.json](../integrations/engine-runtime-manifest.json). | **Gate:** the engine owner's approval to publish a revision-pinned snapshot of exactly these files. Nothing has been published, and no repository visibility was changed. |
| 2. Loopback bots only | Real HyperDHT discovery, real browser/desktop participation and headless peers. `npm run peers` is kept as the fast regression. | Same-machine public-DHT runs only. |
| 3. Browser and Node session paths | One Node authority per player, in the desktop utility process or a headless host. The page sends own-seat intent and replays the agreed results, with no hotseat or local opponent. | Browser development keeps local play. Online play in a plain browser tab (a loopback API adapter) is **not built**: online play is desktop and headless only. |
| 4. No restart recovery | Journal replay from signed own and remote feeds, with persisted session, progress and reservation. Covered: renderer reload, app quit/relaunch, hard kill of the peer utility process, and hard kill of a headless peer after a committed Ready. | A partly answered response window across a restart was not specifically exercised. The replay consumes recorded choices by design. Sleep/wake was implemented but not exercised. |
| 5. Remote record admission | `admitRecord` on every remote record before queueing; feed-position sequencing; truncation becomes a dispute; feeds bound by owner in the signed descriptor and authenticated connection. | Unit cases in `online.test.js`. Live equivocation over Hypercore (a fork by a writer) was not staged. |
| 6. Public outcome trust | `verifyBundle` recomputes and compares; `ResultIndex` deduplicates by commitment and keys disputes to the signed session; the history CLI imports the calculated outcome and refuses a forged claim. | Unit cases, and archive/observer runs. |

## Journeys and observed results

All runs: one Mac (macOS 26.2, Apple Silicon), one internet connection, isolated `test-*` networks on the public HyperDHT, and test identities in scratch data roots. They are attachment evidence. **None of them satisfies journey 2 (different networks).**

1. **Installed app, owners absent, no system Node:** [installed-smoke.json](evidence/2026-11-25/response-16/installed-smoke.json), from a copy installed out of the DMG of `5326438`.
   - Launched twice with `PATH=/usr/bin:/bin`. A local match rendered on `app://versus` (Tick 1, 36 parties), with no Node in the page.
   - The native store grew from 1 to 2 records under the same identity, and the transport started and stopped.
   - The bridge refused an unknown operation and returned no key material. Owner routes answered 503, and no data was written into the bundle.
   - Capture [07](evidence/2026-11-25/response-16/07-installed-local-match-owners-absent.jpg).
2. **Online desktop journey (packaged, then installed):** [installed-journey.json](evidence/2026-11-25/response-16/installed-journey.json) (build `3873073`).
   - **Launch 1:** joined the lobby, saw Bram, challenged by click, made 5 Readys (median acknowledgment 59 ms), reloaded the renderer and reattached at Tick 3, then quit mid-match.
   - **A second launch on the same store** exited in 0.14 s without writing.
   - **Launch 2:** reattached to the same match under the same identity. Its peer utility process was SIGKILLed and restarted. It played to the concession at Tick 25: 25 agreed Ticks, and the view replay equalled every receipt. Both feeds had 76 records with fork 0.
   - **The opponent** reached the same final hash, `829adb06…`, and its result was archived.
   - **A fresh observer**, with both authors gone, fetched 1 result and verified it: Cal 0–1 and Bram 1–0 (human-vs-bot). The second sync added 0.
   - Captures [01](evidence/2026-11-25/response-16/01-lobby-joined.jpg), [02](evidence/2026-11-25/response-16/02-roster-opponent-available.jpg), [04](evidence/2026-11-25/response-16/04-ready-committing-vs-remote.jpg), [05](evidence/2026-11-25/response-16/05-reattached-after-reload.jpg) and [06](evidence/2026-11-25/response-16/06-result-saved.jpg).
3. **Two installed apps, human against human:** [installed-human-vs-human.json](evidence/2026-11-25/response-16/installed-human-vs-human.json), build `5326438`.
   - Cal challenged and Bea accepted in her own UI ([03](evidence/2026-11-25/response-16/03-challenge-received.jpg)). Each controlled only its own seat.
   - 11 Ticks agreed, the views matched the receipts, and both reached final hash `027b2454…`. Median Ready acknowledgment was 58 and 49 ms.
   - Cal's sheet reads Defeat and Bea's Victory ([08 Cal](evidence/2026-11-25/response-16/08-result-cal.jpg), [08 Bea](evidence/2026-11-25/response-16/08-result-bea.jpg)).
   - An earlier pair on build `3873073` played 15 Ticks.
4. **Owned response choices through the UI:** [installed-response-choices.json](evidence/2026-11-25/response-16/installed-response-choices.json). In one of three installed runs the desktop seat answered 4 response windows through the response panel, over 41 agreed Ticks, with the view matching. Across the headless matches, 27 signed choice records were bound and verified.
5. **Headless network runs:** [headless-network-runs.json](evidence/2026-11-25/response-16/headless-network-runs.json).
   - A 24-Tick public-DHT match with the same hash on both sides.
   - Hard-kill recovery: Bram was killed after 7 agreed Ticks with his Tick 8 Ready committed. He resumed from his journal, signed nothing twice, and reached the same final hash.
   - Archive and observer: both authors uploaded (`added`, then `duplicate`), and the observer verified with both authors offline. An observer restart added nothing.
   - Invitation: the guest joined by code and played 42 Ticks; a late joiner was told the table was no longer open.
   - **Local blind relay** (`blind-relay` 2.2.2 server on this Mac): both connections observed as `relayed`, the relay counted 2 sessions and 1 matched pairing, and a 33-Tick match finished.
6. **Trust boundaries (journey 5):** `tests/hapa/online.test.js` covers:
   - **Record admission:** wrong match, author, position, payload after signing, envelope, type, oversized, and a legitimate sequence restart in a new match.
   - **Result verification:** a forged outcome, a wrong context, a missing consent, a truncated transcript and an altered descriptor.
   - **The index:** a duplicate and a repackaging count once; a forged copy is refused; a same-id impostor stays a separate record; a fabricated receipt cannot dispute; a real same-signer conflict becomes disputed and leaves the totals; the projection survives a rebuild.

The working response targets were measured on these runs: Ready acknowledgment median 44–67 ms (95th percentile ≤127 ms, against a 150 ms target), and a match starting under 1 s after an accept. Roster and lease timing were not measured separately.

## Verification record

| Check | Revision | Result | What it establishes |
| --- | --- | --- | --- |
| `npm run check` | `5326438`, clean | Exit 0: 161/161 tests (3 new online tests), bot smoke, two-process peers, build ([summary](evidence/2026-11-25/response-16/npm-check-summary.txt)) | Rules, protocol and build regressions, plus the new trust boundaries |
| Packaged smoke ×2, installed from the DMG | `5326438` | ok | First attachment on the actual artifact |
| Packaged desktop journey | `3873073` (installed); earlier on packaged `3873073` | ok | Lobby, reload, quit/relaunch, second launch, utility crash, concession, archive observer |
| Two installed apps | `5326438` and `3873073` | ok | Human against human through the real UI |
| Content manifest and signature | `5326438` | 613 files, 0 forbidden; deep verify valid; ad hoc; `spctl` rejected | Contents and signing state |
| Artifact hashes | `5326438` | DMG `c6054407…`, ZIP `d6e40372…`, `app.asar` `357c7f2c…` ([artifacts.json](evidence/2026-11-25/response-16/artifacts.json)) | Exact candidate |

`3873073` and `5326438` differ in app content only by the online result headline (Victory/Defeat) and the build-info dirty rule. The longer journeys were not repeated after that one-line presentation change.

## Remaining gates and limits

1. **Two computers on different internet connections (journey 2).** This needs a second Mac on another network, ideally a third for the observer. The [runbook §3](../integrations/online-desktop-runbook.md) gives the exact session, and the installer is ready.
2. **Signing and notarization.** This needs an Apple Developer ID certificate and notarization credentials in the build environment. `forge.config.cjs` already wires the hardened runtime, the entitlements and `osxSign`/`osxNotarize` from environment variables ([runbook §6](../integrations/online-desktop-runbook.md)). Until then, Gatekeeper rejects downloaded copies.
3. **An operated public archive and relay.** This needs a host that is always on. `npm run lobby:serve` and `blind-relay` are ready, and `desktop/network.json` has empty lists that are clearly labelled. Without a host, results stay local until an archive is online, and peers behind strict NATs may fail to connect.
4. **Public source build of the engine.** The engine owner must approve publishing the 105-file snapshot.
5. **Red's portrait inside the desktop app.** Harbor's renderer refuses non-http mount URLs. Harbor (a separate owner) needs to admit the `app://versus/` mount, or approve a packaged Red snapshot. Red's voice and music binding already work through the desktop adapter.
6. **Not built:**
   - online play from a plain browser tab (an authenticated loopback adapter);
   - Rematch (players return to the lobby instead);
   - cross-player Avatar presentation (remote players get a name and nameplate, not a portrait);
   - a redacted diagnostics export;
   - a Windows build.
7. **Not exercised:**
   - sleep/wake;
   - app replacement with an older or newer version;
   - a restart in the middle of a partly answered response window;
   - an Internet-reachable relay;
   - corporate networks that block UDP.
8. **Owners and other work:** no owner repository was changed. The running local owners (Harbor, music libraries, Harness) were reached only through their normal loopback routes, during one owner-adapter check from a scratch data root.

## Decisions and next handoff

- **Decisions made within the specification:**
  - match id = `hv-<challenge id>` (secure randomness);
  - the challenger is seat A and the coordinator;
  - online play uses only the bundled preset; local Cards are never used online;
  - a 4 MiB result-frame cap, measured above;
  - the dispute scope is the session descriptor, so a match id is not an authority;
  - an ad-hoc seal for unsigned builds;
  - the debug-only `_devPlanWithBot` journey aid.
- **For CJ:**
  - install `Hapa Versus.dmg` (SHA-256 `c60544071b5c4e66fdfc6ec594f3b925a11edf91db5b5d816fc587d685cfc314`) on two Macs on different connections and run [runbook §3](../integrations/online-desktop-runbook.md);
  - decide the signing account, the archive/relay host and the engine snapshot approval.
- **Stop:** this work item and its automatic continuation end with this handoff. Nothing is pushed until CJ says so.
