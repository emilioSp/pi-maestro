STATUS: TODO

# Task 44: Verify the full workflow

## Dependency

This task depends on Task 43: Register the main Maestro extension.

## Objective

Show that all parts work together and the package is ready for review.

## Plan references

- The full workflow in Sections [1](../plan.md#plan-section-1) through [6](../plan.md#plan-section-6)
- Section [6.25](../plan.md#plan-section-6-25), minimum test coverage
- Section [6.26](../plan.md#plan-section-6-26), supported environment

## Work

1. Add one happy-path integration test. Start with activation and spec creation. End with staged final review.
2. Add one deactivation test proving that an incomplete workflow is not recovered by a later Maestro session.
3. Use temporary Git repositories and a fake Pi event bus. Use foreground subagent responses.
4. Keep other edge cases in tests next to the modules they cover.
5. Remove a duplicate test only if the same behavior is clearly tested in its owning test file.

## Implementation

Arrange tests to match the main source modules. Do not add generic test files such as `state.test.ts`. A full-workflow test may live next to the main extension or workflow code it checks. Set up each scenario clearly.

## Tests

Run all release checks:

```text
npm run typecheck
npm run test:unit
npm run test:integration
npm pack --dry-run
```

Check the package file list. It must include both extensions, agents, the template, source, docs, README, and LICENSE. It must not include tests, temporary repositories, secrets, or `dist/`.

## Completion criteria

- Every minimum-coverage item in Section 6.25 has a test owned by the right module.
- All release checks pass on macOS with Node.js 26.
- No temporary files or repositories remain.
- The package contains only approved files.
