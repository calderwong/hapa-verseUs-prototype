# Human feedback addendum 01 — Cards, parties and Mana on the board

**Selected direction from CJ, 22 November 2026 (America/Los_Angeles).** This addendum translates CJ's five human-playtest observations into a coherent next implementation contract. It accompanies [review 04](../reviews/2026-11-22-ui-design-review-04.md) and [assignment 05](../reviews/2026-11-22-next-agent-assignment-05.md).

## 1. Authority and the change in direction

CJ wants the battlefield to carry more of the interface: inspect Cards and parties where they exist, recognize parties as chess movement pieces, see their intended destinations, and turn Card burning into a visible Fire Pit-to-Mana interaction. Definitions should appear where a player encounters a term. Permanent duplicate hands, teaching blocks and a large reserved inspector consume space that should belong to play.

The table distinguishes **CJ's selected requirements** from **working design defaults proposed here**. Defaults are concrete starting behavior for implementation and playtesting; they are not additional verbatim decisions by CJ.

| Requirement | CJ's selected direction | Working design default |
| --- | --- | --- |
| HF-01 — Board Cards and rapid inspection | Remove the redundant external Supply Card hand; hover any Card, including an opponent's, to see a large readable view and details without clicking. | Remove both permanent external Card ribbons. Use the physical Minor/Major/Enchantment banks plus one transient anchored inspection view; support pinning and an on-demand object navigator. |
| HF-02 — Contextual party information | Hover a unit to understand its composition/details; remove the massive always-on right information section. | One shared Card/party inspection system; party summary plus a 3×3 composition view, with member detail inside it. No reserved inspector column during ordinary play. |
| HF-03 — Chess identity and destinations | Make chess identities much easier to read; use transparency/hover creatively; put the same piece marker at its intended destination. | A strong chess silhouette at overview scale, full members at closer scale, and distinct hollow endpoint markers for public destinations. |
| HF-04 — Supply-funded destination selection | A destination marker may only be placed as far as Supply permits. | Fund the entire remaining voluntary route from held Supply plus valid earlier planned loads. Enforce this in shared rules, with an explicit compatibility policy for older matches. |
| HF-05 — Mana belongs in the environment | Replace the dashboard-like Mana presentation; provide a Fire Pit for burning Cards and colored flow into a pool/counter. | One Fire Pit and Mana basin per owner on the non-playable frame, with crisp attached counters, projected plan changes and accepted-event effects. |
| HF-06 — Learn in context | Define skills, stats and terms on hover; remove much of the always-on teaching text. | A shared glossary and state-aware explanations on hover/focus, backed by the installed profile/content. Keep required decisions and current command state visible. |

**What this supersedes:** the prior review's provisional recommendation to retain the permanent hand/inspector/resource layout, and conflicting presentation proposals in Design Companion v1. HF-04 also supersedes v3's permission to choose a newly unfunded destination in the new default play profile. V3 chapter 6 and Appendix A currently allow partial-Supply travel toward a farther retained goal; that historical behavior must remain identifiable for old replays.

All other selected gameplay semantics remain governed by [Master Requirements v3](master-requirements-v3.txt): public information, Card exclusivity, Mount routes, active-column eligibility, continuous movement, collisions, exposure, formation, resource timing and deterministic agreement/replay. [Design Companion v1](design-companion-v1.txt) still guides the brushed-pixel/comic materials and spatial vocabulary where compatible. This addendum does not accept board cards to Done or authorize unrelated services, spending or publication.

## 2. The ordinary play surface

The world viewport takes the space released by both external Card ribbons, the permanent right inspector, the Mana panel and the default full roster. A small Parties/Objects control can open a navigator. An optional pinned inspection window consumes overlay space only while the player asks for it.

Keep a compact current-decision strip or frame control with seat, Tick/phase, active columns, Orders count, one Ready/Acknowledge action and menu access. Preserve Commander/terminal status in a compact readable form. This is operational state, not a permanent tutorial. Orders opens the full public plan comparison; when acknowledgment becomes stale, bring the changed orders forward automatically. A required response presents the pending effect, legal choices, exact payments and Pass immediately. A targeting mode keeps its action, cost, target instructions and Cancel visible until resolved or cancelled. These decisions must never depend on discovering a hover target.

