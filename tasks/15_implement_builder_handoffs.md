STATUS: TODO

# Task 15: Implement builder handoffs

## Dependency

This task depends on Task 14: Implement builder observations.

## Objective

Validate, read, and write the current builder terminal handoff.

## Plan references

- Sections [3.3](../plan.md#plan-section-3-3) and [5](../plan.md#plan-section-5)
- Section [6.15](../plan.md#plan-section-6-15), builder handoff schema

## Work

1. Implement the closed discriminated schema in `src/artifacts/builder-handoff.ts`.
2. Validate semantic schema version `1.0.0`, identity, revision, status, summary, acceptance criteria, notes, and failure details.
3. Require exact current spec acceptance criterion IDs.
4. Enforce all-passed and all-confirmed results for `done`.
5. Require a non-empty reason and explicit partial statuses for `failed`.
6. Implement validated read and atomic replacement of `handoffs/builder.json`.

## Implementation

The file contains only the current builder handoff. Git history preserves older versions. Keep detailed commands and observations in `observations.json`, not in this handoff. Do not update workflow state in the artifact module.

## Tests

Add Vitest tests for valid done and failed documents, missing and extra criteria, duplicate IDs, bad statuses, missing failure reason, empty summary, unknown fields at each level, wrong identity or revision, and safe replacement.

## Completion criteria

- Invalid handoffs cannot be read as trusted data or written.
- `done` cannot represent incomplete verification.
- Artifact logic remains Pi-independent.
