STATUS: TODO

# Task 22: Implement the escalation workflow

## Dependency

This task depends on Task 21: Implement the builder workflow.

## Objective

Coordinate builder escalations and explicit owner resolutions.

## Plan references

- Section [3.5](../plan.md#plan-section-3-5)
- Section [5](../plan.md#plan-section-5), `src/workflow/escalation.ts`
- Sections [6.10](../plan.md#plan-section-6-10), [6.14](../plan.md#plan-section-6-14), and [6.15](../plan.md#plan-section-6-15)

## Work

1. Open an escalation only from `builder-running`.
2. Create the next escalation, move to `escalation-decision`, and require the child to commit both files.
3. Resolve only the current unresolved escalation.
4. Persist only selected option, decision, and reason in the resolution.
5. Commit `ready-for-builder` on the workflow branch and do not launch automatically.
6. Do not resolve through this workflow when the approved contract must change.

## Implementation

When the owner wants to change the approved contract, leave the escalation unresolved and instruct the owner to abandon the workflow manually. Never reuse or remove an escalation.

## Tests

Add Vitest integration tests for open, sequential open after a later pass, valid resolution, invalid option, duplicate resolution, ready-for-builder checkpoint, and no automatic builder launch.

## Completion criteria

- Every resolved escalation corresponds to one owner decision.
- The artifact and workflow revision remain consistent.
- Contract changes require manual abandonment and a new spec.
