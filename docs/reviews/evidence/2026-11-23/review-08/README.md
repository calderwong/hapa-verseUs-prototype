# Review 08 evidence — exact source and bounded checks

Reviewed GitHub snapshot: **`f7c4f0f69afbc22458c400f01521e5b468f5f602`**. Default profile **`hapa_open_10x9_v3_06`**. Review date **23 November 2026, America/Los_Angeles**. Some capture directories use the next UTC date; that is not a different local review date.

## Contents and limits

| File | Meaning |
| --- | --- |
| `source-manifest.json` | 98 materialized source/fixture/test/document blobs matched the reviewed Git tree |
| `submitted-image-manifest.json` | Four developer-submitted images matched their Git blobs; images remain in their original response 08/09 folders |
| `movement-probe.mjs`, `movement-results.json` | Actual rules: repeated survivor absorption, casualty refill, current opening Queen diagonal and stale bot restriction |
| `launch-profile-probe.mjs`, `launch-profile-results.json` | Exact menu link expression plus actual launch/resolve helpers demonstrates fallback to a saved legacy profile |
| `peer-revision-probe.mjs`, `peer-revision-results.json` | Exact Peer class and actual rules/agreement; transport publication and verified-body inbox substituted; demonstrates skipped plan revision |
| `fallback-facts-probe.mjs`, `fallback-facts-result.json` | Exact MemberLabels methods with minimal DOM stubs; demonstrates missing/stale fallback definitions |
| `live-observations.md` | Fresh local Chrome observations, with visible profile and unverified source-commit identity explicitly separated |

The diagnostics are portable from this folder in a repository checkout. For the historical reproduction, use an isolated checkout at the reviewed snapshot and copy this evidence folder there; do not reset an active working tree. For example:

```bash
node docs/reviews/evidence/2026-11-23/review-08/movement-probe.mjs
node docs/reviews/evidence/2026-11-23/review-08/launch-profile-probe.mjs
node docs/reviews/evidence/2026-11-23/review-08/peer-revision-probe.mjs
node docs/reviews/evidence/2026-11-23/review-08/fallback-facts-probe.mjs
```

They intentionally reproduce the historical defects. Passing these bug-presence assertions is not a desired release condition. After implementation changes, update the repository's meaningful regressions to assert the corrected contract; preserve these historical results. All four probes print JSON. The launch-link and peer probes also write their result JSON beside the script; the movement and fallback probes print only.

## Independent observed results

- `node --test tests/hapa/center-travel.test.js`: **8 passed, 0 failed** at the reviewed source. No full-suite rerun.
- Movement diagnostic: five living owned members but four in slots after successive partial-Pawn merges; casualty refill reports over capacity and leaves parties coincident; both replays verify. Ordinary opening Queen reaches R2C7 center, absorbs Pawn and retains five Supply after loading six. Bot refuses the demonstrated allowed friendly-intermediate L.
- Link diagnostic: copied default v3_06 link reopens saved v3_02 and `pair_acknowledgment_v3`.
- Peer diagnostic: consumes plan 1/Ready 2, leaves plan 2 queued and throws; direct agreement control accepts the ordered stream and locks A1/B2.
- Fallback diagnostic: supplied 3/3 unavailable fact has no registry entry and no tooltip; updated 1/3 fact leaves older 3/3 registry value.

An attempted `node --test --test-name-pattern='recovery:' tests/hapa/play-loop.test.js` could not import `hypercore-crypto` in the materialized review environment. No test assertion ran. No dependency installation or broad retry was needed for the confirmed findings.

## Submitted images

The exact original paths and hashes are in `submitted-image-manifest.json`. Relevant originals:

- [Shield definition](../response-08/stills/05-shield-definition.jpg)
- [History beside inspection](../response-08/stills/07-history-beside-inspection.jpg)
- [Burn availability](../response-08/stills/08-burn-available-now.jpg)
- [Latest Knight switcher and covered toast](../response-09/regress/2026-11-24T06-35-24-483Z-80bf3d3/z16-knight-switcher.jpg)

The response 08 captures predate the latest movement-profile changes and establish the presentation they show, not a full current-build visual pass. The latest Knight image belongs to the response 09 capture directory labeled `80bf3d3`. All four images are 1280×720. Their original implementation reports retain environment details and limitations.

No reviewer claim of live transport qualification, exhaustive browser coverage, complete game acceptance or current Overwatch state is made. No game implementation or engine files were edited in the review publication.
