# Implementation response 11 — 2026-11-24

## Scope and source

- **CJ's requested goal and scope:** Red is seated in the game environment directly across the
  table, at believable opponent scale, using the real Harbor Mesh performer. Also the bounded
  conversation, music identity/Keep/retry and model-admission corrections of Assignment 11. No
  owner rebuild, remote music sync, library/export UI, new planner or unrelated polish.
- **Review addressed:** [Review 10](2026-11-24-ui-design-review-10.md),
  [addendum 05](../requirements/2026-11-24-human-feedback-addendum-05.md) and
  [Assignment 11](2026-11-24-next-agent-assignment-11.md), published at `4a69795`.
- **Findings addressed:** 2026-11-24 / R10-01 through R10-06.
- **Implemented commit:** `bafc36f1e40c46ab69cd8b239e6014acbc1393df` on `main`, the parent of this
  docs commit. Reconciled from `4a69795`, which fast-forwarded cleanly on top of `3b812f1`. No
  other local work existed.
- **Working tree at capture time:** the source was clean at `bafc36f`; only
  `docs/reviews/evidence/2026-11-24/response-11/` was untracked while captures were written. The
  dev server (Vite, 127.0.0.1:5199) served that tree.
- **Engine:** gitlink `ba838cca09ba43afceda0452b63d28df4cbf7f72`, unchanged. No `vendor/lumina`
  edit.
- **Effective settings:**
  - Profile `hapa_open_10x9_v3_07`.
  - Seat A human (`ui/0.2.0`). Seat B bot with Red (`red-reaper`) at the table; Red's moves were
    Model-assisted for the model witnesses and Heuristic for the others.
  - Talk mode Normal, except Quiet for the first-question witness.
  - Your tracks: Good Knight (`00428c65…`).
  - **The launch URL and preset do not carry the table choices.** They live in this browser's
    `hapa-versus.table.v1` (Red, tracks, controller) and `hapa-versus.opponent-settings.v1`
    (talk mode, voice, captions).
- **Overwatch:** board `hapa-versus`, card HV-62 (Review), with HV-61 linked. See the handoff for
  the append receipt.

### Owner revisions, as bounded source references

These are local owner checkouts. Unpublished owner code was **not** independently reviewed; the
SHA-256 digests identify the bytes that ran.

| Owner | Revision | Digest of the module used |
| --- | --- | --- |
| Harbor storefront (renderer, utterances) | `1ab09d9` (no remote) | `server/app.mjs` 13cd4684…; `puppet/red-player.mjs` 5fefa933…; renderer package red-pose-art 2026-11-02.1 from the Mesh snapshot `a6fc511`, `apps/drive/idle-motion.mjs` 3908e7be… |
| Song Registry peer music | `49a441a` (gitlab not pushed: credentials) | `src/peer-music.js` 5af73f6a… |
| Harness participant-game view | `16dc700` (pushed, calderwong/hapa-harness) | `src/game-participant.mjs` 448a991f… |

Running owner processes, all on loopback:

| Process | Port(s) |
| --- | --- |
| Harbor | 8862 |
| Red's library node | 8801 / 8802 |
| CJ's library node (restarted at `49a441a`) | 8811 / 8812 |
| Harness Versus supervisor (state `~/.hapa-harness-versus`) | 61290 |
| LM Studio, with `qwen/qwen3.8-27b` | 1234 |

## Outcome

### Red is seated across the table

A new scene attachment, `src/hapa/presentation/seated-avatar.js`, places Red beyond B's far bank
tray, on the table's long centerline, facing A. This is outside the full Card-bank, Fire Pit and
basin footprint.

- **One performer:** Harbor's RedPlayer still renders, now into an offscreen canvas. The scene
  samples it at most about 20 times a second, and only while the figure is visible, onto a
  CanvasTexture plane with a lower-edge pivot.
- **Seated relationship:** a raised far table edge hides the frame's lower edge, so his waist sits
  behind the table. An open chair (posts, finials and a rail at neck height) and a soft contact
  shadow complete it. The plane takes part in depth and is never drawn over the board.
- **Home camera:** Home now fits the board together with Red's head and shoulders, at a 46° pitch.
  Tactical, turned and close-inspection fits remain ground-only.
- **Measured at 1440×900 Home:** the plane's shoulder anchors span 229 px, against 397 px for the
  far table edge. The head-top-to-shoulder span is 19.7% of the view height, and the visible head
  and upper torso above the table edge are larger. The reviewer's baseline was a 62×78 px corner
  portrait.
- **Corner card gone:** the default view shows a small nameplate ("Red"), at most two caption
  lines, and Sound on / Mute voice / Stop beside the face, above the table edge. A transparent
  social hit target over the face opens the conversation. It is pointer-only; the nameplate is the
  keyboard route. Binding details live under "Who is playing".
- **Music:** has its own strip, top-right.

