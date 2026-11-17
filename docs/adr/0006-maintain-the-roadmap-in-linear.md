---
type: ADR
id: 'ADR-006'
title: 'Maintain the roadmap in Linear'
status: superseded
---

## Context

Superseded by [ADR-007](0007-maintain-the-roadmap-in-the-repository.md).

The `owner` moved roadmap items from the repository to Linear, selected the dedicated `MAESTRO` team, and requested removal of the local roadmap file and redundant
identifiers. This moves the source of truth for planning outside Git.

## Decision

Maintain the roadmap only in [Linear](https://linear.app/emilio-spatola/team/MAESTRO/overview), using Linear issue identifiers. Keep the roadmap location and maintenance
instructions in `AGENTS.md`, without a local copy of the issue list.

Approved `specifications`, verification evidence, the changelog, and architectural decisions remain in the repository.

## Consequences

Reading or updating current roadmap state requires Linear access. Git history remains evidence of earlier plans, not the current roadmap. Imported issues retain
commit-pinned links to repository evidence. Removing the local roadmap also removes it from the published package.
