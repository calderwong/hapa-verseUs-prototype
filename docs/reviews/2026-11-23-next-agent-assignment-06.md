# Next agent assignment 06 — Command freely, inspect by approaching

**23 November 2026.** Implement CJ's latest party-inspection and territory-environment direction. Start with [review 05](2026-11-23-ui-design-review-05.md), then [human-feedback addendum 02](../requirements/2026-11-23-human-feedback-addendum-02.md). Preserve the compatible work in addendum 01 and response 05.

## Goal the player should experience

At ordinary zoom, click a party and give it a funded destination without an information Card covering the field. Zoom toward the same real formation and read each visible member's role and true health beside its body; inspect one member for its detailed combat explanation. As the camera gets closer and turns, reveal a coherent Hapa pixel environment inside the territory. Zoom back out and continue commanding the same party.

This is presentation and shared inspection-data work. It does not change movement, Supply, combat, terrain or turn rules.

## Start from current reality

The reviewer checked main `b747d118bbb857d0ea08f98696d0714428d2f106`, implementation `fc6df0de7d66452caec8b35bfaa277220715a07e`, engine pin `ba838cca09ba43afceda0452b63d28df4cbf7f72`. Inspect the actual checkout, recent commits, uncommitted work, sessions and Overwatch before editing. Preserve work already completed since that review.

Follow AGENTS.md and local shared Hapa grounding. Overwatch `hapa-versus` remains canonical; use the existing relevant cards/HV-57 follow-ups where appropriate, append evidence and keep CJ's acceptance role. Do not invent board receipts or call a card Done.

Response 05 successfully implemented the previously specified full party hover view. CJ is now refining that interaction after using it. Do not undo the Card banks, Fire Pits, funded destinations, glossary or reliability repairs.

## Deliver in this order

### 1. Separate selection, inspection and command tools

Address R5-01/R5-02 and HF2-01/HF2-02.

Current source:
- `app._syncInspection` automatically pins the selected party/member.
- The InspectController `onPin(null)` callback clears selection.
- `_onHover` sends all member/party hits to the full-party inspector.
- `_frame` suspends inspection for Card/camera drags, but not all active targeting tools.

Remove that automatic coupling. Ordinary party selection must not open the large detail view. Closing information must retain the command-selected party and draft orders. Hovering a public Card still opens its full Card view.

Move essential commands and disable reasons out of the mandatory party document before hiding it. Use a small contextual command group with existing direct gestures, keyboard controls and navigator. Keep the required response/acknowledgment surface discoverable and operational.

Verify a funded default-zoom move and a visible “Needs a Mount” reason for an unmounted Pawn before proceeding to visual embellishment.

### 2. Build one correct party/member inspection read model

Address R5-04 and HF2-04/HF2-05.

Extract shared data for identity, real membership/slot, displayed position/visibility, health mode, party resources, base attacks, applied protection/effects, conditional target preview and source explanation.

Do not copy `_memberPanel`'s raw archetype lists and label them current stats. The review's Bound Standard observation is a ready-made regression case: base front Physical protection 1, applied protection 2 with named sources.

Use actual combat logic, including the individual/line-defense distinction and target-dependent ranged/charge behavior. `rules/stats.js` contains history analytics, not live combat selectors. Keep any extracted selector pure and independent of presentation. Preserve fixed-point values and profile compatibility.

Define what the displayed stat snapshot means during playback. The resolved final state currently exists before animation begins. Do not follow an early-time sprite with a future hit/death value unless it is explicitly identified as an accepted result. Prefer event-aligned presentation facts.

### 3. Let the actual formation become the inspector

Address R5-03 and HF2-03/HF2-06/HF2-07.

Reuse `BoardView.sprites`, member IDs, `anchorOf`, member picks, the existing projection, glossary and camera.

Add a bounded label layer for one intentional close-inspection party. Reveal role and true health first; add concise combat facts as room permits; expand one member on hover/focus. Keep party Supply, Mount, facing and shared health collective. Empty centers remain empty; helper labels follow the real body.

Use projected member/party bounds and available CSS-pixel space, not only camera distance to board center. Retain hysteresis and stable placement. Labels must not become nine separate pointer-blocking Cards.

Extend the existing F/Focus and cursor zoom for actual band height, bounds fitting and return to the prior camera. Preserve yaw where possible and do not move the camera on ordinary select/hover. Do not change facing, coordinates, selected command party or orders.

Use upright sharp text, safe contrast, bounded collision handling and explicit occlusion/layer rules. Preserve camera gestures and target acquisition. Provide equivalent keyboard/touch/compact-reading access with the existing navigator where practical.

Deliver a working plain-tile inspection checkpoint before starting the environment.

### 4. Author one territory environment that survives camera movement

Address R5-05 and HF2-08/HF2-09/HF2-10.

Build one richly authored but readable territory and a small surrounding context using the existing shared world scene. Use the established brushed-pixel Hapa material language, real ground contact, restrained rim/alignment light, a few near props and a world-stable landmark at another depth.

