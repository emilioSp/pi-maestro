---
type: Roadmap
id: 'MAESTRO-27'
title: 'Make all implementation phases optional'
status: completed
---

## Objective

Make the entire implementation stage optional, including the `builder`, `verifier`, and `simplifier` phases. Let the `owner` use `Maestro` only to prepare and approve a
`spec`, leaving implementation to another workflow.

When implementation runs in `Maestro`, the `owner` can still independently enable or disable the `verifier` and `simplifier` phases. `Spec` preparation and approval
remain required.

See the [specification](../../.specs/20261103-161424-maestro-27-make-implementation-phases-optional/spec.md).

## Completed When

1. The `owner` can complete a workflow with only an approved `spec`, without running the `builder`, `verifier`, or `simplifier`.
2. Implementation can be performed through another workflow using the approved `spec`, without requiring further execution in `Maestro`.
3. The existing requested combinations remain available: `builder` only; `builder` and `verifier`; `builder` and `simplifier`; or all three.
4. Disabled phases are not delegated and do not block workflow completion.
5. The workflow reaches `candidate-ready` after `spec` approval when no agent phases are selected, or after the selected phases complete and any required `owner`
   decisions are resolved.
6. The final summary clearly identifies skipped phases and does not claim that skipped implementation or verification has been completed.
