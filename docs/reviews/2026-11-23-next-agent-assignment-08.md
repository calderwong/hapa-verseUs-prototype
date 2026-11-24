# Assignment 08 — One playable loop, one Ready, readable resources

**For the local Hapa Versus coding agent.** CJ's 23 November playtest feedback selects this work. Read [review 07](2026-11-23-ui-design-review-07.md) and [human-feedback addendum 03](../requirements/2026-11-23-human-feedback-addendum-03.md). The reviewed source is `4fd5eaf9c0f9750242d9d3d013ac36801d96a92f`, implementation `b3a44af`; compare it with your current branch and unpublished work before changing anything.

## Goal

Deliver a connected development play session: CJ controls A against bot B, can place and recover funded movement, burn and spend Mana during the current Tick, press Ready once, inspect members through icons and exact values, and consult past-Tick history only when wanted. Preserve response 07's true playback facts, independent command/inspection state, camera corrections and terrain work.

This is a functional gameplay delivery followed by integrated qualification. It is not an instruction to perfect each component before connecting the others.

## Start with current reality

- Read `AGENTS.md`, the current review index and the named selected requirements once. Use relevant sections of v3/addenda as needed. Preserve local work; fetch without reset/clean/force-pull. Do not repeat all prior investigations or reread the entire ecosystem after each compaction.
- Inspect current Overwatch cards on `hapa-versus` through its existing local workflow. Reuse relevant cards; these documents are the shared design handoff, not a second task board. CJ accepts Done.
- Keep the existing engine pin and ownership boundaries. Source changes in `src/hapa` are sufficient unless a concrete engine limitation is demonstrated.
- State a short plan for this whole loop and any already-completed work. Proceed through ready phases without asking for approval at each boundary.

## Assemble the connected behaviors

### 1. Make test play and movement usable

Reuse current seat selectors, query parameters and `HeuristicBot`. Save/expose the dev preset, default the normal launch to A human/B bot, validate effective roles/seed and support either or both bot seats. Explicit URL parameters override the preset. Give bot-vs-bot a durable Tick-boundary Pause/Step/Stop, with old work canceled on restart.

Reproduce the Queen R1C6 → R4C9 opening described in review 07. Clear diagonals already move a full step for one Supply; the half-step is a friendly Pikeman/Archer collision. Repair the **blocked recovery origin and same-region return target**, and show the first blocker and a usable recovery route. Preserve collision, Supply, active-column eligibility and deterministic outcomes. Use one shared interpretation for quote, preview, board/keyboard input, bots and replay. Do not double speed or snap through bodies.

### 2. Remove repeated acknowledgment and make the ledger voluntary

Ready freezes the player's own exact valid plan once. Opponent edits cannot require re-acknowledgment. Both own plans frozen → lock the exact pair automatically → resolve once. Implement the new default agreement policy in both app and protocol/peer paths; keep archived legacy behavior identifiable. Preserve duplicate-input/session guards and genuine Card response/payment choices.

Replace forced Orders with optional current-plan/history views over existing events/replay. Make earlier Ticks browsable; no automatic opening or disabled Close after ordinary Ready. Revise the old stale-acknowledgment glossary and tests deliberately.

### 3. Make burning usable and visible now

Use the current ordered plan projection: validated burn reserves the Card, immediately updates the main exact colored **Available this Tick** count, animates into the pit/basin and enables a later same-Tick cast. Spending reserves its cost immediately. Undo removes draft credit and leaves dependent invalid orders visible. Responses use actual current resources. Reconcile accepted events once; expire leftover normal Mana at the next Tick boundary. Keep zero-Mana opening Cards honest.

### 4. Make close reading fast

Implement the shared role/health/attack-channel/hit-count/range/defense-face/condition symbol vocabulary in addendum 03. Use exact numbers, existing real-moment facts and contextual definitions. Preserve two hits of 1 versus one hit of 2, directional protection and member/party scope.

Icons must work with hover/focus/touch; passive SVG inside the current pointer-transparent label is insufficient. Keep one compact inspection navigation strip and remove redundant prose when body labels are readable. Include open history/navigator/decision drawers in shared free-space calculations so explanations and controls cannot disappear behind them.

## Fit, then tighten

Follow [Loose Screws](../workflows/LOOSE_SCREWS.md). During assembly, use the smallest check that proves a real dependency, distinguishes a cause or protects a changed boundary. Keep a short grouped tightening list in the existing plan. A file edit, commit or compaction is not a reason to rerun every test, capture, benchmark or review.

Once all four areas connect, run the ordinary human-A/bot-B journey and a labeled Mana-bearing case, then tighten the combined candidate. Minimum discriminating qualification:

| Concern | Evidence needed |
| --- | --- |
| Movement | Exact blocked opening and usable recovery; clear Queen/Bishop diagonal control; actual fractional quote/debit and replay |
| Ready | A Ready → B edits → B Ready resolves with one human commitment per seat; no forced drawer; spam/held key cannot resolve twice or skip a Tick; legacy agreement preserved |
| Controllers | All four seat modes resolve as configured; both-bot Pause/Step/Stop/restart owns scheduled work; no human control required for bot responses |
| Mana | Positive burn → immediate count → same-Tick cast; undo with dependent cast; no double credit; mixed/Rainbow/zero yield; actual counter window; expiration and replay |
| Reading | Compact four/five-member and dense nine-member view, one orbit, exact icon definition via keyboard/pointer, enlarged-text access, and history-open composition without selection loss |

Reuse existing checks where they establish these facts. Update obsolete C1/C9 behavior expectations rather than merely suppressing failures. Run the repository's required final `npm run check` against the integrated candidate and the relevant browser journeys. Broaden only for a concrete regression risk or required gate. Fix related failures in batches and rerun affected checks; do not restart all qualification after each small correction.

Do not turn this into a bot-strength project, comprehensive new benchmark program, new renderer, second environment recipe, or exhaustive art pass. Keep response 07's known nonblocking limitations visible without promoting every item into this assignment.

## Lock and hand off

Publish the next unused implementation response, expected **08**, with source/engine/profile identities, what changed, exact observed evidence and remaining gaps. Include a short playable launch instruction and a small set of captures or one continuous clip showing the connected loop. The baseline review probes intentionally assert old behavior; preserve them as history and write/update acceptance checks for the corrected behavior.

Update the review index and append material evidence/status to the existing Overwatch cards once the integrated milestone is ready. Use the authorized repository workflow; do not disturb unrelated local work. State whether the app was actually run, and whether the working application matches the cited revision. Put work in Review; do not claim CJ acceptance.

Stop when the agreed delivery is qualified and handed off, or when a specific required gate is blocked and no independent authorized work remains. Report that gate plainly. Do not recursively invent polishing tasks or re-run unchanged failed experiments.
