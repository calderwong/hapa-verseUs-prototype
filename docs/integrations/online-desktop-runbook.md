# Hapa Versus desktop and online play: install, test and operate

**Date:** 25 November 2026. **Applies to:** the Assignment 16 candidate (see [Response 16](../reviews/2026-11-25-p2p-implementation-response-16.md)).
This runbook covers what exists, how to run it, and the steps still owned by an operator or by CJ. It does not claim that any public service is running.

**Current review (27 November 2026):** [Review 22](../reviews/2026-11-27-runtime-and-roster-review-22.md), source `164aa5d`, assesses [Response 23](../reviews/2026-11-27-implementation-response-23.md) / friend.6. [Assignment 24](../reviews/2026-11-27-next-agent-assignment-24.md) is answered by [Response 24](../reviews/2026-11-27-implementation-response-24.md) / friend.7 (readiness-aware attachment, one Avatar choice, exact relay report set; awaiting review). Previous activation/provider fixes, controlled relay carriage and primary Windows evidence are credited.

## Current delivery target — the simple friend test

[Addendum 09](../requirements/2026-11-26-human-feedback-addendum-09.md) retains the target: obtain the matching bundled app, open it normally, choose Play online, Challenge/Accept or exchange an invitation, complete a human game and quit/reopen with matching results. No terminal, provider JSON, private engine checkout, owner app or CJ-maintained VPS belongs in the normal friend flow.

