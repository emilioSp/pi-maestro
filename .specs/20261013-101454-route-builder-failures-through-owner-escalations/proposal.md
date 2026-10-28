# 20261013-101454-route-builder-failures-through-owner-escalations: Route builder failures through owner escalations

> After owner approval, this specification is the contract for the builder and verifier.

## Context, goals, and scope

R-03 in `ROADMAP.md` routes reportable builder failures through owner escalations. The owner decides how to proceed instead of reaching a terminal failure phase.

The change covers the builder report contract, finite-state machine, tools, status presentation, agent instructions, tests, and current documentation, including `ROADMAP.md`.

### Out of scope

Automatic recovery, rollback, reconciliation, and changes to verifier responsibilities are outside this change. Historical approved specs and handoffs remain unchanged.

## Documents

Required behavior and acceptance criteria: [spec.md](spec.md).

Technical decisions: [design.md](design.md).

## Historical references

Original REQ and AC identifiers are retained so saved handoffs keep referring to the same requirements and scenarios. ACs have not been renumbered to match the reorganized document order.
