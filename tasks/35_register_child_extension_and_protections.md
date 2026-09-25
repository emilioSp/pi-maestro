STATUS: TODO

# Task 35: Register the child extension and protect the builder spec

## Dependency

This task depends on Task 34: Add the verifier handoff tool.

## Objective

Register the child tools and protect the owner-approved `spec.md` during a builder pass.

## Plan references

- Sections [5](../plan.md#plan-section-5), `extensions/maestro-child.ts` and `src/tools/child/`
- Sections [6.11](../plan.md#plan-section-6-11) and [6.12](../plan.md#plan-section-6-12)
- Section [6.25](../plan.md#plan-section-6-25), spec protection tests

## Work

1. Import and register the three child-only tools directly from `src/tools/child/`. Register each once. Do not add `src/tools/child/index.ts`.
2. Use the shared live `MaestroSessionState` instance in the foreground runtime.
3. Do not capture or persist a separate digest in the child extension.
4. Let `prepareBuilderLaunch` set the expected SHA immediately before the builder launch. On an explicit retry, it replaces the baseline with the current base-branch spec SHA.
5. Add child hooks that reject direct `write` and `edit` calls for `spec.md`.
6. Allow an optional leading `@` before checking the path.
7. Resolve relative and absolute paths from the worktree root.
8. Normalize `.` and `..` path parts. Resolve existing parent directories and symlinks.
9. Apply the same protection when different paths point to the same `spec.md` file.
10. Do not add terminal checks for `workflow.json`, `prototypes/`, or `handoffs/`.

## Implementation

The hook protects direct model tool calls to `spec.md`. It is not a sandbox: terminal commands can still change files. The builder terminal tools compare the current `spec.md` SHA-256 with the live session baseline. Workflow state and handoff files remain internal protocol files managed by their dedicated tools.

Keep each tool's input schema, Pi registration, domain call, and result conversion in its own file. Do not export extra operations from tool modules.

## Tests

Add Vitest integration tests for relative, absolute, `@`-prefixed, normalized, parent-segment, nested, and symlink paths that resolve to `spec.md`. Test the shared session baseline, a retry baseline replacement, a missing baseline, a changed `spec.md`, and a changed `spec.md` committed with the checkpoint message. Test that each role cannot see tools for the other role.

## Completion criteria

- Direct `write` and `edit` calls cannot change `spec.md`.
- A builder terminal handoff or escalation fails when the expected session SHA is missing or the current `spec.md` digest differs from it.
- The child extension has no owner-session behavior.
- Dedicated child tools still work.
