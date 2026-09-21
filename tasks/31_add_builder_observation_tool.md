STATUS: TODO

# Task 31: Add the builder observation tool

## Dependency

This task depends on Task 30: Implement Maestro session, instructions, and status.

## Objective

Expose the child-only tool that records one complete builder pass observation.

## Plan references

- Sections [2.5](../plan.md#plan-section-2-5) and [5](../plan.md#plan-section-5), `src/tools/child/record-builder-observation.ts`
- Sections [6.10](../plan.md#plan-section-6-10) through [6.12](../plan.md#plan-section-6-12) and [6.25](../plan.md#plan-section-6-25)

## Work

1. Define the TypeBox input schema for done and failed observation input.
2. Do not accept `specId`, revision, or pass ID from the builder.
3. Derive identity, current `builder-running` revision, and next `B<n>` from the worktree state.
4. Call the observations domain module.
5. Return a clear Pi tool result.
6. Reject calls outside the builder role or phase and a second call for the same revision.

## Implementation

The adapter contains no duplicate artifact logic. Its input includes only outcome, acceptance criteria, notes, and the failed reason when needed. Use `StringEnum` for exposed string enums when required by provider compatibility.

## Tests

Add Vitest adapter tests for input schema validation, derived protocol fields, one successful call, and one propagated domain error.

## Completion criteria

- The builder cannot forge protocol identity or revision.
- One successful call appends one complete immutable pass.
- The tool is not registered in the main session yet.
