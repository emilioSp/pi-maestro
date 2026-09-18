STATUS: TODO

# Task 33: Add the open escalation tool

## Dependency

This task depends on Task 32: Add the builder handoff tool.

## Objective

Expose the child-only terminal tool that opens a builder escalation.

## Plan references

- Section [3.5](../plan.md#plan-section-3-5)
- Section [5](../plan.md#plan-section-5), `src/tools/child/open-escalation.ts`
- Sections [6.10](../plan.md#plan-section-6-10), [6.11](../plan.md#plan-section-6-11), [6.14](../plan.md#plan-section-6-14), and [6.15](../plan.md#plan-section-6-15)

## Work

1. Define the closed TypeBox input schema without protocol identity fields.
2. Derive spec ID, next escalation ID, and terminal revision.
3. Require valid options and an optional valid recommendation.
4. Verify protected files against the builder launch checkpoint.
5. Create the escalation with `resolution: null`.
6. Write `awaiting-escalation` in the same domain operation.
7. Return instructions to commit escalation and state together and then stop.

## Implementation

Do not write observations or a builder handoff. Do not wait for the owner. Reject calls outside `builder-running` and reject a second terminal outcome for the pass.

## Tests

Add Vitest adapter tests for first and later IDs, valid and null recommendation, invalid option references, wrong phase, existing terminal outcome, protected-file tampering, no observation creation, and no partial write.

## Completion criteria

- An escalation is a terminal builder outcome.
- Identity and numbering cannot be supplied by the child.
- The active escalation is committed before the builder ends.
