# 20261016-090319-add-a-dedicated-simplifier-after-verification: Add a dedicated simplifier after verification

> Draft. The owner has not approved this specification.

## 1. Context, goals, and scope

Implement R-21. Each agent has one purpose: the builder implements the approved spec, the verifier independently checks its acceptance criteria, and the simplifier refactors accepted code.

The simplifier makes code easier to understand, modify, and debug. Fewer lines are not the goal. The owner retains final review.

### Out of scope

No additional verification cycle, findings, escalations, automatic commits, Git checkpoints, spec-specific change tracking, dependency changes, or automatic workflow recovery.

## 2. Requirements and constraints

### Responsibilities and agent instructions

1. Remove the entire "Review code quality" section from `agents/verifier.md`. Preserve independent acceptance verification and its remaining duties.
2. Add the dedicated `maestro.simplifier` agent in `agents/simplifier.md`. Like the existing agents, it runs in the foreground with a fresh context, inherited project instructions, global instructions, and skills. It works in the canonical project directory supplied by Maestro.
3. The simplifier communicates with Maestro, never directly with the owner. It cannot raise findings or escalations, implement new behavior, approve work, or delegate.
4. Use the owner's supplied Simplifier guidance. Its repository source is `.agents/skills/simplifier/SKILL.md`: retain Overview, The Five Principles, The Simplification Process, Common Rationalizations, and Red Flags, including their examples and tables. Do not include skill metadata or the extra When to Use section. The bundled agent must contain the guidance itself, without a runtime dependency on this repository's skill file.
5. Keep the supplied object-to-Map example. Explain the coordinated caller update, such as replacing `result.a.count` with `result.get("a")`. Internal representations can change when affected callers are updated. Observable inputs, outputs, side effects, ordering, errors, and edge cases must remain identical.
6. Preserve the accepted behavior and introduce no new check failures. Existing failures explicitly accepted through rejected findings do not block completion. Do not fix rejected findings or modify existing tests to make checks pass. Adapt the supplied guidance's green-check wording to this accepted baseline. Follow project conventions, understand code before changing it, and undo simplifications that make it harder to understand or review.
7. Add the workflow context and handoff instructions needed by this agent. It reads the approved spec, current workflow, relevant handoffs, and applicable project instructions. It must not edit the frozen spec, prototypes, workflow state, or earlier handoffs. It records its result only through the simplifier handoff tool.

### Workflow

Add exactly one phase, `simplifier-running`.

| Starting phase | Event or condition | Result |
|---|---|---|
| `verifier-running` | `VERIFIER_DONE` | `simplifier-running` |
| `finding-decisions` | `OWNER_REJECT_FINDINGS` | `simplifier-running` |
| `simplifier-running` | Git readiness cannot be confirmed inside `maestro_run_simplifier` | Warn, skip delegation, and move to `candidate-ready` through an explicit skip event |
| `simplifier-running` | Valid saved simplifier handoff produces `SIMPLIFIER_DONE` | `candidate-ready` |

Maestro calls `maestro_run_simplifier` after either entry route, without another owner approval or verifier pass. That tool decides whether to delegate or skip. Verifier findings still require owner decisions before this point. Fix and spec-revision routes remain unchanged. Rejections retain their reasons and do not become passed verification.

Preserve ADR-004: only simplification requires Git, with no non-Git fallback. Check Git readiness only inside `maestro_run_simplifier`, immediately before delegation. Activation, spec preparation, builder execution, verifier completion, and finding resolution do not check Git readiness. Both entry routes save `simplifier-running` regardless of Git availability. A Git skip is a normal outcome, not an execution error.

The existing error policy applies to simplifier execution and protocol errors. An execution failure, interruption, timeout, or missing or invalid saved result stops the workflow. Do not manufacture findings, escalations, or successful completion. Partial protocol writes require manual owner follow-up, not automatic retry or recovery.

### File scope

Start from all current uncommitted code changes: staged, unstaged, and untracked code files. Include pre-existing uncommitted changes. Committed changes alone do not select files. Use Git for discovery without adding a starting commit or builder file list.

Required caller updates can include initially unchanged code files. Exclude unrelated refactoring. Do not reset pre-existing changes or modify the Git index or history.

No refactoring is required when selected code is already clear or no code files are selected. The refactored-file list can be empty.

### Simplifier handoff

Save one unnumbered artifact at `<spec-directory>/<specId>/handoffs/simplifier/S.json`.

| Field | Contract |
|---|---|
| `version` | `"1.0.0"`, supplied by the recording tool |
| `specId` | The active spec ID |
| `refactoredFiles` | `string[]`. Only files actually refactored by this agent, including required caller updates. Paths are relative to the project root and stay within it. |
| `summary` | Non-empty string summarizing the result |
| `notes` | `string[]` describing the work for Maestro |

