# AGENTS.md

## Hapa context

Read `/Users/calderwong/Desktop/hapa/docs/HAPA_SHARED_GROUNDING.md`, then `AGENT_START.md` in the
same folder, then this file and the README. Treat this repository as **First Pass / Prototype
Stage**. Fresh user instructions govern scope; a board card alone is not permission to spend,
publish or start services beyond the local dev server.

Task truth lives on the Overwatch board `hapa-versus`
(`node bin/overwatch-kanban.mjs state hapa-versus` in hapa-overwatch-kanban). Append progress,
evidence and blockers there; do not rewrite its event log. Cards go to Review with evidence;
Calder accepts them to Done.

## Authority

1. `docs/requirements/master-requirements-v3.txt` (Hapa Versus Master Requirements v3) governs
   gameplay. Its Appendix A profile and Appendix B contracts are the semantic source.
2. `docs/requirements/design-companion-v1.txt` proposes presentation.
3. `docs/requirements/references-master-v1.txt` supplies implementation advice.
The `.docx` originals stay local in `reference_documents/` (ignored: large binaries).

## Check for recent work first

Before designing a feature here, survey what exists: this repo's branches and `git status`, the
Luminati checkout and its `hapa` branch, `~/Desktop/hapa-tarot-edh` (earlier Tarot wargame),
`~/Desktop/hapa-overcard` (Hand/Deck/Formation contracts), the Hapa World home, Codex and Claude
sessions, `HANDOFF.md` files and the boards.

## Ownership boundaries

- **Luminati** (`vendor/lumina`): upstream MIT code vendored from the **Hapa fork** (branch `hapa`
  of `~/Documents/Codex/2026-06-29/can/lumina`, published privately at
  https://github.com/calderwong/lumina-hapa; base `85efa04`, the revision the requirements pin).
  Never edit `vendor/lumina` in place. Engine changes go on the fork's `hapa` branch with
  Luminati's checks and a doc under its `docs/hapa/`; then move the pin here. `src/engine` must
  never import Hapa rules. Nothing goes upstream without Calder's word.
- **Avatar Builder, Overcard, Second Brain, Overwind**: separate owners; use their contracts.
- **Media** (card art, avatars) stays with its owner or in ignored local storage
  (`public/renditions/`). Rules never depend on art.
- Signing keys and peer storage live under ignored `.data/`; never commit keys.

## Conventions

- Plain JavaScript ES modules with JSDoc. No framework.
- `src/hapa/rules` is headless: no DOM, WebGL, wall clock, `Math.random` or animation timing.
  Authoritative numbers are safe integers (1,000,000 units per member width, Supply point and HP;
  1,000 quanta per Tick); ratios are `[num, den]`.
- Presentation (`src/hapa/presentation`) draws state and turns input into commands; it never
  changes authoritative state directly.
- Profiles and content live in `fixtures/hapa`; values there are engineering fixtures.
- The dev server binds 127.0.0.1 only.

## Verification

```bash
npm run check
```

Then play the changed journey at `http://127.0.0.1:5199/`. A passing check is not proof of
gameplay, visual quality or human acceptance; record what was observed on the board card.

## Commits

After a coherent change: verify, review the staged boundary, scan for secrets, commit. Do not
change Git identity configuration.
