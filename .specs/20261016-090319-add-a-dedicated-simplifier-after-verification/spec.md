# 20261016-090319-add-a-dedicated-simplifier-after-verification: Add a dedicated simplifier after verification

Motivation and scope: [proposal.md](proposal.md). Technical decisions: [design.md](design.md).

## Requirements

### REQ1: Remove the extra verifier quality-review responsibility

Delta: removed

Before: The verifier had an explicit AGENTS.md-based Review code quality section ([629ed61:agents/verifier.md](https://github.com/emiliosp/pi-maestro/blob/629ed61dd3b4eb02d12c191c283469b88bd60763/agents/verifier.md)).

Remove the entire "Review code quality" section from `agents/verifier.md`. Preserve independent acceptance verification and its remaining duties.

Verified by: [AC14](#ac14-verifier-guidance-no-longer-assigns-the-extra-quality-review)

Coverage gap: AC14 checks removal of the added review, not preservation of every remaining verifier duty.

#### AC14: Verifier guidance no longer assigns the extra quality review

1. Probe: Inspect the shipped verifier instructions.
2. Expected result: The additional AGENTS.md code-quality review responsibility is absent.
3. Example: Read `agents/verifier.md`. It no longer contains the `Review code quality` section or its instruction-violation review procedure.

### REQ2: Run the dedicated simplifier in a fresh foreground context

Delta: added

Add the dedicated `maestro.simplifier` agent in `agents/simplifier.md`. Like the existing agents, it runs in the foreground with a fresh context, inherited project instructions, global instructions, and skills. It works in the canonical project directory supplied by Maestro.

Verified by: [AC5](#ac5-simplifier-delegation-uses-its-execution-configuration)

Coverage gap: Inherited project instructions, global instructions, and skills are not explicitly asserted by AC5.

#### AC5: Simplifier delegation uses its execution configuration

1. Probe: With Git readiness confirmed, invoke the registered simplifier run tool from `simplifier-running` and inspect its delegation request.
2. Expected result: One foreground request targets `maestro.simplifier` with the active spec, canonical project directory, fresh context, and resolved simplifier configuration.
3. Example: For spec `20260321-143052-add-weather-alerts` in Git working tree `/work/app`, use default configuration. The request identifies that spec and `/work/app`, uses fresh context, model `openai-codex/gpt-6.1-sol`, thinking `high`, and a 60-minute timeout.

### REQ3: Keep the simplifier within its role and communication boundaries

Delta: added

The simplifier communicates with Maestro, never directly with the owner. It cannot raise findings or escalations, implement new behavior, approve work, or delegate.

Verified by: Not established. No matching AC or exact existing test scenario has been confirmed.

### REQ4: Bundle the supplied simplification guidance

Delta: added

Use the owner's supplied Simplifier guidance. Its repository source is `.agents/skills/simplifier/SKILL.md`: retain Overview, The Five Principles, The Simplification Process, Common Rationalizations, and Red Flags, including their examples and tables. Do not include skill metadata or the extra When to Use section. The bundled agent must contain the guidance itself, without a runtime dependency on this repository's skill file.

Verified by: [AC15](#ac15-the-shipped-simplifier-guidance-preserves-the-supplied-content)

#### AC15: The shipped simplifier guidance preserves the supplied content

1. Probe: Compare the bundled agent instructions with the supplied guidance and the agreed caller clarification.
2. Expected result: The agent retains the five supplied guidance sections, including their examples and tables, with the agreed caller explanation.
3. Example: Read `agents/simplifier.md`. Its clarity example still replaces the object reduction with a `Map`, and explains updating `result.a.count` to `result.get("a")` as part of the same internal refactoring.

### REQ5: Preserve behavior while updating internal representations and callers

Delta: added

Keep the supplied object-to-Map example. Explain the coordinated caller update, such as replacing `result.a.count` with `result.get("a")`. Internal representations can change when affected callers are updated. Observable inputs, outputs, side effects, ordering, errors, and edge cases must remain identical.

Verified by: [AC15](#ac15-the-shipped-simplifier-guidance-preserves-the-supplied-content)

### REQ6: Preserve the accepted check baseline

Delta: added

Preserve the accepted behavior and introduce no new check failures. Existing failures explicitly accepted through rejected findings do not block completion. Do not fix rejected findings or modify existing tests to make checks pass. Adapt the supplied guidance's green-check wording to this accepted baseline. Follow project conventions, understand code before changing it, and undo simplifications that make it harder to understand or review.

Verified by: [AC15](#ac15-the-shipped-simplifier-guidance-preserves-the-supplied-content); [AC16](#ac16-simplifier-instructions-preserve-the-accepted-check-baseline)

#### AC16: Simplifier instructions preserve the accepted check baseline

1. Probe: Inspect the simplifier's instructions for a candidate whose existing check failure the owner explicitly accepted through a rejected finding.
2. Expected result: The instructions permit the accepted failure to remain, while forbidding new check failures, repairs to rejected findings, and test changes made to pass checks.
3. Example: `V1/F1` reports an existing failing translation check and the owner rejects it as `Outside approved scope`. Read `agents/simplifier.md`: its instructions allow that accepted failure to remain, but prohibit fixing F1, changing its test to pass, or introducing another check failure.

### REQ7: Read workflow context and protect frozen artifacts

Delta: added

Add the workflow context and handoff instructions needed by this agent. It reads the approved spec, current workflow, relevant handoffs, and applicable project instructions. It must not edit the frozen spec, prototypes, workflow state, or earlier handoffs. It records its result only through the simplifier handoff tool.

Verified by: Not established. No matching AC or exact existing test scenario has been confirmed.

### REQ8: Add the simplifier phase and its entry and exit routes

Delta: modified

Before: Successful verification and rejection of all findings went directly to candidate-ready ([629ed61:src/workflow/transitions.ts](https://github.com/emiliosp/pi-maestro/blob/629ed61dd3b4eb02d12c191c283469b88bd60763/src/workflow/transitions.ts)).

Add exactly one phase, `simplifier-running`.

| Starting phase | Event or condition | Result |
|---|---|---|
| `verifier-running` | `VERIFIER_DONE` | `simplifier-running` |
| `finding-decisions` | `OWNER_REJECT_FINDINGS` | `simplifier-running` |
| `simplifier-running` | Git readiness cannot be confirmed inside `maestro_run_simplifier` | Warn, skip delegation, and move to `candidate-ready` through an explicit skip event |
| `simplifier-running` | Valid saved simplifier handoff produces `SIMPLIFIER_DONE` | `candidate-ready` |

Verified by: [AC1](#ac1-successful-verification-starts-simplification); [AC2](#ac2-rejecting-all-findings-starts-simplification); [AC4](#ac4-a-git-skip-concludes-the-workflow); [AC7](#ac7-simplifier-completion-concludes-the-workflow)

#### AC1: Successful verification starts simplification

1. Probe: Complete a running verifier pass with all probes passed and no findings, including when Git is unavailable.
2. Expected result: The saved phase is `simplifier-running`.
3. Example: For spec `20260321-143052-add-weather-alerts`, with Git unavailable, submit a valid `V1` with passed `AC1` and `findings: []`. The workflow saves `simplifier-running`, not `candidate-ready`.

#### AC2: Rejecting all findings starts simplification

1. Probe: Record rejection of every current finding, including outside a Git repository.
2. Expected result: The saved phase is `simplifier-running`.
3. Example: In `finding-decisions` outside a Git repository, reject the sole finding `V1/F1` with reason `Outside approved scope`. The saved phase becomes `simplifier-running` without another verifier pass.

#### AC4: A Git skip concludes the workflow

1. Probe: From `simplifier-running`, invoke the run tool when Git readiness cannot be confirmed.
2. Expected result: The saved phase is `candidate-ready` without an execution error.
3. Example: With Git unavailable and the phase already `simplifier-running`, invoke `maestro_run_simplifier`. Its explicit skip transition saves `candidate-ready` instead of leaving a running workflow.

### REQ9: Start simplification without another approval or verifier pass

Delta: added

Maestro calls `maestro_run_simplifier` after either entry route, without another owner approval or verifier pass. That tool decides whether to delegate or skip. Verifier findings still require owner decisions before this point. Fix and spec-revision routes remain unchanged. Rejections retain their reasons and do not become passed verification.

Verified by: [AC2](#ac2-rejecting-all-findings-starts-simplification); [AC17](#ac17-maestro-starts-simplification-without-another-approval)

Coverage gap: These ACs do not separately exercise unchanged code-fix and spec-revision routes.

#### AC17: Maestro starts simplification without another approval

1. Probe: Inspect Maestro instructions and entry-tool results for successful verification and rejection of all findings, regardless of Git availability.
2. Expected result: Both routes direct Maestro to invoke `maestro_run_simplifier` next, without another approval or verifier pass.
3. Example: A verifier result returns `simplifier-running` for spec `20260321-143052-add-weather-alerts`. Maestro's instructions direct a call to `maestro_run_simplifier` for that spec, not a final summary or another `GREEN FLAG` request. The same instruction applies after rejection of all findings.

### REQ10: Check Git readiness only inside the simplifier run tool

Delta: added

Preserve ADR-004: only simplification requires Git, with no non-Git fallback. Check Git readiness only inside `maestro_run_simplifier`, immediately before delegation. Activation, spec preparation, builder execution, verifier completion, and finding resolution do not check Git readiness. Both entry routes save `simplifier-running` regardless of Git availability. A Git skip is a normal outcome, not an execution error.

Verified by: [AC1](#ac1-successful-verification-starts-simplification); [AC2](#ac2-rejecting-all-findings-starts-simplification); [AC3](#ac3-unavailable-git-produces-a-skip-warning); [AC4](#ac4-a-git-skip-concludes-the-workflow); [AC20](#ac20-activation-presents-the-configured-simplifier-independently-of-git); [AC22](#ac22-a-git-skip-does-not-launch-the-simplifier)

Coverage gap: The absence of Git checks in every other named operation is not explicitly inspected by these probes.

#### AC3: Unavailable Git produces a skip warning

1. Probe: From `simplifier-running`, invoke `maestro_run_simplifier` when its Git command is unavailable, fails, or does not return `true`.
2. Expected result: The tool returns warning `Simplifier skipped: Git repository unavailable.`
3. Example: After either entry route saves `simplifier-running`, invoke the run tool outside a Git repository. Its readiness command fails and it returns `Simplifier skipped: Git repository unavailable.` The same warning applies when Git cannot be executed or returns `false`.

#### AC22: A Git skip does not launch the simplifier

1. Probe: Invoke `maestro_run_simplifier` from `simplifier-running` when Git readiness cannot be confirmed.
2. Expected result: No simplifier delegation request is emitted.
3. Example: Outside a Git repository, invoke the run tool. It returns the skip result without emitting a request for `maestro.simplifier`.

### REQ11: Stop on simplifier execution and protocol errors

Delta: added

The existing error policy applies to simplifier execution and protocol errors. An execution failure, interruption, timeout, or missing or invalid saved result stops the workflow. Do not manufacture findings, escalations, or successful completion. Partial protocol writes require manual owner follow-up, not automatic retry or recovery.

Verified by: [AC9](#ac9-returning-without-a-handoff-cannot-complete-simplification); [AC10](#ac10-simplifier-execution-failure-stops-the-workflow)

Coverage gap: Partial protocol-write handling is not explicitly exercised by AC9 or AC10.

#### AC9: Returning without a handoff cannot complete simplification

1. Probe: A delegated simplifier returns a successful execution response without recording its handoff.
2. Expected result: The run tool reports a protocol error rather than completing the workflow.
3. Example: Start in `simplifier-running` with no `S.json`. Return `completed` from delegation without calling the handoff tool. The tool reports the missing valid result and the saved phase remains `simplifier-running`.

#### AC10: Simplifier execution failure stops the workflow

1. Probe: A delegated simplifier fails, times out, or is interrupted before recording a handoff.
2. Expected result: The run tool reports the execution error without advancing the workflow.
3. Example: Return a timeout response before any `S.json` is saved. The timeout is reported and the workflow remains `simplifier-running`, without a synthetic finding or escalation.

### REQ12: Discover all current uncommitted code changes using Git

Delta: added

Start from all current uncommitted code changes: staged, unstaged, and untracked code files. Include pre-existing uncommitted changes. Committed changes alone do not select files. Use Git for discovery without adding a starting commit or builder file list.

Verified by: Not established. No matching AC or exact existing test scenario has been confirmed.

### REQ13: Allow required caller updates without unrelated refactoring

Delta: added

Required caller updates can include initially unchanged code files. Exclude unrelated refactoring. Do not reset pre-existing changes or modify the Git index or history.

Verified by: [AC6](#ac6-the-simplifier-saves-the-agreed-handoff); [AC15](#ac15-the-shipped-simplifier-guidance-preserves-the-supplied-content)

Coverage gap: These ACs cover caller reporting and guidance, not exclusion of unrelated edits or preservation of the Git index and history.

### REQ14: Allow completion without refactoring

Delta: added

No refactoring is required when selected code is already clear or no code files are selected. The refactored-file list can be empty.

Verified by: [AC7](#ac7-simplifier-completion-concludes-the-workflow)

#### AC7: Simplifier completion concludes the workflow

1. Probe: Complete a simplifier pass that needs no refactoring.
2. Expected result: `SIMPLIFIER_DONE` saves `candidate-ready`.
3. Example: In `simplifier-running`, record summary `No simplification needed`, `refactoredFiles: []`, and `notes: []`. The saved phase becomes `candidate-ready`.

### REQ15: Save the closed unnumbered simplifier handoff

Delta: added

Save one unnumbered artifact at `<spec-directory>/<specId>/handoffs/simplifier/S.json`.

| Field | Contract |
|---|---|
| `version` | `"1.0.0"`, supplied by the recording tool |
| `specId` | The active spec ID |
| `refactoredFiles` | `string[]`. Only files actually refactored by this agent, including required caller updates. Paths are relative to the project root and stay within it. |
| `summary` | Non-empty string summarizing the result |
| `notes` | `string[]` describing the work for Maestro |

This is a closed schema. Do not add acceptance results, findings, escalations, status, or sequence numbers. Reviewed files left unchanged are not refactored files. An empty array is valid. The Git skip route creates no simplifier handoff.

Verified by: [AC6](#ac6-the-simplifier-saves-the-agreed-handoff); [AC7](#ac7-simplifier-completion-concludes-the-workflow); [AC8](#ac8-invalid-simplifier-submissions-do-not-change-protocol-files); [AC22](#ac22-a-git-skip-does-not-launch-the-simplifier)

Coverage gap: AC22 checks that skipping emits no delegation, not the absence of a handoff file after a skip.

#### AC6: The simplifier saves the agreed handoff

1. Probe: Record a valid result after refactoring a selected file and its initially unchanged caller.
2. Expected result: `handoffs/simplifier/S.json` contains exactly the agreed handoff fields and submitted result.
3. Example: Submit `refactoredFiles: ["src/counts.ts", "src/report.ts"]`, summary `Simplified counting`, and notes `["Updated the caller to read the Map."]`. The saved `S.json` contains those values, the active spec ID, and version `1.0.0`, with no extra fields.

### REQ16: Validate before writes and complete through the fixed handoff

Delta: added

Validate phase, spec identity, and payload before protocol writes. The recording operation saves the artifact before applying `SIMPLIFIER_DONE`. Use one fixed path for `S.json`, without active/latest lookup, directory counting, sequence validation, or counters. Existing builder and verifier handoff formats and numbering remain unchanged.

Verified by: [AC7](#ac7-simplifier-completion-concludes-the-workflow); [AC8](#ac8-invalid-simplifier-submissions-do-not-change-protocol-files)

Coverage gap: These probes do not establish write ordering, the absence of sequence lookup logic, or unchanged builder and verifier formats.

#### AC8: Invalid simplifier submissions do not change protocol files

1. Probe: Submit an otherwise valid simplifier result with an invalid payload, wrong spec identity, or wrong phase.
2. Expected result: Submission is rejected before any artifact or workflow write.
3. Example: For active spec `20260321-143052-add-weather-alerts`, independently try `refactoredFiles: ["../outside.ts"]`, an extra `findings: []` field, spec ID `20260321-143052-other-spec`, and submission from `verifier-running`. Each attempt is rejected and leaves the workflow and handoff files unchanged.

### REQ17: Resolve independent optional simplifier configuration

Delta: added

Add an optional `simplifier` configuration block with the existing agent configuration rules and independent field overrides.

| Field | Default |
|---|---|
| `model` | `openai-codex/gpt-6.1-sol` |
| `thinking` | `high` |
| `timeoutMinutes` | `60` |

Verified by: [AC11](#ac11-simplifier-defaults-preserve-existing-configuration-files); [AC12](#ac12-simplifier-overrides-are-independent); [AC13](#ac13-invalid-simplifier-configuration-is-rejected)

#### AC11: Simplifier defaults preserve existing configuration files

1. Probe: Resolve configuration containing only `version: "1.0.0"`.
2. Expected result: The resolved simplifier configuration contains its agreed defaults.
3. Example: Load `{"version":"1.0.0"}`. Its `simplifier` value is `{"model":"openai-codex/gpt-6.1-sol","thinking":"high","timeoutMinutes":60}`.

#### AC12: Simplifier overrides are independent

1. Probe: Resolve configuration with only a simplifier timeout override.
2. Expected result: Only that timeout differs from the default resolved agent configuration.
3. Example: Load `{"version":"1.0.0","simplifier":{"timeoutMinutes":90}}`. The simplifier timeout is 90, its model and thinking retain their defaults, and builder and verifier configuration retain their defaults.

### REQ18: Integrate configuration and running status with existing rules

Delta: modified

Before: Configuration defined only builder and verifier roles ([629ed61:src/config/schema.ts](https://github.com/emiliosp/pi-maestro/blob/629ed61dd3b4eb02d12c191c283469b88bd60763/src/config/schema.ts)).

Existing configuration without this block remains valid. Use the existing model identifier format, thinking levels, and timeout limits. Integrate the new agent into agent and model availability checks, the activation notice, and workflow status. Show `Simplifier running` during its phase, not `Completed`, with the broom icon (`U+1F9F9`).

Verified by: [AC11](#ac11-simplifier-defaults-preserve-existing-configuration-files); [AC13](#ac13-invalid-simplifier-configuration-is-rejected); [AC19](#ac19-the-running-simplifier-is-visible-in-status); [AC20](#ac20-activation-presents-the-configured-simplifier-independently-of-git); [AC21](#ac21-unavailable-simplifier-dependencies-block-activation)

Coverage gap: AC13 checks a timeout below the minimum, not every preserved model, thinking, and timeout validation rule.

#### AC13: Invalid simplifier configuration is rejected

1. Probe: Validate a simplifier timeout below the existing minimum.
2. Expected result: Configuration validation rejects the invalid timeout.
3. Example: Load `{"version":"1.0.0","simplifier":{"timeoutMinutes":0}}`. Validation reports an invalid simplifier timeout instead of resolving it.

#### AC19: The running simplifier is visible in status

1. Probe: Observe workflow status while simplifier delegation is active.
2. Expected result: Status shows the broom icon (`U+1F9F9`) with `Simplifier running` rather than `Completed`.
3. Example: Pause a scripted simplifier response while the workflow is `simplifier-running`. Status shows the broom icon followed by `Simplifier running` until a valid handoff completes the phase.

### REQ19: Check simplifier availability regardless of Git readiness

Delta: modified

At activation, validate the simplifier model and agent through the normal availability checks, just like builder and verifier. Do not make these checks conditional on Git. An unavailable configured simplifier model or agent blocks activation even when Git would later cause simplification to be skipped.

Verified by: [AC21](#ac21-unavailable-simplifier-dependencies-block-activation)

#### AC21: Unavailable simplifier dependencies block activation

1. Probe: Activate Maestro with an unavailable configured simplifier model or agent, while other prerequisites are valid, including when Git is unavailable.
2. Expected result: Activation fails and identifies the unavailable simplifier dependency.
3. Example: With Git unavailable, configure `simplifier.model: "openai-codex/missing"` while builder and verifier dependencies remain available. Activation reports the unavailable configured model rather than enabling Maestro. Separately, make `maestro.simplifier` unavailable with all models valid and observe the agent availability error.

### REQ20: Show configured settings at activation and warn on a later Git skip

Delta: modified

The UI-only activation notice always shows the configured simplifier model and thinking level after successful activation. It does not predict whether simplification will be skipped. If `maestro_run_simplifier` later cannot confirm Git readiness, it returns `Simplifier skipped: Git repository unavailable.` as a warning.

Verified by: [AC3](#ac3-unavailable-git-produces-a-skip-warning); [AC20](#ac20-activation-presents-the-configured-simplifier-independently-of-git)

#### AC20: Activation presents the configured simplifier independently of Git

1. Probe: Activate Maestro with valid agent and model availability, including when Git is unavailable or the project has no repository.
2. Expected result: The UI-only activation notice identifies the configured simplifier model and thinking level without predicting a Git skip.
3. Example: With Git unavailable, default configuration, and all model and agent checks passing, the notice includes `Simplifier (openai-codex/gpt-6.1-sol high)`, not a Git skip message.

### REQ21: Report simplifier results separately from verifier evidence

Delta: modified

Before: The final summary covered verification, rejected findings, and builder notes, with no separate simplifier report ([629ed61:src/maestro/instructions/getMaestroInstructions.ts](https://github.com/emiliosp/pi-maestro/blob/629ed61dd3b4eb02d12c191c283469b88bd60763/src/maestro/instructions/getMaestroInstructions.ts)).

Maestro reports the simplifier's summary and notes in the final conversation. It does not claim that the verifier independently checked later refactoring. Skipped simplification is identified as skipped.

Verified by: [AC18](#ac18-maestro-reports-the-saved-simplifier-result)

Coverage gap: AC18 addresses completed simplification, not final-summary wording after a skip.

#### AC18: Maestro reports the saved simplifier result

1. Probe: Inspect Maestro's final-summary guidance for a completed simplifier result.
2. Expected result: Maestro is directed to report the simplifier's saved summary and notes without attributing later refactoring to independent verifier checks.
3. Example: `S.json` contains summary `Simplified counting` and note `Updated the caller to read the Map.` The final-summary instructions require Maestro to use those values as the simplifier's report, not as verifier evidence.

### REQ22: Update current documentation and preserve historical records

Delta: modified

Update affected human documentation and R-21 to describe the implemented flow. Keep ADR-004 aligned with the implemented design. Preserve historical handoffs and completed specs.

Verified by: Not established. No matching AC or exact existing test scenario has been confirmed.
