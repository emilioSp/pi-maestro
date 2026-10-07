# Subagent integration

Maestro uses `pi-subagents` to run the builder and verifier as child sessions. A child session is a separate Pi session for one role. The owner stays in the main Maestro conversation.

## Roles and context

The package supplies both roles and the tools that save their results:

| Role | Agent name | Definition |
|---|---|---|
| Builder | `maestro.builder` | [`agents/builder.md`](../agents/builder.md) |
| Verifier | `maestro.verifier` | [`agents/verifier.md`](../agents/verifier.md) |

Each run starts with a fresh conversation, not the main session's conversation history. Both agents inherit project instructions, the owner's global `AGENTS.md`, and available skills. The global file normally lives at `~/.pi/agent/AGENTS.md`.

Maestro supplies the spec ID, project directory, model, thinking level, and timeout. The agents read the approved spec and saved artifacts to understand the work. Earlier artifacts provide context, not proof.

The owner does not call builder or verifier tools directly. Maestro starts the builder after `GREEN FLAG` approval and the verifier after successful builder completion.

## Following a run

Runs stay in the foreground and occur one at a time. Pi waits for each run to finish before Maestro continues. Maestro does not run the builder and verifier in parallel or in the background.

Maestro's Pi status shows the workflow phase. `pi-subagents` FleetView shows agent activity, and `/subagents-fleet` opens its inspector for details and transcripts.

Each child saves its result through Maestro tools before returning.

If a run fails or returns without a valid saved result, Maestro reports the error and stops. Manual follow-up is described in [Failures and interruptions](workflow.md#failures-and-interruptions).

## External configuration

The `pi-subagents` extension must be installed and enabled in Pi. Builder and verifier model choices, thinking levels, and timeouts come from [Maestro configuration](configuration.md). Other `pi-subagents` configuration remains the owner's responsibility.

Maestro does not invoke Git to manage its workflow. `pi-subagents` can use Git internally.
