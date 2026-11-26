# Visual, aesthetic and animation review — 26 November 2026

**Supplement to [Review 16](2026-11-25-desktop-p2p-review-16.md) and [Assignment 17](2026-11-25-next-agent-assignment-17.md).** CJ requested this additional review after the unpublished desktop/P2P handoff was recovered. The reliability assignment remains current. This document supplies visual findings and recommended feature direction; the accompanying [feature brief](2026-11-26-visual-animation-feature-brief.md) groups the work into a bounded next pass.

## Assessment

The strongest foundation is the physical table and the person across it. The cedar/slate construction, warm practical lights, coastal setting, seated Red and compact music deck give Versus an identifiable place. Preserve that composition and the board-first interaction built in the earlier reviews.

The next improvement should make three things work together: **a clearer invitation to play, a more coherent Hapa material treatment, and actors whose movement explains the accepted events.** The present source has useful movement and effects, but the figures themselves are restricted to idle/walk. A few presentation timing connections also need repair before more elaborate choreography can be reliable.

The most consequential new finding is a reproduced omission at the end of a moving Tick: eight authoritative events were generated, but the presentation timeline exposed only five. The result and recorded rules history remain intact; the missing segment affects how the actions are revealed.

## Baseline and evidence

| Item | Reviewed identity |
| --- | --- |
| Repository head | [`bd66817326c6966d28c73b4cc06a144551077a1b`](https://github.com/calderwong/hapa-verseUs-prototype/commit/bd66817326c6966d28c73b4cc06a144551077a1b), the documentation recovery commit |
| Underlying implementation candidate | `532643846f815106f7e33551099d02008e03c4d2`, as recorded by Response 16 |
| Engine | `calderwong/lumina-hapa` at `ba838cca09ba43afceda0452b63d28df4cbf7f72` |
| Gameplay profile | `hapa_open_10x9_v3_07` |
| Direct evidence from this review | Pinned source inspection and one executable headless rules/presentation diagnostic |
| Visual evidence | Nine existing repository stills from Responses 13–16; each retains its original provenance |
| Observation limit | No fresh running browser or installed Mac app was available. Timing, smoothness, performance and final aesthetic acceptance were not observed live. |

The [evidence notes](evidence/2026-11-26/visual-animation/README.md) and [source register](evidence/2026-11-26/visual-animation/source-register.json) identify the files and captures. Older stills establish visible composition in their submitted candidates; they do not prove that every pixel is unchanged in the current installed app. Findings below distinguish executable reproduction, source behavior, visual judgment and a proposal requiring a live comparison.

The design authority remains the later human-feedback addenda, including [05](../requirements/2026-11-24-human-feedback-addendum-05.md) and [06](../requirements/2026-11-25-human-feedback-addendum-06.md), with the [dusk-island companion](../integrations/dusk-island-table-and-music-v1.md). The original Design Companion is useful for art and motion vocabulary, but its older permanent inspector, duplicate hand ribbons and additional Ready acknowledgment have been superseded.

## Preserve the work already delivered

- Contextual Card/party inspection, pin/compare, keyboard routes and deliberate close inspection; hover stays separate from command selection and camera movement.
- Authored chess standards, ownership by shape/value, labelled destination ghosts, semantic zoom and its hysteresis.
- Displayed-moment member facts, Home/Focus/Return and the accepted compact-panel policy. Review 15's selected layout and disposal corrections remain closed.
- Traced travel, height-aware visibility, Physical versus Magic marks, Above/Below arrows, real damage totals and `blocked` feedback.
- Mint/dashed planned Supply versus brass landed Supply; the existing burn/payment/expiry vocabulary and reconciliation.
- Seated Red's likeness and owner boundaries, independent music transport, the authored coastal scene, Off/Subtle/Expressive/Still controls and actual-music analysis.

These are present in the reviewed source. This is a refinement of the delivered system, with explicit additions where the present expressive layer ends. See [inspection](https://github.com/calderwong/hapa-verseUs-prototype/blob/bd66817326c6966d28c73b4cc06a144551077a1b/src/hapa/presentation/inspect.js), [standards](https://github.com/calderwong/hapa-verseUs-prototype/blob/bd66817326c6966d28c73b4cc06a144551077a1b/src/hapa/presentation/pieces.js), [effects](https://github.com/calderwong/hapa-verseUs-prototype/blob/bd66817326c6966d28c73b4cc06a144551077a1b/src/hapa/presentation/fx.js) and [camera](https://github.com/calderwong/hapa-verseUs-prototype/blob/bd66817326c6966d28c73b4cc06a144551077a1b/src/hapa/presentation/camera.js).

## Priority map

| ID | Finding or direction | Evidence | Recommended treatment |
| --- | --- | --- | --- |
| VA-01 | End-of-Tick events can miss presentation dispatch | Reproduced with real rules | Repair before adding event choreography |
| VA-02 | Some board facts read final state during earlier movement | Source-confirmed data flow | Align visible state and interpolated pose |
| VA-03 | Pause and gait use inconsistent presentation time | Source-confirmed | Give battle poses/effects a shared pausable clock |
| VA-04 | Ordinary party hints do not activate paired destination emphasis | Source-confirmed mismatch | Small connection repair |
| VA-05 | Entrance, lobby and compact HUD need stronger player hierarchy | Source plus submitted captures; compact overflow is a risk | Refine alongside Assignment 17's truthful online states |
| VA-06 | Materials and visual emphasis need a coherent Hapa finish | Aesthetic judgment from stills and selected references | One coordinated Home/orbit/close treatment |
| VA-07 | Members need attack, cast, hurt and fall expression | Source-confirmed feature gap; engine capability verified | Consume existing combat poses in Versus |
| VA-08 | Spells and signature rule changes need readable event sequences | Source feature assessment and design proposal | One spell, one absorption and one terrain completion |
| VA-09 | Card inspection and match finish can carry more character | Source measurement and aesthetic proposal | Larger art where space permits; clearer outcome hierarchy |
| VA-10 | Dense effects and ambient accents need an attention budget | Source risk plus conditional tuning | Preserve consequential cues; tune ornament after action reads |

## Presentation correctness

### VA-01 — Complete the terminal presentation boundary

**Reproduced.** `timeline()` adds an end frame only when there are no traced movement frames. The app records its movement trace before some final rules operations, then `_stepPlayback()` reveals only the events in the pose's `evLen` and disposes the playback at the end.

The [diagnostic](evidence/2026-11-26/visual-animation/timeline-end-probe.mjs) uses two legal commands: one Castle travels and another changes its formation facing. It produces 51 trace frames, ending at quantum 1000, and eight events. `poseAt(..., 1000)` exposes five. `supply_spent`, `formation_changed` and `tick_finished` are omitted from that playback dispatch. Merely seeing a trace at quantum 1000 is therefore insufficient. The [result](evidence/2026-11-26/visual-animation/timeline-end-probe.json) records the exact case.

The missing events remain in the authoritative history. The risk is an unexplained final visual change and an unreachable trigger for newly added turn/work effects. Give every Tick a complete terminal state/event boundary and deliver every accepted event once, including when several events share the last quantum.

**Acceptance:** the legal movement-plus-terminal-change case reaches the complete event prefix; final pose, marker, facts and geometry agree. At fast playback, no event is silently dropped and no resource or audio cue is duplicated. The one probe proves the omission; it does not establish every work/terrain case.

Source: [playback.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/bd66817326c6966d28c73b4cc06a144551077a1b/src/hapa/presentation/playback.js), lines 22–41; [app.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/bd66817326c6966d28c73b4cc06a144551077a1b/src/hapa/presentation/app.js), lines 789–793 and 917–933; [match.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/bd66817326c6966d28c73b4cc06a144551077a1b/src/hapa/rules/match.js), lines 392–394 and 501–522.

### VA-02 — Let the board and inspection show the same moment

**Source-confirmed.** During playback, `BoardView.sync()` receives final resolved state plus a positional override. Member position, alive status and band use the override; terrain, party membership, facing and party-marker retirement still read final state. The party pose already includes its alive/retired bit, but marker visibility does not use it. Close work/scenery also reads resolved task/terrain data.

The diagnostic's formation begins North and resolves East. The board reads final East throughout the trajectory although that change belongs at the end. Related source paths permit an absorbed Pawn's marker to disappear early or completed terrain to appear ahead of the shown completion. Those composed visual symptoms still need a live witness.

Extend the existing recorded moment slices and `_displayState()` boundary to the board's semantic state. Apply interpolated positions on that same moment. Sequence the event prefix, state selection, geometry sync and effects deliberately so the read model is neither one event behind nor reading the future.

**Acceptance:** just before and after a turn, absorption or work completion, the visible membership, facing, insignia, terrain and inspector agree. Preserve the existing height filtering and no-sliding-casualty behavior. Rules remain untouched.

Source: [app.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/bd66817326c6966d28c73b4cc06a144551077a1b/src/hapa/presentation/app.js), lines 924, 1390–1408 and 1485–1492; [board-view.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/bd66817326c6966d28c73b4cc06a144551077a1b/src/hapa/presentation/board-view.js), lines 333–335, 375–392 and 421–423; [inspection read model](https://github.com/calderwong/hapa-verseUs-prototype/blob/bd66817326c6966d28c73b4cc06a144551077a1b/src/hapa/rules/inspection.js), lines 136–151.

### VA-03 — Pause battle movement, bodies and effects coherently

**Source-confirmed.** Space pauses `_stepPlayback()`, but the frame loop still advances `BoardView.update(dt)`. Sprite cycles, hit effects, floating values and Fire Pit effects keep consuming wall time. Walking is selected once from the whole Tick's start/end displacement, so a member can retain a walk cycle after its displayed segment has stopped.

Use one pausable presentation time for battle poses and their transient effects. Derive gait from the current displayed segment and its velocity. Music and coastal atmosphere can keep their independently controlled clocks. At 4×, choose deliberately how short cues settle: a human Tick currently lasts 0.35 seconds while hit/Supply effects last roughly 0.75/1.3 wall-clock seconds. This is a density/timing design decision, not a reason to accelerate every ambient animation.

Reduced-motion support already exists in camera, drag, effects and scenery. Extend the same intent to compulsory character cycles and added flourishes while keeping source, target, outcome and settled state legible.

**Acceptance:** pausing contact holds the relevant body pose and result marks; resume continues once. Stopped units stop walking. The same short action reads at 0.5×, 1× and 4× and with reduced motion. No animation callback applies damage, spends a resource or advances the Tick.

Source: [app.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/bd66817326c6966d28c73b4cc06a144551077a1b/src/hapa/presentation/app.js), lines 855–859, 917–933 and 1677–1686; [board-view.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/bd66817326c6966d28c73b4cc06a144551077a1b/src/hapa/presentation/board-view.js), lines 486–512; [Sprite3D.js](https://github.com/calderwong/lumina-hapa/blob/ba838cca09ba43afceda0452b63d28df4cbf7f72/src/engine/sprite/Sprite3D.js), lines 950–978.

### VA-04 — Connect a party hint to its existing endpoint emphasis

**Source-confirmed mismatch.** Ordinary board hover emits `{kind: 'hint', id}`, while `_syncIntents()` accepts only `kind === 'party'` as the emphasis source. The intended mechanism already brightens/scales the matching chess standard and destination ghost, but ordinary hints pass no party identity into it.

Resolve both hint and detailed inspection to the appropriate party identity for this visual emphasis. Preserve pin/compare semantics and command selection. This is a narrow repair to an existing association.

**Acceptance:** hover a party with a planned or continuing destination at Home/tactical distance: its current standard and endpoint respond together. Leave and the emphasis recedes. Pin/compare still works; hover neither commands nor moves the camera.

Source: [app.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/bd66817326c6966d28c73b4cc06a144551077a1b/src/hapa/presentation/app.js), lines 1044–1058 and 2796–2798; [board-view.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/bd66817326c6966d28c73b4cc06a144551077a1b/src/hapa/presentation/board-view.js), lines 734–743 and 753–767.

## Visual and aesthetic direction

### VA-05 — Present the player journey before the development controls

The [submitted lobby](evidence/2026-11-25/response-16/02-roster-opponent-available.jpg) looks like a capable development launcher. The long rules explanation, online state, raw profile identifier, seat controllers, damage-allocation policies and seed all compete in one scrolling setup sheet. The source confirms that hierarchy.

Give the entrance two clear paths, **Play online** and **Play on this computer**, followed by the relevant action. Use a concise invitation, a compact Rules/help route and the existing defaults. Keep ordinary opponent/music selection accessible. Put seed, raw profile IDs, fixture/lab controls and development launch links in an accessible Advanced disclosure. Preserve their values and reproducibility; keep online public-record disclosure readable before joining.

Lobby rows should answer **who, available, record, play** in that order. Currently name, fingerprint, controller, availability, compatibility and record share one ellipsized line. Give identity/availability a first line, secondary record/controller information a second, and Challenge/Join a stable action area. The full fingerprint and provenance belong in the real profile view delivered by Assignment 17. An unsynced record must remain honestly unsynced; a visual placeholder cannot repair missing retrieval.

The compact online match bar deserves a focused check. Its fixed no-wrap children gain a remote-name label and sometimes longer Ready wording; only the phase can flex away. This is a source-derived risk, **not an observed new overflow regression**. Reserve Ready, Orders, navigation and menu space, bound the name, and compact secondary status deliberately if the 700-pixel/long-name witness demonstrates a problem.

Use the existing system sans for operational states and amounts; keep the display face for title/Card identity and a few landmarks. Keep pointer targets stable during status changes. These changes should strengthen the current slate, warm paper and brass vocabulary.

Source: [app.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/bd66817326c6966d28c73b4cc06a144551077a1b/src/hapa/presentation/app.js), lines 234–283 and 1833–1842; [online.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/bd66817326c6966d28c73b4cc06a144551077a1b/src/hapa/presentation/online.js), lines 153–160; [versus.css](https://github.com/calderwong/hapa-verseUs-prototype/blob/bd66817326c6966d28c73b4cc06a144551077a1b/src/hapa/presentation/versus.css), lines 22–24, 74–77 and 753–759.

### VA-06 — Bring the existing materials into one Hapa treatment

**Aesthetic judgment.** [Home](evidence/2026-11-25/response-14/01-home-desktop.jpg), [low orbit](evidence/2026-11-25/response-13/02-low-orbit-table.jpg) and [close formation](evidence/2026-11-25/response-14/03-close-formation.jpg) show a strong physical setting with mixed rendering vocabularies: photographic Red, simple faceted scenery, coarse small figures and a bright, densely marked board. The scene has character; its surfaces and emphasis can become more cohesive.

Use higher-resolution painted/brush-pixel structure, purposeful clusters and selective ink. Cedar needs directional grain and convincing joins; slate needs broad planes and sparse worn edges; cloth needs readable folds; brass needs restrained highlights. Keep the warm key/cool fill and quieter coastal depth. A global pixel filter, noisy texture pass or blanket sepia would not produce the selected Hapa style.

At overview, protect the hierarchy: active decision and meaningful change first; selected/hovered party and endpoint next; ordinary board identity beneath; scenery last. The repeated pale tiles and bright standards currently occupy much of the highest contrast in the stills. Tune ordinary border weight, idle marking and material value together while retaining ownership, alignment, height and legal-state readability. Close inspection should reward attention with better material and member detail.

Integrate Red through compatible light, edges, contact and table occlusion while preserving his likeness and face. The owner-unavailable installed capture shows an empty chair and unavailable music; that is fallback evidence, not evidence that the chosen portrait was replaced or that a new identity is needed. Keep the established limited-view/orbit policy.

Start with the existing table/terrace and one representative territory plus one party. Compare the same Home, orbit and close views as a set. Expand a successful treatment through shared materials and roles; avoid commissioning a full new art library before the small proof reads well.

Direction derives from [Addendum 05](../requirements/2026-11-24-human-feedback-addendum-05.md), [Addendum 06](../requirements/2026-11-25-human-feedback-addendum-06.md) and [the scene companion](../integrations/dusk-island-table-and-music-v1.md), especially material and contrast priorities.

## Animation and feature direction

### VA-07 — Make the figures perform the fight

**Source-confirmed feature gap.** Versus requests ordinary character sheets and selects only `walk_*` or `idle_*`. Current attacks read through lines, bursts, runes and numbers while members do not attack, aim, cast, recoil or fall. Casualty visibility turns off at its traced moment.

The pinned engine already exposes `createCharacterSheet(spec, {combat: true})`, with attack, aim, cast, hurt, dodge and down poses while retaining ordinary frames. A first pass can consume that existing capability in Versus without an engine rewrite or pin change. The generated combat frames are a motion foundation; their presence alone does not finish the higher-resolution art direction.

Build a small event-driven pose layer: sword sweep, pike thrust, archer release, caster gesture, brace for a blocked hit, recoil for actual injury and restrained down/fade for a casualty. Keep stable foot anchors and actual footprints. Check the separately attached gear so a combat frame does not acquire a second sword or a shield floating beside the animated arm. Camera-relative view changes must preserve anatomy and normalized action phase.

Anticipation/contact/recovery should express accepted events without creating extra hits. An attacker that dies in a simultaneous exchange still shows its entitled action. Any lingering casualty treatment must read as aftermath and preserve the established visibility/picking facts. Favor silhouettes and one clear gesture at overview; let the kit carry detail up close.

Source: [board-view.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/bd66817326c6966d28c73b4cc06a144551077a1b/src/hapa/presentation/board-view.js), lines 323–326 and 509–511; [CharacterSprites.js](https://github.com/calderwong/lumina-hapa/blob/ba838cca09ba43afceda0452b63d28df4cbf7f72/src/engine/pixel/CharacterSprites.js), lines 3634–3640 and 3676–3719.

### VA-08 — Give the signature actions a beginning, decision and settlement

The existing effects are a useful vocabulary. Complete a few connected sequences using actual events:

| Action | Recommended treatment | Required meaning |
| --- | --- | --- |
| Supply | A restrained Card-to-party relationship, followed by the existing landed cue | Planned and accepted amounts remain distinct; the value settles once |
| Spell | Source Card/caster cue, exact threatened face/target, steady pending rune, then counter collapse or accepted impact | A pending or countered spell never displays a successful result |
| Absorption | Arrival, accepted members settling into slots, combined insignia/count | The retired party and new membership change at the accepted event |
| Excavation/fill | Planned/running work, accepted geometry change, short fracture/settle, readable exposed/roofed/depth remainder | The visible legal surface changes at the event; debris never invents collision |

Use **Ember Strike and its counter** as the first complete spell example. Current Card damage supplies no source position to HitFX; announcement/counter have sound and text but no corresponding pending/counter board choreography in that dispatcher. A quiet inspectable pending shape is more useful than a continuously flashing effect during a response window. Preserve the response interaction and exact accepted target.

The cubic board is a distinctive source of spectacle. One convincing excavation or fill will say more about this game than another layer of peripheral particles. Existing terrain reconstruction, work cubes and close-view task dust should remain the base. A short material change should clear to readable strata and depth. The player retains the camera unless they choose a focus action.

Source: [app.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/bd66817326c6966d28c73b4cc06a144551077a1b/src/hapa/presentation/app.js), lines 873–945; [fx.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/bd66817326c6966d28c73b4cc06a144551077a1b/src/hapa/presentation/fx.js), lines 57–141; [terrain-view.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/bd66817326c6966d28c73b4cc06a144551077a1b/src/hapa/presentation/terrain-view.js), lines 97–104 and 196–223; [territory-diorama.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/bd66817326c6966d28c73b4cc06a144551077a1b/src/hapa/presentation/territory-diorama.js), lines 361–395.

### VA-09 — Give Cards and outcomes enough room to carry the experience

The Card inspector renders a 240×320 face but displays it at 112×149 CSS pixels, leaving the minor-card art window approximately 90×58 pixels. If the live view feels like a data tooltip, higher source resolution alone cannot solve that screen-space constraint. Trial a 160–180-pixel face where the layout has room, with stronger title/resource/ability hierarchy, full readable DOM facts and a compact fallback. Keep own/opponent state, legal-use labels, pin/compare and keyboard access. Existing approved art and honest fallback faces remain useful; do not assume every screenshot contains the owner's complete rendition set.

The [result still](evidence/2026-11-25/response-16/08-result-cal.jpg) communicates defeat, cause, statistics and archive-pending state. Preserve those truthful distinctions. Improve human identity and outcome hierarchy, and move the developer replay command out of the ordinary player paragraph into help. A quiet decisive-event marker can help connect the result to the board. An optional future “Show decisive moment” requires a real presentation path; it should not be a decorative inactive button. Rematch remains unfinished parent scope identified in Assignment 17 rather than a newly invented styling task.

Source: [app.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/bd66817326c6966d28c73b4cc06a144551077a1b/src/hapa/presentation/app.js), lines 1990–2017, 2927–2930 and 3072–3101; [versus.css](https://github.com/calderwong/hapa-verseUs-prototype/blob/bd66817326c6966d28c73b4cc06a144551077a1b/src/hapa/presentation/versus.css), lines 472–477. Card sizing is a design trial requiring a live comparison, not a demonstrated readability failure.

### VA-10 — Spend motion on meaning

The current hit loop returns after 48 marks, so a sufficiently dense newly revealed batch can omit later recipients. The sound helper likewise limits voices. Keep bounded resource use, but preserve at least one compact consequential cue per affected party; aggregate repeated hits and prioritize casualties, Commander events and blocked versus damaging outcomes before secondary decoration. A dense-exchange witness should establish whether current density is a practical problem.

Ambient polish follows readable actions. The existing music response already has the right jobs: slow practical/inlay/reflection changes, subdued water/peripheral movement and rare accents. The composition should work with response Off. If live comparison shows accents competing during combat or required responses, attenuate them gently at those moments. Small asynchronous breeze, flame and owner-supported Avatar idle can support planning; avoid synchronized whole-scene pulsing or compulsory camera motion.

The Design Companion's approximate 100–150 ms hover, 150–300 ms small impact and mostly settled terrain debris by about 450 ms are useful trial values. Existing hover dwell/hysteresis should be preserved until an observed issue warrants tuning. All timings are presentation choices, never rules time or acceptance by stopwatch.

Source: [app.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/bd66817326c6966d28c73b4cc06a144551077a1b/src/hapa/presentation/app.js), lines 891–914 and 1681–1683; [sound.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/bd66817326c6966d28c73b4cc06a144551077a1b/src/hapa/presentation/sound.js), lines 33–55; [scenery.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/bd66817326c6966d28c73b4cc06a144551077a1b/src/hapa/presentation/scenery.js), lines 526–610.

## Recommended next pass and stopping point

Keep Assignment 17's public-record trust, durable recovery, Ready, challenge/host and packaging work primary. Its online local-music repair enables a fair music review in that mode. Carry the four source-supported presentation corrections together, then assemble a coherent visual candidate with the clearer entrance, shared material treatment, one representative party/action set, one spell/counter and one absorption/work completion. Card enlargement and compact online HUD changes are live design trials; minting flourishes and cinematic result replay can wait.

The [feature brief](2026-11-26-visual-animation-feature-brief.md) gives the dependency order and bounded witnesses. Use one comparable Home/orbit/close set and a few short action clips with pause, speed and reduced-motion observations. Reuse unchanged evidence from the prior reviews. Apply `npm run check` and the changed browser/installed-app journeys when an implementation candidate is ready, as required by AGENTS and Loose Screws; this documentation/source review does not itself require a new full implementation qualification.

This publication contains review and diagnostic evidence. Implementation completion, current installed appearance and CJ's aesthetic acceptance remain separately reportable. Overwatch `hapa-versus` remains canonical task state; its local interface was unavailable in this review and was not updated.
