# pi-maestro

Pi extension for a spec-driven multiagent development workflow.

![Maestro workflow](docs/maestro.png)

## The idea

A specification (spec) describes one reversible change. The builder implements it. An independent verifier checks every acceptance criterion. The owner performs the final review.

Four principles hold the workflow together:

1. The approved spec is the contract for the builder and verifier.
2. No agent approves its own work.
3. Every acceptance criterion is checked independently.
4. The owner decides requirements, scope, and unresolved questions.

## The roles

| Role | Responsibility |
|---|---|
| Owner | Brings the problem, approves the spec, decides questions and findings, and reviews the final code. |
| Maestro | Works directly with the owner, prepares the spec, runs the other agents, records decisions, and summarizes results. |
| Builder | Implements the approved spec and checks each acceptance criterion. |
| Verifier | Independently checks the project files against the spec and reports technical issues. |

An escalation asks the owner to decide an implementation question. A finding records a technical issue reported by the verifier. The owner discusses both with Maestro, not directly with the builder or verifier.

## Prerequisites

1. macOS.
2. Node.js 26 or later.
3. Pi 1.0.0 or later.
4. `pi-subagents` installed and enabled in Pi.
5. Access to the configured builder and verifier models.
6. A project directory that Pi trusts.

## Installation

The owner installs `pi-subagents` and Maestro with these commands:

```bash
pi install npm:pi-subagents
pi install npm:@emiliosp/pi-maestro
```

## Usage

The owner starts Pi from the project directory:

```bash
cd /path/to/project
pi
```

Activate Maestro:

```text
/maestro
```

During activation, Maestro checks project trust, configuration, models, and agent availability. If a check fails, Maestro stays disabled and reports the problem.

The owner follows this workflow:

1. Describes one change to Maestro.
2. Reviews the spec, including its acceptance criteria and concrete examples.
3. Replies `GREEN FLAG` when Maestro asks for approval. Maestro records the approval and starts the builder.
4. Reviews builder escalations and decides how to proceed.
5. Reviews verifier findings and chooses an action for every finding.
6. Reads Maestro's summary at `candidate-ready` and performs the final review.

Maestro starts the verifier after a successful builder run. Both agents run in the foreground: Pi waits for each run to finish. Maestro shows the current phase in Pi's status. `pi-subagents` FleetView and `/subagents-fleet` show agent activity and transcripts.

The owner must not edit product files while the workflow runs. Maestro can perform temporary experiments with owner agreement during spec preparation and permitted revisions. See [Workflow](docs/workflow.md#spec-approval).

If a contract change is needed during an escalation or finding decision, the owner reviews the revised spec and replies `GREEN FLAG` again. Maestro then starts another builder run. A recorded builder failure stops the workflow and requires manual owner follow-up.

The workflow ends at `candidate-ready`. Rejected findings retain their reasons. Later changes are outside the completed verification. The owner controls any later Git use, pull request, and merge.

The same `/maestro` command disables Maestro and leaves project files unchanged. Disabling Maestro, restarting Pi, or using `/resume` clears live session state. Saved files do not automatically restore or resume an incomplete workflow. The owner handles it manually.

## Configuration

Maestro uses default values when `.pi/maestro.json` is absent from the project root. The owner can add this file to change the spec directory, models, thinking levels, or timeouts. See [Configuration](docs/configuration.md).

## Documentation

1. [Workflow](docs/workflow.md).
2. [Configuration](docs/configuration.md).
3. [Subagent integration](docs/subagent-integration.md).
