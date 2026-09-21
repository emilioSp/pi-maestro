STATUS: TODO

# Task 29: Implement Maestro checks and activation

## Dependency

This task depends on Task 28: Integrate pi-subagents.

## Objective

Activate Maestro only after complete read-only environment checks.

## Plan references

- Section [2.7](../plan.md#plan-section-2-7)
- Section [5](../plan.md#plan-section-5), `src/maestro/checks.ts` and `src/maestro/activation.ts`
- Sections [6.3](../plan.md#plan-section-6-3), [6.7](../plan.md#plan-section-6-7), [6.20](../plan.md#plan-section-6-20), [6.21](../plan.md#plan-section-6-21), [6.22](../plan.md#plan-section-6-22), and [6.26](../plan.md#plan-section-6-26)

## Work

1. Check Git repository, trust, pi-subagents, agents, configuration, models, safe directories, and readable workflow state.
2. Stop at the first failed check and return one clear activation error.
3. Implement the `/maestro` toggle domain behavior.
4. Activate only after all checks pass.
5. Deactivate without changing workflow files, branches, worktrees, or artifacts.
6. Re-run checks on every activation; `/resume` leaves Maestro inactive.
7. Keep startup silent and free of Maestro checks.

## Implementation

Checks must not create `.specs`, `.worktree`, or any other file. A dirty base is allowed during activation. Missing configured directories are valid. Failure leaves Maestro inactive and normal Pi behavior unchanged.

## Tests

Add Vitest tests for every check, first-error behavior, successful activation, failed activation, toggle off, repeated retry, dirty base, absent directories, and proof that the repository tree is unchanged.

## Completion criteria

- Activation is all-or-nothing and read-only.
- No success notification is required.
- Errors contain the exact failed resource or model.
