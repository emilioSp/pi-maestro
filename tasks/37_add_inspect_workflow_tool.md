STATUS: TODO

# Task 37: Add the inspect-workflow tool

## Dependency

This task depends on Task 36: Add the create-spec and mark-ready tools.

## Objective

Let Maestro inspect workflow state and recovery facts without changing them.

## Plan references

- Sections [2.11](../plan.md#plan-section-2-11) and [5](../plan.md#plan-section-5), `src/tools/main/inspect-workflow.ts`
- Sections [6.10](../plan.md#plan-section-6-10), [6.14](../plan.md#plan-section-6-14), [6.17](../plan.md#plan-section-6-17), [6.18](../plan.md#plan-section-6-18), and [6.20](../plan.md#plan-section-6-20)

## Work

1. Add `maestro_inspect_workflow` as a read-only Pi tool.
2. Find the active workflow and read its current authoritative state.
3. Return the phase, spec ID, base branch, branch and worktree facts, current handoff summary, blockers, and allowed recovery actions.
4. Report interrupted passes. Do not change them.
5. Report completed `final-review` workflows separately from active workflows.
6. Do not show local sensitive details unless the owner needs them for recovery.

## Implementation

Use the state discovery, reconciliation, and recovery modules. Do not stage, write, commit, relaunch, clean, or delete anything. Return structured data. Do not parse prose to determine state.

## Tests

Add Vitest adapter tests for the input schema, one successful structured result, one domain error returned to the tool caller, and proof that the tool does not change the repository.

## Completion criteria

- Maestro has enough facts to explain the workflow state accurately.
- The tool never repairs an inconsistency.
- A completed workflow does not block creation of a new spec.