The board's Card banks remain the actual public slot arrangement. The default Home fit must include both owners' Minor banks, Major banks, row Enchantment banks and resource objects with usable projected hit targets. Use the reclaimed space to make the field and its frame legible. The current `BoardView.subject` explicitly excludes banks because the external ribbons expose them; change this assumption with ribbon removal.

Free camera orbit, pan, zoom and height inspection remain available. When a bank/resource/object is offscreen or occluded, offer a named locator and focus/inspect route. A temporary navigator can list the same instances for keyboard, touch and difficult camera angles; it must not recreate a permanently visible duplicate hand. Keep global/local column identities and owner mapping stable through camera movement.

## 3. One shared contextual inspection system

### Interaction and stability

Hovering or focusing a Card/party shows a readable screen-space view visually attached to its world anchor: quiet slate/ivory/brass frame, short leader, subtle source highlight. Text remains crisp and upright. The view may feel like a Card or folio opening from the table without rotating its body text into perspective.

Use these **tunable initial timings**: about 150 ms deliberate entry; 60 ms when scanning adjacent objects after the first view is open; 250 ms exit grace. Keep the view open while the pointer is over the source, the safe travel corridor or the view. Once entered, it remains until the player leaves/dismisses it or its information becomes invalid; it has no reading timeout. Do not let a view cover its own trigger or immediately switch the target beneath the pointer.

Hover, selection, pinning, keyboard focus and an armed command are separate states. Merely hovering must not select a party, change its facing, submit an action, move the camera, stop the Tick or steal focus. Clicking/tapping can select and pin; pinning is optional for reading and useful for deliberate actions. Permit one pinned subject plus one transient comparison initially. At compact sizes, use comparison tabs in one view rather than obscuring most of the board with two panels.

Escape dismisses the top contextual layer without issuing an order. After dismissal, suppress immediate reopening until the pointer leaves/re-enters or focus deliberately returns. Hovering a required decision's text may explain it, but cannot dismiss or replace that decision. True modal sheets still own focus/background interaction as required by review 03; ordinary hover inspection is nonmodal.

During a Card drag, camera drag or active target gesture, suspend unrelated inspection changes. Show the current operation's preview instead. Moving into the inspector must stop pointer events from issuing commands behind it. Enlarged hit proxies must resolve object identity predictably and not select a neighboring member/Card across an unrelated legal boundary.

### Keyboard and touch equivalents

Named object navigation, focus-to-inspect, tap-to-pin and explicit action buttons expose the same information and commands. Use grouped/roving navigation for banks, parties, resources and orders rather than hundreds of unrelated Tab stops. Preserve a visible distinction between camera navigation and a focused board/object. Restore logical focus after a view update, closure, required response or object removal.

Pure term definitions can use tooltip semantics. A Card/party view containing buttons, a formation grid or links is an interactive nonmodal inspection surface. Do not label its interactive content as a tooltip or open a modal merely because the pointer entered an object. W3C guidance calls for hover/focus content to be dismissible, hoverable and persistent; its tooltip pattern distinguishes non-focusable definitions from interactive popups. [Hover/focus guidance](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html) · [Tooltip guidance](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/)

### Lifecycle and layout

Key a view by match identity, object kind and stable instance/member/party ID, not by a bank slot number alone. If a new Card replaces an old one, the pinned old instance must explicitly become history/unavailable; it must not silently inherit the new Card's art, ability or actions. A merged/retired party must identify its surviving party. Clear/detach inspection and effect state on match replacement. Apply asynchronous art/definition results only if their match and object identity still match the view; show the correct new text with a placeholder while art loads, never the previous Card's face.

Place the view in available space, clamp it to the visible viewport and reserve required controls. Keep its position stable while reading; update its source leader as the world moves. Allow internal scrolling for long content and enlarged text. Prefer a compact alternative layout over shrinking important text. Initial width can be approximately 300–380 CSS pixels, adjusted to the actual viewport; measure instead of treating that range as approved art.

Reuse semantic content builders from the existing inspector. Keep hover resolution/projection separate from content derivation and command execution. Cache art and definitions by identity/revision; update values when state changes. Avoid full application re-rendering or new network/model calls on each pointer move.

## 4. Card inspection and actions

Every public Card type is inspectable for both owners: unplayed Minor Arcana, Major Arcana, placed Enchantments, planned uses and available historical instances. The UI calls the resource Cards Minor Arcana and may explain CJ's shorthand “Supply Card”; it must preserve their other two uses.

The expanded view presents, in order:

