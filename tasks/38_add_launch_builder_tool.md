STATUS: TODO

# Task 38: Add the launch-builder tool

## Dependency

This task depends on Task 36: Add the create-spec and mark-ready tools.

## Objective

Launch a builder in the foreground on the current checkout and current branch.

## Plan references

- Sections [3.3](../plan.md#plan-section-3-3) and [5](../plan.md#plan-section-5), `src/tools/main/launch-builder.ts`
- Sections [6.8](../plan.md#plan-section-6-8) through [6.10](../plan.md#plan-section-6-10), [6.14](../plan.md#plan-section-6-14), [6.17](../plan.md#plan-section-6-17), [6.19](../plan.md#plan-section-6-19), [6.22](../plan.md#plan-section-6-22), and [6.23](../plan.md#plan-section-6-23)

## Work

1. Define input with `specId` and, when needed, an explicit retry choice.
2. Call the builder workflow to check the current state, create a current-branch launch checkpoint, and set the expected `spec.md` SHA in live session state immediately before delegation.
3. Do not create, switch, or validate a branch or worktree.
4. Launch `maestro.builder` in the foreground. Pass its configured model, thinking level, timeout, fresh context, current checkout, and explicit `specId`.
5. When the child returns, inspect and validate its final result.
6. Return distinct results for done, failed, escalation, timeout, interruption, and protocol error.
7. Never relaunch the builder automatically.

## Implementation

Use `pi-subagents/delegation` directly in this Pi tool adapter and pass `agent: "maestro.builder"`. pi-subagents loads the agent definition from `agents/builder.md`.

Before sending the launch request, register a listener for the final response on the injected `pi.events`. Match the response to the request. Remove the listener when the request ends.

Do not listen for progress updates. FleetView shows the live status and transcript. The `task` must identify the spec and current checkout and tell the builder to read applicable `AGENTS.md` files. Do not restate or weaken the builder's role. Do not install dependencies. Keep the owner waiting while the foreground run is active.

## Tests

Add adapter tests for the input schema, current-checkout launch parameters, explicit spec identity, response matching, listener cleanup, one successful foreground result, one workflow error, and one delegation error. Use a fake Pi event bus and fake subagent responses.

## Completion criteria

- Every launch has a committed `builder-running` checkpoint and an expected live `spec.md` SHA.
- An explicit retry recalculates and replaces the expected SHA before delegation.
- A spec revision gets a new baseline only after the owner approves it.
- Only a valid committed final artifact advances the workflow.
- Failures leave the current session state available for an explicit follow-up.