This is a closed schema. Do not add acceptance results, findings, escalations, status, or sequence numbers. Reviewed files left unchanged are not refactored files. An empty array is valid. The Git skip route creates no simplifier handoff.

Validate phase, spec identity, and payload before protocol writes. The recording operation saves the artifact before applying `SIMPLIFIER_DONE`. Use one fixed path for `S.json`, without active/latest lookup, directory counting, sequence validation, or counters. Existing builder and verifier handoff formats and numbering remain unchanged.

### Configuration and presentation

Add an optional `simplifier` configuration block with the existing agent configuration rules and independent field overrides.

| Field | Default |
|---|---|
| `model` | `openai-codex/gpt-6.1-sol` |
| `thinking` | `high` |
| `timeoutMinutes` | `60` |

Existing configuration without this block remains valid. Use the existing model identifier format, thinking levels, and timeout limits. Integrate the new agent into agent and model availability checks, the activation notice, and workflow status. Show `Simplifier running` during its phase, not `Completed`, with the broom icon (`U+1F9F9`).

At activation, validate the simplifier model and agent through the normal availability checks, just like builder and verifier. Do not make these checks conditional on Git. An unavailable configured simplifier model or agent blocks activation even when Git would later cause simplification to be skipped.

The UI-only activation notice always shows the configured simplifier model and thinking level after successful activation. It does not predict whether simplification will be skipped. If `maestro_run_simplifier` later cannot confirm Git readiness, it returns `Simplifier skipped: Git repository unavailable.` as a warning.

Maestro reports the simplifier's summary and notes in the final conversation. It does not claim that the verifier independently checked later refactoring. Skipped simplification is identified as skipped.

Update affected human documentation and R-21 to describe the implemented flow. Keep ADR-004 aligned with the implemented design. Preserve historical handoffs and completed specs.

## 3. Technical decisions

Check Git readiness with one command in the project directory: `git rev-parse --is-inside-work-tree`. A successful result of `true` enables simplification. If the command is unavailable, fails, or does not return `true`, skip simplification. Do not add separate Git installation, version, or `.git` directory checks. This readiness check runs only in `maestro_run_simplifier`, after validating the saved state and before delegation.

Use the existing agent execution and tool pattern. Add `maestro_run_simplifier` in the main session and `maestro_record_simplifier_handoff` in child sessions. The former accepts only `specId`. The latter accepts `specId`, `refactoredFiles`, `summary`, and `notes`, with the tool supplying the artifact version.

The two entry routes save `simplifier-running` before Maestro invokes the new foreground run tool. The run tool reads the saved state, checks identity and phase, refreshes status, and delegates. Do not add a separate ready phase. Leave the preparation helper structure to the builder, following the existing execution pattern. Adapt verifier result validation and finding-resolution results to recognize this new outcome.

The structural design adds an agent definition, role-specific workflow and artifact modules under the existing layout, the two tools, and corresponding tests and fixtures. Do not add a shared schemas directory or redesign other roles. Preserve the fixed-destination event table in `src/workflow/transitions.ts`. Apply transitions through `transitionWorkflow`. Keep Git execution outside the transition module. Do not introduce conditional transition callbacks or a general transition framework.

Reuse `src/tools/utils/pi-subagent-delegation.ts` for delegation error handling rather than adding simplifier-specific timeout handling. Acceptance criteria do not require separate tests: shared scenarios can assert warning and phase, and configuration coverage can extend existing tests.

Relevant integration points are `src/workflow/verifier/completeVerifierPass.ts`, `src/workflow/verifier/resolveFindings.ts`, `src/tools/main/run-verifier.ts`, the two extensions, configuration, path handling, agent-role mapping, and Maestro instructions and status.

Agent quality rules are verified by inspecting the shipped instructions. Scripted delegation can check the workflow without claiming that a real model performed or independently verified a refactoring.

## 4. Acceptance criteria

### AC1: Successful verification starts simplification

1. Coverage: success
2. Probe: Complete a running verifier pass with all probes passed and no findings, including when Git is unavailable.
3. Expected result: The saved phase is `simplifier-running`.
4. Example: For spec `20260321-143052-add-weather-alerts`, with Git unavailable, submit a valid `V1` with passed `AC1` and `findings: []`. The workflow saves `simplifier-running`, not `candidate-ready`.

### AC2: Rejecting all findings starts simplification

1. Coverage: success
2. Probe: Record rejection of every current finding, including outside a Git repository.
3. Expected result: The saved phase is `simplifier-running`.
4. Example: In `finding-decisions` outside a Git repository, reject the sole finding `V1/F1` with reason `Outside approved scope`. The saved phase becomes `simplifier-running` without another verifier pass.

