STATUS: TODO

# Task 39: Add the resolve-escalation tool

## Dependency

This task depends on Task 38: Add the launch-builder tool.

## Objective

Let the owner decide how to resolve the current builder escalation.

## Plan references

- Section [3.5](../plan.md#plan-section-3-5)
- Section [5](../plan.md#plan-section-5), `src/tools/main/resolve-escalation.ts`
- Sections [6.10](../plan.md#plan-section-6-10), [6.14](../plan.md#plan-section-6-14), and [6.15](../plan.md#plan-section-6-15)

## Work

1. Define input for `specId`, `escalationId`, the chosen option, the owner's decision, and the reason.
2. Use provider-compatible string enums where needed.
3. Require a current unresolved escalation and a complete owner decision.
4. Pass the decision to the escalation workflow. Do not interpret its text.
5. Return the details for the `ready-for-builder` state.
6. Do not launch the next builder automatically.

## Implementation

Keep every old escalation field except `revision` and `resolution`. If the owner wants to change the approved contract, do not call this tool. Explain that the owner must abandon the workflow manually.

## Tests

Add Vitest adapter tests for the input schema, decision mapping, one successful call, and one domain error returned to the tool caller.

## Completion criteria

- The tool records only decisions the owner gave explicitly.
- A valid resolution always moves the workflow to `ready-for-builder`.
- A failed call leaves the artifact and workflow state unchanged.