1. Recognizable face/art, title, Card type, owner and relevant suit/rank/alignment.
2. Actual current state: available, planned use, reserved, consumed, replaced or placed; identify which instance is being shown.
3. Exact resources and/or maintained effects appropriate to that type. Minor Arcana shows Supply and every Mana component, including zero Mana. A placed effect does not pretend to be an available Supply Card.
4. Its attached ability/effect in plain language: what happens, who/what is affected, when, exact cost and source consumption; definitions appear on its terms.
5. Applicable actions and a clear reason for an unavailable action. Full definition/creator lineage, source column/Tick, resource provenance and separate art attribution stay in Details.

For an editable owned Minor Arcana, provide **Load Supply**, **Burn for Mana**, and **Use ability** through the same validated commands as drag/drop. The player chooses one use of that instance. Inspecting an opponent's Card exposes the same public facts without offering ownership actions. A Card with several Mana colors must show every amount accurately; overflow is a deliberate summary with an immediate full breakdown.

Scanning Cards requires no click. Choosing an action can pin the source and enter its explicit targeting mode. Pointer drag remains an optional shortcut. Keep non-drag routes for party assignment, the Fire Pit and ability targets; required responses use the same Card identity/payment information.

## 5. Party inspection and chess identity

A party remains a collection of actual members. Give that collection one clear chess movement identity anchored to its logical center. The identity is a visual standard, not a new member or collider. Preserve an empty center slot when no character occupies it.

At overview distance, make a recognizable chess silhouette the dominant summary: Rook/Castle, Knight, Bishop, King, Queen, a distinct Commander crown/star, and Pawn for unmounted parties. The Commander, ordinary King and fixed Capital must remain distinct. Use authored glyph assets rather than platform-dependent final symbol fonts. Start around 32 projected CSS pixels, tuning within the space available; stable contrast and silhouette matter more than bloom.

At tactical distance, emphasize the actual members and formation while retaining a readable crest. At inspection distance, expose all slots and make the decorative crest quieter. Use projected-size thresholds with hysteresis to avoid zoom/orbit flicker. On hover/focus, soften only decorative overlap and show the composition; preserve truthful bodies, occupancy, facing and a stable hit target. An optional stronger chess-summary view may follow, but ordinary readability must not depend on a hidden modifier key.

Owner is shown by the existing shape/value/seat vocabulary, independent of Mana alignment. A facing notch belongs to the formation's world-facing and cannot rotate with the camera. Bind markers to the correct support/band; flyers and roofed parties retain their existing height/exposure cues and public discoverability. Mount-lost state must not suggest normal travel is still available.

The party view starts with Mount/party identity, owner, current activity, member count/capacity, facing, band/support/exposure, held versus planned Supply, destination and the reason movement is or is not currently available. It then shows the **actual 3×3 formation**, including empty slots and relevant contact sides. Hovering another body in the same party highlights its slot without repeatedly replacing the whole view. Member inspection explains that member's actual contribution, equipment, health and modifiers; named slot controls provide a non-pointer route.

## 6. Destination markers and Supply-funded range

### A marker shows intent

Every public party with a continuing destination gets a compact endpoint marker using its chess identity. Draft orders add a distinct planned marker. Use a hollow/dashed treatment, an arrival/direction cue and owner/band information; a destination must not look like a second occupied unit, cast a member-like shadow or participate in targeting/income/collision.

Hover/focus/selecting either endpoint or live party emphasizes their relationship and route. Unrelated routes remain quiet. Distinguish **Planned**, **Travelling**, **Paused for Supply/combat**, **Blocked**, and **Arrived** from actual state. On arrival, retire the endpoint mark. On merge/death/retirement, reconcile it with the authoritative surviving identity. Cancelling a draft replacement restores the existing accepted destination, not a fabricated empty goal.

When multiple parties target one territory, use an inspectable fan/stack with a count. Keep each party, owner and band identifiable. Such a collision of intent is not a predicted combat result. A draft replacement can show the old-to-new target in Orders without drawing two apparently active destinations.

### New endpoint eligibility

For the new default match policy, a new/replaced ordinary voluntary destination is available only when the **entire remaining legal route** is funded at order acceptance. Use confirmed party Supply plus valid **preceding** planned loads in the player's command sequence. An unassigned Card, future mint, speculative loot or hoped-for merge does not extend the range. Loading a Card may preview a conditional larger range before commitment, clearly marked “if loaded.”

