# 20261013-101454-route-builder-failures-through-owner-escalations: Route builder failures through owner escalations

> After owner approval, this specification is the contract for the builder and verifier.

## 1. Context, goals, and scope

R-03 in `ROADMAP.md` routes reportable builder failures through owner escalations. The owner decides how to proceed instead of reaching a terminal failure phase.

The change covers the builder report contract, finite-state machine, tools, status presentation, agent instructions, tests, and current documentation, including `ROADMAP.md`.

### Out of scope

Automatic recovery, rollback, reconciliation, and changes to verifier responsibilities are outside this change. Historical approved specs and handoffs remain unchanged.

## 2. Requirements and constraints

### Builder outcomes

The builder has only `done` and `escalation` handoff outcomes. Remove the `failed` handoff variant and its `failure` object.

When a technical problem prevents completion and the builder can safely report it, the builder stops and submits an escalation. Use existing escalation fields for the reason, evidence, owner question, options, consequences, and next steps. Do not add a separate failure subtype or storage format.

Escalations retain actual probe results: `passed`, `failed`, or `not-run`. An escalation remains valid when every acceptance probe passes but another required check prevents completion. A `done` handoff still requires every recorded probe to pass and `escalations: []`.

### Current finite-state machine

Remove the `builder-failed` phase and event, their transition, and their status mappings. Do not add a replacement failure phase.

Keep these builder paths:

| Starting phase | Action or outcome | Resulting phase |
|---|---|---|
| `ready-for-builder` | Start the builder | `builder-running` |
| `builder-running` | Save an escalation | `escalation-decision` |
| `escalation-decision` | Resolve every question with the contract unchanged | `ready-for-builder` |
| `escalation-decision` | Approve a revised spec | `ready-for-builder` |
| `builder-running` | Save a done handoff | `ready-for-verifier` |

Other supported transitions remain unchanged. Retain the existing owner decision process, numbered handoffs, and fresh foreground runs.

### Execution and protocol errors

Launch errors, delegation failures, timeouts, interruptions, cancellations, and missing or invalid handoffs retain their current error and stop behavior. They do not create synthetic escalations or recovery transitions.

When a run enters `builder-running` but never saves a completed transition, that saved phase remains unchanged. Partial protocol writes still require manual follow-up.

### Current guidance

Runtime agent instructions, tool descriptions, status presentation, tests, and current human documentation must describe the supported flow. Technical problems that the builder can report use escalations. Execution and protocol errors without a valid saved result still stop the workflow.

Remove obsolete failure-outcome code, fixtures, tests, and instructions rather than retaining a deprecated branch. Do not rewrite historical records to describe the new behavior.

### Test coverage

Do not write new tests when current tests already cover an acceptance criterion. Use those tests as evidence. Update an existing test only when this change requires it. Add a new test only for a coverage gap that existing tests do not cover.

## 3. Technical decisions

### Reuse the existing escalation path

`src/workflow/builder/completeBuilderPass.ts` saves the handoff and applies the workflow transition. `src/workflow/escalation/resolveEscalations.ts` already records owner decisions and permits another builder pass.

Keep these responsibilities and the existing escalation data contract. No new tool or workflow phase is needed.

`src/tools/main/run-builder.ts` checks execution errors through `src/tools/utils/pi-subagent-delegation.ts` before reading a saved outcome. Preserve this boundary instead of adding recovery behavior.

### Compatibility

This is a breaking MVP change. Treat the current model as if the removed outcome and phase never existed. Do not add migrations, compatibility readers, deprecated aliases, or dedicated legacy-format tests. Keep existing artifact version values unchanged.

## 4. Acceptance criteria

### AC1: The current state machine exposes exactly eight phases

1. Probe: Inspect the supported phase definitions, their schema, and the finite-state machine after the change.
2. Expected result: The supported phase set is exactly `drafting-spec`, `ready-for-builder`, `builder-running`, `escalation-decision`, `ready-for-verifier`, `verifier-running`, `findings-decision`, and `candidate-ready`.
3. Example: The sample workflow `20260321-143052-add-weather-alerts` is in `builder-running`. Enumerate the current contract's supported phases. The result is exactly `drafting-spec`, `ready-for-builder`, `builder-running`, `escalation-decision`, `ready-for-verifier`, `verifier-running`, `findings-decision`, and `candidate-ready`.

