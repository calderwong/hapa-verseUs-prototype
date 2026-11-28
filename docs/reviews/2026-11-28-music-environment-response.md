# Music-environment implementation response — let the scene dance with the song

**28 November 2026 · coding agent (Claude Code) · answers [Addendum 12](../requirements/2026-11-28-human-feedback-addendum-12.md) and the [focused music review](2026-11-28-music-environment-follow-up.md) (published in `e86dcbb`) · GitHub task [#8](https://github.com/calderwong/hapa-verseUs-prototype/issues/8)**

## Separate statuses

| # | Claim | Status |
| --- | --- | --- |
| 1 | ME-01 / HF12-01, HF12-02 — Expressive visibly musical from Home, measured song signal | **Implemented on main** (`98557f1`, `b68b95c`) and **observed in motion**. In the captures, onsets send light up the rail and rings across the terrace, the swell breathes the lanterns, and the high band twinkles. See [evidence](evidence/2026-11-28/music-environment-response/README.md). |
| 2 | ME-02 / HF12-03 — music without an Avatar | **Implemented and verified on the dev page.** Local No figure games keep the deck, one player and the scene response. The Avatar and online paths are unchanged. |
| 3 | ME-03 / HF12-04, HF12-05 — controls, state, lifecycle, game clarity | **Verified on the dev page.** Off/Subtle/Expressive, Still, reduced motion, saved settings, mute, pause, seek, Next and replacement all checked, plus an ordinary turn with music. The camera was identical throughout. |
| 4 | Qualification | Focused `music-signal` 4/4 (sabotage: fails on `e86dcbb`), neighbouring focused tests 13/13, integrated `npm run check` **207/207** on the final sources. |
| 5 | Delivery | **Main only.** No new executable. **friend.9 does not contain this work**, and the friend.9 two-home handoff and its pending human result are unchanged. |
| 6 | CJ's aesthetic acceptance | **Not claimed.** The videos are silent, and no human has listened and watched together. That judgment is CJ's. |

## Starting point (reconciled)

Main was at `e86dcbb` (Response 25 plus the music review publication). The tree was clean, and there were no other worktrees or newer music branches. Response 25's renderer cancellation and labels are untouched; the `avatar-loading` regression still passes. The analyzer, the single Soundtrack-owned graph and the scenery hook were the review's "working foundation", and this work extends them.

**Reproduced first:** a local No figure match started with no Table and no music deck (`table: false`) because `_attachTable` returned early. From the normal Home camera, the only decorative surfaces in view are the wide cedar top rail along both long sides with its brass line, and the flagstone terrace strips beyond it. The water, the apron inlays and most of each lantern are outside the frame. Those were the surfaces available to dance.

## What changed

### The signal (`music-signal.js`, frame `version: 2`)

| Time scale | Fields | Method |
| --- | --- | --- |
| Fast | `onset01`, `onsetCount`, `onsetStrength`; `low01` (40 ms attack / 300 ms release) | Positive spectral flux in 40–250 Hz above an adaptive mean + 1.6 × deviation threshold. It fires at the flux peak (one frame of latency), with at most one onset per 110 ms. This is **an onset, not a detected beat**. |
| Slow | `energy01` (0.9 s / 2.2 s), `mid01` (180–2500 Hz) | Mean byte magnitude per band, normalized to the song's own recent range. The swell also keeps half of the absolute level, so a quieter passage or recording reads visibly lower. |
| Fine | `high01` (2.5–9 kHz, 60 ms / 350 ms) | Same level method |

- **No tempo.** `bpm` and `beatPhase` stay `null`, and `METHOD.tempo` is `'not measured'`.
- **The measurement method travels with the frame** (`METHOD`).
- **Analysis input.** The music element is analysed before your volume, mute and voice-duck. Avatar speech and game sounds never reach it (unchanged). The analyser now runs once per render frame (≤ 60 Hz) with lighter smoothing (0.3), and normalization is time-based.
- **`state` says what the scene is following:** `following`, `silence` (measured, too quiet), `paused`, `blocked`, `idle` or `unavailable`.
- **Resets.** A seek, a new item or generation (Next, replay, Return), or a hidden-tab gap clears the envelopes and the onset history. A visible `resets` counter tells the scene to drop transients already in flight. Nothing is queued, so a returning tab replays nothing.

### The scene (`scenery.js`; noninteractive, outside the painted top and banks)

| Measured cue | What moves (Home view) | Off · Subtle · Expressive |
| --- | --- | --- |
| Onset | **Rail chase:** a light pulse starts at both near corners and climbs the two side rails along the brass line, meeting behind the opponent (about 1 s). Up to 10 pulses can overlap. | none · dimmer, stronger onsets only · every onset |
| Stronger onset (≥ 0.4) | **Terrace ripples:** a ring of warm light travels out across the flagstones from the table's edge (about 1.5 s), at most one ring per 0.3 s | none · none · yes |
| Low band | The rail line's own level | 0 · low · full |
| Swell (energy) | The lanterns, their pools and halos breathe. Their **emphasis turns lantern to lantern round the table** at a pace set by the middle band; the phase is integrated, so it never jumps. Expressive adds a faint warm wash round the table. | quiet ambient only · gentle · full |
| High band | Fine twinkles along the rail; the water shimmer | none · faint · full |
| Accent (unchanged) | Rare embers and one trim glint, with a cooldown | as before |

- **Busy interaction.** A card drag, camera drag or targeting tool halves new rail pulses and starts no rings or embers.
- **Still and reduced motion.** Still clears everything and freezes the phase. Reduced motion defaults to Still until the player chooses.
- **Song and seek changes** clear in-flight pulses and rings.
- **Nothing gameplay-related is modulated.** No tile, lane or team colour, selection, Mana or damage mark, label, piece, camera, exposure or hit target changes. Two shader materials and their meshes are pooled, owned by the scenery and disposed with it. Two tuning passes in motion reduced the swell wash and lantern lift (an early version washed the stone orange), widened the rail pulses, and moved their start to the near corners. The rail's middle is below the Home frame, so pulses launched there first appeared about 0.2 s late.

### Music without a figure (`app.js`, `table.js`)

- **When a table gets music.** A local game with No figure, or any local table without exactly one Avatar-eligible bot seat, now gets the same Avatar-free `Table` that online play already used. That means one `Soundtrack`, one player and one analysis graph.
- **No new figure or controller.** No Avatar is created, the seat keeps its controller, and the neutral plate reads "Heuristic bot · no figure" with the one **Music on** gesture.
- **Unchanged paths.** Diagnostic fixtures still start no music. The Avatar path (Red, Falka, Leo, Thor) and online human music are unchanged. The setup sentence "With no figure, only your library plays." is now true in practice.

### Understandable state (`music-deck.js`)

- **Placement.** In the Music drawer, under Scene response and Still atmosphere.
- **Help.** One line of concise help.
- **State line.** "Following this song · Expressive" / "… quiet passage" / "Paused: the scene is settling" / "Response off …" / "Still atmosphere …" / "Song analysis unavailable here: ambient motion only" / "No song playing …".
- **Signal meters.** A collapsed **Signal** section has four meters (Onset, Low, Swell, High) and a method sentence. Updates run at about 8 Hz, only while open, and are never announced.

## Observed behaviour (evidence)

All observations were on the dev page serving this checkout, at the ordinary Home view, with local No figure and CJ's own library through the app's own Soundtrack. They are in the [evidence packet](evidence/2026-11-28/music-environment-response/README.md).

- **Same span, three modes** ([side-by-side video](evidence/2026-11-28/music-environment-response/modes-side-by-side.mp4)). Track A, song 61.5 → 79.5 s.
  - **Off** stays flat.
  - **Subtle** shows dim rail pulses (at most 2 live, rail level ≤ 0.22).
  - **Expressive** runs pulses up both rails with each onset (at most 5 live), rings across the terrace on stronger onsets (at most 3), and breathing lanterns.
  - The measured onsets for the three plays were 37 / 35 / 38, so the measurement is repeatable; only the response differs.
- **Contrasting passages.** Within the span, the quieter 63–71 s averages swell 0.60 with 0.38 rings live. The stronger 72–79.5 s averages swell 0.81 with 0.82 rings live, at a similar onset rate: stronger onsets, more rings.
- **Second track** ([video](evidence/2026-11-28/music-environment-response/track-b-expressive.mp4)). Track B's quieter opening (10.5 → 28.5 s) peaks at swell 0.71, against 0.87 for track A. Its busier-then-sparser onsets show as pulse density (2.7 then 1.9 pulses live on average).
- **Relationship to the music.** The [onset strip](evidence/2026-11-28/music-environment-response/onset-strip.jpg) and the videos' overlay show the onset bar and count stepping in the same 100 ms frame in which the rail's near corners light.
- **Ordinary turn.** Ready advanced Tick 1 → 2 with Expressive music playing. The camera position was identical before, during and after every mode change.

## Limitations

- **Silent evidence.** The private audio cannot be published, and the capture browser was muted. The relationship is shown through the measured overlay. CJ's watch-and-listen judgment is the acceptance test.
- **What is measured.** Onsets are low-band transients, not beats. There is no tempo, bar or section, and no instrument separation. Very sparse or very dense music gives sparse or dense pulses accordingly.
- **Normalization is still partly song-relative.** A long quiet intro adapts upward over about 8–13 s. The half-absolute swell limits but does not remove this.
- **Tuning and coverage.** Tuning was done against two tracks from CJ's library, and other material may want different thresholds. Track 1 did not start during the passage scan and was not used.
- **Not exercised here:**
  - the installed app, friend.9 and Windows;
  - online human play's music (code unchanged);
  - a GPU or frame-time measurement.
- **Owner figures.** Seated owner figures were checked by state only; no captures were published (private art).

## Try it (CJ)

1. Start the dev page, or reload it if the Vite server for this checkout is running: `npm run dev`, then `http://127.0.0.1:5199/versus.html`.
2. Choose **No figure** or any figure, then **Start match**.
3. Press **Music on** (or Play in the deck).
4. Open **Music ▾** and choose **Expressive**. Watch the two side rails and the stone beyond them at Home. Compare **Subtle** and **Off** on the same song with **Signal** open.
5. Play a turn.

## Overwatch and GitHub

- **Overwatch.** Board `hapa-versus` gets the implementation progress and evidence on a music card in Review. CJ alone accepts it.
- **GitHub.** Issue #8 gets this response and the evidence links.

## Stop

The bounded follow-up is done. Further tuning should follow CJ's listening-and-watching feedback on these behaviours (for example, more or less ring activity, or rail brightness), not more speculative effects.
