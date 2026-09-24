STATUS: TODO

# Task 34: Add the verifier handoff tool

## Dependency

This task depends on Task 33: Add the open-escalation tool.

## Objective

Let the verifier record its evidence and findings through a child-only tool.

## Plan references

- Sections [3.4](../plan.md#plan-section-3-4) and [3.6](../plan.md#plan-section-3-6)
- Section [5](../plan.md#plan-section-5), `src/tools/child/record-verifier-handoff.ts`
- Sections [6.10](../plan.md#plan-section-6-10), [6.11](../plan.md#plan-section-6-11), [6.14](../plan.md#plan-section-6-14), [6.15](../plan.md#plan-section-6-15), and [6.25](../plan.md#plan-section-6-25)

## Work

1. Define a closed TypeBox input schema. Do not include protocol identity fields.
2. Get the spec ID and final revision from the current workflow state.
3. Validate the regenerated criteria and findings inside the domain. Do not parse the current spec.
4. Compare product files with the recorded candidate commit.
5. If product files changed, return the exact structured `PRODUCT_FILES_MODIFIED` error.
6. Only after all checks pass, write the verifier handoff and move the workflow to `findings-decision` or `candidate-ready`.
7. Tell the verifier to use Bash and Git to commit the handoff and workflow state together.

## Implementation

The product-change error must contain only `PRODUCT_FILES_MODIFIED` and a clear message. Do not show file names, diff summaries, or suggested commands. Do not restore, delete, move, stage, or commit product files. After the product-file check passes, the verifier uses Bash and Git to commit only the handoff and workflow state. The tool does not commit.

## Tests

Add Vitest adapter tests for input validation, protocol fields read from workflow state, one successful call, and one product-change error returned to the tool caller.

## Completion criteria

- Product changes always block the final handoff.
- The tool behaves the same when findings are empty or non-empty.
- The verifier cannot choose the identity, revision, or owner rejection.
