# Hapa Versus

Two opponents command visible armies on a compact 2.5D battlefield. The territory a player holds
mints **public Minor Arcana**: each card can become movement **Supply**, colored **Mana**, or its
attached **Card ability** — one use per card. Members stand in a visible **3×3 formation**, and
where they stand decides who they touch, which face an attack arrives from and what protects them.
Win by moving a party center into the enemy **Capital** or killing the enemy **Commander**.

Built from the Hapa Versus Master Requirements v3, Design Companion v1 and References Master v1
(their text is in `docs/requirements/`). Work is tracked on the Overwatch board `hapa-versus`.
**Stage:** first-pass prototype.

## Current selected development goal

**Queued next delivery: [Assignment 19 — a friend opens the app and plays across town](docs/reviews/2026-11-26-next-agent-assignment-19.md).** [Addendum 09](docs/requirements/2026-11-26-human-feedback-addendum-09.md) selects two native apps on separate machines/internet connections, a simple download/open player path, no VPS maintained by CJ as a prerequisite, and [replaceable services with signed contact history](docs/integrations/friend-test-and-resilient-connectivity-v1.md). Reconcile the in-flight Assignment 18 first; preserve newer fixes. This publication adds tasking, not an executable or a passed WAN test. The friend's actual OS/architecture is still an artifact-selection input.

The [bundled Electron / P2P milestone](docs/reviews/2026-11-25-next-agent-assignment-16.md) has a newer installed local candidate: [Response 17](docs/reviews/2026-11-26-three-pass-implementation-response-17.md), implementation `7cc30a1`, pushed with report `b2a31f4`. **Current in-flight work: [Assignment 18](docs/reviews/2026-11-26-next-agent-assignment-18.md)** following [Review 18](docs/reviews/2026-11-26-readiness-review-18.md). Preserve the completed corrections from [the three-pass handoff](docs/reviews/2026-11-26-three-pass-coding-handoff.md), restore the expected default Avatar, and close the remaining decision/recovery/result and presentation gaps as one candidate.

**Readiness:** the representative-local and desktop/P2P human playtest/QE handoff is held pending Review 18's concrete corrections. Fresh local supply/Ready/absorption and compact controls work; the observed default Avatar falls back after an owner `/capabilities 502`. The running local demo did not expose a source revision. This review publication adds instructions/evidence and does not change product code.

This is not yet a publicly delivered multiplayer release. Signing/notarization, separate hardware/networks, approved engine/Avatar distribution and CJ's acceptance remain separate gates. Operated relay/archive availability is conditional on the journey being claimed; it is not a blanket prerequisite for the two-person native test. They are distinct from a narrowly scoped local-playtest recommendation and from still-unbuilt selected features. The [runbook](docs/integrations/online-desktop-runbook.md) describes the candidate/operator steps; read it with Review 18 before treating a journey as qualified.

For current gameplay and presentation, follow the [review index](docs/reviews/README.md) and newer addenda: the current default is `hapa_open_10x9_v3_07` with one commitment to each own plan.

## Download and play

**Friend-test candidate (macOS, Apple Silicon M1 or newer): [download Hapa-Versus-0.1.0-friend1-macOS-AppleSilicon.dmg](https://github.com/calderwong/hapa-verseUs-prototype/releases/tag/v0.1.0-friend.1)** · 124,514,266 bytes · SHA-256 `5bc9778ff980e7a09bc516fa7b5b0f4fd4d3d8b380ba06adacfdb83023b35369` · source `c7a00c1`.

Open the DMG, drag Hapa Versus to Applications and open it. This test build is not yet signed with an Apple Developer ID: the first time, macOS says it cannot verify the developer; approve it once in **System Settings → Privacy & Security → Open Anyway**. Then choose **Play online** and **Challenge** your friend, or **Open a table → Copy invitation** and send it. Full player steps: [Play with a friend](docs/player/play-with-a-friend.md). There is no Intel-Mac or Windows build yet. A two-network human game has not been verified yet ([Response 19](docs/reviews/2026-11-26-friend-test-implementation-response-19.md)).

## Play (desktop app)

Contributor commands below are separate from the player download above.

The following describes the intended prototype player path. Review 18 records the remaining observed recovery, result and presentation limitations; no downloadable release is published by these reviews.

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

