STATUS: TODO

# Task 40: Add the launch-verifier tool

## Dependency

This task depends on Task 39: Add the resolve-escalation tool.

## Objective

Expose safe foreground verifier launches from a completed builder candidate.

## Plan references

- Section [3.4](../plan.md#plan-section-3-4)
- Section [5](../plan.md#plan-section-5), `src/tools/main/launch-verifier.ts`
- Sections [6.8](../plan.md#plan-section-6-8) through [6.12](../plan.md#plan-section-6-12), [6.14](../plan.md#plan-section-6-14), [6.17](../plan.md#plan-section-6-17), and [6.19](../plan.md#plan-section-6-19)

## Work

1. Define input with `specId`.
2. Call the verifier workflow to create the isolated verifier checkpoint.
3. Launch `maestro.verifier` in foreground with configured model, thinking, timeout, fresh context, and verifier worktree cwd.
4. Inspect the committed terminal handoff against the candidate commit after the child returns.
5. Return candidate-ready, findings, timeout, interrupted, product-modified, or protocol-error results distinctly.
6. Never launch a builder or another verifier automatically.

## Implementation

The prompt identifies the spec and worktree and requires applicable `AGENTS.md` reads. It must not treat the builder handoff as proof or weaken independent verification.

## Tests

Add adapter tests for input schema, launch-parameter mapping, one successful foreground result, one propagated workflow error, and one propagated delegation error. Use fake subagents.

## Completion criteria

- Every verifier uses a separate clean worktree and fresh context.
- A valid committed terminal handoff alone advances the workflow.
- Product-modified errors remain recoverable by the verifier.
