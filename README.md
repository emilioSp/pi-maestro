# pi-maestro

Pi extension for a spec-driven multiagent development workflow.

![Maestro workflow](docs/maestro.png)

## The idea

One spec describes one small reversible change. An agent builds it. A second, independent agent regenerates each acceptance criterion from scratch. The owner performs the final review. 

Four principles hold the workflow together:

- The approved spec is the contract for the builder and verifier.
- No agent approves its own work.
- A check that passes must be able to fail. Each acceptance criterion states the breakage that must break it.
- An agent never decides for the owner, and never guesses.

## The roles

- **Owner** — You. You bring the problem, decide every escalation and every finding, review the final code, and control the Git flow after the candidate is ready. You never talk to a builder or a verifier.
- **Maestro** — The agent you talk to. It writes the spec with you, spawns and supervises the other agents, records your decisions, and summarizes the results.
- **Builder** — The agent that implements one spec. It never verifies its own work.
- **Verifier** — The agent that verifies if the builder implementation is technically compliant to the spec.

## Prerequisites

- macOS
- Node.js 26 or later
- Git
- Pi 1.0.0 or later
- `pi-subagents` 0.68.0 or later, installed and enabled in Pi
- Access to the configured builder and verifier models
- A trusted Git repository

## Installation

Install `pi-subagents` and Maestro:

```bash
pi install npm:pi-subagents
pi install npm:@emiliosp/pi-maestro
```

## Usage

Maestro uses the current Git checkout and branch. It does not create, switch, name, or validate branches. It does not create worktrees. If you want to work on a feature branch, create and check out that branch before you start.

Start Pi from the repository:

```bash
cd /path/to/project
pi
```

Activate Maestro:

```text
/maestro
```

The same command disables Maestro. Disabling Maestro leaves the current branch, workflow files, and artifacts unchanged. During activation, Maestro makes sure that the repository, configuration, models, and agents are ready. If an item fails, Maestro stays disabled and reports the problem.

Follow this workflow:

1. Activate Maestro with `/maestro`.
2. Describe the change.
3. Review the spec with Maestro.
4. Approve the spec.
5. Commit the approved `spec.md` and `workflow.json` on the current branch.
6. Ask Maestro to launch the builder.
7. Review builder escalations and answer them.
8. Review verifier findings and choose an action for each finding.
9. When the workflow reaches `candidate-ready`, read Maestro's summary of the results and Pull Request facts.
10. Review or change the candidate as needed. 

Do not change product code while the workflow runs. The workflow is complete when it reaches `candidate-ready`. No final tool call is needed. Changes after completion are outside the Maestro review.

If an escalation or finding requires a contract change, edit and approve `spec.md`, then call `maestro_mark_spec_ready`. The workflow returns to `ready-for-builder` on the same branch. A technical builder failure stops the workflow and requires owner follow-up.

Builder and verifier runs stay in the foreground. Pi waits for each run before you continue the conversation. Maestro shows the current phase in Pi's status. Use pi-subagents FleetView or `/subagents-fleet` to inspect live activity and the transcript.

Restarting Pi, disabling Maestro, or using `/resume` clears live session state. Maestro does not recover an incomplete workflow. 

## Configuration

Maestro uses default values when `.pi/maestro.json` is absent. Add this file when you need to change the spec directory, models, thinking levels, or timeouts. See [Configuration](docs/configuration.md).

## Documentation

- [Workflow](docs/workflow.md)
- [Configuration](docs/configuration.md)
- [Subagent integration](docs/subagent-integration.md)
