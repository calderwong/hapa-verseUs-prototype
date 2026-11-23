# Next implementation assignment 05 — play through the board

**CJ's next local coding run.** Implement the latest human-feedback direction recorded in [addendum 01](../requirements/2026-11-22-human-feedback-addendum-01.md), using [review 04](2026-11-22-ui-design-review-04.md) for source findings and rationale. This replaces assignment 04's permanent-HUD assumption while carrying forward its correctness repairs.

## Goal and source

The player should understand and act through the board: hover a Card, inspect a party, assign Supply, place that party's recognizable chess marker at an affordable destination, review/Ready, and understand the result. Burning a Card should happen through an in-world Fire Pit and visibly feed exact Mana into the owner's basin. Terms and stats explain themselves in context. Ordinary play should no longer reserve large regions for duplicate hands, an inspector or instructional paragraphs.

The latest remote head inspected was **`a388bcf9b56fb873eec5862d32fc5dbaaeb092d0`**. It adds review notes to implementation **`164b8dfe46d2b6b8ec0975cc8f53ea5428770230`**; no newer implementation/response 05 was pushed at that check. Engine **`ba838cca09ba43afceda0452b63d28df4cbf7f72`** is unchanged. Inspect the actual local branch, status, handoffs, sessions and Overwatch before changing anything. Preserve unfinished local work and any fixes already completed.

## Read and preserve

Read `AGENTS.md`, its available local Hapa grounding, `docs/reviews/README.md`, the new addendum and review 04. Use Master Requirements v3 for unchanged behavior, with the addendum's explicit new endpoint-funding policy for the new default match profile. Use the Companion/References Master for compatible spatial and art guidance.

Keep deterministic headless rules, signed agreement/replay, public information, Card identity/provenance, first-Ready freeze, stale acknowledgment, one resolution, correct physical-column mapping, height-aware selection/playback and actual-versus-planned state. Do not edit the engine vendor in place. Use the existing owner workflow for any necessary engine or media work.

Safely fetch these notes. Do not reset/clean/overwrite the local checkout. Overwatch `hapa-versus` remains canonical; append implementation evidence through its actual interface. Inspect current dependencies rather than inventing a waiver or copying stale card statuses. CJ's new direction is selected scope; CJ acceptance of finished work remains separate.

## Work sequence

### 1. Establish a trustworthy interaction foundation

First check whether R3-01/R3-02/R3-03 are already fixed locally. Otherwise reproduce and repair: authoritative response affordability (one Rainbow cannot pay two separate color requirements), session ownership of pending responses/playback/async work, and modal focus/background containment. Keep the repairs bounded and verify their demonstrated failure modes. These protect the new resource and inspection systems.

Create one inspection controller with stable match/object IDs and separate hover, selected, pinned, focused and active-command states. Reuse the existing semantic Card/party/member/event content and validation routes. Suggested seams: `app.js` layout/hover/inspectors, `board-view.js` picking/anchors, `camera.js`, `card-drag.js`, `versus.css` and `explain.js`. New module names are an implementation choice.

### 2. Move Card and party interaction onto the board

Implement hover/focus inspection for Minor Arcana, Major Arcana and row Enchantments, for both owners. The large view must be readable without clicking, stable while scanning, enterable with the pointer and dismissible. Support optional pin/compare, tap-to-pin and named keyboard navigation. Interactive inspection is nonmodal; pure definitions use tooltip behavior. The addendum gives starting timings and content order.

Party hover shows chess identity, state, held/planned Supply, route, height/exposure and the actual 3×3 composition. Member bodies map to their real slots; member details remain reachable through named controls. Hover does not change selection, command targets, facing, camera or Tick progress.

**Change framing with layout:** the current Home subject deliberately excludes world banks because ribbons show them. Fit the field plus both owners' actual bank/resource extents, then remove both permanent external Card ribbons, the permanent right inspector, the separate Mana panel and the default full roster. Preserve an on-demand navigator and explicit offscreen focus/inspect routes. Do not leave important Cards outside the default camera with no practical target.

Retain compact phase/active-column state, Orders, one Ready/Acknowledge, menu and current targeting controls. Stale-plan review and required responses must appear when needed and remain operable. Update help and controls to the new route; do not leave directions pointing at removed panels.

### 3. Make parties read as chess pieces and destinations obey Supply

Introduce a large, stable chess standard for each movement family, including unmounted Pawns and a distinct Commander. Use semantic zoom: overview identity, tactical composition, inspection detail. Decorative transparency must not falsify members/occupancy or make hit targets flicker. Keep owner, world-facing, band and empty-center semantics distinct.

Implement persistent endpoint ghosts keyed by party ID. They use the same identity in a hollow intent style, with explicit draft/travelling/paused/blocked status. Show all public destinations quietly and emphasize the selected/hovered relationship. Handle coincident targets, different height bands, arrival, replacement, merge and retirement. Markers are never real occupants or income anchors.

Implement the addendum's **new profile policy**: the full remaining voluntary route must be funded by held Supply plus valid earlier planned loads. Build one shared exact quote covering Mount route, unfinished current edge/backtrack, fixed-point costs, valid plan prefix and the actual debit policy. Use it for every input route, bots, validation and peers. Keep Speed as rate; do not impose a one-Tick radius or prepay travel.

Remove the twelve-target no-pointer cap; expose every funded legal target through a scrollable/coordinate route. Removing or reassigning a funding Card makes the dependent draft visibly invalid and blocks Ready until repaired. Do not silently shorten the goal or discard the order. Retain an accepted goal through later interruptions; a rejected replacement preserves it.

