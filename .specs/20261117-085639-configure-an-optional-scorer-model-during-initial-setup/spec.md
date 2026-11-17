# Configure an optional scorer model during initial setup

## Requirements

### REQ1: Initial setup MUST configure and save the scorer’s classifier selection without a thinking level

Delta: added

The scorer appears alongside Builder, Verifier, and Simplifier. Its model choices come from available Pi classifiers, not chat models. Selecting a classifier enables scoring; leaving the scorer unselected keeps it disabled.

The scorer configuration in `.pi/maestro.json` uses `scorer.required` and `scorer.model`. Enabling the scorer requires an explicit classifier model selection by the owner; there is no default model or fallback to the former fixed classifier.

Verified by: [AC1](#ac1-select-a-classifier-without-a-thinking-prompt), [AC2](#ac2-save-the-scorer-selection)

#### AC1: Select a classifier without a thinking prompt

- GIVEN initial setup with an available classifier and an available chat model
- WHEN the owner selects the scorer and chooses its classifier
- THEN setup records the classifier selection without prompting for a thinking level.

| Available classifier | Available chat model | Setup selection | Recorded scorer choice |
| --- | --- | --- | --- |
| `openrouter/typesafe/jev-1.14` | `openai-codex/gpt-6.1-sol` | Scorer → `openrouter/typesafe/jev-1.14` | `openrouter/typesafe/jev-1.14`, with no thinking prompt; the chat model is not a scorer choice |

#### AC2: Save the scorer selection

- GIVEN initial setup with a scorer selection or no scorer selection
- WHEN the owner confirms setup
- THEN `.pi/maestro.json` contains the corresponding scorer configuration without a thinking field.

| Scorer selection at confirmation | Saved `scorer` configuration |
| --- | --- |
| `openrouter/typesafe/jev-1.14` | `{"required":true,"model":"openrouter/typesafe/jev-1.14"}` |
| None | `{"required":false}` |

### REQ3: Workflow routing MUST skip scoring when the scorer is disabled

Delta: modified

Scoring is disabled by default, including when an existing configuration omits the scorer. Apply the same optional-phase routing pattern used for the simplifier: at each entry to scoring, choose `scorer-running` when enabled or `candidate-ready` when disabled. This includes simplifier completion and simplifier skipping. Disabled scoring does not enter `scorer-running` or invoke a classifier. The final summary identifies scoring as skipped.

Verified by: [AC3](#ac3-finish-without-scoring)

#### AC3: Finish without scoring

- GIVEN an implementation workflow with scoring disabled and no remaining implementation phases
- WHEN the workflow completes its last selected implementation phase
- THEN the workflow reaches `candidate-ready` without a classifier call and reports scoring as skipped.

| Scorer configuration | Last selected phase completed | Result |
| --- | --- | --- |
| Omitted | Builder, with verifier and simplifier disabled | `candidate-ready`; no classifier call; scoring reported as skipped |
| `{"required":false}` | Verifier, with simplifier disabled | `candidate-ready`; no classifier call; scoring reported as skipped |
| `{"required":false}` | Simplifier | `candidate-ready`; no classifier call; scoring reported as skipped |
| `{"required":false}` | Verifier, followed by simplifier skipping because Git is unavailable | `candidate-ready`; no classifier call; scoring reported as skipped |

### REQ4: Workflow scoring MUST reuse the existing scorer code with the configured classifier

Delta: modified

Do not create a new scoring implementation. Reuse the existing code in `src/score/requestEvaluation.ts` and `src/score/scoreWorkflow.ts`, replacing only the hardcoded classifier lookup and evaluation report identity with the configured classifier. Scoring runs after the selected implementation phases.

Verified by: [AC4](#ac4-evaluate-with-the-selected-classifier)

#### AC4: Evaluate with the selected classifier

- GIVEN an enabled scorer configured with an available classifier
- WHEN the implementation reaches scoring and classification succeeds
- THEN the evaluation uses that classifier and records its provider and model.

| Scorer configuration | Classifier invoked | Saved evaluation identity |
| --- | --- | --- |
| `{"required":true,"model":"openrouter/typesafe/jev-1.14"}` | `openrouter/typesafe/jev-1.14` | `provider: "openrouter"`, `model: "typesafe/jev-1.14"` |

### REQ5: Configuration validation MUST reject an enabled scorer without an explicit model

Delta: added

Verified by: [AC5](#ac5-reject-an-enabled-scorer-without-a-model)

#### AC5: Reject an enabled scorer without a model

- GIVEN a configuration with the builder and scorer enabled but no scorer model selected
- WHEN the owner activates Maestro
- THEN activation fails with an error identifying the missing scorer model.

| Builder configuration | Scorer configuration | Activation result |
| --- | --- | --- |
| Enabled with an available model | `{"required":true}` | Rejected: scorer model is required |
| Enabled with an available model | `{"required":true,"model":""}` | Rejected: scorer model is required |

## Verification Boundary

| Acceptance criterion | Automated tests required? | Verification boundary |
| --- | --- | --- |
| AC1 — Classifier selection without thinking | Yes | Verify classifier-only choices and absence of a thinking prompt. |
| AC2 — Save scorer selection | Yes | Verify saved configuration for selected and unselected scorer. |
| AC3 — Skip disabled scoring | Yes | Verify routing through each completion and skip path in the examples. |
| AC4 — Reuse scorer with configured classifier | Partly | Automatically verify configured model invocation and report identity. Inspect the code to verify reuse of the existing scoring implementation. |
| AC5 — Reject enabled scorer without model | Yes | Verify activation rejects missing and empty scorer models. |

Mock classifier calls; paid live inference is not required.

## Scope boundary

Scorer changes are limited to reading the selected classifier and recording its identity. Classifier availability is not an activation prerequisite: if the selected classifier is unavailable when scoring runs, the existing evaluation-failure reporting and completion behavior applies. Scoring questions, evidence collection, score normalization, and runtime failure handling remain outside this change.
