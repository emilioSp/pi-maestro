# Subagent integration

Maestro uses `pi-subagents` to run the builder and verifier as child sessions. A child session is a separate Pi session that receives one role and one task. An agent definition is a Markdown file that gives the child its role, tools, and system prompt. A system prompt is the instruction text that the child follows.

## Agent definitions

The package contains two agent definitions:

1. [`agents/builder.md`](../agents/builder.md) defines the builder role.
2. [`agents/verifier.md`](../agents/verifier.md) defines the verifier role.

Each file has YAML frontmatter at the top. Frontmatter is the YAML block between the two `---` lines. The text after the frontmatter is the system prompt.

The frontmatter defines the agent name, tools, context rules, and child-only extensions. The system prompt defines the role rules and the work procedure.

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

The `pi.subagents.agents` field tells `pi-subagents` to scan `./agents` for agent definitions. Pi scans nested directories as well.

The `package` and `name` fields in each file form the runtime name that delegation uses. The builder file has `package: maestro` and `name: builder`, so its runtime name is `maestro.builder`. The verifier runtime name is `maestro.verifier`.

## Launch flow

When the owner launches the builder, the integration follows these steps:

1. The owner calls `maestro_launch_builder`.
2. `src/tools/main/launch-builder.ts` prepares the workflow and emits a delegation request.
3. The request sets `agent: AGENTS.BUILDER`.
4. `AGENTS.BUILDER` has the value `maestro.builder` in `src/config/schema.ts`.
5. `pi-subagents` resolves `maestro.builder` to `agents/builder.md`.
6. The child receives the system prompt and the tools from that agent definition.

Maestro also passes the explicit spec ID, the current repository root, the configured model, the thinking level, the timeout, and a fresh context. The task text tells the builder to read the applicable `AGENTS.md` files.

The verifier uses the same name mapping with `AGENTS.VERIFIER` and `maestro.verifier`.

## Subagent extension

Both agent files set `subagentOnlyExtensions` to `../extensions/maestro-subagent.ts`. This field tells `pi-subagents` to load the extension only in the child session for that agent.