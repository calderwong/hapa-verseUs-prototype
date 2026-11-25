# Review 11 — Keep the seated opponent and finish the interaction boundaries

**Date:** 24 November 2026 (America/Los_Angeles)  
**Repository:** calderwong/hapa-verseUs-prototype  
**Reviewed main:** `7d4a96bd753f8b0e79ac46e3ad0c1e206e54ea36`  
**Implementation under review:** `bafc36f1e40c46ab69cd8b239e6014acbc1393df`  
**Engine gitlink:** `ba838cca09ba43afceda0452b63d28df4cbf7f72`, unchanged  
**Default profile:** `hapa_open_10x9_v3_07`, unchanged

## 1. Decision

**The seated-opponent direction has landed. Preserve it.** Red now occupies a place across the table, has readable head-and-torso presence, and participates in the scene's perspective and occlusion. This is a substantial improvement in the relationship between the human, the board and the opponent. The next work is a small completion pass around conversation input and two asynchronous failure cases. It does not require another scene redesign, a new Avatar renderer or another broad qualification campaign.

The prior conversation, track switching, Keep and model-admission corrections are mostly supported by the new source and evidence. Three bounded findings remain below. They are separable from CJ's aesthetic acceptance and from the larger, still-unbuilt remote music discovery experience.

**Recommended next step:** [Assignment 12](2026-11-24-next-agent-assignment-12.md). Complete its three repairs together, verify the changed journeys, publish one response and hand off. No new design decision is required before that work.

## 2. What was examined

- Exact pushed source at the reviewed commit, the change from the Review 10 publication, the implementation response, its seven submitted captures and its structured witnesses. The six changed Avatar/scene source blobs examined are identical between `bafc36f` and the reviewed head. Relevant rules and test dependencies were reused only after byte verification against the pinned tree.
- A fresh local browser journey at `http://127.0.0.1:5199/versus.html`, in a separate temporary tab: A human, B heuristic bot with Red, profile v3_07, seed 1, Home, a 45-degree orbit, tactical overhead, opening conversation, editing/selecting an unsent draft, wheel input over that conversation, and one Ready transition from Tick 1 to Tick 2.
- Ten existing targeted model-decider tests, all passing, and one additional source-only probe for a successful HTTP reply containing JSON `null`. A separate focused music probe accompanies the evidence record. No model inference, song retention, voice request or long match was initiated by the reviewer.

The fresh browser viewport was 2838 × 1076 CSS pixels; the observed world canvas was 2828 × 984. The live app did not expose its source commit, so live behavior is reported separately from verified repository bytes. The implementer's captures identify their own running candidate as `bafc36f`, source clean except for capture evidence. The reviewer did not independently inspect unpublished owner checkouts or current Overwatch state.

See the [evidence and reproduction record](evidence/2026-11-24/review-11/README.md), [implementation response 11](2026-11-24-ui-design-response-11.md), and [submitted witnesses](evidence/2026-11-24/response-11/witnesses.json). The submitted full `npm run check` reports exit 0 and 154 passing tests; that full gate was not rerun during this review.

## 3. Design assessment

### Keep the new spatial relationship

The far table edge, chair and partial torso occlusion make Red legible as the opponent at this table. The Home composition includes his head and shoulders with the board and banks. In the fresh live view, his position reads immediately without opening a panel. The separate music strip and small adjacent nameplate/caption also preserve that relationship. This is the central improvement CJ requested.

The implementation uses one Harbor performer, samples its output onto a scene surface, and leaves the rules independent of it. Preserve this ownership. The temporary consumer matte is an acknowledged response to the owner's opaque gray output; it is not a reason to replace the connected performer or re-author the Avatar during this repair pass.

### Keep camera freedom and deliberate absence

The seat remains fixed while the camera rotates. A frontal asset cannot supply a convincing side or back view, and this build explicitly fades/narrows it at oblique angles. During the fresh orbit, Red could leave the frame; tactical overhead favored the board and docked the small social UI. Those behaviors follow addendum 05. Do not make the body chase the camera or constrain 360-degree rotation to keep it visible.

Fresh startup briefly showed the pre-fit frame while attachment initialized, then settled automatically into the intended composition without pressing Home. The review does **not** classify startup framing as a defect. Submitted close-inspection and Return evidence is retained; there was no need to repeat every camera witness.

### The next visual opportunity is cohesion

My aesthetic judgment is that the current photographic face and bright shirt still sit somewhat apart from the pixel environment. The next art pass can improve shared light, color temperature, edge treatment and the chair/table contact. Preserve the selected Avatar's likeness and owner assets. There is no demonstrated current-art matte defect that warrants a new owner rebuild now.

Some fresh views were quite dark while HUD text stayed bright. A future visual pass should establish a useful minimum light/contrast level for units, borders and Card banks across environmental lighting. The lighting cause was not isolated here; this is an observation, not a verified new lighting regression or an Assignment 12 blocker.

