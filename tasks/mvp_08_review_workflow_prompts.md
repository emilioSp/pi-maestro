STATUS: TODO

# Task mvp_08: Review Maestro and agent prompts after the current-checkout workflow change

## Dependency

This task depends on:

- `mvp_01_remove_worktree_and_branch_model.md`
- `mvp_02_add_current_branch_spec_revision_flow.md`
- `mvp_03_rework_builder_for_current_checkout.md`
- `mvp_04_rework_verifier_for_current_checkout.md`
- `mvp_05_rework_child_context_and_verifier_commit.md`
- `mvp_06_rework_final_review_for_pull_request.md`
- `mvp_07_reconcile_shared_branch_tests_and_fixtures.md`
- Task 34: Add the verifier handoff tool

## Objective

Make the coordinator instructions and child-agent prompts describe the current-checkout workflow without stale worktree, operational-branch, base-branch, or verifier-pass assumptions.

## Files

- `src/maestro/instructions/buildMaestroInstructions.ts`
- `agents/builder.md`
- `agents/verifier.md`

## Work

1. Review the Maestro instructions against the current workflow phases, tools, and owner responsibilities.
2. State that Maestro, the builder, and the verifier use the owner-selected current checkout and current branch.
3. State that Maestro does not create, switch, validate, merge, or remove branches or worktrees.
4. Keep owner decisions explicit for specification approval, escalations, findings, code fixes, and Pull Request delivery.
5. Describe spec revisions as changes to the same `specId` and current branch, with Git history preserving earlier artifacts.
6. Update builder instructions to require the explicit `specId`, the current checkout, the committed approved workflow state, and builder-owned implementation commits.
7. Update verifier instructions to require the explicit `specId`, the current checkout, the parent of the `verifier-running` checkpoint as the candidate, and restoration of every product change before handoff.
8. Describe the verifier handoff tool as the owner of the verifier protocol commit when that tool is available. The verifier must not commit product files or protocol files through Bash.
9. Keep protocol artifacts protected: agents must use dedicated Maestro tools and must not edit `spec.md`, `workflow.json`, or handoff files directly.
10. Keep retry, failure, escalation, findings, and final-review behavior consistent with the current state machine.
11. Remove stale references to worktrees, role-specific branches, `baseBranch`, target branches, verifier pass numbers, local squash, staging, and workflow resource cleanup.
12. Keep prompts concise, deterministic, and consistent with the tool allowlists and child extension behavior.

## Tests

Add or update tests for:

- inactive Maestro instructions returning `undefined`;
- active Maestro instructions mentioning the current checkout and owner decisions;
- absence of stale worktree, operational-branch, `baseBranch`, and local-squash instructions;
- builder instructions requiring the current checkout, explicit `specId`, dedicated handoff tools, and builder-owned commits;
- verifier instructions requiring the current checkout, candidate restoration, protocol-only handoff commits, and no product fixes;
- prompt consistency with the current workflow phases and Pull Request delivery.

Run:

```text
npm run check
npm pack --dry-run
```

## Completion criteria

- The three reviewed prompt sources describe one current checkout and current branch.
- No reviewed prompt source instructs an agent to use a worktree or operational branch.
- Builder and verifier responsibilities match the current tool contracts and state machine.
- Owner decisions and Pull Request ownership remain explicit.
- Prompt tests and all package checks pass.
