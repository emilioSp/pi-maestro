STATUS: TODO

# Task 42: Add the check-candidate tool

## Dependency

This task depends on Task 41: Add the resolve-findings tool.

## Objective

Check the verified candidate on the current branch and return the facts needed for the owner's Pull Request.

## Plan references

- Sections [3.7](../plan.md#plan-section-3-7) and [3.8](../plan.md#plan-section-3-8)
- Section [5](../plan.md#plan-section-5), `src/tools/main/check-candidate.ts`
- Sections [6.10](../plan.md#plan-section-6-10), [6.14](../plan.md#plan-section-6-14), [6.17](../plan.md#plan-section-6-17), [6.24](../plan.md#plan-section-6-24), and [6.25](../plan.md#plan-section-6-25)

## Work

1. Define input with `specId` only. Do not accept a branch, candidate SHA, verifier pass, or worktree path.
2. Require the workflow to be in `candidate-ready`.
3. Require the matching verifier handoff with no active findings.
4. Require a clean current checkout.
5. Use the current `HEAD` and branch as the Pull Request facts.
6. Return the current branch, candidate `HEAD`, `candidate-ready` phase, and Pull Request guidance.
7. Do not write files, change `workflow.json`, create commits, or change the workflow phase.
8. Do not squash, stage, merge, push, create, remove, or clean up branches or worktrees.
9. Do not run the verifier again or wait for owner approval.
10. Leave the owner in control of the Git flow, review, Pull Request, and merge.

## Implementation

Keep the Pi adapter thin. Return structured data for the Maestro LLM to use. The result must say that the current branch is ready for a Pull Request. The owner controls all Git actions after the candidate check.

The check is read-only. A repeated call is allowed when the candidate remains ready and the checkout remains clean.

## Tests

Add Vitest adapter and integration tests for:

- the input schema;
- current `HEAD` and branch derivation;
- matching verifier handoff validation;
- clean-checkout validation;
- active-finding rejection;
- structured Pull Request result mapping;
- one successful call without file or state changes;
- one domain error;
- a repeated successful call.

## Completion criteria

- Candidate checking operates only on the current checkout and branch.
- Success leaves `workflow.json`, the verifier handoff, and the checkout unchanged.
- Success returns the facts needed to open a Pull Request.
- `candidate-ready` remains the last persisted Maestro phase.
- The owner controls Git flow and Pull Request delivery after the check.
