# Music-environment response evidence — 28 November 2026

Supports the [music-environment implementation response](../../../2026-11-28-music-environment-response.md) for [Addendum 12](../../../../requirements/2026-11-28-human-feedback-addendum-12.md) / GitHub issue [#8](https://github.com/calderwong/hapa-verseUs-prototype/issues/8).

**Code:** `98557f1` and `b68b95c` on main, on top of `e86dcbb`. The captures, the lifecycle journey and the integrated check below all ran on `b68b95c`'s sources. **No new executable**; friend.9 does not contain this work.

**Setting for every capture:** the Vite dev page (`127.0.0.1:5199/versus.html?debug=1`, serving this checkout) in headless Chrome, at 1280 × 800 CSS px. The camera is the ordinary **Home** view and is never moved, local **No figure** (so no owner art appears), Tick 1. The music is CJ's own library, served by its loopback owner node through the app's ordinary Soundtrack. **Track A** is queue index 0 (about 3:30 long); **track B** is queue index 3 (about 3:52, with a quieter, sparser opening). Song titles, credits and audio are private, so they are hidden or absent. The deck's title text is hidden in the captures, and the videos are silent. The browser ran with `--mute-audio`, which silences output but not the analysis.

**The overlay in the captures is evidence only, not product UI.** The capture script draws a small panel bottom-left. It shows the response mode, the song's own playback time, the signal `state` and four bars read from the live `MusicSignal` frame each animation frame: onset, low, swell and high. These are the same values the scenery consumes. Because the published video cannot carry the private audio, this panel is how a viewer sees the light respond to the music. In the product, the same meters live behind Music → Signal.

| File | What it shows | Limit |
| --- | --- | --- |
| [modes-side-by-side.mp4](modes-side-by-side.mp4) | **Off │ Subtle │ Expressive**, same track A span (song 61.5 → 79.5 s), same Home camera, side by side, 18 s each, 30 fps. Off: flat stone, no rail light. Subtle: dim rail pulses on stronger onsets, gentle swell, no rings. Expressive: a pulse up both side rails on each onset, rings across the terrace on stronger onsets, lanterns breathing; the passage gets visibly stronger from ~72 s | Silent; headless Chrome; the three spans are separate plays of the same timestamps (seek to 60 s, 1.5 s settle) |
| [track-a-expressive.mp4](track-a-expressive.mp4) | The Expressive span above at 960 px, so the rail pulses and rings are easier to follow | Silent |
| [track-b-expressive.mp4](track-b-expressive.mp4) | Second, contrasting track B, song 10.5 → 28.5 s, Expressive: lower swell (max 0.71 vs 0.87 on track A), a busier then sparser onset pattern | Silent |
| [modes-same-moment.jpg](modes-same-moment.jpg) | One frame at the same song moment (≈73.5 s) in Off / Subtle / Expressive. The board, its colours, pieces and labels are identical | A still: supports the videos, does not prove motion |
| [onset-strip.jpg](onset-strip.jpg) | Ten Expressive frames 100 ms apart around one logged onset (song ≈65.1 s): the onset bar and count step, the near corners of the rail light at once, a pulse climbs the side rail and a ring opens on the terrace | A strip of stills |
| [capture-signal-log.json](capture-signal-log.json) | The frame values polled every ~100 ms during each capture (`seg` 0–3 = Off, Subtle, Expressive, track B): song time, state, onsets, bands, live pulses/rings, rail level | Polled, not every frame |
| [lifecycle-journey.json](lifecycle-journey.json) | Driven through the page's own objects: No figure keeps the deck and a neutral "Heuristic bot · no figure" plate; Music on; Expressive; drawer state line and meters; pause (state `paused`, 0 onsets while paused, pulses released); resume; seek +40 s (envelopes and in-flight pulses/rings cleared at once); Next (new generation, nothing carried over); mute (gain 0, analysis still following); Off (rail 0); Still (no pulses, lamp phase frozen; music plays); **an ordinary turn, Ready Tick 1 → 2 with music playing, camera identical**; saved settings after reload; Falka (existing Avatar path) with the same single music and response; replacement match disposes the old player and its audio graph; reduced motion → Still by default with no response | Dev page, not an installed app; Falka's figure art not captured |
| [passage-scan.json](passage-scan.json) | Measured onset rate and absolute level at points through the available tracks; used to choose contrasting passages | Track 1 did not start in this scan and was not used |
| [music-signal-test.txt](music-signal-test.txt) | `tests/hapa/music-signal.test.js` 4/4: one onset per kick with strength and no tempo; steady passage → swell, no onsets; high-band flicker is texture, not onsets; low leads the slow swell; silence / paused / blocked / idle / unavailable distinct; seek, new generation and hidden-tab gap never replay an onset | Synthetic spectra through the real `MusicSignal`; no audio |
| Sabotage (recorded here) | The same test against `e86dcbb`'s `music-signal.js` does not load (no `METHOD` export, no onset fields): 0 pass, 1 file failure | — |
| [npm-check-summary.txt](npm-check-summary.txt) | One integrated `npm run check` on the final sources: 207/207, smoke match, two-process peer-verified match agrees, build | Docs edited afterwards; no test reads them |
| [scripts/](scripts/) | `capture.mjs` (CDP screencast + overlay + signal log), `journey.mjs`, `scan.mjs` / `fine.mjs` (passage selection), `onsetstrip.mjs`, `lib.mjs` (puppeteer-core from the Luminati checkout's dependencies) | Need the local owner music nodes and a song library to reproduce |

## Numbers from the captures

| Span (track A, Expressive) | Swell (mean) | Rail level (mean) | Rings live (mean) | Onsets/s (polled) |
| --- | --- | --- | --- | --- |
| 63–71 s (quieter) | 0.60 | 0.52 | 0.38 | 1.9 |
| 72–79.5 s (stronger) | 0.81 | 0.59 | 0.82 | 2.0 |

| Segment | Song span | Onsets counted | Max pulses | Max rings | Rail max |
| --- | --- | --- | --- | --- | --- |
| Off | 61.5–79.4 | 37 | 0 | 0 | 0.00 |
| Subtle | 61.5–79.5 | 35 | 2 | 0 | 0.22 |
| Expressive | 61.5–79.4 | 38 | 5 | 3 | 0.64 |
| Track B, Expressive | 10.5–28.4 | 42 | 7 | 2 | 0.59 |

The onset counts across the three plays of the same span (37 / 35 / 38) show the measurement repeats; the scene's response, not the measurement, is what Off/Subtle/Expressive change.

## Not established here

- **No human listening test.** The videos are silent and the relation is shown through the measured overlay. CJ should watch and listen on the dev page (steps in the response) to judge whether it feels like dancing.
- Headless Chrome on this Mac, not the installed app or friend.9; no frame-rate or GPU-cost measurement beyond the capture running at the screencast's ~60 fps.
- Captures with a seated owner figure (Red, Falka, Leo, Thor) were not published (private owner art); Falka's path was checked through its state only.
- Online human play's music path was not rerun (its code is unchanged; the same Table/Soundtrack now also serves local No figure).
