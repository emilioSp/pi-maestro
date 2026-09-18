STATUS: TODO

# Task 14: Implement builder observations

## Dependency

This task depends on Task 13: Implement spec parsing and validation.

## Objective

Validate and append immutable builder pass observations.

## Plan references

- Section [2.5](../plan.md#plan-section-2-5), `observations.json`
- Section [5](../plan.md#plan-section-5), `src/artifacts/observations.ts`
- Sections [6.10](../plan.md#plan-section-6-10), [6.11](../plan.md#plan-section-6-11), and [6.25](../plan.md#plan-section-6-25)

## Work

1. Implement the closed version 1 observations schema at every level.
2. Support discriminated `done` and `failed` pass outcomes.
3. Validate result statuses, observations, breakage values, notes, and failure reasons.
4. Derive the next sequential `B<n>` ID.
5. Append exactly one pass for a builder revision.
6. Keep all existing passes byte-equivalent in meaning and reject rewrites.
7. Validate only the new pass against the current spec acceptance criteria.
8. Read and write the document atomically.

## Implementation

For `done`, require exactly all current acceptance criteria and the complete green, red, restored-green cycle. For `failed`, allow partial results and require `failure.reason`; use `not-run` instead of invented results. Reject duplicate registration for one builder revision. Do not append a pass for escalation.

## Tests

Add Vitest tests for initial empty history, done and failed passes, derived IDs, duplicate revisions, unknown fields, missing sensitive-result text, immutable history, an old pass from an older spec revision, current semantic mismatch, and write failure.

## Completion criteria

- Existing history cannot be edited through the API.
- One builder revision can create at most one pass.
- Only a valid new pass is appended.
