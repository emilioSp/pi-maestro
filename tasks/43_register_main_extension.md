STATUS: TODO

# Task 43: Register the main Maestro extension

## Dependency

This task depends on Tasks 29, 30, and 42. All `mvp_*` foundation tasks must also be complete.

## Objective

Wire the main Pi extension without moving domain logic into the composition root.

## Plan references

- Sections [2.7](../plan.md#plan-section-2-7) and [5](../plan.md#plan-section-5), `extensions/maestro.ts` and `src/tools/main/`
- Sections [6.2](../plan.md#plan-section-6-2), [6.3](../plan.md#plan-section-6-3), [6.10](../plan.md#plan-section-6-10), [6.13](../plan.md#plan-section-6-13), and [6.20](../plan.md#plan-section-6-20)

## Work

1. Register the seven main tools once. Import each directly from `src/tools/main/`. Give the launch tools access to `pi.events`.
2. Implement and register `/maestro`:
   - If Maestro is off, run all Task 29 checks. If they pass, turn Maestro on and enable its tools, instructions, and status. If a check fails, leave Maestro off and show the error with `ctx.ui.notify(..., "error")`.
   - If Maestro is on, turn it off and hide its tools, instructions, and status. Do not change the current branch, workflow files, or artifacts.
   - Run all checks again each time `/maestro` turns Maestro on.
3. Leave Maestro off after `/resume`. Do not run Maestro checks or show Maestro notifications at startup.
4. Register only the session, resume, instruction, status, and tool-activation events that this behavior needs.
5. Use the shared `MaestroSessionState` instance that the child extension reads in the foreground runtime.
6. Do not add branch or worktree management to the extension.

## Implementation

Keep `extensions/maestro.ts` as wiring only. Import operations directly from `src/maestro/` or `src/tools/main/`. Do not add a barrel. Tool files own their input schema, Pi registration, domain call, and result conversion. Do not register child tools. Leave generic tools and tools from other extensions unchanged.

## Tests

Add Vitest integration tests with a fake Pi context. Test startup, activation, failed activation, deactivation, expected SHA clearing, builder failure reporting, spec revision approval, tool changes, preserved foreign tools, instructions, status, error notifications, inactive resume, current-branch behavior, and one-time registration.

## Completion criteria

- Maestro turns on only after all Task 29 checks pass.
- Main tools are usable only while Maestro is on.
- Child tools never appear in the owner session.
- `extensions/maestro.ts` contains no workflow logic.
- The extension does not create or manage branches or worktrees.
