# 20261016-090319-add-a-dedicated-simplifier-after-verification: Add a dedicated simplifier after verification

> Draft. The owner has not approved this specification.

## Context, goals, and scope

Implement R-21. Each agent has one purpose: the builder implements the approved spec, the verifier independently checks its acceptance criteria, and the simplifier refactors accepted code.

The simplifier makes code easier to understand, modify, and debug. Fewer lines are not the goal. The owner retains final review.

### Out of scope

No additional verification cycle, findings, escalations, automatic commits, Git checkpoints, spec-specific change tracking, dependency changes, or automatic workflow recovery.

## Documents

Required behavior and acceptance criteria: [spec.md](spec.md).

Technical decisions: [design.md](design.md).

## Historical references

Original REQ and AC identifiers are retained so saved handoffs keep referring to the same requirements and scenarios. ACs have not been renumbered to match the reorganized document order.
