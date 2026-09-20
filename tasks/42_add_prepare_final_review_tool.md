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
4. Return base branch, candidate identity, staged summary, observations summary, cleanup result, and final phase.
5. Return a structured error with the previous phase when staging or cleanup fails before the final transition.
6. Clearly state in structured data that Maestro is concluded and the owner controls later edits and the final commit.
7. Reject repeated preparation of an already concluded workflow.

## Implementation

Do not generate the human summary inside the deterministic tool. Return structured data for the Maestro LLM. Do not commit, push, wait for owner confirmation, or keep workflow resources after success.

## Tests

Add Vitest adapter tests for a no-finding candidate, rejected findings candidate, dirty base, stale revision, failed staging verification, cleanup failure with unchanged phase, successful final-review as the last mutation, successful result fields, inactive mode, repeated call, and proof that no final commit exists.

## Completion criteria

- The result contains everything needed for the final owner message.
- Successful execution leaves staged changes and no workflow resources.
- The tool cannot reopen or extend final review.
