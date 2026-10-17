# Subagent integration

`Maestro` uses `pi-subagents` to run the `builder`, `verifier`, and `simplifier` as child sessions. A child session is a separate Pi session for one role. The `owner`
stays in the main `Maestro` conversation.

## Roles and context

The package supplies all three roles and the tools that save their results:

| Role         | Agent name           | Definition                                        |
| ------------ | -------------------- | ------------------------------------------------- |
| `Builder`    | `maestro.builder`    | [`agents/builder.md`](../agents/builder.md)       |
| `Verifier`   | `maestro.verifier`   | [`agents/verifier.md`](../agents/verifier.md)     |
| `Simplifier` | `maestro.simplifier` | [`agents/simplifier.md`](../agents/simplifier.md) |

Each `run` starts with a fresh conversation, not the main session's conversation history. All three agents inherit project instructions, the owner's global `AGENTS.md`,
and available skills. The global file normally lives at `~/.pi/agent/AGENTS.md`.

`Maestro` supplies the `spec` ID, project directory, model, thinking level, and timeout. The agents read the approved `spec` and saved `artifacts` to understand the work.
Earlier `artifacts` provide context, not proof.

The `owner` does not call agent tools directly. `Maestro` starts the `builder` after `GREEN FLAG` approval. The `verifier` starts after successful `builder` completion,
and the `simplifier` follows successful `verifier` completion.

## Following a run

`Runs` stay in the foreground and occur one at a time. Pi waits for each `run` to finish before `Maestro` continues. `Maestro` does not run agents in parallel or in the
background.

Maestro's Pi status shows the workflow phase. `pi-subagents` FleetView shows agent activity, and `/subagents-fleet` opens its inspector for details and transcripts.

Each child saves its result through `Maestro` tools before returning. `Builder` results produce `B1.json`, `B2.json`, and so on. `Verifier` results produce `V1.json`,
`V2.json`, and so on. The `simplifier` saves the unnumbered `handoffs/simplifier/S.json`. See [Stored artifacts](workflow.md#stored-artifacts) for the creation sequence.

If a `run` fails or returns without a valid saved result, `Maestro` reports the error and stops. Manual follow-up is described in [Limitations](workflow.md#limitations).

## External configuration

The `pi-subagents` extension must be installed and enabled in Pi. `Builder`, `verifier`, and `simplifier` model choices, thinking levels, and timeouts come from
[Maestro configuration](configuration.md). Other `pi-subagents` configuration remains the owner's responsibility.

Only `maestro_run_simplifier` checks Git readiness, with `git rev-parse --is-inside-work-tree`. If readiness cannot be confirmed, it warns and completes without
delegation. The `simplifier` uses Git to select all uncommitted code changes. `Maestro` does not change the Git index or create commits or checkpoints.
