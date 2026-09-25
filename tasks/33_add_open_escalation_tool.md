STATUS: DONE

# Task 33: Add the open-escalation tool

## Dependency

This task depends on Task 32: Add the builder handoff tool.

## Objective

Let the builder end its pass by asking the owner to make an escalation decision.

## Plan references

- Section [3.5](../plan.md#plan-section-3-5)
- Section [5](../plan.md#plan-section-5), `src/tools/child/open-escalation.ts`
- Sections [6.10](../plan.md#plan-section-6-10), [6.11](../plan.md#plan-section-6-11), [6.14](../plan.md#plan-section-6-14), and [6.15](../plan.md#plan-section-6-15)

## Work

1. Define a closed TypeBox input schema. Do not include protocol identity fields.
2. Get the spec ID, next escalation ID, and final revision from the current workflow state.
3. Require valid options. If the builder gives a recommendation, it must also be valid.
4. Compare the current `spec.md` SHA-256 with the expected value in the shared live Maestro session state.
5. Create the escalation with `resolution: null`.
6. In the same domain operation, move the workflow to `escalation-decision`.
7. Tell the builder to use Bash and Git to commit the escalation and workflow state with its current work, then stop.

## Implementation

Do not write a builder handoff or wait for the owner. Read the expected SHA through the shared session state; do not pass it through the tool input. The tool does not commit; the builder uses Bash and Git to commit the escalation and workflow state with its current work. Reject calls outside `builder-running`. Reject a second final outcome for the same pass.

## Tests

Add Vitest adapter tests for input validation, protocol fields read from workflow state, one successful call, and one domain error returned to the tool caller.

## Completion criteria

- A missing or changed expected SHA blocks the escalation. An escalation ends the builder's pass.
- The child cannot choose the spec ID or escalation number.
- The active escalation is committed before the builder stops.
