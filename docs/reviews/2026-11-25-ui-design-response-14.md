# Implementation response 14 — 2026-11-25

## Scope and source

- **Goal and scope:** Assignment 14's bounded correction pass. It completes R13-01 to R13-06 as one candidate. The music collection, quiet Keep, retained playback, local replay/Return, seated Red, the coastal table and the music-response architecture are preserved. Rules, one-press Ready, recorded game replay and owner responsibilities are unchanged.
- **Review addressed:** [Review 13](2026-11-25-ui-design-review-13.md) and [Assignment 14](2026-11-25-next-agent-assignment-14.md), with the [Review 13 evidence](evidence/2026-11-25/review-13/README.md), published in `6fb4975`. They review implementation `c42649b` at main `e042861`.
- **Findings addressed:** R13-01 to R13-06.
- **Reconciliation:**
  - The working tree was clean on `main` at `e042861` (Response 13, already on GitHub).
  - I fast-forwarded to `6fb4975`. There were no local commits or uncommitted work to reconcile, and no other agent's work was present in this checkout.
  - The running Vite server on `127.0.0.1:5199` serves the working tree from disk. Every live step below names the source it ran on ([journey](evidence/2026-11-25/response-14/ui-journey.json)).
- **Implementation:** commit `153b657ad28f640f6efa42739e3d1bc7f70ebc4d` (tree `aa35b00ba94019da7b44f8ad98d6aa9a0dca00f1`), parent `6fb4975`. This documentation and evidence follow in the next commit.
- **Engine gitlink:** `vendor/lumina` stays at `ba838cca09ba43afceda0452b63d28df4cbf7f72`, unchanged.
- **Default profile:** `hapa_open_10x9_v3_07`, unchanged.
- **Owners (verified unchanged and clean):** Song Registry `dadb049`, Harbor `1ab09d9`, Harness `16dc700`. No owner code changed.
- **Overwatch:** new card HV-65 in Review, as HV-64's successor. Creation receipt: `evt_1795647684373_acefc5f1`. The handoff comment follows this documentation commit.
- **CJ acceptance:** not recorded.

### Source identity (SHA-256 at `153b657`)

| File | SHA-256 |
| --- | --- |
| `src/hapa/presentation/soundtrack.js` | `24072501c3020b0002ea078c3669db4ee0f84b1a22b67a40140d9d58deeb8351` |
| `src/hapa/presentation/music-deck.js` | `bbe699931ab620741a00722ab887758f08418d8129b46d93beb0a16841088213` |
| `src/hapa/presentation/table.js` | `50aa4926b5295e26164108d5f9c0daa2748318207a2e1e44cb0187f870b2ff18` |
| `src/hapa/presentation/app.js` | `0175b7a1cffe7f66c730a97cc7e7e7f943eb6228759da6925fc398874ae5b104` |
| `src/hapa/presentation/avatar-opponent.js` | `d59662a0697511d0726da0cd47d53a89486dd614c197c90498a99f7a8bb36ec3` |
| `src/hapa/presentation/board-view.js` | `204fb15758c38c8408e32ea4075f7e514e420831f7e473eaba95d7921a110c35` |
| `src/hapa/presentation/resources.js` (new) | `3427c768cfd321ff6f4a0c26d0eeeb6c2e6cf565780e1efc47689a2a0e7d5584` |
| `src/hapa/presentation/scenery.js` | `3e6df2c4fecc8aab363d1c02abc3f5c2c4d987c4d805afc4011cb04485a7a017` |
| `src/hapa/presentation/seated-avatar.js` | `96f4dcba586d904072fc05de48b40f8ce22fc9c2d06613055a22e685fd70c04b` |
| `src/hapa/presentation/pieces.js` | `578a9061dc1ef863cc44278b0d6819a66ac95c65e2b377dc2f645b07e0482d73` |
| `src/hapa/presentation/gear.js` | `fade11e69602192a39d0d1799c21e7c0bc884ad3722f94004f1488b18c893b7d` |
| `src/hapa/presentation/terrain-view.js` | `3a44f13343f64c9354f9bdd03dea3b87ebbe12eb33c221a0b053fbf39fcc8a8f` |
| `src/hapa/presentation/territory-diorama.js` | `fe69938bb91897a995247648e6f6c91c4e6a79d261e9bf2c7b963f6d6eca23ea` |
| `src/hapa/presentation/versus.css` | `4ece892cc3cbcef3664264d940a883d0fed73a53b2905f405e3dd6238450a85f` |
| `tests/hapa/soundtrack.test.js` | `9d02c9b23bdce271957d9a337965e45995b2f4f37b687e3f62a676de8d7fcb75` |

