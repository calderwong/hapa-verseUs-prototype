# Human-feedback addendum 05 — An opponent seated across the table

**Date:** 24 November 2026 (CJ's local date)  
**Applies to:** Hapa Versus presentation and the connected Avatar/music experience.  
**Selected human direction:** The Mesh Avatar belongs inside the gameplay environment, directly across from the human, at the apparent scale of an opponent sitting across a chess table.  
**Reviewed implementation:** [3b812f1](https://github.com/calderwong/hapa-verseUs-prototype/commit/3b812f1877c3d00b080268e57fce5137e574669d).  
**Companion documents:** [Review 10](../reviews/2026-11-24-ui-design-review-10.md), [Assignment 11](../reviews/2026-11-24-next-agent-assignment-11.md).

## 1. Why this changes the design

CJ reports that the new Mesh Avatar feels like a toast notification. The reviewer's live observation agrees: a small animated portrait occupies a bordered upper-right card; the soundtrack strip sits below it. Rotating the board leaves that card in the same screen corner. The attachment supplies a performer, but the composition does not give that performer a place at the table.

The earlier integration proposal's compact perch was the reviewer's recommendation. The coding agent substantially implemented that selected direction. This addendum corrects the design target; it is not a claim that the agent ignored the earlier brief.

The experience to build is: **you sit at a game table with Red. The board is between you. Red is present while considering a move, reacting, or remaining quietly attentive.** Speech is an action by that opponent. It does not summon the opponent into a notification card.

This addendum supersedes the earlier compact-perch layout wherever it conflicts. It preserves the existing owner boundaries, game rules, one-press Ready, optional history, current-Tick Mana, contextual Card inspection and close member inspection. The Avatar is an environmental participant, not a board unit, rule-state object, territory occupant or hidden source of game knowledge.

The following implementation choices are working design defaults for this pass. CJ has selected the seated, across-the-table experience; exact framing ratios, pose treatment and material tuning remain adjustable during the connected visual fit.

## 2. Compose the table and opponent together

### 2.1 The seat

Bind the opponent to the actual opposing seat. For the default A-human/B-bot configuration, Red sits beyond B's far edge, centered on the table's longitudinal centerline. Derive the position from board geometry and seat identity. Swapping human/controller seats must produce the corresponding composition.

The seat must be outside the full game footprint, including the Major Arcana and Minor Arcana banks, Fire Pit, Mana basin and their interactions. “Behind the enemy army” does not mean on the back row or inside a Card bank. The existing board frame already provides physical edges and bank footprints; use those dimensions.

Give the figure a stable lower-body pivot and a grounded relationship to a chair and far table apron. A simple chair back, table-edge occlusion and restrained contact shadow can establish the first version. Use existing owner-provided pose capabilities. If the available rig is standing, an authored upper-body crop and convincing waist occlusion may be used for this first pass, but do not present visible standing legs as a seated result. Record any missing owner-art requirement precisely.

Red's eyes, face and shoulders should be readable at the default view. Keep the table between human and opponent. Avoid an isolated head floating above the board or a huge figure standing on the battlefield.

### 2.2 Starting scale and framing

Author world dimensions relative to the table, then adjust the default camera and subject bounds together. Do not enforce a constant screen-pixel size across all zoom levels.

Useful starting art targets for an ordinary desktop Home view are:

| Relationship | Starting target, adjustable during fit |
| --- | --- |
| Apparent shoulder width | About 35–50% of the far table edge's projected width |
| Head height | About 10–14% of the usable game viewport height |
| Visible head and upper torso | About 24–34% of the usable game viewport height |
| Overall composition | Opponent in the upper portion; board remains the primary actionable surface below |

These are composition guides, not independent pass/fail thresholds. Do not distort the body to satisfy them, or shrink the board until moves, Cards and chess markers become difficult to read. Prefer a coherent seated composition over optimizing four separate ratios.

Keep the full playable board and required Card banks useful at Home. A somewhat lower or differently targeted camera may improve the sense of looking across a table, but choose the angle from the actual scene. Current perspective fitting was designed around ground-level geometry; raising an Avatar without changing the fit can clip its head.

Use the current human-like Red assets faithfully. This task does not authorize a new likeness, a replacement identity or an arbitrary pixelation filter. Match edge treatment, illumination and grounding to the Hapa environment without making the face muddy.

### 2.3 Persistent presence and restrained acting

Keep the opponent present when silent. Use the rig's supported idle motion, expressions or gaze to convey attention. At Home, the default orientation faces the human's seat, with board-directed attention where the available rig can express it.

React to displayed, legitimately observable game events through the existing reaction boundary. Do not react to a concealed future playback event, opponent-private information or a different match. A late generated line must never hold the game open.

If voice is muted, visual presence remains. Use a supported silent animation/expression path when one exists; do not generate silent speech merely to drive the rig. If only idle animation is currently supported without audio, deliver that honestly and record the richer silent-reaction seam as a bounded follow-up.

## 3. Camera behavior is part of the requirement

“Across from the player” defines the Home composition from the human seat. It does not mean teleporting Red to the opposite side of the camera whenever the camera rotates.

| Player action or view | Required behavior |
| --- | --- |
| Home / ordinary play | Frame the board, usable banks and seated opponent as one scene. The Avatar has natural perspective and table occlusion. |
| Pan or orbit | Keep the physical seat fixed. Red moves across the screen through camera projection and may leave the frame. Do not chase the camera with the seat. |
| Full 360-degree orbit | Preserve the existing camera freedom. Use supported side/back art if available. With a frontal-only rig, fade unsupported body views to the persistent chair/seat presence instead of showing a mirrored or constantly front-facing body from behind. The supported angular range is an implementation parameter to document. |
| Tactical / near-overhead view | Prioritize board readability. The body may recede, narrow or fade; do not enlarge it to maintain a portrait-sized presence. A compact optional presence control can return to Home. |
| Zoomed member inspection | Fit the intended territory and its member details. Do not include the distant opponent in this camera fit. Preserve existing command selection versus inspection behavior. |
| Return from inspection | Restore the saved prior camera pose. Home remains an explicit way to restore the across-table composition. |
| Low angles or body/board overlap | Respect normal depth. Use a restrained cutaway/fade when the body would obstruct an actively inspected territory or interaction. Do not draw the Avatar over the board with depth disabled. |
| Height-band filtering | Treat the opponent as environment. It must not be classified as a flyer, trench occupant or legal board target. |

A 2D puppet is not a complete 3D body. The first version must define a convincing, limited-art orbit policy while retaining full camera control. Creating eight new views or a fully modeled 3D character is not a prerequisite for this assignment.

Camera transitions should preserve orientation and avoid fighting the player's input. Automatic Home framing happens at match setup, explicit Home, or an equivalent intentional action. Do not repeatedly refit the camera during a manual orbit or unit inspection.

## 4. Make the UI support the encounter

### 4.1 Remove the notification treatment

The default scene must not show a bordered portrait card with persistent connection/status prose. A small nameplate on the chair or table apron can identify Red. Technical health and binding details belong in an intentional details/debug surface.

Clicking the figure or nameplate may open conversation controls. Provide a keyboard-accessible equivalent. Use a separate social hit target so clicking the opponent cannot issue a board command or conceal a movement destination.

Keep the conversation input stable while the performer updates. Speech start/end, loading, captions and expressions must not erase a typed draft, reset selection or steal focus.

### 4.2 Captions and controls

Keep captions concise and nonblocking, normally no more than two visible lines before voluntary expansion. Reserve or collision-manage their space so they do not cover a Card bank, the far ranks, a selected territory or an active movement target.

A subtle caption area near the far apron can work at Home. When the opponent is outside the view, use the established accessible caption region rather than dragging a speech bubble over arbitrary squares. History remains available on request.

Mute, stop speech and conversation controls must remain quickly discoverable by pointer and keyboard. Hiding all controls behind an unexplained hover is insufficient. Keep accessible names and tooltips; a small consistent control can serve this purpose without rebuilding the admin-style panel.

### 4.3 Separate music from the body

The music player should not be attached below the opponent as the second half of a notification stack. Keep a compact, independent Now Playing surface. A later table-side music device can give it physical character; a small dedicated strip outside board interactions is sufficient for this pass.

Keep title, source/creator information, introducer, Listen/Not listening, volume and Keep truthful and accessible. The person introducing a song is not automatically its creator. Saving an unheard offer must not claim the player heard it.

A new decorative music prop, a full music browser and a library redesign are outside this assignment. Preserve the currently connected owner playback/retention path and fix the concrete state/retry defects from Review 10.

## 5. Recommended implementation route

Reuse the existing Harbor performer. Current Versus imports the real RedPlayer, obtains a scoped utterance and checks Avatar/renderer/Voice-Card identity. Preserve this controller and owner relationship.

Add a presentation-only scene attachment around its output:

1. Give Table an explicit attachment interface from BoardView: an owned scene group or equivalent, the bound seat transform, useful bounds, an update hook and disposal. Table currently receives only a DOM element.
2. Render the owner's output on a transparent scene surface, such as a Three.js CanvasTexture plane, with authored dimensions and lower-body pivot. BoardView already uses canvas textures. This route should not require editing the Luminati vendor or changing the engine pin.
3. Qualify the owner canvas contract once: transparent output, usable frame source, update notification/timing and cleanup. If its gray rectangle is baked into rendered pixels, CSS cannot remove it. Use the owner's alpha/background controls or a properly bounded owner change; do not color-key away clothing or skin.
4. Keep one performer/audio owner. Sample the existing rendered output; do not run a second voice/puppet instance or repeatedly encode frames as image URLs. Update the texture when necessary and pause unnecessary uploads when hidden.
5. Let the body participate in scene depth. Tune alpha edges and transparent sorting against the table and landscape. An always-on-top HUD-label material is inappropriate for the body. Use a cheap grounded shadow treatment if the renderer cannot produce a true scene shadow.
6. Extend Home fitting from the current ground-plane rectangle to the actual 3D bounds of table, banks, seated head and shoulders. Tactical and close-inspection fits use their own relevant subjects.
7. Dispose the texture, geometry, material, group, frame subscriptions and pending operations when the match/Avatar changes. Failed or superseded owner loading must also release resources. Preserve epoch checks in addition to cancellation.

These are proposed seams, not names of APIs already implemented. Inspect the current local owner and presentation code before choosing the smallest compatible shape.

Primary technical references: [current Table](https://github.com/calderwong/hapa-verseUs-prototype/blob/3b812f1877c3d00b080268e57fce5137e574669d/src/hapa/presentation/table.js), [AvatarOpponent](https://github.com/calderwong/hapa-verseUs-prototype/blob/3b812f1877c3d00b080268e57fce5137e574669d/src/hapa/presentation/avatar-opponent.js), [BoardView](https://github.com/calderwong/hapa-verseUs-prototype/blob/3b812f1877c3d00b080268e57fce5137e574669d/src/hapa/presentation/board-view.js), [camera](https://github.com/calderwong/hapa-verseUs-prototype/blob/3b812f1877c3d00b080268e57fce5137e574669d/src/hapa/presentation/camera.js), [board frame](https://github.com/calderwong/hapa-verseUs-prototype/blob/3b812f1877c3d00b080268e57fce5137e574669d/src/hapa/presentation/boardframe.js), [Three.js CanvasTexture](https://threejs.org/docs/pages/CanvasTexture.html), [Three.js Material depth/alpha controls](https://threejs.org/docs/pages/Material.html).

## 6. Evidence needed to call this technically ready

One connected candidate must demonstrate:

- A normal desktop Home view with a clearly seated, readable opponent across the table and an actionable board.
- An orbit and one reverse-side view showing that the seat is spatially fixed and the limited 2D art policy is deliberate.
- Tactical view and close member inspection without the Avatar taking over the fit; Return and Home behave distinctly.
- Working input, captions and basic conversation without losing a typed draft or blocking moves. Quiet mode accepts the first direct question.
- One actual connected performance using the bound owner, plus an unavailable-owner/text fallback that leaves the match playable. Do not manufacture a voice result if the owner is unavailable.
- Music title/Keep identity follows the chosen and actually played track; Not listening remains respected through pending fetches and resume; failed Keep has a real retry.
- Relevant disposal/cancellation and model admission corrections from Review 10, using bounded checks.
- A handoff stating source revision, local dirty state, effective setup, viewport and owner revisions. Screenshots used in the handoff must come from the exact declared candidate.

Use a normal desktop viewport around 1440×900 or 1920×1080 for composition, then check the wide layout already observed by CJ/reviewer if practical. These are a small set of visual witnesses, not a browser-size certification matrix. CJ makes the aesthetic acceptance decision after seeing the candidate.

No new gameplay rule profile, full owner rebuild, model-strength benchmark, remote music-room implementation or historical regression campaign is implied. Existing mandatory final checks still apply under Loose Screws.

