STATUS: TODO

# Task 44: Verify the full workflow

## Dependency

This task depends on Task 43: Register the main Maestro extension.

## Objective

Show that the current-branch workflow works end to end and the package is ready for review.

## Plan references

- The full workflow in Sections [1](../plan.md#plan-section-1) through [6](../plan.md#plan-section-6)
- Section [6.25](../plan.md#plan-section-6-25), minimum test coverage
- Section [6.26](../plan.md#plan-section-6-26), supported environment

## Work

1. Add one happy-path integration test. Start on an arbitrary current branch, activate Maestro, create and approve a spec, run builder and verifier, prepare `final-review`, and return Pull Request facts.
2. Add one builder-failure recovery test with an explicit retry on the same branch.
3. Add one spec-revision test from a blocked phase using the same `specId`, current branch, and artifact paths.
4. Add one verifier-finding test covering both `fix-code` and all-findings-rejected outcomes.
5. Add one deactivation test proving that an incomplete workflow is not recovered by a later Maestro session and that the live expected SHA is cleared.
6. Use temporary Git repositories and a fake Pi event bus. Use foreground subagent responses.
7. Keep other edge cases in tests next to the modules they cover.
8. Remove a duplicate test only if the same behavior is clearly tested in its owning test file.

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
- The full workflow uses one current branch and one checkout.
- The verifier commits only protocol files through its child tool.
- Spec revision, findings, retry, and final Pull Request delivery work as documented.
- All release checks pass on macOS with Node.js 26.
- No temporary files or repositories remain.
- The package contains only approved files.
