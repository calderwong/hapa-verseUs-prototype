# Loose Screws

## Default assembly and verification protocol for large bodies of work

**Version:** 1.0.0  
**Owner:** CJ / Hapa  
**Default delivery target:** A functional MVP, tightened and locked to the agreed specification.  
**Applies to:** Work with multiple interacting parts whose final fit becomes clearer through assembly.

### The governing principle

**Attach each part firmly enough for the next part to depend on it. Assemble the
complete MVP. Then align, tighten, and qualify the connected system to the agreed
specification.**

The furniture analogy defines the sequence. Early attachments must hold, but
their final adjustment should remain inexpensive while the rest of the assembly
is taking shape. Do not maximize local finish before the interacting parts exist.
Once the whole assembly fits, complete the tightening pass; do not leave a
permanent collection of loosely connected prototypes.

Loose Screws changes **when and at what scope work is verified and finished**.
It does not lower the final specification, expand permissions, or authorize
misleading completion claims. The objective is the shortest reliable path to the
accepted whole, including avoidable rework, model usage, and coordination cost.

## 1. When this mode applies

Use Loose Screws by default for substantial features, applications, integrations,
migrations, coordinated agent work, and other assemblies with interacting parts.
The user does not need to request it repeatedly after it is adopted as the
workspace's default policy.

For a small isolated change, attachment, fit, and final verification may occur in
one short pass. Do not manufacture a multi-stage process for a one-line fix.
For an existing live system, stage new work without weakening its current service
guarantees. The looseness belongs to unfinished implementation choices, not to
the integrity of an operating system or its data.

The default task includes both assembly and final tightening. An explicit request
for an assembly-only checkpoint may end earlier, with that limited state clearly
reported. Otherwise, reaching an assembled MVP is the signal to tighten, not the
signal to declare the job complete.

## 2. Four distinctions every participant must understand

| Term | Meaning |
| --- | --- |
| **Attached** | A real connection works at its relevant interface, and the next dependent step can rely on it without a known false assumption. |
| **Assembled MVP** | Every capability required for the agreed MVP is connected into working end-to-end journeys in the declared environment. |
| **Tightened** | The integrated candidate meets the applicable technical acceptance criteria, including required robustness, performance, usability, and recovery. |
| **Locked** | The identified candidate, its evidence, its operating/publication/deployment state, and the delivery claim agree. Every gate required for that claim is satisfied. |

These terms are evidence states, not interchangeable synonyms for “done.”
Compiling code does not prove a behavior works when the behavior remains uncertain.
A stub, always-success response, disconnected UI, or undocumented simulation does
not establish a real attachment.

The environment is part of the claim. Fixture-based integration evidence can be
useful and honestly reported. It does not silently satisfy a required live
integration. If the agreed MVP requires a real external dependency that is
unavailable, that gate is blocked even if independent implementation is complete.

## 3. The execution sequence

| Phase | Work to perform | Evidence needed to advance |
| --- | --- | --- |
| **Frame** | Establish the selected MVP outcomes, main connections, indispensable constraints, and final acceptance. Resolve uncertainties that could invalidate the immediate build direction. | A bounded outcome plan and an understood next integration step. An exhaustive design is unnecessary. |
| **Assemble** | Build and connect the necessary parts. Establish attachment-level confidence, keep changes adjustable, and continue to the next ready part. | Working connections and enough focused evidence for dependent work to proceed. |
| **Fit** | Exercise the complete required journeys and align the parts as one MVP. Repair integration mismatches. | All agreed required capabilities work together in the declared environment; no required behavior is hidden behind a placeholder. |
| **Tighten** | Resolve finishing work in coordinated passes and verify the integrated candidate against the agreed acceptance criteria. | Advance to Lock when required technical acceptance is satisfied. An unresolved required gate remains blocked or under a useful discriminating investigation. |
| **Lock** | Reconcile source, evidence, operating state, and delivery; perform authorized publication/deployment through the current procedure when required. | The exact delivery claim is justified and the work/Goal state reflects completion or a real blocker. |

