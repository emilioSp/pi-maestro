# pi-maestro

[![Coverage](https://img.shields.io/codecov/c/github/emiliosp/pi-maestro?logo=codecov)](https://codecov.io/gh/emiliosp/pi-maestro)

Pi extension for writing a `spec` and optionally implementing it through a spec-driven multiagent workflow.

![Maestro workflow](docs/maestro.png)

## How it works

Every change starts with a `spec`. `Maestro` helps the `owner` to define a specification (`spec`) for a change, including clear requirements and acceptance criteria.

Two ways of working with `Maestro` are available:
- **Spec only:** Stop after approval and use the `spec` in another workflow.
- **Spec and implementation:** The `builder` implements the approved `spec`. Three optional steps can follow: the `verifier` independently checks every
  `acceptance criterion`, the `simplifier` improves the code without changing its behavior, and the [`scorer`](#llm-as-judge) rates the result and the quality of the
  verification evidence. These steps can be enabled independently. See [Phase selection](docs/configuration.md#phase-selection) for setup and defaults.

Each agent has a separate job. No agent approves its own work and the `owner` makes decisions when questions come up and reviews the final code.

Read [The Pi Maestro Manifesto](MANIFESTO.md) for the motivation behind the project.

https://github.com/user-attachments/assets/dffa8bc7-6c79-491f-95df-2ee95b6447aa

## Inspirations

Pi Maestro is inspired by concepts from [OpenSpec](https://github.com/Fission-AI/OpenSpec) and [GitHub Spec Kit](https://github.com/github/spec-kit). It adapts those
concepts to a sequential multiagent workflow in Pi. See [Inspirations](docs/inspiration.md) for details and sources.

## The roles

| Role         | Responsibility                                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `Owner`      | Brings the problem, approves the `spec`, decides questions, and reviews the final code.                  |
| `Maestro`    | Works directly with the `owner`, prepares the `spec`, runs the other agents, records decisions, and summarizes results. |
| `Builder`    | Implements the approved `spec`.                                                  |
| `Verifier`   | Independently checks the implementation against the approved `spec` and reports any technical issues it finds.                   |
| `Simplifier` | Refactors accepted code for clarity without changing behavior or introducing check failures.                            |
| `Scorer`     | Optional classifier invoked by `Maestro` to score correctness and verification quality.                                 |

## Prerequisites

- Node.js 26 or later. 
- Pi 1.5.0 or later.
- Access to the models for enabled agents.

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
3. Replies `GREEN FLAG` when `Maestro` asks for approval.
4. Answers each [builder escalation](docs/workflow.md#escalations) and gives a reason, if any arise.
5. Chooses what to do about each [verifier finding](docs/workflow.md#findings), if any arise.
6. Reads Maestro's summary and performs the final review.

The same `/maestro` command disables `Maestro` and leaves project files unchanged.

### Troubleshooting

If an agent fails, use the session path shown by `Maestro`, when available, to [inspect or export the session](docs/subagent-integration.md#inspecting-saved-sessions).

## LLM as Judge

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

- [Glossary](docs/glossary.md): terms and identifiers used in `specs`, reports, and `Maestro` messages. Read this before the first workflow.
- [Workflow](docs/workflow.md): approvals, decisions, and how each `run` produces `artifacts`.
- [Configuration](docs/configuration.md): project paths, models, and thinking levels.
- [Subagent integration](docs/subagent-integration.md): agent context, execution, and activity tracking.

## Project constitution

- [Mission](docs/MISSION.md): purpose, scope, and `owner` responsibilities.
- [Tech stack](docs/TECH_STACK.md): runtime technologies and development tools.
- [Roadmap](docs/roadmap/README.md): completed outcomes and planned work maintained in the repository.
- [Changelog](CHANGELOG.md): meaningful codebase changes and breaking changes.
- [Architecture decision records](docs/adr/README.md): architectural choices, context, consequences, and evidence.

## License

Copyright (c) 2026 Emilio Spatola. Licensed under [AGPL-3.0-or-later](LICENSE).
