STATUS: TODO

# Task mvp_05: Rework child context and the verifier commit tool

## Dependency

This task depends on `mvp_02_add_current_branch_spec_revision_flow.md`, `mvp_03_rework_builder_for_current_checkout.md`, and `mvp_04_rework_verifier_for_current_checkout.md`.

## Objective

Make child tools identify the active spec explicitly and make the verifier handoff tool own its protocol commit.

## Plan references

- Sections [5](../plan.md#plan-section-5), [6.8](../plan.md#plan-section-6-8), [6.11](../plan.md#plan-section-6-11), and [6.12](../plan.md#plan-section-6-12)
- Section [6.14](../plan.md#plan-section-6-14), child artifact writes and commits

## Work

1. Remove child context logic that derives `specId` or role from a branch name.
2. Resolve the repository root from the current checkout.
3. Add explicit `specId` input to every child-only tool that operates on workflow artifacts.
4. Validate `specId` against the current `workflow.json` and validate the allowed workflow phase before any write.
5. Do not perform global workflow discovery.
6. Keep role authorization in the agent tool allowlists and phase checks.
7. Implement `maestro_record_verifier_handoff` so it validates the candidate comparison, writes `verifier.json` and `workflow.json`, and commits only those paths.
8. Return a structured `PRODUCT_FILES_MODIFIED` result without writing or committing when product files differ.
9. Keep `maestro_record_builder_handoff` as a protocol writer. The builder remains responsible for committing product changes and generated protocol files with Bash.
10. Update builder instructions to use the current checkout and explicit `specId`.
11. Update verifier instructions to use the current checkout, never run `git commit`, restore every breakage, and call the handoff tool for the protocol commit.
12. Keep direct `write` and `edit` protection for `spec.md` rooted at the current checkout.

## Tests

Add or update tests for:

- explicit `specId` validation in every child tool;
- rejection of a mismatched spec ID and invalid phase;
- no branch-name parsing and no global discovery;
- verifier protocol commit paths;
- verifier rejection without file writes or commits;
- builder protocol behavior and explicit current-checkout context;
- builder and verifier tool allowlists;
- current-checkout `spec.md` protection.

## Completion criteria

- Child tools never infer workflow identity from a branch name.
- Every child artifact operation validates explicit `specId` and workflow phase.
- The verifier handoff tool owns the verifier protocol commit.
- The verifier agent instructions do not ask the verifier to run Git commits.
- The builder agent instructions still require a committed implementation and builder handoff.
