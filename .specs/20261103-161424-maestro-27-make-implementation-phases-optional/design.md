# MAESTRO-27: Configuration-aware workflow transitions

## Decisions

Keep phase selection centralized in [src/workflow/transitions.ts](../../src/workflow/transitions.ts). Extend `WorkflowTransition.to` to accept either a fixed phase or a pure destination function of the resolved configuration. Only `MARK_SPEC_READY`, `BUILDER_DONE`, `VERIFIER_DONE`, and `OWNER_REJECT_FINDINGS` need calculated destinations for [REQ2](spec.md#req2-skip-all-implementation-when-builder-is-disabled), [REQ3](spec.md#req3-skip-verification-independently), and [REQ4](spec.md#req4-skip-simplification-independently).

This preserves the existing transition table and source-phase validation without adding a second routing mechanism. Leave other destinations unchanged. Do not add workflow states, events, or fields to `workflow.json` for phase selection.

For [REQ6](spec.md#req6-check-availability-only-for-enabled-phases), keep activation checks in [assertEnvironment.ts](../../src/maestro/checks/assertEnvironment.ts): load configuration before agent checks, return early when builder is disabled, otherwise filter the agent list by `required` and reuse the existing checks. This needs no additional state-machine logic or new abstraction.

## Contracts

Use `transitionWorkflow({ state, event, config })`, with `config` being the resolved Maestro configuration already loaded by the caller. Keep this function pure: no configuration loading, file operations, or mutation of its inputs.

Pass the resolved configuration through the affected main and child callers. Keep existing configuration reads rather than introducing caching. Callers continue saving the state returned by `transitionWorkflow`; they do not calculate or assign alternative phases themselves.

Update affected tool result validation, messages, and Maestro guidance to follow the returned phase rather than assume the next agent is always enabled. This also lets the existing completion handling recognize `candidate-ready` on the newly shortened routes.
