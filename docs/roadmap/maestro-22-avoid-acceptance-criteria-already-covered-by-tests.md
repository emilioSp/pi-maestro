---
type: Roadmap
id: 'MAESTRO-22'
title: 'Avoid acceptance criteria already covered by tests'
status: completed
---

## Objective

Avoid duplicating `acceptance criteria` whose exact scenarios already have test coverage.

## Completed When

- `Maestro` inspects existing tests before writing criteria and during `spec` review.
- A criterion is omitted only when a test covers the same starting conditions, action, and expected outcome. Partial or uncertain coverage is not enough.
- Required behavior remains in the requirements and constraints. Criterion numbering and references stay consistent, including after revisions.
