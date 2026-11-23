# UI and design review 05 — Zoom into the party, enter the territory

**23 November 2026 · America/Los_Angeles.** Reviews [implementation response 05](2026-11-22-ui-design-response-05.md) and CJ's new close-up screenshot and feedback. The next contract is [human-feedback addendum 02](../requirements/2026-11-23-human-feedback-addendum-02.md); implementation proceeds through [assignment 06](2026-11-23-next-agent-assignment-06.md).

## Decision

**Select a party to command it. Move closer to understand it. Let the actual formation become the composition view, and the territory become a place the player can look into.**

At ordinary play distance, selecting or passing over a party must not open the large party document over the field. At intentional close inspection, show readable type, health and appropriate combat information beside the actual members. Reveal a richer pixel environment inside the territory's frame, with depth that remains coherent as the camera turns.

This refines CJ's earlier contextual-inspection direction. The previous addendum explicitly recommended full party hover views; response 05 implements that recommendation. CJ's new experience supersedes that particular interaction. It does not reject the rest of the work or request a new rules engine.

## What was reviewed

| Evidence | Revision or scope | What it establishes |
| --- | --- | --- |
| GitHub main, response 05, source and checked-in captures | `b747d118bbb857d0ea08f98696d0714428d2f106`; implementation `fc6df0de7d66452caec8b35bfaa277220715a07e` | The current published implementation and the agent's check-in. |
| Pinned Lumina source | `ba838cca09ba43afceda0452b63d28df4cbf7f72` | Existing rendering capabilities and engine ownership constraints. |
| CJ's attached close-up | Screenshot supplied 23 November; exact running SHA not embedded | Direct human evidence of a large party panel covering the enlarged formation. It must not be presented as an independently verified runtime capture of a particular SHA. |
| Independently executed headless tests | 97 distinct tests; [verification record](evidence/2026-11-23/review-05/review-verification.json) | Rules, funding, payment, terrain, content, history, playback and related available tests. Four protocol tests could not load because the review environment lacks `hypercore-crypto`. |
| Actual-rules protection observation | Same pinned profile/source | A center member's base front Physical protection 1 becomes 2 with Bound Standard; copying archetype text omits that bonus. |
| Source interaction trace | Current app, inspection, camera and board code | Explains selection/popup coupling, current member anchors and the limits of the zoom heuristic. |

Response 05's **101/101 check and 219/219 browser assertions are the implementing agent's evidence**, not a new browser run by this reviewer. Its headless frame intervals are explicitly vsync-limited, not a rendering-capacity benchmark. No new live-browser, screen-reader, touch, GPU or CJ acceptance is claimed here. Local unpublished work and current Overwatch state were not accessible.

### Credit the completed foundation

The updated default view gives the board much more room. Both owners' Card banks remain in the world, Fire Pits and Mana basins express resources spatially, larger chess standards make movement identities easier to distinguish, and funded destinations have a shared rule quote. The response also records the three earlier reliability repairs and clear limits on its verification.

The next work can reuse the actual members, formation positions, glossary, selection cues, route previews, command paths, camera controls, terrain geometry and lifecycle handling. Retain these gains.

## Findings

### R5-01 — A selected party is forced to keep its detailed inspector open

**P1 · source-confirmed interaction problem and CJ-observed obstruction.**

The source chain is explicit:

1. `app._onPick` sets `selected` to the party.
2. Rendering calls `_syncInspection`, which pins the complete view for that selection.
3. The inspection controller's `onPin(null)` callback clears `selected`.
4. Right-click movement requires a selected party.

Closing the obstructing inspector therefore also clears the party needed for movement. The panel itself correctly contains pointer, wheel and context-menu events; the board correctly refuses click-through. These protections become obstructive because the panel opens automatically for an ordinary command selection.

**Change:** separate command selection, close-inspection subject, transient hover and explicit pinned reference. Closing a detail or glossary view must preserve command selection and draft orders. A full transparent panel with the same hit rectangle would retain the problem.

**Accept when:** at default zoom, selecting a funded party exposes its usable destinations without a full party panel; every visible legal target can be reached through the normal command gesture. Opening and closing information does not lose that selection. Preserve a short reason such as “Needs a Mount” for the unmounted Pawn in CJ's screenshot.

