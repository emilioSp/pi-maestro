STATUS: TODO

# Task 43: Register the main Maestro extension

## Dependency

This task depends on Task 42: Add the prepare-final-review tool.

## Objective

Wire the main Pi extension without moving domain logic into the composition root.

## Plan references

- Sections [2.7](../plan.md#plan-section-2-7) and [5](../plan.md#plan-section-5), `extensions/maestro.ts` and `src/tools/main/`
- Sections [6.2](../plan.md#plan-section-6-2), [6.3](../plan.md#plan-section-6-3), [6.10](../plan.md#plan-section-6-10), [6.13](../plan.md#plan-section-6-13), and [6.20](../plan.md#plan-section-6-20)

## Work

1. Export and register all eight main tools exactly once.
2. Register the `/maestro` toggle.
3. Register only the required session, resume, instruction, status, and tool-activation events.
4. Activate main Maestro tools only after successful checks.
5. Remove only main Maestro tools on deactivation.
6. Show activation errors through `ctx.ui.notify(..., "error")`.
7. Leave Maestro inactive after resume.
8. Keep startup silent and inactive.

## Implementation

`extensions/maestro.ts` is wiring only. Call modules under `src/maestro/` and `src/tools/main/`. Do not register child tools. Preserve generic tools and tools from other extensions.

## Tests

Add Vitest integration tests with a fake Pi registration context. Cover startup, activation, failed activation, toggle off, exact tool set changes, preserved foreign tools, instructions, status, error notification, inactive resume, and one-time registration.

## Completion criteria

- Main tools are usable only in active Maestro mode.
- Child tools never appear in the owner session.
- The composition root contains no workflow implementation.
