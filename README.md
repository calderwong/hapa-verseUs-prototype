# Hapa Versus

## Base Hapa Node Standard

This repository now carries the [Base Hapa Node Standard draft and local adoption record](docs/HAPA_NODE.md), including the seven pillars, common I/O Bar, conformance cases, and Second Brain update protocol. Status: **targeting; not assessed**. The source-only specification does not certify this node or activate registrations, telemetry export, or recurring jobs.


Two opponents command visible armies on a compact 2.5D battlefield. The territory a player holds
mints **public Minor Arcana**: each card can become movement **Supply**, colored **Mana**, or its
attached **Card ability** — one use per card. Members stand in a visible **3×3 formation**, and
where they stand decides who they touch, which face an attack arrives from and what protects them.
Win by moving a party center into the enemy **Capital** or killing the enemy **Commander**.

Built from the Hapa Versus Master Requirements v3, Design Companion v1 and References Master v1
(their text is in `docs/requirements/`). Work is tracked on the Overwatch board `hapa-versus`.
**Stage:** first-pass prototype.

## Current selected development goal

**Latest independent review:** [Review 21](docs/reviews/2026-11-27-lifecycle-and-delivery-review-21.md), source `d0be02d0e4a7b6f6132ce499bf0d45d82b30327f`. **Current coding assignment:** [Assignment 23](docs/reviews/2026-11-27-next-agent-assignment-23.md). [Response 22](docs/reviews/2026-11-27-implementation-response-22.md) delivers friend.5 and answers the preceding pass.

The original cancellation/open cut, bootstrap/relay expiry, concurrent relay selection, installed Red journey and gated Windows qualification are credited. Remaining work is a reconnect STARTED bypass for cancelled initialization, current configured-archive eligibility and a bounded dynamic relay cache correction. The default package has no archives and no live provider editor; those extension corrections do not introduce infrastructure prerequisites. Actual alternate-relay carriage remains partial.

**Delivery progress:** friend.5 Mac arm64 and Windows x64 artifacts share clean source `aabb62a0a99b541b5bad41f54a827cbedbf102b6`. The reviewer downloaded and hash-verified Windows run 46074882482's evidence, including all six mandatory reports: native launch/reopen, stable identity/store, same-VM invitation/four-Tick/concession/result and bounded startup recovery. Ordinary consumer downloaded launch and the Mac-to-Windows two-home human game remain unverified.

**Readiness:** changes required before a dependable friend-test recommendation. Installed Mac Red is now visibly evidenced with owner outage/recovery and usable Home/close framing. It is the identified 2D mesh/pose-art renderer, not a demonstrated volumetric model. A fresh local browser also renders Red and advances one Ready to Tick 2; that preview has no established build identity. See [Review 21 evidence](docs/reviews/evidence/2026-11-27/review-21/README.md).

**Optional player queue:** [Addendum 11](docs/requirements/2026-11-26-human-feedback-addendum-11.md), [optional Avatar players v1](docs/integrations/optional-avatar-players-v1.md) and [Assignment 21](docs/reviews/2026-11-26-next-agent-assignment-21.md) retain Mimi/Falka, Leo and Thor. Response 22 reports owner rigs for Falka/Leo/Thor, an unresolved Mimi alias and no served route/roster implementation. Local enablement, per-game selection and explicitly opted-in online availability stay separate; two seats and Red's supported default remain. This optional scope does not gate the human friend test.

[Addenda 09](docs/requirements/2026-11-26-human-feedback-addendum-09.md) and [10](docs/requirements/2026-11-26-human-feedback-addendum-10.md) retain the simple friend target and shared Hapa foundation. [Hapa Connectivity v0.1](docs/protocols/hapa-connectivity-v0.1.md) is a common contract/conformance target, not a released shared SDK. Preserve game authority, `hv1`, archived signatures and profile `hapa_open_10x9_v3_07`. No CJ-maintained VPS is a prerequisite.

## Download and play