Source: [app selection and inspection][app], [inspection controller][inspect], [presentation styles][css].

### R5-02 — Party hover is still a full document, including during some targeting

**P1 · selected presentation change; targeting is a source-supported risk.**

`_onHover` maps member-aware picks to a whole-party subject at every zoom. It does not check `this.tool`. Although `InspectController.setSuspended` documents targeting suspension, its caller currently checks only Card dragging and camera dragging. Supply/ability targeting can therefore request an unrelated party inspector. That interaction was not independently replayed in a browser here.

**Change:** keep large Card hover views as requested in addendum 01; use a short party hint at ordinary distance. At close range, attach concise facts to real members and expand only an intentionally inspected member. Command targeting takes priority over unsolicited detail. Relocate essential actions currently housed in `_partyPanel` before suppressing that panel.

**Accept when:** selecting, moving, loading Supply, changing formation and targeting a skill work without zooming in. Camera gestures and legal-target gestures remain usable around passive labels. Card inspection, the required response surface, stale-plan acknowledgment and accessible navigation continue to work.

### R5-03 — Existing zoom and member support are useful, but not yet an inspection system

**P1 · implementation requirement.**

The board already has stable member sprite IDs, `anchorOf(member)`, member-aware picks and interpolation. Use these to attach facts to the visible bodies.

Current semantic zoom changes only the chess standard's size and opacity. Its territory-size estimate uses distance to the board center. That estimate cannot reliably determine label space for a particular party on a hill, near the camera or at a low angle. Current cursor zoom also intersects world `y=0`, while the new focus may be in a pit or above the surface. Existing F focus does not fit all member bounds.

**Change:** measure the actual inspected party and members in screen space; apply a readable label budget and hysteresis. Reuse the camera with a height-aware focus, bounds fitting and a remembered return pose. Choose one intentional inspection subject; do not reveal labels for every foreground party just because it becomes large.

**Accept when:** close inspection works at both seats, low and high pitch, full orbit, enlarged text and the supported height bands. Camera motion changes presentation, never facing, occupancy, orders or time.

Source: [board view][board], [camera][camera], [piece standards][pieces].

### R5-04 — Member stats need context and must agree with the visible moment

**P1 · data-truth requirement for the new labels; an existing omission is reproduced.**

The current member panel prints attack/protection definitions directly from the archetype. In a reproducible current-profile scenario, center member `A.C3.m5` has base front Physical protection **1**, but Bound Standard gives actual front Physical protection **2**. See the [observation](evidence/2026-11-23/review-05/member-protection-observation.json) and [reproduction](evidence/2026-11-23/review-05/member-protection-observation.mjs). Those panel strings must not become labels presented as “current Defense.”

Health can belong to individual members or a party pool. Protection can be directional, shared or line-based. Ranged power/range and melee charge behavior can depend on the target and context. There is no universally truthful, context-free single Attack/Defense pair.

The app also resolves authoritative state before visual playback. New labels following an early playback position must not quietly display the final health or later casualty state.

**Change:** expose one pure inspection read model from the real combat/profile logic. Show baseline versus applied values and source contributions where appropriate; qualify target-dependent previews. Align visible statistics with playback time, or explicitly label an accepted-result view as such.

Useful existing functions are `individualProtection`, `rangedShot`, `faceFrom` and `residual` in [combat.js][combat]. The line-defense path and charge calculations require correct shared handling. `rules/stats.js` is history analytics, not a live member-stat selector.

### R5-05 — The playable territory still reads as a slab, not an inhabited place

**P2 visual implementation; first study follows the P1 interaction work.**

The source renders a painted plane for the base field and intentionally places decorative scenery outside it. The checked-in overview is clearer than before, but close zoom enlarges the slab, outlines and sprites without revealing a local environment. This is the gap CJ is identifying.

**Change:** author one territory as a restrained, richly textured pixel diorama: ground under the actual feet, near props, a small world-stable landmark, a visible boundary and limited ambient motion. Relative scene depth supplies parallax under camera movement. Preserve the 3×3 footprint, contact strips and legal terrain.

