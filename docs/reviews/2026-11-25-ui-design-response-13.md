# Implementation response 13 — 2026-11-25

## Scope and source

- **Goal and scope:** Assignment 13's complete music-and-setting candidate.
  - A redesigned compact music deck and a deliberate Music drawer with Queue, Played this match and Kept.
  - Quiet Keep and the local replay/bookmark/Return policy.
  - A dusk coastal table overhaul.
  - A restrained response to the music actually playing.
  - The R12-01 bounds completion.
  - Rules, one-press Ready, recorded game replay, the corrected asynchronous fences, seated Red and owner responsibilities are unchanged.
- **Review addressed:** [Review 12](2026-11-25-ui-design-review-12.md), [addendum 06](../requirements/2026-11-25-human-feedback-addendum-06.md), the [dusk island companion](../integrations/dusk-island-table-and-music-v1.md) and [Assignment 13](2026-11-25-next-agent-assignment-13.md), published in `31c0722`. They review implementation `4dc271d` at main `8308ea1`.
- **Findings addressed:** R12-01 to R12-05.
- **Reconciliation:**
  - The working tree was clean on `main` at `8308ea1`, with no later local commits.
  - I fast-forwarded to `31c0722`.
  - No other agent's work was present in this checkout.
- **Implementation:** commit `c42649b7127e49addba68a82101dff5046913f74` (tree `362b2fc16cac60d6933e4c3dbd9e0d46263860fe`), parent `31c0722`. This documentation and evidence follow in the next commit.
- **Engine gitlink:** `vendor/lumina` stays at `ba838cca09ba43afceda0452b63d28df4cbf7f72`, unchanged. No engine change was needed.
- **Default profile:** `hapa_open_10x9_v3_07`, unchanged.
- **Overwatch:**
  - New card HV-64 is in Review, as the successor to HV-63.
  - Creation receipt: `evt_1795602070247_d22cd7ce`. The handoff receipt is in the [handoff section](#decisions-and-next-handoff).
- **CJ acceptance:** not recorded.

### Frame checkpoint (recorded before assembly)

The owners were already in place:
- **Song Registry `dadb049`** (CJ's listener library on 8811, Red's library on 8801) exposes everything the collection needs:
  - retained membership with `libraryId`, `recordingId`, `assetId`, credits, version, duration, receipt and aggregated introductions;
  - Range-served retained audio;
  - idempotent per-encounter Keep and acquisition status.
- **The retained route matches a literal colon.** `/music/cj/retained/retained:<24 hex>/audio` answered 206; the `%3A` form answered 404.
- **All three of Red's current recordings were already retained** in CJ's library. A live Keep therefore exercises the "new introduction, no second download" path.
- **Harbor and Harness:** running.

There were no blockers. Two contracts did not exist yet: a music analysis interface and any Played record. Both are new consumer code here.

### Source identity (complete SHA-256)

**Versus, at `c42649b`.** The final `npm run check` ran on a working tree equal to the commit. The [UI journey](evidence/2026-11-25/response-13/ui-journey.json) records which late edits came after which steps.

| File | SHA-256 | Git blob |
| --- | --- | --- |
| `src/hapa/presentation/soundtrack.js` | `f0690c5ee046ccd4cc1c2cd9daaaf8fff594100a60c230cd1110d90bf4e35f6c` | `590eef73` |
| `src/hapa/presentation/music-signal.js` (new) | `1269f8b58f13c569fc1ef8692633e67d8285548d7ba55c05768193dfc4f1e993` | `5972a736` |
| `src/hapa/presentation/music-deck.js` (new) | `3cbaeb265f309104db64b458abb75f11efd14936d333d338889892bb161d33c2` | `ee9064cf` |
| `src/hapa/presentation/table.js` | `7f973f6b398e83ae005581519ba306df5aed9db6c2f459bbe4f1b0ab7fc64fab` | `486d2d19` |
| `src/hapa/presentation/scenery.js` | `4ea741a1ebde9025bd5a0f399a9eb1d5678b16781c77b754a73935291bade4c5` | `b5826332` |
| `src/hapa/presentation/boardframe.js` | `c358186a9aa1175b44a9983f07f0bde8b34092eecbe7f4c44f6fe7b4544ff04b` | `3c12eb8f` |
| `src/hapa/presentation/board-view.js` | `02d6c793b906408df68aaab5bb267aa806b45dbf3b659cb97f12bcd6e7d08001` | `5fedd83c` |
| `src/hapa/presentation/seated-avatar.js` | `ad902fe46836f84d280f817c55680ea2501caeb697167f4c69605ba9e4929357` | `764c6789` |
| `src/hapa/presentation/app.js` | `0528ee76ccf9de8e09550455902a327747734110b997e3ad40690fae668cc9d9` | `6862b838` |
| `src/hapa/presentation/versus.css` | `83681496e982293eadaf4e89e60876be9c1df6da11dbada8272cfcdbd1beb805` | `39f7ad64` |
| `tests/hapa/soundtrack.test.js` (new) | `a742a65dbf66def5d3a2eb5abf9bae0e9ed20e31ffe4e4a4f7e44802107bbcb7` | `f4e2660a` |

**Owners: used, not changed.**
- **Song Registry** at `dadb049` (clean checkout):
  - `src/api-server.js` `c66660b4e5c8dd1103ce3200cfbd8a042ec31efbdf4425ff268452ff74032564`;
  - `src/peer-music.js` `5af73f6ae229782da4796a5a7bfed1fd7a23d9d426f65db0ba27203ae06f6e1a`.
  - As in response 12, Red's node (8801) started before the last `peer-music.js` change, so it may run older bytes. The witnesses below relied on it only for current offers.
- **Harbor** at `1ab09d9`: `server/app.mjs` `13cd468410ac505883a5a0a8ed3f9fd3b4a2561d2a7292d1842167a046237687`, matching response 12.
- **Harness:** unchanged from response 12. Its process start was not re-hashed.

Hashes identify files on disk, not bytes loaded in a running process.

### Effective settings

- **Music:**
  - Default volume 0.55.
  - Scene response **Subtle** by default.
  - **Still** follows `prefers-reduced-motion` until the player chooses.
  - Volume, mute, play intent, response and Still persist in `hapa-versus.music-settings.v1`. No blob URLs or queue IDs are persisted.
- **Deadlines and transport:**
  - Acquisition deadline 20 s, start deadline 8 s.
  - Previous restarts the song after 3 s.
  - Accent cooldown: 6 s Subtle, 3 s Expressive.
- **Analysis:** one AnalyserNode on the music element only.
  - FFT 1024, sampled at 30 Hz.
  - Energy 40 Hz–6 kHz, low 40–180 Hz, high 2.5–9 kHz.
  - Envelope attack/release: energy 0.9/2.2 s, low 0.10/0.45 s, high 0.15/0.5 s. These are the companion's Campfire reference values.
- **Scale:** the setting is built at the seated opponent's scale, 1 m ≈ 40 world units.
  - The board is a ~1.4 m table top.
  - The apron is 9 units deep, matching Red's existing waist board and enclosing the −3 band.
  - The terrace is 0.76 m below the table top and the water 1.3 m below the terrace.
  - Islands stand beyond the camera's farthest orbit (3.6 × board size).
  - Fog runs 300–860.

## Outcome

### R12-02 / HF6-03: Keep is a quiet saved-state change

- **No automatic voice.** `Table` no longer listens to `kept`, so Keep produces no automatic Red line and no caused ducking. An independently requested conversation keeps the established ducking under speech.
- **Keep touches only saved state.** It reads its target (the current offer encounter, captured when the button is pressed) and writes `keeps`. It never touches the element, the selection, generation, gain, drawer or navigation.
- **States:** one fixed 92 px slot shows Keep → Saving… → Kept ✓, or Retry.
  - Acquisition progress ("Kept · saving audio N%") and Available offline go to the reserved status line, with one polite live-region announcement.
  - An already-retained recording shows a half-filled mark and "In your library · Keep saves this introduction". Keep then records the new introduction without a second download.
  - Pressing Keep again is never a delete.
  - A failed save also exposes **Retry keep** on its Queue and Played rows after the song has changed.
- **Stable controls:** the deck is built once and patched.
  - State uses `aria-disabled` rather than `disabled`, so a focused control keeps focus.
  - Long titles truncate inside a fixed grid. Status text has its own reserved line.
- **Developer diagnostics:** `music.diagnostics()` records each transport change with cause, context, from/to item and generation: start, next, ended, skip-unusable, restart, previous-earlier, replay-select/next/previous/again/ended, return, return-unavailable.
- **CJ's earlier switch was not reproduced.** Keep caused no transport event in any observation here. The diagnostics are in place to explain a future report.

### R12-03 / HF6-02: Queue, Played this match and Kept are a playable collection

- **The Music drawer** has three tabs, a local title/creator/introducer filter, a scrolling list and per-row provenance behind **Details**: recording, asset, library address, receipt, version, source, generator, style and introductions.
  - Opening, filtering or switching tabs never changes playback (observed: drawer open, same item and generation).
  - Empty states say what is true.
- **Played this match** records the item when its playback actually starts (`playing` on the current generation), including replays. It is not queue position or saving. It belongs to the match only.
- **Kept** reads the owner's retained membership and saved discoveries afresh when opened, and after an acknowledgement.
  - **Retained rows:** one per exact asset, introductions aggregated, Available offline, with **Play**.
  - **Durable address:** listener library + owner `libraryId` (`/music/cj/retained/retained:<id>/audio`). Its shape is validated, and the colon is kept literal.
  - **Unretained discoveries** are grouped by exact asset with the owner's acquisition state: Reference only, Saving audio, Audio download failed, or Not available offline. They are playable only while the current table holds an offer of the exact same asset.
  - No replay is invented from an incomplete historical offer. Similar titles are never merged: 24 s, 60 s and 258 s recordings with near-identical titles stay separate rows. Credits read "made with Hapa YuE2 Music" or "Creator not stated", never the storing node or the introducer.
  - The six-row limit is gone.

### Local replay and Return (companion §2.4)

- **One audible element** serves both contexts.
- **Bookmark:** the first switch from the table mix bookmarks the table entry, its position and listening intent once. Replay navigation never overwrites it.
- **Navigation:** Play on a row captures that view's playable rows in their displayed order. Next and Previous move along that list, and Previous restarts the song after 3 s. Each edge action is disabled with a reason.
- **End of a replay:** it stops with Play again and **Return to table mix**. It neither advances through the list nor returns on its own.
- **In the table mix:** Previous near the start opens the most recent song that actually played as a replay of Played. Natural completion advances the table mix (`ended`).
- **Return** restores the bookmarked entry, its clamped position and its listening intent. If the bookmarked entry was skipped or never started, Return explains that and starts nothing unrelated.
- **Fences:** both source kinds use the existing item/generation/listening/disposal fence and the finite deadlines.
  - **Play/Pause:** Play/Pause is the per-device listening intent. Pause keeps the position and cancels any acquisition in flight.
  - **Failed replay:** a failed replay item is a terminal "Unavailable: …" state with navigation still usable. It is not retried.

### R12-04 / HF6-04: the dusk island table

The meadow and camps are gone. The board, banks, Fire Pits, labels and picking are untouched. The setting has these parts:

- **The table:**
  - A cedar apron with directional grain and two aged-brass inlay bands.
  - A darker raised cedar lip, brass corner caps and four cedar legs with brass collars and feet.
  - A stretcher frame.
  - A down-facing underside that hides the excavation volume from below. Facing down, it can never fill a pit seen from above.
  - Seat-side materials retinted to cedar/slate, so Red's table edge and chair match. The chair posts now reach the terrace.
- **The terrace:** broad wet flagstones (painted here; low contrast, moss in some joints), moss patches, stone planters with low planting at the corners, a parapet, a retaining wall with a dark waterline band, and a soft contact shadow under the table.
- **Water and distance:**
  - Dark water with a slow swell, sparse haze streaks and warm lantern reflections (one small shader with fog).
  - Grouped fir islands beyond the farthest camera orbit.
  - A hazy distant shoreline ring and a dusk sky dome, warm low toward the far shore and slate overhead.
- **Practicals:** four lantern posts; their light sits *below the table-top plane*, so it can never light the playing surface from above. Also warm floor pools, glass halos, a brazier, and a cedar side table with folded linen, a brass cup, and a linen runner over your edge of the table.
- **Board frame:** the slate bands and trays move to ink slate, and the brass to restrained aged brass.
- **Lighting:** the key and fill lights are adjusted only slightly toward dusk, and the board stays as readable as before. Captures 01, 04, 05 and 06 show it. Fog and clear colour now carry a cool coastal haze.

Not built: the full island, Hall, Harbor House or Nexus Bowl. No owner art or external assets were imported.

### R12-05 / HF6-05: response to the music actually playing

- **[`music-signal.js`](../../src/hapa/presentation/music-signal.js)** owns one optional graph: music element → owned gain → speakers, plus an analyser branch.
  - It is created once per element, on a user gesture, with the audible path connected first.
  - The gain node owns the effective volume, mute and voice duck from then on, applied once.
  - If construction fails, playback continues on the element alone. Voice and game sounds never enter this graph.
- **The frame** (companion §6.2) is bound to the exact active item and generation and to `audio.currentTime`.
  - A change of item or generation, or a seek discontinuity, resets the envelopes.
  - Pause, ended, not listening or unavailable analysis release toward neutral.
  - Normalization runs between a slowly falling running peak and a slowly rising running floor, with a minimum span. Quiet passages read low and silence cannot be amplified.
- **Three jobs in `scenery.js`:**
  1. Lantern light, glass, floor pools and the brass inlay glow with smoothed energy.
  2. Water shimmer and reflection strength follow the low and high bands.
  3. A rare accent (low band clearly above its own average, after the cooldown) spawns a few embers from the lanterns or brazier and one light gliding along the trim. Accents are suppressed while dragging, targeting or orbiting.
- **Never modulated:** the board's lights, rule colours, exposure, camera and pickable geometry.
- **Modes:**
  - **Off:** the baseline with quiet ambient life (water swell, lantern flicker).
  - **Subtle** (default).
  - **Expressive:** about 2.4× the amplitude, more embers, the 3 s cooldown.
  - **Still:** holds all decorative motion, including the water clock and flames, and all musical intensity.
  - None of these stops the music. The tooltip says Mute lowers sound only, while Off or Still calms the scene.
- **Resources:** a fixed pool of 32 embers, one glint sprite, four point lights and shared materials.
  - The whole setting is disposed on match replacement, including cloned maps, the factory and the texture library.
  - The previous match's audio graph closes on disposal.

### R12-01: both edges, and the drawer in the composition

- **Both-edge rule:** a beside-face candidate is accepted only if `left >= freeLeft && left + width <= freeRight`. A collapsed nameplate otherwise clamps inside; an expanded panel docks.
- **The open Music drawer is part of the free-area composition.** It stands beside the other drawers (`--music-r`), and the free band (`--free-r`) ends at its left edge. The conversation, command bar, inspection bar and layer rail therefore reflow beside it.
- **Placement stays measured:** gesture containment, drafts, focus and the measured docking from response 12 are unchanged.

## Finding disposition

| Finding | Disposition | Basis |
| --- | --- | --- |
| R12-01 | Completed | Seven panned poses with Orders + Music + conversation open: all inside the free band. The pose with the face behind the Music drawer docks where the old left-edge-only check would have overlapped (journey step 10). |
| R12-02 | Completed; CJ's earlier switch not reproduced | Live Keep: source, generation, gain 0.55, time progression and button rectangles unchanged; no transport events; nothing spoken. Reply after an independent transport change stays with its encounter (step 5, and a fixture test). Simulated failure → Retry with playback unchanged (step 4). |
| R12-03 | Completed in available-owner scope | Played/Kept/Queue live. Retained replay on a fresh match with Red's library unreachable (step 7). Unretained Kept states covered by a fixture test only; the live library holds only retained recordings. |
| R12-04 | Delivered for CJ's art review | Complete setting with response Off. Readability captures in Home, tactical, −3 cutaway and close inspection. Not human-accepted. |
| R12-05 | Completed | Measured analysis on the playing element. Off/Subtle/Expressive/Still/pause comparisons (step 8); accent spawn observed; frame time unchanged Off vs Expressive. |

## Independent expectation and observed result

Each item states the expectation, then what was observed in the [journey](evidence/2026-11-25/response-13/ui-journey.json).

- **Keep during playback.**
  - Expected: no source, time, pause, gain, navigation or voice change.
  - Observed over 16 samples at 250 ms: same blob, generation 1, gain 0.55 throughout, time monotonic, never paused, nobody speaking, no transport entries, Keep/Next rectangles identical.
  - The owner recorded a third introduction of an already retained asset, with no new download.
- **Independent transport during a save.**
  - Expected: the save stays with its encounter and the transport stands.
  - Observed: "Saving" mid-state; Previous restarted q4 with the logged reason `restart`; the delayed real reply marked q4 Kept; the source, generation and gain were unchanged by the reply.
- **Natural end, table mix.**
  - Expected: advance with `ended`.
  - Observed twice (q2 → q3, q3 → q4), with item and generation logged.
- **Replay.**
  - Expected: bookmark once, manual navigation, stop at end, Return.
  - Observed: bookmark q4 at 24.84 s held through Next and Previous; the replay ended in the `replay-ended` state without advancing; Return resumed q4 (27.59 s three seconds later) with listening restored.
- **Kept after a new match with the introducing peer unavailable.**
  - Expected: retained Play works while CJ's listener owner runs.
  - Observed on a scoped server whose Red route answered 502, while the shared server's stayed 200: an empty table mix, three Kept rows, and Play on the 258 s recording through the literal-colon route, playing with measured analysis.
  - Return there explained that no table song exists.
- **Scene response.**
  - Expected: Subtle visible, Off baseline, Expressive larger, Still frozen, pause neutral.
  - Observed glow 0.36 / ≈0 / 0.84 / 0, water clock frozen only under Still, and pause neutral (generation −1).
  - After the normalization change, energy ranged 0.60–0.93 over 30 s, and one Expressive accent spawned 10 embers.
- **Readability.**
  - Expected: field, banks, pieces and the −3 band as readable as before, and no decoration in the excavation volume.
  - Observed: see captures. The lantern light was first placed above the table and visibly warmed the board, so it was moved below the table-top plane before qualification.
- **Board use.**
  - Expected: board gestures and one Ready unchanged.
  - Observed: a move without Supply was refused by the rules, as before. `load_supply` was accepted. One Ready resolved Tick 1 → 2, and music transport did not change during resolution.
- **Performance** (1440×900, DPR 1, same track and camera, 6 s each): Off 18.63 ms mean / 21.9 ms p95; Expressive 18.54 / 22.1. Point lights stay at 4 across repeated New match, and the previous audio graph is closed.

## Visual evidence

All captures come from [`evidence/2026-11-25/response-13/`](evidence/2026-11-25/response-13/): 1440×900 CSS, shown at 800 px wide, Subtle response, music playing.

1. [01-home-subtle.jpg](evidence/2026-11-25/response-13/01-home-subtle.jpg): Home with Red seated, the compact deck, lanterns and flagstones.
2. [02-low-orbit-table.jpg](evidence/2026-11-25/response-13/02-low-orbit-table.jpg): low orbit from your side, showing the cedar table, legs, brass inlay, Red, the brazier and the water beyond.
3. [03-kept-drawer.jpg](evidence/2026-11-25/response-13/03-kept-drawer.jpg): Kept view, with three retained rows, Play, Available offline and similar titles kept apart.
4. [04-tactical.jpg](evidence/2026-11-25/response-13/04-tactical.jpg): tactical view with the field and banks.
5. [05-excavation-band-minus3.jpg](evidence/2026-11-25/response-13/05-excavation-band-minus3.jpg): the −3 cutaway, with nothing decorative inside the excavation volume.
6. [06-close-formation.jpg](evidence/2026-11-25/response-13/06-close-formation.jpg): close formation inspection.
7. [07-orders-music-conversation.jpg](evidence/2026-11-25/response-13/07-orders-music-conversation.jpg): Orders and Music drawers side by side, with Red's conversation in the remaining free band.
8. [08-retained-replay-red-unreachable.jpg](evidence/2026-11-25/response-13/08-retained-replay-red-unreachable.jpg): a retained recording replaying on the scoped server, with the Replay badge and the Return to table mix control.

Captures 01 and 03–07 precede two late fixes that do not change what they show (setting texture disposal; Red's hit area kept transparent on hover).

## Verification record

| Check | Result |
| --- | --- |
| `npm run check` on the final candidate (working tree equal to `c42649b`) | Exit 0. 155/155 rules tests (152 previous + 3 new), smoke match, two-process peer match, build. [Summary](evidence/2026-11-25/response-13/npm-check-summary.txt). |
| `node --test tests/hapa/soundtrack.test.js` | 3/3. Bookmark/Return and replay-end stop; quiet Keep with a reply after Next; Kept rows by exact asset (retained, unretained, invalid address). Audio, fetch and storage are fixtures. [Output](evidence/2026-11-25/response-13/soundtrack-test-results.txt). |
| Live journey | 13 steps recorded in [ui-journey.json](evidence/2026-11-25/response-13/ui-journey.json). The step 4 failure was simulated in the page and is labelled. |
| Reused unchanged evidence | Response 12's decider tests and resume probes. The model decider is unchanged. Resume semantics are carried forward into the new transport and covered by the bookmark/Return test, but the response-12 probe was not rerun against the rewritten module. |

## Remaining limitations

- **Art is a first pass for CJ's eye**, not an accepted image.
  - The lantern posts and island firs are Luminati's procedural props scaled up to human scale. They read as chunky pixel shapes up close.
  - The sky dome is mostly out of frame in ordinary game poses.
  - The Subtle amplitudes were tuned by measurement and short listening, not by a quiet-versus-loud track comparison.
- **The normalization change** (peak-relative to floor-to-peak) was observed live only briefly, in step 7 and the 30 s accent sample. Step 8's mode comparison predates it.
- **Not exercised live:**
  - Unretained Kept rows (reference only, acquiring, failed). CJ's library contains only retained recordings, so these are covered by fixture only.
  - Native scrolling of a long collection; the lists had three or four rows.
  - Conversation text selection, which was re-established in response 12 with code unchanged since.
- **At 700 px width the deck covers Red's face** in the Home pose. Controls fit with 32 px targets.
- **New match leaks the previous BoardView.** It is removed but not disposed, which predates this work: about 1,100 GPU geometries per New match. The setting itself is disposed.
- **Owner writes:** two Keep presses in the journey wrote real introduction records to CJ's library (no audio downloaded again). The simulated failure wrote nothing.
- **Process notes:**
  - The scoped Red-unreachable server (port 5200) ran as a background shell and was stopped after step 7. The preview tool resolved its launch file from another project folder at that moment.
  - That tool briefly started the Prawn Shop dev server (5190) by mistake; I stopped it immediately, and no file changed.
- **Out of scope, as assigned:** remote synchronized listening, cross-session Played history, re-sharing and export, owner-library redesign, Living Light or Campfire renderers.
- `keptLine` remains exported in `reactions.js` but is no longer used.

## Decisions and next handoff

- **Board:** HV-64 is in Review. Creation receipt `evt_1795602070247_d22cd7ce`; the handoff comment follows this commit. CJ accepts to Done.
- **Next human art decision** (companion §8): when playing a normal turn at Home, 1440×900, Subtle response, does this coastal table feel more inviting and recognizably Hapa? Is the Subtle response visible enough to enjoy without drawing attention from the pieces? Useful sub-choices:
  - whether the lanterns should stay as four posts or become tabletop lanterns;
  - whether the flagstones should be warmer or darker behind the board.
- **This work item ends here.** I am starting no further polishing or board-drain cycle.
