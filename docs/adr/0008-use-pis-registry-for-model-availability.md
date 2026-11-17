---
type: ADR
id: 'ADR-008'
title: "Use Pi's registry for model availability"
status: active
---

## Context

Maestro's model format regex rejected OpenRouter IDs containing additional slashes. The `owner` selected Pi as the source of truth for models and explicitly retained the
activation availability check because it uses Pi's registry.

## Decision

Treat configured models as strings without a separate format regex. During activation, match each complete `provider/model` identifier against
`context.modelRegistry.getAvailable()`, preserving slashes inside model IDs. Pass the configured identifier unchanged through `pi-subagents`.

Keep Maestro's configuration structure, version, path, thinking-level, and timeout validation.

## Consequences

A model absent from Pi's available registry prevents activation. `Maestro` maintains no separate model catalog or authentication check. Provider or authentication
failures during delegation still use the existing `run` failure path. Workflow recovery and phase transitions remain unchanged.
