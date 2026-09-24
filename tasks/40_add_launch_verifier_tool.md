STATUS: TODO

# Task 40: Add the launch-verifier tool

## Dependency

This task depends on Task 39: Add the resolve-escalation tool.

## Objective

Launch a verifier in the foreground from a completed builder candidate.

## Plan references

- Section [3.4](../plan.md#plan-section-3-4)
- Section [5](../plan.md#plan-section-5), `src/tools/main/launch-verifier.ts`
- Sections [6.8](../plan.md#plan-section-6-8) through [6.12](../plan.md#plan-section-6-12), [6.14](../plan.md#plan-section-6-14), [6.17](../plan.md#plan-section-6-17), and [6.19](../plan.md#plan-section-6-19)

## Work

1. Define input with `specId`.
2. Call the verifier workflow to create a separate verifier checkpoint.
3. Launch `maestro.verifier` in the foreground. Pass its configured model, thinking level, timeout, fresh context, and verifier worktree path.
4. When the child returns, check its committed final handoff against the candidate commit.
5. Return distinct results for candidate ready, findings, timeout, interruption, product changes, and protocol error.
6. Do not launch a builder or another verifier automatically.

## Implementation

Use `pi-subagents/delegation` directly in this Pi tool adapter and pass `agent: "maestro.verifier"`. pi-subagents loads the agent definition from `agents/verifier.md`.

Before sending the launch request, register a listener for the final response on the injected `pi.events`. Match the response to the request. Remove the listener when the request ends.

Do not listen for progress updates. FleetView shows the live status and transcript. The `task` must identify the spec and worktree and tell the verifier to read applicable `AGENTS.md` files. Do not treat the builder handoff as proof. Do not weaken the verifier's independent review.

## Tests

Add adapter tests for the input schema, launch parameters, response matching, listener cleanup, one successful foreground result, one workflow error, and one delegation error. Use a fake Pi event bus and fake subagent responses.

## Completion criteria

- Every verifier uses a separate clean worktree and fresh context.
- Only a valid committed final handoff advances the workflow.
- Product-change errors leave the workflow ready for recovery by the verifier.
