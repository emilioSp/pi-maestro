# 20261008-132344-store-escalations-in-builder-handoffs: Store escalations in builder handoffs

Motivation and scope: [proposal.md](proposal.md). Technical decisions: [design.md](design.md).

## Requirements

### REQ1: Save each builder outcome in a numbered handoff

Delta: modified

Before: The builder handoff schema supported done and failed reports, but no escalation report variant ([c891474:src/artifacts/builder-handoff/schema.ts](https://github.com/emiliosp/pi-maestro/blob/c891474bf8cf2a100bb5a145c793020daeb78f3d/src/artifacts/builder-handoff/schema.ts)).

Each builder pass that returns `done` or `escalation` saves the next `handoffs/builder/B<number>.json` file.
These handoffs contain `version`, `specId`, `status`, `summary`, `acceptanceCriteria`, `notes`, and `escalations`.

Verified by: [AC1](#ac1-one-builder-handoff-contains-multiple-escalation-questions); [AC6](#ac6-builder-outcomes-use-the-existing-phase-transitions); [AC8](#ac8-builder-run-results-contain-the-saved-active-handoff)

### REQ2: Validate builder outcomes and preserve actual probe results

Delta: modified

Before: Done reports had no escalations field, and the schema had no escalation report variant ([c891474:src/artifacts/builder-handoff/schema.ts](https://github.com/emiliosp/pi-maestro/blob/c891474bf8cf2a100bb5a145c793020daeb78f3d/src/artifacts/builder-handoff/schema.ts)).

An `escalation` outcome requires at least one escalation. Criterion results record the actual probe outcomes, including incomplete probes.
A `done` outcome requires `escalations: []`. Keep the existing requirement that every recorded probe passes.

An escalation outcome can report only passed probes when an owner decision remains necessary.
Its handoff still records every spec criterion and its actual result.

Verified by: [AC5](#ac5-invalid-builder-submissions-perform-no-protocol-write); [AC6](#ac6-builder-outcomes-use-the-existing-phase-transitions)

#### AC6: Builder outcomes use the existing phase transitions

1. Probe: Submit valid `escalation` and `done` outcomes. Include escalation submissions with incomplete probes and with all probes passed.
2. Expected result: An escalation outcome saves `escalation-decision`. A done outcome saves `ready-for-verifier`.
3. Example: Submit `B1` with two questions and `AC1: not-run`. The phase is `escalation-decision`. After resolving both questions and starting the next builder pass, submit `done` in `B2` with `AC1: passed` and `escalations: []`. The phase is `ready-for-verifier`.

### REQ5: Embed questions and restart their IDs in each handoff

Delta: modified

Before: Each question was a standalone artifact carrying its own version and specId ([c891474:src/artifacts/escalation/schema.ts](https://github.com/emiliosp/pi-maestro/blob/c891474bf8cf2a100bb5a145c793020daeb78f3d/src/artifacts/escalation/schema.ts)).

Each escalation contains `id`, `question`, `context`, `options`, `recommendation`, `notes`, and `resolution`.
The enclosing handoff owns `version` and `specId`. Do not repeat those fields inside an escalation.

Assign IDs in array order: `E1`, `E2`, and so on. Restart at `E1` for each builder handoff.
The builder supplies these IDs. Identify questions with both IDs, such as `B1/E1` or `B2/E1`.

Verified by: [AC1](#ac1-one-builder-handoff-contains-multiple-escalation-questions); [AC2](#ac2-escalation-ids-restart-in-each-builder-handoff); [AC7](#ac7-runtime-tools-and-instructions-use-the-unified-handoff-and-batch-decision-contract)

#### AC1: One builder handoff contains multiple escalation questions

1. Probe: In `builder-running`, submit two complete escalation entries through `maestro_record_builder_handoff`. Inspect the next saved handoff.
2. Expected result: The handoff contains both submitted entries with `resolution: null`.
3. Example: No builder handoff exists. Submit `E1` with `Must CSV exports include archived rows?` and `E2` with `Must CSV exports include deleted rows?`. `B1.json` contains both exact questions, their supplied options and context, and null resolutions.

#### AC2: Escalation IDs restart in each builder handoff

1. Probe: Record and resolve two escalations in one builder pass. Record another escalation in the next pass.
2. Expected result: IDs start at `E1` and follow array order within each handoff.
3. Example: `B1.json` contains `E1` and `E2`. After their resolution, submit another question in the next pass. `B2.json` contains `E1`, identified as `B2/E1`.

### REQ6: Validate options, recommendations, and unresolved submissions

Delta: modified

Before: Options and recommendations were validated on standalone escalations; builder handoff submissions had no escalation variant ([c891474:src/artifacts/escalation/assertEscalation.ts](https://github.com/emiliosp/pi-maestro/blob/c891474bf8cf2a100bb5a145c793020daeb78f3d/src/artifacts/escalation/assertEscalation.ts); [c891474:src/artifacts/builder-handoff/schema.ts](https://github.com/emiliosp/pi-maestro/blob/c891474bf8cf2a100bb5a145c793020daeb78f3d/src/artifacts/builder-handoff/schema.ts)).

Each escalation has at least one option. Each option contains `id`, `description`, `consequences`, and `nextStep`.
Option IDs are unique within that escalation.
A recommendation is `null` or contains `optionId` and `reason`. Its option ID must exist in that escalation.
New submissions require `resolution: null`. The builder cannot submit an owner resolution.

Verified by: [AC1](#ac1-one-builder-handoff-contains-multiple-escalation-questions); [AC5](#ac5-invalid-builder-submissions-perform-no-protocol-write)

#### AC5: Invalid builder submissions perform no protocol write

1. Probe: In `builder-running`, submit malformed handoffs. Cover an empty escalation outcome, nonempty escalations on `done`, nonsequential IDs, empty options, duplicate option IDs, an unknown recommendation option, and an owner resolution supplied by the builder. Also cover the existing invalid `done` probe combinations.
2. Expected result: Each invalid submission returns an error without saving a handoff or changing the workflow.
3. Example: No handoff exists. Submit `status: "escalation"` with IDs `E1` and `E3`. The tool returns an error. No `B1.json` exists, and the phase remains `builder-running`.

### REQ7: Require an explicit owner decision and reason

Delta: modified

Before: Resolution decision and reason required only minLength: 1, not non-whitespace text ([c891474:src/artifacts/escalation/schema.ts](https://github.com/emiliosp/pi-maestro/blob/c891474bf8cf2a100bb5a145c793020daeb78f3d/src/artifacts/escalation/schema.ts)).

An owner resolution contains `selectedOptionId`, `decision`, and `reason`.
The decision and reason must contain non-whitespace text.
`selectedOptionId` is an option ID from that escalation or `null` for an owner decision outside the listed options.

Verified by: [AC3](#ac3-batch-decisions-update-only-the-active-handoffs-resolutions); [AC4](#ac4-invalid-decision-batches-perform-no-protocol-write)

### REQ8: Resolve the complete active batch without altering other content

Delta: modified

Before: Maestro resolved one standalone escalation through maestro_resolve_escalation ([c891474:src/maestro/instructions/getMaestroInstructions.ts](https://github.com/emiliosp/pi-maestro/blob/c891474bf8cf2a100bb5a145c793020daeb78f3d/src/maestro/instructions/getMaestroInstructions.ts)).

When the contract remains unchanged, record exactly one resolution for every escalation in the active builder handoff, in one call.
Save the resolutions inside that handoff. Preserve its other content and all earlier handoffs.
Reject missing, duplicate, or unknown escalation IDs and invalid option references before any protocol write.
Reject resolution attempts outside `escalation-decision`, against a non-escalation handoff, or against already resolved questions.

Verified by: [AC3](#ac3-batch-decisions-update-only-the-active-handoffs-resolutions); [AC4](#ac4-invalid-decision-batches-perform-no-protocol-write); [AC10](#ac10-batch-resolution-saves-ready-for-builder)

#### AC3: Batch decisions update only the active handoff's resolutions

1. Probe: Record an escalation handoff. Approve a contract revision without resolving its questions. Record another escalation handoff and resolve every current question together.
2. Expected result: Only the active handoff's resolution fields change. Earlier handoffs and the active handoff's other content remain unchanged.
3. Example: `B1/E1` remains unresolved after a contract revision. `B2` contains `E1` and `E2`, each with options `include` and `exclude`. Submit `E1` with `selectedOptionId: "exclude"`, `decision: "Exclude archived rows"`, `reason: "Keep exports current"`. Submit `E2` with `selectedOptionId: null`, `decision: "Ask for confirmation before including deleted rows"`, `reason: "Prevent accidental disclosure"`. Both exact resolutions appear in `B2.json`. `B1.json` retains its null resolution, and the other `B2` fields retain their submitted values.

#### AC4: Invalid decision batches perform no protocol write

1. Probe: With unresolved `E1` and `E2` in the active handoff, submit batches with a missing ID, duplicate ID, unknown ID, unknown selected option, blank decision or reason, or no decisions. Also attempt resolution from the wrong phase, with an incompatible active handoff, and after successful resolution.
2. Expected result: Each invalid attempt returns an error and leaves the workflow and handoff files unchanged.
3. Example: `B1` contains unresolved `E1` and `E2` in `escalation-decision`. Submit only an otherwise valid resolution for `E1`. The tool reports the missing `E2` resolution. Both questions remain unresolved, and the phase remains `escalation-decision`.

#### AC10: Batch resolution saves ready-for-builder

1. Probe: In `escalation-decision`, resolve all questions in the active handoff through `maestro_resolve_escalations`. Inspect the returned phase and saved workflow phase.
2. Expected result: Both phases are `ready-for-builder`.
3. Example: `B1.json` contains unresolved `E1` and `E2`, and the phase is `escalation-decision`. Submit both valid resolutions in one call. The tool returns `ready-for-builder`, and `workflow.json` records `ready-for-builder`.

### REQ10: Remove standalone escalation storage

Delta: removed

Before: Standalone escalation paths were part of MaestroPaths ([c891474:src/MaestroPaths.ts](https://github.com/emiliosp/pi-maestro/blob/c891474bf8cf2a100bb5a145c793020daeb78f3d/src/MaestroPaths.ts)).

Workflow creation, submission, result reading, and resolution use only builder handoffs for escalations.
Do not create or use `handoffs/escalations/` or standalone escalation files.
Remove standalone escalation path APIs and path fields from creation and tool results.

Verified by: [AC7](#ac7-runtime-tools-and-instructions-use-the-unified-handoff-and-batch-decision-contract)

Coverage gap: AC7 inspects tools and instructions; creation results and path APIs have no explicit probe here.

#### AC7: Runtime tools and instructions use the unified handoff and batch decision contract

1. Probe: Inspect registered owner and child tools and the runtime instructions for Maestro, builder, and verifier.
2. Expected result: Registrations and instructions consistently use `maestro_record_builder_handoff` for escalation submission and `maestro_resolve_escalations` for complete owner batches. They use handoff-qualified question references and no standalone escalation storage model.
3. Example: For `B1/E1` and `B1/E2`, runtime instructions direct the builder to submit one handoff and stop, and Maestro to collect both decisions before one plural resolution call. Child tools have no `maestro_open_escalation`, and owner tools have no singular `maestro_resolve_escalation`.

### REQ11: Return only a consistent saved active builder handoff

Delta: modified

Before: An escalation run result returned a standalone escalation rather than a builder handoff ([c891474:src/tools/main/run-builder.ts](https://github.com/emiliosp/pi-maestro/blob/c891474bf8cf2a100bb5a145c793020daeb78f3d/src/tools/main/run-builder.ts)).

`maestro_run_builder` returns the saved active builder handoff for `done` and `escalation`, including all escalations when present.
It checks the handoff spec identity, schema, and status against the saved phase.
In `escalation-decision`, every returned escalation must remain unresolved.
A missing or inconsistent handoff is a protocol error. Do not fall back to another artifact.

Verified by: [AC8](#ac8-builder-run-results-contain-the-saved-active-handoff); [AC9](#ac9-inconsistent-saved-builder-results-produce-protocol-errors)

#### AC8: Builder run results contain the saved active handoff

1. Probe: Complete an escalated builder run with two unresolved questions. Inspect its returned structured result, and the result of a valid `done` run.
2. Expected result: Each result contains the saved active builder handoff, including every escalation when present.
3. Example: A builder saves `B1.json` with `status: "escalation"`, unresolved `E1` and `E2`, and phase `escalation-decision`. `maestro_run_builder` returns that handoff with both entries.

#### AC9: Inconsistent saved builder results produce protocol errors

1. Probe: Return from a builder run with a missing handoff, wrong spec ID, invalid schema, phase and status mismatch, or resolved questions in `escalation-decision`.
2. Expected result: Each inconsistent result produces a protocol error.
3. Example: The saved handoff has `status: "done"` while the saved phase is `escalation-decision`. `maestro_run_builder` returns a protocol error, not a successful escalation result.
