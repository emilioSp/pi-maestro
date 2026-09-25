STATUS: TODO

# Task mvp_06: Verify final review on the current checkout

## Dependency

This task depends on `mvp_01_remove_worktree_and_branch_model.md` and `mvp_04_rework_verifier_for_current_checkout.md`.

## Objective

Conclude a verified workflow on the current checkout and return the facts needed for the owner's Pull Request.

The Pi tool adapter belongs to Task 42.

## Plan references

- Sections [3.7](../plan.md#plan-section-3-7) and [3.8](../plan.md#plan-section-3-8)
- Sections [6.10](../plan.md#plan-section-6-10), [6.14](../plan.md#plan-section-6-14), [6.17](../plan.md#plan-section-6-17), [6.24](../plan.md#plan-section-6-24), and [6.25](../plan.md#plan-section-6-25)

## Work

1. Require `candidate-ready`, the matching verifier handoff, and no active findings.
2. Require a clean current checkout and use the current `HEAD` as the candidate. Do not persist a separate candidate SHA.
3. Transition the workflow to `final-review` and commit only `workflow.json` on the current branch.
4. Return the current branch, candidate commit, final-review commit, final phase, and neutral Pull Request guidance. The owner chooses the merge method.
5. Keep `final-review` terminal. Do not push, open a Pull Request, squash, stage unrelated files, manage branches, manage worktrees, or clean up resources.
6. Keep obsolete squash, staging, branch, worktree, and cleanup helpers out of the workflow.

Do not implement the Pi tool adapter here. Task 42 owns its schema, registration, and result mapping.

## Tests

Cover:

- successful final review on the current checkout;
- current `HEAD` returned as the candidate;
- active verifier findings rejected;
- dirty checkout rejected;
- a final-review commit containing only `workflow.json`;
- returned Pull Request facts and neutral merge guidance;
- a second final-review call rejected;
- clean checkout after the final-review commit.

## Completion criteria

- Final review has no branch, worktree, squash, staging, or resource-cleanup dependency.
- Success commits only `workflow.json` in `final-review` and leaves the checkout clean.
- Success returns the facts needed to open a Pull Request.
- A completed workflow cannot be reopened or extended.
- Pi adapter work remains scoped to Task 42.
