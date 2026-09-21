STATUS: TODO

# Task 28: Integrate pi-subagents

## Dependency

This task depends on Task 27: Write the builder and verifier agents.

## Objective

Use only the public pi-subagents APIs for preflight and foreground launches.

## Plan references

- Sections [2.1](../plan.md#plan-section-2-1) and [5](../plan.md#plan-section-5), `src/subagents/`
- Sections [6.7](../plan.md#plan-section-6-7) through [6.11](../plan.md#plan-section-6-11), [6.17](../plan.md#plan-section-6-17), [6.19](../plan.md#plan-section-6-19), [6.20](../plan.md#plan-section-6-20), and [6.26](../plan.md#plan-section-6-26)

## Work

1. Implement availability and agent checks in `src/subagents/preflight.ts`.
2. Verify the active owner extension is pi-subagents 0.68.0 or later.
3. Verify both qualified agents and configured models are available and authenticated.
4. Implement foreground launch contracts in `src/subagents/delegation.ts`.
5. Pass configured model, thinking, timeout, fresh context, worktree cwd, and workflow revision explicitly.
6. Use the foreground result and timeout behavior provided by the public API.
7. Import the Maestro integration directly through `#subagents/*` without an export barrel.

## Implementation

Import only `pi-subagents/delegation` and `pi-subagents/preflight` public APIs. Do not load the nested extension from Maestro's manifest. Do not fall back to the current model or another agent. A launch timeout is not a completed pass.

## Tests

Use the fake subagent support to test missing extension, old version, missing agent, unavailable model, unauthenticated model, successful foreground result, timeout, workflow revision validation, and repeated launches.

## Completion criteria

- All launch failures are precise and leave workflow recovery possible.
- No private pi-subagents module is imported.
- Each pass receives its complete timeout.
