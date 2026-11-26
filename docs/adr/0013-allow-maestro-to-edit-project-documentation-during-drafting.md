---
type: ADR
id: 'ADR-013'
title: 'Allow Maestro to edit project documentation during drafting'
status: active
---

## Context

- During drafting, `Maestro` can edit the active `spec` documents and prototypes, but not project documentation.
- Some changes need an ADR, a roadmap update, or other documentation before the `builder` starts.
- The `owner` has to make those edits outside the workflow or postpone them until implementation.

## Decision

- Allow `Maestro` to edit project documentation directly during `drafting-spec` when needed for the current work.
- Include `README.md`, `CHANGELOG.md`, and project documentation under `docs/`, including ADRs and roadmap entries.
- Do not require separate approval for documentation edits.
- Do not extend this permission to source code, agent instructions such as `AGENTS.md`, or workflow `artifacts` outside the existing drafting permissions.

## Alternatives considered

- **Rejected:** Allow routine documentation edits, but require `Maestro` to ask the `owner` before edits that record or change a decision.
- **Reason:** Interaction with `Maestro` must stay smooth. A separate checkpoint would interrupt `spec` drafting, even when the `owner` and `Maestro` are already
  discussing the decision.

## Consequences

- Prerequisite documentation can be ready before `GREEN FLAG`.
- Documentation edits can remain in the project even if the `spec` is never approved.
- Changelog and roadmap updates must reflect the actual state of the project. Permission to edit the docs does not make planned work complete.
