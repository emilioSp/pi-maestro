STATUS: TODO

# Task 42: Add the prepare-final-review tool

## Dependency

This task depends on Task 41: Add the resolve-findings tool.

## Objective

Expose the final squash, staging, cleanup, and structured owner handoff.

## Plan references

- Sections [3.7](../plan.md#plan-section-3-7) and [3.8](../plan.md#plan-section-3-8)
- Section [5](../plan.md#plan-section-5), `src/tools/main/prepare-final-review.ts`
- Sections [6.10](../plan.md#plan-section-6-10), [6.14](../plan.md#plan-section-6-14), [6.24](../plan.md#plan-section-6-24), and [6.25](../plan.md#plan-section-6-25)

## Work

1. Define input with `specId` and `expectedRevision`.
2. Require `candidate-ready` and a proven candidate commit.
3. Call the final-review workflow.
4. Return base branch, candidate identity, staged summary, cleanup result, and final phase.
5. Return a structured error with the previous phase when squash or staging verification fails before the final transition.
6. Clearly state in structured data that Maestro is concluded and the owner controls later edits and the final commit.
7. Reject repeated preparation of an already concluded workflow.

## Implementation

Do not generate the human summary inside the deterministic tool. Return structured data for the Maestro LLM. Do not commit, push, or wait for owner confirmation. Attempt cleanup after `final-review` and report any resources that require manual cleanup.

## Tests

Add Vitest adapter tests for input schema, structured result mapping including cleanup status, one successful call, and one propagated domain error.

## Completion criteria

- The result contains everything needed for the final owner message.
- Successful execution leaves staged changes and reports the cleanup result.
- The tool cannot reopen or extend final review.
