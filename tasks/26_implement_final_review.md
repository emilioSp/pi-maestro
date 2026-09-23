STATUS: TODO

# Task 26: Implement final review and cleanup

## Dependency

This task depends on Task 25: Implement workflow recovery.

## Objective

Prepare the candidate as staged changes on the base branch and conclude Maestro safely.

## Plan references

- Sections [3.7](../plan.md#plan-section-3-7) and [3.8](../plan.md#plan-section-3-8)
- Section [5](../plan.md#plan-section-5), `src/git/final-review/` and `src/workflow/final-review/prepareFinalReview.ts`
- Sections [6.10](../plan.md#plan-section-6-10), [6.14](../plan.md#plan-section-6-14), [6.17](../plan.md#plan-section-6-17), [6.24](../plan.md#plan-section-6-24), and [6.25](../plan.md#plan-section-6-25)

## Work

1. Resolve the valid candidate commit from empty findings or fully rejected findings.
2. Require a clean and coherent base branch and managed resources.
3. Squash the candidate onto the base branch without creating a commit.
4. Stage and verify the candidate product changes while keeping the current phase.
5. Write and stage `workflow.json` in `final-review` after staging verification.
6. Attempt best-effort removal of verified workflow worktrees and branches.
7. Return structured staging data, candidate identity, and the cleanup result for the Maestro LLM.
8. Mark the workflow concluded without waiting for an owner commit.

## Implementation

If squash or staging verification fails, return an error and keep the previous phase. After staging succeeds, write and stage `final-review`, then attempt cleanup. Cleanup failure is reported but does not roll back staging or `final-review`. Never include unrelated owner changes. After `final-review`, later owner edits are outside Maestro.

Above every Git-related function, add one `// git ...` comment for each Git command it can run. Use `<...>` placeholders for runtime values.

Put the Git operations in `src/git/final-review/`, with one public operation per module. Remove the unused `src/git/final-review.ts` placeholder. Put `prepareFinalReview` in its own module under `src/workflow/final-review/`, with tests beside it. Give any other new public workflow operation its own module. Keep private helpers with their owner, and import modules directly without a barrel. Remove the unused `src/workflow/final-review.ts` placeholder. Do not add parallel implementations.

## Tests

Add Vitest integration tests for each candidate type, squash contents, staged final state, no final commit, candidate data, successful cleanup, cleanup failure reporting, dirty base rejection, unexpected staging, unchanged phase before final-review, and completed-workflow discovery.

## Completion criteria

- The owner receives reviewable staged changes on the base branch.
- Cleanup is attempted and its result is reported.
- The workflow is complete at `final-review` even when cleanup requires manual follow-up.
