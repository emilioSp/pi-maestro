STATUS: DONE

# Task mvp_08: Review workflow prompt text

## Dependency

This task depends on the completed current-checkout workflow tasks and Task 34: Add the verifier handoff tool.

## Objective

Update the existing Maestro, builder, and verifier prompt text to match the current-checkout workflow.

This is a text-only task. Do not add modules, tools, tests, or workflow logic.

## Files

- `src/maestro/instructions/buildMaestroInstructions.ts`
- `agents/builder.md`
- `agents/verifier.md`

## Work

1. State that Maestro, the builder, and the verifier use the owner-selected current checkout and branch.
2. State that Maestro does not create, switch, validate, merge, or remove branches or worktrees.
3. Keep owner decisions explicit for specification approval, escalations, findings, code fixes, and Pull Request delivery.
4. Describe spec revisions as changes to the same `specId` and current branch, with Git preserving earlier artifacts.
5. Keep builder instructions aligned with the explicit `specId`, committed approved workflow state, dedicated child tools, and builder-owned implementation commits.
6. Keep verifier instructions aligned with the explicit `specId`, the parent of the `verifier-running` checkpoint as candidate, complete product restoration, and the verifier handoff tool's protocol-only commit.
7. Keep retry, failure, escalation, findings, and final-review wording consistent with the workflow state machine.
8. Remove stale worktree, operational-branch, `baseBranch`, target-branch, verifier-pass, local-squash, staging, and resource-cleanup instructions.
9. Keep the text concise, deterministic, and consistent with the existing tool allowlists.

Do not add a new prompt module or prompt test. Do not change domain code, tool schemas, extension registration, or agent allowlists.

## Verification

- Review the three files for consistency with `docs/workflow.md` and `plan.md`.
- Run the existing `npm run check`.
- Run `npm pack --dry-run`.

## Completion criteria

- The three existing prompt sources describe one current checkout and current branch.
- No reviewed prompt source instructs an agent to use a worktree or operational branch.
- Builder and verifier responsibilities match the current tool contracts.
- Owner decisions and Pull Request ownership remain explicit.
- No new module, test, tool, or workflow behavior is added.
