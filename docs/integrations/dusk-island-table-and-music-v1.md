# Dusk island table — Music, environment and implementation companion v1

**25 November 2026 · Design for Assignment 13 · Not an implementation report**

This companion turns CJ's [music and atmosphere direction](../requirements/2026-11-25-human-feedback-addendum-06.md) into one buildable experience. [Review 12](../reviews/2026-11-25-ui-design-review-12.md) records current behavior and evidence. [Assignment 13](../reviews/2026-11-25-next-agent-assignment-13.md) defines execution and qualification. Existing gameplay and seated-opponent requirements continue to apply.

## 1. The experience to build

You sit across from Red at a substantial game table on a sheltered island terrace. A warm lantern catches the cedar edge. The playing surface is matte and readable; the ocean and trees recede into cool dusk. The song Red brought is playing. You press Keep. The bookmark fills, the label becomes Kept, and the song carries on at the same position and level. Later, you open Music, recognize the track by its title, duration and introduction, and play it again.

As the music swells, a small amount of warm light travels through the table's decorative inlay and appears in the surrounding reflections. Water and peripheral embers respond subtly. The units, chess identities, tile boundaries, selected destination and costs stay immediately readable. Zooming into a formation still reveals its pixel world. Turning the camera still reveals a coherent table, shore and opponent seat.

**The visual goal is a desirable place to spend a match.** The world must be convincing with music response off. Audio response should deepen that composition rather than carry it.

All numeric sizes, colors and envelope timings below are working design defaults. The agent can tune them within the stated behavior and hierarchy. They are not an invitation to optimize endlessly against a screenshot similarity score.

## 2. Music player: a compact listening deck

### 2.1 Composition and control hierarchy

Replace the wrapping strip with a small, stable player using the game's navy, warm paper and brass accents, with restrained cedar framing. Use a readable interface surface; decorative materials must not reduce text contrast. Place it in the current music region below the match toolbar, measured against the other panels. Keep Ready and core game status distinct and accessible.

The collapsed player has two clear rows:

1. **Identity:** small supplied cover/Song Card rendition when genuinely available, song title, and a secondary creator/introduction line. Without artwork use a consistent Hapa record/suit mark, not fabricated album art or a broken image. Truncate a long title visually; expose the full title on focus/hover and in the drawer.
2. **Transport:** Previous, Play/Pause, Next, an accessible progress/seek control with elapsed/duration, Keep/Kept, volume/mute and Music. Keep each action in a fixed slot. Reserve a small status area for loading, save acquisition and errors.

At ordinary desktop width, aim for a deck roughly 380–460 CSS px wide and two short rows. Fit the actual text and viewport rather than hardcoding this as a gate. At narrower width, collapse optional metadata and move seek/volume detail into the opened deck before removing core actions. Avoid squeezing the same nine tiny controls into an unreadable strip. Provide at least a comfortable approximately 32 px target for compact controls, larger where layout permits.

Use recognizable symbols with accessible names and useful hover/focus tooltips: Previous, Pause, Next, Keep this song, Open music, Mute music. Do not use icons alone to distinguish Loading, Failed and Kept. Use a short word or status text with the icon. Preserve native keyboard operation, visible focus and focus identity across state updates. Announce meaningful save/error changes once through a polite live region; do not announce playback time on every frame.

**Stable geometry is a functional requirement.** A long song title, `Not listening`, `Saving…` or `Available offline` must not move the Next or Keep hit target under a pressed pointer. Patch persistent controls rather than replacing the focused DOM subtree on every update. The source presently rebuilds the strip; this is part of the overhaul, not optional polish.

The surrounding world may contain a small listening object or music emblem as a secondary shortcut. Reliable controls remain reachable at any camera angle; a tiny world-space object must not become the only way to pause or replay music.

### 2.2 Expanded Music drawer

Open a deliberate drawer using the existing panel composition, with three tabs:

| View | What belongs here | Primary action |
| --- | --- | --- |
| Queue | The table's current contribution order, including upcoming songs | Play the selected item locally; show the current table position separately |
| Played this match | Songs whose playback actually started in this match, including deliberate replays | Play again |
| Kept | Persistent owner-backed saved discoveries and retained recordings | Play when audio is available; otherwise show acquisition or availability state |

Opening, searching or changing tabs never changes playback. Preserve drawer state and search during save updates. Use a scrollable list with a simple title/creator filter; the current owner list APIs return arrays, so filtering can be local. Remove the current six-row display limit. An empty Played view says no music has played in this match. An empty Kept view explains that Keep adds songs while leaving playback alone.

