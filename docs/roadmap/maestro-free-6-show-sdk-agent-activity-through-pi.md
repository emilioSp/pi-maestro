---
type: Roadmap
id: 'MAESTRO-FREE-6'
title: 'Show SDK agent activity through Pi'
status: completed
---

## Objective

Show activity for SDK-based agent `runs` through Pi's standard `onUpdate` presentation, as decided in
[ADR-010](../adr/0010-use-the-pi-sdk-for-sequential-agent-delegation.md). Requires the shared migration covered by
[MAESTRO-FREE-3](maestro-free-3-run-the-builder-through-the-pi-sdk.md), FREE-4, and FREE-5, and applies to all three roles through the common executor.

See the [specification](../../.specs/20261106-143021-maestro-free-6-show-sdk-agent-activity-through-pi/spec.md).

## Completed When

1. Progress reports the role, elapsed time, current tool, and recent normal assistant text, including activity while the agent produces no text.
2. Pi controls layout, truncation, and expansion. There is no custom renderer, fixed line count, transcript inspector, or artificial progress prompting.
3. Intermediate text stays out of the main model's context. Final workflow results, saved session contents, and cancellation behavior remain unchanged.
4. Progress subscriptions are released when the child finishes, fails, or is interrupted.
