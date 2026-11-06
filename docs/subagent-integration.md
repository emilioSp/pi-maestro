# Subagent integration

`Maestro` runs the `builder`, `verifier`, and `simplifier` through Pi's SDK. Each child session handles one role while the `owner` stays in the main `Maestro`
conversation.

## Roles and context

The package supplies the three roles:

| Role         | Instructions                                      |
| ------------ | ------------------------------------------------- |
| `Builder`    | [`agents/builder.md`](../agents/builder.md)       |
| `Verifier`   | [`agents/verifier.md`](../agents/verifier.md)     |
| `Simplifier` | [`agents/simplifier.md`](../agents/simplifier.md) |

Each `run` starts a fresh conversation, without the main session's history or automatic resumption of earlier child sessions. The bundled role instructions supplement
Pi's normal instructions. Global and project instructions, including `AGENTS.md`, and available skills are discovered through Pi. Models and thinking levels come from
[Maestro configuration](configuration.md).

Enabled global and project extensions load in child sessions. Native Pi tools and configured MCP, codemode, and tool search support
are available.

The `owner` approves the `spec` and selected phases through the main conversation. See [Phase selection](configuration.md#phase-selection).

## Following a run

`Runs` stay in the foreground and occur one at a time. Pi waits for each `run` to finish before `Maestro` continues. Maestro's Pi status shows the workflow phase.

Saved `handoffs` contain the structured results. See [Stored artifacts](workflow.md#stored-artifacts) for further details.

## Cancellation and errors

The `owner` can interrupt a running agent with Pi's cancel action (`Escape` by default). `Maestro` forwards cancellation to the child and waits for cleanup.

Execution errors, interruptions, and missing or invalid `handoffs` stop the workflow. Completed file changes remain.

## Inspecting saved sessions

When a native child session file exists, `Maestro` displays its exact path on completion or failure, including interruptions and invalid `handoffs`. No path is displayed
when execution fails before a session file is saved.

Child session files live under `subagents/` in Pi's project session directory, outside the project repository. The `owner` can read the displayed JSONL file directly or
export it with Pi:

```bash
pi --export /sessions/weather/subagents/child.jsonl conversation.html
```
