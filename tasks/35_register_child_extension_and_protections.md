STATUS: TODO

# Task 35: Register the child extension and protect the builder spec

## Dependency

This task depends on the completed MVP foundation tasks:

- `mvp_01_remove_worktree_and_branch_model.md`
- `mvp_02_add_current_branch_spec_revision_flow.md`
- `mvp_03_rework_builder_for_current_checkout.md`
- `mvp_04_rework_verifier_for_current_checkout.md`
- `mvp_05_rework_child_context_and_verifier_commit.md`
- `mvp_06_rework_final_review_for_pull_request.md`
- `mvp_07_reconcile_shared_branch_tests_and_fixtures.md`
- `mvp_08_review_workflow_prompts.md`
- Task 34: Add the verifier handoff tool

## Objective

Register the child tools and protect the owner-approved `spec.md` in the current checkout.

## Plan references

- Sections [5](../plan.md#plan-section-5), `extensions/maestro-child.ts`, and `src/tools/child/`
- Sections [6.11](../plan.md#plan-section-6-11) and [6.12](../plan.md#plan-section-6-12)
- Sections [6.14](../plan.md#plan-section-6-14) and [6.25](../plan.md#plan-section-6-25)

## Work

1. Import and register the three child-only tools directly from `src/tools/child/`. Register each once. Do not add a barrel.
2. Use the shared live `MaestroSessionState` instance in the foreground runtime.
3. Do not capture or persist a separate digest in the child extension.
4. Let `prepareBuilderLaunch` set the expected SHA immediately before each normal builder launch. After an approved spec revision, it replaces the baseline with the current checkout's `spec.md` SHA.
5. Add child hooks that reject direct `write` and `edit` calls for `spec.md`.
6. Allow an optional leading `@` before checking the path.
7. Resolve relative and absolute paths from the current repository checkout root.
8. Normalize `.` and `..` path parts. Resolve existing parent directories and symlinks.
9. Apply the same protection when different paths point to the same `spec.md` file.
10. Do not add terminal checks for `workflow.json`, `prototypes/`, or `handoffs/`.
11. Keep child tool inputs explicit: every workflow artifact tool receives and validates `specId`.
12. Keep role authorization in agent tool allowlists and workflow phase checks. Do not infer role or spec identity from a branch name.
13. Register the verifier handoff tool that commits only `verifier.json` and `workflow.json` after product-file validation.

## Implementation

The hook protects direct model tool calls to `spec.md`. It is not a sandbox: terminal commands can still change files. Builder terminal tools compare the current `spec.md` SHA-256 with the live session baseline. Workflow state and handoff files remain internal protocol files managed by their dedicated tools.

The verifier handoff tool must not run a Git commit through Bash. It writes and commits only the allowed protocol files after checking the product against the parent of the `verifier-running` checkpoint.

Keep each tool's input schema, Pi registration, domain call, and result conversion in its own file. Do not export extra operations from tool modules.

## Tests

Add Vitest integration tests for relative, absolute, `@`-prefixed, normalized, parent-segment, nested, and symlink paths that resolve to `spec.md`. Test the shared session baseline, a revision baseline replacement, a missing baseline, a changed `spec.md`, and a changed `spec.md` committed with the checkpoint message. Test explicit spec identity, phase authorization, verifier protocol-only commits, and role tool allowlists.

## Completion criteria

- Direct `write` and `edit` calls cannot change `spec.md`.
- A builder terminal handoff or escalation fails when the expected session SHA is missing or the current `spec.md` digest differs from it.
- The child extension has no owner-session behavior.
- Child tools do not infer identity from branch names.
- The verifier handoff tool commits only its protocol files after a successful product check.
- Dedicated child tools still work.
