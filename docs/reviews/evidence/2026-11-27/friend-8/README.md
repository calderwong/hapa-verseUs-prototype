# friend.8 — release evidence (27 November 2026)

friend.8 = friend.7's source plus Falka and Leo as local opponents ([avatar players](../avatar-players/README.md)). Built from clean `73a74eec05f0f39b46b6a4bba5e1358d33bcade3` (build-info `dirty: false` on both platforms); engine `ba838cca09ba43afceda0452b63d28df4cbf7f72`, profile `hapa_open_10x9_v3_07`, protocols unchanged.

| Artifact | Bytes | SHA-256 |
| --- | --- | --- |
| `Hapa-Versus-0.1.0-friend8-Windows-x64.zip` | 167,162,361 | `7f715e803c7e5df5da383df800e8e78c6554c7890174cec555af4955a86433b5` |
| `Hapa-Versus-0.1.0-friend8-macOS-AppleSilicon.dmg` | 124,503,469 | `e86ea662c7b5a70f1bb9a506231e440f66d8664015819641c15c7b0d35706824` |

- `npm run check` on `73a74ee`: 201/201, two-process peer-verified match, build.
- **Windows** (Windows Server 2025 x64, GitHub-hosted), gated run [46122728761](https://github.com/calderwong/hapa-verseUs-prototype/actions/runs/46122728761) (job 140910538614) on the released zip: 6 required reports, 0 failures — artifact hash, two launches isolated and under `%APPDATA%` (same identity), same-VM invitation game (Tick 4 concession, matching final hashes, reopen keeps identities and result), late worker ready on generation 2, never-ready bounded `failed` on generation 4 ([evidence](windows-run-46122728761/)).
- **Mac** (macOS 26 arm64), released DMG: 2 clean launches with the same identity ([json](mac-installed-smoke.json)); two-copy invitation game with matching final hashes and reopen ([json](mac-installed-invite-journey.json)); **Falka and Leo** with `owners.json` naming Mesh Avatar's node: both bound to their exact packages in the loopback frame (one performer), drawn, Tick 1 → 2 ([json](mac-installed-mesh-journey.json)). The first Falka/Leo run on the same bytes showed an empty chair and no Tick in 105 s — a throttled (covered) test window; the rerun passed in about 6 s each. No keychain prompt in any run.
- Not observed: consumer downloaded launch on the friend's Windows PC, and the two-home human game.
