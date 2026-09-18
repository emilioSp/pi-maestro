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

1. Recover the current phase after restart, crash, or `/resume`.
2. Reattach to a still-active subagent request when correlation is valid.
3. Classify a running phase without process or terminal handoff as interrupted.
4. Report the role, branch, worktree, commit, revision, cleanliness, and safe next actions.
5. Allow only an explicit owner retry when the worktree is clean.
6. Block on dirty state, conflicting revisions, broken ancestry, collision, or foreign resources.
7. Treat `final-review` without managed resources as completed and not reopenable.

## Implementation

Do not reset, clean, commit, relaunch, delete, or choose abandonment. Manual abandonment remains outside the MVP tool set.

## Tests

Add Vitest integration tests for restart in every phase, active process reattachment, interrupted builder, interrupted verifier, clean retry, dirty worktree, missing handoff, conflicting revisions, completed final review, and no mutation during inspection.

## Completion criteria

- Recovery returns facts and allowed actions only.
- Interrupted work never restarts automatically.
- Completed workflows cannot become active again.
