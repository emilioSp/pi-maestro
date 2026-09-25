STATUS: TODO

# Task mvp_03: Rework the builder workflow for the current checkout

## Dependency

This task depends on `mvp_01_remove_worktree_and_branch_model.md` and `mvp_02_add_current_branch_spec_revision_flow.md`.

## Objective

Run every builder operation on the current checkout and current branch without creating or locating builder resources.

## Plan references

- Sections [3.3](../plan.md#plan-section-3-3) and [5](../plan.md#plan-section-5)
- Sections [6.11](../plan.md#plan-section-6-11), [6.14](../plan.md#plan-section-6-14), [6.17](../plan.md#plan-section-6-17), [6.19](../plan.md#plan-section-6-19), [6.22](../plan.md#plan-section-6-22), and [6.23](../plan.md#plan-section-6-23)

## Work

1. Rewrite `prepareBuilderLaunch` to validate the current checkout and workflow phase without branch or worktree resources.
2. Require an owner-committed `ready-for-builder` state before the first builder launch and after every spec revision.
3. Keep retry explicit from `builder-running` or `builder-failed` where the state machine allows it.
4. Create the `builder-running` checkpoint on the current branch before delegation.
5. Calculate the live `spec.md` SHA-256 from the current checkout immediately before delegation.
6. Recalculate and replace the live baseline for an explicit retry or after an approved spec revision.
7. Keep builder implementation commits on the current branch. The builder handoff tool writes protocol files; the builder commits the implementation, handoff, and workflow state with Bash.
8. Rewrite builder completion and escalation operations to use the current checkout and explicit `specId` input.
9. Keep the builder spec protection and protocol SHA checks independent from branch names and worktree paths.
10. Preserve distinct done, failed, escalation, timeout, interruption, and protocol-error results.

## Tests

Add or update integration tests for:

- first launch on an arbitrary current branch;
- explicit retry after builder failure;
- retry after a spec revision;
- dirty staged, unstaged, and untracked current-checkout changes;
- live SHA initialization and replacement;
- builder completion and escalation on the current checkout;
- no branch or worktree creation;
- committed builder checkpoints and terminal artifacts.

## Completion criteria

- Builder launch has no worktree or operational-branch dependency.
- Every builder checkpoint is committed on the current branch.
- The live spec baseline is calculated from the current checkout.
- Builder completion and escalation use the explicit spec identity and current workflow state.
- The affected builder tests pass.
