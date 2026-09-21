STATUS: TODO

# Task 41: Add the resolve-findings tool

## Dependency

This task depends on Task 40: Add the launch-verifier tool.

## Objective

Expose complete owner decisions for the current verifier findings.

## Plan references

- Section [3.6](../plan.md#plan-section-3-6)
- Section [5](../plan.md#plan-section-5), `src/tools/main/resolve-findings.ts`
- Sections [6.10](../plan.md#plan-section-6-10), [6.14](../plan.md#plan-section-6-14), and [6.25](../plan.md#plan-section-6-25)

## Work

1. Define input for `specId`, `expectedRevision`, and one decision per finding.
2. Use `StringEnum` for `reject` and `fix-code`.
3. Require reasons only for rejected findings.
4. Validate exact finding coverage before any mutation.
5. Call the findings workflow and return candidate or builder-correction details.
6. Report which rejections were recorded and which findings remain actionable.
7. Never infer decisions or launch another agent automatically.

## Implementation

Keep the adapter thin. Any fix-code decision has precedence over all-reject. If the owner wants to change the approved contract, do not call this tool; explain that the workflow must be abandoned manually.

## Tests

Add Vitest adapter tests for input schema, decision mapping, one successful call, and one propagated domain error.

## Completion criteria

- One valid call handles every current finding exactly once.
- Mixed reject and fix-code outcomes follow approved precedence.
- The tool does not rewrite findings beyond allowed rejection fields.
