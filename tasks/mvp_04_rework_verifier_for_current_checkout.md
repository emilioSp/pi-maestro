STATUS: DONE

# Task mvp_04: Verify the verifier workflow on the current checkout

## Dependency

This task depends on `mvp_01_remove_worktree_and_branch_model.md` and `mvp_03_rework_builder_for_current_checkout.md`.

## Objective

Keep verifier domain operations on the owner-selected checkout and branch.

The verifier handoff protocol commit belongs to Task 34. Verifier delegation and Pi response handling belong to Task 40.

## Plan references

- Sections [3.4](../plan.md#plan-section-3-4), [3.7](../plan.md#plan-section-3-7), and [5](../plan.md#plan-section-5)
- Sections [6.11](../plan.md#plan-section-6-11), [6.14](../plan.md#plan-section-6-14), [6.17](../plan.md#plan-section-6-17), and [6.25](../plan.md#plan-section-6-25)

## Work

1. Verify that `prepareVerifierLaunch` requires a committed `ready-for-verifier` state and a clean current checkout.
2. Create the `verifier-running` checkpoint on the current branch and use its parent as the candidate.
3. Keep one current `handoffs/verifier.json`. Do not use verifier pass numbers, branches, worktrees, or resource discovery. Git preserves earlier handoffs.
4. Verify that `completeVerifierPass` compares tracked, staged, unstaged, and untracked product files with the candidate.
5. Allow only `workflow.json` and `handoffs/verifier.json` as protocol changes during the handoff check. Return `PRODUCT_FILES_MODIFIED` without writing protocol files when product changes remain.
6. Keep verifier completion and findings resolution bound to the explicit `specId`, current workflow phase, and current checkout. Findings resolution must not merge or fast-forward branches.

Do not implement the verifier protocol commit here. Task 34 owns that commit.

## Tests

Cover:

- launch from a committed builder candidate;
- the parent of the `verifier-running` checkpoint as candidate;
- clean current-checkout verification;
- no verifier pass number or separate verifier resource;
- staged, unstaged, and untracked product changes;
- rejected product changes with no handoff or workflow write;
- successful verifier completion with the current protocol paths;
- findings resolution on the same branch without merging;
- one current `verifier.json` with earlier versions preserved by Git.

## Completion criteria

- Verifier domain operations have no branch, worktree, pass-number, or resource-discovery dependency.
- The verifier compares product files with the parent of its current checkpoint.
- Product changes produce `PRODUCT_FILES_MODIFIED` without protocol writes.
- Verifier completion and findings resolution use the current checkout and explicit spec identity.
- Verifier protocol commit and Pi delegation remain scoped to their later tasks.