**Friend's platform: Windows PC, confirmed.** [Friend.7](https://github.com/calderwong/hapa-verseUs-prototype/releases/tag/v0.1.0-friend.7) contains Mac arm64/Windows x64 builds from clean `7efa3b9050cc4061e521c1e202da14b65ab35e9c`. Gated run [46118198321](https://github.com/calderwong/hapa-verseUs-prototype/actions/runs/46118198321) passed all six required reports on the released zip (artifact hash, isolated and `%APPDATA%` launches/reopen, same-VM invitation/result, late/never-ready startup). The CLI download carries no Mark-of-the-Web. (Friend.6's run 46102314253 was verified by Review 22.) Ordinary consumer prompts/download behavior and two-home Mac-to-Windows play remain unverified. See [downloads](../../README.md#download-and-play), [player sheet](../player/play-with-a-friend.md) and [evidence](../reviews/evidence/2026-11-27/review-22/README.md).

Candidate prepared, platform-executed, dependable friend-test recommendation, actual two-network success and CJ acceptance are different statuses. Review 22 required the connection-readiness correction and its focused qualification; Response 24 reports both done with friend.7 (awaiting review), and the two-home human test is next. Continue authorized implementation and concrete qualification; do not make unrelated optional Avatar or archive work a blanket prerequisite for exploratory human networking. Historical steps below remain useful where compatible with the actual artifact.

## 1. Player install (macOS Apple Silicon)

1. Get `Hapa Versus.dmg` (or the `.zip`) for `darwin-arm64` and check its SHA-256 against the release record.
2. Open the DMG and drag **Hapa Versus** to Applications. Open it.
3. Local play works immediately and offline: **Play on this computer → Start match** (you against the heuristic bot).
4. Online: **Play online** (discovery starts by itself; Leave lobby stops it). Your name, availability and finished match evidence (moves, choices, result — never chat, voice or music) are shared with the lobby.

Nothing else is required: no Git, Node, npm, terminal, Vite server, engine credentials or other Hapa apps.

**Historical signing state (Response 16/17 candidate):** the candidate was sealed with an ad-hoc signature only, without Developer ID signing or notarization; the report records rejection of the downloaded-launch path. Earlier manual-open/unquarantined-delivery workarounds do not satisfy Addendum 09's normal download/open acceptance. The next agent must verify the exact artifact on the supported OS, report actual signing/notarization and prompts, and resolve the ordinary launch path. Do not remove quarantine, disable Gatekeeper or change the delivery channel simply to evade that qualification.

### Where the app keeps data

`~/Library/Application Support/Hapa Versus/` (the OS user-data folder), never inside the app:

| Path | Contents |
| --- | --- |
| `state/<network>/identity.json` | your player key (secret; mode 0600). Back it up to keep your record; never run two copies of it at once |
| `state/<network>/transport.json` | your peer transport key |
| `state/<network>/matches/<id>/` | each match's signed session, your own record feed, the opponent's replica, progress |
| `state/<network>/results/` | verified result evidence and the rebuildable index |
| `state/<network>/outbox.json`, `settings.json`, `reservation.json` | sharing state, Available/Busy and joined preference, the one active reservation |
| `owners.json` (optional) | loopback owner endpoints for optional Hapa owners (below) |
| `network.json` (optional) | a local adoption of extra services (bootstrap nodes, relays, archives), imported once into the append-only service history; it extends the bundled public defaults unless it names `replace` or `isolated` (§10) |
| `window.json`, Chromium profile data | window placement and the `app://versus` origin's local preferences |

**Help → Show Player Data Folder** opens it. Replacing or moving the app keeps this data. Deleting the folder is the only reset; a new key is a new, unlinked player.

### Optional Hapa owners

The game needs no owner. To connect your own Music Library, Harbor (Red's renderer and voice) or the Harness, write `owners.json` in the user-data folder:

```json
{ "harbor": { "url": "http://127.0.0.1:8862", "tokenFile": "/absolute/path/to/harbor/api-token" },
  "harness": { "url": "http://127.0.0.1:61290", "tokenFile": "/absolute/path/to/operator.token" },
  "mesh": { "url": "http://127.0.0.1:8860" },
  "music": { "cj": { "url": "http://127.0.0.1:8811", "tokenFile": "/absolute/path/to/api-token" } } }
```

`mesh` is Mesh Avatar's player node (`cd ~/hapa-mesh-avatar && node server/api.mjs`, or `npm run owners -- --start` from this repository): it serves Falka's and Leo's figures, read-only and without a token. Only `/mesh/apps/player/falka|leo/…` is forwarded.

Only loopback `http://` origins are accepted; tokens are read by the desktop host and never reach the page. Unconfigured owners answer *not configured* and their features stay unavailable.

Owner renderers run in an isolated loopback frame inside the desktop app (`http://red.versus.localhost`: `red-frame.html` for Red through Harbor, `mesh-frame.html` for Falka and Leo through Mesh Avatar), so no owner code or media is packaged.

## 2. Contributor and headless paths (unchanged browser workflow retained)

```bash
npm ci
git submodule update --init      # private engine fork; see "Engine distribution" below
npm run dev                      # browser development at http://127.0.0.1:5199/
npm run play                     # the desktop app from source (Electron Forge start)
npm run check                    # rules, smoke match, two-process peers, build
npm run desktop:package          # build out/Hapa Versus-darwin-arm64/Hapa Versus.app
npm run desktop:make             # build the DMG and ZIP (signs/notarizes only when credentials are present)
npm run desktop:smoke            # launch the packaged app twice: local match + native store reopen
node tools/hapa/desktop-journey.mjs --work /abs/scratch   # packaged lobby/reload/quit/relaunch/crash/observer journey
npm run online -- --data /abs/dir --name Kai [--bot] [--auto-accept] [--challenge Name] [--open-table] [--join-invite code] [--observe]
npm run lobby:serve -- --data /abs/archive-root [--network public-alpha]
```

Test identities always use explicit `--data` / `HAPA_VERSUS_DATA_DIR` roots and `test-*` network ids. `npm run check` and the `.data/peers` demo never touch player data.

## 3. Historical extended two-machine/QE session (not the first friend script)

For the simpler current first-session criteria, use the preceding friend-test section and FT-01–10 in the connectivity companion. Steps below combine recovery and offline third-observer qualification; the archive requirement applies only to that observer claim.

Needs two Macs (Apple Silicon) on **different internet connections** (for example home broadband and a phone hotspot), each with the same DMG, plus — for journey 4 — an archive host that stays online.

1. On both: install from the DMG, open, **Play online** with distinct names. Note each fingerprint (shown beside the name).
2. Confirm each sees the other as **Available** within a few seconds. Toggle **Set Busy** on one: the other's Challenge must disable with the reason; toggle back.
3. A challenges B; B sees the challenge and presses **Accept**. Both tables open: A's shows "vs B", B's shows "vs A". Neither shows Red or a local bot for the remote seat.
4. Play several Ticks: plan, **Ready** once per Tick ("Ready · waiting for …"), and answer any response window on its owner's machine only.
5. Recovery on one machine mid-match: reload (View → Reload), then quit (⌘Q) right after pressing Ready, then reopen. The match must return to the same Tick with the committed plan still committed and no second Ready.
6. Finish (or concede by adding the concession order before Ready). Both result sheets must show the same outcome; "Result saved…" then "archived by …" when an archive is reachable.
7. On a third machine (or a fresh user account), install, **Play online**: with A and B quit, the observer's lobby must show both players' verified records from the archive.

Record per machine: OS version, app SHA-256, network type (no IP addresses), Ready acknowledgment feel, any "relay"/"unknown" path label, and the outcome hash from **Download replay**. A same-machine or same-LAN run does not satisfy this journey.

## 4. Operating the public archive (`lobby:serve`)

The archive is an always-on peer in the `archive` role: it verifies and stores submitted result bundles and serves them to observers. It is not a referee, identity authority or relay.

```bash
npm ci
npm run lobby:serve -- --data /srv/hapa-versus-archive --network public-alpha --name "Hapa Archive"
```

- Keep `--data` on durable storage; it holds the archive's identity and evidence. Back it up.
- It needs outbound UDP; it is reachable through the DHT without port forwarding in most networks. A host with a stable public UDP port is more reliable.
- Logs print one JSON line per minute (`peers`, `results`). Restart under a supervisor (`launchd`/`systemd`); evidence survives restarts.
- Publish its player id (shown at start) in `desktop/network.json` → `archives` for clients to trust its role label. Clients verify every bundle themselves regardless.

## 5. Operating a blind relay

A relay forwards encrypted connections when direct holepunching fails. It stores nothing and cannot read traffic. It does not get through networks that block UDP entirely.

```bash
npm install -g blind-relay-service@2.2.2   # maintained Holepunch service (Apache-2.0)
blind-relay --storage /srv/blind-relay --port 49737
```

The service keeps its key pair in its storage; read its public key from the service's Corestore key pair `blind-relay` (or run it with the instrumentation options) and publish it with the host's public UDP endpoint:

```json
{ "networks": { "public-alpha": { "relays": [ { "key": "<64 hex>", "endpoint": "<public-ip>:49737" } ] } } }
```

Clients use the relay only when a direct connection fails; the lobby shows **relayed** only when a connection's endpoint is a configured relay endpoint. The candidate proved the path on one machine with a local relay (2 sessions, 1 pairing, a full 33-Tick match); an Internet-reachable relay is still to be operated.

## 6. Signing and notarization (prepared, not performed)

With an Apple Developer account, set these in the build environment only (never commit them):

```bash
export APPLE_SIGN_IDENTITY="Developer ID Application: <Name> (<TEAMID>)"
export APPLE_TEAM_ID=<TEAMID>
export APPLE_ID=<apple id>  APPLE_APP_SPECIFIC_PASSWORD=<app-specific password>
#   or an API key: APPLE_API_KEY=/path/AuthKey.p8 APPLE_API_KEY_ID=… APPLE_API_ISSUER=…
npm run desktop:make
spctl --assess --type execute -vv "out/Hapa Versus-darwin-arm64/Hapa Versus.app"   # expect: accepted, Notarized Developer ID
```

`forge.config.cjs` enables the hardened runtime with `desktop/entitlements.mac.plist` (JIT, network client/server; library validation stays on). Without these variables the build is ad-hoc sealed only.

## 7. Engine distribution

The installed app already contains the compiled engine code it needs (inside `dist/`). An unaffiliated **source** build still needs the private `vendor/lumina` submodule. [engine-runtime-manifest.json](engine-runtime-manifest.json) lists the exact 105 engine files (3.3 MB, revision `ba838cc…`, MIT licence) the game imports. The engine owner can approve publishing a revision-pinned archive of exactly those files; nothing has been published.

## 8. Changes in Response 17 (26 November 2026)

- **Configured archive.** Clients dial a configured archive directly. `network.json` (bundled `desktop/network.json` or the user-data override) lists it by identity and transport key; `npm run lobby:serve` prints both in its `serving` line:
  ```json
  { "networks": { "public-alpha": { "archives": [ { "player": "hv1:<64 hex>", "transport": "<64 hex>", "label": "Hapa Archive" } ] } } }
  ```
  The lobby says whether a configured archive is connected, configured but unreachable, or absent.
  **Resolution order (Response 23):** archives passed explicitly by host code (tools, tests) come first; then configured archives that are eligible *now* — disabled, retired and expired entries are excluded at each new dial, with no history append. An archive already connected keeps serving queries and submissions until it disconnects; reconnecting to it needs current eligibility. Diagnostics label each as `explicit`, `configured` or `connected`. The bundled configuration lists no archive.
- **Records in the app.** **Player records** lists players with verified matches known here or at a connected archive (they may be offline); **Profile** shows W–L–D per bucket (human vs human, human vs bot, bot vs bot), win rate with its denominator, recent verified matches and the sync source. Syncing is coalesced, cached for a minute and deferred while your own match is in progress.
- **Interrupted start.** If a match does not start within 30 seconds of accepting, the lobby shows **Retry** and **Leave this attempt**. Leaving records the attempt as abandoned before freeing your slot; late messages from it are ignored. Nothing becomes a loss.
- **Leaving a match.** Match menu → **Leave this match** (also offered on the paused/disputed sheet and in the lobby). The record and its evidence stay as unfinished; it is not a concession and records no loss.
- **Evidence v2.** Finished matches end with both players' signed attestations of each feed's exact prefix (key, fork, length, Merkle root). Result bundles carry the raw prefix blocks and both attestations; a verifier recomputes the root and every Tick. Online protocol `hapa-versus-online/v2`: v1 peers are incompatible; v1 result bundles are kept but reported as `legacy` and never counted.
- **Finishing after a crash.** A completed match is re-finished at the next launch from its journals (attestation, verified result, sharing job), exactly once.
- **Notices.** `Contents/Resources/app.asar/desktop/THIRD_PARTY_NOTICES.txt` lists the game notice, the compiled engine (revision and MIT text), the packages compiled into the game and every production package in the app.
- **Tester additions for the two-Mac session (§3):** after finishing, open **Player records** and each **Profile** on a third Mac with both players quit; on one Mac, accept a challenge and quit the other side before the table opens to see **Retry / Leave this attempt**; during play, open the match menu and confirm **Leave this match** is offered (do not use it in the counted game).



## 10. Connectivity services and diagnostics (Assignment 19)

Players need none of this: the bundled public HyperDHT defaults are used automatically. It is for an operator or a friend helping out.

- **Policy.** `cores/service-policy` (in the network's state folder) is an append-only Hypercore of accepted service decisions with provenance: `bundled-default` (the three public HyperDHT entries, copied from hyperdht@6.37.0), `bundled-config` (`desktop/network.json`), `local-config-import` (`userData/network.json`), `user`. The effective policy is its projection; *Copy connection report* shows it.
- **Adding services** (`userData/network.json`, then restart the app):

```json
{ "networks": { "public-alpha": {
  "bootstrap": { "mode": "extend", "nodes": ["203.0.113.7@dht.example.net:49737"] },
  "relays": [{ "id": "friend-relay", "key": "<64-hex relay public key>", "endpoint": "198.51.100.2:49737", "label": "Friend's relay" }],
  "archives": [{ "player": "hv1:<64 hex>", "transport": "<64 hex>", "label": "Hapa Archive" }],
  "disable": [], "retire": []
} } }
```

  `extend` adds nodes to the same public overlay (the default); `replace` uses only the listed nodes (an empty list is refused rather than isolating you); `isolated` is a named development overlay that cannot see public players. The current implementation rotates configured relays with explicitly unconfirmed handouts, delayed suspicion and cooldown; all-cooling hands out none. Relay state is bound to the relay's key and endpoint: replacing either under the same id starts fresh. Relay carriage is witnessed in a controlled fixture (both peers behind randomized NATs; dead preferred relay then a live one) — `tools/hapa/relay-nat-witness.sh`, workflow `relay-witness.yml`. A relay's published endpoint lets the app report a connection as *relayed*; otherwise the path is reported *unknown*. An invalid file is refused and the last valid policy stays (the report lists the refusal).
- **Running a relay:** `node tools/hapa/relay-serve.mjs --seed relay-seed.txt` prints its public key. It forwards encrypted streams only; it holds no game, identity or history authority. Peers behind NAT can reach it only if its own DHT node is reachable: on a host with a routable address and an open UDP port, add `--public` (with `--port`) so it starts as an OPEN node rather than waiting to discover that it is. Without that, the witness showed peers timing out on the relay.
- **Contacts.** `cores/contact` is this player's signed contact history (binding + transport changes); `contacts.json` caches verified snapshots/checkpoints of other players. Invitations are `hvinv2.` (with a signed contact snapshot); `hvinv1.` codes still work.
- **Connection report.** Play online → *Copy connection report* / *Save diagnostics*: build/platform, compatibility, discovery/DHT state, services with provenance, relays tried, the current attempt and its stage, fingerprints only. No keys, addresses, paths or invitations.
