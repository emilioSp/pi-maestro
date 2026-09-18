STATUS: TODO

# Task 18: Implement workflow transitions

## Dependency

This task depends on Task 17: Implement verifier handoffs.

## Objective

Define the complete workflow state machine as pure transition logic.

## Plan references

- Section [5](../plan.md#plan-section-5), `src/workflow/transitions.ts`
- Section [6.14](../plan.md#plan-section-6-14), phases, events, writers, and revision rules

## Work

1. Define every approved event and source-to-target phase transition.
2. Require `expectedRevision` for every transition.
3. Increase revision exactly once for every successful transition, including a retry of the same role.
4. Identify which role may request each transition.
5. Reject every unapproved transition.
6. Return a new state without mutating the input.

## Implementation

Keep this module pure. It must not read files, run Git, create commits, or infer owner decisions. Model spec reset, builder retry, finding outcomes, and final review explicitly.

## Tests

Add table-driven Vitest unit tests for every approved transition and representative invalid transitions from every phase. Cover stale revisions, wrong actors, same-role retries, monotonic revisions, and immutability.

## Completion criteria

- The transition table matches the plan exactly.
- No caller can skip a phase or avoid a revision increase.
- Tests make missing future transitions visible.
