# Assignment 10 — Reliable party growth and consistent play controls

**23 November 2026 · America/Los_Angeles**  
**Review baseline:** `f7c4f0f69afbc22458c400f01521e5b468f5f602`  
**Review:** [review 08](2026-11-23-ui-design-review-08.md)  
**Selected direction:** [addendum 04](../requirements/2026-11-23-human-feedback-addendum-04.md), plus compatible addenda 01–03  
**Default workflow:** [Loose Screws](../workflows/LOOSE_SCREWS.md)

## Goal and stopping point

Finish one bounded reliability pass on the current human-A/bot-B play experience and its existing peer agreement contract. Preserve the new center travel, Pawn absorption, two Queens, either Knight L, free Knight turns, chosen arrival facing, one Ready, voluntary history, current-Tick Mana and icon-led inspection.

The primary outcome is that a formation can acquire surviving Pawn members without losing, duplicating or wrongly refusing them. The surrounding controllers and information surfaces must agree with the same current rules and facts.

Complete the selected repairs, fit their connected journeys, perform required final qualification, publish response 10 (or the next unused response), update the current handoff/board, and stop this work item. This assignment is not a directive to drain the entire board, add more art or continue automatically into unrelated improvements.

## Start from current reality

Read `AGENTS.md`, the local Hapa grounding it names, the review index, addendum 04 and review 08. Read the operative Loose Screws instruction; do not reload the full policy or every historical review after each edit. Inspect local working changes, current branch, existing handoffs and Overwatch before editing. Fetch the review without resetting or replacing local work. Compare its pinned source to the checkout; if a finding is already fixed, cite the newer evidence instead of implementing it again.

Response09 records direct CJ decisions after assignment 08. Do not follow the old index's superseded instruction to preserve the opening friendly side-body half-step. Addendum 04 consolidates those decisions and their provenance. Engine ownership remains with the separate Lumina Hapa fork.

## Selected work, in dependency order

| Work | Required result | Smallest useful evidence |
| --- | --- | --- |
| **R8-01: absorption integrity** | Allocate every incoming living member to a distinct valid slot using living occupancy and reservations. Handle casualty vacancies. Commit complete transfers atomically; failed absorption cannot leave invalid co-location. Keep Supply, ownership and retirement coherent. | Two meaningful rules regressions: successive partial-Pawn pickups, and casualty refill. Assert member conservation/unique slots and replay. Check the ordinary opening control. |
| **R8-02: Knight bot eligibility** | Remove or profile-gate the obsolete intermediate-friendly filter. Use the shared rules/clearance for Knights while keeping illegal final endpoints excluded. | One deterministic funded Knight fixture through friendly intermediate territory. This is a policy correction, not a stronger-bot project. |
| **R8-03: exact launch links** | A copied ordinary match link includes the effective profile, even when default, as well as roles/seed. Reopening cannot inherit an unintended saved legacy profile. | Copy/open the current profile with a saved v3_02 preset; the copied profile wins. A deliberate bare URL still follows the saved-preset policy. |
| **R8-04: fallback definitions** | Current facts are available for keyboard/touch fallback independently of on-body label visibility. Clear obsolete entries; refresh or close stale definitions. | One focused missing/stale-registry regression and one inspection journey with the member label unavailable from the start. |
| **R8-05: edited plans in the peer path** | Process the applicable remote plan/Ready records through agreement in order, including revisions before the opponent's one Ready. Resolve the final committed pair once. | A peer-level revision 1 → revision 2 → Ready 2 sequence, with final A1/B2 pair/receipt and one resolution. Preserve existing binding, signatures and duplicate guards. |
| **R8-06: small feedback repairs** | Keep arrival-facing toast readable around Mana counters. Make the navigator's Fire Pit quantity agree with current availability, or explicitly label any different quantity. | One relevant screenshot, and a positive-Mana planned-burn comparison using the existing diagnostic. Reuse the existing burn/cast journey. |

The [review evidence folder](evidence/2026-11-23/review-08/README.md) contains portable diagnostics and captured results. They deliberately demonstrate the reviewed failures; several assert that the bug exists at the pinned baseline. They are not release gates to preserve unchanged after fixing the implementation. Convert the meaningful invariant into the appropriate existing regression tests and retain the historical evidence.

## Assemble and fit before broad qualification

Batch the shared absorption/eligibility repair first. Establish enough invariant evidence to rely on it, then connect the controller, configuration and presentation repairs. Keep a short current checkpoint and grouped remaining work. A changed file, commit or compaction is not a reason to run the entire browser matrix or produce another publication cycle.

Use the existing headless separation: presentation reads rules; it does not mutate authoritative state to make an animation appear correct. Maintain integer accounting and the established ownership contracts. If a rules fix changes the meaning of historical replays, use an explicit profile/version dispatch and document it. Preserve the newer decisions in the active default; do not gain a green check by globally weakening compatibility or removing acceptance criteria.

The peer fix is a bounded correction to the existing agreement path. Do not add a lobby, new transport, networking UI or reconnect project. The live local one-Ready journey already works; preserve it.

Once the repairs connect, fit these journeys:

1. **Party growth and travel:** ordinary A-human/B-bot opening, funded center-to-center move, Pawn absorption, continued movement, exact Supply debit. Then the two labeled survivor/casualty diagnostics demonstrate preserved composition. Reuse route/facing controls and established enemy-contact expectations.
2. **Reproducible setup:** copy the effective match configuration and reopen it with a conflicting saved legacy preset. Identify the running profile and controllers from the menu.
3. **Inspection when a body label is unavailable:** open the fallback from the outset, activate role/health/protection, change to a current snapshot/subject and verify no stale definition remains. Keep normal selection compact and history voluntary.
4. **Peer agreement after an edit:** apply the ordered legal edit sequence through the peer-level path and resolve once with the final pair. Distinguish in-process/method evidence from real transport evidence.
5. **Feedback consistency:** reuse the Mana-bearing fixture and Knight-facing capture to show consistent balance labeling and unobscured feedback. Do not manufacture Mana on zero-Mana opening Cards.

These are connected fit checks, not five separate release ceremonies. Reuse existing valid evidence for unchanged parts. Do not expand into speculative camera glyphs, bot optimization, new biomes or the disclosed intermediate-Knight overlap decision.

## Final qualification and handoff

Run the repository's required `npm run check` on the integrated candidate. Run the affected browser journeys once that candidate is ready. If a failure exposes a related cause, repair it in a coherent batch and rerun affected checks; broaden only for a demonstrated wider risk or a required gate. Report environmental limitations as such. A missing test dependency is not a failed gameplay assertion.

Publish using the existing authorized repository workflow. Include:

- Exact source revision, default profile, engine pin and working-tree condition.
- Each selected finding's outcome, linked to focused evidence or a clear non-reproduction explanation.
- Rules/invariant checks, browser observations, transport tests and inherited/reused evidence distinguished accurately.
- The running configuration and an exact launch link; state when local running source cannot be identified.
- Remaining genuine limits and CJ acceptance separately. Do not mark human acceptance from automated passes.

Use `docs/reviews/2026-11-23-ui-design-response-10.md` if still appropriate and unused; use the actual local date and next unused response if the run is later. Update `docs/reviews/README.md` to the new response, leaving review 08 and this assignment as historical records. Append progress/evidence to existing Overwatch cards using the real local interface. Do not claim the board was updated if unavailable.

Once the selected scope is implemented and qualified, or a specific external dependency prevents further useful work, hand off and pause the work item. Preserve independent completed work; do not consume the remaining allowance on repeated unchanged tests or optional polish.
