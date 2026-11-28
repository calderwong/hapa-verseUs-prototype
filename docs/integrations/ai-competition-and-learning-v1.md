# AI competition and learning v1 — Hapa Versus research and implementation design

**28 November 2026 · Research/design; not an implementation or benchmark report**  
**User requirements:** [Addendum 13](../requirements/2026-11-28-human-feedback-addendum-13.md).  
**Inspected Versus main:** `e86dcbbbb1df57da5d7956f147e57a763072d5d5`.  
**Delivery boundary:** this publication adds documentation. No model, match, service, training job or recurring process was run. The owner Mac checkout and Overwatch board were not accessed by this reviewer.

## 1. Recommendation

Build a bounded competition module around Versus's existing authoritative rules and Hapa Harness. Each game produces one navigable match record containing decision explanations, verified replay, derived statistics and two independent player post-mortems. Repeat against explicit scenarios/opponents, retaining all outcomes and artifact failures.

Use the current game as the first consumer. Keep small game, agent and artifact interfaces so another Hapa game can later reuse the runner. Do not make a generic framework port, a new node/repository, distributed workers, a new VPS or model training a prerequisite. Prove a second consumer before extracting a shared SDK.

### Evidence already in this public repository

Links below pin the inspected source. They describe current implementation, not the proposed league.