Proceed autonomously through ready phases and agreed milestones. A phase boundary
is not a new permission request. Existing authorization continues to apply.
Seek input only for an actual unresolved scope, authority, or external dependency.

One useful assembly strategy is to establish an early thin path through the
whole system, then fill out the remaining MVP capabilities. This exposes whether
the important connections fit before expensive local finishing. It is not a
license to call the thin path the complete MVP.

### Returning to earlier work

If fitting or tightening exposes a broken connection or missing required behavior,
reopen that affected assembly and its dependents. Preserve unrelated work and
valid evidence. Do not restart the entire project because one seam changed.

If a new idea is optional, put it outside the current scope. Do not move the finish
line by adding polishing, abstractions, dashboards, metrics, or future features
that the agreed delivery does not require.

## 4. What counts as attached enough

Before treating a connection as attached, establish that:

1. The necessary behavior actually exists at the relevant seam.
2. It fits the immediate input/output, state, ownership, and error contract needed
   by its next consumer.
3. The next assembly step can rely on it without knowingly relying on a broken
   behavior or unsupported assumption.
4. Any changed critical boundary has the focused evidence needed before it is
   used for consequential effects.
5. Known finishing work is visible and can be addressed during tightening.

These are conditions, not five mandatory tests or five new documents. One
existing check may establish several conditions. Inspection, compilation, a
small executable probe, or a focused integration test can be sufficient when it
actually resolves the relevant uncertainty. Select the cheapest adequate evidence.

The operating question is:

> **What must be true for the next part to depend on this connection?**

Stop local qualification once that question is adequately answered. Continue
assembly instead of seeking maximum confidence in an isolated part.

An attachment is a meaningful dependency or integration seam, not every function,
file, button, or line of code. A single check may support a batch of related
attachments. Do not translate this protocol into one new test per “screw.”

## 5. Verification during assembly

Run an early check when it has one of these concrete purposes:

- **Choose the next build step:** Resolve an uncertainty whose result changes
  what should be implemented next.
- **Establish a dependency:** Check a new or changed shared contract before
  building its consumers on an unverified assumption.
- **Protect a changed critical boundary:** Verify the relevant authority,
  isolation, durable-data, cancellation, accounting, or source-integrity behavior
  before relying on it for a real effect.
- **Repair an observed failure:** Reproduce or inspect the relevant failure,
  correct its cause, and check the affected behavior.
- **Prove attachment or whole-system fit:** Run the smallest check that supports
  advancing the current assembly or fit gate.

A file edit, commit, documentation update, compaction, passage of time, or desire
for reassurance is not by itself a reason to test again.

During assembly, normally defer exhaustive regression, broad independent review,
production benchmarking, speculative edge-case expansion, deep optimization,
visual polish, and release packaging until the integrated candidate is ready.
If one is necessary earlier, connect it to an actual decision or changed risk;
“quality” alone is not a sufficient explanation.

This is not a ban on broad tests. A changed shared primitive may genuinely require
a broader check before further dependent work. Use that check because its result
matters now, not because a patch was made. Preserve genuinely mandatory gates.

### After a failure

Repair the related cause coherently and rerun the affected check. Broaden only
when new evidence indicates wider impact or an applicable gate requires it.
Independent assembly may continue while a separate attachment is blocked.
Do not build dependent effects on the known broken attachment.

Do not write tests that merely restate reversible low-impact implementation.
Keep durable regressions for meaningful defects and contracts. Prefer useful
evidence over a growing count of tests.

## 6. Boundaries that remain firm throughout

Existing permissions, ownership, privacy, source integrity, truthful status, and
protection against known data corruption remain binding in every phase.
Necessary task control and cancellation must work before using them to manage
consequential live execution. Required safeguards do not become optional because
the surrounding feature is unfinished.

