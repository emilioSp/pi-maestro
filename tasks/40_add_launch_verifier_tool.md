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

1. Define input with `specId` and `expectedRevision`.
2. Call the verifier workflow to create the next isolated verifier checkpoint.
3. Launch `maestro.verifier` in foreground with configured model, thinking, timeout, fresh context, and verifier worktree cwd.
4. Correlate the run with revision and candidate commit.
5. Inspect the committed terminal handoff after the child returns.
6. Return candidate-ready, findings, timeout, interrupted, product-modified, or protocol-error results distinctly.
7. Never launch a builder or another verifier automatically.

## Implementation

The prompt identifies the spec and worktree and requires applicable `AGENTS.md` reads. It must not include builder observations as proof or weaken independent verification.

## Tests

Use fake subagents for empty findings, findings, product changes, timeout, cancellation, missing handoff, dirty returned worktree, uncommitted handoff, wrong revision, wrong candidate correlation, and multiple verifier sequence numbers.

## Completion criteria

- Every verifier uses a separate clean worktree and fresh context.
- A valid committed terminal handoff alone advances the workflow.
- Product-modified errors remain recoverable by the verifier.