Current published candidate: [friend.5](https://github.com/calderwong/hapa-verseUs-prototype/releases/tag/v0.1.0-friend.5), clean source `aabb62a`, with the delivered corrections in [Response 22](docs/reviews/2026-11-27-implementation-response-22.md), now qualified by [Review 21](docs/reviews/2026-11-27-lifecycle-and-delivery-review-21.md). Further source corrections, the two-home game and consumer Windows download remain pending.

- **Windows PC, 64-bit:** [Hapa-Versus-0.1.0-friend5-Windows-x64.zip](https://github.com/calderwong/hapa-verseUs-prototype/releases/download/v0.1.0-friend.5/Hapa-Versus-0.1.0-friend5-Windows-x64.zip), 167,156,741 bytes; SHA-256 `c2ccca726b45d5c0a609dbbea1496064604c27de4ab3ddb109059306f36f1db9`. Extract and open Hapa Versus.exe. Passed a gated run on Windows Server 2025 x64 (GitHub-hosted); unsigned, consumer download/SmartScreen/firewall behavior still unobserved.
- **Mac with Apple Silicon:** [Hapa-Versus-0.1.0-friend5-macOS-AppleSilicon.dmg](https://github.com/calderwong/hapa-verseUs-prototype/releases/download/v0.1.0-friend.5/Hapa-Versus-0.1.0-friend5-macOS-AppleSilicon.dmg), 124,520,594 bytes; SHA-256 `72e4fc0fe5fdd7255a79bd610e406c4c986ce29c95520824549b57550e6fa02e`. Submitted installed checks on macOS 26 arm64 cover local play, a two-copy invitation game and Red with owner outage/recovery. Ad-hoc signed, not notarized; a manual Open Anyway step may be needed. The submitted installed runs reported no keychain prompts. Ordinary consumer launch remains separately qualified.

Both artifacts target source `aabb62a0a99b541b5bad41f54a827cbedbf102b6`. Choose Play online and Challenge/Accept, or Open a table → Copy invitation. [Player steps](docs/player/play-with-a-friend.md) and the [desktop runbook](docs/integrations/online-desktop-runbook.md) distinguish prepared, platform-executed, ready-to-try, two-home success and CJ acceptance.

## Play (desktop app)

Contributor commands below are separate from the player download above.

The following describes the intended prototype player path. Review 21 qualifies the current friend.5 candidate, credits installed presentation and identifies remaining reconnect/provider boundaries. The review publication changes documentation and evidence, not the executable.

Open **Hapa Versus.app** (macOS Apple Silicon; from the DMG). **Play on this computer** starts a local match against the heuristic bot with no network and no other Hapa apps. **Play online** starts discovery by itself and shows available players: **Challenge** one, **Open a table** (and copy its invitation), or **Join by invitation**. Each player controls only their own seat; Ready commits your plan once; closing the app is never a concession and reopening returns you to the match. Finished matches are verified from the signed moves and saved on your computer, then shared with a result archive when one is reachable. Player data lives in `~/Library/Application Support/Hapa Versus/`, never inside the app.

## Start a visible local match

```bash
npm install
git submodule update --init      # vendor/lumina: the Hapa fork of Luminati (private: github.com/calderwong/lumina-hapa, branch hapa)
npm run dev                      # http://127.0.0.1:5199/versus.html
```

Choose a profile, Human or Heuristic bot for each seat, and press **Start match** (or **Watch bot
vs bot**). Direct links: `versus.html?autostart=1&a=human&b=bot&seed=1`, `&a=bot&b=bot`, and
`&profile=hapa_open_10x9_v3_01_party_maintenance`.

How a Tick goes: the highlighted columns mint into both public hand ribbons → you edit a public
plan (Supply / Burn / ability from a hand card, a destination for a party in an active column,
a facing change) → **Ready** (Ctrl/⌘+Enter) freezes your plan for the current pair of plan
revisions → both plans resolve in alternating order, Spell responses open a public response
window, then movement and combat play back → the next Tick mints.

| Input | Action |
| --- | --- |
| Drag a hand card | onto one of your formations: Supply (a tooltip shows the result before you let go) · onto the Mana pool panel: Burn · anywhere else: it returns |
| Left click | select a party, a territory, a hand card or an event (Alt+click a member) |
| Right click | the selected party's one destination (replaces the previous one) |
| Left-drag · right-drag | pan the board · orbit and tilt (a drag never counts as a click) |
| Wheel / pinch · Shift+wheel | zoom toward the cursor · tilt |
| Camera pad (bottom-left of the board) | hold to pan, tilt or zoom; turn 45°, home view, tactical view |
| 1–9 · U · B · C | select a hand slot (home column order) · Supply · Burn · ability |
| Ctrl/⌘ + Enter | Ready |
| Q/E · Z/X · WASD or arrows | camera yaw 45° · tilt · pan |
| V · Home · F · Space · Esc | tactical view · home view · focus · pause playback · cancel |

## Commands

| Command | What it does |
| --- | --- |
| `npm run check` | rules tests, a bot-vs-bot smoke match, a two-process peer match and the build |
| `npm test` | the headless rules tests only (`tests/hapa/*.test.js`) |
| `npm run match -- --seed 2 [--profile id] [--ticks n] [--out file]` | one headless bot-vs-bot rules simulation; verifies its replay |
| `npm run experiment -- --profiles a,b --seeds 1-6 --ticks 250` | a batch across profiles with seat swaps; report + every replay under `.data/experiments/` |
| `npm run peers -- --seed 2` | a **peer-verified** match: two OS processes, two identities, two Hypercore logs, a 127.0.0.1 socket |
| `npm run replay -- file.replay.json` | recompute a recorded match; report the first diverging Tick or the verified result |
| `npm run play` | the desktop app from source (Electron Forge start; serves the built game at `app://versus/`) |
| `npm run desktop:package` · `npm run desktop:make` | build `out/Hapa Versus-darwin-arm64/Hapa Versus.app` · the DMG and ZIP (signed/notarized only when Apple credentials are set) |
| `npm run desktop:smoke` | launch the packaged app twice with no Node on PATH: a local match renders, the native store reopens, the bridge refuses unknown operations |
| `node tools/hapa/desktop-journey.mjs --work /abs/dir` | packaged online journey on one machine: lobby, challenge, reload, quit/relaunch, second launch, peer-process kill, concession, archive observer |
| `npm run online -- --data /abs/dir --name N [--bot] [--auto-accept] [--challenge N] [--open-table] [--join-invite code] [--observe]` | a headless online peer using the same runtime (test identities only) |
| `npm run lobby:serve -- --data /abs/dir` | the headless result archive; configured dialing is implemented, with remaining archive/directory scope tracked in Review 18 |
| `npm run art:sync [-- --store path --copy]` | optional: link Minor Arcana faces from the Hapa Tarot Deck (Hapa Avatar Builder's `tarot-store.json`, read-only) into the ignored `public/renditions/`; ranks without a face keep the procedural placeholder, and play is identical either way |

**Diagnostic fixtures.** The setup screen's *Diagnostic fixtures* list (or `?autostart=1&fixture=corner`,
`contact_turn`, `terrain`) opens prepared states labeled **FIXTURE** in the match bar: corner helpers
flanking an attacker, turning in contact, and a hill / open pit / roofed tunnel / flyer. Their replays
carry the fixture state and still verify.

**Height layers.** The right-edge rail (+3 +2 +1 · Ground 0 · −1 −2 −3 · All) or `[` `]` filters the view
by band; below-ground bands make the surface see-through. Hills, ramps, open pits, roofed tunnels and
flyers each carry a text label.

A **rules simulation** applies both controllers in one process; a **peer-verified match** runs two
independent peers that each validate, resolve and sign receipts. Reports say which one ran.

## Where things live

| Path | Responsibility |
| --- | --- |
| `src/hapa/rules` | the one headless rules module (no DOM, WebGL, wall clock or `Math.random`): encoding and fingerprints, state, clock and mint, movement and contact, combat, cards, terrain and work, sessions and replay |
| `src/hapa/protocol` | public plan agreement, signed records, the Hypercore-backed peer |
| `src/hapa/controllers` | the heuristic bot (same commands and choices as a human) |
| `src/hapa/presentation` | the Luminati diorama, board camera, HUD, explanations |
| `fixtures/hapa` | profiles (`hapa_open_10x9_v3_01` and variants), the content catalog, prepared scenarios |
| `tools/hapa` | check, match, experiment, peers, replay |
| `vendor/lumina` | Luminati (MIT), Hapa fork, read-only |

## Profiles and content

`fixtures/hapa/profiles.js` holds the complete Appendix A profile as editable data and its
variants: `hapa_open_9x9_v3_01`, `hapa_open_11x9_v3_01`, `…_deploy_mana`, and the four combat
demonstrations (`hapa_open_10x9_v3_01` individual, `…_line_attacker`, `…_line_defender`,
`…_party_maintenance`). Values are engineering fixtures, not approved balance. A match stores the
expanded profile and its `sha256:` fingerprint. To make an experiment, add a variant with only the
changed fields; the validator rejects unknown policies, missing definitions, negative costs and
impossible slots.

**Cards & decks (in the app).** The setup screen's *Cards & decks…* opens the editor: start from a
known Card, edit its supported fields (damage Cards: hits, power, channel, incoming face, colored
cost, counterable), read the generated wording, validate (executable meaning, not balance) and save
a derivative or a new revision with creator lineage. *Deck bindings* chooses the Card each local
column mints for seat A and seat B in the next match. *Exchange* exports your Cards as one bundle
(canonical JSON with a content hash per definition) and imports another client's bundle — hashes
are verified and any unsupported operation is named before anything is merged. These local Cards
live in this browser's storage; the bundle is the durable form. Headless: `src/hapa/adapters/content.js`
(`exportBundle`, `loadBundle`, `deriveDefinition`, `reviseDefinition`, `generateWording`).

**Author a Card in code:** add a definition to `fixtures/hapa/content.js` using existing operations
(`damage`, `counter`, `formation_immediate`, `place_row_enchantment`, `mint_row_multiplier`,
`protection_modifier`), with creator lineage. `validateContent` names any unsupported operation
before play. Bind it to a column in a profile's `cards.bindings` (or a Major in `cards.majors`).

## What is implemented, fixture-tested or scheduled

Implemented and fixture-tested (47 headless tests): canonical encoding and the Appendix B
SHA-256 vector; all profiles; 36 parties / 162 members; the clock, prologue and Rounds; mint from
the completed prior state with replacement; frontier cutoff and exposed ground; exclusive card
uses; Rainbow payment; one destination, Mount routes, Knight L, fractional Supply; merging; swept
contact (Queen/Knight at quantum 125); per-hit directional damage; individual, line and
party-pool health; attacker/defender allocation with recorded standing policies; charge and Pike
transfer; victory, draws and concession; `public_stack_v1` counters; Bound and Column Standards;
row Mana doubling placed through its Card; breach advance; retreat casualties and the attacker's free follow; mining → crafting → equipment (`terrain_work_v3_01`);
plan agreement with stale Ready pairs; signed peer records; replay verification; idempotent
history.

Also implemented since: corner helpers (a neighbour's corner member steps into the contact strip
at zero time and Supply, returns home alive when the supported party retreats, dies with its own
party's retreat); layered characteristics (base → set → add → multiply → limit); formation changes
and Wheel Formation in contact (old arrangement until completion; never pulls a member out of
contact); hills, ramps, cliffs, uphill Speed and charge at actual Speed; the Archer elevation curve
and roof-blocked arcs; the terrain view with a layer rail and cutaway; optional tarot card faces.

Known limitations (see the board for each): merges do not sweep each member's assembly path; heights
are per territory (no slopes inside a territory); damage allocation uses the recorded standing
policy rather than a live per-exchange prompt; the battlefield uses Luminati's procedural
characters, not commissioned Hapa art; the local tarot deck has faces for 12 of the 40 Minor Arcana
ranks; the editor edits damage Cards only (others can be bound and exchanged); no experiment panel or
creator statistics UI yet. Fixture identities are
labeled local development identities, not verified Hapa DIDs.

## Design review handoffs

Start with [docs/reviews/README.md](docs/reviews/README.md) for the latest design review,
implementation evidence template, and the CJ ↔ reviewer ↔ local coding agent iteration flow.
The dated notes include the original screenshot, prioritized findings, source references and
acceptance checks. Overwatch `hapa-versus` remains the canonical task tracker.

