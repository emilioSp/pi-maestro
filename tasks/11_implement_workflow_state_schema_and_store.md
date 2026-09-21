STATUS: DONE

# Task 11: Implement workflow state schema and store

## Dependency

This task depends on Task 10: Implement Git commits and commit-history verification.

## Objective

Validate and persist the minimal `workflow.json` document.

## Plan references

- Section [2.11](../plan.md#plan-section-2-11), persistent state
- Section [5](../plan.md#plan-section-5), `src/workflow/state/schema.ts` and `src/workflow/state/store.ts`
- Section [6.14](../plan.md#plan-section-6-14), state, phases, and revisions

## Work

1. Implement the closed TypeBox workflow schema.
2. Support exactly the ten approved phases.
3. Require schema version `1.0.0`, a valid spec ID, a positive integer revision, and non-empty base branch.
4. Implement validated reads and atomic writes.
5. Require compare-and-set writes with `expectedRevision`.
6. Reject unknown fields and malformed JSON.
7. Import the state API directly through `#workflow/state/*` without an export barrel.

## Implementation

The store owns file persistence only. It must not choose transitions, discover branches, or repair state. Every successful state update writes a higher revision supplied by the transition layer.

## Tests

Add Vitest unit and integration tests for every phase, closed-object validation, wrong versions, bad revisions, invalid IDs, malformed files, atomic replacement, stale `expectedRevision`, and preservation of the old file after failure.

## Completion criteria

- Only the five approved fields can be stored.
- Concurrent or stale updates fail clearly.
- Reads never return unvalidated state.