Choose an asymmetric environment so a 360° orbit can prove the scene is anchored. Keep landmarks/decorative terrain distinct from actual cover or movement rules. Reuse suitable native sprite direction, lighting and selective fade capabilities.

Keep all gameplay geometry, member positions and contact strips unchanged. Decoration must not be pickable. The existing opaque base plane must be deliberately handled if making a visual aperture; adding invisible scenery below it is not a completed window.

Include a real excavation/raised-terrain case using existing rules, roofs, ramps and cutaways. Planned, running and completed work must look different and follow real events. A cosmetic inset is not a new negative band.

Do not begin with an offscreen portal world per territory. A true stencil portal would require engine work because the pinned engine and post targets disable stencil. Follow the Lumina fork workflow if a measured need for engine changes arises; never patch vendor/lumina in place.

### 5. Verify the journey and finish the handoff

Address R5-06. Update browser regression expectations for the deliberate new contract. Retain unchanged funding, replay, payment, response, New match and Card assertions.

Record a short continuous journey: ordinary selection → funded destination → close approach → read members → orbit → inspect a genuine terrain change → return → issue another command. Include a full nine-member case and the five-member empty-center Pawn.

Make the capture reproducible from a named fixture, profile, seed, seat, camera and exact revision. Report source commit separately from the evidence/report commit. A fixture is acceptable when labeled; do not present an art-only scene as running rules.

Measure before/after in the same environment: input-to-feedback, zoom entry, frame timing, available CPU/GPU metrics, renderer object/texture counts and DOM/layout work. State when a metric is vsync-limited or unavailable. Do not claim a new performance target has been approved.

## Acceptance cases

| ID | Situation and expected result |
| --- | --- |
| Z01 — Ordinary movement | At default zoom, select a funded mounted party. No large party inspector opens. Every visible legal destination remains reachable with the existing gesture and exactly the same Supply quote. Closing an information layer retains selection/orders. |
| Z02 — Command availability | Supply, formation, Move and skills remain usable without close zoom. An unmounted Pawn shows why movement is unavailable. Frozen/inactive/invalid/response states retain their actionable explanation. |
| Z03 — Correct subject | Zoom toward an enemy while an own party remains command-selected. Inspect the enemy's public facts without changing that selection or issuing an order. Nearby parties do not unexpectedly steal inspection. |
| Z04 — Real composition | A nine-member party and a five-member Pawn reveal compact member type/health at a readable fit. No extra center member is invented. A helper away from its slot keeps its identity and follows its visible body. |
| Z05 — Accurate stats | Verify member-health and party-pool profiles, individual and line protection, an applied Bound Standard/equipment modifier, an elevation-aware ranged preview and a directional defense. Show base/current/context clearly with real sources. |
| Z06 — Playback consistency | During moving and paused playback, displayed bodies and health/status refer to the same moment or clearly marked result. Death, merge, arrival, helper return and New match remove stale labels and focus references. |
| Z07 — Camera and layers | Orbit 360°, tilt, pan and zoom at surface, raised ground, open pit, roofed tunnel and flyer bands. Anchors use the actual height. Label visibility respects roofs/layers/cutaway, and world facing remains unchanged. |
| Z08 — Targeting priority | During Card drag, Supply/ability targeting and camera drag, no unsolicited broad detail steals input. Passive text does not block movement. Intentional Card/term controls do not click through to the board. |
| Z09 — Card and required UI | Public own/opponent Cards still enlarge without zoom. Ready, Orders, stale acknowledgment, required responses, Fire Pit and Mana values remain accessible and correct. Include Major/row Card fixtures affected by the changes. |
| Z10 — Readability and alternate input | Test 1280×720 and 1600×1000, both seats, high DPI, 150%/200% text/browser scale, keyboard and a real touch test if available. Document untested inputs. Small layouts provide an intentional reading alternative without clipping facts/actions. |
| Z11 — Living territory | The authored territory reveals real relative depth through camera motion. No front-facing landscape sticks to the camera. Ground, legal footprint and selected targets remain readable; decorations cannot alter or intercept rules. |
| Z12 — Terrain truth and resources | Planned dig, running work, accepted excavation, roofed cutaway and raised ground remain distinct. Repeated zoom/orbit/New match does not leak presentation resources or replay old effects. Reduced motion remains useful. |

Run the applicable existing check and targeted new behavioral tests. Avoid snapshot assertions that merely enshrine whatever the implementation happens to render.

## Report requirements

Write implementation response **06 if unused**, otherwise the next unused number. Include:
- exact source/engine/profile revisions;
- which review/HF2/Z IDs were implemented;
- the normal-zoom and close-inspection commands a human can use;
- actual versus proposed visual behavior;
- test commands and results, with missing tests honestly marked;
- reproducible captures and measured performance;
- actual asset provenance;
- concrete remaining gaps and their priority;
- genuine Overwatch receipts if updated.

Do not stop at a plan or replace the task with a new general UI framework. Implement the first working interaction, verify it, then complete the one-territory environmental proof and report what CJ should inspect.

