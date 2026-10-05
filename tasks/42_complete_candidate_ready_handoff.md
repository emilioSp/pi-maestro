STATUS: TODO

# Task 42: Complete candidate-ready handoff

## Dependency

This task depends on Tasks 34 and 41: Add the verifier handoff and resolve-findings tools.

## Objective

End the workflow at `candidate-ready`. Keep the required checks in the operations that produce this phase. Let Maestro summarize the results and Pull Request facts.

## Plan references

- Sections [3.7](../plan.md#plan-section-3-7) and [3.8](../plan.md#plan-section-3-8)
- Section [5](../plan.md#plan-section-5), existing verifier, findings, and Maestro instruction modules
- Sections [6.10](../plan.md#plan-section-6-10), [6.14](../plan.md#plan-section-6-14), [6.24](../plan.md#plan-section-6-24), and [6.25](../plan.md#plan-section-6-25)

## Work

1. Keep the checks in the existing `maestro_record_verifier_handoff` and `maestro_resolve_findings` paths. Reuse the checks that already exist. Do not add a final check or summary tool.
2. Before writing a transition to `candidate-ready`, validate the resulting verifier handoff against the spec identity and workflow revision. Require no findings for the verifier path, or an explicit rejection with a nonempty reason for every finding in the resolution path.
3. Reject unrelated staged, unstaged, and untracked changes before writing protocol files. Preserve the verifier's existing product restoration check. Only the expected protocol changes are allowed.
4. Commit only `workflow.json` and `handoffs/verifier.json`. Return success only when the checkout is clean after the commit.
5. Remove the old `src/tools/main/prepare-final-review.ts` adapter, `src/workflow/final-review/` operation and tests, and final-review phase, event, transition, and role references. Remove obsolete registration or imports where present. Do not replace them with another checkpoint.
6. Update `src/maestro/instructions/buildMaestroInstructions.ts`. State that the workflow ends at `candidate-ready`, with no further tool call or owner commit.
7. Assign the final summary to Maestro. It reads the existing artifacts and Git information with available inspection tools. The summary includes changes, verification results, rejected findings and reasons, applicable builder notes, the current branch, and final `HEAD` after the protocol commit.
8. Distinguish owner rejections from passed verification. The summary must not change files or workflow state, create commits, or run verification again.
9. Leave the owner in control of review, later changes, Git flow, Pull Request creation, and merge. Later changes do not reopen the completed workflow.

## Implementation

Use the existing verifier and findings modules. Keep Pi adapters thin. Do not add a new module, state field, phase, persisted summary, or dependency.

The handoff and resolution operations own readiness. Maestro owns the wording of the final summary. Do not add a deterministic PR summary generator.

## Tests

Extend tests next to the owning operations. Reuse existing coverage where it already proves the behavior:

1. A verifier handoff with no findings reaches `candidate-ready`, commits only protocol files, and leaves a clean checkout.
2. Rejecting every finding with a reason reaches `candidate-ready`, preserves the rejection reasons, commits only protocol files, and leaves a clean checkout.
3. Invalid identity or revision, unresolved findings, and unrelated staged, unstaged, or untracked changes cannot produce a successful candidate-ready result. Precondition failures do not write protocol files.
4. Active findings still lead to `findings-decision`; a `fix-code` decision still leads to `ready-for-builder`.

Use the existing instruction or extension tests to check that Maestro owns the summary and requires no final tool call. Do not test generated LLM prose. Remove obsolete final-review tests rather than translating them into tests for another tool.

## Completion criteria

1. Both candidate-ready paths own the required checks and return success with a clean checkout.
2. `candidate-ready` is the terminal workflow phase. No final tool, phase, or checkpoint remains.
3. Maestro's instructions assign the final summary to Maestro and identify the current branch and final `HEAD` as PR facts.
4. The owner controls Git flow and Pull Request delivery after workflow completion.
5. `npm run check` passes.
