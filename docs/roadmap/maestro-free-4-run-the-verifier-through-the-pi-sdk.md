---
type: Roadmap
id: 'MAESTRO-FREE-4'
title: 'Run the verifier through the Pi SDK'
status: completed
---

## Objective

Connect the `verifier` to the SDK executor delivered by [MAESTRO-FREE-PRE-3](maestro-free-pre-3-implement-internal-sdk-delegation.md), following
[ADR-010](../adr/0010-use-the-pi-sdk-for-sequential-agent-delegation.md). Implement this role's switch together with FREE-3 and FREE-5 under the
[shared migration scope](maestro-free-3-run-the-builder-through-the-pi-sdk.md). Do not redesign verification or its reports.

See the [specification](../../.specs/20261106-092601-feat-migrate-builder-verifier-and-simplifier-to-the-pi-sdk/spec.md).

## Completed When

1. The SDK `verifier` independently checks the approved `spec` and saves existing numbered `handoffs`, preserving criterion validation, `finding` decisions, and phase
   transitions.
2. It reuses the established fresh-session context, tools, persistence, cancellation, cleanup, and error policy without a second execution mechanism.
3. Activation and execution no longer use `pi-subagents` for the `verifier`.
4. Workflows with verification enabled or disabled retain their existing routes, with all enabled roles using the common SDK executor.
