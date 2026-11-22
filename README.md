# Hapa Versus

Two opponents command visible armies on a compact 2.5D battlefield. The territory a player holds
mints **public Minor Arcana**: each card can become movement **Supply**, colored **Mana**, or its
attached **Card ability** — one use per card. Members stand in a visible **3×3 formation**, and
where they stand decides who they touch, which face an attack arrives from and what protects them.
Win by moving a party center into the enemy **Capital** or killing the enemy **Commander**.

Built from the Hapa Versus Master Requirements v3, Design Companion v1 and References Master v1
(their text is in `docs/requirements/`). Work is tracked on the Overwatch board `hapa-versus`.
**Stage:** first-pass prototype.

## Start a visible local match

```bash
npm install
git submodule update --init      # vendor/lumina: the Hapa fork of Luminati (read-only)
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
| Left click | select a party, a territory, a hand card or an event (Alt+click a member) |
| Right click | the selected party's one destination (replaces the previous one) |
| 1–9 · U · B · C | select a hand slot (home column order) · Supply · Burn · ability |
| Ctrl/⌘ + Enter | Ready |
| Q/E · Z/X · WASD · wheel · middle-drag | camera yaw 45° · pitch · pan · zoom · orbit |
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

**Author a Card:** add a definition to `fixtures/hapa/content.js` using existing operations
(`damage`, `counter`, `formation_immediate`, `place_row_enchantment`, `mint_row_multiplier`,
`protection_modifier`), with creator lineage. `validateContent` names any unsupported operation
before play. Bind it to a column in a profile's `cards.bindings` (or a Major in `cards.majors`).

## What is implemented, fixture-tested or scheduled

Implemented and fixture-tested (44 headless tests): canonical encoding and the Appendix B
SHA-256 vector; all profiles; 36 parties / 162 members; the clock, prologue and Rounds; mint from
the completed prior state with replacement; frontier cutoff and exposed ground; exclusive card
uses; Rainbow payment; one destination, Mount routes, Knight L, fractional Supply; merging; swept
contact (Queen/Knight at quantum 125); per-hit directional damage; individual, line and
party-pool health; attacker/defender allocation with recorded standing policies; charge and Pike
transfer; victory, draws and concession; `public_stack_v1` counters; Bound and Column Standards;
row Mana doubling; retreat casualties; mining → crafting → equipment (`terrain_work_v3_01`);
plan agreement with stale Ready pairs; signed peer records; replay verification; idempotent
history.

Known limitations (see the board for each): corner helpers and breach advance are not implemented;
retreat does not yet grant the attacker its automatic follow; formation changes are refused while
engaged (a conservative reading); merges do not sweep each member's assembly path; uphill Speed,
ramps and the Archer elevation curve wait for terrain presentation; damage allocation uses the
recorded standing policy rather than a live per-exchange prompt; the battlefield uses Luminati's
procedural characters, not commissioned Hapa art; no volume cutaway view yet; no deck/Card editor,
experiment panel or creator statistics UI yet. Fixture identities are labeled local development
identities, not verified Hapa DIDs.
