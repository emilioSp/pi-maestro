# Glossary

## Terms

### Roles

| Term         | Meaning                                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `Owner`      | The person who approves the `spec`, decides questions and `findings`, and performs the final review.                             |
| `Maestro`    | The coordinator that prepares the `spec`, runs the agents, and records `owner` decisions.                                        |
| `Builder`    | The agent that implements the approved `spec` and checks every `GIVEN`, `WHEN`, and `THEN` scenario.                             |
| `Verifier`   | The independent agent that checks the implementation and reports technical issues.                                               |
| `Simplifier` | The agent that refactors accepted code for clarity without changing behavior or introducing check failures.                      |
| `Scorer`     | The optional classifier invoked by `Maestro` to score workflow correctness and verification quality against the approved `spec`. |

### Specification

| Term                          | Meaning                                                                                                                                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Spec`                        | A `specification` for one change: `proposal.md` for motivation and scope, `spec.md` for behavior and `acceptance criteria`, and optional `design.md` for technical decisions. The present documents are approved and frozen together. |
| `Delta`                       | Field under each requirement in `spec.md` that shows whether it adds, modifies, or removes behavior.                                                                                                                                  |
| `Verified by`                 | Field under each requirement in `spec.md` that links to the `acceptance criteria` or existing tests that cover it.                                                                                                                    |
| `Acceptance criterion` (`AC`) | One required, observable result defined in the `spec`.                                                                                                                                                                                |
| `GIVEN`                       | The starting conditions of an `acceptance criterion`.                                                                                                                                                                                 |
| `WHEN`                        | The action or observation that checks the behavior of an `acceptance criterion`.                                                                                                                                                      |
| `THEN`                        | The measurable outcome the `WHEN` must produce.                                                                                                                                                                                       |
| `Assumption`                  | A detail the request did not specify or a scope boundary taken as given. A false `assumption` during implementation is an `escalation` trigger.                                                                                       |

### Approval and decisions

| Term          | Meaning                                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `GREEN FLAG`  | The owner's explicit reply that approves the current `spec` and proceeds through the selected phases.                                       |
| `Escalation`  | An implementation question or reportable technical problem that the `builder` records in its `handoff` for an `owner` decision.             |
| `Finding`     | A technical issue that the `verifier` records for an `owner` decision.                                                                      |
| `fix-code`    | An `owner` decision that requests code fixes without changing the approved `spec`.                                                          |
| `revise-spec` | An `owner` decision that records a reason and agreed requirement change, then returns to `drafting-spec` for revision and renewed approval. |
| `reject`      | An `owner` decision that declines a `finding` and records a reason. It does not mean that verification passed.                              |

### Runs and results

| Term              | Meaning                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Run` or `pass`   | One agent execution with a fresh conversation.                                                                                                          |
| `Artifact`        | A saved workflow file, such as a `spec`, or a `handoff` between agents.                                                                                 |
| `Handoff`         | A saved agent report. `Builder` and `verifier` reports include `probe` outcomes. A `simplifier` report includes refactored files, a summary, and notes. |
| `Observability`   | The owner's ability to inspect workflow progress and reported results.                                                                                  |
| `Candidate`       | The project files created by agents after a workflow `run`                                                                                              |
| `candidate-ready` | The completed workflow phase. Final review remains with the `owner`.                                                                                    |

## Identifiers and file names

| Label          | Meaning                                                           | Location or scope                                                               |
| -------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `<spec-id>`    | The identifier shared by the `spec` and its workflow `artifacts`. | The directory name under `<project-root>/.specs/` by default.                   |
| `B1`, `B2`     | `Builder` `handoff` 1, `builder` `handoff` 2.                     | `handoffs/builder/B1.json`, `handoffs/builder/B2.json`.                         |
| `V1`, `V2`     | `Verifier` `handoff` 1, `verifier` `handoff` 2.                   | `handoffs/verifier/V1.json`, `handoffs/verifier/V2.json`.                       |
| `S.json`       | The fixed, unnumbered `simplifier` `handoff`.                     | `handoffs/simplifier/S.json`.                                                   |
| `E1`, `E2`     | `Escalation` 1, `escalation` 2 within one `builder` report.       | Entries in that report's `escalations` list.                                    |
| `F1`, `F2`     | `Finding` 1, `finding` 2 within one `verifier` report.            | Entries in that report's `findings` list.                                       |
| `REQ1`, `REQ2` | Requirement 1, requirement 2.                                     | Requirements in `spec.md`, each with a `Verified by` field.                     |
| `AC1`, `AC2`   | `Acceptance criterion` 1, `acceptance criterion` 2.               | Criteria in `spec.md` and the matching `acceptanceCriteria` entries in reports. |
| `B1/E1`        | `Escalation` 1 in `builder` `handoff` 1.                          | The question with `id: "E1"` inside `handoffs/builder/B1.json`.                 |
| `V1/F2`        | `Finding` 2 in `verifier` `handoff` 1.                            | The `finding` with `id: "F2"` inside `handoffs/verifier/V1.json`.               |

All paths in this table are relative to the `spec` directory unless stated otherwise. The [configuration](configuration.md#path-rules) can change the directory that
contains `specs`.
