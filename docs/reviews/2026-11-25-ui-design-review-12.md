# Review 12 — A music player and a Hapa place to play

**Reviewed:** 25 November 2026, America/Los_Angeles.  
**Repository:** `calderwong/hapa-verseUs-prototype`.  
**Main:** `8308ea15df3ef844ade37b24a0097f915ac7ba6c`.  
**Implementation:** `4dc271d506e97c83836dbc108ad3804f30cdcc81`; followed by the response-12 publication.  
**Tree:** `8d6c1fb15261a8281225211fc23debda7d841165`.  
**Engine:** `ba838cca09ba43afceda0452b63d28df4cbf7f72`, unchanged.  
**Default profile:** `hapa_open_10x9_v3_07`.

## Verdict

The latest work makes useful progress. The model-wrapper and stale music-resume defects are corrected in their reported scope. Conversation text selection and wheel gestures no longer moved the camera in the fresh live observation. Preserve those corrections and the seated Red composition.

**The next milestone should be a complete music-and-setting pass.** CJ has selected replayable history and saved music, a quiet Keep interaction, a redesigned player, and a stronger environment that responds to music. Those belong in one coherent candidate. The current music layer exposes underlying state but does not yet feel like a collection or an inviting part of a game. The surrounding meadow and camps establish a world, but the table lacks the authored materials, composition and atmosphere now requested.

Use [addendum 06](../requirements/2026-11-25-human-feedback-addendum-06.md) for selected requirements, [the companion](../integrations/dusk-island-table-and-music-v1.md) for concrete design and owner contracts, and [Assignment 13](2026-11-25-next-agent-assignment-13.md) for execution and the stop condition. This is a new authorized scope, not a reason to rerun every previous review campaign.

## Evidence and its limits

- Inspected the current Git tree, implementation delta, AGENTS, source and [response 12](2026-11-25-ui-design-response-12.md). The evidence register records byte-verified files and exact source pins.
- Independently ran the focused model-decider file once: **12/12 tests passed**. Inspected the submitted resume probes and confirmed their source identity; did not rerun them unchanged.
- Ran one focused Keep diagnostic against the actual Soundtrack and DOM builder with fixture audio, DOM, timers and owner replies. It tests the handler and state transitions, not browser hit testing or actual retention.
- Opened a temporary live match at `http://127.0.0.1:5199/versus.html`: human A, heuristic B, Red enabled, seed 1, v3_07, at a 2838×1076 CSS viewport. Selected an unsent draft, wheeled over conversation, inspected Kept, opened Orders and checked one panned placement. No music was enabled, no Keep or Play was pressed, no question was sent, and no Tick was advanced. The temporary tab was closed.
- The live application did not expose a verifiable source commit. Source conclusions refer to the pinned tree; live conclusions refer to the observed running surface. Fresh screenshots are not included in this text publication.
- Inspected current Song Registry, Avatar Builder/Record Garden/Living Light and Campfire source. Papa's Island was available as a written design brief, not a verified running scene or delivered asset collection. See [evidence](evidence/2026-11-25/review-12/README.md).
- Response 12 reports `npm run check` exit 0 with 152 rules tests, bot/peer checks and build. That is the implementation agent's report; this reviewer did not rerun the broad gate. Owner process-start comparisons in that report are not hashes of running memory. No current Overwatch read or update is claimed here.

## Closure of the previous assignment

| Prior finding | Disposition | Basis |
| --- | --- | --- |
| R11-01 conversation gestures | Technically closed in observed scope | Event propagation is contained without preventing native selection/scroll. Fresh drag selection and wheel input left Red's projected rectangle unchanged. |
| R11-01 ordinary placement and squeezed layouts | Improved; retain one narrow qualifier | Measured panel sizes, flipping/docking and overflow have source and submitted witnesses. Both edges of each candidate still need checking against the free area; R12-01 below. |
| R11-02 stale resume can fail a newer song | Technically closed | Resume binds entry/generation/listening/disposal; it uses the shared finite start deadline. Exact-source submitted stale/current probes support the fix. |
| R11-03 malformed model reply can hang | Technically closed | Wrapper validation precedes completion; invalid success payloads settle through the stored fallback. Twelve independently passing tests include plan/response/late-reply cases. |