**Owner canvas contract (qualified).** The output is 673×841, readable with `drawImage`, and
updated by the owner's own frame loop — but it is **opaque**. Every owner stage uses
`alpha:false` and clears to rgb(146,146,146), even though the source art is RGBA-transparent.
- No owner transparent-background control exists. The Mesh checkout holds another agent's
  uncommitted work, so the owner was not changed.
- Instead, `matte()` removes only that exact declared clear color, and only where it is connected
  to the frame border. Clothing or skin inside the silhouette is never keyed, and the rim is
  un-blended from the known gray.
- **Owner seam requested:** a transparent-clear / alpha-output option across ReferenceMorph,
  GestureMotion and IdleRenderer.

**Limited-art orbit policy (frontal 2D rig).**
- The seat, chair and table edge are fixed in the world and visible from every side.
- The body is full within ±50° of its facing, fades and narrows through ±80°, and is not drawn
  beyond that.
- Viewed from behind the seat (110–150° and beyond), the empty chair recedes to a 0.22-opacity
  outline so it does not cover B's banks.
- Tactical pitch fades the body between 62° and 76°.
- The body also fades when the camera comes within about 18–32 world units.
- Full 360° camera control is unchanged.

**Captures from `bafc36f`:**

| View | Capture |
| --- | --- |
| Home, 1440×900 | [01](evidence/2026-11-24/response-11/01-home-1440x900.jpg) |
| 45° orbit | [02](evidence/2026-11-24/response-11/02-orbit-45.jpg) |
| 90° side | [03](evidence/2026-11-24/response-11/03-side-90.jpg) |
| Reverse (180°) | [04](evidence/2026-11-24/response-11/04-reverse-180.jpg) |
| Close inspection | [05](evidence/2026-11-24/response-11/05-close-inspection.jpg) |
| Harbor unavailable | [06](evidence/2026-11-24/response-11/06-harbor-unavailable.jpg) |
| Wide 2838×1020 | [07](evidence/2026-11-24/response-11/07-wide-2838x1020.jpg) |

### Conversation, playback/Keep and admission

These are corrected, with the witnesses below.

- **The selected Mesh performer (R10-01) is implemented and verified in the stated cases. CJ has
  not accepted it.**
- Silent reactions: the owner exposes no supported silent-expression path. With voice off, the
  figure stays present with the owner's idle motion only. A richer silent-reaction seam is a
  follow-up.

## Finding disposition

| Dated finding ID | What current inspection established | Change | Evidence and limits | Follow-up |
| --- | --- | --- | --- | --- |
| 2026-11-24 / R10-01 | Reproduced: corner card; the gray background is baked into the owner canvas | `seated-avatar.js`, `camera.js` (Home extras and pitch; tactical fits without them), `table.js`, `avatar-opponent.js` (offscreen canvas, social layer), CSS | Captures 01–07; witnesses: orbit policy, inspection → Return → Home | CJ visual acceptance; the owner alpha seam |
| 2026-11-24 / R10-02 | Confirmed in source | The repeat map is created at construction; the panel is built once, so text nodes update in place; 30 s preparation deadline with cancel; a malformed reply to the current request finishes to captions; an obsolete callback is ignored; a failed or superseded load disposes its renderer | Live: Quiet first question voiced; draft "And the music" with selection 4–7 and focus kept through preparing → speaking → idle in the same input; malformed stub finished cleanly | Deadline not exercised live |
| 2026-11-24 / R10-03 | Confirmed in source | Per-request generation fence; a committed switch detaches the old audio at once; Not listening aborts pending acquisition; resume plays the selected entry or refetches; bounded waits (20 s acquisition, 8 s start); the controller skips an unusable entry once | Live: A → Next (pending) → Not listening → Next → Listening; no wrong title or source pairing, no play after opt-out; `heard` only from actual `playing` | No live corrupt-track skip |
| 2026-11-24 / R10-04 | Confirmed in source | Keep keyed by encounter (queue entry and introducer); Retry for `keep-failed` and `download-failed-reference-saved`; `heardAt` only from real playback; owner `49a441a` reuses the same encounter's discovery and records `heard` | Live: injected failure → Retry → Available offline with 1 discovery; unheard q4 stored with `heard: false` and `heardAt: null`. Two introducers of one file: owner test only | — |
| 2026-11-24 / R10-05 | Reproduced by the supplied probe | Unfulfilled joint selections → stored fallback (`rejected-unfulfilled-choice`); boundary shape check (`rejected-malformed`); empty choices → `abstained` (fallback, not admitted); responses bound to the input digest plus exactly one recognized choice; every rejection returns the request's stored fallback; `dispose()` cancels on detach, and the fences stay | Probe rerun ([after](evidence/2026-11-24/response-11/controller-probe-after.json)); 4 new tests; live: Tick 2 `abstained`, detach → `cancelled-fallback` at 556 ms | No live response decision arose |
| 2026-11-24 / R10-06 | Wording overstated | Soundtrack and Table docs: the queue is local to this browser, not synchronized listening; Next is labelled for this table's local queue; checkpoint corrected; response-test claim fixed (respond() is now exercised by tests) | This section; [checkpoint](../integrations/IMPLEMENTATION_CHECKPOINT.md) | Remote queue, library UI and export stay out of scope |

