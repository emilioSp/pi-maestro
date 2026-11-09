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

Disabling the `builder` skips the entire implementation stage. With the `builder` enabled, the `verifier` and `simplifier` can be disabled independently. All three are
enabled when their flags are omitted from an existing configuration. Initial setup enables only selected roles. See
[Phase selection](docs/configuration.md#phase-selection).

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
concepts to a sequential multiagent workflow in Pi.

The following official sources document the conceptual references. The links point to fixed revisions so the cited content remains inspectable.

1. **The `specification` drives the code.** [Spec Kit's philosophy][spec-kit-philosophy] treats the `specification` as the primary `artifact` and code as its expression.
   In `Maestro`, the approved `spec` defines a working contract for the `builder` and `verifier`.
2. **Describe behavior, not routine implementation choices.** [OpenSpec's schema][openspec-schema] defines a `specification` as a behavior contract, not an implementation
   plan. `Maestro` records required behavior, constraints, and approved architectural decisions in the `spec`, leaving routine implementation choices to the `builder`.
3. **Use concrete, testable scenarios.** [OpenSpec's schema][openspec-schema] pairs requirements with scenarios; [Spec Kit's template][spec-kit-template] uses
   Given/When/Then acceptance scenarios. Each `Maestro` `acceptance criterion` includes a `GIVEN`, a `WHEN`, a `THEN`, and a concrete example.
4. **Clarify requirements progressively.** [Spec Kit's clarify command][spec-kit-clarify] asks one question at a time and integrates accepted answers into the
   `specification`. `Maestro` likewise asks one focused question, waits for the owner's answer, and updates the `spec` before asking the next question.
5. **Review requirements separately from testing code.** [Spec Kit's checklist command][spec-kit-checklist] evaluates requirements for completeness, clarity, consistency,
   and measurability, not implementation correctness. Before approval, `Maestro` reviews the `spec` for consistency, missing decisions, measurable outcomes, and
   reproducible scenarios. The later `verifier` checks the implementation independently.
6. **Separate motivation, behavior, and design.** [OpenSpec's schema][openspec-schema] separates these concerns and calls for `design.md` only when significant technical
   decisions need recording, including reasons, alternatives, and risks.
7. **Make requirement changes explicit.** [OpenSpec's schema][openspec-schema] distinguishes added, modified, removed, and renamed requirements. `Maestro` adapts this
   concept with one `Delta` field per requirement: `added`, `modified`, or `removed`. Each requirement heading states the required outcome with a named actor and `MUST`.
8. **Make requirement coverage traceable.** [Spec Kit's analyze command][spec-kit-analyze] maps requirements to implementation tasks and identifies coverage gaps.
   `Maestro` applies a related principle to verification: each requirement has a `Verified by` field linking to its `acceptance criteria`, existing tests covering exact
   scenarios, or both. The mapping connects requirements to verification.

[openspec-schema]: https://github.com/Fission-AI/OpenSpec/blob/6d04a1b58dedc95729d34e4f223d9d483aae210a/schemas/spec-driven/schema.yaml
[spec-kit-philosophy]: https://github.com/github/spec-kit/blob/222a973f8b8794366680c043fb935a31f71902af/spec-driven.md
[spec-kit-template]: https://github.com/github/spec-kit/blob/222a973f8b8794366680c043fb935a31f71902af/templates/spec-template.md
[spec-kit-clarify]: https://github.com/github/spec-kit/blob/222a973f8b8794366680c043fb935a31f71902af/templates/commands/clarify.md
[spec-kit-checklist]: https://github.com/github/spec-kit/blob/222a973f8b8794366680c043fb935a31f71902af/templates/commands/checklist.md
[spec-kit-analyze]: https://github.com/github/spec-kit/blob/222a973f8b8794366680c043fb935a31f71902af/templates/commands/analyze.md

## The roles

| Role         | Responsibility                                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `Owner`      | Brings the problem, approves the `spec`, decides questions and `findings`, and reviews the final code.                  |
| `Maestro`    | Works directly with the `owner`, prepares the `spec`, runs the other agents, records decisions, and summarizes results. |
| `Builder`    | Implements the approved `spec` and checks each `acceptance criterion`.                                                  |
| `Verifier`   | Independently checks the project files against the `spec` and reports technical issues.                                 |
| `Simplifier` | Refactors accepted code for clarity without changing behavior or introducing check failures.                            |

An `escalation` asks the `owner` to decide an implementation question. A `finding` records a technical issue reported by the `verifier`. The `owner` discusses both with
`Maestro`, not directly with the `builder` or `verifier`.

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

During activation, `Maestro` checks configuration and model availability for enabled agents. Model availability
comes from Pi's model registry. If a check fails, `Maestro` stays disabled and reports the problem.

The `owner` follows this workflow:

1. Describes one change to `Maestro`.
2. Reviews the `spec`, including its `acceptance criteria` and concrete examples.
3. Replies `GREEN FLAG` when `Maestro` asks for approval. `Maestro` records the approval and starts the selected phases.
4. Reviews every current `builder` `escalation` and gives `Maestro` an answer and reason for each question.
5. Reviews `verifier` `findings` and chooses an action for every `finding`.
6. Reads Maestro's summary at `candidate-ready` and performs the final review.

`Maestro` starts the `verifier`, when enabled, after a successful `builder` `run`. Selected agents use Pi's SDK and run one at a time in the foreground. Pi waits for each
`run` to finish, and `Maestro` shows the current phase in Pi's status.

When a saved native child session exists, `Maestro` displays its path on completion or failure. The `owner` can inspect that file directly or export it to HTML:

```bash
pi --export /sessions/weather/subagents/child.jsonl conversation.html
```

The `owner` must not edit product files while the workflow runs. `Maestro` can perform temporary experiments with `owner` agreement during `spec` preparation and
permitted revisions. See [Workflow](docs/workflow.md#spec-approval).

An `escalation` asks the `owner` to decide an implementation question, and a `finding` records a technical issue reported by the `verifier`. The `owner` discusses both
with `Maestro`, never directly with the `builder` or `verifier`. `Maestro` records all current `escalation` answers or `finding` decisions in the active `handoff` before
changing phase.

If any decision requires a `spec` change, the workflow returns to `drafting-spec` before the `owner` and `Maestro` revise the same `spec`. The `owner` reviews the revised
`spec` and replies `GREEN FLAG` again. `Maestro` records renewed approval separately before another `builder` `run`.

When enabled, `Maestro` starts the `simplifier` after successful verification, rejection of all `findings`, or `builder` completion with verification disabled. Only this
step requires Git. If Git readiness cannot be confirmed, `Maestro` warns and skips simplification. The `simplifier` selects all uncommitted code changes, including
pre-existing staged, unstaged, and untracked files.

The workflow ends at `candidate-ready`. Rejected `findings` retain their reasons and accepted failures can remain. Maestro's summary separates independent verification
from the later simplifier's report. After the final summary finishes successfully, `Maestro` automatically turns off. The `owner` controls later review, commits, pull
requests, and merging.

The same `/maestro` command disables `Maestro` and leaves project files unchanged. Disabling `Maestro`, restarting Pi, or using `/resume` clears live session state. Saved
files do not automatically restore or resume an incomplete workflow. The `owner` handles it manually.

## Configuration

When `.pi/maestro.json` is absent, `/maestro` starts a guided setup in Pi's interactive terminal. The `owner` chooses models and thinking levels for `builder`,
`verifier`, and `simplifier`. The selected agents are enabled, and the configuration is saved before `Maestro` activates. Selecting no agents enables `spec` preparation
only.

There are no default agent models. Existing configurations must supply models for enabled execution phases. The `owner` can edit the file before activation to change the
`spec` directory, models, thinking levels, or phase flags. Omitted `required` flags in existing files default to `true`. Keep configuration unchanged during the workflow.
With `builder.required: false`, approval finishes with only an approved `spec` for implementation elsewhere. Otherwise `verifier` and `simplifier` can be disabled
independently. Skipped work is identified in the final summary and is not claimed as completed. See [Configuration](docs/configuration.md#phase-selection).

## Documentation

The reading order is:

1. [Glossary](docs/glossary.md): terms and identifiers used in `specs`, reports, and `Maestro` messages. Read this before the first workflow.
2. [Workflow](docs/workflow.md): approvals, decisions, and how each `run` produces `artifacts`.
3. [Configuration](docs/configuration.md): project paths, models, and thinking levels.
4. [Subagent integration](docs/subagent-integration.md): agent context, execution, and activity tracking.

## Project constitution

1. [Mission](MISSION.md): purpose, scope, and `owner` responsibilities.
2. [Tech stack](TECH_STACK.md): runtime technologies and development tools.
3. [Roadmap](ROADMAP.md): completed outcomes and planned work maintained in the repository.
4. [Changelog](CHANGELOG.md): meaningful codebase changes and breaking changes.
5. [Architecture decision records](ADR.md): architectural choices, context, consequences, and evidence.
