STATUS: TODO

# Task 35: Register the child extension and protections

## Dependency

This task depends on Task 34: Add the verifier handoff tool.

## Objective

Register only child tools and block direct edits to Maestro protocol paths.

## Plan references

- Section [5](../plan.md#plan-section-5), `extensions/maestro-child.ts` and `src/tools/child/`
- Sections [6.11](../plan.md#plan-section-6-11) and [6.12](../plan.md#plan-section-6-12)
- Section [6.25](../plan.md#plan-section-6-25), protected-path tests

## Work

1. Export and register the four child-only tools.
2. Add child hooks that reject direct `write` and `edit` calls for `spec.md`, `workflow.json`, `observations.json`, `prototypes/`, and `handoffs/`.
3. Remove an optional leading `@` before path checks.
4. Resolve relative and absolute paths from the worktree root.
5. Normalize dot segments and resolve existing ancestors and symlinks.
6. Apply the same protection to aliases of one file.
7. Do not register commands, events, status, main tools, or orchestration.

## Implementation

The hook protects tool calls, but terminal domain checks remain required because bash is not a sandbox. Allow normal product files and allow protocol changes only through the dedicated Maestro tools.

## Tests

Add Vitest integration tests for relative, absolute, `@`-prefixed, normalized, parent-segment, nested, and symlink aliases. Test every protected path and one allowed product path. Test that each role's tool allowlist hides tools for the other role.

## Completion criteria

- Direct `write` and `edit` cannot change protocol artifacts.
- The child extension has no owner-session behavior.
- Dedicated child tools still work.
