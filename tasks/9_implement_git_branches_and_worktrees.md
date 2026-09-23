STATUS: DONE

# Task 9: Implement Git branches and worktrees

## Dependency

This task depends on Task 8: Implement Git command and repository operations.

## Objective

Manage Maestro branch and worktree resources with strict ownership checks.

## Plan references

- Section [5](../plan.md#plan-section-5), `src/git/branches/` and `src/git/worktrees/`
- Sections [6.17](../plan.md#plan-section-6-17), [6.18](../plan.md#plan-section-6-18), and [6.22](../plan.md#plan-section-6-22)

## Work

1. Implement fixed builder and verifier branch naming.
2. Implement branch existence, creation, fast-forward, and deletion operations.
3. Implement worktree listing, lookup, creation, cleanliness checks, and removal.
4. Create parent directories only when needed and remove them only when empty.
5. Stop at the first branch, path, or worktree collision before mutation.
6. Refuse to reuse or delete a resource unless its workflow ownership can be proved.

## Implementation

Use `builder/<id>` and `verifier/<id>/<n>` with matching configured worktree paths. A registered worktree must use the expected branch. Never clean, reset, force-delete, or overwrite a dirty or unrelated resource.

Above every Git-related function, add one `// git ...` comment for each Git command it can run. Use `<...>` placeholders for runtime values.

## Tests

Add Vitest integration tests for builder and verifier creation, sequence numbers, parent directories, one representative collision, registered-path mismatch, dirty worktrees, safe cleanup, refusal to delete foreign resources, and custom worktree directories.

## Completion criteria

- Resource creation is deterministic.
- The first collision blocks mutation with a clear error.
- Dirty and foreign resources remain untouched.
