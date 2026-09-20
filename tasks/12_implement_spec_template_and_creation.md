STATUS: TODO

# Task 12: Implement the spec template and creation

## Dependency

This task depends on Task 11: Implement workflow state schema and store.

## Objective

Distribute the approved spec template and create a new drafting spec safely.

## Plan references

- Sections [2.5](../plan.md#plan-section-2-5) and [2.8](../plan.md#plan-section-2-8)
- Section [3.2](../plan.md#plan-section-3-2), approved template
- Section [5](../plan.md#plan-section-5), `templates/spec.md`, `src/specs/template.ts`, and `src/specs/create.ts`
- Sections [6.10](../plan.md#plan-section-6-10), [6.16](../plan.md#plan-section-6-16), and [6.18](../plan.md#plan-section-6-18)

## Work

1. Put the exact approved ten-section template in `templates/spec.md`.
2. Implement template loading in `src/specs/template.ts`.
3. Implement initial spec creation in `src/specs/create.ts`.
4. Generate the ID and create `spec.md`, `workflow.json`, `observations.json`, `handoffs/escalations/`, and `prototypes/`.
5. Initialize phase `drafting-spec`, revision 1, and observations schema version `1.0.0` with `passes: []`.
6. Block creation when another active workflow exists or any target resource collides.

## Implementation

Perform all preflight checks before writing. Never reuse or overwrite an existing spec directory. If creation fails partway, remove only resources created by that attempt. Do not create JSON templates.

## Tests

Add Vitest integration tests for exact template content, initial files, custom spec directory, ID insertion, initial state and observations, same-second collision, active workflow rejection, and rollback after a simulated failure.

## Completion criteria

- A successful call creates one complete drafting spec.
- Existing resources are never overwritten.
- Initial JSON files pass their domain schemas.
