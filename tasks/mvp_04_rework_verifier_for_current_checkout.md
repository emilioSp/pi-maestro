STATUS: TODO

# Task mvp_04: Rework the verifier workflow for the current checkout

## Dependency

This task depends on `mvp_01_remove_worktree_and_branch_model.md` and `mvp_03_rework_builder_for_current_checkout.md`.

## Objective

Run the verifier on the current checkout, use Git to identify the candidate, and keep one current verifier handoff.

## Plan references

- Sections [3.4](../plan.md#plan-section-3-4), [3.7](../plan.md#plan-section-3-7), and [5](../plan.md#plan-section-5)
- Sections [6.11](../plan.md#plan-section-6-11), [6.14](../plan.md#plan-section-6-14), [6.17](../plan.md#plan-section-6-17), [6.19](../plan.md#plan-section-6-19), and [6.25](../plan.md#plan-section-6-25)

## Work

1. Rewrite `prepareVerifierLaunch` to require a committed `ready-for-verifier` state on the current checkout.
2. Commit the `verifier-running` checkpoint on the current branch before delegation.
3. Define the candidate for the verifier as the parent of the current `HEAD` checkpoint.
4. Remove verifier pass numbers, verifier branches, verifier worktrees, and resource discovery.
5. Keep exactly one current `handoffs/verifier.json`. Let Git preserve earlier handoffs.
6. Rewrite verifier completion to compare tracked, staged, unstaged, and untracked product files with the parent of the `verifier-running` checkpoint.
7. Allow only `workflow.json` and `handoffs/verifier.json` to change during a successful verifier handoff.
8. Return `PRODUCT_FILES_MODIFIED` without writing or committing protocol files when product changes remain.
9. On success, write the verifier handoff and workflow state and commit only those protocol files through the child tool.
10. Rewrite findings resolution to operate on the current checkout without fast-forward or branch merges.
11. Keep the current `specId` explicit in every verifier operation.
12. Preserve the rule that verifier observations are findings, not owner decisions or product fixes.

## Tests

Add or update integration tests for:

- verifier launch from a committed builder candidate;
- the parent of the `verifier-running` checkpoint as candidate;
- no verifier pass number or separate verifier resource;
- clean current-checkout verification;
- staged, unstaged, and untracked product changes;
- successful tool-managed verifier commit containing only protocol files;
- rejected product changes with no handoff or state write;
- findings resolution on the same branch;
- one `verifier.json` with earlier versions preserved by Git.

## Completion criteria

- Verifier launch has no worktree, branch, or pass-number dependency.
- The verifier compares the product with the parent of the `verifier-running` checkpoint.
- The verifier cannot create a product commit through the handoff flow.
- A successful verifier handoff commits only verifier protocol files.
- Findings resolution never performs a branch merge or fast-forward.
