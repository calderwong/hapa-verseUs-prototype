# Implementation response 10 — 24 November 2026

**Parties now grow reliably, and the surrounding controls agree with the current rules.** This answers [UI and design review 08](2026-11-23-ui-design-review-08.md) (R8-01–R8-06) and [assignment 10](2026-11-23-next-agent-assignment-10.md), under [human-feedback addendum 04](../requirements/2026-11-23-human-feedback-addendum-04.md). Response 10 was the next unused number. The work followed [Loose Screws](../workflows/LOOSE_SCREWS.md): the rules repair came first, the controller, configuration and presentation repairs were connected to it, and then the integrated candidate was qualified. **CJ acceptance: not yet recorded.**

## Running configuration

Run `npm run dev`, then open:

**http://127.0.0.1:5199/versus.html?autostart=1&a=human&b=bot&seed=1&profile=hapa_open_10x9_v3_07**

- The match menu (☰) now shows exactly this link, profile included.
- A bare `?autostart=1&a=human&b=bot&seed=1` still follows the saved development preset, as intended. Without a preset it starts the same default.

## Scope and source

- **Starting point.**
  - Local `main` was clean at `f7c4f0f` (response 09, pushed), with no stashes, other worktrees or `HANDOFF.md`.
  - `git pull --ff-only` integrated review 08 / addendum 04 / assignment 10 (`b7ef249`). Nothing local was at risk.
  - On Overwatch `hapa-versus`, HV-44/46/55/56/58/59 were in Review and HV-45/60 in Backlog.
- **Reproduced first**, against `b7ef249`.
  - Review 08's movement probe showed all three rules findings:
    - the second partial Pawn's survivors were both assigned slot 3, so 5 owned members but 4 referenced;
    - the casualty refill failed with `over capacity`, leaving the Queen and Pawn co-located;
    - the bot gave the Knight no destination.
  - The peer probe was not run as-is, because it rewrites its committed result file. The same sequence was run as a new regression against the old `peer.js`, where it failed with the reviewed error ("B's Ready names its own revision 2, current is 1"), and against the fix, where it passed.
  - None of the review probes was changed.
- **Source commits** (on `b7ef249`):

  | Commit | Findings |
  | --- | --- |
  | `4657188` | R8-01 absorption allocator in profile v3_07; R8-02 bot traversal; R8-05 peer revisions; rules regressions |
  | `7919bd8` | R8-03 profile in copied links; R8-04 definition registry; R8-06 toast stacking and navigator Mana; presentation contracts; browser z13/z17 |
  | `44bf90b` | Pointer leaving a symbol keeps the focused symbol's definition (found by z17); z16 follows the v3_07 default |
  | *(this report)* | Response 10, evidence, index |

- **Identities.**
  - Default profile: **`hapa_open_10x9_v3_07`**, revision 1, rules `hapa-versus-rules/0.7.0`.
  - Engine gitlink: `ba838cca09ba43afceda0452b63d28df4cbf7f72`, unchanged.
  - The working tree was clean for every recorded run. Untracked evidence was moved aside during the browser runs and the check.

## Outcome by finding