This is technical review, not CJ acceptance to Done. Response 12 reports HV-63 in Review; it does not establish CJ accepted HV-62 or HV-63.

## Findings and selected next work

### R12-01 — A conversation beside a panned face can still overlap an open drawer

**P2, source-confirmed qualifier; not reproduced in the fresh live pose.**

The app reserves free space for the roster, Orders and other drawers. `Table.update()` tests only the right edge of the candidate to the face's right, and only the left edge of the candidate to its left. A face panned into reserved space can therefore produce a candidate whose unchecked edge lies behind a drawer. The drawers have higher stacking order.

For example, with a free right boundary at 578 px, a 300 px panel and a face at 850 px with a 24 px projected radius, the left candidate begins at 511.6 px and ends at 811.6 px. Testing only its left edge accepts it despite the right-edge overlap. The wide live pose inspected here did fit; this arithmetic is evidence of a branch condition, not a claim of a captured failure.

**Required result:** both candidates must satisfy `left >= freeLeft && left + width <= freeRight`; otherwise dock within measured space. Include the new music drawer in the same free-area composition. Keep gesture isolation, drafts, keyboard focus and native scrolling. This is a small completion inside the new layout work, not a separate campaign.

Source: [table.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/8308ea15df3ef844ade37b24a0097f915ac7ba6c/src/hapa/presentation/table.js), `update`; [app.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/8308ea15df3ef844ade37b24a0097f915ac7ba6c/src/hapa/presentation/app.js), `_freeSpace`.

### R12-02 — Saving needs to be a quiet state change, with stable controls

**P1, selected interaction requirement. CJ's reported track switch remains unexplained.**

The current Keep handler captures the song, sends its offer/discovery to the owner, records the save and polls acquisition. It does not directly select, advance, pause, seek or restart the audio. The focused diagnostic exercised Saving → Saved/downloading → Available offline and observed **zero audio mutator calls**, with unchanged entry, queue index/revision, generation, source, position, pause/listening state and volume. A separately injected `ended` event advanced to the next song with reason `ended`.

That distinguishes the handler from possible coincident events; it does not dismiss CJ's observation or prove a browser cause. Current advancement paths include natural end, explicit Next and delayed unusable-track skipping. Preserve cause/entry/generation diagnostics if the local journey reproduces a change near Keep.

There is a confirmed indirect effect: `kept` calls `opponent.say(keptLine(...))`; speaking can duck music toward 28% gain. Remove that automatic acknowledgment for the new visual-only behavior. An independently requested conversation may still use the established voice policy.

Response 12 also records an accidental Keep after the “not listening” state moved controls under the pointer. The strip currently wraps controls and rebuilds children. Reserve stable control slots and status space, preserve focus and avoid changing hit targets during pointer interaction. The new player should solve both the product behavior and this practical usability problem.

**Required result:** Keep updates the correct song to Saving/Kept/Retry without caused playback or gain changes. A later save reply cannot switch the newly selected song. Natural completion remains a separate event. Opening a collection does not start playback. See HF6-03 and the companion's state model.

Source: [soundtrack.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/8308ea15df3ef844ade37b24a0097f915ac7ba6c/src/hapa/presentation/soundtrack.js), `keep`, `_poll`, `_render`; [table.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/8308ea15df3ef844ade37b24a0097f915ac7ba6c/src/hapa/presentation/table.js), `kept`/`speaking` listeners; [probe/result](evidence/2026-11-25/review-12/README.md).

### R12-03 — Kept is currently a receipt list, not a playable collection

**P1, selected feature gap confirmed live and in source.**

