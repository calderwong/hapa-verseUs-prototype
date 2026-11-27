# Hapa Versus — Electron desktop delivery v1

**26 November 2026 amendment:** [Addendum 09](../requirements/2026-11-26-human-feedback-addendum-09.md), [Friend test and resilient connectivity v1](friend-test-and-resilient-connectivity-v1.md) and [Assignment 19](../reviews/2026-11-26-next-agent-assignment-19.md) select the simple two-network native friend test and signed, replaceable service/contact history. Reconcile active Assignment 18 first. No VPS maintained by CJ or always-online archive is a prerequisite for this live two-person test. Preserve the earlier broader scope and archived semantics; newer direction governs conflicting infrastructure/delivery sequencing. This amendment is tasking only.

**Date:** 25 November 2026, America/Los_Angeles.  
**Selected by:** [Human-feedback addendum 08](../requirements/2026-11-25-human-feedback-addendum-08.md).  
**Implementation scope:** An extension of [Assignment 16](../reviews/2026-11-25-next-agent-assignment-16.md), using the existing [P2P specification](p2p-matchmaking-v1.md).  
**Reviewed baseline:** Game `698070be75c6b5c5b5ba8fe6e8e20851251f7baa`; engine `ba838cca09ba43afceda0452b63d28df4cbf7f72`.  
**Status:** Researched specification and source integration plan. No Electron build, native-addon compatibility, signing/notarization or installed-app test is claimed by this publication. See the [source register](electron-desktop-v1-sources.json).

## 1. The desktop promise

A player downloads Hapa Versus, installs/opens it, and gets the game and its peer service together. The app contains the runtime and assets needed to render the board, play a local human/bot match, find remote players, accept a challenge, play over Hypercores and retain verified results. An unavailable optional Hapa owner does not prevent those journeys.

The source-clone workflow remains available to contributors. The headless public lobby/result seeder remains independently runnable by an operator. Electron is the selected player shell, not a replacement rules engine or a new web UI framework.

**Default target:** macOS Apple Silicon, a normal `.app` distributed in a DMG and/or ZIP. Prepare the same project for additional makers, but do not turn every OS/architecture into a mandatory parallel implementation campaign. Retain the current Linux/source/headless checks. Windows x64 can be the next desktop target when its native package is actually built and tested.

## 2. What is baked in

| Included in the player distribution | Boundary |
| --- | --- |
| Electron runtime | No separately installed Node or browser required for the player |
| Built game UI and renderer | Existing plain-JS/Vite/Three game, not a URL pointing at an assumed running development server |
| Necessary Lumina engine runtime | Compiled/pinned runtime and required approved assets, with notices; no end-user submodule checkout |
| Rules, catalog and decks | Current bundled interoperable preset and validator; presentation assets remain outside gameplay hashes |
| Native peer dependencies | Working per-platform Hypercore/storage/crypto/network native code and required companion resources |
| Peer/lobby/session services | Persistent identity, availability, challenges, deterministic online session, reconnect/restart and result publication |
| Local history and verification | Rebuildable profile/statistics projection and replay evidence, stored in the app's user-data area |
| Starter visuals | Fonts, app icon, board/scenery/unit assets, fallback Card faces and explicitly selected starter Avatar content |
| Music and Avatar presentation | Existing controls/scene integration plus packaged host adapters; selected bundled media can play locally |
| Network configuration | Public network ID, protocol compatibility and actual configured directory/relay public keys, with truthful service status |

Do not include private signing keys, `.env`, owner tokens, developer stores, test identities, personal media libraries, raw prompts/memory or arbitrary local files. Build from an allowlist, not a recursive copy of CJ's workspace. ASAR is packaging, not a confidentiality boundary; anything distributed should be considered readable by the recipient.

### Optional capabilities

Local/remote model inference, live voice generation, user-owned music libraries, full Avatar Builder, Overwind, Second Brain and Hapa Harness remain owned integrations. Package the small adapters and detect installed capabilities explicitly. Do not spawn or install unrelated owner applications without their existing authorization.

The selected base opponent can use the existing heuristic bot without a model. If a bundled Red visual is selected, it must render from its approved packaged renderer/assets even while Harbor is absent. Live voice/model options can show unavailable or connect through their owner when configured. Do not label a heuristic opponent as model-assisted.

