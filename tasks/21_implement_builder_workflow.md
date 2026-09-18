STATUS: TODO

# Task 21: Implement the builder workflow

## Dependency

This task depends on Task 20: Implement the spec workflow.

## Objective

Coordinate builder launch checkpoints and terminal builder outcomes.

## Plan references

- Section [3.3](../plan.md#plan-section-3-3)
- Section [5](../plan.md#plan-section-5), `src/workflow/builder.ts`
- Sections [6.9](../plan.md#plan-section-6-9), [6.10](../plan.md#plan-section-6-10), [6.14](../plan.md#plan-section-6-14), [6.17](../plan.md#plan-section-6-17), [6.19](../plan.md#plan-section-6-19), [6.22](../plan.md#plan-section-6-22), and [6.23](../plan.md#plan-section-6-23)

## Work

1. Validate `ready-for-builder`, the approval commit, base cleanliness, and workflow resources before launch.
2. Create or recover the fixed builder branch and worktree.
3. Write and commit the `builder-running` checkpoint before launch.
4. Support an initial pass, a pass resumed after escalation, a correction pass, and an explicit retry after interruption or failure.
5. Validate observations before accepting a `done` or `failed` handoff.
6. Move atomically to `ready-for-verifier` or `builder-failed` with the terminal handoff.
7. Keep escalation handling outside this module.

## Implementation

Do not install dependencies or invent repository commands. The builder reads applicable `AGENTS.md`. A retry always increments revision and never starts automatically.

## Tests

Add Vitest integration tests for first launch, recovered resources, dirty base, uncommitted approval, running checkpoint commit, done, failed, missing observation, duplicate observation, interrupted retry, correction pass, and unchanged resource state after a blocked launch.

## Completion criteria

- A builder starts only from proven committed state.
- Every pass has a unique revision checkpoint.
- Terminal state and handoff are consistent and committed together by the child.
