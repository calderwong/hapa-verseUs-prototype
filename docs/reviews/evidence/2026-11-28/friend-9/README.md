# friend.9 — release evidence (28 November 2026)

friend.9 = friend.8 plus **Thor** as a local opponent beside Falka and Leo ([avatar players](../../2026-11-27/avatar-players/README.md)). Built from clean `977f14944cdb978a0ab456fc9878ddae4e72f78e` (build-info `dirty: false` on both platforms); engine `ba838cca09ba43afceda0452b63d28df4cbf7f72`, profile `hapa_open_10x9_v3_07`, protocols unchanged.

| Artifact | Bytes | SHA-256 |
| --- | --- | --- |
| `Hapa-Versus-0.1.0-friend9-Windows-x64.zip` | 167,162,718 | `83b3edb93f1b0ac154b66da08f6b6b1d38edb24a4a920f3876eb86eb7f1f2191` |
| `Hapa-Versus-0.1.0-friend9-macOS-AppleSilicon.dmg` | 124,503,664 | `91c0ae80adb69e12b51ab771472e55f1fdb0e67e88688d8cea9c07b423230879` |

- `npm run check` on `977f149`: 201/201, two-process peer-verified match, build.
- **Windows** (Windows Server 2025 x64, GitHub-hosted), gated run [46124422768](https://github.com/calderwong/hapa-verseUs-prototype/actions/runs/46124422768) (job 140915741824) on the released zip: 6 required reports, 0 failures — artifact hash, two launches isolated and under `%APPDATA%` (same identity), same-VM invitation game (Tick 4, matching hashes, reopen), late worker ready on generation 2, never-ready bounded `failed` on generation 4 ([evidence](windows-run-46124422768/)).
- **Mac** (macOS 26 arm64), released DMG: 2 clean launches with the same identity ([json](mac-installed-smoke.json)); two-copy invitation game with matching final hashes and reopen ([json](mac-installed-invite-journey.json)); **Falka, Leo and Thor** with `owners.json` naming Mesh Avatar's node: each bound to its exact package in the loopback frame (one performer), drawn, Tick 1 → 2, about 5 s each ([json](mac-installed-mesh-journey.json)). No keychain prompt.
- Not observed: consumer downloaded launch on the friend's Windows PC, and the two-home human game.
