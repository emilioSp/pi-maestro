STATUS: DONE

# Task mvp_02: Add the current-branch spec revision flow

## Dependency

This task depends on `mvp_01_remove_worktree_and_branch_model.md`.

## Objective

Allow the owner to approve a changed contract in the same workflow, spec ID, and current branch.

## Plan references

- Sections [3.2](../plan.md#plan-section-3-2), [3.5](../plan.md#plan-section-3-5), and [3.6](../plan.md#plan-section-3-6)
- Sections [6.10](../plan.md#plan-section-6-10) and [6.14](../plan.md#plan-section-6-14)

## Work

1. Allow `MARK_SPEC_READY` from `drafting-spec`, `escalation-decision`, and `findings-decision`. All paths lead to `ready-for-builder`. `builder-failed` remains a sink.
2. Reuse `maestro_mark_spec_ready`. Do not add a revision phase, tool, spec ID, or `specRevision` field.
3. Do not compare spec content or delete old artifacts. Git history preserves previous specs and decisions; the next pass treats obsolete blockers as historical.
4. Keep spec revision approval separate from builder failure handling. A failed builder stops the workflow; the owner must commit the approved `spec.md` and `workflow.json` before a new builder launch from an authorized revision phase.

## Tests

Cover:

- revision approval from each of the two authorized blocked phases;
- rejection from running, ready, candidate, and final phases;
- unchanged spec content accepted by the tool;
- the same `specId` and current checkout after revision;
- rejection of an uncommitted approved state by the next builder launch.

## Completion criteria

- A blocked workflow can return to `ready-for-builder` through `maestro_mark_spec_ready`.
- Technical builder failures do not return to `ready-for-builder`; they remain terminal.
- No new workflow phase, persistent revision field, or artifact history is introduced.
