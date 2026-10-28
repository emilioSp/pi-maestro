# 20261013-185941-verify-code-quality-against-agents-md-instructions: Verify code quality against AGENTS.md instructions

> After owner approval, this specification is the contract for the builder and verifier.

## Context, goals, and scope

Implement R-16 from `ROADMAP.md`. Add explicit code-quality review when applicable `AGENTS.md` code-quality directives are present.

The current guidance requires reading those files and following technical rules. It does not explicitly require reviewing candidate code for instruction violations.

Product changes are limited to `agents/verifier.md`. Documentation, tests, schemas, tools, dependencies, and other product files remain unchanged. Preserve the owner's existing `ROADMAP.md` changes.

## Documents

Required behavior and acceptance criteria: [spec.md](spec.md).

Technical decisions: [design.md](design.md).

## Historical references

Original REQ and AC identifiers are retained so saved handoffs keep referring to the same requirements and scenarios. ACs have not been renumbered to match the reorganized document order.