`music-signal.js` is unchanged from Response 13.

## Outcome

### R13-01: a delayed start can no longer undo Pause

`Soundtrack._play(gen, item)` is now the single start path for table playback, local replay, resume and retry. It checks the attempt three times:
- before waiting for the audio graph;
- again after the graph resumes;
- once more immediately before `audio.play()`.

The attempt is its playback generation plus the selected item, the listening intent and disposal. A Pause, a new selection or disposal during the wait abandons the old start quietly: it resolves `false` and nothing plays. The existing post-result fences and the 8 s start deadline still apply to a current attempt.

### R13-02: the main button does what it says, on the first press

`Soundtrack.primaryAction()` is the one answer the deck uses for the glyph, label and accessible name. `togglePlay()` performs exactly that action:

| State | Shown | One press |
| --- | --- | --- |
| Playing, or a start pending | ⏸ Pause music | `pause()`: intent off, fences any acquisition or start |
| Ready (prepared, never started), paused | ▶ Play music | starts or resumes the selected recording |
| Failed (recoverable) | ▶ Play music · "Could not play: … · Play tries again" | retries the **same** recording and cancels the pending table skip |
| Blocked by the browser | ▶ Play music · "Sound is waiting for your press…" | the same recording starts within this gesture |
| Table mix finished | ↻ Play again from the start | restarts the last table song **from zero** |
| Replay finished | ↻ Play again | the deliberate replay-end stop is unchanged |

Activation blocks are now their own state (`blocked`). That covers the audio graph refusing to resume and `audio.play()` rejecting with `NotAllowedError`. The recording stays selected and is never marked skipped. Only genuinely unusable media still takes the finite skip path, and its timer is cancelled by any new attempt.

### R13-03: Previous follows what was actually heard

A bounded chronology records actual playback starts only. It holds 64 entries and merges consecutive repeats. Browsing, saving and acquiring never write to it, and it is independent of the unique Played collection.

Near the start of a table song, Previous opens the most recently heard other recording as a local replay. The replay's list is the listening order captured at that moment: each recording at its latest occurrence, oldest first. A further Previous walks back through what was heard. The following are unchanged:
- restart after 3 s;
- navigation within a captured replay list;
- the contribution queue order.

### R13-04: compact panels keep the face and every control reachable

- **Deck placement from both edges.** `Table._placeDeck` sizes and positions the deck between the left reservation (`--free-l`) and the other drawers (`--music-r`). It can never extend past either edge.
- **Clear of the face while closed.** The deck takes the top-right corner when that is clear of the projected face. Otherwise it takes a compact slot (272–400 px) right of the face, left of it, or below the camera pad. It keeps its current slot while that stays clear, so it does not flicker as the camera moves.
- **Compact layout.** The compact deck keeps every transport control; only the volume slider and subtitle drop out, as before at narrow widths. The social layer stays below the deck where they share columns, and below the camera pad when a narrow band puts it there.
- **One expanded side panel when they cannot coexist.** `App._onePanel` compares Orders, the Music drawer and the expanded conversation with the room beside the navigator and any required decision. If the board would keep less than 220 px, opening one collapses the others quietly, and focus stays with the panel just opened. At 1440 px all three still fit, as Review 12's beside-face composition requires.
- **State survives collapse:**
  - Orders keeps its tab and scroll;
  - Music keeps its tab, filter and list scroll (restored again after the reopened drawer settles);
  - the conversation keeps its draft, selection and history scroll.
