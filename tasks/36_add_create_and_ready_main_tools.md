STATUS: TODO

# Task 36: Add the create-spec and mark-ready tools

## Dependency

This task depends on Task 35: Register the child extension and protect workflow files.

## Objective

Give the owner two tools for preparing a spec.

## Plan references

- Sections [3.2](../plan.md#plan-section-3-2) and [5](../plan.md#plan-section-5), `src/tools/main/create-spec.ts` and `mark-spec-ready.ts`
- Sections [6.9](../plan.md#plan-section-6-9), [6.10](../plan.md#plan-section-6-10), [6.14](../plan.md#plan-section-6-14), [6.16](../plan.md#plan-section-6-16), [6.18](../plan.md#plan-section-6-18), and [6.23](../plan.md#plan-section-6-23)

## Work

1. Add `maestro_create_spec` with a small TypeBox input schema.
2. Generate the spec ID and paths in the domain. Do not accept protocol identity fields from the caller.
3. Return the created paths and drafting state as structured data.
4. Add `maestro_mark_spec_ready` with a `specId` input.
5. Check that the workflow is in the drafting phase and that `spec.md` exists. Do not inspect the file content.
6. Move the workflow to `ready-for-builder`. Do not create an owner commit.
7. Keep both tools inactive when Maestro mode is off.

## Implementation

Tool files are Pi adapters only. Each file registers one Pi tool and keeps its input schema, domain call, and result conversion with that tool. Do not export extra operations or add a barrel.

Call the existing configuration, path, spec, and workflow modules. The Maestro LLM reviews the spec and gets the owner's approval before it calls mark-ready. The tool treats `spec.md` as plain Markdown and does not interpret it.

## Tests

Add Vitest adapter tests for both schemas, protocol fields read from workflow state, one successful call for each tool, and one domain error returned to the tool caller for each tool.

## Completion criteria

- Tool results give the Maestro LLM useful structured data.
- The tools do not repeat domain validation.
- The owner must still commit a ready spec.
