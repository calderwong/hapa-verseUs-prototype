# Human feedback addendum 03 — Keep play moving

**Selected direction from CJ, 23 November 2026 (America/Los_Angeles).** This is the current implementation contract for one-press Ready, optional history, reliable movement and recovery, explicit development controllers, compact member symbols, and immediately spendable current-Tick Mana. It accompanies [review 07](../reviews/2026-11-23-ui-design-review-07.md) and [assignment 08](../reviews/2026-11-23-next-agent-assignment-08.md).

## 1. Intent and authority

The player should command, read the battlefield and advance play without repeatedly approving a document about their own actions. Familiar players need exact information at a glance; new players need explanations at the point of curiosity. Development play must let CJ control one side while the existing bot controls the other.

This addendum records CJ's newer decisions and supersedes conflicting earlier requirements for the new default play profile. In particular:

- Replace Master Requirements v3 chapter 16 and Appendix A's repeated human acknowledgment of the current pair of plans with **one commitment to each player's own plan**.
- Replace addendum 01's automatic stale-plan drawer, mandatory Acknowledge action and frozen-plan re-acknowledgment. Public information, a frozen own plan, genuine response choices and deterministic agreement remain.
- Replace addendum 01's suspended planned offering and accepted-pool-first Mana display with immediate current-plan availability and immediate burn feedback. Accepted rules execution remains deterministic; presentation does not directly mutate authoritative resources.
- Refine addendum 02's close member labels into an icon-and-value language with contextual definitions. Preserve intentional spatial inspection, the actual members, and distinct command and inspection subjects.
- Adopt [Loose Screws](../workflows/LOOSE_SCREWS.md) for the implementation cadence. It replaces conflicting per-small-change full-verification cadence; final qualification remains required.

Master Requirements v3 and addenda 01–02 govern unchanged behavior. This is not authorization to remove bodily collision, grant extra Mana, skip meaningful counterplay, replace the engine, or expand the feature set. Historical manifests and evidence retain their recorded meaning. CJ's current feedback selects the next work; it does not record acceptance of the existing implementation.

## 2. The next playable whole

The required outcome is one connected play loop:

1. Start a development match with A human and B bot, with the selected roles and seed discoverable.
2. Load Supply, choose a funded route, understand any known obstruction and recover from a blocked partial move.
3. Burn a Mana-bearing Card, see its exact colors become available immediately, and spend them on an ability during that same Tick before Ready.
4. Press Ready once. The bot completes its side; normal play proceeds without acknowledgment paperwork. Respond only when there is a real game choice.
5. Zoom into a formation and read its real members through stable symbols and exact numbers. Ask a symbol for its meaning when needed.
6. Open history voluntarily, understand an earlier Tick, close it and continue commanding without losing selection or orders.

An ordinary opening and a clearly labeled Mana-bearing diagnostic can demonstrate different parts of this loop. Do not manufacture Mana on the opening zero-Mana Cards just to make the demonstration work.

## 3. Movement: clear diagonals, explicit obstruction, usable recovery

**HF3-01.** On clear flat ground, a normal-Speed Queen or Bishop travels one complete diagonal territory step in one Tick for one Supply, under the existing default rules. Displayed bodies, the authoritative anchor, the endpoint marker and actual debit must agree. Preserve terrain modifiers, slower/faster mounts, contact interruptions and legitimate fractional travel.

The reviewed half-step is a friendly-body obstruction, followed by a real recovery defect; see the exact opening reproduction in review 07. A legal chess pattern and sufficient Supply do not guarantee physical clearance through neighboring formations.

Required behavior:

