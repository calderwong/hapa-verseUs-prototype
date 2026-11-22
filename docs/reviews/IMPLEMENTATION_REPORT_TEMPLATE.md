# Implementation response — YYYY-MM-DD

Copy this file to `YYYY-MM-DD-ui-design-response-01.md` and replace the placeholders. Keep this template reusable. Write only results actually observed; an unchecked field is not a passing result.

## Scope and source

- CJ's requested goal and scope: …
- Review addressed: [22 November 2026 UI/design review](2026-11-22-ui-design-review.md). Update this link when responding to a newer review.
- Findings addressed, using dated IDs: …
- Prototype branch and reviewed/implemented commit SHA: …
- Working tree at capture time, including relevant uncommitted changes: …
- Engine submodule SHA; engine changes, if any: …
- Overwatch card IDs/links and evidence append receipt, or explicit access limitation: …
- Relevant prior response or newer work that changed the starting assumptions: …

## Outcome

Explain the player-visible result first. Identify what changed, why it addresses the finding, and the evidence supporting the claim. Name remaining limitations. Distinguish **implemented**, **verified in the stated cases**, and **accepted by CJ**. Do not mark acceptance on CJ's behalf.

## Finding disposition

Use one row for each addressed finding. This is an evidence index, not a duplicate task board. For untouched findings, state that they remain outside this slice rather than marking them complete.

| Dated finding ID | What current inspection established | Change or reason no change was needed | Evidence and verification limits | Follow-up |
| --- | --- | --- | --- | --- |
| 2026-11-22 / UX-… | Reproduced / already fixed / not reproduced under stated conditions / proposal evaluated | Relevant files, commits, or rationale | Report section, capture, command result, or unresolved gap | Next check or CJ decision, if needed |

## Independent expectation and observed result

For each changed journey, record:

1. **Expected result before implementation:** what the governing rule or design intent requires; include its source.
2. **Starting state:** profile, seed, fixture or replay, Tick/phase, participants, and relevant Cards/parties.
3. **Actions:** a reproducible sequence, including keyboard versus pointer paths where relevant.
4. **Observed result:** what actually occurred, including unexpected behavior.
5. **Comparison:** pass, partial, or failed for this stated case, and the first divergence when applicable.

Do not redefine the expectation to match the output. Record a corrected interpretation or an explicitly versioned design decision if the expected behavior changes.

## Visual evidence

- Browser and version / OS: …
- Viewport in CSS pixels / device pixel ratio / browser zoom / text scale: …
- Camera mode, yaw, pitch, distance/focus when available / selected height layer: …
- Scenario or replay identity: …
- Rendition index identity and hash, relevant image hashes, or “not recorded”: …
- Before capture and source revision: …
- After capture and source revision: …
- Additional angle, smaller viewport, enlarged text, or reduced-motion capture relevant to this change: …

Add relative links and captions explaining the state shown. For example, `evidence/YYYY-MM-DD/ux-XX-after.png`. Distinguish live application captures from diagrams, mockups, or annotated derivatives. Document missing local assets or fallback renditions that affect the comparison.

## Verification record

| Command or manual check | Revision / environment | Actual result | What it establishes and what remains untested |
| --- | --- | --- | --- |
| … | … | Exit code, observed outcome, and evidence location | … |

Include required repository checks and the changed browser journey. For Ready/response work, cover alternate input paths and stale-plan behavior. For height work, cover target identity and visibility through orbit/cutaway. For layout/Card work, cover both seats, the relevant viewport sizes, and the meaning of planned versus completed actions. Select checks based on the actual change.

## Decisions and next handoff

- Design choices made within the existing requirements, with rationale: …
- Any proposed requirement change requiring CJ's decision, with enough context to understand it here: …
- Findings remaining for later slices: …
- What the reviewer should inspect next, with exact branch/commit and evidence links: …
- CJ acceptance: **not yet recorded** / link to CJ's actual decision.

Link this response from `docs/reviews/README.md` and append the relevant evidence to Overwatch through its existing workflow. Preserve previous reports and publish corrections as explicit addenda or a new response.