## Independent expectation and observed result

1. **Home composition.**
   - Expected: a seated, readable Red across the table, with the board actionable (addendum 05
     §2–3).
   - Starting state: v3_07, seed 1, A human, B with Red.
   - Observed: capture 01. Red's head, face and shoulders are readable above the table edge. The
     full board and both bank rows are in view, and Ready and the banks are unobstructed.
   - Result: **pass, pending CJ's eye.**
2. **Orbit, reverse and tactical.**
   - Expected: a fixed seat, a deliberate limited-art policy, and tactical favoring the board.
   - Observed: Q ×1 (45°): full figure, sliding with projection toward the frame edge. Q ×2 (90°):
     body at 0.48, narrowed. Q ×4 (180°): no body, chair at 0.22. V: body fading as the pitch
     rises, and the fit is the board only.
   - Result: **pass.**
3. **Inspection → Return → Home.**
   - Expected: unit details own the close view; Return restores the prior pose; Home restores the
     composition.
   - Observed: A's Queen inspected at distance 25.6 without the opponent, social layer docked.
     R restored the prior pose. From a turned and zoomed pose (yaw −45°, distance 157.9), R
     restored exactly that pose. Home returned to yaw 0, pitch 46°, distance 255.4.
   - Result: **pass.**
4. **Conversation:** see R10-02. **Pass;** the deadline path is untested live.
5. **Music switch and listening:** see R10-03. **Pass.**
6. **Keep:** see R10-04. **Pass;** the two-introducer case is owner-test only.
7. **Model boundary.**
   - Joint-funding, malformed and response-hash probes now behave correctly.
   - Live model-assisted match: Ticks 1, 3 and 4 admitted (2.3–4.7 s), Tick 2 abstained.
   - Detach during a request gave `cancelled-fallback`.
   - The replay contains no provider data.
   - Result: **pass.**
8. **Connected owner.**
   - One real bound performance: the Quiet answer, clip `clip-46377465…`, 10.3 s preparation.
   - Owner playback and Keep through the live nodes.
   - Harbor stopped: text-only, empty chair, and Ready still advanced Tick 1 → 2 (capture 06).
   - Result: **pass.**

## Visual evidence

- **Browser:** the Claude desktop built-in browser pane (Chromium) on macOS 26 (Darwin 25.2),
  using viewport emulation. Captures were downscaled by the pane to 800 px wide.
- **Viewports:** 1440×900 (captures 01–06) and 2838×1020 (capture 07, the reviewer's wide layout).
  Device pixel ratio as the pane provides; browser zoom 100%.
- **Camera:** Home yaw 0, pitch 46°, distance 255.4 at 1440×900. Orbit steps use Q (45°).
  Layer: All.
- **Before:** Review 10's text measurement only (62×78 px portrait); no before image is published,
  as in review 10.
- **After:** captures 01–07 from `bafc36f`.

## Verification record

| Command or manual check | Revision / environment | Actual result | What it establishes and what remains untested |
| --- | --- | --- | --- |
| `npm run check` | `bafc36f` candidate (run just before commit, same tree) | exit 0; 154 ✔ | Required gate. Includes the full test suite, the two-process peer match and the build |
| `node --test tests/hapa/model-decider.test.js` | candidate | 10/10 | Includes the new joint-funding, malformed/abstained, response-binding and dispose cases |
| Review 10 controller probe (stdout only) | candidate (dirty: these edits) | funding `rejected-unfulfilled-choice`; response `rejected-mismatched-receipt`; empty `abstained`; missing/non-array `rejected-malformed`; all equal the stored fallback | The supplied witnesses |
| Song Registry `node test/peer-music.test.js` | `49a441a` | all passed | Encounter idempotency and distinct introducers, with existing coverage |
| Short changed-journey playtest | `bafc36f`, live owners | see `witnesses.json` | Home, orbit, inspection, conversation, music, Keep, model, owner-down. Not repeated: the 34- and 111-Tick campaigns or the historic browser contracts |

## Remaining limitations

- **Owner art:** opaque output; the consumer matte is interim. No side or back views, no silent
  reactions, no seated pose; the waist is hidden by the table edge.
- **Composition:** the ratios are starting fits, and CJ decides them. Red can leave the frame
  during orbit, by design.
- **Voice:** preparation takes about 10 s per line. Captions show immediately; lines older than
  35 s are not played.
- **Settings:** the table choices are not in the URL or preset.
- **Untested live:** the music skip after an unusable track, the voice-preparation deadline, a
  model response decision, and two introducers of one file.
- **Music scope:** the queue is local to one browser. Retained songs are an API, not a library or
  export UI.
- **Not investigated:** the earlier 111-Tick idle model match.
