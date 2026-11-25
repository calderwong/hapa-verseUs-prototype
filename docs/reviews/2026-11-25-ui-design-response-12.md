# Implementation response 12 — 2026-11-25

## Scope and source

- **Goal and scope:** Assignment 12 closes three bounded interaction boundaries: conversation gestures and placement, superseded music-resume callbacks, and malformed model-reply settlement. The seated Red composition, Avatar assets, gameplay, owner boundaries and one-Ready flow are preserved unchanged.
- **Review addressed:** [Review 11](2026-11-24-ui-design-review-11.md) and [Assignment 12](2026-11-24-next-agent-assignment-12.md), published in `2ebd1de`. They review implementation `bafc36f` at source head `7d4a96b`.
- **Findings addressed:** R11-01, R11-02 and R11-03.
- **Reconciliation:**
  - I fast-forwarded the local `main` from `7d4a96b` to `2ebd1de`.
  - Before that, the working tree was clean and had no later local commits.
  - No other agent's work was present in this checkout.
- **Implementation:** commit `4dc271d506e97c83836dbc108ad3804f30cdcc81` (tree `dcd3eba68a383ff2bc3aa263d40a5379d5607b08`), parent `2ebd1de`. This documentation and evidence follow in the next commit.
- **Engine gitlink:** `vendor/lumina` stays at `ba838cca09ba43afceda0452b63d28df4cbf7f72`, unchanged.
- **Default profile:** `hapa_open_10x9_v3_07`, unchanged.
- **Overwatch:**
  - New card HV-63 is in Review, as the successor to HV-62.
  - Append receipt: `evt_1795594969965_15dc37fe` (details in the [handoff section](#handoff)).
- **CJ acceptance:** not recorded.

### Source identity (complete SHA-256)

**Versus, at `4dc271d`.** The working tree matched the commit for the final journey steps (see the [UI journey](evidence/2026-11-25/response-12/ui-journey.json)).

| File | SHA-256 | Git blob |
| --- | --- | --- |
| `src/hapa/presentation/table.js` | `53f53b2ead6f003800a73d670bdac3b128e5f56145f1444a9381e9c4c52d5612` | `b3eddf5f` |
| `src/hapa/presentation/versus.css` | `83163c6cc05fcf62238249de9451f430e5b1c8d62941bd360c52f418031ee96a` | `eb2c73e3` |
| `src/hapa/presentation/soundtrack.js` | `c08b4d17c42d4ef9f8a2e7b2904318377fdd240809557dc6d517192f6da8f5d8` | `813ba478` |
| `src/hapa/controllers/model-decider.js` | `e656a5016cf66ef2b02c2189e2f1278eb68fd577c33b19eb70bfeff7ffe50e72` | `990b11b5` |
| `tests/hapa/model-decider.test.js` | `51cf3d038ff7fb4e5840cb8cba40c4437e7bd9dc8d0096aa09223dc05994985a` | `9223349f` |

These files are unchanged from `bafc36f` (preserved composition):

| File | SHA-256 |
| --- | --- |
| `seated-avatar.js` | `911432deaffad01db074a7b93aeee7e2771791bbfd6039e320b0de45ef77fb33` |
| `avatar-opponent.js` | `812ab5837903a914fb6cfb5583d63771f78ad4f06d78701a0fc855087660dee4` |
| `camera.js` | `1723754c44f0a72e683a3facadacadd2610363b25fcd66579845863588c21a8a` |

**Owner modules.** These are read only; no owner was changed in this response.

| Owner module | SHA-256 | Checkout state | Running process |
| --- | --- | --- | --- |
| Harbor `server/app.mjs` | `13cd468410ac505883a5a0a8ed3f9fd3b4a2561d2a7292d1842167a046237687` | HEAD `1ab09d9`, clean | Port 8862. The process started at 19:01 on 24 Nov, after the file's 16:53 mtime. |
| Harbor `puppet/red-player.mjs` | `5fefa933fa13773680e1a34df3ba10971849987d37ffd74fca961107f8f4c57c` | clean | Same process. The file's mtime is 2 Nov, before the process started. |
| Mesh renderer pin `apps/drive/idle-motion.mjs` (Harbor `data/red-renderer-pin-a6fc511/`, ignored local data) | `3908e7be6805c4e5c01033cad0aa88a3edc0c0cd64c4fdf0e8e1d8ea2fe3f2e1` | Untracked pinned snapshot | Served by Harbor as static files to the page. |
| Song Registry `src/peer-music.js` | `5af73f6ae229782da4796a5a7bfed1fd7a23d9d426f65db0ba27203ae06f6e1a` | HEAD `dadb049`, clean; identical to `49a441a` | **CJ's node** (port 8811, the Keep listener) started at 18:57, after the file's 18:41 mtime, so it runs these bytes. **Red's node** (port 8801) started at 17:16, before that mtime, so it runs the earlier peer-music bytes. Red's node only contributes and serves audio. |
| Harness `src/game-participant.mjs` | `448a991f4e71515c0e9255e54dbfb12b3cb4d6c9aa332878f18b0cfd9e242e32` | HEAD `16dc700`, clean | Port 61290. The process started at 17:27, after the file's 17:20 mtime. |

**What "running process" means.** A process-start time later than a file's mtime establishes which bytes were on disk at startup. It is not an in-memory hash.

## Outcome

### R11-01: The conversation owns its gestures and fits the screen

**Gestures.**
- The social layer and the music strip now stop `pointerdown`, `wheel` and `contextmenu` from reaching the board. This is the same rule the inspection view already uses (`inspect.js`).
- Selecting draft text, scrolling the history and dragging the volume slider no longer pan, orbit or zoom the camera.
- Gestures that start on the exposed board are unchanged, and the conversation stays open meanwhile.

**Placement.** `Table.update` now places the layer from its actual measured size, read by a `ResizeObserver`. It no longer uses a fixed 260 px reserve.

- **Free area:** inside the world, clear of open drawers (`--free-l` / `--free-r`), and below the music strip where they would meet.
- **Position order:**
  1. To the right of the face.
  2. Otherwise to its left.
  3. Otherwise an expanded panel docks top-right below the music strip. A collapsed nameplate still clamps beside the face.
- **Width:** capped to the free area.
- **Height when squeezed:**
  1. The history shrinks first.
  2. Then the panel scrolls.
  3. The question field, Talk settings and the nameplate (the collapse route) stay reachable.
- **Unchanged:** the collapsed nameplate and caption, Escape and the nameplate keyboard route, focus, and the draft.

### R11-02: A superseded resume cannot fail the current song

**Binding.** `_resume()` binds each attempt to its entry and its generation. A shared `_current(gen, entry)` check requires all of the following:
- the same generation;
- still listening;
- not disposed;
- the same selected entry.

Every resume and load completion path now uses this check.

**Start policy.** A shared `_play()` applies the existing finite start policy (`START_MS`, 8 s) to resume as well as initial playback, and always releases its timer.

**Results.**
- A late rejection after Next, Not listening or disposal changes nothing.
- A still-current failure or timeout reaches the existing one-skip policy.

There is no retry loop. Queue authority, listening preference, heard evidence and Keep identity are unchanged.

### R11-03: A malformed model wrapper settles through the stored fallback

**Validation first.** `_ask()` validates the outer reply before anything completes. Any HTTP 200 body that is not a JSON object rejects as `malformed-reply`:
- `null`;
- a list;
- a number;
- a string;
- unparsable text.

The rejection carries a descriptive message, for example "malformed harness reply (null)". The same validation covers non-OK bodies, so `null` there can no longer throw on a property read.

**One settlement.** Every outcome settles once through the single settlement path:

| Outcome | Receipt |
| --- | --- |
| Malformed reply | `rejected-malformed-reply`, with the request's stored frozen fallback (plan) or prepared counter (response) |
| Unavailable | unchanged |
| Deadline | unchanged |
| Cancelled | unchanged |

**Preserved.**
- The settlement handle is now also removed on failure.
- Late-reply interpretation is shared. A malformed late reply rejects quietly, with no unhandled rejection and no admission.
- Request and input binding, fencing, deadlines and `dispose()` cancellation are unchanged.

## Finding disposition

| Finding | Current inspection | Change | Evidence and limits | Follow-up |
| --- | --- | --- | --- | --- |
| R11-01 | Reproduced from source: `BoardCamera._bind` excludes only buttons, the rail and the pad; the wheel is unconditional; the 260 px reserve sits against a 300 px panel; there is no bottom bound | `table.js` (gesture ownership, measured placement, docking, music-strip exclusion), `versus.css` (max width/height, shrinking history, panel scroll) | Live [UI journey](evidence/2026-11-25/response-12/ui-journey.json), steps 1–10, and three captures. Placement was observed at three sizes, near the right edge, and docked. | None in scope |
| R11-02 | Reproduced: Review 11's probe at `7d4a96b` | `soundtrack.js` (`_current`, `_play`, bound `_resume`) | Review probe rerun: `reproduced: false` ([after](evidence/2026-11-25/response-12/music-resume-stale-after.json)). [Companion probe](evidence/2026-11-25/response-12/music-resume-current-probe.mjs): current failure, current timeout, success and disposal all pass ([result](evidence/2026-11-25/response-12/music-resume-current-after.json)). One live ordinary resume. | None in scope |
| R11-03 | Reproduced: Review 11's probe | `model-decider.js` (wrapper validation, `notArrived`, settlement on failure); 2 new tests | Probe rerun: settled, `rejected-malformed-reply`, no unhandled errors, 0 handles ([after](evidence/2026-11-25/response-12/model-null-response-after.json)). [12/12 targeted tests](evidence/2026-11-25/response-12/model-decider-test-results.txt). | None in scope |

## Independent expectation and observed result

### R11-01: conversation

**Expected (Review 11 §5 and Assignment 12 §1):**
- Panel input, selection and scroll never move the camera.
- Board gestures still work.
- The expanded panel stays reachable at edges and on resize.

**Starting state:**
- A human; B bot with Red; Red's moves model-assisted (the remembered setting).
- Seed 1, v3_07, Tick 1 Planning, at Home.

**Observed (pass, from the [journey](evidence/2026-11-25/response-12/ui-journey.json)):**
1. **Drag-select:** selection 3–41 while Red's projected face stayed at the same position. The drag ended outside the panel.
2. **History wheel:** scrolled 135 → 0, with the camera unchanged.
3. **Board wheel and drag:** both zoomed and panned while the conversation stayed open with its draft.
4. **Right edge:** the panel flipped to the face's left side.
5. **900 × 420:** the panel stayed inside, and the draft was kept.
6. **900 × 300:** the history shrank to 34 px.
   - The first pass showed the "Who is playing" line spilling below the panel. I corrected it with `overflow-y: auto` on the squeezed panel and re-observed it.
7. **Turned 90°:** docked below the music strip.
8. **Keyboard:** Escape returned focus to the nameplate; Enter reopened the panel with the draft.

### R11-02: resume

**Expected (Review 11 §5):**
- A stale resume never changes the selection or listening intent.
- A current failure follows the finite policy.

**Observed in the deterministic VM probes (pass):**

| Case | Result |
| --- | --- |
| Not listening, then the old promise is rejected | Selection A, listening off, no skip. The 8 s start timer is released. |
| Next, then the old promise is rejected | B stays selected and loading, nothing skipped. |
| Current rejection | A failed, then skipped to B after 1.5 s. |
| Current play never settles | Fails at 8 s with "playback did not start", then skips to B. |
| Current success | Playing; no timers left. |
| Disposed, then rejected | No change; no warnings. |

**Observed live (pass, UI state):**
- Sound on played Red's first track.
- Not listening → Listening resumed it.
- 11 s later, past the start deadline, the same entry was shown with no failure label or skip.

### R11-03: model wrapper

**Expected (Review 11 §5):**
- A finite settlement through the exact stored fallback.
- A truthful receipt.
- No unhandled rejection.

**Observed (pass):**
- **New plan test:** five wrapper bodies (`null`, `[]`, `7`, `'text'`, unparsable). Each case:
  - settled within 150 ms;
  - returned the frozen stored fallback, equal to an independent heuristic plan;
  - produced exactly one `rejected-malformed-reply` receipt;
  - consumed nothing and left 0 inflight or settlement handles.
- **New response test:** returned the prepared counter.
- **Late `null` after a 30 ms deadline:** `deadline-fallback` and a cancel request, then quiet. It added no receipt and no unhandled rejection.

## Visual evidence

**Environment:**
- Browser: Claude desktop Browser pane (Chrome/156.0.8078.100), macOS, devicePixelRatio 1, default zoom and text scale.
- Viewport: 1357 × 1106 CSS px (world 1349 × 1016), plus emulated 900 × 420 and 900 × 300.
- Scenario: seed 1, v3_07, Tick 1 at Home.
- Captures: browser-tool JPEGs downscaled to 800 px wide. Image hashes were not recorded.

**New captures (live, working tree = `4dc271d`):**
- [01 — Home with the conversation open](evidence/2026-11-25/response-12/01-home-conversation-open.jpg). The panel sits beside Red's face and clear of the music strip.
- [02 — Turned 90°, docked](evidence/2026-11-25/response-12/02-turned-docked.jpg). The open conversation docks top-right below the music strip.
- [03 — Resized to 900 × 420](evidence/2026-11-25/response-12/03-resized-900x420.jpg). The panel moves to the face's free side, fully inside the world.

**Reused (unchanged dependencies):** the response 11 seated-composition, close-inspection, owner-down and wide captures in [response-11 evidence](evidence/2026-11-24/response-11/). `seated-avatar.js`, `avatar-opponent.js` and `camera.js` are byte-identical to `bafc36f`.

## Verification record

| Check | Revision / environment | Actual result | Establishes / untested |
| --- | --- | --- | --- |
| `npm run check` (required final gate) | Integrated working tree = `4dc271d`, Node 25.2.1 | **Exit 0.** Rules tests 152/152, bot-versus-bot smoke match, two-process peer-verified match (50 Ticks, peers agree) and build all ✔ ([summary](evidence/2026-11-25/response-12/npm-check-summary.txt)). | Rules, replay, peers, build and the targeted host tests. Not gameplay feel or visuals. |
| `node --test tests/hapa/model-decider.test.js` | `4dc271d` | 12 passed, 0 failed: the 10 existing tests plus 2 new ones | Admission, response, detach and the new wrapper cases |
| Review 11 `model-null-response-probe.mjs` | `4dc271d`, fetch stubbed | Settled; `rejected-malformed-reply`; no unhandled errors | Planning path; no live Harness `null` |
| Review 11 `music-resume-probe.mjs` | `4dc271d`, VM | `reproduced: false` for both cases | Stale callbacks only |
| Response 12 `music-resume-current-probe.mjs` | `4dc271d`, VM | `allPass: true` (4 cases) | Current failure, timeout, success, disposal; not browser timing |
| Live UI journey | Vite on 5199, Browser pane | Steps 1–12 pass, with one correction in step 8 | Gestures, placement, keyboard, one Ready, one ordinary resume |

**Historical metadata.** Response 11's `controller-probe-after.json` has a trailing `evidence` block with `respond: 0` and 111-Tick aggregates. That block is inherited baseline metadata from `3b812f1` and does not describe the current tests. The current targeted result is the 12/12 above.

## Remaining limitations

**What was not observed live:**
- A live Harness `null` reply, or a live response window, with a malformed reply.
- A browser-timed race of a pending resume against Next or Not listening; that interleaving is proven in the VM only.
- Audible output of the resumed track, which was not measured independently.

**Disclosed side effect.** During the live resume check, one click landed on **♡ Keep** after the music strip re-laid out. That kept Red's track "Untitled — 'We kept a lantern by the water'" to CJ's local library node, which shows it as Available offline. It was not reverted; CJ can remove it from that library if wanted.

**Strip layout shift.** The shift itself (the "not listening" label pushes the buttons) is a small existing usability rough edge. It is not changed here.

**Inherited from the earlier responses:**
- Red's library node runs pre-`49a441a` peer-music bytes (see Source identity). Keep goes to CJ's node, which runs the current bytes.
- The local-browser queue, local-only peer topology, the owner's opaque canvas matte and the startup pre-fit frame remain as described in response 11.

**Deferred, as instructed:** art and lighting cohesion, Avatar side/back art, remote music synchronization, a library/export UI, and playing strength.

## Handoff

- **Overwatch:** `task_created` HV-63 in Review on board `hapa-versus`, actor `claude-code`. Receipt `evt_1795594969965_15dc37fe` at 2026-11-25T08:22:49.965Z. HV-62 remains in Review for CJ.
- **Inspect next:**
  - Commit `4dc271d` and this document.
  - The [response-12 evidence](evidence/2026-11-25/response-12/).
  - Try: open Red's conversation, select text in it, scroll its history, then use the board.
- **CJ acceptance:** not yet recorded.

This work item ends here.
