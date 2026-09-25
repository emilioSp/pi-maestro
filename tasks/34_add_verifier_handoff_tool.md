STATUS: TODO

# Task 34: Add the verifier handoff tool

## Dependency

This task depends on `mvp_04_rework_verifier_for_current_checkout.md` and `mvp_05_rework_child_context_and_verifier_commit.md`.

## Objective

Implement `maestro_record_verifier_handoff` for the current checkout. The tool owns the verifier protocol commit and never commits product files.

## Plan references

- Sections [3.4](../plan.md#plan-section-3-4), [5](../plan.md#plan-section-5), and [6.10](../plan.md#plan-section-6-10)
- Sections [6.11](../plan.md#plan-section-6-11), [6.14](../plan.md#plan-section-6-14), and [6.25](../plan.md#plan-section-6-25)

## Work

1. Define a closed TypeBox input schema with explicit `specId`, summary, acceptance criteria, findings, and notes. Derive protocol version, revision, and workflow identity from the current state.
2. Resolve the current repository context and derive the candidate as the parent of the current `HEAD` checkpoint.
3. Call `completeVerifierPass` with the derived candidate and validated handoff data.
4. On product changes, return `PRODUCT_FILES_MODIFIED` without writing or committing protocol files.
5. On success, commit only `workflow.json` and `handoffs/verifier.json` on the current branch.
6. Return structured details for the next workflow phase. Do not accept branch, worktree, or verifier pass parameters.

The verifier must not run `git commit`. Do not create a second verifier handoff implementation.

## Tests

Cover:

- input schema and explicit `specId`;
- successful handoff and protocol-only commit paths;
- candidate derived from the current checkpoint parent;
- mismatched `specId` and invalid workflow phase;
- product changes rejected without protocol writes or commits;
- no product files included in a successful commit;
- no branch, worktree, or pass-number input.

## Completion criteria

- `maestro_record_verifier_handoff` owns the verifier protocol commit.
- A successful commit contains only `workflow.json` and `handoffs/verifier.json`.
- Product changes return `PRODUCT_FILES_MODIFIED` without protocol writes or commits.
- The tool uses the current checkout and explicit spec identity.
