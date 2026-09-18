STATUS: TODO

# Task 38: Add the launch-builder tool

## Dependency

This task depends on Task 37: Add the inspect-workflow tool.

## Objective

Expose safe foreground builder launches from approved workflow state.

## Plan references

- Sections [3.3](../plan.md#plan-section-3-3) and [5](../plan.md#plan-section-5), `src/tools/main/launch-builder.ts`
- Sections [6.8](../plan.md#plan-section-6-8) through [6.10](../plan.md#plan-section-6-10), [6.14](../plan.md#plan-section-6-14), [6.17](../plan.md#plan-section-6-17), [6.19](../plan.md#plan-section-6-19), [6.22](../plan.md#plan-section-6-22), and [6.23](../plan.md#plan-section-6-23)

## Work

1. Define input with `specId`, `expectedRevision`, and an explicit retry intent when required.
2. Call the builder workflow to validate state and create the launch checkpoint.
3. Launch `maestro.builder` in foreground with the configured model, thinking, timeout, fresh context, and worktree cwd.
4. Correlate the request with the workflow revision.
5. Inspect and validate the terminal outcome after the child returns.
6. Return done, failed, escalation, timeout, interrupted, or protocol-error results distinctly.
7. Never relaunch automatically.

## Implementation

The launch prompt identifies the spec and worktree and requires applicable `AGENTS.md` reads. Do not restate or weaken the agent role. Do not install dependencies. Keep the owner blocked while the foreground run is active.

## Tests

Use fake subagents for first pass, resumed escalation pass, correction pass, explicit retry, done, failed, escalation, timeout, cancellation, missing terminal handoff, dirty returned worktree, uncommitted handoff, and mismatched correlation.

## Completion criteria

- Every launch has a committed `builder-running` checkpoint.
- Only a committed valid terminal artifact advances the workflow.
- Failures leave enough state for recovery.