The wide Home view spends considerable width on the surrounding forest. That is acceptable for the social/table composition, but future tuning should compare actual board readability with the seated experience at a normal desktop size. Avoid turning a target portrait ratio or decorative coordinate into a gate. The present composition is strong enough to preserve while these interaction repairs are completed.

## 4. Disposition of Review 10

| Prior finding | Current evidence and conclusion |
| --- | --- |
| **R10-01 — Seated scene opponent** | Implemented: stable scene seat beyond the banks, torso/table occlusion, chair/contact treatment, Home bounds and explicit orbit/tactical behavior. Fresh Home/orbit/tactical inspection supports the direction. CJ's aesthetic acceptance remains separate. |
| **R10-02 — Conversation and performer lifecycle** | The first-question Map, draft-preserving DOM, finite preparation deadline and malformed-current-reply finish path are present. The submitted Quiet question/draft/malformed-reply witnesses support those fixes. The new gesture issue is R11-01 below; it does not invalidate the prior fixes. |
| **R10-03 — Playback identity and listening** | Original track-switch and pending-acquisition opt-out paths are corrected and have a submitted live witness. The related resume-rejection boundary remains under R11-02. |
| **R10-04 — Keep retry and discovery identity** | Both failure states now expose a working retry path; the consumer keys state by queue encounter and records heardAt only from actual matching playback. One retry and an unheard save are witnessed. Two introducers of one asset are owner-test evidence, not a fresh live two-introducer journey or an independent audit of unpublished owner code. |
| **R10-05 — Admission and cancellation** | Original joint-funding, malformed choices, response binding and detach cases are corrected. All ten targeted tests pass here, including actual respond() tests. A separate malformed outer-wrapper case remains under R11-03. No claim of a fresh live model response is made. |
| **R10-06 — Accurate scope and source reporting** | Local-browser queue and retained-owner API scope are now described accurately. Remote synchronized listening and a library/export/re-sharing UI remain unbuilt. Owner digests are abbreviated in the report; use full checksums in the next handoff. |

Historical Assignment 10 gameplay repairs retain their prior technical closure. The fresh single Ready advanced to Tick 2 without another confirmation. This is a useful connected smoke observation, not a rerun of historic gameplay qualification.

## 5. Findings for the next bounded pass

### R11-01 — P2: Conversation gestures move the board; expanded conversation can exceed its placement bounds

**Player context.** A player opens Red's conversation to read it or select text in the question field. Those actions belong to the conversation. At present they can also pan or zoom the table beneath it, making a social interaction disturb the player's game view.

**Fresh reproduction.** At Home, open Red's nameplate, type an unsent draft, then drag across its text. The text selection changed and Red's projected nameplate moved horizontally from approximately 1541.1 to 1664.8 CSS pixels in the same action. Scrolling over the conversation also zoomed the board substantially. The draft was cleared afterward; no question was submitted.