| Existing component | Useful foundation | Required extension or qualification |
| --- | --- | --- |
| [session.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/e86dcbbbb1df57da5d7956f147e57a763072d5d5/src/hapa/rules/session.js) | Sessions, synchronous bot matches, accepted-plan/response replay, per-Tick fingerprints and recomputation | Async model orchestration; validate declared terminal result/final fingerprint against the recomputed values |
| [experiment.mjs](https://github.com/calderwong/hapa-verseUs-prototype/blob/e86dcbbbb1df57da5d7956f147e57a763072d5d5/tools/hapa/experiment.mjs) | Headless batches, report and per-game replay exports | True same-scenario seat-swapped pairs, unique repeated-run IDs, current profile, complete agent provenance |
| [model-decider.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/e86dcbbbb1df57da5d7956f147e57a763072d5d5/src/hapa/controllers/model-decider.js) | Bounded Harness call, legal shortlists, stored fallback, request/input/state binding, stale/duplicate rejection | Two independently bound seats; application-independent adapter; durable per-choice explanations rather than one optional remark in a rolling 200-entry diagnostic list |
| [heuristic-bot.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/e86dcbbbb1df57da5d7956f147e57a763072d5d5/src/hapa/controllers/heuristic-bot.js) | Legal candidate generation and baseline controller | Current model selects shortlisted destinations and prepared counter/pass choices; funding and other commands remain heuristic. Expand action scope as a separately versioned later policy. |
| [stats.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/e86dcbbbb1df57da5d7956f147e57a763072d5d5/src/hapa/rules/stats.js) | Event-derived economy/combat summaries and idempotent projections | Durable primary storage; contestant-revision comparisons; inference reliability/resource metrics |
| [lab.js](https://github.com/calderwong/hapa-verseUs-prototype/blob/e86dcbbbb1df57da5d7956f147e57a763072d5d5/src/hapa/presentation/lab.js) | Existing experiments UI and replay download | Current Watch starts a new heuristic game from profile/seed. Add playback of recorded decisions without running controllers. |
| [app._resolveAgreed](https://github.com/calderwong/hapa-verseUs-prototype/blob/e86dcbbbb1df57da5d7956f147e57a763072d5d5/src/hapa/presentation/app.js#L964-L1027) | Drives the shared rules generator while awaiting response choices | Extract presentation-free async orchestration; retain the existing rules and replay shape |

The existing experiment alternates controller seed placement across different seeds; it does not play every seed twice with the contestants reversed. Its `exp-${profileId}-${seed}` IDs also repeat across runs, and its defaults include older profiles. The new runner must explicitly select `hapa_open_10x9_v3_07`, carry full profile/content fingerprints, and make match identity independent of seed. Existing heuristic revision labels differ between files; pin actual source/configuration, not just a display label.

## 2. Ownership and execution

| Owner | Responsibility |
| --- | --- |
| Versus rules | Legal commands, phase order, resolution, terminal result and deterministic reconstruction |
| Versus competition runner | Schedule, observations, agent instances, finite budgets, validation/admission, durable recovery and artifact assembly |
| Hapa Harness | Qualified participant inference, admitted model/profile bindings, bounded cancellation/receipts, and separately qualified post-game analysis |
| Competition journal | Immutable provenance, actual decisions, artifact references, acknowledgements and corrections |
| Existing presentation | Run controls, read-only replay/timeline, statistics and player reviews |
| Other Hapa owners | Canonical Avatar identity, optional lesson/memory ingestion, documentation, quest and telemetry integration through their actual contracts |

Bulk competition should run headlessly on one local Nexus first. The normal renderer can attach as a spectator or open completed replays; rendering, speech, music and Avatar media need not consume resources for every training/evaluation game. A local rules simulation is labeled as such. It is not evidence of native peer/WAN execution; qualify representative peer play separately when that delivery mode is selected.

### Preserve the actual planning rules

[PhaseAgreement](https://github.com/calderwong/hapa-verseUs-prototype/blob/e86dcbbbb1df57da5d7956f147e57a763072d5d5/src/hapa/protocol/agreement.js) uses **public plans**. The selected current profile uses `own_plan_ready_v1`; older manifests may use `pair_acknowledgment_v3`, which remains supported. Preserve each replay's recorded agreement policy. This is not a hidden-plan commit/reveal game.

For the initial comparison, declare a one-pass planning schedule: capture each seat's permitted view at the same planning boundary, collect their choices against those snapshots, then submit/commit through the host. Inference may be serial while observations remain comparable. Record this scheduling/observation policy as part of the experiment; do not present it as a new ordinary-game secrecy rule. A later iterative public-plan policy is a different contestant/cohort. An opponent's private explanation, review or unapproved memory is not added to the live input merely because the game plans are public.

### Async driver and recovery boundary

Reuse `resolveTick(state, ctx, acceptedPlans)` from the shared rules. The application driver validates plans, starts the generator, awaits the responsible agent for each yielded response, fences match/epoch/seat/state after every await, durably records the admitted answer and advances exactly once. On completion, retain the existing replay Tick shape `{tick, plans, choices, fingerprint}`.

Do not pass Promises to the synchronous `runTick`/`closeTick` chooser, duplicate resolution logic, or put model calls/wall clocks inside deterministic rules. Preserve the sync paths for heuristic execution and replay verification.

Persist decision intent and resource reservation before dispatch. Persist reply/admission before applying it. Reopening an admitted decision reuses the recorded answer. If dispatch outcome is uncertain after interruption, record `unknown` and reconcile or apply the predeclared interruption policy; do not silently issue the call again. A new attempt has a new ID and explicit predecessor/budget attribution. Fence late replies and retain exactly-once **admission** without falsely promising exactly-once backend execution.

## 3. Define the contestant precisely

An Avatar, a model and an agent configuration are different identities. Two isolated instances can share the same loaded model while owning different seats and strategy versions. Swapping the seat does not change the contestant.

Freeze the following in a run manifest:

- Run/match/replicate/pair IDs; game source revision; expanded profile, content and deck fingerprints; initial state and game seed.
- Seat-to-agent-instance mapping; optional canonical Avatar identity/revision; controller and candidate-generation revision; observation/action-space and planning-schedule versions.
- Exact admitted model/provider profile and observed served identity; artifact/quantization/runtime/template details where verifiable, otherwise explicitly unknown; decoding settings and model sampling seed where supported.
- Prompt/policy hash; approved strategy capsule hash or explicitly empty memory; tool/capability set; complete token/time/retry/fallback limits.
- Actual producer for each decision, including model, heuristic, rule-forced action or human intervention.

Rank and compare immutable configurations. A change to model, prompt, memory, observation detail, candidate generator, budget or fallback policy creates a new comparison boundary. Human intervention marks the run and cannot disappear into an apparent autonomous win. The manifest can contain multiple model producers when a later explicitly configured policy uses them; the Avatar remains its stable identity.

## 4. The four artifacts

### 4.1 Decision explanations

A move is an intentional decision, not every animation or automatic economy event. A planning packet may produce multiple commands; a response window is another decision. Preserve both packet-level context and the mapping of each selected option to admitted commands.

Required decision record fields:

| Group | Fields / meaning |
| --- | --- |
| Binding | Run/match, Tick/phase/choice, seat, agent instance/configuration hash, request/attempt ID, epoch |
| Inputs | Observation and permitted-context hash, state fingerprint, offered-option/action-space hash, exact source references |
| Declared intent | Short objective/summary; explanation for each selected option; expected benefit, principal risk and an alternative where useful; cited observed facts |
| Actual result | Proposed choice; validation result; admitted command/answer hash; fallback/forced-action producer and reason; successor event references |
| Execution | Measured queue/inference/end-to-end time, usage where reported, deadline/status, provider receipt/output hash; missing telemetry explicit |

Generate the choice and short explanation together, before the result is known. Bind explanation decision/option IDs to the actual proposed selection and then to the admitted action. Preserve the original record if the player later changes its interpretation. For a rejected proposal, retain the explanation as an attempted action; do not attach it to a different fallback move. Heuristic-funded or rule-forced commands get their own producer/reason, not an invented model rationale.

Keep notes brief enough to afford every decision: a short plan summary and one concise reason per chosen option, with expected effect/risk at the appropriate level. Full reflection belongs in the post-mortem. If a late explanation is generated later, label it retrospective. Unknown confidence stays unknown; self-reported confidence is not a calibrated win probability. These records express declared intent; they are not guaranteed causal transcripts of internal neural computation [R5].

### 4.2 Verified replay and faithful viewer

Keep the existing replay wire format and accepted plans/answers authoritative. Commentary and resource traces are linked sidecar records, not a change to archived game signatures or rules semantics.

Verification reconstructs the game without any model/controller calls, compares per-Tick checkpoints, and checks the terminal envelope against the returned recomputed final fingerprint/outcome. A reported win is not trusted merely because intermediate checkpoints match. Budget/user/provider termination is recorded separately from a genuine rules-terminal result.

The UI opens this exact artifact. Reuse board/playback/inspection helpers for play/pause, step, Tick jump and side-by-side explanations. A post-mortem citation opens its event/decision in the replay. Show attempted versus executed moves and missing commentary accurately. A recorded game is replayable even if the model/owner is offline. Pin compatible rules/content versions; reject incompatible replay versions explicitly rather than quietly replaying under changed rules.

The existing Lab Watch rerun is not sufficient for model games. A model seed or temperature setting cannot guarantee the same response later; deterministic reconstruction applies to the recorded accepted actions, not to regenerating inference. Video/highlight exports are optional derivatives.

### 4.3 Statistics

Derive factual metrics from verified events and decision receipts, never from player narration. Reuse `summarize`/history projections where definitions match; version new reducers.

| Category | First useful metrics |
| --- | --- |
| Outcome | Scheduled/started/completed/verified counts; wins/draws by agent and seat; terminal reason; unfinished/cancelled/faulted counts; Tick length |
| Game behavior | First engagement; Supply loaded; Mana burned/expired; unused cards replaced; casts; damage/channel/face; casualties; merges; meaningful territory/control snapshots when instrumented |
| Agent reliability | Model-eligible, requested, admitted, abstained and fallback decisions; invalid/late/duplicate replies; action-space coverage; human interventions |
| Resource use | Actual calls; reported input/output/reasoning tokens; queue/inference/total latency; measured wall time; reserved/unknown usage; storage growth |
| Comparison | Exact opponent matrix, seat splits, scenario/seed pair, model/policy/memory revision and declared budget |

The rules currently distinguish win/draw from an unfinished Tick-budget run. A provider timeout is not a rules loss or draw. A league may later define a separate operational forfeit policy, but must name it and retain the underlying game state.

Keep all attempts visible. A fallback-enabled policy is evaluated as that declared whole, with fallback coverage prominently reported. A separate model-only analysis must disclose exclusions and failure denominators; silently dropping failed games creates a misleading comparison. Missing usage/cost is not zero. Practice/experiment results do not enter human PvP standings by default.

Start with matchup counts and score rates; add a rating only when the pool and schedule justify it. Keep raw results beneath any rating. Report uncertainty using the actual independent scenario/pair blocks, not thousands of correlated per-move samples. A small pilot establishes pipeline operation, not reliable model ranking or game-balance conclusions [R6].

### 4.4 Independent player post-mortems

After replay verification, create one bounded evidence pack per player: manifest/configuration, verified result/stats, that player's frozen decision notes, and referenced relevant events/positions. A deterministic reducer can identify first engagement, major losses, threats and terminal events to reduce context cost. State whether the pack is complete or selected; selected excerpts do not justify claiming the agent reviewed every moment.

Each player returns machine-readable fields plus a readable rendering:

1. Strategy at the start and intended route to victory.
2. Decisive moments with Tick/decision/event references.
3. What worked, what failed, and where expectation differed from actual result.
4. Specific changes for a future attempt, including legal alternatives and their assumptions.
5. A short list of candidate strategic axioms with applicability conditions and evidence.
6. Uncertainties: untested counterfactuals, missing context and limits imposed by the action adapter.

Generate the two first reports independently. A later coach/comparison report may see both, but is optional and has a separate role/budget. The winner's explanation is not automatically correct, and the loser may identify the more useful lesson.

Check evidence IDs and basic factual assertions against the replay. Keep opinion and counterfactual claims labeled. If an alternate move is later simulated, give the branch its own parent replay/state reference and explicit opponent-continuation assumption. One successful branch is evidence under those assumptions, not proof of an optimal move.

A post-mortem timeout leaves a verified game with `review_pending` or `review_failed`. Retry only that artifact under a new attempt identity; do not replay the whole game to recover prose. Reserve capacity for **two** reports at match admission.

## 5. Primary persistence and portable exports

Use a dedicated append-only Hypercore competition journal for durable run/configuration/decision/artifact records. Preserve native match streams where that execution mode uses them. Model commentary is separately identified; a cryptographic hash proves record integrity/provenance, not that an explanation or strategic claim is true.

Append events such as run/match creation, dispatch intent, reply/admission, resolved Tick, match termination, replay verification, stats projection, player review and lesson proposal. Use stable IDs and canonical hashes. Content-addressed immutable blobs may hold larger artifacts; retain them locally under a declared quota before releasing references. Do not prune referenced primary evidence silently. JSON/Markdown/CSV and UI databases are rebuildable exports/projections.

A portable match export contains a manifest, the existing replay, ordered decision records, statistics, both player reviews and an artifact/proof index. Verify hashes on import and deduplicate by actual artifact/match identity. Distinguish complete, missing, unavailable and unverified artifacts. P2P transfer can use existing primitives when selected; a local proof of the four artifacts does not require running every game over WAN.

Canonical Second Brain lessons, Wiki pages, Quest Keeper entries and telemetry acknowledgements remain owner operations. Record export-ready/queued/acknowledged state truthfully. Do not claim ingestion from a file write or turn generated hypotheses directly into universal memory. Private owner context, credentials and raw local diagnostics stay outside public repository evidence. The common I/O Bar can show aggregate local inference/artifact-transfer activity through the existing telemetry contract; avoid flooding durable ledgers with per-frame display samples.

## 6. Fair repetition and actual learning

### Frozen evaluation

Freeze models/configurations, prompts, memory, observations, action space and budgets for the block. For every declared scenario/seed, run both seat assignments. Keep game seed, controller randomness, model sampling seed and replicate identity separate. Keep deck/content assignment fixed or explicitly declare it as another experiment factor. Verify that a variation changes relevant states/trajectories; repeated identical deterministic play is not new strategic evidence.

Retain a small opponent pool: heuristic baseline, initial model-assisted configuration, prior accepted version and a different qualified strategy/configuration when available. Preserve the matchup matrix. This borrows the lesson from population-based research that policies can overfit the opponents they encounter; it does not claim to implement PSRO or prove equilibrium [R2].

### Development and promotion

Post-mortems propose lessons. A candidate lesson record includes:

`claim`, `when_applicable`, `suggested_action`, `supporting_refs`, `counterexamples`, `rules_profile`, `agent_revision`, `status`, `parent_or_supersedes`, and `test_plan`.

For example, a proposed rule about preserving a Capital defender should state the threat/board conditions, cite games where it helped, and retain cases where committing that defender elsewhere was successful. Treat it as a hypothesis until supported within its scope.

A new approved lesson capsule or prompt creates a new agent revision between batches. Compare it against frozen controls and held-out scenarios that were not used to write the lesson. Define promotion criteria before looking at the holdout result; retain the old configuration for rollback. First-slice promotion is explicit, not automatic self-modification.

Reflexion demonstrates the research pattern of using verbal feedback and episodic memory without weight updates [R4]. It does not establish that Hapa's agents improve. Repeated inference, memory/prompt adaptation, search and fine-tuning/RL are different mechanisms. Weight training and autonomous code/rules changes are outside this initial artifact loop.

## 7. Inference-owner contract to qualify

The public Versus adapter already calls a bounded participant-game interface. Reuse that ownership boundary. The following are **required capabilities to qualify**, not claims that new endpoints or schemas already exist:

- A versioned decision result with concise per-choice explanations, strict decision/option binding and a complete agent/profile/configuration identity. Preserve compatibility with the current player adapter.
- Two isolated agent instances, initially allowed to share one already-qualified local model. Later per-seat model/profile selection must use owner-admitted bindings, not arbitrary endpoint/model strings from a game packet.
- A separate completed-game review operation with bounded evidence, schema, output/time budget and no authority to alter a match.
- Explicit capability negotiation and limits; report unsupported operations honestly. Do not widen author/chat permissions or insert unapproved memory into observations to obtain a report.
- Optional later strategy capsules as an explicitly qualified participant capability. Initial evaluation can use empty memory; a lesson proposal is not permission to expose broader Avatar/personal memory.

The local implementation agent must reconcile these requirements with the Harness owner's current contracts and qualification workflow. Keep private operational configuration and owner source details in their own repository. An absent review capability is an implementation dependency, not permission to fabricate a report or silently use a different producer.

## 8. Resource and product behavior

Start with **one active match, one outstanding local inference request, and two isolated logical players**. Sharing resident weights is compatible with separate player contexts. Discover the actual admitted/available provider through existing owner capabilities; remembered model names or stale registry entries are not readiness proof. No automatic paid-provider fallback, model download, extra service or multiple large resident models is selected here.

Every run declares maximum games, Ticks, model calls, generated/input-context budgets, wall time, storage, per-call deadlines and retry policy. Reserve capacity for review artifacts. Default to no automatic repair loop; a failed attempt uses the declared fallback/interruption policy with honest attribution. Budget unknowns remain reserved/unknown rather than being refunded as zero. An unknown or timed-out dispatch also retains its inference-concurrency reservation until the owner reconciles it or a qualified termination policy settles it. HTTP cancellation alone does not free that slot for another call. This applies to player-review retries too; the initial implementation may pause further inference and preserve an honestly labeled heuristic/interrupted result. HTTP cancellation alone is not proof that a backend has stopped consuming compute.

For a game with two planning calls per Tick, `T` Ticks and `R` model response calls, a useful planning estimate is `2T + R + 2` model calls, including the two reviews. Actual call count may be lower when no choice is offered. Measure a finite pilot before projecting throughput or choosing a larger batch. This design makes no tokens-per-second or cost estimate for unobserved Nexus state.

Extend the existing Rules & experiments area with a small competition view: choose admitted contestants/profile and finite limits; Start/Pause/Stop/Resume; show progress, model coverage and budget; open a match's Replay, Decisions, Stats, Player A review and Player B review. Preserve inspectable partial games. A keyboard-accessible timeline links explanations and reports to game moments.

Expose equivalent application operations through CLI/API and the desktop shell; proposed operation names/commands are not existing interfaces. Share one application service for creation, status, stop/resume, artifact retrieval and verification. No separate full UI framework is needed. Renderer-free bulk execution and optional spectator playback are distinct performance modes.

## 9. Implementation order and qualification

1. **C13-01 — Bind the experiment.** Inspect newer local work/board; pin current rules/profile, truthful contestant/action-space identities, unique match IDs, declared planning policy and finite schedule. Establish the small inference-owner capability handoff. Preserve friend.9 and the music work.
2. **C13-02 — Connect both seats.** Build the headless async application driver over `resolveTick`, refactor reusable model-adapter input away from the browser app, and collect bounded explanations. Keep heuristic/missing/fallback provenance. Broader legal action coverage is a later named revision.
3. **C13-03 — Retain and recover.** Journal intent/admission/artifacts in append-only primary storage; resume committed decisions without re-inference; bound uncertain requests and late replies. Preserve replay compatibility and verify terminal facts.
4. **C13-04 — Produce the complete match record.** Event-derived stats, two independent evidence-linked reviews, candidate lessons and exact artifact completeness. Add real recorded-game viewing and the small UI/CLI/API controls.
5. **C13-05 — Prove one whole, then repeat.** First obtain one complete genuine game and its seat-swapped partner within explicit limits. Budget-limited attempts remain honest partial evidence. Demonstrate replay while inference is unavailable, a failure/fallback attribution case, interrupted/reopened admission, and both report links. These are pipeline witnesses, not a statistical tournament conclusion.
6. **C13-06 — Qualify a bounded batch.** Run the required integrated check once for the assembled candidate, focused regressions for actual failures, and a small declared local competition block. Qualify changed installed behavior if releasing a package. Report results and costs actually observed, without relabeling simulations as peer games or untested hypotheses as learning.

Use Loose Screws: focused checks during assembly, one complete connected qualification, and evidence reuse. Avoid unrelated rules/network rewrites, huge benchmark grids or repeated full suites after each edit. Publish a focused implementation response with source/artifact identity, surface coverage, all four artifacts, unresolved owner dependencies and actual board progress. CJ's acceptance and strategic quality remain separate from technical completion.

## 10. Research basis and limits

Primary sources inspected on 28 November 2026. Recommendations above adapt these ideas to the audited Hapa implementation; they are not claims that Hapa already implements these frameworks or inherits their results.

| Ref | Primary source | Design implication |
| --- | --- | --- |
| R1 | [TextArena official repository](https://github.com/TextArena/TextArena) | A compact observation-to-action interface supports local model competition. Borrow the pattern; keep inference behind Hapa's owners. No package installation or hosted-provider example is required. |
| R2 | [Lanctot et al., A Unified Game-Theoretic Approach to Multiagent Reinforcement Learning](https://arxiv.org/abs/1711.00832) | Evaluate against a population of frozen opponents and retain pairwise results to reduce narrow opponent overfitting. Prompt iteration is not automatically PSRO. |
| R3 | [OpenSpiel official repository](https://github.com/google-deepmind/open_spiel) | Explicit game/observation/action interfaces and simultaneous-game support are useful reference designs. A later research adapter is possible; replacing current rules with a second C++/Python implementation is unnecessary for this slice. |
| R4 | [Shinn et al., Reflexion](https://arxiv.org/abs/2303.11366) | Explicit reflective memory can change later behavior without changing weights. Hapa needs its own held-out evidence before claiming improvement. |
| R5 | [Chen et al., Reasoning Models Don't Always Say What They Think](https://arxiv.org/abs/2505.05410) | Generated explanations can omit influences on decisions. Capture declared intent, validate facts separately and do not advertise complete internal transparency. |
| R6 | [Agarwal et al., Deep Reinforcement Learning at the Edge of the Statistical Precipice](https://research.google/pubs/deep-reinforcement-learning-at-the-edge-of-the-statistical-precipice/) | Small-run point estimates can be misleading. Show denominators, variability and uncertainty appropriate to the independent evaluation unit. |

No source establishes model strength, learning gain, game balance, exact runtime compatibility or throughput for this proposed Hapa league. Those remain measured outcomes of the future implementation.