### AC3: Unavailable Git produces a skip warning

1. Coverage: success
2. Probe: From `simplifier-running`, invoke `maestro_run_simplifier` when its Git command is unavailable, fails, or does not return `true`.
3. Expected result: The tool returns warning `Simplifier skipped: Git repository unavailable.`
4. Example: After either entry route saves `simplifier-running`, invoke the run tool outside a Git repository. Its readiness command fails and it returns `Simplifier skipped: Git repository unavailable.` The same warning applies when Git cannot be executed or returns `false`.

### AC4: A Git skip concludes the workflow

1. Coverage: success
2. Probe: From `simplifier-running`, invoke the run tool when Git readiness cannot be confirmed.
3. Expected result: The saved phase is `candidate-ready` without an execution error.
4. Example: With Git unavailable and the phase already `simplifier-running`, invoke `maestro_run_simplifier`. Its explicit skip transition saves `candidate-ready` instead of leaving a running workflow.

### AC5: Simplifier delegation uses its execution configuration

1. Coverage: success
2. Probe: With Git readiness confirmed, invoke the registered simplifier run tool from `simplifier-running` and inspect its delegation request.
3. Expected result: One foreground request targets `maestro.simplifier` with the active spec, canonical project directory, fresh context, and resolved simplifier configuration.
4. Example: For spec `20260321-143052-add-weather-alerts` in Git working tree `/work/app`, use default configuration. The request identifies that spec and `/work/app`, uses fresh context, model `openai-codex/gpt-6.1-sol`, thinking `high`, and a 60-minute timeout.

### AC6: The simplifier saves the agreed handoff

1. Coverage: success
2. Probe: Record a valid result after refactoring a selected file and its initially unchanged caller.
3. Expected result: `handoffs/simplifier/S.json` contains exactly the agreed handoff fields and submitted result.
4. Example: Submit `refactoredFiles: ["src/counts.ts", "src/report.ts"]`, summary `Simplified counting`, and notes `["Updated the caller to read the Map."]`. The saved `S.json` contains those values, the active spec ID, and version `1.0.0`, with no extra fields.

### AC7: Simplifier completion concludes the workflow

1. Coverage: success
2. Probe: Complete a simplifier pass that needs no refactoring.
3. Expected result: `SIMPLIFIER_DONE` saves `candidate-ready`.
4. Example: In `simplifier-running`, record summary `No simplification needed`, `refactoredFiles: []`, and `notes: []`. The saved phase becomes `candidate-ready`.

### AC8: Invalid simplifier submissions do not change protocol files

1. Coverage: failure
2. Probe: Submit an otherwise valid simplifier result with an invalid payload, wrong spec identity, or wrong phase.
3. Expected result: Submission is rejected before any artifact or workflow write.
4. Example: For active spec `20260321-143052-add-weather-alerts`, independently try `refactoredFiles: ["../outside.ts"]`, an extra `findings: []` field, spec ID `20260321-143052-other-spec`, and submission from `verifier-running`. Each attempt is rejected and leaves the workflow and handoff files unchanged.

### AC9: Returning without a handoff cannot complete simplification

1. Coverage: failure
2. Probe: A delegated simplifier returns a successful execution response without recording its handoff.
3. Expected result: The run tool reports a protocol error rather than completing the workflow.
4. Example: Start in `simplifier-running` with no `S.json`. Return `completed` from delegation without calling the handoff tool. The tool reports the missing valid result and the saved phase remains `simplifier-running`.

### AC10: Simplifier execution failure stops the workflow

1. Coverage: failure
2. Probe: A delegated simplifier fails, times out, or is interrupted before recording a handoff.
3. Expected result: The run tool reports the execution error without advancing the workflow.
4. Example: Return a timeout response before any `S.json` is saved. The timeout is reported and the workflow remains `simplifier-running`, without a synthetic finding or escalation.

### AC11: Simplifier defaults preserve existing configuration files

1. Coverage: success
2. Probe: Resolve configuration containing only `version: "1.0.0"`.
3. Expected result: The resolved simplifier configuration contains its agreed defaults.
4. Example: Load `{"version":"1.0.0"}`. Its `simplifier` value is `{"model":"openai-codex/gpt-6.1-sol","thinking":"high","timeoutMinutes":60}`.

### AC12: Simplifier overrides are independent

1. Coverage: success
2. Probe: Resolve configuration with only a simplifier timeout override.
3. Expected result: Only that timeout differs from the default resolved agent configuration.
4. Example: Load `{"version":"1.0.0","simplifier":{"timeoutMinutes":90}}`. The simplifier timeout is 90, its model and thinking retain their defaults, and builder and verifier configuration retain their defaults.

