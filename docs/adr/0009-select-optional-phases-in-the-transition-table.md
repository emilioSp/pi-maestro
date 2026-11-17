---
type: ADR
id: 'ADR-009'
title: 'Select optional phases in the transition table'
status: active
---

## Context

The `owner` selected configuration flags to support workflows with only an approved `spec` and independently optional later agents without a separate phase-selection
interface.

## Decision

Each agent has a `required` boolean that defaults to `true`. Disabling `builder` skips all agents. Otherwise `verifier` and `simplifier` can be disabled independently.
Flags are set before activation and stay unchanged during the workflow. Keep existing configuration reads, without caching or runtime controls.

Keep destination selection in `src/workflow/transitions.ts`. A transition destination is either a fixed phase or a pure function of resolved configuration. Callers pass
configuration to `transitionWorkflow` and save its returned state. No new workflow states, events, or persisted selection fields are needed.

## Consequences

Approval can finish at `candidate-ready` without agent execution. Agent and model availability checks apply only to selected phases; activation with only an approved
`spec` needs no `pi-subagents` ping. Final summaries identify skipped work, without claiming implementation or independent verification occurred.
