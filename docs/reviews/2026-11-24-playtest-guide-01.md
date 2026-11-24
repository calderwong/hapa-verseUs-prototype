# Playtest guide 01 — Does the connected game read naturally?

**24 November 2026. Companion to [Review 09](2026-11-24-ui-design-review-09.md).** The preceding six repairs are technically verified in scope. The next task is a short human playtest of the integrated experience, not another default polishing assignment.

## Start the intended candidate

Use a **new match** with A human, B bot, seed 1 and profile `hapa_open_10x9_v3_07`:

<http://127.0.0.1:5199/versus.html?autostart=1&a=human&b=bot&seed=1&profile=hapa_open_10x9_v3_07>

The reviewed implementation ends at `44bf90b706a4e55dd740fd3276f077aac3ea5aa1`; the reviewed pushed snapshot is `2d8a5ff2a1c5686101b3dc3c2c8e0cee33c6df4f`. Later review-only commits need not change the running game. Check the actual local source rather than assuming the URL pins a build: it pins match configuration, not a Git revision.

Open the match menu once to confirm the profile and controller roles. A fresh explicit link avoids a saved older profile. Preserve any ongoing match in another tab. Use the existing local dev server if it is already serving the candidate; the documented command is `npm run dev` when starting it is necessary.

Aim for roughly **15–20 minutes of ordinary play**, or stop sooner if an obvious blocker prevents the session. This is a suggested observation window, not a completion quota or a demand to keep restarting until every case appears.

## Three questions worth answering

### 1. Can you predict where the party will move and recognize what happened?

Fund and move a Castle, Queen/Bishop or Knight as play allows. Choose at least one route that passes through an absorbable friendly Pawn. For a Knight, try the visible L-route control or repeat the right-click on the same destination to compare the two routes; choose the intended arrival facing.

**What should feel understandable:** the Supply you commit, the reachable destination, the visible route, where the piece will be at the next Tick, and whether a Pawn joined the party. A continued route should not need to be reissued on every Tick. One Ready commits your plan; History is available when you want it.

**Useful feedback, stated plainly:** “When I ordered this Queen diagonally, I expected it to arrive at __ after one Tick, but it appeared at __,” or “The Knight offered two paths, but I couldn't tell which way it would face at the end.” These tell the next agent what the player believed, not only which control was clicked.

An optional repeatable opening already observed by the reviewer is: load C1's 2 of Wands into A's R1C1 Castle, choose R3C1, Ready; at Tick 2 it is at R2C1 with nine members and 1 Supply; Ready again; at Tick 3 it reaches R3C1 with 0 Supply. Use this once if a clear reference helps. It is not a request to repeat a verified regression before playing.

### 2. Does burning a Card clearly give you spendable Mana in the same Tick?

When a Card has **positive Mana printed in its details**, burn it before Ready. Look at the world basin. If a legal ability and target are available, spend that Mana in the same plan and then commit the Tick.

**What should feel understandable:** the Burn immediately changes what is available to plan and spend; the colors and amount agree across the basin, any navigator view you choose to open, and the payment control. It should not seem that you must wait for the next Tick to use the resource.

The authoritative state is committed during resolution, while planning uses the projected result of your ordered actions. That implementation distinction should not force you to interpret two contradictory amounts in the UI. Unspent Mana follows the current Tick's expiration rule.

**Useful feedback:** “After I burned this Card I saw __, so I thought the Mana was available now/next Tick. I tried to spend it on __, and the game __.” Include the Card's Mana value. Some early Cards supply movement but print **0 Mana**; burning one of those is not a valid test of positive-Mana feedback.

If ordinary play does not produce a suitable Card and ability during this session, write **not exercised**. Do not grind through repeated openings or introduce a new fixture just to fill the form. Existing response 10 evidence already covers a controlled Burn-and-cast journey; this question asks about human understanding in play.

### 3. Can you learn an unfamiliar member symbol and return to play easily?

Zoom into or inspect a party when you actually want to know its composition. Choose one member's role, Health, attack or protection symbol. Hover it or focus it with the existing keyboard controls, read its explanation, then return to commanding.

**What should feel understandable:** which physical member the symbol belongs to, the value and type it represents, any direction-specific protection, and how to get back to the board. Normal unit selection should retain the compact command surface instead of forcing a large details card across your movement targets.

**Useful feedback:** “I understood the heart, but I couldn't connect this protection icon to which side of the unit was guarded,” or “Returning from inspection made me lose track of the party I was commanding.” An unfamiliar icon is not automatically a defect if its explanation is easy to reach and remember.

## Minimal feedback record

One short note per meaningful obstacle is enough:

| Field | What to include |
| --- | --- |
| Setup | Profile; A/B controller roles; seed; local implementation revision if known |
| Moment | Tick, party or Card, approximate camera/height view |
| Intent | What you were trying to do |
| Expectation | What you thought would happen or what you thought a symbol meant |
| Observation | What actually happened; one screenshot or short clip if it explains the mismatch |
| Impact | Blocked play, caused a wrong decision, required a second look, or merely cosmetic |

There is one known minor wording issue: History can say **“2 Supply loaded”** when it means **two loading actions**, such as two Cards adding 2 Supply each. The detailed quantities are correct. This is R9-01, deferred to the next relevant UI batch, and does not need to be reported repeatedly.

## What happens after the session

If the three interactions are understandable, choose the next gameplay milestone from the existing requirements and Overwatch state. This review does not assert that the whole MVP is feature-complete. If one interaction obstructs play, group the actual observations into a bounded, coherent next assignment. Preserve the current direction unless CJ chooses a rule or interaction change.

A local agent should supply implementation and verification evidence for Review. CJ's acceptance to Done remains separate. A report should end the assigned work item; it does not authorize continuing into unrelated board cards.

## Copyable prompt for the local coding agent

```text
Prepare the reviewed Hapa Versus candidate for my next human playtest, then hand off.

Read AGENTS.md and its available local Hapa grounding, docs/reviews/README.md,
docs/reviews/2026-11-24-ui-design-review-09.md, and
docs/reviews/2026-11-24-playtest-guide-01.md. Follow the existing Loose Screws workflow.

Review 09 closes R8-01 through R8-06 in the reviewed scope. Assignment 10 is
technically complete. Do not implement those repairs again. R9-01 is a minor
History wording issue retained for a later relevant UI batch, not the next goal.

Check local git state and recent work without resetting or overwriting anything.
Fetch the current handoff and reconcile the local game with implementation
44bf90b / reviewed snapshot 2d8a5ff. If local game changes exist beyond that
candidate, briefly identify them and whether they affect this playtest.

Prepare a new match using profile hapa_open_10x9_v3_07, A human, B bot, seed 1.
Reuse the existing local dev server where possible. Give me the exact link,
effective configuration, local revision/dirty state and any concrete blocker.

Reuse the review and response 10 evidence for unchanged behavior. A documentation
fetch or playtest handoff does not trigger the full suite, a browser matrix,
fresh screenshots of every journey, or another polish pass. If an actual new
blocker is discovered, record its reproduction and the smallest check that
resolves the uncertainty; do not invent a workaround or broaden this task.

Append the relevant handoff/evidence to the existing Overwatch workflow if
available; keep CJ's acceptance separate and do not mark work Done on my behalf.
If the board is unavailable, state that once without repeated retries.

Return a short playtest-ready status with the three observation goals from the
guide. End this work item after that handoff. Do not drain unrelated work,
restart the completed repair assignment, or create a new automatic polish loop.
```
