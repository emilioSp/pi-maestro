# 20261008-132344-store-escalations-in-builder-handoffs: Store escalations in builder handoffs

## Context, goals, and scope

An escalation is a question that needs an owner decision.
Store multiple escalations and their owner resolutions inside each numbered builder handoff.
Use the same storage, local ID, and batch decision model as verifier findings.
A separate escalation directory is not part of the workflow model.

Change the affected artifact contracts, workflow operations, tools, runtime agent instructions, and tests.

### Out of scope

Human documentation updates are excluded. Leave `README.md` and `docs/` unchanged.
Backward compatibility, migration, fallback readers, and deprecated tool aliases are excluded.
Model the implementation as if standalone escalation storage never existed. Remove obsolete storage code and its tests.

## Documents

Required behavior and acceptance criteria: [spec.md](spec.md).

Technical decisions: [design.md](design.md).

## Historical references

Original REQ and AC identifiers are retained so saved handoffs keep referring to the same requirements and scenarios. ACs have not been renumbered to match the reorganized document order.
