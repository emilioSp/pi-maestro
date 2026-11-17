---
type: Roadmap
id: 'MAESTRO-FREE-5'
title: 'Run the simplifier through the Pi SDK'
status: completed
---

## Objective

Connect the `simplifier` to the SDK executor delivered by [MAESTRO-FREE-PRE-3](maestro-free-pre-3-implement-internal-sdk-delegation.md), following
[ADR-010](../adr/0010-use-the-pi-sdk-for-sequential-agent-delegation.md). Implement this role's switch together with FREE-3 and FREE-4 under the
[shared migration scope](maestro-free-3-run-the-builder-through-the-pi-sdk.md). Keep its existing purpose and Git-only scope.

See the [specification](../../.specs/20261106-092601-feat-migrate-builder-verifier-and-simplifier-to-the-pi-sdk/spec.md).

## Completed When

1. The SDK `simplifier` preserves the current Git readiness decision, skip behavior, and entry routes. No Git readiness check moves into activation or an earlier phase.
2. Successful execution saves the existing unnumbered `S.json` `handoff` and reaches `candidate-ready`; optional-phase behavior remains unchanged.
3. It reuses the established context, tools, persistence, cancellation, cleanup, and error policy.
4. Activation and execution no longer use `pi-subagents` for the `simplifier`. All roles migrate together, so no workflow path requires its ping, launch preflight, or
   fixed delegation deadline.
