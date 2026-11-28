# Base Hapa Node Standard — start here

**Version:** `0.1.0-draft.1` · **Status:** proposed initial contract, source-only publication

A Hapa Node preserves attributable history, can be operated through UI/CLI/API/desktop, explains its origins and current state, participates in work/memory/telemetry, and makes its I/O inspectable.

## Reading order

1. [STANDARD.md](STANDARD.md): the seven pillars, 15 supporting requirements, definitions and migration approach.
2. [IO_BAR.md](IO_BAR.md): the new common strip, detailed ledger inspector, event semantics, colors, motion, privacy and accounting.
3. [GOVERNANCE.md](GOVERNANCE.md): Second Brain ownership, recurring checks, versioning, pinned mirrors and update adoption.
4. [CONFORMANCE.md](CONFORMANCE.md): how to make an evidence-backed claim against the [42 requirements and 87 acceptance cases](conformance-catalog.json).
5. [SOURCES.md](SOURCES.md): exact sources and what this publication did and did not establish.

## The portable kit

Keep this whole version folder in each node repository at `docs/standards/base-hapa-node/0.1.0-draft.1/`, or a declared equivalent. `release.json` hashes its exact files. Never edit a mirrored normative file to fit one application. Local choices belong in the node's root `hapa-standard.json` and `docs/HAPA_NODE.md`.

| Starting artifact | Use |
| --- | --- |
| [Node adoption example](templates/hapa-standard.example.json) | Fill real target hashes and preserve a separate adopted pin; unresolved bindings stay null |
| [Readable node record](templates/HAPA_NODE.md) | Map existing docs, capability parity, persistence, registrations and work |
| [Conformance report](templates/conformance.example.json) | Starts every requirement as not tested |
| [Capability example](templates/capability.example.json) | Map an actual operation across all four surfaces |
| [I/O observation example](examples/io-observation.example.json) | Synthetic record for understanding the schema; no network claim |
| [Telemetry vocabulary](telemetry-vocabulary.json) | Common stage, kind and measurement names |
| [Schemas](schemas/) | Record-shape contracts; they do not authenticate records or prove behavior |

Preserve existing `hapa-node.json`, keys, identity, signature domains, board references and successful workflows. An unassessed template is allowed null pins; a node targeting or adopting this standard computes its real bundle and release hashes. The release manifest is not included in its own hash list. See the exact byte algorithm in GOVERNANCE.md.

## Validator responsibilities

JSON Schema validation is only the first layer. An implementer must also validate full catalog/case coverage, unique catalog requirements and report case assignments, unique normalized file targets, real RFC 3339 calendar values, same-version cross-record consistency, capability mappings, all referenced file hashes and sizes, signature/trust continuity, owner receipts and actual evidence. A schema-valid `pass` with invented references remains false.

A report result covers its listed `case_ids` for one requirement and one evidence kind. Split cases needing different evidence kinds into separate entries for the same requirement; their case sets must be disjoint in the current assessment. The template's empty case set is an untested placeholder. A complete claim requires every applicable catalog case to be covered with the required scope, and every inapplicable conditional case to have a valid reason. Duplicate case assignments, missing cases and a blanket not-applicable entry for a mandatory pillar fail semantic validation. Earlier assessments remain separate historical records.

The target fields in `hapa-standard.json` identify the version under consideration. `adopted_pin` independently identifies the version currently followed. An assessment's standard/build must agree with its evidence report; a migration can target a new draft while preserving a valid historical assessment of an older release. A source-only bootstrap cannot be reported as a signed release.

## First-pass publication boundary

The standard is designed to be maintained in Hapa Second Brain. This initial Git publication is `bootstrap_source_only`: no live Second Brain receipt, authority signing key, automatic scheduler or node certification is asserted. The accompanying owner handoff defines ingestion and recurring syndication. Future published releases are immutable; corrections are new versions and new decisions.

Initial mirrors in selected repositories are a pilot distribution. Ecosystem-wide coverage requires a real node/repository inventory and recorded adoption work, including nodes that are private or only local. A repository inventory or a copied document does not certify the fleet.