For approved shipped tracks/prerecorded audio, a small read-only bundled-media provider may play manifest-listed bytes locally; it must not invent Song Registry retention or ownership receipts. Preserve quiet Keep when the real owner is connected. An already bundled track can say Included; an unavailable owner operation should explain what is missing without skipping/stopping playback. Do not create a competing private music-library database in this packaging task.

### Infrastructure remains operated

Clients can contain the relay/archive configuration and the repository can include operator commands. A directory/archive or relay still needs a reachable host. A closed player app does not keep an external service online. Preserve the P2P plan's distinction among bootstrap, directory/archive and transport relay, with degraded-state messaging and actual deployment evidence.

## 3. One game runtime, two delivery adapters

| Process / layer | Responsibility | Access |
| --- | --- | --- |
| Electron main | App identity, protocol registration, window/menu, single-instance lock, native dialogs, lifecycle and peer supervision | Narrow desktop/host authority |
| Node-capable utility process | The reusable peer runtime: keys, Hypercores, network, authoritative online session, recovery and evidence verification | Required local storage/network; no renderer DOM |
| Sandboxed renderer | Existing game controls, board, animation, camera, sound and views | Browser APIs plus a small named application bridge |
| Preload bridge | Validated requests/subscriptions between first-party UI and host | Only explicit app capabilities; no arbitrary IPC/filesystem/shell escape |

Electron's [utilityProcess](https://www.electronjs.org/docs/latest/api/utility-process) supplies a Node-capable child with message ports and must be started after app readiness. Use it to supervise the shared peer service. Do not assume `process.execPath` is a standalone system Node binary in a packaged app.

Keep the network/rules runtime independent of Electron imports. Give it two thin adapters: desktop IPC and the existing/planned authenticated loopback API for browser development/headless workflows. The browser path can continue on 127.0.0.1; the installed desktop path does not need to expose a local HTTP API merely to communicate with itself.

Main should supervise rather than execute heavy replay verification on the UI event loop. Bounded low-priority verification can remain in the utility host or a worker it owns. Network presence and recovery must not depend on a renderer animation frame or an unthrottled visible window.

### Renderer boundary

Set `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, and retain web security. Keep existing game ES modules. A sandboxed preload does not support ESM imports simply because package.json says `type: module`; use a small `preload.cjs` or bundled CommonJS preload. Main and peer code can remain ESM. See [ESM support](https://www.electronjs.org/docs/latest/tutorial/esm) and [Electron security](https://www.electronjs.org/docs/latest/tutorial/security).

Expose named operations such as `getStatus`, `setAvailability`, `challenge`, `join`, `submitOwnDraft`, `ready`, `answerChoice`, `subscribeMatch`, and selected import/export/dialog operations. Validate sender frame/origin, schema, match generation, seat and request ID in the host. Preserve the P2P runtime's idempotency and authentication checks. Do not expose raw `ipcRenderer`, arbitrary channel strings, arbitrary filesystem paths, arbitrary URL fetch or shell execution to the renderer.

## 4. Stable application origin and asset loading

Preferred packaged origin: a registered application scheme such as **`app://versus/versus.html`**, with a stable persistent renderer partition. Register the scheme before readiness with the standard/secure/fetch/stream capabilities actually needed, then register handlers on the session used by the window. Keep a restrictive CSP and correct MIME types. See the [protocol API](https://www.electronjs.org/docs/latest/api/protocol).

Map application paths only into the allowlisted built renderer/resource roots. Normalize decoded paths, reject traversal and prevent arbitrary filesystem access. Separate static assets from narrow host capability/media routes. Do not let a remote profile select a filesystem path or a new local service destination. External navigation/new windows are denied by default; deliberate external links use a validated scheme/host policy and the normal OS browser.

The current renderer uses root-relative paths such as `/music/...`, `/v1/...`, `/harness/...` and `renditions/index.json`. Loading `dist/versus.html` using a naive `file://` wrapper does not preserve those assumptions. A random loopback port on every launch also changes the origin and strands localStorage preferences. The stable app scheme plus explicit adapters resolves both issues.

If a concrete compatibility blocker requires an owned loopback server, it must be packaged, started/stopped by the app and authenticated under the existing boundary, with durable preferences migrated out of the changing origin. Record why it was necessary. Never depend on an already-running Vite server in the shipped app.

### Preserve useful local preferences

