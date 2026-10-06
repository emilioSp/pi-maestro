# Subagent integration

Maestro uses `pi-subagents` to run the builder and verifier as child sessions. 

A child session is a separate Pi session that receives one role and one task.

## Agent definitions

The package contains two agent definitions:

1. [`agents/builder.md`](../agents/builder.md) defines the builder role.
2. [`agents/verifier.md`](../agents/verifier.md) defines the verifier role.

## Package registration

`package.json` registers the agent directory with Pi:

```json
{
  "pi": {
    "subagents": {
      "agents": [
        "./agents"
      ]
    }
  }
}
```

The `pi.subagents.agents` field tells `pi-subagents` to scan `./agents` for agent definitions. 

The `package` and `name` fields in each file form the runtime name that delegation uses.

## Run flow

When the owner runs the builder, the integration follows these steps:

1. The owner calls `maestro_run_builder`.
2. `src/tools/main/run-builder.ts` prepares the workflow and emits a delegation request.
3. The request sets `agent: AGENTS.BUILDER`.
4. `AGENTS.BUILDER` has the value `maestro.builder` in `src/config/schema.ts`.
5. `pi-subagents` resolves `maestro.builder` to `agents/builder.md`.
6. The child receives the system prompt and the tools from that agent definition.
7. Maestro waits for the child to finish, checks its result, and returns it to the owner.

Maestro also passes the explicit spec ID, the current repository root, the configured model, the thinking level, the timeout, and a fresh context.

`maestro_run_verifier` in `src/tools/main/run-verifier.ts` uses the same flow with `AGENTS.VERIFIER` and `maestro.verifier`. Both tools run in the foreground and wait for a result.

## Subagent extension

Both agent files set `subagentOnlyExtensions` to `../extensions/maestro-subagent.ts`. 

This field tells `pi-subagents` to load the extension only in the child session for that agent.