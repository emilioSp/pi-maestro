STATUS: DONE

# Task 2: Write the documentation and README

## Dependency

This task depends on Task 1: Initialize the package structure.

## Objective

Write the human documentation for Maestro in simple English.

## Plan references

- Sections [1](../plan.md#plan-section-1) through [4](../plan.md#plan-section-4)
- Section [5](../plan.md#plan-section-5), documentation scope
- Sections [6.1](../plan.md#plan-section-6-1) through [6.26](../plan.md#plan-section-6-26)
- The approved flowchart in Section [4.2](../plan.md#plan-section-4-2)

## Work

1. Write `README.md` with the purpose, prerequisites, installation, activation, basic use, and links to detailed docs.
2. Write `docs/workflow.md` with roles, authority, the approved flowchart, workflow phases, escalation and finding decisions, final review, and the acceptance criterion simplicity principle.
3. Write `docs/configuration.md` with every supported `.pi/maestro.json` field, default, constraint, and example.
4. Write `docs/recovery.md` with restart, interrupted pass, dirty worktree, collision, inconsistency, manual abandonment, and completed `final-review` behavior.
5. Use `CONTRIBUTING.md` and `AGENTS_CONTRIBUTING.md` only for reusable explanations.

## Implementation

Treat `plan.md` as authoritative. Remove legacy ideas such as UUIDv7, allowed-path lists, helper scripts, mandatory installs, mandatory pushes, old paths, old models, post-commit confirmation, and delayed cleanup.

## Tests

1. Check every documented command, path, phase, model, and artifact against `plan.md`.
2. Check that the approved Mermaid flowchart is present.
3. Check that README contains what the software does, prerequisites, and how to use it.
4. Check all local Markdown links.

## Completion criteria

- All four documents are complete and use simple English.
- No legacy rule is presented as current behavior.
- Documentation agrees with the approved workflow and configuration.
