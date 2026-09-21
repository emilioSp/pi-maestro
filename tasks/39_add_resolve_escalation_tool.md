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

1. Define input for `specId`, `expectedRevision`, `escalationId`, selected option, decision, reason, and `reviseSpec`.
2. Use provider-compatible string enums where needed.
3. Require a current unresolved escalation and a complete owner decision.
4. Call the escalation workflow without interpreting the decision text.
5. Return `ready-for-builder` details when the contract is unchanged.
6. Return drafting reset details when the owner explicitly requests spec revision.
7. Never launch the next builder automatically.

## Implementation

Do not persist `reviseSpec` in the escalation JSON. Preserve all old escalation fields except revision and resolution. The Maestro LLM must ask the owner before choosing true.

## Tests

Add Vitest adapter tests for input schema, decision mapping, one successful call, and one propagated domain error.

## Completion criteria

- The tool records only explicit owner data.
- The selected branch of the state machine is deterministic.
- A failed call leaves the artifact and state unchanged.
