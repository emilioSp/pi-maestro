STATUS: TODO

# Task 37: Add the inspect-workflow tool

## Dependency

This task depends on Task 36: Add create-spec and mark-ready tools.

## Objective

Expose read-only workflow discovery, reconciliation, and recovery facts.

## Plan references

- Sections [2.11](../plan.md#plan-section-2-11) and [5](../plan.md#plan-section-5), `src/tools/main/inspect-workflow.ts`
- Sections [6.10](../plan.md#plan-section-6-10), [6.14](../plan.md#plan-section-6-14), [6.17](../plan.md#plan-section-6-17), [6.18](../plan.md#plan-section-6-18), and [6.20](../plan.md#plan-section-6-20)

## Work

1. Implement `maestro_inspect_workflow` as a read-only Pi adapter.
2. Discover the active workflow and its current authoritative state.
3. Return phase, spec ID, base branch, branch and worktree facts, current handoff summary, blockers, and allowed recovery actions.
4. Identify interrupted passes without changing them.
5. Identify concluded final-review workflows separately from active workflows.
6. Keep sensitive local details out of model-visible output unless required for owner recovery.

## Implementation

Call state discovery, reconciliation, and recovery modules. Do not stage, write, commit, relaunch, clean, or delete. Use structured results instead of prose parsing.

## Tests

Add Vitest adapter tests for input schema, one structured successful result, one propagated domain error, and proof that the adapter does not mutate the repository.

## Completion criteria

- Inspection gives Maestro enough facts to explain the state accurately.
- It never repairs an inconsistency.
- Completed workflows do not block new spec creation.
