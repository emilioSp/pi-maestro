STATUS: TODO

# Task mvp_07: Reconcile shared-branch tests and fixtures

## Dependency

This task depends on all previous `mvp_*` tasks.

## Objective

Remove obsolete worktree assumptions from shared test support and verify the complete current-branch domain flow before Task 35.

## Plan references

- Sections [1](../plan.md#plan-section-1), [3](../plan.md#plan-section-3), and [5](../plan.md#plan-section-5)
- Sections [6.14](../plan.md#plan-section-6-14), [6.17](../plan.md#plan-section-6-17), [6.19](../plan.md#plan-section-6-19), and [6.25](../plan.md#plan-section-6-25)

## Work

1. Audit all source, test, fixture, task, and agent references to worktrees, operational branches, `baseBranch`, verifier pass numbers, local squash, staging, and cleanup.
2. Update `test/support` repositories and fake subagents to use one current branch and one checkout.
3. Remove obsolete worktree and branch resource assertions from integration tests.
4. Add one domain integration flow for builder completion, verifier findings, owner code fixes, and a second verifier run on the same branch.
5. Add one domain integration flow for a blocked spec revision that keeps the same `specId`, branch, and artifacts.
6. Add one integration flow proving the verifier tool commits only protocol files.
7. Add one final-review flow that commits `final-review` and returns Pull Request facts without staging or squash.
8. Run the package checks and remove temporary files created by the tests.

## Tests

Run:

```text
npm run check
npm pack --dry-run
```

Inspect the package file list and confirm that no worktree directory, obsolete branch fixture, or temporary repository is included.

## Completion criteria

- Shared test support uses one current branch and checkout.
- The core builder, verifier, revision, findings, and final-review flows pass together.
- No obsolete worktree or branch model remains in the code or tests covered by this task.
- The package checks pass before Task 35 starts.