Supply determines distance. Speed determines travel time. A Castle with two Supply can choose a two-step endpoint even if it takes two Ticks. A normal Knight L route needs three Supply in the current price profile; two Supply is insufficient even though its Speed is two. Turning or uphill slowing can affect time without adding a new Supply charge in the baseline.

The shared quote must start from the actual position. A party half a step short of its required next node, with two more steps to a replacement target, needs 2.5 Supply at normal prices. Include the unfinished edge or permitted backtrack, fixed-point precision/remainders and the actual profile's debit policy. Do not decide eligibility from rounded labels, a generic radius or `planRoute.cost` alone.

Use one pure route/funding calculation for highlights, endpoint previews, text/keyboard targets, bot planning, validation and peer/replay checks. Filter the full destination set before presentation; remove the current twelve-target accessibility limit. Retain Mount pattern, active-column, terrain and ownership rules. An unaffordable target explains the shortfall and cannot acquire a normal planned endpoint marker.

No Supply is prepaid or escrowed merely by placing a marker. Existing continuous travel debits actual distance. Already accepted destinations persist through later combat, changed terrain or a Supply pause; show why arrival is delayed. A new replacement must pass the new funding test. Opponent actions can still invalidate an operation during resolution; a rejected replacement preserves the prior accepted goal and explains its rejection.

If a player removes/reassigns/burns the planned Card that funds a draft destination, recompute immediately. Keep the intended target visibly invalid and prevent Ready until the player restores funding, chooses a nearer target or removes the order. Do not silently shorten the route or omit the movement from a submitted plan. Other uses of the same Card cannot simultaneously count as funding.

Apply the same funding principle to a new voluntary retreat endpoint while preserving retreat's existing contact/casualty rules. Explicit free pursuit and Card-defined movement exceptions keep their declared cost rules. A blanket gate inside every `setDestination` call would incorrectly block existing automatic free follow.

### Compatibility and implementation consequences

This is an explicit policy change from v3, not a correction to its earlier permission. Use a new/default profile policy and compatible rules revision for new matches. Keep old partial-Supply manifests/golden fixtures replayable through actual policy dispatch or a retained compatible adapter. Do not mutate archived manifest bytes/fingerprints or claim compatibility by changing only a version string. Reject unknown policies and preserve peer agreement on the manifest.

The current bot emits moves before Supply loads. Update it to build a coherent projected plan with valid loads before dependent destinations; it receives no exemption. The current planner's configurable `knightRouteCost` and simulation's distance-based `stepCost` can diverge outside baseline values. Make the new quote agree with actual debit and declared price semantics, with a nondefault-cost check and versioned treatment of any behavior correction.

## 7. Fire Pits and Mana basins

Place a Fire Pit/brazier and a Mana basin on each owner's rear/side frame, outside legal territory and contact strips. Use carved stone/earth/brass and owner crests. World ownership stays fixed while the camera turns. The default fit includes these objects and both Card-bank sets.

Attach sharp, upright resource glyphs/numerals to the basin. Persistently show actual nonzero quantities; “Empty” is a quiet explicit state. Hover/focus reveals all named colors, actual/projected changes, costs and the active expiration/carryover rule. White needs a dark rim, Black a light rim, and Rainbow a segmented identity. If a basin moves offscreen, its compact edge locator retains exact resource access. This is a presentation of the same pool, not a new resource store.

Use the three destinations to teach the Card choice: a party receives Supply; the Fire Pit burns the Card for Mana; its ability action uses the Card's effect. A pit drop and the labeled Burn action emit the same validated command and obey ownership, availability and frozen-plan restrictions. The opponent's pit is inspectable but cannot consume the player's Cards.

| Stage | Visible treatment | Truth to preserve |
| --- | --- | --- |
| Hover a carried Card over the pit | Highlight rim; show exact gain, Card identity and forfeited Supply/ability | Preview only; no consumed Card or gained Mana |
| Drop during editable planning | A ghost offering rests above the flame, with a planned-gain label and source-slot relationship | Adds the public planned command; actual Card/pool unchanged |
| Remove/cancel that order | Offering returns/disappears and projected gain clears | No resource gain or loss |
| Accepted burn | Card dissolves into payload-colored flame; separate light streams feed the matching basin glyphs | Follow accepted `card_burned` and its exact payload/pool |
| Accepted payment | Corresponding glyphs emit a short outward trace; exact counts/payments remain inspectable | Follow `mana_paid`, including actual Rainbow assignment |
| Expiration/carryover | Light settles/dims with the Tick-boundary state | Follow `mana_expired` and the installed carryover policy |
| Rejection | Explain the rejection; no successful burn/gain | Presentation cannot consume or mint resources |

