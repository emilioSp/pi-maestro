STATUS: TODO

# Task 32: Add the builder handoff tool

## Dependency

This task depends on Task 30: Implement Maestro session, instructions, and status.

## Objective

Expose the child-only terminal tool for builder done and failed handoffs.

## Plan references

- Sections [3.3](../plan.md#plan-section-3-3) and [5](../plan.md#plan-section-5), `src/tools/child/record-builder-handoff.ts`
- Sections [6.10](../plan.md#plan-section-6-10), [6.11](../plan.md#plan-section-6-11), [6.14](../plan.md#plan-section-6-14), and [6.15](../plan.md#plan-section-6-15)

## Work

1. Define the closed TypeBox input schema for done and failed handoffs.
2. Derive protocol identity and the terminal revision from current state.
3. Verify protected protocol files against the launch checkpoint.
4. Validate the terminal handoff.
5. Write the current builder handoff and next workflow state in one domain operation.
6. Return instructions that the child must commit both files together.

## Implementation

Move done to `ready-for-verifier` and failed to `builder-failed`. Do not commit from the tool. Reject a second terminal handoff. Keep the schema, one exported Pi tool registration, domain call, and result conversion in `src/tools/child/record-builder-handoff.ts`. Do not export other operations from this tool file.

## Tests

Add Vitest adapter tests for done and failed input schemas, derived protocol fields, one successful call, and one propagated domain error.

## Completion criteria

- A valid terminal call leaves handoff and state ready for one child commit.
- Direct protocol tampering blocks the handoff.
- Failed validation preserves both previous files.