The live Kept surface showed six text entries with availability and introduction information but no Play action. Several generic titles repeated, with different durations. The code truncates this list; the owner does not impose a six-item limit. There is no current Played browser.

The now-accessible Song Registry owner already exposes retained membership and reverified local audio. Build Queue / Played this match / Kept around these existing contracts. Saved music should be playable after reopening or starting a match, without needing the introducing peer online once its bytes have been retained locally. The local owner service is still needed.

Use listener library + owner-returned `libraryId` for durable replay, exact recording/asset identity for provenance, and actual playback evidence for Played. Never merge generic titles, equate saves with listening history, or label the storing player as the creator. Reference-only/acquiring/failed saves need honest availability states. The companion includes route details and the retained-ID encoding caveat.

Source: [Soundtrack](https://github.com/calderwong/hapa-verseUs-prototype/blob/8308ea15df3ef844ade37b24a0097f915ac7ba6c/src/hapa/presentation/soundtrack.js); [Song Registry peer contract](https://github.com/calderwong/hapa-song-registry/blob/dadb049bdb79cc6c17e258f36e6a96c55d2a3b3c/docs/PEER_MUSIC.md).

### R12-04 — Give the music controls and environment one authored visual identity

**P1 for the selected design milestone; aesthetic judgment rather than a rules defect.**

The live board still sits over a broad repeating meadow, scattered trees and camp props. The existing scene code confirms this is the current composition. The next pass should make the table, banks, opponent, light and surroundings feel deliberately arranged for a match. Adding reactive glow alone would leave the underlying composition unchanged.

Use a **dusk island table**: cedar structure and matte slate, a quiet coastal terrace, dark water, moss/wet stone, wooded silhouettes, warm practicals and small brass details. Keep the battlefield's current semantic colors and readable values. Preserve Red's seat and scale. Retain the full board/bank and excavation clearance in every camera mode.

Style the compact music deck and its expanded browser with the same material and type language. The user should see a song and sensible controls, with provenance and technical state available on demand. Avoid a wall of diagnostics, equalizer bars over the field, or tiny decorative controls that sacrifice usability.

Source/current baseline: [scenery.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/8308ea15df3ef844ade37b24a0097f915ac7ba6c/src/hapa/presentation/scenery.js). The companion cites the Papa's Island brief and actual Echo/Campfire/Living Light implementation references separately.

### R12-05 — Music response should enrich the setting while preserving the match

**P1 for this selected milestone; new presentation work.**

The current Soundtrack owns one audio element and has no analysis interface. Add a small, read-only signal boundary tied to that player and its exact active item. Let it drive a few decorative jobs: warm trim/practical glow, shoreline/reflection shimmer and rare peripheral accents. Maintain stable unmodulated light over units, cards, legal moves and subterranean inspection.

Borrow Record Garden's external signal ownership, Campfire's smooth envelopes and Living Light's source/time discipline. A full-mix spectrum is not isolated stems. Use actual audio time; game Playback speed and Tick count must not alter music timing. Keep voice and game sounds out of the analysis. Pause, selection changes, unavailable audio and disposal must leave no stale song response.

Off/Subtle/Expressive/Still behavior and bounded resource ownership are part of the first connected candidate. A second audible player, full-frame visualizer canvas, expensive Campfire renderer, full island build or album-analysis pipeline is unnecessary.

## What the agent should deliver next

One playable candidate that demonstrates this sequence: music plays; Keep changes only saved state; the player browses and replays an earlier song and a retained recording; returns to the table mix; continues to command the board; rotates and inspects a territory in the redesigned environment; sees restrained musical response; pauses or selects Still and gets a calm scene without losing controls.

Assemble these connections before fine tuning. Use focused checks for changed contracts, then the required integrated `npm run check` and the changed live journey. Reuse unchanged evidence. Record exact implementation and owner identities, source/availability limits and the next human art decision. Append the existing board workflow, hand off to CJ and stop this work item. No new product question needs to block assembly.
