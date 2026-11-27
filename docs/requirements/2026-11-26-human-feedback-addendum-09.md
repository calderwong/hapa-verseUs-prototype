# Human-feedback addendum 09 — Open the app, find a friend, play across town

**Date:** 26 November 2026, America/Los_Angeles.  
**Owner:** CJ / Hapa.  
**Status:** Selected next iteration; requirements and tasking only. No new executable, implementation, internet test or acceptance is claimed by this publication.

## CJ's selected outcome

CJ has a friend across town on a separate machine and internet connection. CJ wants to send either the Hapa Versus repository link or a bundled executable. The friend should open the app, confirm it works, connect to CJ running the same compatible app, and play a game. The friend must not become an installer, developer or infrastructure operator.

CJ also selects provenance, permanence and modularity for connection infrastructure: preserve identity and authenticated history across changes of host, provider and supported connection method; maintain connection/service changes using Hypercore append-only constructions; allow additional compatible services, including third-party VPS services, to be appended and retired. A VPS maintained by CJ is not a prerequisite for this prototype. Public HyperDHT discovery is the initial route, subject to actual connectivity evidence.

This direction is implemented through [Assignment 19](../reviews/2026-11-26-next-agent-assignment-19.md) and [Friend test and resilient connectivity v1](../integrations/friend-test-and-resilient-connectivity-v1.md).

## Required results

| ID | Selected requirement |
| --- | --- |
| HF09-01 | Provide a complete runnable app for CJ's and the friend's actual OS/architecture. A repository link must offer an obvious matching download; contributor setup remains separate. |
| HF09-02 | Normal player setup requires only ordinary download/install/open, an optional display name, and in-app play/challenge/invitation actions. No terminal, Git/npm/Node, private engine access, JSON edits, router changes, relay keys or separate Hapa owner services. |
| HF09-03 | Use existing native HyperDHT/Hyperswarm public discovery and signed invitations for the first real two-network attempt. No mandatory newly operated relay, archive, directory or paid service. |
| HF09-04 | Both humans control their own seats, complete a legal game, see the same verified result and retain identity/history across ordinary quit/reopen. Network loss never invents a concession or result. |
| HF09-05 | Connections have truthful, useful progress and bounded recovery. An empty lobby, unavailable discovery, incompatible peer and failed authentication are distinguishable. Diagnostics can be copied/exported inside the app without exposing secrets or private owner data. |
| HF09-06 | Add, disable, retire and replace compatible discovery/relay services through typed configuration and authenticated append-only records. Actual selection/fallback must work through desktop main, utility host and peer runtime; a dormant array of addresses is insufficient. |
| HF09-07 | Stable player identity, contact-feed identity, transport identity and provider endpoint remain distinct. Contact history and verified invitation/cache data provide multiple entry paths. A provider change must preserve player and match identities. |
| HF09-08 | Preserve verifiable history and replicated copies. Describe retention, reachability and freshness accurately; signatures alone do not promise permanent availability or knowledge of unseen revocations. |
| HF09-09 | Produce a concrete friend handoff: artifact identity/checksum, download or delivery location, short player instructions, and an explicit record of what was actually verified. CJ retains human acceptance. |

## Scope and sequencing

Reconcile the local agent's in-flight [Assignment 18](../reviews/2026-11-26-next-agent-assignment-18.md) first. Preserve completed fixes and its unresolved findings, including the expected default mesh/Red appearance and decision/recovery/result correctness. Do not restart already completed work or ask the friend to be the first person exercising known faults.

The immediate acceptance target is the native app and one uncomplicated human-versus-human match on the two real networks. Browser online support, direct Rematch, broader directory/archive availability and other selected parent work remain tracked; they do not become prerequisites for this narrower native friend test unless the changed path actually depends on them. Offline third-observer availability is a separate replication test, with a reachable retained copy required from someone. A relay is added when evidence shows it is needed for the target networks.

The reviewed package currently targets macOS Apple Silicon. The friend's OS/architecture has not been supplied here. Resolve it from existing context or as the final artifact-selection input while completing independent work. If another platform is necessary, qualify that specific target; do not silently assume support or expand into an all-platform release campaign.

## Authority and compatibility

This addendum refines Addenda 07–08 and the infrastructure/delivery sequencing in their companions. It removes any interpretation that CJ must first rent or maintain a server to try remote play. It does not cancel the earlier source-build goal, result-verification rules, optional-owner boundaries, selected presentation, or archived protocol meanings.

The companion supplies working engineering defaults. It does not claim that a W3C DID method, universal transport adapter or public relay service already exists. Same-protocol service substitution is required now; additional transport implementations can be introduced later behind the defined interface.

Use [Loose Screws](../workflows/LOOSE_SCREWS.md). Continue through dependency-ready implementation and verification without repeated approval. Prepare the actual package and exact boundary before surfacing a genuinely missing signing credential, platform input or distribution grant. This task does not authorize purchasing infrastructure or exposing private owner services. Current authorization to bundle the required runtime should not be re-asked as a product decision.

The Overwatch board `hapa-versus` remains execution task truth. The GitHub assignment and issue preserve portable tasking; the local agent links them into the existing board and appends evidence there. Documentation publication does not mark any implementation or CJ acceptance complete.
