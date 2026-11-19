# pi-maestro

[![Coverage](https://img.shields.io/codecov/c/github/emiliosp/pi-maestro?logo=codecov)](https://codecov.io/gh/emiliosp/pi-maestro)

Pi extension for writing a `spec` and optionally implementing it through a spec-driven multiagent workflow.

![Maestro workflow](docs/maestro.png)

## The idea

Read [The Pi Maestro Manifesto](MANIFESTO.md) for the motivation behind the project.

`Maestro` has two goals:

1. Help the `owner` write and approve a `specification` (`spec`) for one reversible change.
2. Implement the approved `spec` through a multiagent workflow.

The `owner` can use `Maestro` only to write and approve a `spec`, leaving implementation to another workflow, or to write the `spec` and implement it within `Maestro`.
`Spec` preparation and approval are required. The entire implementation stage is optional, and each of its phases is optional too:

1. The `builder` implements the approved `spec`.
2. The independent `verifier` checks every `acceptance criterion`.
3. The `simplifier` refactors accepted code without changing behavior.

Disabling the `builder` skips the entire implementation stage and scoring. With the `builder` enabled, the `verifier`, `simplifier`, and `scorer` can be disabled
independently.

In existing configurations, `builder` and `verifier` default to enabled;

`simplifier` and `scorer` default to disabled. Initial setup enables only selected roles.

See [Phase selection](docs/configuration.md#phase-selection) for details.

The `owner` performs the final review.

Five principles hold the workflow together:

1. The approved `spec` defines the required work for the `builder` and `verifier`.
2. No agent approves its own work.
3. When enabled, the `verifier` checks every `acceptance criterion` independently.
4. The `owner` decides requirements, scope, and unresolved questions.
5. Each agent has one and only one role. Specific and with clear instruction.

https://github.com/user-attachments/assets/dffa8bc7-6c79-491f-95df-2ee95b6447aa

## Inspirations

Pi Maestro is inspired by concepts from [OpenSpec](https://github.com/Fission-AI/OpenSpec) and [GitHub Spec Kit](https://github.com/github/spec-kit). It adapts those
concepts to a sequential multiagent workflow in Pi. See [Inspirations](docs/inspiration.md) for details and sources.

## The roles

| Role         | Responsibility                                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `Owner`      | Brings the problem, approves the `spec`, decides questions and `findings`, and reviews the final code.                  |
| `Maestro`    | Works directly with the `owner`, prepares the `spec`, runs the other agents, records decisions, and summarizes results. |
| `Builder`    | Implements the approved `spec` and checks each `acceptance criterion`.                                                  |
| `Verifier`   | Independently checks the project files against the `spec` and reports technical issues.                                 |
| `Simplifier` | Refactors accepted code for clarity without changing behavior or introducing check failures.                            |
| `Scorer`     | Optional classifier invoked by `Maestro` to score correctness and verification quality.                                 |

## Prerequisites

1. Node.js 26 or later.
2. Pi 1.5.0 or later.
3. Access to the models for enabled agents.

## Installation

The `owner` installs `Maestro`:

```bash
pi install npm:@emiliosp/pi-maestro
```

## Usage

The `owner` starts Pi from the project directory:

```bash
cd /path/to/project
pi
```

Activate `Maestro`:

```text
/maestro
```

Choose "New spec" to start or ["Restart spec"](docs/workflow.md#restart-an-existing-spec) to revisit an existing `spec`.

If the configuration is invalid or a model for an enabled implementation role is unavailable, `Maestro` stays off and reports the problem.

The `owner` follows this workflow:

1. Describes one change to `Maestro`.
2. Reviews the `spec`, including its `acceptance criteria` and concrete examples.
3. Replies `GREEN FLAG` when `Maestro` asks for approval. `Maestro` records the approval and starts the selected phases.
4. Reviews every current `builder` `escalation` and gives `Maestro` an answer and reason for each question.
5. Reviews `verifier` `findings` and chooses an action for every `finding`.
6. Reads Maestro's summary at `candidate-ready` and performs the final review.

Selected agents use Pi's SDK and run one at a time in the foreground. Pi waits for each `run` to finish, and `Maestro` shows the current phase in Pi's status.

During the workflow, the `builder` may raise `escalations` and the `verifier` may report `findings` that require human review. `Maestro` presents them to the `owner`, who
must decide how to proceed for each one. See [Escalations](docs/workflow.md#escalations) and [Findings](docs/workflow.md#findings) for details.

The same `/maestro` command disables `Maestro` and leaves project files unchanged.

### Troubleshooting

When a saved native child session exists, `Maestro` displays its path on completion or failure. For troubleshooting, the `owner` can review the agent's messages, tool
calls, and results by inspecting that file directly or exporting it to HTML:

```bash
pi --export /sessions/weather/subagents/child.jsonl conversation.html
```

## LLM as a judge

The optional `scorer` uses an explicitly selected Pi classifier to evaluate the entire workflow against the approved `spec` after implementation.

It scores:

- **correctness** (how well the result meets the requirements)
- **verification quality** (how well the evidence supports that result).

`Maestro` presents the results in the final summary.

See [Scorer configuration](docs/configuration.md#scorer) to choose a classifier.

This automatic grading system gives the `owner` a level of confidence in the workflow's outcome, not proof of correctness.

See [Workflow evaluation](docs/workflow.md#workflow-evaluation) for the criteria and scores.

## Configuration

On first use, `/maestro` opens guided setup to select agent models and thinking levels, plus an optional `scorer` classifier without a thinking level. Choices are saved
in `.pi/maestro.json`.

The `owner` can edit this file before activation. See [Configuration](docs/configuration.md) for fields, defaults, and phase selection.

## Documentation

The reading order is:

1. [Glossary](docs/glossary.md): terms and identifiers used in `specs`, reports, and `Maestro` messages. Read this before the first workflow.
2. [Workflow](docs/workflow.md): approvals, decisions, and how each `run` produces `artifacts`.
3. [Configuration](docs/configuration.md): project paths, models, and thinking levels.
4. [Subagent integration](docs/subagent-integration.md): agent context, execution, and activity tracking.

## Project constitution

1. [Mission](docs/MISSION.md): purpose, scope, and `owner` responsibilities.
2. [Tech stack](docs/TECH_STACK.md): runtime technologies and development tools.
3. [Roadmap](docs/roadmap/README.md): completed outcomes and planned work maintained in the repository.
4. [Changelog](CHANGELOG.md): meaningful codebase changes and breaking changes.
5. [Architecture decision records](docs/adr/README.md): architectural choices, context, consequences, and evidence.

## License

Copyright (c) 2026 Emilio Spatola. Licensed under [AGPL-3.0-or-later](LICENSE).
