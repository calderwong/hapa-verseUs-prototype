# Design review handoffs

This folder is the shared handoff between CJ, the reviewing assistant, and the local coding agent. It keeps design feedback beside the implementation so a new session can recover the reasons, relevant source, and evidence without reconstructing a chat.

## Start here

- **Current review:** [UI and design review 05 — Zoom into the party, enter the territory](2026-11-23-ui-design-review-05.md). Reviews main `b747d118` / implementation `fc6df0d` and CJ's close-up feedback. Findings **R5-01–R5-06**: separate selection from inspection, reveal actual member facts through close zoom, and build one inhabited territory with coherent camera depth.
- **Selected requirement changes:** [Human feedback addendum 02 — The battlefield becomes the inspection view](../requirements/2026-11-23-human-feedback-addendum-02.md). Supersedes automatic full-party hover/pin with intentional spatial inspection; preserves [addendum 01](../requirements/2026-11-22-human-feedback-addendum-01.md) Card hover, funded movement, Fire Pits/Mana and glossary behavior.
- **Next implementation brief:** [Command freely, inspect by approaching — assignment 06](2026-11-23-next-agent-assignment-06.md). First decouple selection and implement truthful member annotations; then prove one territory environment through orbit and real terrain states. Use response 06 if unused; inspect local work first.
- **Current review evidence:** [Review 05 verification and design schematic](evidence/2026-11-23/review-05/README.md). 97 independent headless tests passed; four protocol tests unavailable in review environment. Source trace and actual-rules protection observation; no new reviewer live-browser run. Prior dated evidence remains unchanged.
- **Original review:** [UI and design review 01](2026-11-22-ui-design-review.md), retained with its source baseline and UX-01–UX-14 findings.
- **Original visual evidence:** [prototype screenshot](evidence/2026-11-22/prototype-ui.png).
- **Local agent response:** use the [implementation report template](IMPLEMENTATION_REPORT_TEMPLATE.md).
- **Current response:** [Implementation response 06 — 23 November 2026](2026-11-23-ui-design-response-06.md), answering addendum 02, review 05 (R5-01–R5-06) and assignment 06: select to command (a docked command bar with short disable reasons; no party document, no camera move), approach to inspect (F, wheel or Inspect frames the real members; R returns), truthful member labels beside the bodies from one shared read model (`src/hapa/rules/inspection.js`; Bound Standard shown as applied), playback-time health, and one procedural territory environment that survives orbit, pits, roofs and cutaways. Commits `eda7ed3`…`95c88bf`; `npm run check` 108/108; regression contract 3: 270/270, sabotage fails as intended; continuous journey recorded. Evidence in [evidence/2026-11-23/response-06](evidence/2026-11-23/response-06/). Overwatch HV-58…HV-60. Earlier: [response 05](2026-11-22-ui-design-response-05.md) (addendum 01, review 04), [04](2026-11-22-ui-design-response-04.md), [03](2026-11-22-ui-design-response-03.md), [02](2026-11-22-ui-design-response-02.md), [01](2026-11-22-ui-design-response-01.md). CJ acceptance: not yet recorded.

Review 05 checked `main` at `b747d118bbb857d0ea08f98696d0714428d2f106`, including response 05 and implementation `fc6df0de7d66452caec8b35bfaa277220715a07e`. Engine gitlink remains `ba838cca09ba43afceda0452b63d28df4cbf7f72`. CJ's latest feedback changes the party-inspection interaction after using it; response 05 followed the prior full-party hover recommendation. Unpublished local work and current Overwatch state were not accessible. Read the new addendum before repeating the old party-panel contract. No CJ acceptance is recorded.

## Authority and ownership

Follow [AGENTS.md](../../AGENTS.md), the local Hapa grounding it names, and CJ's current instructions. Master Requirements v3 governs unchanged behavior. [Human-feedback addendum 01](../requirements/2026-11-22-human-feedback-addendum-01.md) records CJ's later selected changes for the new default play profile, including the explicit Supply-funded endpoint policy; implement its compatibility boundary rather than silently reinterpreting archived v3 matches. [Human-feedback addendum 02](../requirements/2026-11-23-human-feedback-addendum-02.md) governs the newer party-inspection and territory-environment direction; its presentation changes do not alter game rules. The Design Companion proposes presentation and the References Master supplies implementation advice where compatible. Working design defaults are labeled in the addendum; an appearance proposal alone does not invent a game rule.

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

> Read `AGENTS.md`, `docs/reviews/README.md`, review 04, human-feedback addendum 01 and assignment 05. Inspect local progress first and preserve it. Implement CJ's new board-based interaction: no permanent duplicate Card ribbons or inspector/Mana dashboard; stable hover/focus Card and party inspection; stronger chess identities and public destination ghosts; shared, versioned Supply-funded endpoint validation; Fire Pits and exact event-driven Mana; contextual definitions. Preserve/finish the three review 03 reliability repairs and the existing agreement/replay protections. Refit the camera to include real banks/resources, verify the complete interaction through pointer and keyboard paths, and apply the Hapa art treatment to that working scene. Publish the next unused implementation response (05 if available), update this index, and append Overwatch evidence without marking CJ acceptance.

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
| 2026-11-22 | [Review 04](2026-11-22-ui-design-review-04.md), [human-feedback addendum 01](../requirements/2026-11-22-human-feedback-addendum-01.md) and [assignment 05](2026-11-22-next-agent-assignment-05.md) | CJ selects contextual board interaction and Supply-limited endpoints; latest pushed implementation still `164b8dfe`. Reclaims permanent HUD, carries reliability findings, includes proposed layout and current-policy probe; no new acceptance. |
| 2026-11-23 | [Implementation response 05](2026-11-22-ui-design-response-05.md) | Addendum 01 / review 04 / assignment 05 and R3-01–R3-03 in `0c06ae3`…`fc6df0d` (contextual board, chess intent, funded-destination profile v3_02, Fire Pits, glossary, Hapa treatment); engine `ba838cc` unchanged |
| 2026-11-23 | [Review 05](2026-11-23-ui-design-review-05.md), [human-feedback addendum 02](../requirements/2026-11-23-human-feedback-addendum-02.md) and [assignment 06](2026-11-23-next-agent-assignment-06.md) | Reviews `b747d118` / implementation `fc6df0d`: close zoom reveals actual member facts and an inhabited territory; 97 independent tests, selection/inspection source trace, protection modifier observation and proposed schematic. No new live-browser or CJ acceptance. |
| 2026-11-23 | [Implementation response 06](2026-11-23-ui-design-response-06.md) | Addendum 02 / review 05 / assignment 06 in `eda7ed3`…`95c88bf` (command selection apart from inspection, close member labels from the shared combat read model, Focus/Return, one territory environment); regression contract 3 270/270; engine `ba838cc` unchanged |
