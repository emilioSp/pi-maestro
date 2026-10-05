STATUS: DONE

# Task 44: Verify the happy path

## Dependency

This task depends on Task 43: Register the main Maestro extension.

## Objective

Show that the complete happy path works through the main extension on the current branch.

Failure, spec revision, findings, deactivation, and resume already have tests. Package checks remain in CI. Do not add duplicate coverage.

## Plan references

1. The full workflow in Sections [1](../plan.md#plan-section-1) through [6](../plan.md#plan-section-6)
2. Section [6.25](../plan.md#plan-section-6-25), minimum test coverage
3. Section [6.26](../plan.md#plan-section-6-26), supported environment

## Work

1. Extend the spec-approval test in `extensions/maestro.integration.test.ts` into one complete happy-path test.
2. Start on an arbitrary current branch. Activate Maestro, create and approve a spec, and commit the approval.
3. Use real Pi owner and child sessions, handoff tools, the Pi event bus, and a temporary Git repository. Script the child work and foreground completion responses without model calls.
4. Run builder and verifier through the registered main tools. Make sure that the workflow ends in `candidate-ready` with a matching verifier handoff.
5. Make sure that the verifier commits only protocol files. The checkout must be clean and the branch must not change.
6. Test that Maestro's instructions assign the final summary to Maestro. Do not test generated model text.
7. Make sure that completion needs no final tool call, checkpoint, or owner commit.

## Checks

Run `npm run check` and `git diff --check`.

## Completion criteria

The happy path passes through the main extension and both real child handoff tools. It uses one current branch and one checkout. The final HEAD is the verifier handoff commit. Temporary repositories and Pi sessions are cleaned up.

This test does not cover AI reasoning or the real subagent process launcher.
