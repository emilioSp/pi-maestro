STATUS: TODO

# Task 13: Implement spec parsing and validation

## Dependency

This task depends on Task 12: Implement the spec template and creation.

## Objective

Parse acceptance criteria and enforce every deterministic rule for a ready spec.

## Plan references

- Section [3.2](../plan.md#plan-section-3-2), spec and acceptance criterion rules
- Section [3.2](../plan.md#plan-section-3-2), deterministic validation of `maestro_mark_spec_ready`
- Section [5](../plan.md#plan-section-5), `src/specs/parse.ts` and `src/specs/validate.ts`

## Work

1. Parse the title, four top-level sections, measurable goals, prototype entries, and acceptance criteria.
2. Validate the exact top-level section names, order, and uniqueness.
3. Reject extra top-level sections and remaining template placeholders.
4. Validate approved empty or not-applicable phrases.
5. Require sequential `AC1`, `AC2`, and later IDs.
6. Require exactly one Probe, Expected result, and Breakage per criterion.
7. Validate declared prototype paths, containment, existence, and lowercase extension.
8. Return all deterministic validation errors in a stable form.

## Implementation

Do not attempt semantic interpretation. The Maestro LLM owns semantic review and owner approval. Keep parsing separate from validation so later artifact modules can reuse the acceptance criterion IDs.

## Tests

Add Vitest unit tests with focused fixtures for every accepted and rejected rule. Cover malformed headings, duplicate sections, reordered sections, placeholders, missing goals, bad IDs, duplicate criterion fields, undeclared prototypes, path escape, uppercase extensions, and valid optional subsections. Use representative malformed-field cases instead of testing every nested field separately.

## Completion criteria

- Every deterministic rule in the plan has a test.
- A structurally valid spec returns parsed criterion IDs.
- Semantic prose is not judged by this module.
