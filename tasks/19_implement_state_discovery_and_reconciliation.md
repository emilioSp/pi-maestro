STATUS: DONE

# Task 19: Implement state discovery and reconciliation

## Dependency

This task depends on Task 18: Implement workflow transitions.

## Objective

Find the authoritative workflow state and compare it with Git, worktrees, and artifacts.

## Plan references

- Sections [2.11](../plan.md#plan-section-2-11) and [5](../plan.md#plan-section-5), `src/workflow/state/discover.ts` and `src/workflow/state/reconcile.ts`
- Sections [6.14](../plan.md#plan-section-6-14), [6.17](../plan.md#plan-section-6-17), [6.18](../plan.md#plan-section-6-18), [6.20](../plan.md#plan-section-6-20), and [6.22](../plan.md#plan-section-6-22)

## Work

1. Find the active workflow from the configured spec directory and its expected workflow resource.
2. Treat `final-review` as concluded and exclude it from active workflows.
3. Reconcile the current phase, expected branch, worktree, HEAD, and terminal artifact.
4. Detect an interrupted pass, dirty expected worktree, missing expected resource, or unreadable state.
5. Return structured findings without repairing anything.

## Implementation

Treat repository files and Git as authoritative. Session data may identify the expected active resource but is not workflow truth. After restart, a `builder-running` or `verifier-running` phase without a terminal handoff is interrupted. Do not scan unrelated branches or worktrees. Do not relaunch, reset, clean, or delete.

## Tests

Add Vitest integration tests for no workflow, one active workflow, concluded workflow, missing expected artifacts, wrong expected branch, interrupted clean pass, and interrupted dirty pass.

## Completion criteria

- Recovery gets one clear result for the active workflow.
- Reconciliation is read-only.
- An inconsistency in the expected workflow resources blocks progress.
