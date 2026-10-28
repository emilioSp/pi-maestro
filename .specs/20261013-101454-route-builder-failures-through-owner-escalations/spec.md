# 20261013-101454-route-builder-failures-through-owner-escalations: Route builder failures through owner escalations

Motivation and scope: [proposal.md](proposal.md). Technical decisions: [design.md](design.md).

## Requirements

### REQ1: Expose only done and escalation builder outcomes

Delta: removed

Before: Builder reports supported a failed variant with failure.reason ([51e3424:src/artifacts/builder-handoff/schema.ts](https://github.com/emiliosp/pi-maestro/blob/51e3424677b3a6090e950ae409fd5905a02ddb8a/src/artifacts/builder-handoff/schema.ts)).

The builder has only `done` and `escalation` handoff outcomes. Remove the `failed` handoff variant and its `failure` object.

Verified by: [AC3](#ac3-builder-contracts-expose-only-done-and-escalation-outcomes)

#### AC3: Builder contracts expose only done and escalation outcomes

1. Probe: Inspect the builder artifact contract, registered handoff tool input schema, and parent run result contract.
2. Expected result: Each contract supports exactly the `done` and `escalation` builder outcomes.
3. Example: Register `maestro_record_builder_handoff` and inspect its outcome variants. The supported `status` values are exactly `done` and `escalation`.

### REQ2: Report technical problems through existing escalation fields

Delta: modified

Before: A technical reason needing no owner decision used the failed outcome ([51e3424:agents/builder.md](https://github.com/emiliosp/pi-maestro/blob/51e3424677b3a6090e950ae409fd5905a02ddb8a/agents/builder.md)).

When a technical problem prevents completion and the builder can safely report it, the builder stops and submits an escalation. Use existing escalation fields for the reason, evidence, owner question, options, consequences, and next steps. Do not add a separate failure subtype or storage format.

Verified by: [AC4](#ac4-a-reported-technical-problem-returns-a-saved-escalation-result)

#### AC4: A reported technical problem returns a saved escalation result

1. Probe: During a running builder pass, submit a valid technical-problem escalation. Complete the delegation normally and observe the parent run result.
2. Expected result: The parent returns `outcome: escalation`, `phase: escalation-decision`, and the saved active handoff with the reported problem.
3. Example: A required check cannot run because the `compiler` command is unavailable. Save `B1.json` with `status: escalation`, question `E1`, and context "The compiler command is unavailable." Complete delegation. The parent returns that handoff, `outcome: escalation`, and `phase: escalation-decision`.

### REQ4: Remove the failure phase and event

Delta: removed

Before: The BUILDER_FAILED event moved builder-running to terminal builder-failed ([51e3424:src/workflow/transitions.ts](https://github.com/emiliosp/pi-maestro/blob/51e3424677b3a6090e950ae409fd5905a02ddb8a/src/workflow/transitions.ts)).

Remove the `builder-failed` phase and event, their transition, and their status mappings. Do not add a replacement failure phase.

Verified by: [AC1](#ac1-the-current-state-machine-exposes-exactly-eight-phases); [AC2](#ac2-the-current-state-machine-exposes-exactly-ten-events)

Coverage gap: Status mapping removal is not explicitly checked by AC1 or AC2.

#### AC1: The current state machine exposes exactly eight phases

1. Probe: Inspect the supported phase definitions, their schema, and the finite-state machine after the change.
2. Expected result: The supported phase set is exactly `drafting-spec`, `ready-for-builder`, `builder-running`, `escalation-decision`, `ready-for-verifier`, `verifier-running`, `findings-decision`, and `candidate-ready`.
3. Example: The sample workflow `20260321-143052-add-weather-alerts` is in `builder-running`. Enumerate the current contract's supported phases. The result is exactly `drafting-spec`, `ready-for-builder`, `builder-running`, `escalation-decision`, `ready-for-verifier`, `verifier-running`, `findings-decision`, and `candidate-ready`.

#### AC2: The current state machine exposes exactly ten events

1. Probe: Inspect the supported event definitions and registered workflow transitions after the change.
2. Expected result: The supported event set is exactly `mark-spec-ready`, `run-builder`, `open-escalation`, `resolve-escalation`, `builder-done`, `run-verifier`, `verifier-found-findings`, `verifier-approved`, `reject-findings`, and `request-fixes`.
3. Example: The sample workflow `20260321-143052-add-weather-alerts` is in `builder-running`. Enumerate the current machine's transition event keys. The result is exactly `mark-spec-ready`, `run-builder`, `open-escalation`, `resolve-escalation`, `builder-done`, `run-verifier`, `verifier-found-findings`, `verifier-approved`, `reject-findings`, and `request-fixes`.

### REQ7: Align current guidance and remove obsolete failure code

Delta: modified

Runtime agent instructions, tool descriptions, status presentation, tests, and current human documentation must describe the supported flow. Technical problems that the builder can report use escalations. Execution and protocol errors without a valid saved result still stop the workflow.

Remove obsolete failure-outcome code, fixtures, tests, and instructions rather than retaining a deprecated branch. Do not rewrite historical records to describe the new behavior.

Verified by: Not established. No matching AC or exact existing test scenario has been confirmed.

Coverage gap: The existing ACs do not inspect all affected guidance, documentation, obsolete code, and historical-record preservation.

## Regression checks

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

## Historical coverage notes

Historical coverage note (original REQ3):

Coverage gap: AC8 covers successful done submission, not rejection of failed probes or nonempty escalations.

Historical coverage note (original REQ5):

Coverage gap: The general preservation of other transitions and fresh foreground contexts is broader than these probes.

Historical coverage note (original REQ6):

Coverage gap: Cancellation and partial protocol-write handling are not covered by the linked scenarios.
