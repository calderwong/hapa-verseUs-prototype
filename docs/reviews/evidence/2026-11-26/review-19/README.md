# Review 19 evidence — pinned methods and a separate live browser observation

Reviewed repository: `calderwong/hapa-verseUs-prototype`  
Reviewed head: `b42f555e35f7686dd3391e4f00f64a03875b5fb5`

See [Connectivity review 19](../../../2026-11-26-connectivity-review-19.md) and [Assignment 20](../../../2026-11-26-next-agent-assignment-20.md).

## Files

| File | What it establishes |
| --- | --- |
| `browser-observations.json` | Live-demo action scope and screenshot hashes, with unverified build identity |
| `source-register.json` | GitHub blob identities for inspected pinned files |
| `review-probe.mjs` | Reproducible bounded exact-source-method diagnostics |
| `review-probe-results.json` | Six current undesired outcomes, expected corrected behavior, source locations and source-text hashes |
| `release-register.json` | Independently retrieved release target, asset size and digest metadata; no binary execution |
| `versus-local-red.jpg` | Fresh local browser view with owner-rendered Red present; running build identity not exposed |

## Diagnostic method

Use the script from this review-bearing checkout and pass a separate clean checkout/detached worktree at the reviewed commit (do not reset ongoing work):

```sh
node docs/reviews/evidence/2026-11-26/review-19/review-probe.mjs /absolute/path/to/hapa-verseUs-prototype
```

When using the reviewer's retrieved-source layout, `node review-probe.mjs` reads the neighboring `source/` directory. It writes `review-probe-results.json` next to the script. The recorded output uses bytes verified against the pinned GitHub blob IDs. The script refuses a blob mismatch. SHA-256 source digests and Git SHA-1 blob IDs are different identifiers; Git includes an object header in its hash.

The script removes module import/export declarations, evaluates the remaining pinned bodies and supplies explicit dependencies. Canonicalization, fingerprints, contact signing/verification, admission, policy projection/import and relay selection use the inspected source. Ed25519 uses Node crypto with compatible raw-key representation; a tampered snapshot is refused before the defect cases run. Signature validation is not bypassed.

JSON persistence and Hypercore append/read behavior are **in-memory controlled fixtures**. The import fixture interrupts between two appends and reopens the shared durable-record abstraction. It demonstrates the import bookkeeping defect; it does not establish native Hypercore crash guarantees. Relay selection uses its actual method with controlled prior observations, without opening a socket. Cancellation uses the exact affected runtime methods with controlled storage/lobby dependencies.

All six current behaviors reproduced:

1. Newer accepted snapshot retained an older revision's `core-verified` status.
2. Valid same-sequence snapshot/core route disagreement was silently accepted.
3. Retired default bootstrap entries returned in effective options.
4. Partial policy import was skipped permanently after reopening.
5. A recently successful relay monopolized eight later candidate selections.
6. Accepted-attempt cancellation wrote its tombstone but reported terminal failure.

The script deliberately asserts these present undesired outcomes. Exit 0 means the review reproductions completed; **it is not an application acceptance pass**. Corrected code should have meaningful implementation tests asserting the intended behavior instead.

## Evidence boundaries

No native Hypercore/Hyperswarm suite, Electron process, Windows executable, public DHT connection or actual blind relay was run by this diagnostic. No normal home-network friend session occurred in this reviewer pass.

Response 19's installed Mac evidence is separately credited. Its Windows package is reported built and inspected, explicitly not executed. Its FT-08 forced second-relay witness is explicitly pending. Do not promote either to a pass using the controlled diagnostic.

The browser image is a distinct live observation. It shows the photographic/pose-art Red attached in a local game. Source comments identify that integration as a frontal 2D owner renderer sampled on a scene plane. The image is not a volumetric mesh demonstration, proof of an installed owner path, or an attribution of the live build to the reviewed commit.

