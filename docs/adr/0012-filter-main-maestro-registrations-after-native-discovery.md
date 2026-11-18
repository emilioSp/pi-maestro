---
type: ADR
id: 'ADR-012'
title: 'Filter main Maestro registrations after native discovery'
status: active
---

## Context

Supersedes only the pre-load exclusion constraint in [ADR-010](0010-use-the-pi-sdk-for-sequential-agent-delegation.md).

Child preparation duplicated Pi's package discovery to exclude the main `Maestro` extension before initialization.

## Decision

Use Pi's native discovery and configured selection. Filter the loaded main `Maestro` extension through `extensionsOverride` before constructing the child session.

## Consequences

Main-extension initialization may register tools, commands, and handlers, but must not mutate parent state or start resources before filtering. SDK sessions share a
process; filtering removes registrations from the child runtime, not initialization side effects.
