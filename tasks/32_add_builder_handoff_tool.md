STATUS: TODO

# Task 32: Add the builder handoff tool

## Dependency

This task depends on Task 30: Implement Maestro session, instructions, and status.

## Objective

Let the builder record its final result as done or failed through a child-only tool.

## Plan references

- Sections [3.3](../plan.md#plan-section-3-3) and [5](../plan.md#plan-section-5), `src/tools/child/record-builder-handoff.ts`
- Sections [6.10](../plan.md#plan-section-6-10), [6.11](../plan.md#plan-section-6-11), [6.14](../plan.md#plan-section-6-14), and [6.15](../plan.md#plan-section-6-15)

## Work

1. Define a closed TypeBox input schema for done and failed handoffs. Reject unknown fields.
2. Get the protocol identity and final revision from the current workflow state. Do not take them from the tool input.
3. Check protected protocol files against the checkpoint recorded when the builder started.
4. Validate the final handoff.
5. In one domain operation, write the current builder handoff and the next workflow state.
6. Tell the builder to use Bash and Git to commit the implementation, handoff, and workflow state together.

## Implementation

A done handoff moves the workflow to `ready-for-verifier`. A failed handoff moves it to `builder-failed`. The tool writes the handoff and workflow state but does not commit. The builder uses Bash and Git to commit them with its implementation. Reject a second final handoff for the same pass.

Keep the schema, one exported Pi tool registration, domain call, and result conversion in `src/tools/child/record-builder-handoff.ts`. Do not export other operations from this file.

## Tests

Add Vitest adapter tests for both input schemas, protocol fields read from workflow state, one successful call, and one domain error returned to the tool caller.

## Completion criteria

- A valid final call leaves the handoff and workflow state ready for one child commit.
- Direct changes to protected protocol files block the handoff.
- Failed validation leaves both previous files unchanged.