### AC2: The current state machine exposes exactly ten events

1. Probe: Inspect the supported event definitions and registered workflow transitions after the change.
2. Expected result: The supported event set is exactly `mark-spec-ready`, `run-builder`, `open-escalation`, `resolve-escalation`, `builder-done`, `run-verifier`, `verifier-found-findings`, `verifier-approved`, `reject-findings`, and `request-fixes`.
3. Example: The sample workflow `20260321-143052-add-weather-alerts` is in `builder-running`. Enumerate the current machine's transition event keys. The result is exactly `mark-spec-ready`, `run-builder`, `open-escalation`, `resolve-escalation`, `builder-done`, `run-verifier`, `verifier-found-findings`, `verifier-approved`, `reject-findings`, and `request-fixes`.

### AC3: Builder contracts expose only done and escalation outcomes

1. Probe: Inspect the builder artifact contract, registered handoff tool input schema, and parent run result contract.
2. Expected result: Each contract supports exactly the `done` and `escalation` builder outcomes.
3. Example: Register `maestro_record_builder_handoff` and inspect its outcome variants. The supported `status` values are exactly `done` and `escalation`.

### AC4: A reported technical problem returns a saved escalation result

1. Probe: During a running builder pass, submit a valid technical-problem escalation. Complete the delegation normally and observe the parent run result.
2. Expected result: The parent returns `outcome: escalation`, `phase: escalation-decision`, and the saved active handoff with the reported problem.
3. Example: A required check cannot run because the `compiler` command is unavailable. Save `B1.json` with `status: escalation`, question `E1`, and context "The compiler command is unavailable." Complete delegation. The parent returns that handoff, `outcome: escalation`, and `phase: escalation-decision`.

### AC5: Escalations preserve supplied acceptance probe results

1. Probe: Save an escalation with mixed actual probe results. In a separate scenario, save an escalation with all probes passed and a technical problem outside those probes.
2. Expected result: Both escalations are accepted with their supplied probe statuses unchanged.
3. Example: A sample workflow reports `AC1: passed`, `AC2: failed`, and `AC3: not-run` with an unresolved technical question. Reopen its saved handoff. The statuses remain `passed`, `failed`, and `not-run` in that order. In a separate sample workflow, `AC1: passed` accompanies an unavailable service required by another repository check. Its saved escalation retains `AC1: passed`.

### AC6: Owner resolutions permit a subsequent builder pass

1. Probe: Save a technical-problem escalation, resolve every question without changing the contract, and complete a fresh builder pass.
2. Expected result: The subsequent pass saves the next numbered builder handoff.
3. Example: `B1/E1` reports an unavailable compiler. The owner restores it and records "Retry the required check" with reason "The compiler is available now." Start another pass and submit `done` with passed probes. The saved result is `handoffs/builder/B2.json` with `status: done`.

### AC7: Renewed spec approval retains the revision path

1. Probe: From a technical-problem escalation, revise the same spec and record renewed owner approval.
2. Expected result: The workflow becomes `ready-for-builder` for the same spec ID.
3. Example: A workflow is in `escalation-decision` because the required export service is unavailable. The owner revises the spec to use a local export and replies `GREEN FLAG`. Mark that revised spec ready. Its saved phase is `ready-for-builder`, and its spec ID is unchanged.

### AC8: A successful builder result still permits verification

1. Probe: Complete a running builder pass with passed acceptance probes and no escalations, then observe the parent run result.
2. Expected result: The parent returns `outcome: done` and `phase: ready-for-verifier`.
3. Example: A sample workflow has `AC1: passed`. Submit `status: done` and `escalations: []`, then complete delegation. The parent returns `outcome: done` and `phase: ready-for-verifier`.