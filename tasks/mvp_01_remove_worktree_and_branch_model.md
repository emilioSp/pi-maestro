STATUS: DONE

# Task mvp_01: Remove the worktree and operational branch model

## Dependency

This task starts the MVP simplification. It depends on the existing Git, configuration, and path foundations.

## Objective

Make the current Git checkout and current branch the only workspace used by Maestro, builder, and verifier.

## Plan references

- Section [2.6](../plan.md#plan-section-2-6), current branch and checkout
- Section [5](../plan.md#plan-section-5), package structure
- Sections [6.6](../plan.md#plan-section-6-6), [6.14](../plan.md#plan-section-6-14), [6.17](../plan.md#plan-section-6-17), and [6.21](../plan.md#plan-section-6-21)

## Work

1. Remove `worktreeDirectory` from configuration input, resolved configuration, defaults, validation, and configuration tests.
2. Remove worktree path methods and operational branch name methods from `MaestroPaths`.
3. Make all Maestro paths resolve from the current repository checkout.
4. Remove workflow use of worktree creation, lookup, removal, and role-specific branch creation.
5. Remove workflow-specific worktree assertions and cleanup resources. Keep generic Git helpers only when another current-branch operation still needs them.
6. Remove `baseBranch` from `workflow.json` and from every domain input, output, and test that only supported local squash.
7. Do not add branch identity enforcement. Trust the owner to keep the intended checkout active; each operation uses the current checkout directly.
8. Update Git status checks to inspect the current checkout without a worktree exclusion.
9. Remove obsolete worktree and operational-branch fixtures and tests.
10. Keep all workflow commits on the current branch.

## Tests

Add or update integration tests with temporary repositories for:

- no worktree directory creation;
- no operational branch creation or deletion;
- all workflow paths resolving from one checkout;
- current-checkout dirty-state handling;
- `workflow.json` without `baseBranch`;
- configured path validation with only `specDirectory`.

## Completion criteria

- The configuration schema has no `worktreeDirectory` field.
- `workflow.json` has no `baseBranch` field.
- No workflow operation creates, switches, or removes branches or worktrees.
- No workflow operation depends on a role-specific branch or worktree path.
- The affected unit and integration tests pass.
