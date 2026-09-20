STATUS: TODO

# Task 26: Implement final review and cleanup

## Dependency

This task depends on Task 25: Implement workflow recovery.

## Objective

Prepare the candidate as staged changes on the base branch and conclude Maestro safely.

## Plan references

- Sections [3.7](../plan.md#plan-section-3-7) and [3.8](../plan.md#plan-section-3-8)
- Section [5](../plan.md#plan-section-5), `src/git/final-review.ts` and `src/workflow/final-review.ts`
- Sections [6.10](../plan.md#plan-section-6-10), [6.14](../plan.md#plan-section-6-14), [6.17](../plan.md#plan-section-6-17), [6.24](../plan.md#plan-section-6-24), and [6.25](../plan.md#plan-section-6-25)

## Work

1. Resolve the valid candidate commit from empty findings or fully rejected findings.
2. Require a clean and coherent base branch and managed resources.
3. Squash the candidate onto the base branch without creating a commit.
4. Stage and verify the candidate product changes while keeping the current phase.
5. Remove verified workflow worktrees and branches after staging succeeds.
6. Write and stage `workflow.json` in `final-review` as the last mutation.
7. Return structured staging data and summarized observations for the Maestro LLM.
8. Mark the workflow concluded without waiting for an owner commit.

## Implementation

Use rollback or stop-before-cleanup behavior so a failed squash or staging check does not destroy workflow resources. Do not write `final-review` until cleanup succeeds. If any earlier step fails, return an error, keep the previous phase, and leave reconciliation to report the inconsistent repository state. Never include unrelated owner changes. After `final-review`, later owner edits are outside Maestro.

## Tests

Add Vitest integration tests for each candidate type, squash contents, staged final state, no final commit, observations data, branch and worktree cleanup, parent-directory cleanup, dirty base rejection, unexpected staging, failure before and during cleanup, unchanged phase on failure, final-review as the last mutation, and completed-workflow discovery.

## Completion criteria

- The owner receives reviewable staged changes on the base branch.
- No Maestro branch or worktree remains after success.
- The workflow is complete at `final-review`.
