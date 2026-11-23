# Next implementation assignment 03 — readable opening and planning

**For CJ's local coding agent.** This is the recommended next scope after implementation responses 01 and 02. It carries the new review into a bounded implementation job. Follow CJ's current instructions and existing authorization; the review is not a separate task board.

## Goal

Make a new player able to select a party, understand a Card, assign Supply, choose a legal destination, review their orders, press Ready, understand an opponent revision, and inspect the resolved result. Make the same journey usable at compact window sizes and with a keyboard. Close the specific playback and misleading-feedback defects first.

The latest reviewed source is **`a68cfd0b8af874498cdb3e617715f941e52b76f2`**, engine **`ba838cca09ba43afceda0452b63d28df4cbf7f72`**. There may be newer local or remote work by the time you start; compare before implementing anything again.

## Read and preserve

1. `AGENTS.md`, its available local Hapa grounding, and `docs/reviews/README.md`.
2. `docs/requirements/master-requirements-v3.txt` for gameplay and profile/contract authority; `design-companion-v1.txt` for controls, public information, responsive layout and presentation.
3. `docs/reviews/2026-11-22-ui-design-review-02.md` for evidence and contextual acceptance. Read responses 01/02 to preserve the fixes and understand remaining limitations.

Inspect `git status --short`, the current branch, existing handoffs and Overwatch `hapa-versus`. Fetch notes safely. If the checkout is clean on main and can fast-forward, use the existing fast-forward workflow. Otherwise integrate through the established working branch/worktree path; do not reset or overwrite local work.

Retain the first-Ready plan freeze, stale acknowledgment behavior, single-resolution guard, correct physical-column mapping, height-aware selection, queued-versus-landed effects and camera fitting. Keep Hapa rules headless and deterministic. Do not edit the vendored engine in place. Do not change game economics, public visibility, timing, formation rules or production fixtures merely to improve screenshots. The updated interface must continue to expose exact details and provenance.

## Work in this order

### 1. Reproduce and repair the remaining interaction defects

- In the `stacked` diagnostic fixture, isolate band −2 and resolve a pass Tick. `app.js` currently lets `_stepPlayback` override the band filter that `BoardView.sync` just applied. Keep off-layer member bodies filtered throughout playback, including at casualty boundaries. Repeat with +3 and All. Preserve explicitly identified off-layer markers and roster access; this is a public-information game.
- While examining playback, capture one hill/ramp ascent or descent. Trace positions currently omit band, so verify intermediate elevation against the authoritative event timing. Fix a demonstrated presentation mismatch without changing the movement rules.
- Correct the Match menu's concession callback: it currently reports success even if `_addCommand` refused it, and lacks the specified confirmation. Cancel must have no effect. A refused action must explain its actual state. Do not unfreeze a plan. If phase-independent concession requires protocol work, document that small follow-up with event ordering/replay implications; do not silently claim the requirement is complete.
- Correct quick-start help that still locates Ready at the end of the hand, and qualify Supply availability by the editable-plan phase.

### 2. Give the current decision enough screen space

Keep the fitted Home/Tactical camera as the working default while changing the HUD. At 1280×720 the committed report gives the canvas only 694×358 pixels; full sidebars and fixed rows consume the rest. The plan lists also compete with their heading and Ready inside a 150-pixel row.

Implement a deliberate compact layout: an accessible roster drawer, a contextual inspector/review surface, complete own/opponent plan inspection, and one primary Ready/Acknowledge action. Stale acknowledgment must elevate the added/removed opponent orders and state that the player's own orders stay frozen. A pending response must show the effect, legal responses, exact costs and Pass.

Preserve resource access below the 1180-pixel breakpoint. Current CSS collapses the first track to zero while leaving `#resources` there. Keep both public Mana pools, projected planned Mana, a labeled Burn path and all nine Card positions reachable. If banks scroll or reflow, maintain their same-physical-column relationship. Do not make the text smaller to retain every permanent panel.

### 3. Complete the keyboard and no-drag journey

Use named party/member controls, a labeled Move action and an accessible target/coordinate selection route. Keep camera navigation separate from a keyboard-focused board, with an explicit focus/compass cue. Preserve pointer drag/right-click shortcuts.

Restore logical focus after re-rendering and after closing a drawer, picker or response sheet. Specifically test Card activation: `_renderHand` currently rebuilds the tile on selection. Check roster entries, member slots, event inspection, Ready and required response controls. Escape must return to a sensible prior control without issuing an order.

Lead the selected-party surface with identity, member count, current versus planned Supply and available actions. Put raw revision IDs, full coordinates and diagnostic values in Details. Retain exact information. Explain an inactive column, a frozen plan, an unmounted Pawn and an unaffordable action distinctly.

### 4. Stress the improved Card presentation

