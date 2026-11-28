# Human feedback addendum 13 — AI competition and inspectable match artifacts

**Date:** 28 November 2026, America/Los_Angeles.  
**Status:** Research/design handoff. CJ's requested outcomes are recorded below; implementation details and sequencing are reviewer recommendations. No competition, model calls, automatic learning or new service is activated by this publication.  
**Design:** [AI competition and learning v1](../integrations/ai-competition-and-learning-v1.md).  
**Reviewed Versus source:** `e86dcbbbb1df57da5d7956f147e57a763072d5d5`.

## CJ's request

Research and design AI agents playing **both sides** of Hapa Versus repeatedly and competitively, producing:

1. The thinking behind each move and why.
2. The game replay.
3. Statistics.
4. A separate post-mortem from each AI player: strategy, outcome, what worked, what would change, strategic axioms and related lessons.

The desired result is an inspectable body of games and strategic knowledge. A human should be able to open a match, watch what actually happened, inspect what each agent said it intended, compare intentions with outcomes, and follow evidence behind its lessons.

This continues the existing Hapa foundations: append-only primary provenance, distinct Avatar/model identities, Hapa Harness as inference owner, reusable adapters, and explicit artifact/delivery status. It preserves Assignment 25 / friend.9 human testing and Addendum 12's music work. A league is a separate experiment mode; it does not modify the rules or inflate human PvP statistics.

## Required outcomes

### HF13-01 — Repeated, bounded AI-versus-AI games

Both seats must be driven by explicitly identified agents through the normal game validators. Support a finite, repeatable schedule with pause/stop/resume, declared resource limits, unique run/match identities and retained partial evidence. A selected Avatar must not start a competition merely by being enabled in the roster.

Record the exact rules/profile/content, agent configuration, controller/action-space revision, model binding, strategy-memory version if any, and seed/seat schedule. Begin with the current game profile and existing local inference ownership. Existing heuristics remain a useful baseline and explicitly attributed fallback.

The present model adapter selects from heuristic shortlists. The first iteration may use that scope if plainly labeled **model-assisted shortlist play**. Record which actions the model actually chose, which were heuristic, and which were automatic rules. Broader strategy control is a separate adapter revision; do not describe the initial league as unrestricted mastery of the game.

### HF13-02 — A durable explanation for each actual decision

Generate concise decision explanations with the proposed action, before its result is known. Bind them to the actual observation, decision ID, seat, agent revision and admitted action. Include a goal, relevant observed facts, expected benefit, principal risk and a meaningful alternative where useful. A Tick can contain several commands; preserve the mapping from each model choice to the commands it actually controlled.

These are the player's **declared decision explanations**, not a guaranteed transcript of internal reasoning. Preserve rejected proposals and missing explanations honestly. If a heuristic fallback executes, its producer and explanation remain distinct from the model's rejected or late proposal. Later interpretation must be labeled retrospective.

### HF13-03 — Replay the recorded game

Retain the authoritative replay and verify it by recomputing accepted plans and response answers through the existing rules. A replay must work without calling a model again. Validate the reported terminal outcome and final fingerprint against recomputation, with an explicit nonterminal status for interrupted/budget-limited runs.

Add a read-only replay experience that uses the actual recorded decisions: play/pause/step, Tick and decision navigation, both players' explanations, and links from reports back to the corresponding moment. Existing presentation helpers can be reused. A video is an optional presentation export, not the primary replay artifact or a prerequisite for every bulk game.

### HF13-04 — Derive statistics from evidence

Compute game facts from verified events. Include results, completion/termination reason, game length, seat/opponent breakdowns, relevant economy/combat/territory measurements, and model-operation data such as admitted decisions, fallback rate, invalid replies, latency, calls and reported tokens. Unknown metrics remain unknown.

Keep wins/draws separate from budget exhaustion, cancellation, provider faults and incomplete artifacts. Show all scheduled attempts and denominators. Preserve each matchup and exact contestant revision beneath any rating or aggregate. Publish experiment results separately from human/ordinary online rankings.

### HF13-05 — Two independent post-mortems

Each player must produce its own review from the verified result, its frozen pre-decision explanations, and a bounded evidence pack with precise event/decision references. Each initial review is written without seeing the other's review.

Cover initial strategy, decisive moments, intentions versus outcomes, what worked, mistakes, what to change, and candidate strategic axioms. Factual claims must link to game evidence. Alternate lines remain hypotheses unless separately tested. A failed review does not erase a valid game; record the missing artifact and retry that review independently within policy.

### HF13-06 — Preserve lessons without silently changing the contestant

Store proposed axioms with scope, conditions, supporting games, counterexamples, confidence/status and provenance. Preserve corrections as new records. Feeding a lesson into later play creates a new explicit agent/strategy revision. Frozen evaluation batches keep prompts/memory/configuration constant; development batches may produce candidates for a later comparison.

Repeated inference alone does not update model weights. A weight-training pipeline is outside this first slice. Second Brain/Wiki/Quest Keeper/Telemetry attachments follow actual owner contracts and distinguish prepared exports from acknowledged ingestion; this documentation does not claim registration or ingestion has occurred.

## Recommended first complete slice

Reuse the headless rules and async response generator, add two isolated agent instances, a durable competition journal, all four artifacts, and a real recorded-game viewer. Use one already-qualified local model initially, one outstanding inference call, a heuristic baseline, and an explicit same-scenario seat-swapped pair. Reserve budget for both post-mortems when starting a match.

The same whole should be controllable through a small UI/CLI/API surface and usable in the desktop shell; disclose any unimplemented surface rather than claiming parity. Qualify the exact delivery surface used. Use focused contract checks during assembly and one integrated qualification at the complete candidate, following Loose Screws.

The [companion](../integrations/ai-competition-and-learning-v1.md) defines source evidence, artifact contracts, inference-owner requirements, recovery, fair comparison, research references and staged implementation. Start this queued scope through the ordinary local-agent workflow; keep current friend/music work and existing owner boundaries intact.
