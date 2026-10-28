# 20261013-194407-check-pi-subagents-availability-with-ping-at-activation: Check pi-subagents availability with ping at activation

> After owner approval, this specification is the contract for the builder and verifier.

## Context, goals, and scope

R-06 identifies a gap in activation checks. Agent discovery can succeed even when the pi-subagents extension is not loaded in the current Pi process.

Add a quick availability check when `/maestro` turns Maestro on. The owner selected the existing pi-subagents `ping` protocol. The check must not run an agent.

### Out of scope

Child execution checks, child extension availability, configuration changes, dependency changes, and delegation recovery are excluded. A successful ping confirms only that the parent extension responds.

Do not test the pi-subagents ping implementation. That package owns its tests. Verification of this change covers Maestro's consumer behavior using controlled replies or no reply, not a live pi-subagents responder. Reuse existing tests when they already cover an acceptance criterion. Do not add duplicate tests. Every criterion still requires verification, but not a new test.

## Documents

Required behavior and acceptance criteria: [spec.md](spec.md).

Technical decisions: [design.md](design.md).

## Historical references

Original REQ and AC identifiers are retained so saved handoffs keep referring to the same requirements and scenarios. ACs have not been renumbered to match the reorganized document order.
