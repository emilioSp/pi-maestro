STATUS: DONE

# Task 30: Implement Maestro session, instructions, and status

## Dependency

This task depends on Task 29: Implement Maestro checks and activation.

## Objective

Keep Maestro mode visible without making session state authoritative.

## Plan references

- Section [5](../plan.md#plan-section-5), `src/maestro/session/`, `src/maestro/instructions/`, and `src/maestro/status/`
- Sections [3.1](../plan.md#plan-section-3-1), [6.3](../plan.md#plan-section-6-3), [6.9](../plan.md#plan-section-6-9), [6.13](../plan.md#plan-section-6-13), [6.14](../plan.md#plan-section-6-14), and [6.20](../plan.md#plan-section-6-20)

## Work

1. Keep the current Maestro activation state, active spec ID, and expected `spec.md` SHA-256 in the live session only.
2. Leave Maestro inactive after `/resume` and expose session-state operations for later activation.
3. Do not implement or register the `/maestro` toggle here. Task 43 wires the command to Task 29 checks and session state.
4. Build Maestro instructions for authority, owner dialogue, semantic spec review, tool use, and no normal product edits.
5. Build status text for active mode, current spec ID, and phase.
6. Hide Maestro status and instructions while mode is inactive.
7. Treat session entries as UI cache only.
8. Import Maestro modules directly through `#maestro/*` without an export barrel.

## Implementation

Do not put workflow truth only in session state. Instructions must tell the LLM to wait for explicit owner decisions and use deterministic tools for mutations. They must also explain that final-review is concluded.

Put session state, instructions, and status in their matching directories under `src/maestro/`. Give each exported function its own module. Keep private helpers with the function they serve, and import modules directly without a barrel. Place tests beside their main module. Remove the unused `src/maestro/session.ts`, `src/maestro/instructions.ts`, and `src/maestro/status.ts` placeholders; do not add parallel implementations.

## Tests

Add Vitest tests for inactive state, active state without a live spec, SHA set/get, SHA replacement, reset through `deactivate()` and `clearActiveSpecId()`, each phase label, inactive state after resume, completed final review, and no repository mutation.

## Completion criteria

- Session state supports inactive and active modes with an optional live spec ID and nullable expected spec SHA; callers activate it only after checks pass.
- Deactivation and `/resume` clear the live spec ID and expected SHA without reading or changing persisted workflow files.
- Resume always starts inactive. Task 43 wires reactivation through the normal `/maestro` checks.
- The instruction text agrees with the owner, builder, and verifier authority model.
