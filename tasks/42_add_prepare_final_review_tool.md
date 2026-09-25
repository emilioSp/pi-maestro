STATUS: TODO

# Task 42: Add the prepare-final-review tool

## Dependency

This task depends on Task 41: Add the resolve-findings tool.

## Objective

Verify the candidate on the current branch, commit `final-review`, and return the facts needed for the owner's Pull Request.

## Plan references

- Sections [3.7](../plan.md#plan-section-3-7) and [3.8](../plan.md#plan-section-3-8)
- Section [5](../plan.md#plan-section-5), `src/tools/main/prepare-final-review.ts`
- Sections [6.10](../plan.md#plan-section-6-10), [6.14](../plan.md#plan-section-6-14), [6.17](../plan.md#plan-section-6-17), [6.24](../plan.md#plan-section-6-24), and [6.25](../plan.md#plan-section-6-25)

## Work

1. Define input with `specId` only. Do not accept a branch, candidate SHA, verifier pass, or worktree path.
2. Require the workflow to be in `candidate-ready`.
3. Use the current `HEAD` as the candidate.
4. Require a clean current checkout and a verifier handoff with no active findings.
5. Write and commit `workflow.json` in `final-review` on the current branch.
6. Return the current branch, candidate commit, final phase, and Pull Request guidance.
7. Do not squash, stage, merge, push, create, remove, or clean up branches or worktrees.
8. Do not wait for owner approval and do not reopen a completed workflow.

## Implementation

Do not write the human summary in the deterministic tool. Return structured data for the Maestro LLM to use. The result must say that the current branch is ready for a Pull Request. The owner controls the Pull Request and merge after `final-review`.

## Tests

Add Vitest adapter and integration tests for:

- the input schema;
- current `HEAD` candidate derivation;
- clean-checkout validation;
- active-finding rejection;
- final-review checkpoint commit;
- structured Pull Request result mapping;
- one successful call;
- one domain error;
- rejection of another prepare call after completion.

## Completion criteria

- Final review operates only on the current checkout and branch.
- Success leaves a committed `final-review` state and a clean checkout.
- Success returns the facts needed to open a Pull Request.
- No local squash, staging, or resource cleanup remains.
- The tool cannot reopen or extend a completed final review.
