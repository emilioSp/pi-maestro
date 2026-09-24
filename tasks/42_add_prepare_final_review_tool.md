STATUS: TODO

# Task 42: Add the prepare-final-review tool

## Dependency

This task depends on Task 41: Add the resolve-findings tool.

## Objective

Prepare the final squash and staging, clean up workflow resources, and return the facts for the owner's final review.

## Plan references

- Sections [3.7](../plan.md#plan-section-3-7) and [3.8](../plan.md#plan-section-3-8)
- Section [5](../plan.md#plan-section-5), `src/tools/main/prepare-final-review.ts`
- Sections [6.10](../plan.md#plan-section-6-10), [6.14](../plan.md#plan-section-6-14), [6.24](../plan.md#plan-section-6-24), and [6.25](../plan.md#plan-section-6-25)

## Work

1. Define input with `specId`.
2. Require the workflow to be in `candidate-ready` and prove which commit is the candidate.
3. Call the final-review workflow.
4. Return the base branch, candidate identity, staged summary, cleanup result, and final phase.
5. If squash or staging checks fail before the final transition, return a structured error that includes the previous phase.
6. Return structured data that says Maestro is finished and the owner controls later edits and the final commit.
7. Reject another prepare call after the workflow is already complete.

## Implementation

Do not write the human summary in the deterministic tool. Return structured data for the Maestro LLM to use. Do not commit, push, or wait for owner approval. After `final-review`, try to clean up. Report any resources that need manual cleanup.

## Tests

Add Vitest adapter tests for the input schema, structured result mapping including cleanup status, one successful call, and one domain error returned to the tool caller.

## Completion criteria

- The result contains the facts needed for the final owner message.
- Success leaves the changes staged and reports cleanup results.
- The tool cannot reopen or extend a completed final review.