- A route preview distinguishes its price, current permission and known clearance. Identify the first known blocking party and location. A short in-world blocked cue expands into an explanation such as “Your Pawn at R2C6 blocks this formation's path.” The unobstructed part and the obstruction must be distinguishable without relying only on color.
- Keep the destination and unspent Supply when movement stops. Show the actual reason for waiting rather than implying movement continues normally. Do not emit a repeated wall of blocked messages every simulation quantum or Tick.
- A party stopped between centers must have a legal, funded way to return along a clear segment to its previous reachable node when command eligibility permits. A rounded nearest coordinate is not proof of reachability. Do not force it to finish an obstructed segment before honoring its recovery order.
- The starting territory is a valid return destination when the anchor has left its center. Region identity alone must not hide it. “Already there” requires actual arrival, not a rounded future origin.
- Quote and debit the real fractional travel required for recovery. Do not charge for a detour through a known unreachable forward node. After returning, normal legal movement or a compatible Pawn merge remains available.
- Board, keyboard, bot, validation and simulation use consistent route/recovery facts. The existing heuristic bot must not continually select the same known impossible route through the same recovery defect.

Do not fix this by doubling diagonal speed, snapping figures through other bodies, expanding Supply or writing a general navigation system. Use the existing movement and collision architecture. Version any changed traversal semantics that affect historical replay outcomes; preserve legacy dispatch where required.

**Completion example:** reproduce the six-Supply Queen at R1C6 moving toward R4C9; show why it stops with 5.5; on its next eligible activation return through a clear segment, then take a clear legal move or merge. Independently retain the clear-board Queen/Bishop one-Tick, one-Supply diagonal control.

## 4. Ready means proceed; history is available on request

**HF3-02.** Ready commits the player's exact valid plan for the current Tick. Once accepted, that player's own plan is frozen. Later edits to the opponent's still-editable plan do not revoke that commitment or require another human click.

| State | Player experience | Required system behavior |
| --- | --- | --- |
| Editing | Ready is available; orders can change | Validate the current own plan |
| Own Ready accepted | Compact ready/waiting status | Freeze the exact own revision/hash |
| Opponent still editing | Continue viewing or inspecting | Keep public changes discoverable; no forced drawer or re-acknowledgment |
| Both own plans committed | Resolution begins automatically | Lock the final exact pair and resolve once |
| Real response opportunity | Show the effect, legal choices, payment and Pass | Preserve meaningful counterplay and choice ownership |
| Next Tick | A fresh editable plan and Ready opportunity | Clear only the completed phase's latch and transient state |

An invalid plan is corrected before the first Ready succeeds, with the specific invalid order identified. Do not silently discard it. Duplicate clicks, held shortcut keys, old callbacks or old match messages cannot resolve twice or carry a commitment into the next Tick. No “I really mean it,” updated-plan acknowledgment or read-receipt step follows a valid Ready.

Implement this consistently in local play and the agreement/peer path. The old protocol also requires pair acknowledgment; hiding its UI is insufficient. Declare and validate the new agreement policy for new default matches. Keep old signed records and manifests under their legacy policy, reject unknown policies, and retain match/phase/prior-state binding and signature/hash checks. Any automatic final-pair transport receipt is an implementation detail of the new own-plan commitment, not another human decision. A proposed field name is described in review 07; the implementer may choose the repository's appropriate schema.

**HF3-03.** Use the existing Orders/history surface as an optional drawer with clearly separated current plans and historical outcomes. History must browse earlier Ticks using the existing session events/replay records, not merely display the last 60 events again. Group entries by Tick; show a short result summary and expandable details for moves, resources, effects and damage. Current drafts must never appear as completed history.

Normal Ready, opponent edits and Tick completion do not open the drawer or disable its Close control. A passive concise result cue may point to history. During playback, displayed-current facts must follow the shown moment; future accepted results must not masquerade as already-seen events. Keep genuinely required response decisions separate from this optional ledger. Concession and other distinct destructive actions keep their own appropriate controls.

## 5. Explicit development controllers

**HF3-04.** Reuse the existing independent A/B Human/Heuristic-bot selectors, query parameters and controller factory. The current code already supports all four combinations. The supplied screenshots select `a=human&b=human` explicitly.

