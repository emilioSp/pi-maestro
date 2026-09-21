STATUS: TODO

# Task 39: Add the resolve-escalation tool

## Dependency

This task depends on Task 38: Add the launch-builder tool.

## Objective

Expose explicit owner resolution of the current builder escalation.

## Plan references

- Section [3.5](../plan.md#plan-section-3-5)
- Section [5](../plan.md#plan-section-5), `src/tools/main/resolve-escalation.ts`
- Sections [6.10](../plan.md#plan-section-6-10), [6.14](../plan.md#plan-section-6-14), and [6.15](../plan.md#plan-section-6-15)

## Work

1. Define input for `specId`, `expectedRevision`, `escalationId`, selected option, decision, and reason.
2. Use provider-compatible string enums where needed.
3. Require a current unresolved escalation and a complete owner decision.
4. Call the escalation workflow without interpreting the decision text.
5. Return `ready-for-builder` details.
6. Never launch the next builder automatically.

## Implementation

Preserve all old escalation fields except revision and resolution. If the owner wants to change the approved contract, do not call this tool; explain that the workflow must be abandoned manually.

## Tests

Add Vitest adapter tests for input schema, decision mapping, one successful call, and one propagated domain error.

## Completion criteria

- The tool records only explicit owner data.
- A valid resolution always returns to `ready-for-builder`.
- A failed call leaves the artifact and state unchanged.
