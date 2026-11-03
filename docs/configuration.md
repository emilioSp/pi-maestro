# Configuration

`Maestro` reads `.pi/maestro.json` from the project root. The file is optional. `Maestro` uses all default values when it is absent.

## Project root

The project root is the current Pi working directory. `Builder`, `verifier`, and `simplifier` `runs` use this same directory.

For example, if Pi starts in `/work/app/src`, `Maestro` reads `/work/app/src/.pi/maestro.json`. A configuration file in `/work/app/.pi/maestro.json` does not apply.

## Default configuration

```json
{
  "version": "1.0.0",
  "specDirectory": ".specs",
  "builder": {
    "required": true,
    "model": "openai-codex/gpt-5.6-luna",
    "thinking": "max"
  },
  "simplifier": {
    "required": true,
    "model": "openai-codex/gpt-6.1-sol",
    "thinking": "high"
  },
  "verifier": {
    "required": true,
    "model": "openai-codex/gpt-6.1-sol",
    "thinking": "high"
  }
}
```

## Fields

| Field                 |                  Required | Default                     | Rules                                                    |
| --------------------- | ------------------------: | --------------------------- | -------------------------------------------------------- |
| `version`             | Yes, when the file exists | `1.0.0`                     | Configuration format version. Only `1.0.0` is supported. |
| `specDirectory`       |                        No | `.specs`                    | Relative path below the project root.                    |
| `builder`             |                        No | `Builder` defaults          | Overrides supported `builder` fields.                    |
| `builder.required`    |                        No | `true`                      | Boolean selecting the `builder` phase.                   |
| `builder.model`       |                        No | `openai-codex/gpt-5.6-luna` | Model string passed unchanged to Pi.                     |
| `builder.thinking`    |                        No | `max`                       | One supported thinking level.                            |
| `verifier`            |                        No | `Verifier` defaults         | Overrides supported `verifier` fields.                   |
| `verifier.required`   |                        No | `true`                      | Boolean selecting the `verifier` phase.                  |
| `verifier.model`      |                        No | `openai-codex/gpt-6.1-sol`  | Model string passed unchanged to Pi.                     |
| `verifier.thinking`   |                        No | `high`                      | One supported thinking level.                            |
| `simplifier`          |                        No | `Simplifier` defaults       | Overrides supported `simplifier` fields.                 |
| `simplifier.required` |                        No | `true`                      | Boolean selecting the `simplifier` phase.                |
| `simplifier.model`    |                        No | `openai-codex/gpt-6.1-sol`  | Model string passed unchanged to Pi.                     |
| `simplifier.thinking` |                        No | `high`                      | One supported thinking level.                            |

Model values use the full `provider/model` identifier supplied by Pi's model registry, such as `openrouter/~openai/gpt-mini-latest`. Model IDs may contain additional
slashes. `Maestro` does not apply a separate format rule; it matches the complete identifier against Pi's available models and passes it unchanged through `pi-subagents`.

`Maestro` accepts these thinking levels:

```text
off
minimal
low
medium
high
xhigh
max
```

## Partial configuration

Only `version` is required when the file exists. Each other field overrides its matching default.

```json
{
  "version": "1.0.0",
  "builder": {
    "thinking": "high"
  }
}
```

This example keeps every default except the `builder` thinking level.

## Phase selection

Set each agent's `required` boolean before activation and leave configuration unchanged until the workflow completes. Omitted flags default to `true`, even when an agent
section or the entire file is absent. Strings, numbers, and `null` are invalid.

With `builder.required: false`, approval completes the workflow with an approved `spec` and no agent execution, regardless of the other flags. The approved `spec` can be
used for implementation in another workflow. With `builder` enabled, `verifier` and `simplifier` can each be disabled independently. Neither runs without `builder`.

| `builder.required` | `verifier.required` | `simplifier.required` | Selected phases after approval |
| ------------------ | ------------------- | --------------------- | ------------------------------ |
| `false`            | Any                 | Any                   | None; approved `spec` only     |
| `true`             | `false`             | `false`               | `Builder` only                 |
| `true`             | `true`              | `false`               | `Builder`, then `verifier`     |
| `true`             | `false`             | `true`                | `Builder`, then `simplifier`   |
| `true`             | `true`              | `true`                | All three, in order            |

Disabled phases do not require agent or model availability and produce no `handoff`. The final summary identifies skipped work rather than claiming it was performed.
Enabled simplification can still be skipped if Git is unavailable.

## Schema version

`version` identifies the configuration format, not the npm package version. The supported value is `1.0.0`. Other values stop activation.

## Path rules

`specDirectory` must meet these rules:

1. The path is non-empty and relative to the project root.
2. The path stays below that root after `.` and `..` are resolved.
3. The path is not the project root itself.

For example, `specDirectory: "planning/specs"` places `specs` in `<project-root>/planning/specs/`. Absolute paths and paths outside the project root are rejected. The
`owner` is responsible for directory permissions that allow `Maestro` to save `artifacts`.

## Model access

During activation, `Maestro` checks only enabled agents and their configured models against `context.modelRegistry.getAvailable()`. Pi's registry is the source of truth
for model availability; `Maestro` does not maintain a separate model list or authentication check. A missing enabled model stops activation and identifies the full
configured identifier.

With `builder` disabled, activation checks only project trust and configuration, with no agent checks, model lookup, or `pi-subagents` ping. With `builder` enabled, the
availability ping remains required.

The `owner` can correct the identifier or authenticate the provider in Pi, then retry `/maestro`. Authentication or provider errors during delegation still appear as
`run` failures. Agent names and context are described in [Subagent integration](subagent-integration.md#roles-and-context).
