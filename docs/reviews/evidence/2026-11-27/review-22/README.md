# Review 22 evidence packet

Pinned repository head: `164aa5dc6eb96ee4b4cc4eab6f0cdb2298554536`. Released friend.6 source: `fe6584ae29d51809c87b128767d11b49f1818da4`.

## What was actually checked

- `root-source-register.json`: 211 exact Git-blob-matched source/document/evidence files. Three unused desktop icons and the engine submodule are omitted; this is not a complete installed build.
- `runtime/`: five controlled diagnostic groups. Exact source bodies and real Ed25519 session/hello signatures; controlled persistence, transport, Hypercore readiness and game loops. Confirms four correction/preservation groups and reproduces V22-01. The coordinator reran the probe against the registered source.
- `roster/`: exact `_tableSetup` method and roster module with controlled DOM-shaped elements, local storage and owner-capability response. Confirms the default/unavailable controls and reproduces V22-02. No actual owner request or rendered/installed game is claimed.
- `relay/`: exact embedded Python report aggregator against the published successful stage-2 fields, then with the third peer removed. Reproduces V22-03. No network is created by this diagnostic.
- `delivery-observations.json` and `primary-source-register.json`: primary release/tag/run/job/artifact identities and decoded-log observations, plus submitted Mac reports. The reviewer did not independently download binary release/archive bytes or rerun native packages.
- `browser-observation.json`: fresh navigation was blocked by the browser connection's HTTP 401. The [submitted roster screenshot](../response-23/browser-players-roster.jpg) was byte-verified and visually inspected. It is not a new reviewer capture.

The primary Windows job is 140847288357 in run 46102314253; relay job 140845683278 in run 46101799012. Both ran at released source `fe6584a`. The historical relay diagnosis is run 46101336764. Follow the stored GitHub URLs for original logs and artifacts. All three expected stage-2 peer reports are present in the successful run; the report-gate defect does not negate its observed result.

## Reproduce the bounded diagnostics

Use a source checkout matching the reviewed code. From that repository root, with Node and Python available:

```bash
node docs/reviews/evidence/2026-11-27/review-22/runtime/review-probe.mjs .
node docs/reviews/evidence/2026-11-27/review-22/roster/roster-probe.mjs .
python3 docs/reviews/evidence/2026-11-27/review-22/relay/probe-relay-report-gate.py .
```

The runtime/roster probes verify their pinned source bytes. An exit 0 means the documented corrected states and remaining defects were reproduced; it does not certify the application. Preserve these historical evidence files. For a repaired implementation, add the focused native/UI/report regressions and new response evidence rather than rewriting the historical findings.

The coding agent's 195/195 `npm run check` result is submitted evidence, not a full-suite rerun by this reviewer. No new installed execution, independent-network human play, ordinary consumer launch, private owner verification, Overwatch write or CJ acceptance is asserted.
