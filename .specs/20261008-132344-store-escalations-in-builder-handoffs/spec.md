# 20261008-132344-store-escalations-in-builder-handoffs: Store escalations in builder handoffs

## 1. Context, goals, and scope

An escalation is a question that needs an owner decision.
Store multiple escalations and their owner resolutions inside each numbered builder handoff.
Use the same storage, local ID, and batch decision model as verifier findings.
A separate escalation directory is not part of the workflow model.

Change the affected artifact contracts, workflow operations, tools, runtime agent instructions, and tests.

### Out of scope

Human documentation updates are excluded. Leave `README.md` and `docs/` unchanged.
Backward compatibility, migration, fallback readers, and deprecated tool aliases are excluded.
Model the implementation as if standalone escalation storage never existed. Remove obsolete storage code and its tests.

## 2. Requirements and constraints

### Builder handoffs

Each builder pass that returns `done` or `escalation` saves the next `handoffs/builder/B<number>.json` file.
These handoffs contain `version`, `specId`, `status`, `summary`, `acceptanceCriteria`, `notes`, and `escalations`.

An `escalation` outcome requires at least one escalation. Criterion results record the actual probe outcomes, including incomplete probes.
A `done` outcome requires `escalations: []`. Keep the existing requirement that every recorded probe passes.

An escalation outcome can report only passed probes when an owner decision remains necessary.
Its handoff still records every spec criterion and its actual result.
Keep the `version` field in builder and verifier handoffs at `1.0.0`, despite the breaking change.

### Test coverage

Do not add new tests if a current test already covers an acceptance criterion. Use that test as evidence.
If a current test needs changes to cover the required behavior, update it instead of adding a duplicate test.
Add a new test only when no current test covers the required scenario.

### Embedded escalation contract

Each escalation contains `id`, `question`, `context`, `options`, `recommendation`, `notes`, and `resolution`.
The enclosing handoff owns `version` and `specId`. Do not repeat those fields inside an escalation.

Assign IDs in array order: `E1`, `E2`, and so on. Restart at `E1` for each builder handoff.
The builder supplies these IDs. Identify questions with both IDs, such as `B1/E1` or `B2/E1`.

Each escalation has at least one option. Each option contains `id`, `description`, `consequences`, and `nextStep`.
Option IDs are unique within that escalation.
A recommendation is `null` or contains `optionId` and `reason`. Its option ID must exist in that escalation.
New submissions require `resolution: null`. The builder cannot submit an owner resolution.

An owner resolution contains `selectedOptionId`, `decision`, and `reason`.
The decision and reason must contain non-whitespace text.
`selectedOptionId` is an option ID from that escalation or `null` for an owner decision outside the listed options.

### Owner decisions and history

When the contract remains unchanged, record exactly one resolution for every escalation in the active builder handoff, in one call.
Save the resolutions inside that handoff. Preserve its other content and all earlier handoffs.
Reject missing, duplicate, or unknown escalation IDs and invalid option references before any protocol write.
Reject resolution attempts outside `escalation-decision`, against a non-escalation handoff, or against already resolved questions.

Keep the existing spec revision path. After an approved contract revision, earlier unresolved escalations remain historical context.
They do not block a new builder pass and do not require resolutions against the revised contract.

### Storage boundary

Workflow creation, submission, result reading, and resolution use only builder handoffs for escalations.
Do not create or use `handoffs/escalations/` or standalone escalation files.
Remove standalone escalation path APIs and path fields from creation and tool results.

## 3. Technical decisions

### Tool contract and data flow

Use `maestro_record_builder_handoff` for `done` and `escalation`.
Its inputs are `specId` and the handoff content specified above. The tool supplies the handoff version and path.
Remove `maestro_open_escalation` from child tool registration.

Use `maestro_resolve_escalations` with `specId` and a nonempty `decisions` array.
Each array item contains `escalationId`, `selectedOptionId`, `decision`, and `reason`.
Remove the singular `maestro_resolve_escalation` tool. Do not keep an alias.
The tool selects the active builder handoff from `specId`, as finding resolution selects the active verifier handoff.

An escalation submission saves `escalation-decision`.
A complete valid decision batch saves `ready-for-builder`.
Keep the `done` transition to `ready-for-verifier`.
Do not introduce workflow phases or change the verifier finding contract.

`maestro_run_builder` returns the saved active builder handoff for `done` and `escalation`, including all escalations when present.
It checks the handoff spec identity, schema, and status against the saved phase.
In `escalation-decision`, every returned escalation must remain unresolved.
A missing or inconsistent handoff is a protocol error. Do not fall back to another artifact.

Update builder, verifier, and Maestro runtime instructions to use embedded escalation questions and resolutions.
Maestro presents all current questions with handoff-qualified IDs and collects all decisions before batch submission.
The builder records one handoff outcome and stops. Later passes read owner resolutions from builder handoffs.

The model follows `src/artifacts/verifier-handoff/schema.ts`, `src/tools/child/record-verifier-handoff.ts`, and `src/workflow/findings/resolveFindings.ts`.
Keep embedded escalation validation with its owning handoff contract. No parallel storage model is required.

## 4. Acceptance criteria

### AC1: One builder handoff contains multiple escalation questions

