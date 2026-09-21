STATUS: TODO

# Task 25: Implement workflow recovery

## Dependency

This task depends on Task 24: Implement the findings workflow.

## Objective

Turn reconciliation results into safe resume and retry options without automatic repair.

## Plan references

- Section [5](../plan.md#plan-section-5), `src/workflow/recovery.ts`
- Sections [6.3](../plan.md#plan-section-6-3), [6.14](../plan.md#plan-section-6-14), [6.17](../plan.md#plan-section-6-17), [6.18](../plan.md#plan-section-6-18), and [6.20](../plan.md#plan-section-6-20)

## Work

1. Recover the current phase during explicit activation after restart or crash.
2. Classify a running phase without a terminal handoff as interrupted after restart.
3. Report the role, branch, worktree, commit, revision, cleanliness, and safe next actions.
4. Allow only an explicit owner retry when the worktree is clean.
5. Block on dirty state, broken basic ancestry, collision, or foreign resources.
6. Treat every `final-review` workflow as completed and not reopenable; report any remaining managed resources for manual cleanup.

## Implementation

Do not reset, clean, commit, relaunch, delete, or choose abandonment. Manual abandonment remains outside the MVP tool set.

## Tests

Add Vitest integration tests for restart in every phase, interrupted builder, interrupted verifier, clean retry, dirty worktree, missing handoff, broken basic ancestry, completed final review, final review with remaining resources, and no mutation during inspection.

## Completion criteria

- Recovery returns facts and allowed actions only.
- Interrupted work never restarts automatically.
- Completed workflows cannot become active again.
