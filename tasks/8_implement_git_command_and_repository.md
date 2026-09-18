STATUS: TODO

# Task 8: Implement Git command and repository operations

## Dependency

This task depends on Task 7: Implement atomic file writes.

## Objective

Create the shell-free Git boundary and basic repository inspection.

## Plan references

- Section [5](../plan.md#plan-section-5), `src/git/command.ts` and `src/git/repository.ts`
- Sections [6.20](../plan.md#plan-section-6-20), [6.22](../plan.md#plan-section-6-22), [6.23](../plan.md#plan-section-6-23), and [6.26](../plan.md#plan-section-6-26)

## Work

1. Implement Git execution with argv, cwd, timeout, stdout, stderr, and exit status in `src/git/command.ts`.
2. Never pass Git commands through a shell.
3. Implement repository discovery, root lookup, current branch, HEAD lookup, Git version checks, trust checks, and clean/dirty status in `src/git/repository.ts`.
4. Return structured errors for missing Git, timeout, non-repository paths, detached or unexpected state, and unsupported Git versions.
5. Export these operations from `src/git/index.ts`.

## Implementation

Keep this layer independent from Pi and workflow rules. Read staged, unstaged, and untracked state without changing the repository. Activation checks must be read-only.

## Tests

Add Vitest integration tests with temporary repositories. Cover successful commands, argv safety, non-zero exits, timeout, repository discovery from a child directory, branch and HEAD reads, clean and dirty status, and version parsing.

## Completion criteria

- Git commands cannot interpolate shell text.
- Repository inspection has no side effect.
- Errors retain enough context for higher layers to explain a failure.
