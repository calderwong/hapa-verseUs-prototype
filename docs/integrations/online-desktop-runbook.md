# Hapa Versus desktop and online play: install, test and operate

**Date:** 25 November 2026. **Applies to:** the Assignment 16 candidate (see [Response 16](../reviews/2026-11-25-p2p-implementation-response-16.md)).
This runbook covers what exists, how to run it, and the steps still owned by an operator or by CJ. It does not claim that any public service is running.

## 1. Player install (macOS Apple Silicon)

1. Get `Hapa Versus.dmg` (or the `.zip`) for `darwin-arm64` and check its SHA-256 against the release record.
2. Open the DMG and drag **Hapa Versus** to Applications. Open it.
3. Local play works immediately and offline: **Play on this computer → Start match** (you against the heuristic bot).
4. Online: **Play online → Join lobby**. Your name, availability and finished match evidence (moves, choices, result — never chat, voice or music) are shared with the lobby.

Nothing else is required: no Git, Node, npm, terminal, Vite server, engine credentials or other Hapa apps.

**Current signing state:** the candidate is sealed with an ad-hoc signature only. It is **not** signed with a Developer ID and **not** notarized, so Gatekeeper rejects a downloaded copy. Do not tell testers to disable Gatekeeper. Until a signed/notarized build exists, a tester on another Mac must use Finder's *Open* on the app once (Control-click → Open) and accept the unidentified-developer prompt, or receive the build through a channel that does not add the quarantine attribute. Record which path was used.

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
| `network.json` (optional) | operator-provided relay/archive configuration overriding the bundled public config |
| `window.json`, Chromium profile data | window placement and the `app://versus` origin's local preferences |

**Help → Show Player Data Folder** opens it. Replacing or moving the app keeps this data. Deleting the folder is the only reset; a new key is a new, unlinked player.

### Optional Hapa owners

The game needs no owner. To connect your own Music Library, Harbor (Red's renderer and voice) or the Harness, write `owners.json` in the user-data folder:

```json
{ "harbor": { "url": "http://127.0.0.1:8862", "tokenFile": "/absolute/path/to/harbor/api-token" },
  "harness": { "url": "http://127.0.0.1:61290", "tokenFile": "/absolute/path/to/operator.token" },
  "music": { "cj": { "url": "http://127.0.0.1:8811", "tokenFile": "/absolute/path/to/api-token" } } }
```

Only loopback `http://` origins are accepted; tokens are read by the desktop host and never reach the page. Unconfigured owners answer *not configured* and their features stay unavailable.

Known owner dependency: Harbor's Red renderer currently accepts only `http:`/`https:` mount URLs, so inside the desktop app Red stays text-only (voice and music binding still work). It needs either Harbor to admit the `app://versus/` mount or an approved packaged Red snapshot.

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

## 3. The two-machine acceptance session (journey 2 — still to be run)

Needs two Macs (Apple Silicon) on **different internet connections** (for example home broadband and a phone hotspot), each with the same DMG, plus — for journey 4 — an archive host that stays online.

1. On both: install from the DMG, open, **Join lobby** with distinct names. Note each fingerprint (shown beside the name).
2. Confirm each sees the other as **Available** within a few seconds. Toggle **Set Busy** on one: the other's Challenge must disable with the reason; toggle back.
3. A challenges B; B sees the challenge and presses **Accept**. Both tables open: A's shows "vs B", B's shows "vs A". Neither shows Red or a local bot for the remote seat.
4. Play several Ticks: plan, **Ready** once per Tick ("Ready · waiting for …"), and answer any response window on its owner's machine only.
5. Recovery on one machine mid-match: reload (View → Reload), then quit (⌘Q) right after pressing Ready, then reopen. The match must return to the same Tick with the committed plan still committed and no second Ready.
6. Finish (or concede by adding the concession order before Ready). Both result sheets must show the same outcome; "Result saved…" then "archived by …" when an archive is reachable.
7. On a third machine (or a fresh user account), install, **Join lobby**: with A and B quit, the observer's lobby must show both players' verified records from the archive.

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