- **Reservation fix.** The open drawer's reservation now uses the same arithmetic as the placement. The journey found the old reservation could be measured before the deck moved, which docked the nameplate off-screen at 700 px.

### R13-05: replacing a match releases the old board

`BoardView.dispose()` is idempotent, and `resources.js` defines ownership:

- **Shared caches stay.** Module caches are marked shared where they are created: crest plaques, piece textures, gear, strata, chevron and diorama paint.
- **Sprites release themselves.** Each `Sprite3D` releases its own mesh, materials and sheet texture through Luminati's own `dispose`, along with its reference to the ref-counted blob. Three's shared Sprite quad is never released.
- **The board releases what it created.** That is its remaining geometries, materials and textures (including texture uniforms) and its lights' shadow maps.
- **Owner subtrees are skipped.** Nodes with `userData.owner` (the setting and the seated Avatar) are released by their owners.

New match now tears down in ownership order: the social table (seated Avatar, voice, music), then the setting, then the board.

### R13-06: one Home refinement

All changes are inside the delivered scene; the camera and its behavior are unchanged.

- **Paving:** finer coursed flagstones, six ~32 cm courses per 1.9 m repeat. Joints are only a little darker than the stone, with soft per-stone value shifts and quiet lichen.
- **Moss:** lives in the joints of the stone texture, plus soft-edged drifts along the parapet and at the planters. The flat green polygons are gone.
- **Coastal cue from Home:** the terrace is shallower behind the opponent (1.4 m) and at the sides (1.8 m), and the water is a high-tide quay 55 cm below the terrace. The far parapet, the water, a moored teal skiff with a cream gunwale, two iron bollards, the skiff's line and a rope coil now sit at the top of the normal Home frame. The far-corner planters were removed so that edge reads.
- **Crafted table:** a 3.4-unit cedar top rail overhangs the apron round the painted top, with a darker outer bevel, a fine brass line and brass corner plates. From Home this reads as the table's own edge, and an orbit shows rail, apron, legs and stretchers together.
- **Music response unchanged:** the new brass line uses a non-responsive material, the response still lives on the apron inlay, lanterns and water, and lantern positions are unchanged. No response retuning was done, so no new Subtle check was needed.

## Finding disposition

| Finding | Disposition |
| --- | --- |
| R13-01 | Fixed in the shared start path; proven by family 1 and the reviewer's race probe rerun. |
| R13-02 | Fixed; proven by family 2, the reviewer's transport probe rerun and live first-press and finished-table Play. |
| R13-03 | Fixed; proven by family 3, the probe rerun and a live chronology run. |
| R13-04 | Fixed; one connected journey at 700×900 and 700×620, with desktop composition preserved. |
| R13-05 | Fixed; GPU allocations plateau across six replacements. |
| R13-06 | One refinement delivered; CJ judges the art. |

## Focused transport proofs

[`tests/hapa/soundtrack.test.js`](../../tests/hapa/soundtrack.test.js) runs the actual `Soundtrack` with fixture audio, fetch and storage. Each family is one test; [results](evidence/2026-11-25/response-14/soundtrack-test-results.txt): 6/6 pass, including the three Response 13 tests.

1. **Delayed resume, then Pause** (R13-01). While the graph resume is held: Pause, then release, and no further `audio.play()` call happens. The final state is intent off, paused, and the element paused. The same holds for a new selection and for disposal during the wait. A current valid attempt still plays.
2. **One Play in every stopped state** (R13-02):
   - Ready: the first press plays.
   - A table playback error: Play retries the same recording, `skipped` is cleared, and it has not advanced after 1.7 s.
   - Finished table mix: ↻ Play again restarts at 0 (`play-again`).
   - Graph blocked: status `blocked`, same recording, not skipped after 1.7 s; one Play recovers it. A `NotAllowedError` from `play()` is classified the same way.
