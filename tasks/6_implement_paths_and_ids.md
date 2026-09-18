STATUS: TODO

# Task 6: Implement safe paths and spec IDs

## Dependency

This task depends on Task 5: Implement configuration.

## Objective

Provide safe Maestro path construction and deterministic spec ID helpers.

## Plan references

- Sections [2.5](../plan.md#plan-section-2-5) and [2.6](../plan.md#plan-section-2-6)
- Section [5](../plan.md#plan-section-5), `src/paths.ts` and `src/ids.ts`
- Sections [6.16](../plan.md#plan-section-6-16), [6.17](../plan.md#plan-section-6-17), and [6.21](../plan.md#plan-section-6-21)

## Work

1. Implement repository-relative directory validation in `src/paths.ts`.
2. Reject the repository root, absolute paths, escapes through `..`, unsafe symlinks, equal directories, and nested spec/worktree directories.
3. Build every approved spec, handoff, prototype, branch, and worktree path from validated inputs.
4. Implement UTC timestamps, slug normalization, ID composition, and ID validation in `src/ids.ts`.

## Implementation

Resolve existing ancestors and symlinks before accepting a configured directory. Keep all generated filesystem paths inside the Git root. Use the exact `YYYYMMDD-HHmmss-<slug>` format. Do not add a collision suffix or counter.

## Tests

Add Vitest unit tests for normal paths, dot segments, parent escapes, absolute paths, the root path, equal and nested directories, existing symlinks inside the repository, symlinks outside it, slug edge cases, UTC formatting, and ID validation. Include explicit tests that no constructed path can leave the Git root.

## Completion criteria

- Unsafe paths are rejected before any write.
- Valid custom directories work.
- IDs match the approved format and sort by UTC timestamp.
- The modules do not depend on Pi.