Apply this rule to the actual changed boundary. Do not classify the entire
project as critical and use that classification to demand every possible test
after every patch. Proven unchanged safeguards may be reused.

External effects retain their normal authorization. A local checkpoint does not
imply permission to push unrelated work, restart a service, use paid models,
expand a data grant, or deploy an unfinished assembly.

## 7. The assembled MVP gate

Enter system tightening when all of the following hold for the selected scope:

- Required components exist and are connected.
- Required user journeys work end to end in the declared environment.
- No known broken attachment prevents those journeys.
- The remaining work concerns alignment, resilience, performance, usability,
  maintainability, packaging, or qualification of implemented behavior.
- Missing functionality, unavailable dependencies, and unproven live behavior
  are explicitly distinguished from finishing work.

“The files exist,” “the unit tests pass,” or “the demo looks complete” is not a
substitute for that gate. A missing required capability must be assembled; it
cannot be renamed polish to make the board green.

The gate may reuse evidence already collected while assembling. Do not rerun
every attachment check just to produce a new “MVP assembled” ceremony.

## 8. Tighten the connected system

Tightening is a coordinated sequence chosen from the assembled system's actual
dependencies. It is not one enormous final test and not a return to perfecting
each part in isolation.

A normal order is:

1. **Align shared behavior:** Resolve cross-component contracts, state transitions,
   ownership, and user-journey inconsistencies.
2. **Secure reliable operation:** Address applicable failure, persistence,
   cancellation, recovery, and isolation requirements.
3. **Meet system targets:** Measure and improve the required performance and
   resource behavior on a fixed candidate/profile.
4. **Finish the experience:** Complete required usability, visual, accessibility,
   and operational clarity.
5. **Qualify and deliver:** Run the agreed integrated acceptance, review the
   coherent result, and complete required packaging and authorized rollout.

Adapt that order when dependencies justify it. Do not introduce a new category
of work merely because it appears in this list; the agreed specification controls
what is required.

Fix related findings in batches. Recheck the affected contracts after each batch.
Run the final whole-system gate against the final candidate as required. Do not
rerun all qualification after every cosmetic correction when the relevant
dependencies remain unchanged.

### Empirical outcomes and human gates

A bounded experiment can end with pass, fail, or insufficient evidence. Correct
code does not guarantee that a particular model, optimization, or hardware profile
will meet a performance or reasoning target. Keep the original requirement open
when it does not pass.

Before retrying, identify a changed causal hypothesis and the result that could
distinguish it. Repeating a failed case unchanged or making cosmetic prompt
revisions is not new progress. When interventions stop producing new information,
pause that experiment and use another permitted approach or report the limitation.

Human acceptance, external services, owner grants, and resource decisions remain
explicit dependencies. Finish independent authorized work; if no ready work or
useful discriminating check remains, report the actual dependency and pause the
affected goal. Do not substitute unlimited polishing.

## 9. Reuse evidence and keep adjustment inexpensive

A passing check remains useful while its relevant code, tests, interfaces,
configuration, dependencies, inputs, environment, and authority assumptions remain
compatible. Reopen it when those dependencies change, not merely because a new
commit or context window exists. When the boundary is uncertain, choose a
proportionate conservative check.

Record only what is needed to reuse evidence: check, tested inputs/source,
environment, result, and evidence location. Existing logs can serve as the
receipt. A new report or schema is unnecessary if the current record suffices.

Keep mutable build history separate from stable runtime operating instructions.
Progress reporting should not automatically alter a worker's mandatory context,
trigger repinning, or require redeployment. Preserve the integrity checks for
actual instruction changes.

After compaction, resume from the current checkpoint and applicable instructions.
Read the relevant changed sources; do not voluntarily reload all history or
repeat successful checks merely to rebuild confidence.

## 10. Coordinate agents and operational work

