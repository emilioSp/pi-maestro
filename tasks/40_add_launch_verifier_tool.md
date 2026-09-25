STATUS: TODO

# Task 40: Add the launch-verifier tool

## Dependency

This task depends on Task 39: Add the resolve-escalation tool.

## Objective

Launch a verifier in the foreground on the current branch from a completed builder candidate.

## Plan references

- Section [3.4](../plan.md#plan-section-3-4)
- Section [5](../plan.md#plan-section-5), `src/tools/main/launch-verifier.ts`
- Sections [6.8](../plan.md#plan-section-6-8) through [6.12](../plan.md#plan-section-6-12), [6.14](../plan.md#plan-section-6-14), [6.17](../plan.md#plan-section-6-17), and [6.19](../plan.md#plan-section-6-19)

## Work

1. Define input with `specId` only. Do not accept a verifier pass number or worktree path.
2. Call the verifier workflow to validate the current checkout and commit the `verifier-running` checkpoint on the current branch.
3. Treat the parent of the checkpoint `HEAD` as the candidate commit.
4. Launch `maestro.verifier` in the foreground. Pass its configured model, thinking level, timeout, fresh context, current checkout, and explicit `specId`.
5. When the child returns, validate the tool-managed final handoff against the candidate parent commit.
6. Return distinct results for candidate ready, findings, timeout, interruption, product changes, and protocol error.
7. Do not launch a builder or another verifier automatically.

## Implementation

Use `pi-subagents/delegation` directly in this Pi tool adapter and pass `agent: "maestro.verifier"`. pi-subagents loads the agent definition from `agents/verifier.md`.

Before sending the launch request, register a listener for the final response on the injected `pi.events`. Match the response to the request. Remove the listener when the request ends.

Do not listen for progress updates. FleetView shows the live status and transcript. The `task` must identify the spec and current checkout and tell the verifier to read applicable `AGENTS.md` files. Do not treat the builder handoff as proof. Do not weaken the verifier's independent review. Do not ask the verifier to run Git commits.

## Tests

Add adapter tests for the input schema, current-checkout launch parameters, explicit spec identity, response matching, listener cleanup, one successful foreground result, one findings result, one product-change result, one workflow error, and one delegation error. Use a fake Pi event bus and fake subagent responses.

## Completion criteria

- Every verifier starts from a committed `verifier-running` checkpoint on the current branch.
- The parent of the checkpoint `HEAD` is used as the candidate.
- There is one current `verifier.json` and no verifier pass number or separate resource.
- Only a valid tool-managed final handoff advances the workflow.
- Product-change errors leave the current workflow available for an explicit follow-up.