Do not confuse decorative “window depth” with real negative bands. Open pits, roofed tunnels, hills and flyers already have mechanical meaning. Do not merely put scenery beneath the existing opaque plane or erase actual roofs to make the view prettier.

A single flat landscape that always turns toward the camera cannot provide coherent sides and backs through 360 degrees. Use bounded geometry and appropriate directional art first. A full portal renderer is a later option: the pinned engine and its post-processing targets currently disable stencil buffers.

**Accept when:** one ordinary territory and a genuine excavated/raised variant remain coherent through orbit, selection, movement, layering and return to overview. Decorations neither invent cover nor intercept gameplay picking.

Source: [ground painter][ground], [terrain view][terrain], [scenery][scenery], [pinned Engine][engine], [pinned Sprite3D][sprite].

### R5-06 — The next evidence must demonstrate a continuous interaction

**P1 acceptance coverage; preserve existing follow-ups.**

The current browser contract tests the old party pin behavior and overview geometry. Revise its expectations deliberately when the interaction changes; keep its unchanged reliability, funding, resource and Card assertions.

The first proof is **select → funded destination → zoom into the same party → read members → orbit → inspect terrain → return → issue another command**. A set of attractive stationary screenshots does not establish unblocked movement, correct focus, parallax or stable labels.

Retain the response's unverified cases: compact comparison, Major/row Cards, special endpoint states, text scale, grayscale ownership, paused-playback reset and the remaining glossary attachments. Prioritize those affected by this change rather than rerunning unrelated art work or declaring everything newly blocked.

## Next run

Follow assignment 06. Deliver the information/selection change first, then the one-territory environmental proof. Keep exact rules and resource behavior stable. Record the next response using the next unused number, expected **06**. Update the existing Overwatch cards or their appropriate follow-ups; do not create another task-state system. CJ acceptance is not recorded by this review.

[app]: https://github.com/calderwong/hapa-verseUs-prototype/blob/b747d118bbb857d0ea08f98696d0714428d2f106/src/hapa/presentation/app.js
[inspect]: https://github.com/calderwong/hapa-verseUs-prototype/blob/b747d118bbb857d0ea08f98696d0714428d2f106/src/hapa/presentation/inspect.js
[css]: https://github.com/calderwong/hapa-verseUs-prototype/blob/b747d118bbb857d0ea08f98696d0714428d2f106/src/hapa/presentation/versus.css
[board]: https://github.com/calderwong/hapa-verseUs-prototype/blob/b747d118bbb857d0ea08f98696d0714428d2f106/src/hapa/presentation/board-view.js
[camera]: https://github.com/calderwong/hapa-verseUs-prototype/blob/b747d118bbb857d0ea08f98696d0714428d2f106/src/hapa/presentation/camera.js
[pieces]: https://github.com/calderwong/hapa-verseUs-prototype/blob/b747d118bbb857d0ea08f98696d0714428d2f106/src/hapa/presentation/pieces.js
[combat]: https://github.com/calderwong/hapa-verseUs-prototype/blob/b747d118bbb857d0ea08f98696d0714428d2f106/src/hapa/rules/combat.js
[ground]: https://github.com/calderwong/hapa-verseUs-prototype/blob/b747d118bbb857d0ea08f98696d0714428d2f106/src/hapa/presentation/ground-painter.js
[terrain]: https://github.com/calderwong/hapa-verseUs-prototype/blob/b747d118bbb857d0ea08f98696d0714428d2f106/src/hapa/presentation/terrain-view.js
[scenery]: https://github.com/calderwong/hapa-verseUs-prototype/blob/b747d118bbb857d0ea08f98696d0714428d2f106/src/hapa/presentation/scenery.js
[engine]: https://github.com/calderwong/lumina-hapa/blob/ba838cca09ba43afceda0452b63d28df4cbf7f72/src/engine/core/Engine.js
[sprite]: https://github.com/calderwong/lumina-hapa/blob/ba838cca09ba43afceda0452b63d28df4cbf7f72/src/engine/sprite/Sprite3D.js

