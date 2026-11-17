---
type: Roadmap
id: 'MAESTRO-FREE-3'
title: 'Run the builder through the Pi SDK'
status: completed
---

## Objective

Run the `builder` through the shared Pi SDK executor from [MAESTRO-FREE-PRE-3](maestro-free-pre-3-implement-internal-sdk-delegation.md), following
[ADR-010](../adr/0010-use-the-pi-sdk-for-sequential-agent-delegation.md).

Migrate all three roles together with [FREE-4](maestro-free-4-run-the-verifier-through-the-pi-sdk.md) and
[FREE-5](maestro-free-5-run-the-simplifier-through-the-pi-sdk.md), using one executor without mixed-engine routing. Live progress is covered separately by
[FREE-6](maestro-free-6-show-sdk-agent-activity-through-pi.md).

See the [specification](../../.specs/20261106-092601-feat-migrate-builder-verifier-and-simplifier-to-the-pi-sdk/spec.md).

## Completed When

1. An approved `spec` can be implemented by an SDK `builder` with fresh conversation history, the configured model and thinking level, role guidance, global and project
   instructions, skills, working tools, and existing `handoff` tools.
2. It reuses the established executor's context and tool loading without another execution mechanism. Role instructions continue to forbid further delegation.
3. `done` and `escalation` outcomes preserve existing saved `handoffs`, validation, phase transitions, and subsequent workflow routes. A later `builder` `pass` starts
   fresh and reads saved decisions rather than restoring the previous conversation.
4. Errors stop the workflow without rollback or repair. Manual cancellation reaches `session.abort()`, and child sessions and subscriptions are cleaned up on every exit.
5. Native Pi session files are saved beneath the project's Pi session directory in `subagents/`. The `owner` receives the saved path on completion or failure when a file
   exists; it can be inspected or exported with Pi, without automatic resumption.
6. Existing trust, configuration, and model checks remain applicable. Activation and execution no longer require `pi-subagents` ping or launch-contract checks for any
   role. A `builder`-only workflow uses the SDK without requiring a `pi-subagents` availability reply.
7. Each `run` waits for its child to finish or be interrupted before another starts. Existing optional-phase behavior remains intact.
