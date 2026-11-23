# Design review handoffs

This folder is the shared handoff between CJ, the reviewing assistant, and the local coding agent. It keeps design feedback beside the implementation so a new session can recover the reasons, relevant source, and evidence without reconstructing a chat.

## Start here

- **Current review:** [UI and design review 03 — 22 November 2026](2026-11-22-ui-design-review-03.md), reviewed `164b8dfe`; preserves the improved HUD, records two reproduced controller/rules defects plus a modal-focus risk, and advances the previously assigned Hapa terrain-and-party scene. Findings **R3-01 through R3-05**.
- **Next implementation brief:** [Reliable interactions and the first Hapa visual scene — assignment 04](2026-11-22-next-agent-assignment-04.md). Make the three bounded interaction repairs, correct evidence identity, then complete one authored terrain/party study. The next local report is **response 05**.
- **Current review evidence:** [Independent verification and historical reproductions](evidence/2026-11-22/review-03/README.md): 82 existing tests passed; payment and session-lifecycle defects reproduced with real rules and extracted controllers. The modal finding is source-supported; no fresh full-browser run or CJ acceptance is claimed.
- **Original review:** [UI and design review 01](2026-11-22-ui-design-review.md), retained with its source baseline and UX-01–UX-14 findings.
- **Original visual evidence:** [prototype screenshot](evidence/2026-11-22/prototype-ui.png).
- **Local agent response:** use the [implementation report template](IMPLEMENTATION_REPORT_TEMPLATE.md).
- **Current response:** [Implementation response 04 — 22 November 2026](2026-11-22-ui-design-response-04.md), answering review 02 / assignment 03 (R2-01–R2-08): playback height filter and ramp timing, truthful concession with confirmation, current help, a decision column with readable plans, stale review and response costs, a keyboard-only opening at 1280×720, and `tools/hapa/ui-regress.mjs` (282/282 after, 222/256 before, sabotage fails as intended). Commits `d04cee1`…`8a2ed9f`; evidence in [evidence/2026-11-22/response-04](evidence/2026-11-22/response-04/). Overwatch HV-52 (Review) and HV-53 (concession protocol follow-up). Named 04 because 03 was already the parallel answer to review 01. Earlier: [response 03](2026-11-22-ui-design-response-03.md) (UX-06/11/13/14), [response 02](2026-11-22-ui-design-response-02.md) (UX-04/05/07/08/09/10), [response 01](2026-11-22-ui-design-response-01.md) (UX-01–03). CJ acceptance: not yet recorded.

The current review examined prototype `164b8dfe46d2b6b8ec0975cc8f53ea5428770230`; review 02 examined `a68cfd0b8af874498cdb3e617715f941e52b76f2`; the original review examined `af6977d295dd0970a744bb65281f7ec4ea8c1457`. All use engine gitlink `ba838cca09ba43afceda0452b63d28df4cbf7f72`. Compare these pins with current local and remote work before acting. The newest review independently inspects source, tests and committed captures; implementation response 04's browser results remain author-reported. The before browser report's runtime-engine identity needs the correction described in R3-05.

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

> Read `AGENTS.md`, `docs/reviews/README.md`, review 03 and assignment 04. Safely fetch and compare with the reviewed source; preserve local work and the improved HUD. Within my requested scope, reproduce and fix response payment, old-session continuation after New match, and modal keyboard containment. Keep rules and protocol semantics intact, add focused behavioral assertions, and correct engine/evidence identity. Then implement the already requested small Hapa terrain-and-party scene with truthful excavation, readable roof/floor volume, bounded state effects and one provisional authored party through a full orbit. Use existing authorized assets/workflow and valid fixtures. Publish response 05 with commits, same-state visual evidence, verification limits and asset provenance; update this index and append Overwatch evidence through its actual workflow. Respect dependency gates and leave CJ acceptance separate.

## Keep history readable

Use dated review and response files; add a numeric suffix when there is more than one on the same date. Preserve published findings and evidence. Corrections belong in an explicitly labeled addendum or a newer linked review. Use `2026-11-22 / UX-01` when referring to a finding outside its original review so IDs remain unambiguous.

Update the current-review/current-response links above as work advances. Maintain this short record of handoffs; task status continues to live on Overwatch.

| Date | Record | Baseline or scope |
| --- | --- | --- |
| 2026-11-22 | [Initial UI/design review](2026-11-22-ui-design-review.md) | Screenshot plus static review of `af6977d`; engine `ba838cc` |
| 2026-11-22 | [Implementation response 01](2026-11-22-ui-design-response-01.md) | UX-01/02/03 implemented in `d61d56d` (Ready freeze, single resolution, height-aware picking); scripted Chrome journeys before/after; engine `ba838cc` unchanged |
| 2026-11-22 | [Implementation response 02](2026-11-22-ui-design-response-02.md) | UX-04/05/07/08/09/10 and parts of UX-06/14 in `8569829`…`05de8fa` (scenery cut-out, aligned ribbons and one Ready, fitted home view, Card anatomy, planned vs. landed Supply, quieter ownership); engine `ba838cc` unchanged |
| 2026-11-22 | [Follow-up review 02](2026-11-22-ui-design-review-02.md) and [assignment 03](2026-11-22-next-agent-assignment-03.md) | Reviews `a68cfd0b`; 76 independent tests passed; isolated playback-filter reproduction; compact planning/keyboard next; CJ acceptance not recorded |
| 2026-11-22 | [Implementation response 03](2026-11-22-ui-design-response-03.md) | Rest of UX-06/UX-14, UX-11, UX-13, UX-12 orbit check, UX-08 overflow fixture, HV-41 panel check in `00089e5`…`46e8249`; engine `ba838cc` unchanged |
| 2026-11-22 | [Implementation response 04](2026-11-22-ui-design-response-04.md) | R2-01–R2-08 in `d04cee1`…`8a2ed9f` (playback filter and ramp height, concession confirmation, decision column and plan dock, keyboard opening, regression assertions); engine `ba838cc` unchanged |
| 2026-11-22 | [Review 03](2026-11-22-ui-design-review-03.md) and [assignment 04](2026-11-22-next-agent-assignment-04.md) | Reviews `164b8dfe`; 82 independent tests passed; mixed-color response and session-lifecycle defects reproduced; modal-focus risk; current HUD retained and authored terrain/party scene next. CJ acceptance not recorded. |
