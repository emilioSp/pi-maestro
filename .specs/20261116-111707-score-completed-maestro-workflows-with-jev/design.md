# Score completed Maestro workflows with Jev

## Decisions

### Dedicated scoring tool

Use maestro_score_workflow to own evidence collection, the classifier request, validation, and persistence. Maestro does not supply or alter scores. This replaces the instruction-only approach because reliable execution is required.

See [REQ2](spec.md#req2-the-scoring-tool-must-collect-the-workflow-evidence-itself), [REQ3](spec.md#req3-the-scoring-tool-must-use-the-exact-jev-classifier-through-pi), and [REQ5](spec.md#req5-the-scoring-tool-must-persist-an-inspectable-evaluation-outcome).

### Source layout

Place the scoring tool in src/tools/main/ alongside the existing Maestro tools. Place its supporting scoring functions in the new src/score/ directory. The tool handles registration and delegates scoring work to these functions.

### Human-readable scoring questions

- src/score/questions.md: human-readable questions, instructions, and rubric levels.
- src/score/getScoreQuestions.ts: loads questions.md and converts its fixed structure into Pi's classifier question format.

Use one section per dimension, with instructions and five ordered rubric levels. This Markdown file is runtime input, not deferred human-facing documentation. No additional dependency or generic Markdown parser is needed.

### Pi classifier integration

Use context.modelRegistry to resolve and classify with the exact OpenRouter Jev model. Do not invoke the codemode sandbox from the tool or integrate a provider API directly. Pi owns credentials and provider execution.

The repository's Pi 1.5.0 ModelRegistry already exposes getModelOfType and classify; no dependency upgrade is needed for these operations.

### Evaluation files

Keep two files in the active spec folder, separating the original classifier response from the normalized workflow report:

- evaluation.raw.json: the complete, unmodified Pi ClassifierResult whenever a response is returned, including error responses. This is not the provider's HTTP response body. Do not fabricate this file when no classifier response exists.
- evaluation.json: spec and model identity, rubric version, status, and either the two normalized 0–100 scores with their confidence values or failure details without scores.

Overwrite both files with the latest attempt's results; do not keep evaluation history or reuse previous results. If no classifier response is returned, remove any previous evaluation.raw.json so it cannot be mistaken for the latest attempt's response.

See [REQ5](spec.md#req5-the-scoring-tool-must-persist-an-inspectable-evaluation-outcome) for persistence behavior and [REQ6](spec.md#req6-the-scoring-tool-must-save-evaluation-failures-without-scores) for failure handling.

### Explicit scoring phase

Add WORKFLOW_PHASES.SCORER_RUNNING with value scorer-running. Routes that previously completed implementation at candidate-ready instead enter scorer-running: builder completion with both later roles disabled, successful verification with simplification disabled, rejection of all findings with simplification disabled, simplifier completion, and simplifier skipping.

Maestro calls maestro_score_workflow in scorer-running. The tool saves the evaluation outcome before applying the scoring completion transition to candidate-ready. Both saved success and saved failure complete the phase; owner cancellation and persistence errors leave it running. Cancellation is not converted into a completed evaluation failure. Spec-only approval goes directly to candidate-ready.

Define all affected transitions in src/workflow/transitions.ts and apply them through transitionWorkflow. No nested automatic tool invocation or additional message-level scoring guard is needed; the saved phase controls whether completion can be finalized. See [REQ7](spec.md#req7-maestro-must-enforce-evaluation-before-automatic-finalization).

## Contracts and prototypes

The scoring tool accepts only specId. The fixed classifier questions are correctness and verificationQuality, each using score with five ordered rubric levels. Pi returns fractional level scores and confidence, not free-form explanations.

Git collection is equivalent to git diff HEAD -- for tracked edits plus git ls-files --others --exclude-standard -z and an additions-only git diff --no-index -- /dev/null for each untracked file. Exit status 1 from --no-index means differences, not command failure. Use literal argument boundaries and no external diff helper.

## Risks and limits

- The current extension arms final-response deactivation in extensions/maestro.ts on a candidate-ready tool_result and deactivates on message_end. Implementation completion now returns scorer-running, so it does not arm this path until scoring completes. Spec-only approval remains eligible for finalization directly.
- If Maestro omits the scoring call, the workflow stays in scorer-running instead of being declared complete. The phase does not force a model to issue a tool call or prevent arbitrary assistant prose; it enforces saved workflow completion.
- Final diffs cannot reconstruct historical code. Earlier reports are evaluated as workflow evidence rather than against invented historical snapshots.
- Git changes may predate this workflow. No per-spec baseline or attribution mechanism is added.
- Do not silently score truncated inputs. No special handling for binary changes is included in this change.
- Evaluation transmits the approved documents, handoffs, and collected code changes to the configured OpenRouter service.
- An evaluation is a model judgment, not an independent proof that no defects exist.
