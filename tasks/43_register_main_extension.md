STATUS: TODO

# Task 43: Register the main Maestro extension

## Dependency

This task depends on Task 29
This task depends on Task 42: Add the prepare-final-review tool.

## Objective

Wire the main Pi extension without moving domain logic into the composition root.

## Plan references

- Sections [2.7](../plan.md#plan-section-2-7) and [5](../plan.md#plan-section-5), `extensions/maestro.ts` and `src/tools/main/`
- Sections [6.2](../plan.md#plan-section-6-2), [6.3](../plan.md#plan-section-6-3), [6.10](../plan.md#plan-section-6-10), [6.13](../plan.md#plan-section-6-13), and [6.20](../plan.md#plan-section-6-20)

## Work

1. Import each of the eight main tool registrations directly from its file in `src/tools/main/` and register it once. Give the launch tool registrations access to the injected `pi.events`. Do not add a tool barrel.
2. Implement and register the `/maestro` toggle. When inactive, run the Task 29 environment checks before activation. When active, deactivate without changing workflow files, branches, worktrees, or artifacts.
3. Register only the required session, resume, instruction, status, and tool-activation events.
4. Activate main Maestro tools only after successful checks, and rerun checks on every activation.
5. Remove only main Maestro tools on deactivation.
6. Show activation errors through `ctx.ui.notify(..., "error")`.
7. Leave Maestro inactive after resume.
8. Keep startup silent and inactive.

## Implementation

`extensions/maestro.ts` is wiring only. Import each operation directly from its module under `src/maestro/` or `src/tools/main/`; do not add a barrel. Each tool file owns only its input schema, Pi registration, domain call, and result conversion. Do not register child tools. Preserve generic tools and tools from other extensions.

## Tests

Add Vitest integration tests with a fake Pi registration context. Cover startup, activation, failed activation, toggle off, retry after failed activation, exact tool set changes, preserved foreign tools, instructions, status, error notification, inactive resume, and one-time registration.

## Completion criteria

- Activation runs the complete Task 29 checks and succeeds only when all checks pass.
- Main tools are usable only in active Maestro mode.
- Child tools never appear in the owner session.
- The composition root contains no workflow implementation.
