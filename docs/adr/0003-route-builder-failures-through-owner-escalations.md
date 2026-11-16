---
type: ADR
id: 'ADR-003'
title: 'Route builder failures through owner escalations'
status: active
---

## Context

The `owner` must decide how work continues after a reportable technical problem. The workflow also needs a simpler model with two `builder` outcomes.

## Decision

The `builder` reports only `done` or `escalation`. Reportable technical failures use the existing `escalation` process. The `owner` decides how to proceed instead of
reaching a terminal failure phase.

## Consequences

Reuse the existing tools, numbered `handoffs`, and batch decisions. Individual `probe` results retain `failed` as a valid value.

Execution and protocol errors without a valid saved result still stop the workflow. This decision adds no automatic recovery.

This breaking MVP change has no migrations, compatibility readers, deprecated aliases, or dedicated legacy-format tests.