| Finding | Change | Evidence | Limits |
| --- | --- | --- | --- |
| **R8-01** absorption integrity | New policy `movement.absorption: living_reserved_v1`. `absorptionPlan` computes the complete assignment before any transfer: only living members occupy slots (casualty references are free capacity), every chosen slot is reserved, the Mount keeps slot 5, and members that don't conflict keep their slot number. The capacity check (`mergeCandidate`) is now the same allocation. So a Pawn that cannot be absorbed is an obstruction and an illegal endpoint, and is never co-located. The new default `v3_07` carries this policy; `v3_06` and earlier keep the slot-order allocator their recorded replays used. | `tests/hapa/absorption.test.js` (successive partial Pawns 1→1, 2→2 then 1→3, 2→4; casualty refill 1,2,3,7→1,2,3,4 with 9/9 referenced; no co-location; ordinary-opening control; legacy allocator kept); [acceptance probe](evidence/2026-11-24/response-10/acceptance-results.json) | The fix applies to new matches only, by design. |
| **R8-02** bot Knight eligibility | Under `center_to_center_v1` the bot no longer applies its own intermediate-friendly filter and relies on the shared clearance. Knights pass friendly territory; line Mounts are still stopped by a friendly holder; illegal final endpoints are still excluded. Body-sweep profiles keep the old filter. | absorption.test.js: the review's Knight, with friendly Castles at R5C3, R6C3, R4C4 and R2C4, gets a valid order through friendly territory. The probe records R6C2 via R5C3 → R6C3. | Not a strength change. |
| **R8-03** exact launch links | Setup and menu links always include the effective profile, even the default. A bare URL still follows the saved preset. | presentation-contracts.test.js; browser **z13** (with a saved v3_02 preset: a bare URL opens v3_02 by intention, and that match's own link names v3_02; the copied v3_07 link opens v3_07 / `own_plan_ready_v1`) | — |
| **R8-04** fallback definitions | `MemberLabels` rebuilds its definition registry from every inspected member's current symbols on each update, drawn or not. An open definition refreshes when its value changes and closes when its source disappears. Leaving a symbol with the pointer returns to the keyboard-focused symbol's definition. | presentation-contracts.test.js (unavailable member registered; stale value replaced; old entries removed); browser **z17**: B's roofed tunnel formation, no body label from the outset, keyboard route Pikeman → Health 3/3 → "Physical protection 1 on the front face; other faces meet 0…", then a new subject leaves no definition registered or open. [Capture](evidence/2026-11-24/response-10/regress/2026-11-24T19-36-45-054Z-7919bd8/z17-roofed-fallback.jpg) | Touch was not exercised on a device; the tap path is the same button handler. |
| **R8-05** edited plans in the peer path | Under `own_plan_ready_v1` the peer takes the opponent's plan and Ready records for the phase in arrival order through `PhaseAgreement` until the final pair locks. The legacy path is unchanged; signatures, binding and duplicate handling are untouched. | play-loop.test.js peer regression (exact `Peer`, in-process verified inbox): B r1 → r2 → Ready r2 gives one own Ready, receipt locked pair A1/B2, B's burn resolved once, nothing left queued. Fails on the old code. Real transport: `npm run check`'s two-process Hypercore peer match still agrees (single plan per Tick). | The edit sequence is tested in process, not over live Hypercore transport. |
| **R8-06** feedback | The toast is noninteractive, stacks above world-anchored counters (z-index 28 against 20, below the drawers) and is width-limited. The navigator's Fire Pit row reports the same quantity as the basin: available this Tick while planning, the pool while resolving. | [Toast still](evidence/2026-11-24/response-10/stills/01-knight-arrival-toast.jpg) at 1280×720: the full arrival-facing text reads over B's counter. [Navigator still](evidence/2026-11-24/response-10/stills/02-navigator-fire-pit-after-burn.jpg): the labelled response fixture, A.red burned → navigator "available this Tick 2 Red" = basin "2 Red"; the authoritative pool is still `{}` ([log](evidence/2026-11-24/response-10/stills/stills-log.json)). | The toast briefly covers part of the counter it overlaps, for the toast's lifetime only. |

## Fit: connected journeys

1. **Party growth and travel.**
   - **Ordinary opening control:** the Queen R1C6 → R4C9 reaches R2C7's center in one Tick, absorbs Pawn C7 with 9/9 members referenced, keeps 5 Supply, and the replay verifies.
   - **Labelled diagnostics:** the survivor and casualty cases now conserve every member.
   - **Live routes:** the Bishop and Knight absorption and L-flip route journeys (z16) and the ordinary command-bar movement (z01, c7) passed in the full run.
2. **Reproducible setup.** Covered by z13 with a conflicting saved legacy preset, as in the table above.
3. **Inspection without a body label.** Covered by z17.
4. **Peer agreement after an edit.** The in-process peer regression above, kept distinct from the real-transport smoke.
5. **Feedback consistency.** The two stills above. The existing burn and cast journey (z14) passed in the full run.

## Verification record

| Check | Revision | Result |
| --- | --- | --- |
| `npm run check` | `44bf90b`, clean | exit 0: **140/140** tests (new: absorption 6, presentation contracts 2, peer edit 1), bot smoke, two-process peer match, build. [log](evidence/2026-11-24/response-10/npm-run-check-44bf90b.log) |
| ui-regress, all contracts 2–5 plus z16/z17 | `7919bd8`, clean | **451/453**. One failure was z16 still naming `v3_06` as the default. The other was z17 catching a real defect: hovering one strip symbol and leaving it hid the keyboard-focused symbol's definition. Both were fixed in `44bf90b`. [run](evidence/2026-11-24/response-10/regress/2026-11-24T19-36-45-054Z-7919bd8/report.json) |
| ui-regress `--only z08,z15,z16,z17` | `44bf90b`, clean | **70/70** ([run](evidence/2026-11-24/response-10/regress/2026-11-24T19-45-16-057Z-44bf90b/report.json)) |
| ui-regress `--only c1,z12,z14,z16 --sabotage` | `44bf90b` | 71/75, exit 1. The four planted expectations fail, as intended. |
| [acceptance-probe.mjs](evidence/2026-11-24/response-10/acceptance-probe.mjs) | `44bf90b` rules | [results](evidence/2026-11-24/response-10/acceptance-results.json): both diagnostics under v3_07 (fixed) and v3_06 (historical), opening control, bot Knight, peer edit |
| Browser pane (live) | `7919bd8`–`44bf90b` | Roofed fallback by real clicks and arrows; toast z-order; navigator after a positive burn |

`44bf90b` changed one pointer handler and two test expectations, so the remaining checks from the `7919bd8` full run stand for it.

## Remaining limits and handoff

- The disclosed Knight overlap, where a Knight can end a Tick inside a friendly-held intermediate territory, is unchanged, as addendum 04 asks.
- The peer edit is tested in process. Live transport is covered only by the bots' single-plan peer match.
- Touch and high-DPI devices were not exercised (HV-60).
- **For the reviewer:** start from `44bf90b` and the link above.
- **CJ acceptance: not yet recorded.**
- **Overwatch:** evidence was appended to HV-55, HV-58, HV-46 and HV-45.
