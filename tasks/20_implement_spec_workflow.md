STATUS: TODO

# Task 20: Implement the spec workflow

## Dependency

This task depends on Task 19: Implement state discovery and reconciliation.

## Objective

Coordinate spec creation and readiness.

## Plan references

- Sections [3.2](../plan.md#plan-section-3-2) and [5](../plan.md#plan-section-5), `src/workflow/spec.ts`
- Sections [6.10](../plan.md#plan-section-6-10), [6.14](../plan.md#plan-section-6-14), [6.18](../plan.md#plan-section-6-18), and [6.21](../plan.md#plan-section-6-21)

## Work

1. Coordinate new spec creation after active-workflow checks.
2. Mark an owner-approved drafting spec as `ready-for-builder` on the base branch without inspecting or committing its Markdown content.
3. Require the expected spec ID, workflow revision, and existing `spec.md`.
4. Do not revise an approved spec inside an active workflow.

## Implementation

If the approved contract must change after a builder starts, Maestro stops. The owner abandons the workflow manually, cleans its resources, and creates a new spec with a new ID. Maestro has no abandonment or reset tool in the MVP.

## Tests

Add Vitest integration tests for create, active-workflow rejection, the ready transition with expected identity and revision, stale revision, and missing spec.

## Completion criteria

- Creation and readiness follow one clear path.
- An approved active spec is never rewritten by Maestro.
- Maestro never creates the owner approval commit.