1. Probe: In `builder-running`, submit two complete escalation entries through `maestro_record_builder_handoff`. Inspect the next saved handoff.
2. Expected result: The handoff contains both submitted entries with `resolution: null`.
3. Example: No builder handoff exists. Submit `E1` with `Must CSV exports include archived rows?` and `E2` with `Must CSV exports include deleted rows?`. `B1.json` contains both exact questions, their supplied options and context, and null resolutions.

### AC2: Escalation IDs restart in each builder handoff

1. Probe: Record and resolve two escalations in one builder pass. Record another escalation in the next pass.
2. Expected result: IDs start at `E1` and follow array order within each handoff.
3. Example: `B1.json` contains `E1` and `E2`. After their resolution, submit another question in the next pass. `B2.json` contains `E1`, identified as `B2/E1`.

### AC3: Batch decisions update only the active handoff's resolutions

1. Probe: Record an escalation handoff. Approve a contract revision without resolving its questions. Record another escalation handoff and resolve every current question together.
2. Expected result: Only the active handoff's resolution fields change. Earlier handoffs and the active handoff's other content remain unchanged.
3. Example: `B1/E1` remains unresolved after a contract revision. `B2` contains `E1` and `E2`, each with options `include` and `exclude`. Submit `E1` with `selectedOptionId: "exclude"`, `decision: "Exclude archived rows"`, `reason: "Keep exports current"`. Submit `E2` with `selectedOptionId: null`, `decision: "Ask for confirmation before including deleted rows"`, `reason: "Prevent accidental disclosure"`. Both exact resolutions appear in `B2.json`. `B1.json` retains its null resolution, and the other `B2` fields retain their submitted values.

### AC4: Invalid decision batches perform no protocol write

1. Probe: With unresolved `E1` and `E2` in the active handoff, submit batches with a missing ID, duplicate ID, unknown ID, unknown selected option, blank decision or reason, or no decisions. Also attempt resolution from the wrong phase, with an incompatible active handoff, and after successful resolution.
2. Expected result: Each invalid attempt returns an error and leaves the workflow and handoff files unchanged.
3. Example: `B1` contains unresolved `E1` and `E2` in `escalation-decision`. Submit only an otherwise valid resolution for `E1`. The tool reports the missing `E2` resolution. Both questions remain unresolved, and the phase remains `escalation-decision`.

### AC5: Invalid builder submissions perform no protocol write

1. Probe: In `builder-running`, submit malformed handoffs. Cover an empty escalation outcome, nonempty escalations on `done`, nonsequential IDs, empty options, duplicate option IDs, an unknown recommendation option, and an owner resolution supplied by the builder. Also cover the existing invalid `done` probe combinations.
2. Expected result: Each invalid submission returns an error without saving a handoff or changing the workflow.
3. Example: No handoff exists. Submit `status: "escalation"` with IDs `E1` and `E3`. The tool returns an error. No `B1.json` exists, and the phase remains `builder-running`.

### AC6: Builder outcomes use the existing phase transitions

1. Probe: Submit valid `escalation` and `done` outcomes. Include escalation submissions with incomplete probes and with all probes passed.
2. Expected result: An escalation outcome saves `escalation-decision`. A done outcome saves `ready-for-verifier`.
3. Example: Submit `B1` with two questions and `AC1: not-run`. The phase is `escalation-decision`. After resolving both questions and starting the next builder pass, submit `done` in `B2` with `AC1: passed` and `escalations: []`. The phase is `ready-for-verifier`.

### AC7: Runtime tools and instructions use the unified handoff and batch decision contract

1. Probe: Inspect registered owner and child tools and the runtime instructions for Maestro, builder, and verifier.
2. Expected result: Registrations and instructions consistently use `maestro_record_builder_handoff` for escalation submission and `maestro_resolve_escalations` for complete owner batches. They use handoff-qualified question references and no standalone escalation storage model.
3. Example: For `B1/E1` and `B1/E2`, runtime instructions direct the builder to submit one handoff and stop, and Maestro to collect both decisions before one plural resolution call. Child tools have no `maestro_open_escalation`, and owner tools have no singular `maestro_resolve_escalation`.

### AC8: Builder run results contain the saved active handoff

1. Probe: Complete an escalated builder run with two unresolved questions. Inspect its returned structured result, and the result of a valid `done` run.
2. Expected result: Each result contains the saved active builder handoff, including every escalation when present.
3. Example: A builder saves `B1.json` with `status: "escalation"`, unresolved `E1` and `E2`, and phase `escalation-decision`. `maestro_run_builder` returns that handoff with both entries.

### AC9: Inconsistent saved builder results produce protocol errors

1. Probe: Return from a builder run with a missing handoff, wrong spec ID, invalid schema, phase and status mismatch, or resolved questions in `escalation-decision`.
2. Expected result: Each inconsistent result produces a protocol error.
3. Example: The saved handoff has `status: "done"` while the saved phase is `escalation-decision`. `maestro_run_builder` returns a protocol error, not a successful escalation result.

### AC10: Batch resolution saves ready-for-builder

1. Probe: In `escalation-decision`, resolve all questions in the active handoff through `maestro_resolve_escalations`. Inspect the returned phase and saved workflow phase.
2. Expected result: Both phases are `ready-for-builder`.
3. Example: `B1.json` contains unresolved `E1` and `E2`, and the phase is `escalation-decision`. Submit both valid resolutions in one call. The tool returns `ready-for-builder`, and `workflow.json` records `ready-for-builder`.