3. **Chronology** (R13-03). Hear 1, 2, 3, then save and browse (no new history). Replay 1, Return to 3, seek to 0: Previous selects 1. The replay list is the recency snapshot. Restart after 3 s and replay-list Previous are preserved.

The reviewer's two diagnostics were rerun unchanged against this source. Their checked-in baseline results are left as published.
- [Transport probe](evidence/2026-11-25/response-14/transport-state-probe-rerun.json): the failed and finished first clicks now play, finished playback starts at 0, and Previous selects `q1`.
- [Race probe](evidence/2026-11-25/response-14/resume-pause-race-probe-rerun.json): `stalePlayAfterPause: false`, `pausedIntentUndone: false`.

## One connected UI journey

These are live observations in the Claude desktop Browser pane against the owners above; [full record](evidence/2026-11-25/response-14/ui-journey.json). Steps marked *api* called the page's own Soundtrack or camera API; everything else was a real pointer or keyboard action.

- **First press (700×900).** One press of Play started the table song: Pause shown, 3.9 s played. Review 13 needed two presses.
- **Deck clear of the face (700×900 Home).** The compact deck sits at x 407–687, right of Red's face (face box 289–411). All six transport controls are on screen, and the nameplate sits below the deck. Review 13's deck covered Red's eyes.
- **Competing panels:**
  - With Orders open, the deck moved below the camera pad (x 13–293), with Previous and Play reachable.
  - Opening Music collapsed Orders (its History tab kept). The drawer spans 247–687, Previous is at 256 and the row Play buttons start at x 264. Review 13 had x −85..355, with controls clipped.
  - Opening the conversation collapsed Music, and the typed draft kept focus. Reopening Music restored Kept with the "lantern" filter, reopening Orders restored History, and reopening the conversation restored the draft with focus.
