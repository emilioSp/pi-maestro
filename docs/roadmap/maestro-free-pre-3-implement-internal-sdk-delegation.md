---
type: Roadmap
id: 'MAESTRO-FREE-PRE-3'
title: 'Implement internal SDK delegation'
status: completed
---

## Objective

Implement and verify one internal execution operation using `createAgentSession()`, following [ADR-010](../adr/0010-use-the-pi-sdk-for-sequential-agent-delegation.md).
The operation is independent of the `builder`, `verifier`, and `simplifier` roles. Callers supply the task, role instructions, model settings, working directory, and
additional tools needed for that execution.

Requires [MAESTRO-FREE-1](maestro-free-1-require-pi-150.md) and [MAESTRO-FREE-2](maestro-free-2-remove-maestro-run-timeouts.md). This item implements the execution
mechanism without switching existing workflow tools away from `pi-subagents`. FREE-3, FREE-4, and FREE-5 connect the three roles to it together after it is verified.

The executor manages child sessions, not the workflow. It does not select phases, interpret role outcomes, or validate `handoffs`. Those responsibilities remain with the
callers and existing workflow operations. Communication remains task-and-`handoff`, without shared in-memory workflow state or a live supervisor dialogue. This is not a
new public tool or a general-purpose orchestration framework. Live progress presentation remains in
[MAESTRO-FREE-6](maestro-free-6-show-sdk-agent-activity-through-pi.md).

See the [specification](../../.specs/20261105-212231-implement-internal-pi-sdk-delegation/spec.md).

## Completed When

1. The operation executes a supplied task in a fresh SDK conversation with the supplied model and thinking level, role guidance, global and project instructions, skills,
   working tools, and caller-supplied additional tools. It does not depend on any of the three workflow roles.
2. Enabled global and project extensions and native Pi tool support load as defined in ADR-010, excluding the main `Maestro` extension. The main session retains its
   `Maestro` mode while the child executes. No compatibility adapters, integration health gates, or delegation-prevention tool filters are added.
3. Execution waits for the child to finish, fail, or be interrupted before another child starts. The executor imposes no automatic deadline and does not start a new
   session to retry or repair failed work.
4. Manual cancellation reaches `session.abort()` and waits for interruption. Sessions, subscriptions, and owned resources are released on every exit, without rollback,
   workflow changes, or synthetic `handoffs`. Execution errors propagate to the caller.
5. Native Pi sessions are persisted in `subagents/` beneath Pi's project session directory, resolved through Pi's API. The saved path is available to the caller on
   completion or failure when a file exists. Every execution starts fresh; no automatic resumption is introduced.
6. Successful execution, execution failure, cancellation, context and tool loading, and session persistence are verified independently of the workflow migration. The
   existing three role tools still use `pi-subagents` at the end of this item.
