STATUS: TODO

# Task 36: Add the create-spec and mark-ready tools

## Dependency

This task depends on Task 35: Register the child extension and protect the builder spec.

## Objective

Give the owner tools to create a spec and approve the initial spec or an authorized spec revision on the current branch.

## Plan references

- Sections [3.2](../plan.md#plan-section-3-2) and [5](../plan.md#plan-section-5), `src/tools/main/create-spec.ts` and `mark-spec-ready.ts`
- Sections [6.9](../plan.md#plan-section-6-9), [6.10](../plan.md#plan-section-6-10), [6.14](../plan.md#plan-section-6-14), [6.16](../plan.md#plan-section-6-16), [6.18](../plan.md#plan-section-6-18), and [6.23](../plan.md#plan-section-6-23)

## Work

1. Add `maestro_create_spec` with a small TypeBox input schema.
2. Generate the spec ID and paths in the domain. Do not accept `baseBranch`, target-branch, worktree, or other protocol identity fields from the caller.
3. Create `workflow.json` with only `version`, `specId`, `revision`, and `phase`.
4. Return the created paths and drafting state as structured data.
5. Add `maestro_mark_spec_ready` with a `specId` input.
6. Allow `maestro_mark_spec_ready` from initial `drafting-spec`, `builder-failed`, `escalation-decision`, and `findings-decision`.
7. Move every allowed state to `ready-for-builder` after the owner approves the current `spec.md`.
8. Do not compare the current `spec.md` content with an earlier version.
9. When called from a blocked phase, make the old blocker historical and do not require a separate escalation or finding resolution.
10. Do not create an owner commit. The owner must commit the approved `spec.md` and `workflow.json` on the current branch.
11. Keep both tools inactive when Maestro mode is off.

## Implementation

Tool files are Pi adapters only. Each file registers one Pi tool and keeps its input schema, domain call, and result conversion with that tool. Do not export extra operations or add a barrel.

Call the existing configuration, path, spec, and workflow modules. The Maestro LLM reviews the spec and gets the owner's approval before it calls mark-ready. The tool treats `spec.md` as plain Markdown and does not interpret or compare its content.

## Tests

Add Vitest adapter and integration tests for:

- both input schemas;
- the four-field workflow state;
- initial approval from `drafting-spec`;
- approval from each authorized blocked phase;
- rejection from all other phases;
- no content comparison;
- protocol fields read from workflow state;
- one successful call for each tool;
- one domain error returned to the tool caller for each tool.

## Completion criteria

- Tool results give the Maestro LLM useful structured data.
- `maestro_mark_spec_ready` supports the initial spec and authorized same-workflow revisions.
- The tools do not repeat semantic spec validation.
- The owner must still commit a ready spec and workflow state.
