STATUS: TODO

# Task mvp_02: Add the current-branch spec revision flow

## Dependency

This task depends on `mvp_01_remove_worktree_and_branch_model.md`.

## Objective

Allow the owner to revise the active spec in the same workflow and branch when a blocked builder or verifier decision shows that the contract must change.

## Plan references

- Sections [3.2](../plan.md#plan-section-3-2), [3.5](../plan.md#plan-section-3-5), and [3.6](../plan.md#plan-section-3-6)
- Sections [6.10](../plan.md#plan-section-6-10), [6.14](../plan.md#plan-section-6-14), [6.23](../plan.md#plan-section-6-23), and [6.25](../plan.md#plan-section-6-25)

## Work

1. Keep `drafting-spec` for the initial spec only. Do not add a separate spec-revision phase or tool.
2. Allow `maestro_mark_spec_ready` from the initial `drafting-spec` phase and from `builder-failed`, `escalation-decision`, and `findings-decision`.
3. Make every allowed `maestro_mark_spec_ready` call transition to `ready-for-builder`.
4. Do not compare the current `spec.md` content with an earlier version. The tool checks only the allowed phase and file existence.
5. Keep the same `specId` and current branch for a spec revision.
6. Make a revision from `escalation-decision` or `findings-decision` supersede the active blocker. Do not require a separate escalation resolution or finding decision.
7. Keep `workflow.json` limited to its existing workflow fields. Do not add `specRevision` or a spec history field.
8. Keep earlier specs, handoffs, findings, and escalations in Git history. The current files remain available as context.
9. Ensure the owner still commits the approved `spec.md` and `workflow.json` before the next builder launch.
10. Keep ordinary code-fix retry behavior separate from the spec revision flow.

## Tests

Add or update integration tests for:

- initial `drafting-spec` to `ready-for-builder`;
- `builder-failed` to `ready-for-builder` after owner re-approval;
- `escalation-decision` to `ready-for-builder` without resolving the old escalation;
- `findings-decision` to `ready-for-builder` without resolving obsolete findings;
- rejection from `ready-for-builder`, `candidate-ready`, running phases, and `final-review`;
- unchanged `spec.md` accepted because content comparison is not part of the tool;
- the same `specId` and current checkout used after revision;
- owner commit required before the next builder launch.

## Completion criteria

- A blocked workflow can return directly to `ready-for-builder` through `maestro_mark_spec_ready`.
- No separate revision phase, spec ID, or spec revision field exists.
- Old blocking artifacts remain in Git and no longer block the revised workflow.
- The initial approval and revision approval use the same owner commit rule.
