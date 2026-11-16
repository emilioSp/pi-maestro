---
type: Roadmap
id: 'MAESTRO-25'
title: 'Define workflow reconciliation'
status: completed
---

## Objective

Let the `owner` restart an existing `spec` after an interruption without automatically recovering execution.

See the [specification](../../.specs/20261109-142858-resume-an-interrupted-workflow-from-drafting-spec/spec.md).

## Completed When

- `/maestro` offers a new `spec` or an existing `spec` to restart.
- Restart returns the selected `spec` to `drafting-spec` from any saved phase for document review and renewed `GREEN FLAG`.
- Existing code, `handoffs`, and recorded decisions are preserved.
- Restart does not resume an interrupted agent or reconcile partial saves.
