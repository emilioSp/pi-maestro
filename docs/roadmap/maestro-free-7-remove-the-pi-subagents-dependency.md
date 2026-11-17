---
type: Roadmap
id: 'MAESTRO-FREE-7'
title: 'Remove the pi-subagents dependency'
status: completed
---

## Objective

Finish [ADR-010](../adr/0010-use-the-pi-sdk-for-sequential-agent-delegation.md) by removing the package dependency, bundling, and remaining integration metadata after
[MAESTRO-FREE-3](maestro-free-3-run-the-builder-through-the-pi-sdk.md), [MAESTRO-FREE-4](maestro-free-4-run-the-verifier-through-the-pi-sdk.md), and
[MAESTRO-FREE-5](maestro-free-5-run-the-simplifier-through-the-pi-sdk.md). This is dependency removal, not another execution-engine switch.

See the [specification](../../.specs/20261106-092601-feat-migrate-builder-verifier-and-simplifier-to-the-pi-sdk/spec.md).

## Completed When

1. `Maestro` neither imports nor bundles `pi-subagents`, and package metadata, role frontmatter, tests, installation instructions, and current human documentation no
   longer require it. Historical records remain historical evidence.
2. A clean installation can activate and complete workflows without `pi-subagents` installed or enabled, including the supported optional-phase combinations.
3. Existing workflow and `handoff` formats remain unchanged. No compatibility framework, engine-selection flags, or migration of interrupted workflows is added.