Current authored/received Cards and deck bindings use `hapa-versus.local-content.v1` in localStorage; table setup and dev preferences have their own keys. Preserve these within the stable desktop origin/partition across launches and upgrades. Authoritative identity/history belongs in the peer store, not localStorage.

The earlier browser's localhost storage is a different profile/origin. Provide explicit validated export/import for user-authored content and settings when migration is needed; do not silently read another browser's private profile. Online default matches still use the agreed bundled profile/catalog/decks rather than arbitrary local content.

## 5. Preserve the current integrations in a real package

`vite.config.js` currently supplies the Harbor, Music and Harness proxies and inserts credentials server-side. Those live dev/preview proxies are not part of a static Vite build. Extract a small shared host-adapter layer for the desktop service and browser host instead of duplicating broad proxy authority.

Use explicit owner configuration/capability detection; no hardcoded dependency on CJ's home folders or fixed private token paths. Credentials stay in the host. Reuse only the routes the game needs. The app origin is a first-party UI origin, not a reason to allow arbitrary requests to localhost. Media may use bounded streams or opaque handles; the renderer does not need owner tokens or unrestricted file paths. Preserve content type, byte-range/seek behavior where supported and exact asset identity through the app-scheme media adapter, so retained playback, Previous, replay and Return keep their current semantics.

**Red has a specific packaging dependency:** `avatar-opponent.js` imports the Harbor puppet module using `@vite-ignore`, then requests its Avatar package. That module is deliberately outside the current build. To include seated Red in the fresh/offline app, package an approved revision-pinned renderer/Avatar snapshot and its asset manifest, including the complete transitive module and asset dependency closure rather than only the top-level player and Avatar JSON. Do not claim an unavailable Harbor URL was bundled. A peer cannot provide executable replacement Avatar JavaScript; remote Avatars use supported data/assets through the admitted renderer or a neutral fallback.

The existing procedural unit kit, fallback Card faces and authored scene are good independent defaults. An empty/missing optional `public/renditions/` library must not prevent play. Record exactly which Card art, Avatar visuals and sounds were deliberately added; do not incidentally package all ignored media.

## 6. Build, native dependencies and engine provisioning

### Keep the build changes small

Use **Electron Forge** for package/make and signing integration, while retaining the existing Vite renderer build. A small Forge hook can invoke the current production build and include its output plus the main/preload/peer modules. Pin tested tool versions in the lockfile. Do not adopt both Forge and another packager, or migrate the UI framework.

Forge's [Vite plugin](https://www.electronforge.io/config/plugins/vite) is still documented as experimental; it is optional, not needed to retain Vite. Prefer the straightforward existing-build hook unless there is a concrete integration advantage.

Target script contract, to implement rather than assume already present:

| Command / action | Meaning |
| --- | --- |
| Open installed Hapa Versus | Default player path; all required runtime is already included |
| `npm run play` | Contributor desktop launch with the supervised bundled-development setup |
| `npm run dev` | Retained browser development workflow |
| `npm run desktop:package` | Build/stage a runnable desktop app for the selected platform/architecture |
| `npm run desktop:make` | Produce the selected distributable; sign/notarize when configured |
| `npm run check` | Existing required rules/protocol/build checks; retained |
| Focused packaged smoke | Actual artifact/native-store/launch proof at meaningful package boundaries |
| `npm run lobby:serve` | Headless operator workflow from Assignment 16, independent of Electron UI |

Commands may share implementation and preflight routines. A normal local edit is not a trigger to create/sign/notarize an installer again.

### Native modules are an early attachment gate

The Hypercore/Hyperswarm dependency chain includes native storage/crypto/network components. Electron's ABI can differ from standalone Node. Resolve compatible prebuilds or rebuild for the pinned Electron version, target OS and architecture; Forge integrates `@electron/rebuild`. Keep native dependencies external to inappropriate JavaScript bundling and include their actual production dependency closure. See [native modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules).

