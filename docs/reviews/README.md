# Design review handoffs

This folder is the shared handoff between CJ, the reviewing assistant, and the local coding agent. It keeps design feedback beside the implementation so a new session can recover the reasons, relevant source, and evidence without reconstructing a chat.

## Start here

- **Current review:** [UI and design review — 22 November 2026](2026-11-22-ui-design-review.md), findings **UX-01 through UX-14**.
- **Original visual evidence:** [prototype screenshot](evidence/2026-11-22/prototype-ui.png).
- **Local agent response:** use the [implementation report template](IMPLEMENTATION_REPORT_TEMPLATE.md).
- **Current response:** [Implementation response 03 — 22 November 2026](2026-11-22-ui-design-response-03.md): the rest of UX-06 and UX-14, UX-11 and UX-13 implemented, UX-12 verified through an orbit (art direction awaits CJ), a UX-08 overflow fixture, and the HV-41 experiment panel verified (`00089e5`…`46e8249`). Evidence in [evidence/2026-11-22/response-03](evidence/2026-11-22/response-03/). Earlier: [response 02](2026-11-22-ui-design-response-02.md) (UX-04/05/07/08/09/10), [response 01](2026-11-22-ui-design-response-01.md) (UX-01–03). Overwatch cards HV-46…HV-51 track the findings. CJ acceptance: not yet recorded.

The review examined prototype commit `af6977d295dd0970a744bb65281f7ec4ea8c1457` and its Lumina submodule at `ba838cca09ba43afceda0452b63d28df4cbf7f72`. Compare those revisions with the current work before acting. Later local or pushed changes may already address a finding.

## Authority and ownership

Follow [AGENTS.md](../../AGENTS.md), the local Hapa grounding it names, and CJ's current instructions. The Master Requirements v3 governs behavior; the Design Companion proposes presentation; the References Master supplies implementation advice. This review records evidence and recommendations within those boundaries. An appearance proposal does not create a new gameplay rule.

The Overwatch board **`hapa-versus` remains the canonical task state**. Link review IDs and response evidence to the relevant board cards. Append progress there using the existing local workflow; do not create a second task-status system in this folder. The known board read command is `node bin/overwatch-kanban.mjs state hapa-versus`, run from the Overwatch repository. Discover its actual update interface locally rather than inventing commands. If that service is unavailable, record the limitation in the response; do not claim the board was updated.

Implementation scope comes from CJ's current request and existing authorization. These documents preserve feedback and do not independently authorize spending, deployment, upstream publication, or unrelated work. Routine work already authorized by CJ can continue without another approval round. CJ accepts work to Done; an agent supplies the evidence for Review.

## The iteration loop

1. **CJ sets the next goal or supplies feedback.** Identify the player journey or visual decision to improve. Preserve worthwhile lower-priority findings for later.
2. **The reviewer checks the shared baseline.** Read the pushed source and available captures, state the exact revisions, distinguish observation from inference, and publish a dated review with contextual findings and acceptance conditions.
3. **The local agent checks current reality.** Inspect the existing checkout, branches, local handoffs, board, and prior work. Reproduce the selected findings. If a finding is already fixed, misunderstood, or not reproduced, provide the relevant revision and observations instead of implementing it again.
4. **The local agent implements a bounded slice.** State the expected behavior before changing code, then implement and compare the result with that expectation. Keep game rules, presentation, and the engine ownership boundary intact. Use the existing branch and commit workflow.
5. **The local agent publishes a response with evidence.** Add a dated report, bounded screenshots or other reproducible evidence, and the implementation commit references. Update the board and this index with links. A report must distinguish implementation, verification, and CJ's acceptance.
6. **The reviewer compares the result.** On the next review request, inspect the pushed implementation and response, compare before and after, and append the next dated review. Carry forward unresolved points with their context and evidence.

The repository supplies continuity between requests. Publishing a report does not by itself start an assistant review or establish that the local running application matches the pushed code.

## Fetch notes without disturbing local work

Start with read-only inspection of the checkout and a fetch:

```bash
git status --short
git branch --show-current
git fetch origin
git show origin/main:docs/reviews/README.md
```

Use the review path named by that index to inspect the latest notes. If the checkout is clean, on `main`, and can fast-forward, `git pull --ff-only` is appropriate. Otherwise keep the working branch and integrate the documentation through the existing branch/worktree workflow. Do not reset, clean, force-pull, or replace an agent's uncommitted work to obtain the notes. If the review is available on a named branch rather than `main`, inspect that exact remote ref.

## Evidence that makes the next review useful

Record the prototype commit, working-tree condition, engine pin, scenario or replay, profile, and actions taken. For visual comparisons include viewport size in CSS pixels, device pixel ratio, browser/OS, text scale, camera state, and height layer. Identify local Card renditions with the index identity and hashes when available; write “not recorded” when unknown. A source-only reviewer cannot infer ignored local artwork or unpushed changes.

Use the same scenario for before/after comparisons. Keep screenshots under a dated `evidence/` directory when appropriate, with readable names and captions. Link larger videos or owned media through their existing durable location. Do not copy an entire rendition library, signing keys, or peer stores into this folder. Preserve the original screenshot separately from any later crop or annotation and label derived images.

Run the checks required by the changed area and play the changed journey. `npm run check` covers rules tests, simulation/peer checks, and a build; its success does not establish browser interaction or visual quality. Report exact commands, observed results, and untested cases.

## Copyable instruction for the local agent

> Read `AGENTS.md` and `docs/reviews/README.md`, safely fetch the latest handoff, and compare the current checkout with the review's baseline. Review findings UX-01 through UX-14 against the current implementation and the three requirements/design documents. Within my requested implementation scope, address the highest-priority coherent slice first. Establish expected results independently, reproduce the issue, implement, and verify the changed player journey. Preserve remaining findings. Add a dated response using `docs/reviews/IMPLEMENTATION_REPORT_TEMPLATE.md`, include source revisions and visual evidence, link it from the review index, and append the appropriate Overwatch evidence. Report what is ready for my review and what remains unverified.

## Keep history readable

Use dated review and response files; add a numeric suffix when there is more than one on the same date. Preserve published findings and evidence. Corrections belong in an explicitly labeled addendum or a newer linked review. Use `2026-11-22 / UX-01` when referring to a finding outside its original review so IDs remain unambiguous.

Update the current-review/current-response links above as work advances. Maintain this short record of handoffs; task status continues to live on Overwatch.

| Date | Record | Baseline or scope |
| --- | --- | --- |
| 2026-11-22 | [Initial UI/design review](2026-11-22-ui-design-review.md) | Screenshot plus static review of `af6977d`; engine `ba838cc` |
| 2026-11-22 | [Implementation response 01](2026-11-22-ui-design-response-01.md) | UX-01/02/03 implemented in `d61d56d` (Ready freeze, single resolution, height-aware picking); scripted Chrome journeys before/after; engine `ba838cc` unchanged |
| 2026-11-22 | [Implementation response 02](2026-11-22-ui-design-response-02.md) | UX-04/05/07/08/09/10 and parts of UX-06/14 in `8569829`…`05de8fa` (scenery cut-out, aligned ribbons and one Ready, fitted home view, Card anatomy, planned vs. landed Supply, quieter ownership); engine `ba838cc` unchanged |
| 2026-11-22 | [Implementation response 03](2026-11-22-ui-design-response-03.md) | Rest of UX-06/UX-14, UX-11, UX-13, UX-12 orbit check, UX-08 overflow fixture, HV-41 panel check in `00089e5`…`46e8249`; engine `ba838cc` unchanged |

