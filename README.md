# pi-maestro

Pi extension to manage a spec driven multiagent development workflow.

![Maestro workflow](docs/maestro.png)

Maestro helps an owner define one change, send it to a builder, verify the result, and prepare the accepted work for final review.

## Prerequisites

- macOS
- Node.js 26 or later
- Git 2.40 or later
- Pi 0.85.1 or later
- `pi-subagents` 0.68.0 or later, installed and enabled in Pi
- Access to the configured builder and verifier models
- A trusted Git repository

## Installation

Install `pi-subagents` and Maestro:

```bash
pi install npm:pi-subagents@0.68.0
pi install npm:@emiliosp/pi-maestro
```

Pi packages run with full system access. Review package source code before installation.

## Activation

Start Pi from the Git repository:

```bash
cd /path/to/project
pi
```

Activate Maestro:

```text
/maestro
```

The same command disables Maestro. Disabling Maestro keeps the current workflow, branches, worktrees, and artifacts.

During activation, Maestro checks the repository, configuration, models, agents, paths, and stored workflow state. A failed check leaves Maestro disabled and reports the problem.

## Basic use

1. Run `/maestro`.
2. Describe the change to Maestro.
3. Review the spec with Maestro.
4. Approve the spec when its goals, requirements, design, edge cases, and acceptance criteria are complete.
5. Commit the approved spec and workflow state on the base branch.
6. Ask Maestro to launch the builder.
7. Answer any builder escalation.
8. Review any verifier finding and choose an action for each one.
9. Ask Maestro to prepare the final review when the candidate is ready.
10. Review the staged changes and create the final commit.

Builder and verifier passes run in the foreground. Pi waits for each pass to finish before the owner can continue the conversation.

For failures, escalations, findings, and recovery, see [Workflow](docs/workflow.md) and [Recovery](docs/recovery.md).

## Configuration

Maestro works with default settings. Add `.pi/maestro.json` when the project needs different directories, models, thinking levels, or timeouts. JSON files use semantic schema version `1.0.0`.

See [Configuration](docs/configuration.md).

## Documentation

- [Workflow](docs/workflow.md)
- [Configuration](docs/configuration.md)
- [Recovery](docs/recovery.md)