For a mixed payload, preserve separate streams; blending Red and Green must not imply Yellow Mana. Rainbow remains Rainbow until a payment assigns it. The current rules allow burning a zero-Mana Card, while drag and button behavior differ. Normalize the new routes: explicitly display **“Burn for 0 Mana — consumes this Card”**, preserve legality, and play no Mana-gain effect. Do not manufacture yield for the opening zero-Mana Cards.

Separate actual pool from forecast changes. The current `_plannedPool` only adds explicit burns and ignores spending. A truthful projection must include valid commands, payment burns, exact assigned spends and Card exclusivity in declared order. Label it as the current plan's projection, not guaranteed post-opponent/post-response availability. During a response, use the actual pool at that choice and do not apply earlier resolved burns again.

Effects are presentation of accepted events, never payment logic. Counters and required choices must not wait for particles. Respect event order during playback and reconcile with authoritative state; deduplicate cosmetics by event/match identity. Re-rendering, seeking, fast-forward and New match cannot duplicate gains or carry old flames into a new session.

Initial timing proposal: about 250–400 ms for Card-to-flame and 200–350 ms for streams, overlapped into a brief 600–800 ms emphasis. Reduced motion uses immediate placement plus a static glyph/quantity emphasis; sound is supplementary. Reuse pooled effects/materials and measure the declared machine. Decorative fire degrades before exact state, target readability or response usability.

## 8. Definitions and contextual teaching

Create one versioned semantic-term registry reused by Cards, party/member inspection, plans, resources, event explanations and help. Each entry identifies its canonical label/aliases, short plain-language meaning, relevant conditions, source rule/content revision, related terms and an optional current-state example. Dynamic values come from shared deterministic selectors, not duplicated formulas or a model call on hover.

Cover all mechanics/stat labels currently exposed to players: Card types and the three uses; rank/suit/alignment; Supply/Mana; Mount/party/member/capacity; health and the actual attack/defense categories; range and area; formation/facing/contact sides; Tick/Round/active columns; route/Speed/destination; band/support/exposure/roof; frontier/income/blocking; planned/accepted/reserved/replaced states; Ready/frozen/stale acknowledgment and response/Pass. Use the current canonical vocabulary and explain aliases rather than inventing a different rules glossary.

A term hover gives its short meaning and its consequence here. For example, Supply can explain “movement allowance,” then show held allowance, planned loads and the selected route's actual required amount. A speed explanation describes distance per Tick separately. An exposure explanation states whether the inspected anchor currently qualifies for the relevant ground-income test. A damage value can reveal base value, modifiers and source Cards in the expanded detail.

Keep the glossary one contextual level deep, with explicit links or expansion for more detail, to avoid a chain of fragile nested hover windows. Define technical terms, not every ordinary word. Render installed/user-authored Card text safely as content and preserve definition/art provenance. A first-use guided tour can be opened or replayed on demand; ordinary play does not retain long instructional blocks. Invalid commands, missing resources, frozen plans and required responses still explain themselves at the moment of action.

## 9. Deliver the interaction before expanding the art family

First prove a complete ordinary route: scan own/opponent board Cards, inspect a party, load Supply, see its funded range, place its matching endpoint, review/Ready, inspect the result, plan/undo a burn, resolve Mana and pay an ability. The same route needs named controls and keyboard/focus access. Then apply the richer terrain and party treatment to this working scene.

Use 1280×720 and 1600×1000, both controlling seats, a full orbit and a stacked-height case. Verify target acquisition as well as readable popup content. Include a paid response, stale-plan review, a consumed/replaced Card, mixed/Rainbow/zero Mana, removal of a funding Card, fractional movement, reduced motion and a mid-effect New match. Preserve the review 03 reliability checks and historical replay behavior while adding the new-profile checks.

No additional product decision is required before starting these working defaults. The next human review should assess whether rapid inspection is effortless, the board reads as chess at overview distance, funded destinations feel predictable, and the Fire Pit makes the Card's three-way choice clear. Record implementation, observed verification and CJ's acceptance separately.
