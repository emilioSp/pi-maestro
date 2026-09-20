STATUS: DONE

# Task 4: Build shared test support

## Dependency

This task depends on Task 3: Configure package tooling and CI.

## Objective

Create small, explicit helpers for later unit and integration tests.

## Plan references

- Section [5](../plan.md#plan-section-5), test structure
- Section [6.25](../plan.md#plan-section-6-25), integration tests with temporary Git repositories

## Work

1. Implement `test/support/temp-repository.ts` for isolated temporary Git repositories.
2. Implement `test/support/fake-subagents.ts` for deterministic foreground subagent outcomes.
3. Configure temporary repositories with a local test identity and a known default branch.
4. Provide cleanup functions that remove every temporary directory.

## Implementation

Keep helpers small. Do not hide scenario setup in global hooks or implicit fixtures. Tests must choose their own files, commits, and fake responses. Use real Git commands for Git integration tests. The fake must not depend on private `pi-subagents` modules.

## Tests

Add Vitest tests for helper creation, Git initialization, commits, fake response ordering, and cleanup. Confirm cleanup removes the temporary repository.

## Completion criteria

- Later tests can create and remove a repository without duplicated setup.
- Fake subagent calls and results are inspectable.
- Helpers do not contain product behavior.
- No temporary directory remains after the test suite.