Provide one discoverable, saved development preset whose ordinary default is **A human / B bot**. A developer can select A bot/B human, both bots, or deliberate two-human hotseat. Apply changes through the existing new-match lifecycle; do not unexpectedly transfer control in the middle of a live match.

Working precedence: explicit valid URL parameters > saved development preset > built-in A-human/B-bot defaults. Validate roles and the seed and explain invalid input; never let an invalid role create an uncontrolled seat. Make the effective configuration and a copyable launch link available in development setup/menu, without adding a large permanent panel to normal play.

| Development mode | Existing reproducible URL |
| --- | --- |
| CJ controls A; B is a bot | `/versus.html?autostart=1&a=human&b=bot&seed=1` |
| A is a bot; CJ controls B | `/versus.html?autostart=1&a=bot&b=human&seed=1` |
| Watch both bots | `/versus.html?autostart=1&a=bot&b=bot&seed=1` |
| Deliberate two-human hotseat | `/versus.html?autostart=1&a=human&b=human&seed=1` |

Both bots should plan, make their required choices and advance without human Ready clicks. Development Pause/Step/Stop must control the between-Tick scheduler as well as playback. Pause may finish an atomic resolution before halting at its next stable boundary; Step advances one Tick; Stop prevents further automatic Ticks. Restart/New match cancels prior scheduled work. A bounded test ending at its limit is unfinished, not an invented victory. No new model service or strategy-optimization project is needed.

## 6. Members: symbols and exact values first

**HF3-05.** At intentional close-inspection distance, every visible member should be quickly readable through a consistent compact symbol order. Replace repeated role headings and `Atk / Phys / Def / HP / front` prose with designed icons and exact values. Keep a proper character name where identity matters; do not replace meaningful names with arbitrary codes.

| Fact | Compact visual requirement | Explanation on hover, focus or deliberate touch |
| --- | --- | --- |
| Role | Distinct role silhouette; actual Mount chess glyph for a center | Canonical role, formation slot and member/Mount distinction |
| Health | Vitality icon, exact current/max, restrained bar | Individual health or explicitly shared party pool |
| Attack | Attack/channel symbol and exact hits × power | What each hit does; keep `2 × 1` distinct from one hit of 2 |
| Channel | Distinct Physical and Magic shapes | Canonical channel and relevant protection; do not silently rename Magic to Energy |
| Range/contact | Range icon and number, or melee-contact symbol | Base range, applied target context and terrain/sky restrictions when relevant |
| Protection | Channel-marked shield, value and small covered-face diagram | Actual faces, contribution/applied scope and sources |
| Conditions | Recognizable badges; duration/count where known | Name, consequence, source and remaining time |

Use one small local SVG/pixel-glyph dictionary and one canonical definition registry. Match the existing art and palette; avoid platform-dependent emoji as the final visual language. Ownership, Mana alignment and attack channel are different facts. Do not make blue mean both player A and Magic, or red mean both player B and Physical. An alignment tint is shown only when the data has that alignment. Shapes and numbers remain meaningful in grayscale. Front refers to the formation's real facing, not screen-up after camera rotation.

Familiar-player examples from current content: the Archer must reveal 3/3 health, two separate Physical hits of 1 and base range 2; the shield Swordsman must reveal 3/3 health, one Physical hit of 3 and front-only Physical protection 1. These are presentation examples, not new balance assignments. Show zero/no protection deliberately rather than accidentally implying that missing data means invulnerability or unknown status.

Definitions explain the selected fact and its current value. Hovering the shield should answer the protection question directly, not open the whole member document. A deliberate deeper view may retain source breakdowns and uncommon exceptions. Keep the current displayed-moment read model, complete detail signatures and target-context distinction; do not calculate a second set of combat facts in the UI.

