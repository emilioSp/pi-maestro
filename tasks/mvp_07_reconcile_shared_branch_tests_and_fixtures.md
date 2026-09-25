STATUS: DONE

# Task mvp_07: Add the shared-branch findings flow

## Dependency

This task depends on `mvp_03_rework_builder_for_current_checkout.md` and `mvp_04_rework_verifier_for_current_checkout.md`.

## Objective

Verify the builder, verifier, and owner code-fix cycle on one current checkout and branch.

Spec revision, verifier protocol commits, final review, prompts, and Pi adapters are covered by their own tasks.

## Plan references

- Sections [1](../plan.md#plan-section-1), [3](../plan.md#plan-section-3), and [5](../plan.md#plan-section-5)
- Sections [6.14](../plan.md#plan-section-6-14), [6.17](../plan.md#plan-section-6-17), [6.19](../plan.md#plan-section-6-19), and [6.25](../plan.md#plan-section-6-25)

## Work

1. Verify that `test/support` uses one current checkout and branch. Remove only actual obsolete worktree or operational-branch assumptions; do not audit descriptive documentation handled by other tasks.
2. Add one domain integration flow:
   - builder completes;
   - verifier records a finding;
   - owner requests `fix-code`;
   - builder runs again and completes;
   - verifier runs again on the same checkout and branch.
3. Assert that the flow keeps the same `specId`, current repository root, branch, and valid workflow revisions and handoffs.
4. Keep the existing fake subagent support generic. Do not add workflow-specific resource fixtures.
5. Run the package checks and inspect the package file list.

Do not duplicate the spec revision, verifier protocol commit, final review, prompt, or Pi adapter tests owned by other tasks.

## Tests

Cover:

- the complete findings-to-code-fix cycle on the current checkout;
- a second builder and verifier checkpoint on the same branch;
- current `specId` and artifact paths across both verifier runs;
- no branch or worktree resource creation;
- `npm run check`;
- `npm pack --dry-run`.

## Completion criteria

- Shared test support has no active worktree or operational-branch dependency.
- The builder, verifier, findings, and code-fix flow passes on one checkout and branch.
- The second verifier run uses the new builder result and preserves the workflow identity.
- Package checks pass before Task 35 starts.
