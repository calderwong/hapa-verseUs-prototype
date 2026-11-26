# Implementation response 17 — three passes: reliability, visual work and Review 17 — 2026-11-26

## Scope and source

- **CJ's requested goal and scope:** the [three-pass coding handoff](2026-11-26-three-pass-coding-handoff.md). It covers:
  - [Review 16](2026-11-25-desktop-p2p-review-16.md) and [Assignment 17](2026-11-25-next-agent-assignment-17.md): R16-01 to R16-08;
  - the [visual review](2026-11-26-visual-animation-review.md) and its [feature brief](2026-11-26-visual-animation-feature-brief.md): VA-01 to VA-10, core scope only;
  - [Review 17](2026-11-26-open-ended-review-17.md): R17-01 to R17-06.

  The target is one dependable installed play-and-record journey with a coherent presentation.
- **Starting point:**
  - The checkout was clean on `main` at `82002e8` (Response 16, pushed). I fast-forwarded to the reviewer's `00e403a`.
  - There were no worktrees, stashes, newer local or remote implementation, or other-agent changes.
  - The last reviewed source was `d113216`; the latest reported implementation was `5326438`. Every finding reproduced against that source, so none was already fixed.
  - The engine stays at `ba838cca09ba43afceda0452b63d28df4cbf7f72`, and the profile at `hapa_open_10x9_v3_07`.
- **Implementation commits:** in order, `5a250ef`, `3f8a3c3`, `3b30c81`, `788db8f`, `2bf389a`, `307e2a8`, `96de272`, `3392fe2`, `f4448e9`, `3c13721`, `7cc30a1`.
  - This documentation commit follows.
  - **The candidate is `7cc30a141672ffedf5093bfd5695a39dca0532a5`, clean.**
- **Contract versions:**
  - Online protocol `hapa-versus-online/v2`: v1 peers are incompatible.
  - Result evidence `hapa-versus-result/v2`: v1 bundles keep their bytes and are reported as `legacy`, never counted.
  - Rules: the corrected resource invariant changes the rules-implementation fingerprint. Older online evidence is therefore `unsupported` by this verifier and is never silently re-labelled. A local replay containing a repeated-fuel command now diverges, and `verifyReplay` reports the first differing Tick. Recorded bytes are untouched.
- **Overwatch:** the existing card HV-67 was verified in Review before updating. Its last events were the Response 16 notes. Grouped progress is appended after this commit.
- **CJ acceptance:** not recorded, neither Done nor aesthetic.

## Outcome

The connected journey now holds together on one Mac, in the browser and in the app installed from its DMG:
- **Play:**
  - enter by Play online or Play on this computer;
  - find a player, invite one or open a table;
  - recover from an interrupted start;
  - commit exactly the plan shown with one Ready;
  - answer a response once, and only after it is durably recorded;
  - see the opponent's latest public plan even when one's own view is behind;
  - play another match.
- **Record:** a finished match is attested by both players over authenticated feed prefixes, recorded once (even across a crash), shared with an archive, and readable by a fresh installed observer through Player records and Profile while both players are offline.
- **Presentation:** figures, effects, board facts and inspection show the same accepted moment. Members attack, aim, cast, recoil and fall. Ember Strike and its counter read as pending, countered and settled.
- **Not yet true:** none of this is internet-verified, signed, operated or accepted.

| Claim | Status |
| --- | --- |
| Implemented | Yes, as listed below |
| Tested locally | Yes, on one Mac: browser, packaged and installed apps, headless peers, and native tests on real Hypercore storage over a local HyperDHT |
| Packaged | Yes: macOS arm64 DMG and ZIP from clean `7cc30a1` |
| Signed / notarized | **No**: an ad-hoc seal only; Gatekeeper rejects the app |
| Installed elsewhere | **No**: installed from the DMG into a scratch folder on the build Mac |
| Internet-verified | **No**: one Mac, one connection |
| Operated | **No**: no public directory, archive or relay host |
| Published | **No**: the artifacts are only in the ignored `out/` folder |
| Accepted by CJ | **No** |