**Source.** `BoardCamera._bind()` excludes buttons, the height rail and camera pad from pointer-down drags, but not the conversation input or history. Its wheel handler unconditionally prevents the default action and performs camera zoom. The board-command canvas guard prevents this from being a move order; it does not protect camera input. See [camera input](https://github.com/calderwong/hapa-verseUs-prototype/blob/7d4a96bd753f8b0e79ac46e3ad0c1e206e54ea36/src/hapa/presentation/camera.js#L228) and [conversation DOM](https://github.com/calderwong/hapa-verseUs-prototype/blob/7d4a96bd753f8b0e79ac46e3ad0c1e206e54ea36/src/hapa/presentation/avatar-opponent.js#L265).

**Related placement defect, source-confirmed.** `Table.update()` reserves 260 pixels at the right edge, but the expanded conversation is 300 pixels wide. At that clamp it can extend about 40 pixels into the world's clipped region. There is no corresponding bottom-edge clamp. The exact edge case was not independently reproduced live. See [placement](https://github.com/calderwong/hapa-verseUs-prototype/blob/7d4a96bd753f8b0e79ac46e3ad0c1e206e54ea36/src/hapa/presentation/table.js#L81) and [panel CSS](https://github.com/calderwong/hapa-verseUs-prototype/blob/7d4a96bd753f8b0e79ac46e3ad0c1e206e54ea36/src/hapa/presentation/versus.css#L634).

**Required result.** Social UI owns its pointer, selection and scroll gestures. Scrolling its history works normally. Board pan/zoom/orbit still works when initiated on the board. Fit the actual expanded surface inside the available game viewport, or dock it when it cannot fit near the face. Keep the input, settings and close/collapse route reachable at screen edges and during resize. Preserve the compact collapsed presentation and existing keyboard access. Reuse the game's overlay conventions rather than adding a second interaction architecture.

**Enough evidence.** One short live sequence that selects draft text, scrolls history, checks camera gestures on the exposed board, and opens the conversation near an edge. Record the observed outcome; decorative coordinate assertions are unnecessary.

### R11-02 — P2: A superseded music-resume failure can mark the current song failed and skip it

**Player context.** The player resumes a paused song, then chooses Not listening or Next before the browser finishes starting playback. A late failure from that abandoned resume attempt must not change the player's new selection or opt-out.

**Source.** `_load()` now fences superseded work correctly. `_resume()` increments the generation but its rejection callback calls `_fail(this.now, ...)` later, without capturing the resumed entry/generation. That callback can therefore target whichever song is current at rejection time. `_fail()` marks it failed and, for the queue controller, schedules a skip. The resume path also lacks the bounded start wait already used by initial playback. See [resume and failure handling](https://github.com/calderwong/hapa-verseUs-prototype/blob/7d4a96bd753f8b0e79ac46e3ad0c1e206e54ea36/src/hapa/presentation/soundtrack.js#L179).

**Independent reproduction.** A controlled pending `Audio.play()` promise exercised the actual pinned Soundtrack methods. After Not listening, rejecting the old resume marked A failed and advanced the queue to B. After Next selected B, rejecting A's old resume marked B failed and advanced to C. The probe explicitly fired the scheduled 1.5-second skip and made zero network requests. These are deterministic lifecycle reproductions, not a live audio-owner timing claim.

**Required result.** Bind each resume attempt to its exact entry and generation. Ignore late success/failure from superseded, opted-out or disposed work; only a still-current attempt may fail its own entry. Apply the existing finite start policy to that attempt. Preserve the existing queue authority, local listening preference, heard evidence and Keep identity. Do not add a retry loop.

**Enough evidence.** A controlled pending-play promise, then Not listening or Next, then rejection of the abandoned promise. The selected entry, listener intent and queue must stay correct. Also establish that a genuinely current start failure terminates through the existing bounded policy. The [evidence folder](evidence/2026-11-24/review-11/README.md) distinguishes the local probe from actual audio playback; this review does not claim the race occurred against the live music owner.

### R11-03 — P2: A successful HTTP reply containing JSON null can bypass the model deadline and leave the bot waiting

**Player context.** The optional model-controlled opponent promises to fall back when its decision service fails or responds badly. A malformed transport reply must not hold planning or a response window open indefinitely.

**Independent reproduction.** The pinned controller was given a stubbed HTTP 200 reply whose parsed JSON was `null`, with a 20 ms planning deadline. After a 150 ms observation guard, the decision promise was still unsettled. There was an unhandled null-property error, no fallback receipt, and both request-handle collections were empty. No real Harness or model request was made.

**Source.** The arrival callback marks the request done, removes its settlement handle and clears the deadline before reading `j.proposal`/`j.receipt`. Dereferencing `null` throws after the recovery path has been disabled, leaving the outer promise unresolved. Both planning and response decisions use `_ask()`; the probe exercised planning only. See [reply settlement](https://github.com/calderwong/hapa-verseUs-prototype/blob/7d4a96bd753f8b0e79ac46e3ad0c1e206e54ea36/src/hapa/controllers/model-decider.js#L84).

**Required result.** Validate or normalize the outer reply before completing the request. Every reply-interpretation error must settle exactly once through a truthful failure path, returning the request's already-prepared fallback. Keep request/input binding, cancellation, late-reply fencing and authoritative deadlines intact. Include the shared late-reply interpretation path in this small correction; do not build a new planner or recompute a second fallback.

**Enough evidence.** Add the `null` success-wrapper case to the existing targeted tests, checking finite settlement, exact stored fallback and a truthful receipt without an unhandled rejection. Reuse the existing response/admission coverage and run the required final gate at the integrated candidate. The source ordering establishes the hang; the short probe is not merely evidence of a slow request. No claim is made that the live Harness currently returns `null`.

## 6. Evidence corrections and limits

The next response should record full owner module SHA-256 values or another complete source identity, with clean/dirty state and whether the bytes match the running process. Prefixes followed by an ellipsis help a human recognize a revision but do not identify exact bytes. This is a handoff correction; it does not require publishing private owner source or changing the owner services.

The submitted `controller-probe-after.json` contains new results in `probes`, alongside an inherited trailing `evidence` block with the old `respond: 0` count and 111-Tick aggregates. Treat that trailing block as historical. Current tests exercise `respond()` and passed in this review. In the next response, clearly label inherited metadata or point directly to the new targeted result; preserve old evidence rather than rewriting history.

The report says to consult a handoff for an Overwatch append receipt, but the review did not independently read that board. The local agent should include the actual receipt/link, or clearly state if updating it was unavailable. Do not equate an implementation report, passing tests or this review with CJ accepting the work to Done.

## 7. Stop condition

The next candidate is complete for review when R11-01 through R11-03 are corrected, the small changed journeys are observed, the required integrated gate passes, and one accurate response is published. Reuse unchanged R10/R11 evidence. Defer the next art/lighting pass, remote music sharing, a retained-library UI, Avatar side/back art and playing-strength experiments to an explicitly selected later goal. End this work item after the handoff.

