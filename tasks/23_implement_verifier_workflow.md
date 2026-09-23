STATUS: DONE

# Task 23: Implement the verifier workflow

## Dependency

This task depends on Task 22: Implement the escalation workflow.

## Objective

Coordinate independent verifier passes and enforce an unchanged product candidate.

## Plan references

- Section [3.4](../plan.md#plan-section-3-4)
- Section [5](../plan.md#plan-section-5), `src/workflow/verifier/prepareVerifierLaunch.ts` and `src/workflow/verifier/completeVerifierPass.ts`
- Sections [6.10](../plan.md#plan-section-6-10), [6.11](../plan.md#plan-section-6-11), [6.14](../plan.md#plan-section-6-14), [6.15](../plan.md#plan-section-6-15), and [6.17](../plan.md#plan-section-6-17)

## Work

1. Launch only from `ready-for-verifier`.
2. Create the next verifier branch and separate clean worktree from the current builder commit.
3. Record the candidate commit and commit a `verifier-running` checkpoint before launch.
4. Before terminal handoff, compare all product files with the recorded candidate.
5. Include staged, unstaged, and untracked changes in the comparison.
6. Permit only the authorized verifier handoff and workflow state updates.
7. Move to `findings-decision` or `candidate-ready` from the validated handoff.

## Implementation

On product changes, return `PRODUCT_FILES_MODIFIED` with a clear message. Do not return file names, diff summaries, or suggested commands. Do not restore or write any file after this error.

## Tests

Add Vitest integration tests for clean launch, separate worktree, sequence numbers, empty findings, findings, staged product changes, unstaged changes, untracked files, remaining breakage, the simple error shape, and no state or handoff write on rejection.

## Completion criteria

- The verifier cannot hand off a modified candidate.
- Empty and non-empty findings use the same product-integrity check.
- Every verifier pass starts with fresh context and a clean worktree.
