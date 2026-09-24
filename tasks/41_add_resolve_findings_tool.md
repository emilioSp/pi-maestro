STATUS: TODO

# Task 41: Add the resolve-findings tool

## Dependency

This task depends on Task 40: Add the launch-verifier tool.

## Objective

Let the owner decide what to do with every current verifier finding.

## Plan references

- Section [3.6](../plan.md#plan-section-3-6)
- Section [5](../plan.md#plan-section-5), `src/tools/main/resolve-findings.ts`
- Sections [6.10](../plan.md#plan-section-6-10), [6.14](../plan.md#plan-section-6-14), and [6.25](../plan.md#plan-section-6-25)

## Work

1. Define input with `specId` and one decision for each finding.
2. Use `StringEnum` for `reject` and `fix-code`.
3. Require a reason only when the owner rejects a finding.
4. Check that the input covers every finding exactly before changing anything.
5. Call the findings workflow. Return details for either a candidate or builder corrections.
6. Report which rejections were recorded and which findings still need action.
7. Do not guess the owner's decisions or launch another agent automatically.

## Implementation

Keep the Pi adapter thin. If any decision is `fix-code`, it takes priority over `reject` decisions. If the owner wants to change the approved contract, do not call this tool. Explain that the owner must abandon the workflow manually.

## Tests

Add Vitest adapter tests for the input schema, decision mapping, one successful call, and one domain error returned to the tool caller.

## Completion criteria

- One valid call handles every current finding exactly once.
- Mixed `reject` and `fix-code` decisions follow the approved priority.
- The tool changes only the allowed rejection fields in findings.
