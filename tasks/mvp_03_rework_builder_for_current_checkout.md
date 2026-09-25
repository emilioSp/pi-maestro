STATUS: DONE

# Task mvp_03: Verify the builder workflow on the current checkout

## Dependency

This task depends on `mvp_01_remove_worktree_and_branch_model.md` and `mvp_02_add_current_branch_spec_revision_flow.md`.

## Objective

Keep builder domain operations on the owner-selected checkout and branch.

Builder delegation, timeout, interruption, and Pi response handling belong to Task 38.

## Plan references

- Sections [3.3](../plan.md#plan-section-3-3) and [5](../plan.md#plan-section-5)
- Sections [6.11](../plan.md#plan-section-6-11), [6.14](../plan.md#plan-section-6-14), [6.17](../plan.md#plan-section-6-17), [6.22](../plan.md#plan-section-6-22), and [6.23](../plan.md#plan-section-6-23)

## Work

1. Verify that `prepareBuilderLaunch` uses only the current checkout and workflow state. It must not create, locate, validate, or clean branches or worktrees.
2. Keep normal launches limited to `ready-for-builder` and explicit retries limited to `builder-failed`. Do not relaunch from `builder-running`.
3. Create the `builder-running` checkpoint on the current branch and calculate the live `spec.md` SHA immediately before each launch. A launch after a spec revision is a normal launch, not a retry.
4. Keep `completeBuilderPass` and `openBuilderEscalation` bound to the explicit `specId`, current workflow phase, current checkout, and live spec baseline.
5. Keep builder implementation and protocol commits on the current branch. The child tools write protocol files; the builder commits them with its implementation through Bash.

Do not implement Pi delegation or child lifecycle result handling here. Task 38 owns those concerns.

## Tests

Cover:

- first launch and checkpoint on the current branch;
- successful explicit retry after `builder-failed`;
- successful normal launch after an approved spec revision;
- replacement of the live SHA baseline for both cases;
- rejection of staged, unstaged, and untracked checkout changes before launch;
- builder completion and escalation with the explicit spec identity;
- no branch or worktree creation;
- builder handoff and escalation protocol behavior on the current checkout.

## Completion criteria

- Builder domain operations have no branch or worktree dependency.
- Normal launches and retries use the correct workflow phases.
- Every builder launch creates a current-branch checkpoint and a current live spec baseline.
- Builder completion and escalation validate the current workflow and explicit spec identity.
- Delegation lifecycle behavior remains scoped to Task 38.