Icons need real interaction. The current passive labels are pointer-transparent and `aria-hidden`; simply replacing strings with SVG does not meet this requirement. Give appropriate icon hit areas a semantic route, keep the member stable during pointer transfer to a tooltip, and leave surrounding board/camera gestures available. Keyboard and touch get the same definitions through compact member navigation; do not add dozens of unconditional Tab stops or restore a text-heavy permanent inspector. Working default: a short dwell for an explanation, stable while hovered/focused, Escape to dismiss.

Overview retains chess silhouettes and destination intent without member-stat clutter. Close view shows the exact compact facts. A small inspection strip carries inspected identity, distinct commanded identity, member navigation, Return and Close. When on-body facts are readable, do not repeat every member's name and HP in the strip. When they cannot be shown because of scale, occlusion or available room, the equivalent facts remain deliberately reachable there.

## 7. Burning makes Mana available during this Tick

**HF3-06.** A valid burn immediately adds its actual colored payload to the player's **available balance for the current editable Tick**, net of already-planned spending. A later ability in that same plan can spend it before Ready. There is no wait-until-next-Tick interpretation.

Use the existing ordered `projectPlan`/validation path. On a validated drop or Burn action:

1. Reserve that Card instance for its one chosen use; it cannot also fund Supply or another ability.
2. Update the primary basin's exact colored **Available this Tick** balance immediately. Do not keep `Empty` as the main answer with only a small `→ plan` footnote.
3. Animate the Card into the flame and its separate payload colors into the matching basin glyphs immediately. Number updates and spending eligibility do not wait for particles. Mixed colors remain separate; Rainbow keeps its actual payment semantics.
4. When an ability is queued, reserve its real cost and reduce availability immediately. Hover/history can explain starting resources, burns, commitments and remainder.
5. Before Ready, undoing a burn reverses its draft credit. Dependent abilities remain visible but invalid until corrected; block Ready with the specific shortfall. Do not silently delete them or burn a replacement Card.
6. At agreed resolution apply the actual burn and payment exactly once. Reconcile the earlier draft effect with its accepted event; do not mint or animate another gain. Actual counter/response choices use the actual current pool, not the already-counted full-plan projection.
7. Expire normal unspent Mana at the Tick boundary before next-Tick spending. Reset obsolete draft effects on rejection, replacement and New match. Reduced motion gets the same immediate counts with restrained static emphasis.

The main display is a usable current-plan balance, not an unconditional promise about an opponent's later effects. Its tooltip may explain that the plan remains editable until Ready. Authoritative state stays in the rules layer. There is no need to create irreversible resource mutation in presentation or invent an extra planning-resolution phase.

Supply rank is not Mana yield. Many opening Cards have Supply 2 and **0 Mana**. Before a zero-yield burn, show “0 Mana — consumes this Card” in the Card/pit preview. Preserve its existing legality, but show no gain stream and manufacture no Mana. This is informational feedback, not a new confirmation dialog.

## 8. Overlays must compose

**HF3-07.** An optional history/Orders drawer cannot conceal the member explanation, Return/Close or essential command controls. Reuse one effective reserved-space calculation across the existing inspection surfaces, including open drawers and required choices. Reflow or deliberately compact/suspend secondary reading when space is insufficient. Raising one panel above another is not a layout solution.

One required journey: inspect a member, open history voluntarily, rotate once, close history, then command the original selected party. Reading and controls remain reachable; selection and orders survive. Incorporate this into the icon/history work, not a separate UI-framework rewrite.

## 9. Delivery and unresolved decisions

Build these connected behaviors under Loose Screws, then qualify the integrated candidate. Retain mandatory final checks and historical compatibility. Update tests and glossary that currently assert stale acknowledgment, forced Orders and delayed-looking Mana; a passing old expectation is not acceptance of the new requirement.

No new blocking product question is required for this round. Icon shapes, tooltip timing and saved-preset storage are implementation/design defaults to demonstrate. Collision-free chess phasing, new bot strategy, a second environment recipe and a new battle-planning fairness model are outside this slice. Report implementation, observed evidence, remaining limitations and CJ acceptance separately.
