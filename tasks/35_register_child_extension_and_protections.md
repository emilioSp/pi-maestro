STATUS: TODO

# Task 35: Register the child extension and protect workflow files

## Dependency

This task depends on Task 34: Add the verifier handoff tool.

## Objective

Register only child tools and block direct edits to Maestro workflow files.

## Plan references

- Section [5](../plan.md#plan-section-5), `extensions/maestro-child.ts` and `src/tools/child/`
- Sections [6.11](../plan.md#plan-section-6-11) and [6.12](../plan.md#plan-section-6-12)
- Section [6.25](../plan.md#plan-section-6-25), protected-path tests

## Work

1. Import and register the three child-only tools directly from `src/tools/child/`. Register each once. Do not add `src/tools/child/index.ts`.
2. Add child hooks that reject direct `write` and `edit` calls for `spec.md`, `workflow.json`, `prototypes/`, and `handoffs/`.
3. Allow an optional leading `@` before checking a path.
4. Resolve relative and absolute paths from the worktree root.
5. Normalize `.` and `..` path parts. Resolve existing parent directories and symlinks.
6. Apply the same protection when different paths point to the same file.
7. Do not register commands, events, status, main tools, or orchestration.

## Implementation

The hook protects tool calls. It is not a sandbox: terminal commands can still change files. Keep the terminal checks in the domain. Allow normal product files to change. Allow workflow files to change only through dedicated Maestro tools.

Keep each tool's input schema, Pi registration, domain call, and result conversion in its own file. Do not export extra operations from tool modules.

## Tests

Add Vitest integration tests for relative, absolute, `@`-prefixed, normalized, parent-segment, nested, and symlink paths. Test every protected path and one allowed product path. Test that each role cannot see tools for the other role.

## Completion criteria

- Direct `write` and `edit` calls cannot change workflow files.
- The child extension has no owner-session behavior.
- Dedicated child tools still work.
