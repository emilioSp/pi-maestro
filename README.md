# pi-maestro

Pi extension for a spec-driven multiagent development workflow.

![Maestro workflow](docs/maestro.png)

## The idea

One spec describes one small reversible change. An agent builds it. A second, independent agent regenerates each acceptance criteria from scratch. The owner makes the final review alongside the commit on the base branch.

Three principles hold the workflow together:

- No agent approves its own work.
- A check that passes must be able to fail. Each acceptance criterion states the breakage that must break it.
- An agent never decides for the owner, and never guesses.

## The roles

- **Owner** — You. You bring the problem, decide every escalation and every finding, review the final code, and make every commit on the base branch. You never talk to a builder or a verifier.
- **Maestro** — The agent you talk to. It writes the spec with you, spawns and supervises the other agents, records your decisions.
- **Builder** — The agent that implements one spec. It never verifies its own work.
- **Verifier** — The agent that verifies if the spec is technically compliant to the spec.

The owner talks to the maestro. The maestro talks to the builders and the verifiers.

## Prerequisites

- macOS
- Node.js 26 or later
- Git
- Pi 0.85.1 or later
- `pi-subagents` 0.68.0 or later, installed and enabled in Pi
- Access to the configured builder and verifier models
- A trusted Git repository

## Installation

Install `pi-subagents` and Maestro:

```bash
pi install npm:pi-subagents@0.71.0
pi install npm:@emiliosp/pi-maestro
```

Pi packages run with full system access. Review package source code before installation.

## Basic use

Maestro uses the branch that is current when you work with it. It does not create or switch branches, and it does not create worktrees. Create and check out a feature branch before starting if you do not want to work on the current branch.

Start Pi from the repository:

```bash
cd /path/to/project
pi
```

Activate Maestro:

```text
/maestro
```

The same command disables Maestro. Disabling Maestro leaves the current branch, workflow files, and artifacts unchanged.

During activation, Maestro checks the repository, configuration, models, and agents. A failed check leaves Maestro disabled and reports the problem.

Typical workflow:

1. Activate Maestro with `/maestro`.
2. Describe the change.
3. Review the spec with Maestro.
4. Approve the spec.
5. Commit the approved `spec.md` and `workflow.json` on the current branch.
6. Ask Maestro to launch the builder.
7. Answer builder escalations.
8. Review verifier findings and choose an action for each one.
9. Ask Maestro to prepare the final review when the candidate is ready.
10. Open a Pull Request from the current branch and choose the merge method, including squash merge.

Builder and verifier runs are foreground operations. Pi waits for each run before the owner continues the conversation. Maestro shows the current phase in Pi's status. Use pi-subagents FleetView or `/subagents-fleet` to inspect live activity and the transcript.

The owner must not change product code while the workflow is running. A spec can be revised on the same branch from `escalation-decision` or `findings-decision`. Edit and approve `spec.md`, then call `maestro_mark_spec_ready`; the workflow returns to `ready-for-builder`. A technical builder failure stops the workflow and requires owner follow-up.

Restarting Pi, disabling Maestro, or using `/resume` clears live session state. Maestro does not recover an incomplete workflow from `workflow.json`.

## Configuration

Maestro works with default settings. Add `.pi/maestro.json` when the project needs different spec paths, models, thinking levels, or timeouts.

See [Configuration](docs/configuration.md).

## Documentation

- [Workflow](docs/workflow.md)
- [Configuration](docs/configuration.md)
