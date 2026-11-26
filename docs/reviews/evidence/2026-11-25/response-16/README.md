# Response 16 evidence

All runs were made on one Mac (macOS 26.2, Apple Silicon) on one internet connection, using isolated `test-*` networks on the public HyperDHT and scratch test identities. None of it is different-network evidence. Local paths, raw IP addresses, keys and tokens are omitted.

| File | What it is |
| --- | --- |
| `artifacts.json` | Candidate source, artifact SHA-256 and sizes, and the status of each separate claim |
| `installed-content-manifest.json` | What the installed app contains (grouped ASAR paths, native addon hashes, fonts, network config, signing, the excluded-content check) |
| `installed-smoke.json` | Two launches of the copy installed from the DMG: a local match, the native store reopening, the bridge refusing unknown operations, owners absent |
| `installed-journey.json` | The packaged online journey: lobby, challenge, reload, quit/relaunch, second launch, peer-process kill, concession, archive observer |
| `installed-human-vs-human.json` | Two installed apps playing each other through the real UI |
| `installed-response-choices.json` | Desktop seats answering owned response windows |
| `headless-network-runs.json` | Public-DHT match, hard-kill recovery, archive/observer, invitation, local blind relay |
| `npm-check-summary.txt` | `npm run check` on the candidate |
| `01`–`08` `.jpg` | Captures from the installed app (lobby, roster, challenge received, Ready committing, reattached after reload, result saved, local match with owners absent, Victory/Defeat sheets) |