Update bot ordering because it currently places destinations before Supply. Check the configurable Knight-cost/debit seam and preserve explicit free-follow exceptions. Version this behavior and preserve old partial-Supply replays with real compatibility dispatch; leave historical golden expectations under their legacy profile.

### 4. Integrate Fire Pits and exact Mana basins

Place one owner-marked pit/basin pair on each non-playable frame edge. Keep actual nonzero color counts sharp and available through attached projected controls; the complete named breakdown is inspectable. Refit camera/access as needed without introducing obstacles in legal cells/contact strips.

Make Card drop and the named Burn action emit the same command. Planning creates a ghost offering and projected gain; accepted `card_burned` creates flame/streams; `mana_paid` shows exact assigned spending; `mana_expired` shows the real boundary result. Mixed Mana colors stay separate, and Rainbow stays distinct until payment. Zero-Mana Cards clearly yield zero and receive no gain effect. Undo/rejection/frozen/opponent-use cases cannot consume resources in presentation.

Replace the burn-only `_plannedPool` shortcut with a truthful projection of valid ordered resource actions and payments. Keep committed and projected amounts visually separate. Deduplicate effects by event/match identity and preserve response usability, replay, reduced motion and New match cleanup. Never let arrival of a particle change a real counter.

### 5. Complete contextual teaching and apply the Hapa treatment

Author one shared glossary for all currently visible mechanical/stat labels, abilities and state terms. Derive current-state examples/modifiers from installed rules/content. Use it across Card/party views, orders, resources and results. Keep concise action-time explanations; move long tutorial material to optional Help/onboarding. Cover unavailable actions without making the player hunt through another document.

Apply the richer brushed-pixel/comic terrain, character, carved frame and restrained alignment effects to this working interaction scene. Use approved owned media or a clearly provisional sample through existing authorized workflows. Preserve asset provenance. The previous terrain/party study is now part of proving the complete interaction, rather than a separate art run ahead of the unwanted layout's replacement.

## Focused acceptance journeys

Use declared source/engine/profile/asset versions and unique evidence runs. These checks establish the new behavior; they do not certify every accessibility or performance case.

| Journey | Required result |
| --- | --- |
| Quiet default and Card scan | At 1280×720 and 1600×1000, no permanent duplicate ribbons/inspector/Mana panel. Both owners' actual banks remain reachable. Hover several own/opponent Cards and every Card type without clicking; correct identity/details appear promptly and stay readable. |
| Hover, pin and command separation | Move into a view, inspect a term, pin/compare, dismiss, drag a Card and orbit. No unintended selection/order/camera action or focus theft. A blocking decision takes priority without losing its state. |
| Party/chess reading | Identify all movement families, Pawn and Commander at overview; inspect actual slots/member details at closer scale. Check ownership without hue, empty center, Mount lost, both seats, full orbit and height filtering. |
| Funded range | Castle Supply 2 offers two normal steps but not three; Knight Supply 2 rejects the full L and Supply 3 allows it. Rate remains separate. Check fractional mid-edge replacement and a nondefault cost profile against actual debit. |
| Planned resources and bot parity | An earlier valid load funds a destination; a later/unassigned/competing-use Card does not. Removing funding blocks Ready with a repair path. Pointer, keyboard, bot and peer acceptance agree. |
| Simultaneous intent | Several parties have targets, including coincident targets and different bands. Each live/endpoint pair is identifiable. Arrival, pause, merge and rejected replacement reconcile correctly; ghosts never enter rules occupancy. |
| Fire Pit and payments | Plan/undo/reject/resolve burns with one color, multiple colors, Rainbow and zero Mana. Verify exact actual/projected counts, source exclusivity, paid ability/counter and expiration/carryover. No fake gain or delayed required choice. |
| Definitions and result inspection | Inspect a Card effect, movement/stat term, member modifier and resolved result in context. No stale identity after consumption, bank replacement or merge. Every player-facing mechanical label has an authored source/definition route. |
| Non-hover input and resilience | Complete the basic inspect/load/move/Ready/result route without pointer or test-only focus resets; tap-to-pin exposes the same actions. Check enlarged-text reflow for new views, reduced motion/mute, replay/fast-forward and New match during a pending choice/effect. |
| Compatibility | A legacy partial-Supply replay still verifies under its old policy; the new funded-endpoint replay verifies under its new one. Existing free-follow and frozen-plan rules remain intact. |

Adapt obsolete browser selectors to the new behavioral contract; do not keep redundant panels just to pass an old selector. Retain meaningful freeze/single-resolution/payment/lifecycle assertions. Run `npm run check`, focused new rules/controller tests and the actual browser journeys. Record measurements of scene frame time and hover responsiveness on the declared machine, with the same before/after route; do not invent an approved performance target.

## Return these deliverables

- Coherent, separable implementation commits with selected behavior, expected result and observed result.
- Response **05** if unused; otherwise the next unused number. Explicitly name review 04, this assignment and the human-feedback addendum. Use `IMPLEMENTATION_REPORT_TEMPLATE.md` and preserve earlier files.
- Same-state before/after captures for quiet play, Card hover, party composition, endpoint intent and the Fire Pit sequence, plus machine-readable checks and a short visible walkthrough where existing tools support it.
- Exact source/dirty-state/engine/profile, viewport/DPR/scaling, camera/layer, asset identity/provenance and performance context. Label provisional art and unverified cases.
- Updated review index, relevant requirement/profile documentation and append-only Overwatch evidence. Distinguish implemented, verified in these cases and accepted by CJ. Keep unrelated backlog visible without expanding this run into an engine rewrite or new game economy.
