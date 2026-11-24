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

Later dated human-feedback addenda in `docs/requirements/` record CJ's selected changes;
follow the current pointer in `docs/reviews/README.md`. Addendum 03 replaces repeated human
Ready acknowledgment and governs the current play loop. Addendum 04 consolidates CJ's newer
center-travel, Pawn-absorption, two-Queen and Knight direction recorded in response 09; it
supersedes conflicting earlier movement guidance. Preserve archived profile/protocol semantics
as specified; do not silently reinterpret old records.

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

## Assembly and verification — Loose Screws

Large work defaults to [Loose Screws v1.0.0](docs/workflows/LOOSE_SCREWS.md): frame the agreed
whole, assemble real dependency-ready connections, fit the required end-to-end journeys, then
tighten and qualify the integrated candidate. Continue through ready phases without repeated
approval. Missing required behavior is not polish, and a stub is not an attachment proof.

During assembly use the smallest adequate check for a needed contract, decision-changing
uncertainty, observed failure or changed critical boundary. Batch related implementation;
defer exhaustive regression, broad review, benchmarks and polish until whole-system fit.
A file edit, commit or compaction is not itself a full-suite trigger. Keep one short current
checkpoint and grouped tightening list; reuse evidence until relevant dependencies change.
Do not repeat unchanged failed experiments or expand scope to keep working.

Final qualification still includes:

```bash
npm run check
```

Then play the changed connected journey at `http://127.0.0.1:5199/`. A passing check is not
proof of gameplay, visual quality or human acceptance. Fix related failures in batches;
rerun affected checks and broaden for concrete remaining risk or a required gate. Report
implementation, observed verification, unresolved gates and CJ acceptance separately.

## Commits and handoff

Keep coherent source checkpoints, review the staged boundary and scan for secrets before
committing; do not change Git identity configuration. A checkpoint does not require release
qualification or a publication/board cycle. Batch those at integrated milestones or actual
consumer need. Preserve binding checks; do not bypass protections. At handoff, reconcile
source, evidence and operating state, and append material progress to the existing board.

## Design review handoffs

For UI/design work, read `docs/reviews/README.md` and its current dated review. Compare the
review's pinned source with the current branch and local work before changing anything. Treat
findings as evidence and recommendations under the authority order above; CJ's latest scope
and priorities govern. Preserve earlier dated reviews, and record implementation/reproduction
evidence using `docs/reviews/IMPLEMENTATION_REPORT_TEMPLATE.md`. Append progress and evidence
to the existing Overwatch board; these review files do not replace its task state or CJ's Done
acceptance. The documented review loop does not itself authorize unrelated work or new services.
