# Glossary

## Terms

| Term | Meaning |
|---|---|
| `Owner` | The person who approves the `spec`, decides questions and `findings`, and performs the final review. |
| `Maestro` | The coordinator that prepares the `spec`, runs the agents, and records `owner` decisions. |
| `Builder` | The agent that implements the approved `spec` and runs its `probes`. |
| `Verifier` | The independent agent that checks the implementation and reports technical issues. |
| `Spec` | A `specification` that describes one change, its scope, and its `acceptance criteria`. The approved `spec` defines the required behavior. It is saved as `spec.md`. |
| `Acceptance criterion` (`AC`) | One required, observable result defined in the `spec`. |
| `Probe` | A scenario used to test an `acceptance criterion`. Reports record the actual command or procedure and its outcome. |
| `Expected result` | The observable result that a `probe` must produce. |
| `Artifact` | A saved workflow file, such as a `spec`, or a `handoff` between agents. |
| `Handoff` | A saved `builder` or `verifier` report with results, `probe` outcomes, and notes. |
| `Run` or `pass` | One execution of the `builder` or `verifier` with a fresh conversation. |
| `Candidate` | The project files created by agents after a workflow `run` |
| `Finding` | A technical issue that the `verifier` records for an `owner` decision. |
| `Escalation` | An implementation question that the `builder` records in its `handoff` for an `owner` decision. |
| `GREEN FLAG` | The owner's explicit reply that approves the current `spec` and starts the `builder`. |
| `fix-code` | An `owner` decision that requests code fixes without changing the approved `spec`. |
| `reject` | An `owner` decision that declines a `finding` and records a reason. It does not mean that verification passed. |
| `candidate-ready` | The completed workflow phase. The `verifier` reported no `findings`, or the `owner` rejected every `finding` with a reason. Final review remains with the `owner`. |

## Identifiers and file names

An ID is an identifier that names one record. These labels refer to records within one `spec`, not across all workflows.

| Label | Meaning | Location or scope |
|---|---|---|
| `<spec-id>` | The identifier shared by the `spec` and its workflow `artifacts`. | The directory name under `<project-root>/.specs/` by default. |
| `B1`, `B2` | `Builder` `handoff` 1, `builder` `handoff` 2. | `handoffs/builder/B1.json`, `handoffs/builder/B2.json`. |
| `V1`, `V2` | `Verifier` `handoff` 1, `verifier` `handoff` 2. | `handoffs/verifier/V1.json`, `handoffs/verifier/V2.json`. |
| `E1`, `E2` | `Escalation` 1, `escalation` 2 within one `builder` report. | Entries in that report's `escalations` list. |
| `F1`, `F2` | `Finding` 1, `finding` 2 within one `verifier` report. | Entries in that report's `findings` list. |
| `AC1`, `AC2` | `Acceptance criterion` 1, `acceptance criterion` 2. | Criteria in `spec.md` and the matching `acceptanceCriteria` entries in reports. |
| `B1/E1` | `Escalation` 1 in `builder` `handoff` 1. | The question with `id: "E1"` inside `handoffs/builder/B1.json`. |
| `V1/F2` | `Finding` 2 in `verifier` `handoff` 1. | The `finding` with `id: "F2"` inside `handoffs/verifier/V1.json`. |

All paths in this table are relative to the `spec` directory unless stated otherwise. The [configuration](configuration.md#path-rules) can change the directory that contains `specs`.

The `AC` prefix is the template's naming convention. Criterion IDs must be unique within the `spec`. Reports use the exact IDs from the `spec`.

`Builder` and `verifier` numbers count saved `handoffs` in separate sequences.

## Escalation references

Read `B1/E1` as "escalation 1 in builder report 1". `B1` selects `handoffs/builder/B1.json`. `E1` selects the entry with `id: "E1"` in its `escalations` list.

`Escalation` numbers restart at `E1` in each `builder` report. `B1/E1` and `B2/E1` identify different questions, even if they concern the same topic.

The `owner` discusses every current question with `Maestro`. `Maestro` records all answers and reasons together in that same `builder` report. See [Escalations](workflow.md#escalations) for the available choices and their effects.

## Finding references

Read `V1/F2` as "finding 2 in verifier report 1". `V1` selects `handoffs/verifier/V1.json`. `F2` selects the entry with `id: "F2"` in its `findings` list.

`Finding` numbers restart at `F1` in each `verifier` report. `V1/F2` and `V2/F2` identify different records, even if they describe a similar issue.

For example, a `finding` about a saved title can appear in a `Maestro` message like this:

> Verifier report 1, finding 2 (`V1/F2`): the title returns to "Draft" after saving "Ready" and reopening the item.
> Acceptance criterion 1 (`AC1`) requires the saved title to remain "Ready".

In this example, the finding's `acceptanceCriterion: "AC1"` connects the issue to criterion `AC1` in `spec.md`.

The `owner` discusses the issue with `Maestro`. `Maestro` records the decision in the same `verifier` report. See [Findings](workflow.md#findings) for the available choices and their effects.
