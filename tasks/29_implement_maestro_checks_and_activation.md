STATUS: TODO

# Task 29: Implement Maestro checks and activation

## Dependency

This task depends on Task 27: Write the builder and verifier agents.

## Objective

Validate the environment before Maestro activation.

## Plan references

- Section [2.7](../plan.md#plan-section-2-7)
- Section [5](../plan.md#plan-section-5), `src/maestro/checks/`
- Sections [6.7](../plan.md#plan-section-6-7), [6.20](../plan.md#plan-section-6-20), [6.21](../plan.md#plan-section-6-21), [6.22](../plan.md#plan-section-6-22), and [6.26](../plan.md#plan-section-6-26)

## Work

1. Check Git repository, trust, pi-subagents, agents, configuration, models, and safe directories.
2. Stop at the first failed check and return one clear activation error.
3. Re-run checks on every activation; `/resume` leaves Maestro inactive.
4. Keep startup silent and free of Maestro checks.

## Implementation

Checks must not create `.specs`, `.worktree`, or any other file. A dirty base is allowed during activation. Missing configured directories are valid. Failure leaves Maestro inactive and normal Pi behavior unchanged.

Use `pi-subagents/preflight` directly in `src/maestro/checks/` for agent launch checks. Put environment checks under `src/maestro/checks/`. Give each exported function its own module. Keep private helpers with the function they serve, and import modules directly without a barrel. Place tests beside their main module. Do not add parallel implementations.

## Tests

Add Vitest tests for every check, first-error behavior, dirty base, absent directories, and proof that the repository tree is unchanged.

## Completion criteria

- Environment checks are all-or-nothing and read-only.
- Activation never discovers or reconciles a persisted workflow.
- No success notification is required.
- Errors contain the exact failed resource or model.
