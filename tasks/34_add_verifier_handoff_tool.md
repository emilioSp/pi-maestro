STATUS: TODO

# Task 34: Add the verifier handoff tool

## Dependency

This task depends on Task 33: Add the open escalation tool.

## Objective

Expose the child-only terminal tool for verifier evidence and findings.

## Plan references

- Sections [3.4](../plan.md#plan-section-3-4) and [3.6](../plan.md#plan-section-3-6)
- Section [5](../plan.md#plan-section-5), `src/tools/child/record-verifier-handoff.ts`
- Sections [6.10](../plan.md#plan-section-6-10), [6.11](../plan.md#plan-section-6-11), [6.14](../plan.md#plan-section-6-14), [6.15](../plan.md#plan-section-6-15), and [6.25](../plan.md#plan-section-6-25)

## Work

1. Define the closed TypeBox input schema without protocol identity fields.
2. Derive spec ID and terminal revision.
3. Validate regenerated criteria and findings internally without parsing the current spec.
4. Run the product-file comparison against the recorded candidate commit.
5. Return the exact structured `PRODUCT_FILES_MODIFIED` error when needed.
6. Write verifier handoff and `findings-decision` or `candidate-ready` state only after all checks pass.
7. Return instructions to commit both files together.

## Implementation

The product-modified error contains only `PRODUCT_FILES_MODIFIED` and a clear message. Do not expose file lists, diff summaries, or suggested commands. Do not restore, delete, move, stage, or commit product files.

## Tests

Add Vitest adapter tests for input schema validation, derived protocol fields, one successful call, and propagation of the product-modified domain error.

## Completion criteria

- Product changes always block the terminal handoff.
- The tool behaves the same for empty and non-empty findings.
- The verifier cannot forge identity, revision, or owner rejection.
