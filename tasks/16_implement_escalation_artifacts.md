STATUS: TODO

# Task 16: Implement escalation artifacts

## Dependency

This task depends on Task 15: Implement builder handoffs.

## Objective

Create permanent, sequential builder escalations and resolve them once.

## Plan references

- Section [3.5](../plan.md#plan-section-3-5), escalation rules
- Section [5](../plan.md#plan-section-5), `src/artifacts/escalation.ts`
- Section [6.15](../plan.md#plan-section-6-15), escalation schema

## Work

1. Implement the closed escalation schema with semantic schema version `1.0.0`.
2. Validate questions, context, options, recommendation, resolution, and notes.
3. Allocate the next `E<n>` ID from valid existing escalation files.
4. Write a new escalation only with `resolution: null`.
5. Resolve an escalation once by changing only `revision` and `resolution`.
6. Validate selected option IDs while allowing `null` for another owner decision.
7. Never rename, reuse, overwrite, or delete an escalation.

## Implementation

Read and validate the full escalation history before allocating an ID. The resolution contains only the owner decision and does not encode workflow actions.

## Tests

Add Vitest tests for sequential IDs, gaps or malformed history, duplicate option IDs, invalid recommendations, valid null recommendation, valid resolution, invalid selected option, second resolution, forbidden field changes, one representative unknown-field case per main schema boundary, and atomic write failure.

## Completion criteria

- Escalations form an append-only history.
- Resolution is owner data and can be written only once.
- Unknown fields are rejected by the closed schema.