Each row presents title, creator when supplied, duration, version when supplied, introduction and availability, with Play obvious. Generic titles need those distinguishing fields. Show `Creator not stated` where necessary; do not infer authorship from the storage node or the introducing Avatar. Detailed credits, sources, discoveries and exact IDs belong behind an expandable provenance control.

The retained owner stores one membership per exact asset and aggregates introductions. Use that membership as the saved row, preserving known recording/version metadata and expandable introduction records. Do not merge by title or claim to reconstruct edition identities the owner does not provide. A 24-second recording, 60-second recording and 258-second recording with similar titles remain distinguishable. Same bytes may have more than one discovery, without needing duplicate audio storage.

### 2.3 Keep is independent of transport

| State | Visible treatment | Playback behavior |
| --- | --- | --- |
| Not kept | Outlined bookmark plus Keep | Unchanged until an independent transport action |
| Request in flight | Stable bookmark slot plus Saving… | Continue the same song; no gain change |
| Durable reference saved; audio acquiring | Filled bookmark plus Kept; secondary Saving audio…/progress | Continue the same song |
| Retained locally | Kept; Available offline in detail | Continue the same song; future replay uses retained identity |
| Save failed | Retry in the same action slot; concise reason in status/detail | Continue the same song |
| This exact encounter already kept | Kept | No duplicate record for this encounter and no implicit deletion |
| Recording retained, but this introduction is new | In your library; Keep this introduction remains available | Save this discovery without duplicate audio acquisition; playback is unchanged |

Capture the target item/asset and encounter at activation. A response arriving after Next changes the saved state of that original item only. Repeated activation during the request cannot create repeated saves. A retry must remain bound to the intended item and preserve discovery/idempotency semantics. Asset retention and discovery are separate: already possessing the bytes must not prevent saving who introduced this recording in a new encounter.

Remove the current automatic `kept → opponent.say(...)` acknowledgment. It can produce speech and duck music. Visual confirmation is sufficient; the player can still talk to Red independently.

Do not disable ordinary song completion to satisfy this requirement. If a track naturally ends while its save is pending, normal table-queue advancement may occur with reason `ended`; that is separate from the save. Record causal transport reasons in developer diagnostics so a future report can distinguish Next, ended, failure skip, replay selection and Return. These diagnostics should not become an always-visible player ledger.

### 2.4 Replay and transport: selected default

Maintain one audible player with two explicit listening contexts. This is a local listening choice; it does not claim remote synchronized playback.

**Table mix:** preserve the existing contribution order and ordinary natural-end advancement. Next advances the table mix. Previous restarts the current song when more than three seconds have elapsed; near its beginning, it opens the most recent actually played earlier entry as a local replay. Unheard/skipped queue entries are not evidence of a prior listen.

**Local replay:** pressing Play on a Queue, Played or Kept row bookmarks the table item, position and listening intent, then plays the chosen item through the same source lifecycle. Capture a navigation list from the playable rows in the chosen view at that moment. Previous restarts after three seconds, otherwise goes to the previous item in that list; Next goes to its next item. Disable the respective edge action with an explanation when no item exists. Replaying another row changes the local selection without replacing the original table bookmark.

**A local replay stops at the selected song's natural end.** Show Replay/Play again and **Return to table mix**. Do not silently return to the table mix, reorder it, or begin a newly saved song. This is one-song replay with manual navigation; playlist editing and autoplay-library modes can be selected later.

Return restores the table bookmark and its listening intent, clamping position to valid media bounds. If the bookmarked entry was removed or became unavailable, explain that and offer a valid queue choice rather than starting an unrelated song silently. Browsing rows does not update the bookmark. Saved replies do not change either context. A new match discards the old match's queue/history/bookmark but reads the durable Kept library again. Persist user volume and chosen visual-response preference, not blob URLs.

Selecting Play is an explicit request to hear that item and can satisfy the browser's gesture requirement. Pause preserves position. Mute changes gain, not position or queue. Seek uses the current player's actual duration and time. Loading, blocked playback and unavailable audio receive clear recovery actions. Use the existing generation/entry/listening/disposal fences and finite start policy for both source kinds.

## 3. Existing music contracts and ownership

