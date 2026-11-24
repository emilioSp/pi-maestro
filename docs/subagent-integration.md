# Subagents integration

The `owner` stays in the main `Maestro` conversation while the `builder`, `verifier`, and `simplifier` each work in a separate Pi session. The optional `scorer` uses a Pi
classifier instead of a separate agent session. See [Workflow evaluation](workflow.md#workflow-evaluation).

## Roles and context

Each agent `run` starts a fresh conversation. Agents use the `spec`, relevant saved `artifacts`, and Pi's global and project instructions, including `AGENTS.md`. They do
not see the main conversation or earlier agent conversations. Requirements discussed in chat should be captured in the `spec`.

Agents can use Pi's enabled extensions and skills, including configured MCP, codemode, and tool search support.

## Cancellation and errors

Press `Escape` (Pi's default cancel key) to stop a running agent. Cancellation does not undo file changes. After an interruption or error the spec can be restarted, see
[Restart an existing spec](workflow.md#restart-an-existing-spec).

## Inspecting saved sessions

If `Maestro` displays a saved session path, open the JSONL file or export it to HTML to inspect the agent's messages and tool calls:

```bash
pi --export /sessions/weather/subagents/child.jsonl conversation.html
```
