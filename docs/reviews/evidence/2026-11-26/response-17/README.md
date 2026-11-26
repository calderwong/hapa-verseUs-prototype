# Response 17 evidence

These runs were made on one Mac (macOS 26.2, Apple Silicon) on one connection, using isolated `test-*` networks on the public HyperDHT, a local HyperDHT testnet for the native tests, and scratch test identities. None of it is different-network evidence. Local paths, keys and IP addresses are omitted.

| File | What it is |
| --- | --- |
| `artifacts.json` | Candidate `7cc30a1`, DMG/ZIP/ASAR hashes, and the status of each separate claim |
| `installed-content-manifest.json` | Installed app contents, including the notices payload and the signing state |
| `installed-smoke.json` | Two launches of the installed final candidate, owners absent |
| `installed-journey.json` | Installed lobby → challenge → reload → quit/relaunch → second launch → utility kill → finish → archive (`3392fe2`) |
| `installed-observer.json` | A fresh installed observer reading Player records and Profiles from the configured archive, with both authors offline (`7cc30a1`) |
| `installed-online-music.json` | Local music during online play: owner present versus absent |
| `npm-check-summary.txt` | `npm run check` on the candidate |
| `b1`–`b4` | Browser captures: combat paused with poses, Ember Strike pending rune, Card inspection trial, Home material trial |
| `i1`–`i6` | Installed-app captures: lobby, roster, recorded result, online music with the remote nameplate, Player records, Profile |
