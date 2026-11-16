---
type: ADR
id: 'ADR-007'
title: 'Maintain the roadmap in the repository'
status: active
---

## Context

Supersedes [ADR-006](0006-maintain-the-roadmap-in-linear.md).

The `owner` reported excessive token use when accessing Linear and requested restoration of the Markdown roadmap. The `owner` also explicitly prohibited changes to the
Linear project.

## Decision

Maintain the roadmap under `docs/roadmap/` as the source of truth. Restore project items from Linear through read-only access, preserving existing `MAESTRO` identifiers,
scope, and evidence. Do not transfer Linear onboarding or test issues.

Keep Linear unchanged as historical reference. Routine roadmap reading and maintenance use local files, not MCP.

## Consequences

Planning no longer requires Linear access. Repository instructions, documentation audit guidance, links, and published package contents refer to the local roadmap. Later
roadmap changes do not need synchronization with Linear.

Conflicting imported status and acceptance evidence remain explicit rather than being treated as proof of final `owner` acceptance.
