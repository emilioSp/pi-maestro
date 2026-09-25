STATUS: TODO

# Task mvp_06: Rework final review for Pull Request delivery

## Dependency

This task depends on `mvp_01_remove_worktree_and_branch_model.md`, `mvp_02_add_current_branch_spec_revision_flow.md`, and `mvp_04_rework_verifier_for_current_checkout.md`.

## Objective

Conclude a verified workflow on the current branch and deliver it to the owner for a Pull Request.

## Plan references

- Sections [3.7](../plan.md#plan-section-3-7) and [3.8](../plan.md#plan-section-3-8)
- Sections [6.10](../plan.md#plan-section-6-10), [6.14](../plan.md#plan-section-6-14), [6.17](../plan.md#plan-section-6-17), [6.19](../plan.md#plan-section-6-19), [6.24](../plan.md#plan-section-6-24), and [6.25](../plan.md#plan-section-6-25)

## Work

1. Require `candidate-ready` and a clean current checkout.
2. Use the current `HEAD` as the candidate. Do not persist a separate candidate SHA.
3. Verify the current verifier handoff and ensure no finding remains active.
4. Remove local squash, staging, base-branch checks, target-branch checks, and worktree cleanup.
5. Write and commit `workflow.json` in `final-review` on the current branch.
6. Return the current branch, candidate commit, final workflow phase, and Pull Request guidance.
7. Keep the workflow closed after `final-review`.
8. Do not push, open a Pull Request, or wait for owner approval.
9. Remove or retire obsolete final-review helpers and tests that only support squash, staging, or resource cleanup.

## Tests

Add or update integration tests for:

- candidate-ready final review on the current branch;
- current `HEAD` used as candidate;
- dirty checkout rejection;
- missing or active verifier findings;
- final-review checkpoint commit;
- returned Pull Request facts;
- rejection of a second final-review call;
- no squash, staging, branch, or worktree cleanup.

## Completion criteria

- Final review operates only on the current checkout and branch.
- Success commits `workflow.json` in `final-review` and leaves the checkout clean.
- Success returns the facts needed to open a Pull Request.
- Maestro does not manage the owner’s Pull Request or merge.