Reviewed owner: [`calderwong/hapa-song-registry` at dadb049](https://github.com/calderwong/hapa-song-registry/tree/dadb049bdb79cc6c17e258f36e6a96c55d2a3b3c). The Versus Vite bridge maps `/music/<library>/*` to the corresponding owner's `/api/peer/*`, with credentials server-side. Reconcile the local checkout/process before use. Do not put bearer secrets in browser code or reports.

| Existing host route | Use and limit |
| --- | --- |
| `GET /music/cj/encounters` | Saved discoveries plus acquisition state; retained receipt contains `libraryId`. This is not full listening history. |
| `GET /music/cj/retained` | Persistent retained entries: libraryId, recordingId, assetId, title, version, durationSeconds, credits, source, introductions and receiptId. |
| `GET /music/cj/retained/retained:<24-hex>/audio` | Reverified retained bytes with Range support. The source peer can be absent; the local listener owner must still run. |
| `POST /music/cj/audio {offer}` | Resolve an exact current-session contribution. Existing Versus playback uses the returned blob/object URL. |
| `POST /music/cj/keep {offer, discovery}` | Durable discovery and idempotent asset acquisition. |
| `GET /music/cj/keep/:acquisitionId` | Acquisition progress and retained receipt when complete. |

Use the active listener's library, not a hardcoded assumption that every session belongs to `cj`. Durable selection is **listener library + returned libraryId**. Queue IDs, contribution snapshot IDs and object URLs are not library addresses. The current retained route expects the literal `retained:` prefix: validate the documented identifier shape and construct that path correctly; encoding its colon to `%3A` does not match the inspected regex.

An older failed/reference-only encounter does not contain the complete contribution offer needed by today's audio/retry endpoint. Show it honestly as unavailable or acquiring. Do not invent a historical replay endpoint, silently fetch a different recording with the same title, or claim bytes are offline because a reference was saved. `/songs` is the original registry, not a union with retained membership. Re-sharing/export and cross-session full listen history are separate future work.

Source contracts: [owner routes](https://github.com/calderwong/hapa-song-registry/blob/dadb049bdb79cc6c17e258f36e6a96c55d2a3b3c/src/api-server.js), [peer music](https://github.com/calderwong/hapa-song-registry/blob/dadb049bdb79cc6c17e258f36e6a96c55d2a3b3c/src/peer-music.js), [documentation](https://github.com/calderwong/hapa-song-registry/blob/dadb049bdb79cc6c17e258f36e6a96c55d2a3b3c/docs/PEER_MUSIC.md).

## 4. Art direction: the dusk island table

### 4.1 Compose the whole scene

Replace the current broad meadow-and-camp composition with a small, coherent coastal setting. Give the table a convincing cedar structure, an apron with limited engraved brass/inlay, a matte slate or ink-toned playing bed and purposeful Card-bank trays. Material seams should explain construction. Existing functional banks must remain where play and picking expect them.

Place it on a stone/timber terrace with a readable edge toward dark water. Arrange a few wet rocks, moss and low planting near the terrace; use grouped fir/cedar silhouettes and a soft distant shoreline to establish depth. Keep the main home view open. A warm lantern or two and a small cloth/personal object can imply habitation. Use a few composed clusters instead of uniform scatter and repeated tents.

Preserve Red opposite the human at the delivered useful scale, with a believable seat/contact relationship. Use ambient/fill conditions compatible with the existing Avatar rendition; do not replace the Mesh owner or distort its identity to obtain the scene. Its conversation stays an optional, measured surface. The same world must work from 360-degree orbit, tactical view and close inspection. A painted backdrop cannot replace the geometry needed at those angles.

Build this slice, not the full Hall, Harbor House or Nexus Bowl from Papa's Island. Those references establish place and materials; they do not require a complete island before the game can improve.

### 4.2 Palette and materials

| Role | Working swatch | Treatment |
| --- | --- | --- |
| Slate/ink shadows | `#14242E` | Matte, broad value groups; clear separation from bright pieces |
| Cedar structure | `#76513A` | Directional grain, selective worn edges, no glossy brown plastic |
| Aged brass | `#B99252` | Small fittings and decorative inlay; reserve bright detail |
| Coastal haze | `#8BA5A4` | Desaturated depth behind the table; keep it out of tactical text |
| Lantern light | `#FFD7A0` | Warm localized light against cool ambient fill |
| Paper/linen | `#EEE2C8` | Readable labels and selected props without washing out Card art |

These swatches define scenery and player treatment. They do not replace lane/suit/team colors. Musical color variation stays in a bounded scenic palette; it cannot recolor a Red/Green lane or masquerade as a spell, enchantment or active column.

Match the established brush-pixel/CRPG vocabulary: readable silhouettes, large painted planes, purposeful wear and selective dark edges. Preserve crisp sprites and useful material scale at default zoom. Use the existing rendering and texture conventions; an indiscriminate full-screen pixelation filter must not degrade text, icons or picking. Avoid universal gloss, noisy dirt on every surface, all-sepia lighting and a cyan outline on every object.

### 4.3 Protect the battlefield and its cubic space

Maintain the current playable dimensions and the separate Card/enchantment banks. The new table skin is presentation. Do not alter tile positions, movement centers, sub-square formation, height bands, collision or ray selection to fit an art concept.

The existing scenery excludes the board footprint to keep deep excavation visible. Preserve that hole through the table/terrace/shore geometry. Table walls, water planes, fog and decoration must not fill a pit or cover a close inspection. Musical light may appear on an outer rim or cutaway wall, but the internal unit and terrain readout gets a stable light floor.

Use this visual priority order:

1. Legal targets, command/selection state, unit and chess identity, damage and critical game changes.
2. Actual pieces, Cards, territory material and formation inspection.
3. Seated opponent and deliberate conversation.
4. Music controls when used.
5. Decorative motion and scenery.

Suppress optional accents during intense targeting/dragging or busy combat presentation if necessary. Never hide an actionable indicator behind a visualizer particle. Decorative objects are non-pickable. Their animations cannot feed authoritative state.

## 5. Musical visual vocabulary

### 5.1 Three jobs are enough for the first complete scene

| Signal | Scenic expression | Constraint |
| --- | --- | --- |
| Slowly smoothed full-mix energy | Warm practical/reflection strength and a small decorative apron/inlay glow | Keep a fixed readable baseline; do not modulate global exposure or playable tile fill |
| Bounded low/high-band movement | Soft shoreline shimmer or peripheral dust/light movement | No claim these bands are isolated instruments; keep movement outside targets and labels |
| Rare accent after a cooldown | A few embers or a brief light gesture along the outer table trim | No camera shake, field-wide flash, new game-like marker or burst every beat |

The table should participate: its decorative trim and nearby reflected light respond with the environment. The playable grid itself remains visually stable. The subtle mode should be noticeable when watched and easy to ignore while planning. Expressive may increase amplitude and peripheral detail, never override the hierarchy.

Use smoothed envelopes instead of raw FFT bins as brightness. Campfire's source offers useful starting values: slow energy attack/release about 0.9/2.2 seconds, low-band response about 0.10/0.45 seconds, and rare accent opportunities at least three seconds apart. Tune by listening to a quiet and a louder track; those values are reference defaults, not rigid acceptance thresholds. Use normalization with a floor/clamp so silence cannot amplify noise into a crescendo. Reset warmup/envelopes on source changes and seeking; do not treat a discontinuity as a musical impact.

### 5.2 Player controls and reduced motion

Offer **Music response: Off / Subtle / Expressive**, with Subtle the initial default. Offer a separate **Still atmosphere** control and honor the platform reduced-motion preference by initially selecting Still. Let an explicit player choice override that default and persist locally.

- **Off:** use the authored baseline scene; normal quiet ambient life can remain unless Still is set.
- **Subtle:** small smooth light/reflection changes and sparse peripheral accents.
- **Expressive:** stronger but bounded scenic response; no additional game signal colors or camera motion.
- **Still:** hold decorative movement and musical intensity animation; retain the chosen static atmosphere and all game feedback needed to play. Removing only rotation while FFT bars still bounce is insufficient.

Pausing, ending or turning listening off eases musical response to neutral. Unavailable analysis uses the baseline, never fabricated beats. Ambient wind/tide may use a separate slow world clock when Still is off. **Mute does not stop transport:** the selected default permits response to continue while a playing track is muted; Off/Still provides an independent visual stop. Make this distinction discoverable in the setting tooltip.

## 6. Implementation architecture and attachment points

### 6.1 Existing code to extend

| Current surface | Suggested responsibility |
| --- | --- |
| `src/hapa/presentation/soundtrack.js` | Single transport, playback source identity, Keep/acquisition, listening context and read-only music signal |
| `table.js`, `versus.css` | Stable music deck, optional drawer composition, quiet Keep wiring, both-edge conversation placement |
| `scenery.js`, `boardframe.js`, current palette/material helpers | New coastal composition and crafted table treatment, preserving exclusion volumes and semantics |
| `app.js` `_frame(dt)` and existing scene lifecycle | Feed one sampled music signal to presentation, update/dispose through the current frame owner |
| Owner Song Registry routes | Exact offered/retained audio and durable saves; no duplicate consumer-owned library |

Split small consumer modules when it clarifies transport, collection view or atmosphere ownership. Preserve plain ES modules/JSDoc; a new framework or generic music-platform rewrite is unnecessary. If an engine change becomes truly necessary, follow the fork workflow; do not edit `vendor/lumina` in place.

### 6.2 Proposed read-only music frame

There is no such current API; this is a proposed contract, not a claim that the owner already exposes it. A small reused frame can contain:

```js
{
  itemKey, assetId, recordingId, generation,
  sourceTimeSeconds, durationSeconds,
  playing, listening, muted,
  analysis: 'measured' | 'unavailable',
  energy01, low01, high01, accent01
}
```

Use the active item's actual identity and `HTMLAudioElement.currentTime`. Carry the generation so stale work cannot affect a newer song. Use playback state as well as energy: a silent passage, a paused song and unavailable analysis are different states. If future prepared features exist, add their exact source/method identity; do not quietly substitute a different recording.

Use presentation `dt` for release toward neutral when the audio clock is paused; use source time for song-aligned cues. Ambient elapsed time is independent. The game's Tick clock and 1×/2× playback control are not music clocks. Nothing in this frame may mutate the rules, bot observation, command admission or deterministic replay.

### 6.3 One music source, one optional analysis tap

The current player owns one HTML audio element and exact blob source. Add a music-only analysis tap; do not analyze a destination mix containing Red's voice or game SFX. Do not start a second audible player, a separate analysis service, or an independent visualizer animation loop.

If Web Audio is used, create at most one owned music AudioContext and one MediaElementAudioSource for that element's lifetime, after the appropriate user activation. Attaching a media-element source reroutes the element's audible output through the graph, so connect a valid audible path before declaring playback ready. A useful arrangement is source → owned gain → destination, with a separate source → analyser branch. One place owns the effective volume/mute/duck policy; avoid applying the same user gain twice.

If analysis construction fails before attachment, retain ordinary playback. After attachment, preserve the audible graph even if analysis is disabled or fails; do not close its context while expecting that same element to keep producing ordinary audio. Surface a recoverable blocked-playback state when the context cannot resume. Close/dispose the graph with the music lifecycle, idempotently. These are implementation constraints arising from the [Web Audio media-element graph behavior](https://www.w3.org/TR/2021/REC-webaudio-20210617/#MediaElementAudioSourceNode).

Today's same-origin owner/blob path avoids assuming that arbitrary cross-origin streams can be analyzed. Future remote URLs require their own analysis capability check. Unavailable analysis must not make ordinary music unavailable or cause a transport skip merely to find an analyzable track.

Pool FFT buffers and scene objects. Sampling around 30 Hz with interpolation in the existing render update is a reasonable starting point. Avoid per-frame DOM replacement, material/texture creation and unbounded particle growth. Use a fixed instance pool or shared geometry for small effects. Three.js [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html) is appropriate where repeated geometry/material would otherwise multiply draw calls.

At pause/Next/seek/local replay/Return, reset or release the correct envelopes with no old-song residue. On hidden-tab suspension, do not replay missed accents on return. On match replacement/disposal, remove listeners, dispose owned objects and object URLs, and prevent pending results from reattaching to the new scene. Preserve the repaired current-generation/entry/listening fence and finite start policy.

### 6.4 Resource and performance posture

Start with two or three reused signal channels and a small fixed particle pool. Reuse light/material uniforms and limited practicals; do not create a shadow-casting light per beat. The selected scene should remain usable when response is Off or analysis is unavailable.

Record one short, same-camera/same-track response-off versus response-on comparison on the actual development machine, with viewport and quality settings. Check input responsiveness and frame-time behavior; if optional effects materially degrade play, reduce detail before adding complexity. This is a bounded diagnostic, not a multi-device benchmark campaign or a gate requiring an arbitrary universal FPS claim. Dispose resources on repeated match setup so the improvement does not become a session leak.

## 7. Hapa references: what to reuse, what they actually prove

| Reference and inspected revision | Useful guidance | Boundary |
| --- | --- | --- |
| [Papa's Island written brief](https://chatgpt.com/library?file_id=libfile_0c6c696a0a048191b687b64388ffa8cc&account_id=personal) | PNW island materials, warm communal timber, cool shadows, broad painted planes, selective edges | All 386 brief lines read. Delivered island code and named concept images were not verified. This is design intent. |
| [Echo Record Garden visual bible](https://github.com/calderwong/hapa-avatar-builder/blob/c7e16f4ddba3d2278f257fc76fab98d726a78e82/docs/ECHO_RECORD_GARDEN_VISUAL_BIBLE.md) | Authored material families and atmosphere supporting the primary interactive surface | In Versus the battlefield takes that priority. Do not copy its cinema camera or full scene. |
| [Garden atmosphere](https://github.com/calderwong/hapa-avatar-builder/blob/c7e16f4ddba3d2278f257fc76fab98d726a78e82/src/domain/echo-record-garden-atmosphere.js) / [visual system](https://github.com/calderwong/hapa-avatar-builder/blob/c7e16f4ddba3d2278f257fc76fab98d726a78e82/src/components/echo-record-garden-visual-system.js) | Reused interpolation output, deterministic material baking, shared foliage uniforms, tiers and disposal | Values and scale belong to Garden; adapt the pattern rather than importing the complete factory. |
| [Garden audio visualizer](https://github.com/calderwong/hapa-avatar-builder/blob/c7e16f4ddba3d2278f257fc76fab98d726a78e82/src/components/echo-record-garden-audio-visualizer.js) | Bounded Three.js visual objects with externally supplied signal/update/dispose | No added audio context. Its reduced-motion option removes rotation, not all FFT movement; implement the stronger Still behavior here. |
| [Campfire signals](https://github.com/calderwong/hapa-campfire/blob/91ca45c9411aa842efcf8b63237f1aa890e33183/src/echo/musical-signals.js) | Compact normalized envelopes, warmup, rare accent cooldown | Inputs are normalized master-spectrum bands. Its fixed band indices need deliberate mapping to the chosen FFT; kick/shock are supplied cues, not measured stems. |
| [Living Light preview driver](https://github.com/calderwong/hapa-avatar-builder/blob/c7e16f4ddba3d2278f257fc76fab98d726a78e82/src/living-light/preview-driver.js) / [music response](https://github.com/calderwong/hapa-avatar-builder/blob/c7e16f4ddba3d2278f257fc76fab98d726a78e82/src/domain/living-light-music-response.js) | Existing audible clock, bounded work, exact signal source, honest availability and lifecycle | Native GL/full-frame rendering is not a ready shared-depth game adapter. Reuse contracts and suitable pure functions. |
| [Living Light signal ownership](https://github.com/calderwong/hapa-avatar-builder/blob/c7e16f4ddba3d2278f257fc76fab98d726a78e82/docs/living-light/SIGNALS_HOST.md) | Exact recording/hash/duration binding for prepared features | The earlier 183.024-second Dear Papa reconstruction and roughly 258.44-second canonical recording are not interchangeable by title or stretching. |

Current Builder source is `c7e16f4ddba3d2278f257fc76fab98d726a78e82`; Campfire is `91ca45c9411aa842efcf8b63237f1aa890e33183` on `hapa/campfire`. Preserve attribution/licensing and follow each owner's local instructions if actually changing owner code. The current [Living Light discovery map](https://github.com/calderwong/hapa-avatar-builder/blob/c7e16f4ddba3d2278f257fc76fab98d726a78e82/docs/living-light/DISCOVERY.md) reports its bounded sixteen-task integration technically delivered; older foundation text is not today's status. This does not establish human acceptance or universal device/catalog qualification.

No arbitrary paid model, asset-generation service, whole album extraction, full Campfire renderer or Living Light canvas is required for this milestone. Existing materials, small authored/procedural additions and a direct music signal are enough to build the selected experience.

## 8. How to judge the candidate

The candidate succeeds when the music controls feel dependable, Kept behaves like a collection, the table feels like a deliberately authored Hapa place, and music adds atmosphere without making a turn harder to read. Show that whole experience before tuning isolated highlights to perfection.

Qualification must cover the changed contracts and one connected live journey: quiet Keep, a save completing after an independent track change, ordinary natural completion, earlier-song replay, retained replay across a fresh match, stable controls, drawer/conversation fit, source changes, pause/Still, Home/orbit/close/excavation readability and one ordinary board command. Use the existing final `npm run check` once the whole candidate fits; rerun only affected checks after related fixes unless a concrete risk or gate requires broader work.

CJ's next art decision should be grounded: **When playing a normal turn, does this coastal table feel more inviting and recognizably Hapa, and is the Subtle music response visible enough to enjoy without drawing attention away from the pieces?** Supply the actual viewport, camera and response mode alongside the candidate so that feedback is about the same experience. That question is for human review after implementation, not a blocker before assembly.
