STATUS: TODO

# Task 30: Implement Maestro session, instructions, and status

## Dependency

This task depends on Task 29: Implement Maestro checks and activation.

## Objective

Keep Maestro mode visible and resumable without making session state authoritative.

## Plan references

- Section [5](../plan.md#plan-section-5), `src/maestro/session.ts`, `instructions.ts`, and `status.ts`
- Sections [3.1](../plan.md#plan-section-3-1), [6.3](../plan.md#plan-section-6-3), [6.9](../plan.md#plan-section-6-9), [6.13](../plan.md#plan-section-6-13), [6.14](../plan.md#plan-section-6-14), and [6.20](../plan.md#plan-section-6-20)

## Work

1. Persist whether Maestro mode was active when the Pi session was suspended.
2. Restore mode after `/resume` only after activation checks and reconciliation pass.
3. Build Maestro instructions for authority, owner dialogue, semantic spec review, tool use, and no normal product edits.
4. Build status text for active mode, current spec ID, phase, and blocking state.
5. Hide Maestro status and instructions while mode is inactive.
6. Treat session entries as UI cache only.
7. Keep `src/maestro/index.ts` as an export barrel.

## Implementation

Do not put workflow truth only in session state. Instructions must tell the LLM to wait for explicit owner decisions and use deterministic tools for mutations. They must also explain that final-review is concluded.

## Tests

Add Vitest tests for inactive state, active state without a workflow, each phase label, blocking reconciliation, suspend and resume, failed resume checks, completed final review, and no repository mutation.

## Completion criteria

- UI state always follows successful activation.
- Resume cannot bypass repository reconciliation.
- The instruction text agrees with the owner, builder, and verifier authority model.