Give component agents the relevant interface contract, attachment evidence, and
an attachment-level stopping point. They return the working connection, relevant
evidence, assumptions, and remaining tightening items. They do not independently
polish, benchmark, deploy, and release every part to final quality.

One coordinating owner maintains whole-system fit and schedules tightening.
Propagate shared-contract changes before dependent work continues. An independent
review is useful at a meaningful risk or integration boundary; repeating reviews
of unchanged evidence does not establish new progress.

Local checkpoints can preserve work without triggering a complete publication,
board, catalog, repin, or deployment cycle. Batch those operations around an
integrated outcome, an actual external consumer's need, or a material blocker.
Required source-integrity and owner writeback rules still apply.

Deploy through a supervised, recoverable procedure. Do not stop a service in one
model turn and rely on another turn to decide how to start its replacement.
Keep committed, published, running, and accepted states distinct.

## 11. Minimal working state and completion

Use the existing plan or checkpoint. It needs only:

- The agreed MVP scope and current phase.
- What is attached/integrated, with relevant evidence pointers.
- The next required connection or fit issue.
- Grouped remaining tightening work and actual blockers.
- Current source and operational state where relevant.

Update at meaningful integration, phase, or interruption boundaries. Progress
messages can stay concise and need not each create a ticket, commit, or permanent
artifact. Do not create a new approval or model-review process for every screw.

Each deferred finishing item must have a reason it can wait and a place in the
tightening pass. Record it once in the current plan. Deferral must not become
forgetting, and finishing must not silently become scope expansion.

At lock, report the delivered scope, evidence, source/artifacts, actual operating
state, and any unresolved gate. Mark the Goal complete only when its requested
delivery claim is satisfied. If required acceptance is blocked, report that
state accurately rather than claiming a locked release.

Budgets, retry limits, durable status, and handoff reserves remain fallback
controls. The primary efficiency mechanism is correct sequencing and evidence
reuse. This protocol does not itself install a scheduler or tool interceptor.

## 12. Examples

| Work | Attachment and assembly proof | Coordinated tightening |
| --- | --- | --- |
| **Hapa Harness task journey** | A real path connects Red's request, permitted context, bounded delegation, artifact receipt, and visible task state. Check changed control/data boundaries before live effects. | Qualify recovery, concurrency, accounting, model/profile targets, and the completed experience against the agreed requirements. |
| **Hapa Versus movement experience** | Selection, legal destinations, supply-constrained orders, and tick resolution work together. The UI is connected to actual rules. | Refine board readability, camera/hover behavior, animation, accessibility, performance, and required full-game regressions. |
| **New external adapter** | Establish the real contract and one representative permitted round trip needed by its consumers. | Complete required retry, failure, compatibility, throughput, and operational qualification once the consuming workflow fits. |
| **Large document or design package** | Every required section/flow exists, the argument or experience connects, and unresolved assumptions are visible. | Reconcile terminology, evidence, cross-references, visual consistency, editing, and final acceptance across the whole package. |

These illustrate sequencing; they do not replace the actual project scope or
waive a required capability. For example, visual behavior explicitly required
for the MVP must exist at assembly-level fidelity, even if its finishing remains.

## 13. Adoption in this repository

This is Hapa's Loose Screws v1.0.0, adopted for large work through the repository's
`AGENTS.md`. The short instruction there replaces the former undefined
full-verification-after-each-coherent-change cadence. Preserve unrelated guidance
and binding platform/managed requirements.

Keep the short instruction and current checkpoint in active context. This full
policy is reference material; do not reread it after each small edit or compaction
when the operative rules are already preserved. It is a workflow policy, not a
native coding-model option or an installed enforcement engine.

Shorthand for assigning work:

> **Use Loose Screws. Assemble the agreed MVP with dependency-ready connections,
> then fit, tighten, qualify, and lock the whole system to the agreed specification.
> Continue through ready phases without asking at each boundary.**
