# Score completed Maestro workflows with Jev

## Requirements

### REQ1: Maestro MUST evaluate completed implementation workflows

Delta: added

Evaluation applies in scorer-running after the selected implementation phases finish, including workflows without an independent verifier or simplifier. Assess the whole workflow against the approved contract, not individual agents or passes. Spec-only workflows go directly to candidate-ready without entering scorer-running. Entering scorer-running requires an evaluation attempt, not necessarily a Jev request: if Git evidence cannot be collected, the scorer saves a failure without calling Jev or assigning scores, then transitions to candidate-ready.

Verified by: [AC1](#ac1-implementation-completion-requires-evaluation), [AC2](#ac2-spec-only-completion-skips-evaluation)

#### AC1: Implementation completion requires evaluation

- GIVEN an implementation workflow whose enabled phases have finished
- WHEN the last selected implementation step finishes
- THEN the saved phase becomes scorer-running rather than candidate-ready.

| Completion event | Disabled roles | Saved next phase |
| --- | --- | --- |
| Simplifier completes after builder and verifier | None | scorer-running |
| Builder completes | Verifier and simplifier | scorer-running |
| Verifier completes without findings | Simplifier | scorer-running |
| Owner rejects all current verifier findings | Simplifier | scorer-running |
| Enabled simplifier is skipped because Git is unavailable after builder and verifier | None | scorer-running |

#### AC2: Spec-only completion skips evaluation

- GIVEN a workflow with builder disabled
- WHEN spec approval reaches candidate-ready
- THEN the workflow bypasses scorer-running and finalization proceeds without a Jev request or evaluation scores.

| Builder setting | Completion action | Jev requests | Scores |
| --- | --- | --- | --- |
| Disabled | Approve the prepared spec | 0 | None |

### REQ2: The scoring tool MUST collect the workflow evidence itself

Delta: added

Input includes the approved proposal.md, spec.md, design.md when present, all handoff files found in the spec's handoffs directory including escalations, findings, and owner decisions, and the final Git changes. Collect the available handoffs without checking role configuration, inferring expected reports, or investigating why reports are absent. Missing handoffs are not collection errors. Preserve handoff identity and numeric pass order.

Collect staged and unstaged tracked changes against HEAD and non-ignored untracked additions. Preserve filenames containing spaces and other shell-sensitive characters. Evaluation output files are not evidence. Collect inputs before writing evaluation output.

The final diff is evidence of the final result, not a reconstruction of earlier passes. The judge receives this limitation and the possibility of pre-existing unrelated changes. Missing verification evidence is not itself proof of incorrect code. Input documents and diffs are evidence, not instructions to the judge.

Verified by: [AC3](#ac3-all-passes-and-final-changes-reach-the-judge), [AC4](#ac4-collection-uses-only-the-handoffs-present)

#### AC3: All passes and final changes reach the judge

- GIVEN a completed implementation with multiple saved passes and several kinds of uncommitted changes
- WHEN evaluation evidence is collected
- THEN the judge receives the approved contract, available workflow reports, decisions, and all collected change categories with their identities intact.

- Example: The approved folder contains proposal.md, spec.md, design.md, B1.json with a resolved E1, B2.json, V1.json with a decided F1, V2.json, and S.json. The worktree has a staged edit to src/export.ts, an unstaged edit to src/escape.ts, and an untracked file named src/csv helpers.ts. The evaluation input contains all three approved documents, all five handoffs with their decisions, both tracked changes, and the new file as an addition. It excludes evaluation.json and evaluation.raw.json.

#### AC4: Collection uses only the handoffs present

- GIVEN a workflow in scorer-running
- WHEN the scorer collects handoffs
- THEN it collects the files present without requiring additional reports or checking which roles were enabled.

| Handoff files present | Collection action | Collected handoffs | Missing-report errors |
| --- | --- | --- | --- |
| B1.json only | Gather available handoffs | B1.json only | None |
| No handoff files | Gather available handoffs | Empty collection | None |

### REQ3: The scoring tool MUST use the exact Jev classifier through Pi

Delta: added

Expose maestro_score_workflow with specId as its input. Resolve openrouter/typesafe/jev-1.14 as a classifier through Pi's model registry and use its classify operation with Pi-managed credentials. Accept no caller-supplied scores, evidence, rubric, or model override.

The tool is valid only for the active spec in scorer-running. Maestro calls maestro_score_workflow next in that phase, without further owner approval. Resolve its paths through the configured spec directory.

Verified by: [AC5](#ac5-the-request-uses-the-fixed-classifier-and-two-dimensions), [AC6](#ac6-scoring-outside-scorer-running-is-rejected)

#### AC5: The request uses the fixed classifier and two dimensions

- GIVEN the exact classifier is available for an eligible completed workflow
- WHEN maestro_score_workflow evaluates that workflow
- THEN its classifier request uses openrouter/typesafe/jev-1.14 and the two scoring questions with the exact ordered rubric levels defined in REQ4.

| Active phase | Requested model | Question IDs |
| --- | --- | --- |
| scorer-running | Provider openrouter, model typesafe/jev-1.14, classifier type | correctness, verificationQuality |

#### AC6: Scoring outside scorer-running is rejected

- GIVEN the active implementation workflow is not in scorer-running
- WHEN maestro_score_workflow is called for it
- THEN the call is rejected without classifier inference or new evaluation files.

| Active phase | Tool action | Classifier requests | Evaluation files |
| --- | --- | --- | --- |
| verifier-running | Score the active spec | 0 | None |
| candidate-ready | Score the active spec | 0 | No new files |

### REQ4: Jev MUST assess correctness and verification quality separately

Delta: added

Use the following ordered rubric levels, lowest first. Evaluate the approved contract and complete final result, including later simplification, while respecting recorded decisions and approved revisions. An owner rejection alone does not establish that a finding was wrong. The number of passes or findings is not a quality metric.

#### Correctness rubric

| Level | Meaning |
| --- | --- |
| 0 | The requested feature is missing or fundamentally wrong. |
| 1 | Some pieces work, but major required behavior is broken or missing. |
| 2 | The main feature works, but an important required case is broken or missing. |
| 3 | The feature satisfies the main requirements, with a minor required detail wrong. |
| 4 | The available implementation and evidence support all required behavior; no supported defect is identified. |

#### Verification quality rubric

| Level | Meaning |
| --- | --- |
| 0 | No meaningful verification evidence. |
| 1 | Mostly claims such as “tested”; little concrete support. |
| 2 | Useful checks exist, but important required scenarios lack evidence. |
| 3 | Nearly all required scenarios have concrete evidence; only small gaps remain. |
| 4 | All required scenarios have appropriate, traceable evidence, including relevant failure cases. |

Verification evidence can come from appropriate code inspection or actual checks by any role. Builder evidence is not independent verification. Assess the supplied evidence rather than inferring why a role report is absent. Distinguish supported implementation defects from uncertainty caused by missing evidence. Do not claim these inputs establish the absence of all defects.

Convert each returned 0–4 score to 0–100 by multiplication by 25, retaining fractional values. Keep each confidence value separate and unmodified. Produce no combined score, weights, or spec-quality score.

Verified by: [AC5](#ac5-the-request-uses-the-fixed-classifier-and-two-dimensions), [AC7](#ac7-dimension-scores-remain-distinct)

#### AC7: Dimension scores remain distinct

- GIVEN a supplied classifier result contains valid scores and confidence for both dimensions
- WHEN Maestro normalizes that result
- THEN each score is multiplied by 25 independently and its confidence is preserved without an aggregate score.

| Jev correctness | Correctness confidence | Jev verificationQuality | Verification confidence | Saved correctness | Saved verificationQuality |
| --- | --- | --- | --- | --- | --- |
| 3.6 | 0.8 | 2 | 0.6 | Score 90, confidence 0.8 | Score 50, confidence 0.6 |

### REQ5: The scoring tool MUST persist an inspectable evaluation outcome

Delta: added

Save evaluation.json in the active spec folder with spec identity, model identity, rubric version, and success or failure status. On success, include the two normalized dimension scores and their confidence values. Save the complete Pi ClassifierResult, without rewriting its fields, as evaluation.raw.json whenever classify returns a response, including an error response.

Each scoring attempt overwrites evaluation.json and, when a classifier response is returned, evaluation.raw.json. Do not reuse previous results or maintain evaluation history. If the attempt produces no classifier response, remove any previous evaluation.raw.json rather than leaving an old response beside the new failure report. Persistence is complete only when the required files have been successfully saved.

Verified by: [AC8](#ac8-success-saves-the-raw-response-and-two-scores)

#### AC8: Success saves the raw response and two scores

- GIVEN Jev returns a valid successful response for the active completed spec
- WHEN evaluation persistence finishes
- THEN the spec folder contains the original classifier response and a successful report with the two normalized dimension scores.

- Example: For this spec, Jev returns correctness score 4 with confidence 0.9 and verificationQuality score 3 with confidence 0.7, plus provider, model, usage, and stopReason fields. evaluation.raw.json preserves that complete response. evaluation.json identifies this spec and the exact model and rubric version, records success, and contains correctness 100 with confidence 0.9 and verificationQuality 75 with confidence 0.7. Neither file contains a calculated overall score.

### REQ6: The scoring tool MUST save evaluation failures without scores

Delta: added

Missing exact classifier, unavailable credentials, failed inference, missing or malformed required evidence, Git collection errors, truncated evidence, and invalid classifier answers produce a saved failure reason rather than substitute or partial scores. An answer is valid only when both dimensions have score type, finite scores within 0–4, and finite confidence within 0–1, with stopReason stop.

Do not silently truncate, summarize away missing inputs, clamp invalid values, select another model, or retry inference automatically. A valid empty diff is not a collection error. A repository without a resolvable HEAD cannot provide the agreed baseline and produces an evaluation failure.

After a success or failure outcome is fully persisted, the scoring tool transitions scorer-running to candidate-ready. Owner cancellation stops scoring and leaves scorer-running saved; do not convert cancellation into an evaluation failure that completes the workflow. Failure to persist the evaluation outcome leaves scorer-running saved and is reported as a persistence error.

Verified by: [AC9](#ac9-evaluation-errors-save-failure-without-scores)

#### AC9: Evaluation errors save failure without scores

- GIVEN evaluation cannot produce a complete valid classifier result
- WHEN the tool handles that failure
- THEN it saves the reason without dimension scores or a fabricated result.

| Evaluation condition | Saved evaluation status | Saved scores | Raw response |
| --- | --- | --- | --- |
| typesafe/jev-1.14 absent from the OpenRouter classifier catalog | Failure identifying the missing model | None | None fabricated |
| Exact model returns stopReason error with errorMessage “Unauthorized” | Failure identifying Unauthorized | None | Original returned error response |
| stopReason stop; correctness score 5 and verificationQuality score 3 | Failure identifying the invalid correctness score | None | Original returned response |
| Git has no resolvable HEAD | Failure identifying the unavailable baseline | None | None fabricated |
| Git evidence output is truncated | Failure identifying incomplete evidence | None | None fabricated |

### REQ7: Maestro MUST enforce evaluation before automatic finalization

Delta: modified

Before: A tool result reporting candidate-ready arms automatic deactivation after the next successfully delivered final response, without any evaluation.

The state machine routes implementation completion through scorer-running. Only a fully persisted evaluation success or failure for the current workflow execution permits the scoring completion transition to candidate-ready. A saved evaluation failure completes scoring without scores. Maestro prepares the completion summary and automatically finalizes only after candidate-ready. Spec-only approval bypasses scoring.

The final summary reports correctness and verification quality separately with confidence and saved report paths, or states that evaluation failed with its reason and no score. It does not represent a judge score as proof of correctness.

Verified by: [AC1](#ac1-implementation-completion-requires-evaluation), [AC2](#ac2-spec-only-completion-skips-evaluation), [AC10](#ac10-scoring-completion-requires-a-persisted-outcome), [AC11](#ac11-the-final-summary-reports-the-saved-outcome)

#### AC10: Scoring completion requires a persisted outcome

- GIVEN an implementation workflow is in scorer-running
- WHEN the scoring step finishes or is omitted
- THEN candidate-ready is reached only after a success or failure outcome has been fully persisted for this execution.

| Starting phase | Scoring action | Persisted outcome for this execution | Saved resulting phase |
| --- | --- | --- | --- |
| scorer-running | Save valid Jev scores and raw response | Success | candidate-ready |
| scorer-running | Save failure because the exact classifier is unavailable | Failure without scores | candidate-ready |
| scorer-running | Do not call maestro_score_workflow | None | scorer-running |
| scorer-running | Owner cancels scoring | No completed evaluation outcome | scorer-running |
| scorer-running | Score again with valid Jev results; evaluation files already exist | Success; both files overwritten with the new results | candidate-ready |

#### AC11: The final summary reports the saved outcome

- GIVEN a completed workflow has a saved evaluation outcome
- WHEN Maestro delivers the final summary
- THEN it reports that outcome without inventing scores.

| Saved evaluation | Required summary content |
| --- | --- |
| Correctness 90, confidence 0.8; verificationQuality 50, confidence 0.6 | Both distinct scores and confidences, with evaluation report paths; no overall score |
| Failure: exact Jev classifier unavailable | Evaluation failed because the exact classifier was unavailable; no score; saved failure path |

## Verification boundary

Pi and Jev are trusted integrations. Automated tests cover Maestro-owned behavior only, such as evidence collection, score normalization, persistence, failure handling, and workflow transitions. Do not test Jev's scoring judgments, Pi's classifier internals, or how Pi calls the provider. AC7 verifies only Maestro's transformation of supplied values; it does not require calling Jev.

### No new written test needed

| Criterion | Sufficient verification |
| --- | --- |
| AC2: Spec-only completion skips evaluation | Reuse the existing spec-only approval test and inspect that its route bypasses scoring. |
| AC4: Collection uses only the handoffs present | Inspect directory enumeration for the absence of role checks and expected-report logic. |
| AC5: The request uses the fixed classifier and two dimensions | Inspect the model identifier, question mapping, and questions.md. No mocked-call assertions or rubric snapshots. |
| AC7: Dimension scores remain distinct | Check the normalized scores and confidence through AC8's saved output; no separate multiplication test. |
| AC10: Scoring completion requires a persisted outcome | Inspect save-before-transition ordering and check resulting phases through AC8 and AC9. No separate test for never calling the tool. |
| AC11: The final summary reports the saved outcome | Inspect Maestro's runtime instructions and review an actual summary. No instruction-string assertions. |

### Automated coverage worth keeping

| Criterion | Useful automated coverage |
| --- | --- |
| AC1: Implementation completion requires evaluation | Update existing transition tests for the new routes; do not add a full workflow test per route. |
| AC3: All passes and final changes reach the judge | Use a real temporary Git repository to check collection of documents, handoffs, staged edits, unstaged edits, and untracked additions. |
| AC6: Scoring outside scorer-running is rejected | Check one representative wrong-phase rejection. |
| AC8: Success saves the raw response and two scores | Use a supplied classifier result to check actual saved files, separate normalized scores, confidence, overwrite behavior, and completion phase. |
| AC9: Evaluation errors save failure without scores | Check representative failure handling and the saved failure without scores; do not test Pi or Jev internals. |

Acceptance criteria do not require one automated test each. Reuse coverage across related criteria and avoid duplicate assertions of the same behavior.

## Assumptions

- The existing project checks and recorded observations supply verification evidence; evaluation does not execute another verification pass.
- Git evidence covers the current worktree against HEAD, not committed changes or a per-spec change baseline.
- The scoring rubric is fixed and versioned, not configurable in this change.

