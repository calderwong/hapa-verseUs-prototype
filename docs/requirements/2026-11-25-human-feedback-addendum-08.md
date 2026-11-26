# Human-feedback addendum 08 — A complete Electron application

**Date:** 25 November 2026, America/Los_Angeles.  
**Owner:** CJ / Hapa.  
**Status:** Selected delivery scope, extending Assignment 16. This publication is an implementation direction; it does not claim a built installer.

## User direction and intended result

After selecting P2P play and matchmaking, CJ asked to add an Electron wrapper and bake everything into it. The default player experience is now **download, install, open Hapa Versus and play**. A player must not need Git, npm, a separately installed Node runtime, a terminal, a running development server, private engine credentials or the rest of the Hapa ecosystem.

Electron and inclusion of the necessary game runtime are selected. Do not ask CJ again whether to add them. Retain the source-clone/contributor workflow and headless lobby/archive operation alongside desktop delivery.

## What the application includes

- Electron's browser/Node runtime and the built existing game, with its rules, bundled catalog/decks, necessary engine runtime, fonts, icons, procedural art and approved starter assets.
- The persistent local peer service, native Hypercore/storage/network dependencies, lobby, challenge/session handling, result verifier and public service configuration described in addendum 07.
- Local human/bot play without a model service, plus the existing desktop-compatible music/Avatar UI and optional-owner adapters.
- Stable local identity, preferences, match recovery, history and result publication state stored outside the installed application.
- An intentional starter-content manifest. Include the selected Red visual/renderer snapshot when its exact distribution contents are approved and available; do not assume a dynamic Harbor module is already included in the Vite build. Never copy a whole private owner store as a packaging shortcut.

The installed app must contain everything necessary for base local and online gameplay. Live generative voice/model services, private music libraries, Second Brain/Overwind and other owner data remain optional integrations. A bundled UI adapter must not be described as a bundled external service. Any included starter music or prerecorded audio needs an explicit asset entry and can play locally without an external owner.

The public relay/archive remains an operated network resource. Packaging its client configuration or operator tools cannot keep a different machine online. Report its actual availability accurately.

## Implementation defaults

Use Electron Forge around the current Vite production build. Keep the plain JavaScript game and existing headless rules. Electron main owns app lifecycle and window/protocol setup; a supervised Node-capable utility process hosts the same reusable peer runtime; a sandboxed renderer uses a small typed preload/IPC bridge. Do not create separate desktop and browser game authorities.

Use a stable application origin and renderer partition, plus application data beneath the OS user-data directory. Development/test state can remain in ignored `.data/`. Keep signing keys and production match data out of `.app`, ASAR, the install directory and the working directory.

Deliver macOS Apple Silicon first. Keep platform configuration extensible and the source/headless path usable; only claim Windows or Linux desktop support after actual native build/launch evidence. A real installed package, not a browser screenshot or `electron .` dev run, is the acceptance target.

## Supersession and proof

This addendum supersedes addendum 07/P2P v1 exclusions of a desktop shell and its browser-only delivery assumption. Network/game contracts remain unchanged. The source-clone path still needs an accessible pinned engine input; a maintainer-built installer alone does not make anonymous source builds reproducible.

Follow [Electron desktop delivery v1](../integrations/electron-desktop-v1.md) and the amended [Assignment 16](../reviews/2026-11-25-next-agent-assignment-16.md). Apply Loose Screws: prove the installed app can render a match and load/reopen native peer storage early, complete the connected desktop/P2P journey, then tighten and qualify once at the integrated milestone. Preserve the board as task truth and CJ's acceptance authority.

Prepare the exact artifact/content/signing boundary before surfacing any actual missing owner access, asset rights, signing credentials or operating host. Do not stop implementation merely to reconfirm the already selected Electron direction. Do not publish private repository history, change repository visibility or embed secrets in order to produce the installer.
