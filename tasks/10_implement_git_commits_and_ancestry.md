STATUS: TODO

# Task 10: Implement Git commits and ancestry

## Dependency

This task depends on Task 9: Implement Git branches and worktrees.

## Objective

Provide checkpoint commits and prove workflow history relationships.

## Plan references

- Section [5](../plan.md#plan-section-5), `src/git/commits.ts` and `src/git/ancestry.ts`
- Sections [6.14](../plan.md#plan-section-6-14), [6.15](../plan.md#plan-section-6-15), [6.17](../plan.md#plan-section-6-17), and [6.23](../plan.md#plan-section-6-23)

## Work

1. Implement commit creation for workflow branches only.
2. Implement staged-path inspection and exact commit lookup.
3. Implement ancestor, parent, merge-base, and fast-forward checks.
4. Reconstruct the approval commit as the parent of the first `builder-running` checkpoint.
5. Prove that artifact revisions are reachable from the required checkpoint.
6. Refuse ambiguous, rewritten, or unrelated histories.

## Implementation

Do not create commits on the base branch. Commit messages may be fixed and deterministic. Stage only expected Maestro paths for workflow checkpoints. Keep history proof separate from state discovery.

## Tests

Add Vitest integration tests for checkpoint commits, parent discovery, linear histories, divergent histories, rewritten histories, unrelated commits, fast-forward eligibility, and accidental staged files outside the expected set.

## Completion criteria

- Higher layers can prove the approval and candidate lineage.
- Base-branch commits are never created by this module.
- Ambiguous history blocks the operation without mutation.