Retain the identity → face → resources → ability anatomy. Give compact Cards a deliberate summary and complete selection/inspection path; show exact planned use and quantity without relying on hover. Test long titles, both owners, no Mana, several Mana colors, reserved Cards and bank replacement. Add only a valid labeled diagnostic fixture for the multi-color overflow case. Keep artwork attribution separate from definition/creator lineage.

### 5. Protect the confirmed behavior and publish a reviewable response

The existing browser script is an evidence recorder. Preserve that mode, but add a few independent assertions or a separate regression command for:

- the player's own revision/commands staying frozen after Ready;
- exactly one resolution despite repeated Ready inputs during a response;
- correct height selection and member visibility throughout playback;
- reachable essential controls and maintained logical focus in the new journey;
- current/planned resource values and the resolved result agreeing with the rules.

Use unique evidence run directories or IDs. Fail on missing required controls and unexpected application errors; identify any allowed nonessential resource error explicitly. Demonstrate that an intentionally wrong expected value fails the assertion mechanism, then restore the correct expectation. Do not mutate production behavior just to make a test pass.

Run `npm run check` and the relevant browser journeys locally. Inspect the actual application visibly, beyond the headless recording. Record source revision, working-tree condition, engine pin, browser/OS, viewport, DPR, browser zoom, text scale, seat, camera, layer, scenario/replay and local rendition identity/hashes. Keep unchanged tests unchanged unless a requirement-backed correction is necessary.

## Acceptance journeys

Use the following focused cases rather than an exhaustive cross-product of every setting:

| Journey | Starting state and configuration | Required observation |
| --- | --- | --- |
| Opening with pointer | Human A versus Bot B, seed 1; 1600×1000, then 1280×720 | Select party/Card; plan Supply and destination; read/remove/re-add order; Ready; inspect landed Supply and movement. The route works through labeled controls as well as the optional drag/right-click path. |
| Opening with keyboard | Same opening, compact layout | Complete the same decision without pointer input; focus remains visible and logical through updates and drawers. |
| Public plan changed | Human/Human, seed 1 | A freezes its plan; B revises and Readies; A can read every added/removed order and acknowledge while its own plan remains unchanged. |
| Required response | Existing `response` fixture | Response/Pass is reachable; repeated Ready shortcuts do not create another resolution; compare replay/state against a run without shortcut spam. |
| Heights in motion | Existing `stacked` fixture; −2, +3, All | Off-layer member bodies remain filtered during playback and after; casualty visibility is correct; a ramp case has truthful height timing. |
| Compact public information | 1100×900 and immediately above/below 1180 px; both view seats | Roster access, Mana/Burn, all bank positions, full plans and response choices remain reachable. Record actual element bounds and required scroll paths. |
| Card edge cases | Valid diagnostic scene with long title, no Mana, multi-color Mana and planned use | Full identity, exact quantity and use available without color-only or hover-only dependence. |
| Text and sensory variants | A representative compact opening/response at 150% text size, then a 200% reflow spot check; muted/reduced motion and a color-independent scene | No lost required control or focus trap. Important state stays understandable. Report text scaling separately from browser zoom. These are bounded usability checks, not an accessibility certification. |
| Concession feedback | Editable, frozen and response phases | Cancellation changes nothing; success appears only for an accepted action; unsupported phase behavior is explicit; frozen ordinary orders are never reopened. |

The text-size settings above are test targets for this iteration, not changes to gameplay. If a supported platform offers different scaling controls, record the actual setting and equivalent reflow observation.

## Return these deliverables

- Coherent implementation commits with the expected behavior and actual results.
- `docs/reviews/2026-11-22-ui-design-response-03.md` or the corresponding current-date response filename, using `IMPLEMENTATION_REPORT_TEMPLATE.md`.
- Preserved before/after screenshots and machine-readable evidence in a new unique run directory; one short visible walkthrough if the existing local tooling supports it.
- Updated review index and append-only evidence on the relevant Overwatch cards; CJ acceptance remains separate.
- A clear list of implemented, verified, unsupported and deferred behavior, including any concession-protocol follow-up.

For UX-10 evidence, correct the subject metadata in the new response: the earlier “Castle” capture selected `A.mount.C3`, the Bishop. Preserve the old published files and explain the correction.

## Following visual slice

After the opening/planning slice is reviewable, the next named task is one finished cubic-terrain-and-party scene: ground, raised surface, trench, roofed passage, a dig/enhancement event already supported by rules, and one asymmetric shield/ranged party through a complete orbit. Demonstrate strata, floors, cut edges, bounded alignment glow and clear selection at overview/tactical/inspection distances before producing a large asset roster.

Do not wait for a new yes/no camera-percentage decision to start the current slice. Retain the fitted camera provisionally, improve the available viewport, and give CJ same-state comparisons to judge afterward.
