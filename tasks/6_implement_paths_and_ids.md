STATUS: DONE

# Task 6: Implement safe paths and spec IDs

## Dependency

This task depends on Task 5: Implement configuration.

## Objective

Provide safe Maestro path construction and deterministic spec ID helpers.

## Plan references

- Sections [2.5](../plan.md#plan-section-2-5) and [2.6](../plan.md#plan-section-2-6)
- Section [5](../plan.md#plan-section-5), `src/paths.ts`, `src/ids/createSpecId.ts`, and `src/ids/isValidSpecId.ts`
- Sections [6.16](../plan.md#plan-section-6-16), [6.17](../plan.md#plan-section-6-17), and [6.21](../plan.md#plan-section-6-21)

## Work

1. Build every approved spec, handoff, prototype, branch, and worktree path from validated configuration in `src/paths.ts`.
2. Keep every generated filesystem path inside the Git root.
3. Implement ID composition in `src/ids/createSpecId.ts` and ID validation in `src/ids/isValidSpecId.ts`. Keep timestamp formatting, slug normalization, and timestamp validation private to their respective modules. Export `SPEC_ID_PATTERN` with ID validation for schema consumers.

## Implementation

Configured-directory validation belongs to configuration loading. `src/paths.ts` has no filesystem side effects and derives paths only from the validated configuration. Keep all generated filesystem paths inside the Git root. Use the exact `YYYYMMDD-HHmmss-<slug>` format. Do not add a collision suffix or counter. Import each ID operation directly without a barrel, and place its tests beside its module.

## Tests

Add Vitest unit tests for normal generated paths, prototype path escapes, slug edge cases, UTC formatting, and ID validation. Directory validation tests belong to `src/config/`. Include explicit tests that no constructed path can leave the Git root.

## Completion criteria

- Unsafe paths are rejected before any write.
- Valid custom directories work.
- IDs match the approved format and sort by UTC timestamp.
- The modules do not depend on Pi.