Enable ASAR as appropriate and [auto-unpack native modules](https://www.electronforge.io/config/plugins/auto-unpack-natives), or use an explicit equivalent. Include companion native libraries/resources and sign them as part of the app. A copied `.node` file or successful system-Node test is not proof it loads inside the packaged utility process.

Use a separate staging/install tree if Electron rebuilding would overwrite the addons required by normal Node/headless checks. Preserve a reproducible path for both runtimes instead of repeatedly repairing the same shared node_modules by hand.

Before shell polish, launch a packaged artifact and prove the utility process can create, append, close and reopen a real Hypercore, then start/stop the peer transport. Combine this with an ordinary rendered local match. This one attachment establishes runtime inclusion, native loading, data path and engine assets. Do not disable sandboxing, web security or library validation to hide a loading error. A separately bundled standalone Node helper is a fallback only after a specific utility-process incompatibility is established, and needs its own packaging/lifecycle proof.

### Engine distribution and source builds

CJ selected inclusion of the necessary engine runtime in the app. Compile/package the exact required pinned engine and approved assets; installed users must never clone the private submodule or supply a GitHub token. Keep the engine fork's existing ownership/update procedure, notices and private history intact.

Provide an exact build/content manifest with engine revision, files/assets, hashes and notices. If an actual file has unresolved redistribution rights/access, prepare that concrete boundary for the owner rather than asking again whether to bundle the runtime at all.

Retain the original unaffiliated source-clone goal. A public contributor must be able to obtain the supported pinned runtime input/snapshot through the documented path; a maintainer's private checkout cannot be its only source. The player installer and public source-build input are related release artifacts with separate evidence. Do not claim that shipping a compiled app automatically made private sources public or source builds reproducible.

## 7. Storage, lifecycle and recovery

Set a stable application/product ID. Main obtains the OS path using `app.getPath('userData')` and passes an app-owned subdirectory explicitly to the peer service, for example `.../Hapa Versus/state/<networkId>/`. Put identity, match stores, result outbox and index there; separate Chromium session/cache data and bounded remote caches. Never derive production state from `process.cwd()`, ASAR, a DMG mount or the installed `.app`. See [Electron app API](https://www.electronjs.org/docs/latest/api/app).

Keep developer/test roots under ignored `.data/` or explicit test overrides. Existing fixture reset code must never reach the real desktop store. Use both Electron's single-instance lock and an exclusive peer-store lock. A second normal launch focuses the existing window; isolated test players require explicit different data roots and test identities.

| Lifecycle event | Required behavior |
| --- | --- |
| Renderer refresh/crash | Reattach/recreate the view on the same authoritative peer session; do not create another match |
| Utility-process crash | Show the actual state, restart under a bounded policy, replay durable records and resume the same identity; surface repeated failure |
| Explicit Quit / last window closes | For v1, shut down the player runtime too; no hidden default background daemon |
| Minimize or loss of focus | Keep runtime correctness independent of renderer throttling; do not auto-concede or alter game rules |
| OS sleep/network change | Pause/reconnect from durable state; refresh presence on wake before claiming Available |
| Second launch | Focus existing instance; do not open a second writer |
| App moved/replaced/upgraded | Retain identity, acknowledged inputs, history and preferences at the stable data root |

On graceful quit, stop accepting commands, mark presence unavailable when possible, checkpoint/flush acknowledged work, close cores/network and terminate the utility process through a bounded shutdown. Do not depend on this path for crash correctness: an acknowledged Ready/choice/result must already be durably committed. Closing remains non-concession under the existing P2P spec.

Do not automatically install a login item or start a background service. If background hosting is wanted later, select it explicitly as operator functionality with its own availability and lifecycle UI.

## 8. Desktop finish and distribution

Preserve the existing board layout, responsive panels, hover/zoom inspection, keyboard shortcuts and music controls. Add a proper application name/icon, sensible resizable window minimum, remembered window bounds, fullscreen, platform Quit/About menus and an accessible app status/diagnostics view. Restore window placement onto an attached display; do not reopen offscreen after a monitor disappears. Avoid a permanent developer toolbar or opening DevTools on normal launch.

About/diagnostics should identify app version, game build, rules/content fingerprint, engine revision, peer protocol and direct/relay state when observable. Include a deliberate redacted diagnostic export and a way to locate/backup user data. Do not export keys/tokens as diagnostics. Copy/paste challenge invitations works in-app; custom OS URL registration is optional later.

For normal macOS download/open distribution, prepare code signing, hardened runtime and notarization through Forge's maintained tooling. Signing credentials remain in the authorized build environment; never commit/bake them into the installer. See [Forge macOS signing](https://www.electronforge.io/guides/code-signing/code-signing-macos). A locally launched unsigned `.app` is valuable development evidence, but distinct from a signed/notarized release tested on another Mac. Do not make disabling Gatekeeper or blanket loading of unsigned libraries the default installation instruction.

An app replacement/update must preserve the data root. **V1 can use manual signed replacement** with a version/release link; a new update service is not required. If an existing trusted update path is reused, apply updates only after active/resumable work is safely handled and an ordinary app restart is appropriate. Do not interrupt a match or execute an update URL from a peer. Report platform-specific updater limits rather than promising identical behavior everywhere.

## 9. Fit into Assignment 16 without another open-ended project

1. **First attachment:** build a thin actual desktop artifact with the existing board, packaged native peer storage and stable user data. Use a normal local game with optional owners off. This establishes the environment the network work depends on.
2. **Connected assembly:** complete the same discovery/challenge/remote-Tick/full-match/recovery/result journey through the desktop bridge. Preserve the source/headless adapter and required browser workflow. Add exact starter-content/owner adapters as part of this whole.
3. **Grouped tightening:** address remaining package paths, ABI/signing, lifecycle, origin/storage, IPC and UI fit together. Reuse unaffected game evidence; do not run notarization or broad regression after each file.
4. **One qualified handoff:** required `npm run check`, an actual installed arm64 app and the existing different-network/third-observer/relay journey using the packaged peers. Reconcile artifact hashes, code state, operating services and known gates, then stop automatic continuation.

### Installed-app evidence

Use one planned package/internet session to cover:

- Clean supported machine/account launches the delivered artifact without invoking or depending on system Node/npm/Git, a checkout, Vite server or optional Hapa owners. A clean host or restricted runtime environment can establish this; uninstalling a tester's developer tools is unnecessary. The local board and selected bundled content work offline; online features accurately need internet.
- The packaged utility process loads native dependencies and opens/reopens durable stores. No application data is written into the install bundle.
- Two packaged peers on genuinely different internet connections complete the selected remote journey, with one Ready and matching evidence. A fresh observer retrieves the result from the seeder while authors are offline; relay proof remains real.
- Renderer reload, peer restart, ordinary quit/relaunch and one suspend/resume recover without duplicate commits or new identities. Replacing/moving the app preserves data. A second launch cannot double-write.
- Optional owner absence is graceful. With an owner enabled, its actual desktop adapter retains relevant music/Avatar behavior; a bundled Red snapshot works without Harbor when claimed.
- The exact delivered artifact's contents, checksums, version/platform/architecture, signing/notarization status and installation observations are recorded. Artifact built, signed, published, installed and accepted by CJ are separate claims.

Do not turn these into an exhaustive cross-product of all operating systems and every previous game scenario. A missing Mac build host, signing credential, accessible engine artifact or reachable relay/archive is a concrete gate. Complete independent work and present the prepared artifact/runbook and the missing item; do not loop on unrelated polish to avoid reporting it.

## 10. Sources and compatibility notes

The game integration findings come from the pinned existing source: `vite.config.js`, `package.json`, `.gitmodules`, `presentation/app.js`, `avatar-opponent.js`, `soundtrack.js`, `local-content.js`, `renditions.js`, `model-decider.js` and the existing check/peer scripts. Their current bytes predate this documentation-only amendment.

Official implementation references:

- [Electron process model](https://www.electronjs.org/docs/latest/tutorial/process-model) and [utilityProcess](https://www.electronjs.org/docs/latest/api/utility-process).
- [Security](https://www.electronjs.org/docs/latest/tutorial/security), [context isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation) and [sandboxed ESM/preload limits](https://www.electronjs.org/docs/latest/tutorial/esm).
- [Protocol handlers](https://www.electronjs.org/docs/latest/api/protocol) and [application storage/lifecycle](https://www.electronjs.org/docs/latest/api/app).
- [Native modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules), [ASAR](https://www.electronjs.org/docs/latest/tutorial/asar-archives) and [Forge native unpacking](https://www.electronforge.io/config/plugins/auto-unpack-natives).
- [Forge Vite plugin status](https://www.electronforge.io/config/plugins/vite), [macOS distribution signing](https://www.electronforge.io/guides/code-signing/code-signing-macos), and [updater API](https://www.electronjs.org/docs/latest/api/auto-updater).

Pin the Electron/Forge/dependency versions actually tested together. This research does not select an untested newest version or prove that the current native dependency chain already loads in Electron.

