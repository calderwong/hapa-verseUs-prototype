# Review 05 evidence — 23 November 2026

Source main `b747d118bbb857d0ea08f98696d0714428d2f106`, implementation `fc6df0de7d66452caec8b35bfaa277220715a07e`, engine gitlink `ba838cca09ba43afceda0452b63d28df4cbf7f72`.

## Independent checks

- [Machine-readable verification](review-verification.json) separates independent review from the implementing agent's claims.
- [97-test headless result](headless-97.tap): 97 passed, 0 failed, Node v24.22.3. [Exact command](test-command.json). Four tests in `protocol.test.js` were not executed because `hypercore-crypto` is unavailable in the review extraction. The initial extraction also lacked Git metadata; restoring the pinned `.gitignore` and initializing an isolated local Git work tree repaired the environment-only boundary check before this final run. No production code was changed to obtain a passing result.
- [Member protection observation](member-protection-observation.json), [reproduction script](member-protection-observation.mjs): the live rules give center `A.C3.m5` front Physical protection 2 with Bound Standard; its base archetype contributes 1. This demonstrates why the new labels cannot present copied archetype text as effective stats. Run the script from the repository root; it is an observation, not a new gameplay rule.

## Visual evidence

Reviewed CJ's supplied close-up and two original response-05 captures: [overview](../../2026-11-22/response-05/after/after-1-quiet-1600x1000.jpg) and [party hover at 1280×720](../../2026-11-22/response-05/after/after-3-party-hover-1280x720.jpg). The user's screenshot shows a large party detail view over enlarged members, but its exact running commit is unknown. The existing captures retain their original attribution and source revision; they are not fresh reviewer browser captures.

[Zoom inspection concept](zoom-inspection-concept.svg) is a native SVG design schematic. It illustrates independent Castle-command and Pawn-inspection examples and a territory-depth treatment. It is not runtime evidence, generated game art or a balance decision. HP/attack examples use the engineering catalog. Actual implementation must derive values from current state and effects.

No live-browser interaction, full build/check, screen reader, touch or GPU performance verification was performed by this review. The implementing agent's 101 tests and 219 browser assertions remain its reported evidence. No Overwatch change or CJ acceptance is claimed.