## Finding disposition

### Rules and content

| ID | Change | Evidence and limits |
| --- | --- | --- |
| **R17-01** | `abilityError` checks the whole fuel list before anything is consumed: its shape, distinct ids, owner, availability and bank presence. This applies to casts and responses. `pay()` keeps a defensive once-only invariant at the shared boundary. | `content-payments.test.js`: repeated fuel is refused with nothing consumed; a distinct two-Card payment burns each Card once; a response with repeated fuel is refused and the Spell resolves; preview, admission and replay agree. |
| **R17-02** | `validateContent` checks every operation against the installed schema: required fields, enums, integer ranges and unsupported fields. Errors name the Card and the field. `loadBundle` refuses a hash-valid Card missing `power`. `applyCardHit` refuses non-finite damage before changing state. | The same test file: the missing field and bad values are refused, and a valid custom Card imports, plays and keeps finite state. The live click-through of a local import (Cards & decks → Exchange → Import) was **not** exercised; the import path itself calls the same validator. |

### Decisions, recovery and the player view

| ID | Change | Evidence and limits |
| --- | --- | --- |
| **R16-04** | Setup is serialized and durable. An accepted or starting attempt is marked stalled after 30 s and offers **Retry** and **Leave this attempt**. Leaving writes an attempt tombstone before freeing the slot; late ACCEPT, START and STARTED for it are refused, and a restart keeps the tombstone. A decline during setup marks the attempt stalled. Nothing becomes a loss. | `online-recovery.test.js` (R16-04), using the real runtime: stalled, left, late START/STARTED ignored, restart opens no match. A live disconnection in each handshake window was **not** staged with two apps. |
| **R16-05** | Ready freezes every editing path (`_can`). It sends a snapshot of the plan and settles to the exact commitment the runtime returns. A lost or failed reply first reconciles with the runtime. View-generation changes clear the transient state. | `online-recovery.test.js`. Ready acknowledgment in installed play: median 44–67 ms. A deliberately delayed host acknowledgment in the installed app was **not** staged. |
| **R16-06** | Each worker generation's startup settles on ready, fatal, exit or a 30 s timeout. In-flight calls on an exiting worker get a recoverable error and are never replayed. Stale messages from an old generation are ignored. | A source change. Covered live by the installed journey's utility-process kill, after which the view reattached. A worker exiting *before* its first ready was **not** staged separately. |
| **R17-03** | A response stays pending, submitting one at a time, until its exact answer is appended. A failed append leaves it pending and retryable (`CHOICE_NOT_RECORDED`). A lost acknowledgment reconciles with the recorded answer. The view never advances from an unrecorded answer, and no longer infers anything from an "already" message. | `online-recovery.test.js`: a failed append, then concurrent identical retries giving one record and one resolution, then structured reconciliation. Installed: four response windows answered through the panel (Response 16 evidence, unchanged path). A native append fault was **not** injected. |
| **R17-04** | The online client keeps a bounded per-Tick projection (locked pairs, choices, receipts, the opponent's latest plan and Ready) recorded from the first event, which closes the snapshot/subscription race. The projection is applied when a Tick becomes visible. | `online-recovery.test.js`: Tick 5's revision 2 and Ready, received while the view was on Tick 4, appear when Tick 5 opens; events received before binding are kept. The installed slow-view-versus-fast-peer pair was **not** staged. |
| **R17-05** | A disputed match blocks play mutations but keeps inspection. A persistent sheet offers View the board, Return to lobby and **Leave this match**; the lobby offers View and Leave. Explicit departure keeps the previous status and reason, is distinct from concession and records no loss. | `online-recovery.test.js` (gating, the sheet, `match.leave`). No dispute was induced in an installed app. |

### Results, discovery and lifecycle

| ID | Change | Evidence and limits |
| --- | --- | --- |
| **R16-01** | **Online v2:** each player's game-input prefix ends at its final receipt. Both players sign a `closing` attestation *outside* their prefixes, naming the session, the computed outcome/state and both prefixes (key, fork, length, Merkle root). A match completes only when the two attestations agree.<br>**Result v2:** the bundle carries the raw prefix blocks and both attestations. The verifier recomputes the root from the bytes (identically to `core.treeHash`), checks canonical `hv1:` identities and distinct seats, and validates every record's context, including choices and receipts.<br>**The index:** a unilateral rewrite is invalid and cannot remove a counted win. Only contradictory histories attested by both players count as a dispute. Equivalent repackaging is a duplicate. | `online.test.js`: four cases, including a unilateral receipt rewrite (block only; block, root and its own attestation; and a both-signed context violation), a same-id impostor and a genuine twin dispute.<br>`online-native.test.js`: a real Hypercore truncate-and-rewrite changes the fork and root, and the old prefix no longer matches the bytes. Two real runtimes attest and record two matches. |
| **R16-02** | Progress moves terminal → attested → recorded. Finalization (verified result, then outbox, then `recorded`) is idempotent. Startup reopens unfinished terminal matches from their journals — the opponent's attestation is already in the local replica, so no network is needed — and restores a missing sharing job. Journals are kept, and no input is replayed as new. | `online-native.test.js`: cut 1 (terminal, with no result and no outbox) repairs to one result and one job under the original match id; cut 2 (result present, outbox missing) restores the job without a second count; reopening again changes nothing. These states were reconstructed from real journals, not by killing a process. |
| **R17-06** | A completed authority stays owned (the `finishing` set) until its evidence is durable, then closes once after a short replication grace. A later match never orphans its predecessor, and shutdown drains every owned authority. | `online-native.test.js`: two successive matches, both authorities `closed`, nothing still owned. |
| **R16-03** | Configured archives (player identity and transport key) pass through main and the peer host to the runtime, which dials them. The lobby shows configured/connected/unreachable states. `profile.get` is coalesced, cached for 60 s and deferred during live play. `directory.list` merges local and archive-known players. **Player records** and **Profile** views give W–L–D per bucket, win rate with its denominator, recent matches and the sync source (or unavailable, deferred, or a checked zero). Lobby repaints no longer sync. | **Installed observer on `7cc30a1`** ([installed-observer.json](evidence/2026-11-26/response-17/installed-observer.json), captures [i5](evidence/2026-11-26/response-17/i5-observer-player-records.jpg) and [i6](evidence/2026-11-26/response-17/i6-observer-profile.jpg)): a fresh app with the archive configured by identity and transport key, both authors offline, used Join lobby → Player records (Bram and Cal, "not connected", one verified match each) → Profile (Bram 1–0–0, Cal 0–1–0, "Synced from Hapa Archive"). **Not built:** live directory candidates beyond archive-known players, and pagination past 50 players. |

### Local experience and delivery

| ID | Change | Evidence and limits |
| --- | --- | --- |
| **R16-07** | An online match keeps the local music deck (playback, Previous, Played/Kept, quiet Keep, Return and the music-driven scene). The remote player gets a neutral nameplate; no Avatar speaks or reacts for them. | [installed-online-music.json](evidence/2026-11-26/response-17/installed-online-music.json), capture [i4](evidence/2026-11-26/response-17/i4-online-local-music-remote-plate.jpg): with the owner configured, Cal's deck went ready → playing, the plate read "Bea" and no Avatar appeared; without an owner, Bea's deck was quietly unavailable. Same final hash on both. Keep and Previous in this mode were not exercised. |
| **R16-08** | `tools/hapa/notices.mjs` (run by the Forge hook) builds `desktop/THIRD_PARTY_NOTICES.txt`: the game notice, the compiled engine (revision and MIT text), the packages compiled into `dist/` and every production package in the archive. The content manifest records it. | [installed-content-manifest.json](evidence/2026-11-26/response-17/installed-content-manifest.json): 91 entries at `app.asar/desktop/THIRD_PARTY_NOTICES.txt`; 615 files; 0 forbidden paths. |

### Visual pass

| ID | Scope | Change | Evidence and limits |
| --- | --- | --- | --- |
| **VA-01** | Selected | `timeline()` always ends with a q1000 frame carrying every accepted event and the final pose. | The review's own probe with `--expect-fixed`: 8 of 8 events. `playback-boundary.test.js`. |
| **VA-02** | Selected | During playback the board syncs from the displayed moment (`stateAt`): membership, facing, terrain and tasks, with interpolated positions. | `playback-boundary.test.js`: facing stays North mid-trajectory and turns East at its event. Absorption and work-completion moments rely on the same `stateAt` path; not separately captured. |
| **VA-03** | Selected | Battle bodies and effects share the playback clock (pause holds them; 0.5×–4× scales them); ambient scenery keeps its own clock. Gait follows the displayed segment. Reduced motion drops the compulsory walk cycle. | Browser: paused at first contact, poses and marks held, then resumed once ([b1](evidence/2026-11-26/response-17/b1-combat-paused-poses.jpg)). Speed and reduced-motion witnesses were not captured. |
| **VA-04** | Selected | An ordinary party hint drives the existing standard/endpoint emphasis. | A source change only; not captured. |
| **VA-05** | Selected (core) | The entrance leads with Play online and Play on this computer; profiles, seats, seed, presets, lab and fixtures sit behind **Advanced** with their values kept. Lobby rows read who/available on one line and record/controller on the next. The match bar is compact below 900 px. The result sheet drops the developer command. | Browser: at 700 px and 960 px no control is off-screen (it was overflowing by 112 px at 700). Installed captures [i1](evidence/2026-11-26/response-17/i1-lobby-joined.jpg) and [i2](evidence/2026-11-26/response-17/i2-roster-two-line.jpg). |
| **VA-06** | Selected (bounded trial) | Brush-pixel cedar (256×64 painted texture: value clusters, grain, knots, inked joins) and slate (broad planes, sparse worn edges). | Home capture [b4](evidence/2026-11-26/response-17/b4-home-material-trial.jpg). **Incomplete:** the representative territory, party materials, Red's lighting integration, and the matched orbit/close comparison set. Aesthetic judgment is CJ's. |
| **VA-07** | Selected | Members use the engine's combat sheet: attack, thrust, aim, cast, hurt, and a brief down pose as aftermath. Attached gear is hidden during combat frames; everything runs on the battle clock. | Browser: `hurt`, `cast`, `down` and `aim` active at a paused contact. Brace for a blocked hit is **not** implemented (there is no suitable single pose). |
| **VA-08** | Selected | Ember Strike shows a steady pending rune at its exact target (including during the response window), collapses when countered, and clears when resolved. Absorption settles with the combined count. Excavation/fill shows a short fracture and settle. | Browser fixture `response`: announced → Blue Denial → `counter_applied` → collapse; 0 damage; no runes left ([b2](evidence/2026-11-26/response-17/b2-ember-strike-pending-rune.jpg)). The absorption and terrain cues were **not** captured live. |
| **VA-09** | Selected (trial) | The Card face grows to 168 px where the window is at least 1200×760; the compact 112 px face is the fallback. | [b3](evidence/2026-11-26/response-17/b3-card-inspection-trial.jpg). Pin/compare was not separately exercised. |
| **VA-10** | Conditional | Hit marks stay bounded, but every affected member keeps one cue. | A dense exchange still stacks many numbers (b1). Density tuning remains a judgment for CJ. |

The brief's optional flourishes stay recorded for later: minting flourishes, a cinematic result replay, broad asset production and extra atmosphere.

## Verification record

| Check | Revision | Result |
| --- | --- | --- |
| `npm run check` | `7cc30a1`, clean | Exit 0: 174/174 tests (16 new across five suites), bot smoke, two-process peers, build ([summary](evidence/2026-11-26/response-17/npm-check-summary.txt)) |
| Installed smoke ×2 | `7cc30a1` from its DMG | Local match, owners absent, same identity, store 1 → 2, no Node on PATH ([installed-smoke.json](evidence/2026-11-26/response-17/installed-smoke.json)) |
| Installed journey | `3392fe2` from its DMG; same online/runtime/rules source as `7cc30a1` | Lobby, challenge, reload/reattach, quit mid-match, second launch refused in 0.14 s, peer-utility kill and reattach, finish at Tick 15, opponent's same hash, archived ([installed-journey.json](evidence/2026-11-26/response-17/installed-journey.json)). Its own observer step hit a script race; it was rerun on `7cc30a1` as the installed observer above. |
| Installed observer | `7cc30a1` | Profiles from the archive with both authors offline, through the UI |
| Installed online music | `f4448e9`; same music/online code | Owner present → playing; owner absent → unavailable |
| Browser | working tree at each commit | Local play, the entrance, the Spell/counter fixture, combat pause, the Card trial, and 700/960 px layouts. The only console errors were the expected 502s from absent owners. |
| Artifacts | `7cc30a1` | DMG `bf261869…16ee` (124,525,677 B), ZIP `c209e168…e930` (126,353,449 B), `app.asar` `c03f4b83…9817` ([artifacts.json](evidence/2026-11-26/response-17/artifacts.json)). Deep verify valid; ad hoc; `spctl` rejected. |

## Remaining selected scope (not done)

- **Assignment 16 parent inventory, still unbuilt:**
  - the browser online adapter (online play remains desktop and headless only);
  - direct **Rematch** (players return to the lobby);
  - redacted diagnostics export;
  - sleep/wake, app-replacement and other lifecycle/platform checks;
  - live directory candidates beyond archive-known players.
- **Not yet staged in installed apps:**
  - setup interruption in each handshake window;
  - a delayed or lost Ready acknowledgment;
  - a failed response append;
  - a slow view against a fast peer;
  - an induced dispute followed by Leave;
  - a real local import-to-play click-through.

  Each is covered by the focused regressions above, not by an installed witness.
- **Visual work not done:**
  - VA-06 territory/party/Red integration and the matched orbit/close set;
  - VA-07 brace pose;
  - live absorption and terrain captures;
  - reduced-motion and speed witnesses;
  - VA-10 density tuning (CJ's call).

## External gates (unchanged by this work)

1. **Signing and notarization:** this needs the Apple Developer ID and notarization credentials in the build environment. `forge.config.cjs` is ready.
2. **Hardware:** a clean second Mac on a **different internet connection**, plus a third for the observer ([runbook §3 and §8](../integrations/online-desktop-runbook.md)).
3. **Operated services:** an always-on directory/archive and a blind relay host. `lobby:serve` prints the identity and transport key that go into `network.json`.
4. **Engine:** approval to publish the 105-file engine snapshot for unaffiliated source builds.
5. **Harbor:** a Harbor `app://versus/` mount, or an approved packaged Red snapshot. The neutral remote nameplate is in place.

## Decisions and next handoff

- **Decisions made within the specification:**
  - attestations sit in the existing `closing` record (v2 payload);
  - the dispute scope is the signed session descriptor;
  - the finishing set closes authorities 3 s after finalization (a replication grace);
  - the profile cache lasts 60 s and syncing is deferred during play;
  - battle effects follow playback speed;
  - the Card trial applies at 1200×760 and above;
  - the material trial is limited to cedar and slate.
- **For CJ, the tester handoff:** install `Hapa Versus.dmg` (SHA-256 `bf261869328e89bc6c35bb76c6d46f1c3822a35e55bb24dd92991b06553616ee`) on two Macs on different connections and follow runbook §3 with the §8 additions. Judge the entrance, the combat poses, the Spell sequence, the Card trial and the cedar/slate trial in ordinary play.
- **Stop:** this continuation ends with this report. CJ moves cards to Done and gives aesthetic acceptance.
