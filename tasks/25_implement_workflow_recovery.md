STATUS: TODO

# Task 25: Implement workflow recovery

## Dependency

This task depends on Task 24: Implement the findings workflow.

## Objective

Turn reconciliation results into safe resume and retry options without automatic repair.

## Plan references

- Section [5](../plan.md#plan-section-5), `src/workflow/recovery/inspectRecovery.ts`
- Sections [6.3](../plan.md#plan-section-6-3), [6.14](../plan.md#plan-section-6-14), [6.17](../plan.md#plan-section-6-17), [6.18](../plan.md#plan-section-6-18), and [6.20](../plan.md#plan-section-6-20)

## Work

1. Recover the current phase during explicit activation after restart or crash.
2. Classify a running phase without a terminal handoff as interrupted after restart.
3. Report the interrupted role, branch, worktree, cleanliness, and retry action.
4. Allow only an explicit owner retry when the expected worktree is clean.
5. Block on a dirty worktree, missing resource, or broken basic ancestry.
6. Treat every `final-review` workflow as completed and not reopenable.

## Implementation

Do not reset, clean, commit, relaunch, delete, or choose abandonment. Manual abandonment remains outside the MVP tool set.

Put `inspectRecovery` in its own module under `src/workflow/recovery/`, with tests beside it. Give any other new public operation its own module. Keep private helpers with their owner, and import modules directly without a barrel. Remove the unused `src/workflow/recovery.ts` placeholder. Do not add a second implementation.

## Tests

Add Vitest integration tests for interrupted builder, interrupted verifier, clean retry, dirty worktree, missing handoff, broken basic ancestry, completed final review, and no mutation during inspection.

## Completion criteria

- Recovery returns facts and allowed actions only.
- Interrupted work never restarts automatically.
- Completed workflows cannot become active again.
