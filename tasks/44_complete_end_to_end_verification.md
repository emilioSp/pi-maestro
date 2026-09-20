STATUS: TODO

# Task 44: Complete end-to-end verification

## Dependency

This task depends on Task 43: Register the main Maestro extension.

## Objective

Prove that all modules work together and that the package is ready for review.

## Plan references

- The complete workflow in Sections [1](../plan.md#plan-section-1) through [6](../plan.md#plan-section-6)
- Section [6.25](../plan.md#plan-section-6-25), minimum test coverage
- Section [6.26](../plan.md#plan-section-6-26), supported environment

## Work

1. Add full integration scenarios using temporary Git repositories and fake foreground subagents.
2. Cover the happy path from activation and spec creation to staged final review.
3. Cover escalation without spec change and escalation with spec reset.
4. Cover findings rejected, fixed in code, revised in spec, and mixed decisions.
5. Cover builder failure and explicit retry after interruption.
6. Cover restart, active-run correlation, dirty worktrees, resource collisions, concurrent revisions, and path escape attempts.
7. Cover product changes left by the verifier through staged, unstaged, and untracked files.
8. Check that observations and escalation history survive resets and final squash.
9. Check that final cleanup happens only after verified staging and that `final-review` is written only after cleanup as the last mutation.
10. Remove redundant tests only when the same behavior remains clearly covered in its owning test file.

## Implementation

Keep tests arranged to mirror the main source owner. Do not add generic aggregate files such as `state.test.ts`. A full-flow test may live under the main extension or workflow path it verifies. Use explicit setup and one clear scenario per test.

## Tests

Run the complete release gate:

```text
npm run typecheck
npm run test:unit
npm run test:integration
npm pack --dry-run
```

Also inspect the tarball list for both extensions, agents, template, source, docs, README, and LICENSE, with no tests, temporary repositories, secrets, or `dist/`.

## Completion criteria

- Every minimum coverage item in Section 6.25 has an owning test.
- All release-gate commands pass on macOS with Node.js 26.
- No temporary file or repository remains.
- The package contains only the approved published files.