- **Scroll (700×620).** The Queue list scrolled natively to 92 px; Orders took the room and gave it back; the list reopened at 92 px.
- **Replacements (1440×900, *api* `startMatch`, the same call as Start match).** See [resource observations](#resource-observations).
- **Finished table song.** Play, then Next three times (real clicks), then a bounded *api* seek to 2.5 s before the end of q4. At the natural end the button showed "↻ Play again from the start". One press restarted the song, at 2.8 s three seconds later.
- **Chronology live.** History q1 q2 q3 q4, replay q1, Return to q4, seek to 0 (*api*), then Previous clicked: q1 in a "recent" replay.
- **One Ready.** Return (*api*), then Ready (real click): Tick 1 → 2, and music played on with no transport change.
- **Art views.** Normal Home, a useful orbit and close formation were inspected and captured.
- **Frame time.** Home, Subtle, playing, 6 s: mean 18.72 ms, p95 21.1, max 30.4. Response 13 measured 18.63 / 21.9 / 32 on the same pane.

The journey found three small layout defects, all corrected before the commit, and the affected steps were repeated:
- the drawer reservation arithmetic;
- nameplate clearance below the camera pad;
- the scroll restore timing.

## Resource observations

Measured with `renderer.info` after rendering, on the initial match and then after each of six replacements:

| | Initial | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GPU geometries | 1275 | 1275 | 1275 | 1275 | 1275 | 1275 | 1275 |
| GPU textures | 119 | 119 | 119 | 119 | 119 | 119 | 119 |
| Shader programs | 41 | 41 | 41 | 41 | 41 | 41 | 41 |

- **Released per replacement:** each `BoardView.dispose()` released 1,376 geometries, 1,300 materials, 204 textures, 162 sprites and 3 lights.
- **Scene state:** one scene root and four point lights after every replacement.
- **Working after replacement:** the board, seated Red and music worked afterwards (steps 8–10).
- **Before this change:** Response 13 measured about +1,100 geometries per replacement.

The plateau starts immediately because the shared caches are already warm from the first match; they persist by design. These counts come from one browser on this machine. They do not measure CPU heap.

## Visual evidence

| Capture | Shows |
| --- | --- |
| [01 Home, desktop](evidence/2026-11-25/response-14/01-home-desktop.jpg) | The revised normal Home at Tick 2 with a song playing: quieter paving, the cedar rail and brass line, and the skiff, bollard and rope beyond the far parapet. |
| [02 Orbit](evidence/2026-11-25/response-14/02-orbit-table-coast.jpg) | Rail, apron, legs, stretchers, linen runner, lantern, parapet and water. |
| [03 Close formation](evidence/2026-11-25/response-14/03-close-formation.jpg) | Close inspection of A's Queen is unchanged. |
| [04 Compact Home](evidence/2026-11-25/response-14/04-compact-home-700.jpg) | 700×900: the compact deck beside Red, with the face clear. |
| [05 Compact Music](evidence/2026-11-25/response-14/05-compact-music-open-orders-collapsed-700.jpg) | 700×900: Music open after Orders collapsed; transport and row Play are on screen. |
| [06 Compact conversation](evidence/2026-11-25/response-14/06-compact-conversation-music-collapsed-700.jpg) | 700×900: the conversation open beside Red with its draft, and Music collapsed to the compact deck. |

The pane renders the 1440 px viewport at 800 px wide, so the desktop captures are downscaled.

## Verification record

- **Focused:** `node --test tests/hapa/soundtrack.test.js`: 6/6 pass.
- **Reviewer probes:** rerun as above.
- **Integrated:** `npm run check` on the committed tree: exit 0, 158/158 tests (155 before, plus 3), bot-versus-bot smoke match, two-process peer-verified match and build ([summary](evidence/2026-11-25/response-14/npm-check-summary.txt)).
- **Hygiene:** secret scan clean; no local absolute paths in source or evidence.
- **Not repeated:** the historical gameplay, owner, Keep and retention matrix, since none of those dependencies changed. Response 13's owner evidence stands.

## Remaining limitations

- **Art is a candidate.** CJ judges whether Home now reads as an inhabited coastal table. The skiff sits at the top edge of the desktop Home frame and is partly cut by it. Lanterns and firs are still the chunky scaled library props.
- **Orders scroll restoration** is in code but was not observed live: Orders history was too short to scroll at Tick 1. Music list scroll restoration was observed.
- **Compact deck slot preference.** The deck keeps a clear slot rather than returning to the preferred one. After the Orders round trip it stayed below the camera pad, clear of the face, instead of moving back beside it.
- **Played "plays" counter.** It still counts resume-by-reload and Play again as plays (4 plays after Return and restart). The chronology itself merges consecutive repeats.
- **Activation block live witness.** The block was proven with fixtures. A real browser refusal was not triggered here, because the pane had already granted audio.
- **Response modes.** The comparison carries Response 13's limit, since most of it predates the final normalization. The response was not changed here, so there was no retune and no new comparison.
- **Excavation.** The −3 cutaway remains a selected layer over a mostly flat field; this response did not dig.
- **Memory.** CPU heap was not measured. GPU allocation counts only.

## Decisions and next handoff

- **For CJ:** at normal desktop Home, does the table now read as a crafted cedar table on a coastal quay (the paving quieter, the moored skiff and parapet establishing the coast) without pulling attention from the pieces? Should the skiff come further into frame, or stay a quiet edge cue?
- **Overwatch:** HV-65 is in Review (creation receipt `evt_1795647684373_acefc5f1`). The handoff comment citing this documentation commit is appended after it lands; its receipt is reported in the handoff to CJ. CJ moves cards to Done.
- **Stop:** this work item and its automatic continuation end with this handoff. No board-drain cycle or new enhancement is started.
