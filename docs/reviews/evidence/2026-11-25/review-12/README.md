# Review 12 evidence — 25 November 2026

This evidence supports [Review 12](../../../2026-11-25-ui-design-review-12.md), not a claim that the new music/environment assignment has been implemented.

## Exact source and submitted evidence

- Reviewed Versus main: `8308ea15df3ef844ade37b24a0097f915ac7ba6c`; tree `8d6c1fb15261a8281225211fc23debda7d841165`.
- Implementation: `4dc271d506e97c83836dbc108ad3804f30cdcc81`. Engine gitlink remains `ba838cca09ba43afceda0452b63d28df4cbf7f72`.
- [Source register](source-register.json) records exact Git-blob verification and SHA-256s of saved current files. Inclusion records provenance, not a separate audit of every dependency line. Read representations that differ from upstream bytes are labeled separately.
- [Ecosystem register](ecosystem-source-register.json) records pinned Song Registry, Builder and Campfire source, plus the distinct Library evidence scope. Papa's Island is a written brief; the Echo master read is only its header/manifest; the located Living Light 108 archive was not downloaded.
- [Submitted identity check](response-12-identity-check.json) verifies response 12's seven complete source checksums against accessible source. This does not identify bytes already loaded in a running process.
- Response 12's existing [resume stale](../response-12/music-resume-stale-after.json) and [resume current](../response-12/music-resume-current-after.json) witnesses match the current Soundtrack blob. They were inspected, not rerun unchanged.
- The broad `npm run check` success (152 rules tests plus bot/peer/build checks) is [submitted response-12 evidence](../response-12/npm-check-summary.txt), not an independent broad run in this review.

## New independent focused checks

### Model wrapper

Ran `node --test tests/hapa/model-decider.test.js` once against byte-verified current source: **12/12 passed**. [Output](model-decider-test-results.txt). This covers malformed plan/response success wrappers and a late invalid reply, as well as existing admission boundaries. It does not require live model spending.

### Keep and playback

[Executable diagnostic](keep-playback-invariance-probe.mjs) and [original result](keep-playback-invariance-result.json).

```bash
node --experimental-vm-modules docs/reviews/evidence/2026-11-25/review-12/keep-playback-invariance-probe.mjs /path/to/hapa-verseUs-prototype
```

The diagnostic loads the actual Soundtrack and DOM builder and clicks the rendered Keep handler. DOM/audio/owner replies/timers are fixtures; network requests are zero. It advances one acquisition poll through saving → saved-downloading → available-offline. It records unchanged selected entry, queue index/revision, active generation/source, position, pause/listening and volume, with no audio mutator calls. A separate manually injected `ended` event advances to B with reason `ended`.

The result's `reviewBaselineCommit` is the historical reference; source-under-test blob hashes identify bytes on a rerun. Audio time is deliberately held constant. This proves handler invariance under these conditions, not real-time continuity, browser hit-target stability, actual owner retention or the Table voice acknowledgment. CJ's live skip cause remains unconfirmed.

The separate source trace is `Table kept → opponent.say(keptLine(...)) → speaking → music.setDucked(...)`. That can lower volume during an automatic acknowledgment; it does not itself establish a track switch.

## Fresh live observation

Temporary browser match at `http://127.0.0.1:5199/versus.html`, viewport 2838×1076 CSS px, A human/B heuristic, Red on, seed 1, profile v3_07. Device-pixel ratio and running source commit were not independently recorded. The live site and GitHub source identity remain separate.

1. Started the selected match, opened Red and typed the unsent draft `Review draft: keep the board steady`.
2. Selected text and wheeled over the conversation. [Structured observation](live-gesture-observation.json) records selection `[1,31]` and the same Red rectangle before, after selection and after wheel input: x=1540.515625, y=123.578125, width=58.140625, height=24. The short history did not require scrolling; this is camera-gesture isolation evidence, not a long-history scrolling test.
3. Cleared the draft and opened Kept. [DOM snapshot](live-kept-snapshot.txt) contains six saved rows and no Play action. Generic titles with different durations and introduction information are visible. No Keep or playback action was taken.
4. Opened Orders and Red, panned once and inspected fit. [Panel observation](live-drawer-observation.json) ends at x=1971.921875–2271.921875, in bounds in that pose. This is **not** a reproduction of the source-confirmed R12-01 branch condition.
5. Closed the temporary tab. No question sent, music enabled, save made, Tick advanced or existing user game modified in this review journey.

Fresh screenshot binaries are excluded from this text publication. Visual conclusions refer to that observation. The newly shared art-direction concept is illustrative and is not runtime evidence or a change to board dimensions, avatar identity, actual song metadata or game rules.

## Scope and stopping

This publication contains review/design/assignment documents and diagnostic text only. No production, engine, owner service or task-board mutation is claimed. The canonical Overwatch state and CJ's Done acceptance remain separate. The next agent should reuse unchanged closure evidence and qualify the connected music-and-setting candidate described in Assignment 13.
