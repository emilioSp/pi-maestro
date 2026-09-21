STATUS: TODO

# Task 36: Add create-spec and mark-ready tools

## Dependency

This task depends on Task 35: Register the child extension and protections.

## Objective

Expose the two owner-facing tools for the spec preparation phase.

## Plan references

- Sections [3.2](../plan.md#plan-section-3-2) and [5](../plan.md#plan-section-5), `src/tools/main/create-spec.ts` and `mark-spec-ready.ts`
- Sections [6.9](../plan.md#plan-section-6-9), [6.10](../plan.md#plan-section-6-10), [6.14](../plan.md#plan-section-6-14), [6.16](../plan.md#plan-section-6-16), [6.18](../plan.md#plan-section-6-18), and [6.23](../plan.md#plan-section-6-23)

## Work

1. Implement `maestro_create_spec` with a small TypeBox input schema.
2. Generate identity and paths in the domain, not from caller-supplied protocol fields.
3. Return created paths and drafting state in a structured result.
4. Implement `maestro_mark_spec_ready` with `specId` and `expectedRevision`.
5. Verify the drafting state, expected revision, and existence of `spec.md` without inspecting its content.
6. Move to `ready-for-builder` without creating an owner commit.
7. Register neither tool while Maestro mode is inactive.

## Implementation

Tool files are Pi adapters only. They call configuration, path, spec, and workflow modules. Semantic review and owner approval happen before the LLM calls mark-ready. The tool treats `spec.md` as opaque Markdown.

## Tests

Add Vitest adapter tests for both input schemas, derived protocol fields, one successful call per tool, and one propagated domain error per tool.

## Completion criteria

- Tool results contain useful structured data for the Maestro LLM.
- The tools do not duplicate domain validation.
- A ready spec still requires the owner's commit.