### AC13: Invalid simplifier configuration is rejected

1. Coverage: failure
2. Probe: Validate a simplifier timeout below the existing minimum.
3. Expected result: Configuration validation rejects the invalid timeout.
4. Example: Load `{"version":"1.0.0","simplifier":{"timeoutMinutes":0}}`. Validation reports an invalid simplifier timeout instead of resolving it.

### AC14: Verifier guidance no longer assigns the extra quality review

1. Coverage: success
2. Probe: Inspect the shipped verifier instructions.
3. Expected result: The additional AGENTS.md code-quality review responsibility is absent.
4. Example: Read `agents/verifier.md`. It no longer contains the `Review code quality` section or its instruction-violation review procedure.

### AC15: The shipped simplifier guidance preserves the supplied content

1. Coverage: success
2. Probe: Compare the bundled agent instructions with the supplied guidance and the agreed caller clarification.
3. Expected result: The agent retains the five supplied guidance sections, including their examples and tables, with the agreed caller explanation.
4. Example: Read `agents/simplifier.md`. Its clarity example still replaces the object reduction with a `Map`, and explains updating `result.a.count` to `result.get("a")` as part of the same internal refactoring.

### AC16: Simplifier instructions preserve the accepted check baseline

1. Coverage: success
2. Probe: Inspect the simplifier's instructions for a candidate whose existing check failure the owner explicitly accepted through a rejected finding.
3. Expected result: The instructions permit the accepted failure to remain, while forbidding new check failures, repairs to rejected findings, and test changes made to pass checks.
4. Example: `V1/F1` reports an existing failing translation check and the owner rejects it as `Outside approved scope`. Read `agents/simplifier.md`: its instructions allow that accepted failure to remain, but prohibit fixing F1, changing its test to pass, or introducing another check failure.

### AC17: Maestro starts simplification without another approval

1. Coverage: success
2. Probe: Inspect Maestro instructions and entry-tool results for successful verification and rejection of all findings, regardless of Git availability.
3. Expected result: Both routes direct Maestro to invoke `maestro_run_simplifier` next, without another approval or verifier pass.
4. Example: A verifier result returns `simplifier-running` for spec `20260321-143052-add-weather-alerts`. Maestro's instructions direct a call to `maestro_run_simplifier` for that spec, not a final summary or another `GREEN FLAG` request. The same instruction applies after rejection of all findings.

### AC18: Maestro reports the saved simplifier result

1. Coverage: success
2. Probe: Inspect Maestro's final-summary guidance for a completed simplifier result.
3. Expected result: Maestro is directed to report the simplifier's saved summary and notes without attributing later refactoring to independent verifier checks.
4. Example: `S.json` contains summary `Simplified counting` and note `Updated the caller to read the Map.` The final-summary instructions require Maestro to use those values as the simplifier's report, not as verifier evidence.

### AC19: The running simplifier is visible in status

1. Coverage: success
2. Probe: Observe workflow status while simplifier delegation is active.
3. Expected result: Status shows the broom icon (`U+1F9F9`) with `Simplifier running` rather than `Completed`.
4. Example: Pause a scripted simplifier response while the workflow is `simplifier-running`. Status shows the broom icon followed by `Simplifier running` until a valid handoff completes the phase.

### AC20: Activation presents the configured simplifier independently of Git

1. Coverage: success
2. Probe: Activate Maestro with valid agent and model availability, including when Git is unavailable or the project has no repository.
3. Expected result: The UI-only activation notice identifies the configured simplifier model and thinking level without predicting a Git skip.
4. Example: With Git unavailable, default configuration, and all model and agent checks passing, the notice includes `Simplifier (openai-codex/gpt-6.1-sol high)`, not a Git skip message.

### AC21: Unavailable simplifier dependencies block activation

1. Coverage: failure
2. Probe: Activate Maestro with an unavailable configured simplifier model or agent, while other prerequisites are valid, including when Git is unavailable.
3. Expected result: Activation fails and identifies the unavailable simplifier dependency.
4. Example: With Git unavailable, configure `simplifier.model: "openai-codex/missing"` while builder and verifier dependencies remain available. Activation reports the unavailable configured model rather than enabling Maestro. Separately, make `maestro.simplifier` unavailable with all models valid and observe the agent availability error.

### AC22: A Git skip does not launch the simplifier

1. Coverage: success
2. Probe: Invoke `maestro_run_simplifier` from `simplifier-running` when Git readiness cannot be confirmed.
3. Expected result: No simplifier delegation request is emitted.
4. Example: Outside a Git repository, invoke the run tool. It returns the skip result without emitting a request for `maestro.simplifier`.
