# Configuration

`Maestro` reads `.pi/maestro.json` from the project root. When it is absent, `/maestro` opens initial setup in Pi's interactive terminal.

## Project root

The project root is the current Pi working directory. `Builder`, `verifier`, and `simplifier` `runs` use this same directory.

For example, if Pi starts in `/work/app/src`, `Maestro` reads `/work/app/src/.pi/maestro.json`. A configuration file in `/work/app/.pi/maestro.json` does not apply.

## Initial setup

The `owner` runs `/maestro` in Pi's interactive terminal and follows the guided setup to select models and thinking levels for `builder`, `verifier`, and `simplifier`,
then confirms to save the configuration and activate `Maestro`.

## Example configuration

This is an explicit all-agent configuration, not a set of model defaults. The `owner` supplies identifiers available in Pi:

```json
{
  "version": "1.0.0",
  "specDirectory": ".specs",
  "builder": {
    "required": true,
    "model": "openai-codex/gpt-6.1-sol",
    "thinking": "high"
  },
  "verifier": {
    "required": true,
    "model": "openai-codex/gpt-6-astra",
    "thinking": "medium"
  },
  "simplifier": {
    "required": true,
    "model": "openai-codex/gpt-6.1-sol",
    "thinking": "high"
  }
}
```

## Fields

| Field                 |                  Required | Default               | Rules                                                    |
| --------------------- | ------------------------: | --------------------- | -------------------------------------------------------- |
| `version`             | Yes, when the file exists | `1.0.0`               | Configuration format version. Only `1.0.0` is supported. |
| `specDirectory`       |                        No | `.specs`              | Relative path below the project root.                    |
| `builder`             |                        No | `Builder` defaults    | Overrides supported `builder` fields.                    |
| `builder.required`    |                        No | `true`                | Boolean selecting the `builder` phase.                   |
| `builder.model`       |     For enabled execution | None                  | Model string passed unchanged to Pi.                     |
| `builder.thinking`    |                        No | `high`                | One supported thinking level.                            |
| `verifier`            |                        No | `Verifier` defaults   | Overrides supported `verifier` fields.                   |
| `verifier.required`   |                        No | `true`                | Boolean selecting the `verifier` phase.                  |
| `verifier.model`      |     For enabled execution | None                  | Model string passed unchanged to Pi.                     |
| `verifier.thinking`   |                        No | `medium`              | One supported thinking level.                            |
| `simplifier`          |                        No | `Simplifier` defaults | Overrides supported `simplifier` fields.                 |
| `simplifier.required` |                        No | `true`                | Boolean selecting the `simplifier` phase.                |
| `simplifier.model`    |     For enabled execution | None                  | Model string passed unchanged to Pi.                     |
| `simplifier.thinking` |                        No | `high`                | One supported thinking level.                            |

Model values use the full `provider/model` identifier supplied by Pi's model registry, such as `openrouter/~openai/gpt-mini-latest`. Model IDs may contain additional
slashes. `Maestro` does not apply a separate format rule; it matches the complete identifier against Pi's available models and uses it unchanged for SDK execution.

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

The configuration file can omit fields that have a default in the table above:

1. `version` is always required and must be `1.0.0`.
2. Each agent that will execute needs an explicit `model`. If its model is missing, `Maestro` reports an error and does not activate.
3. An agent disabled with `required: false` needs no model. With `builder.required: false`, no agents execute, so no models are required.
4. Other omitted fields use the defaults in the table. For example, omitting `specDirectory` uses `.specs`.

There are no default models: `Maestro` does not automatically assign Pi's current model to an agent.

```json
{
  "version": "1.0.0",
  "builder": {
    "model": "provider-a/model-a",
    "thinking": "medium"
  },
  "verifier": { "required": false },
  "simplifier": { "required": false }
}
```

This example runs only `builder` with `provider-a/model-a` and `medium` thinking. `Verifier` and `simplifier` are disabled, so their models are omitted. The document
directory is `.specs` because `specDirectory` is omitted.

## Phase selection

Set each agent's `required` boolean before activation and leave configuration unchanged until the workflow completes. Omitted flags default to `true`, even when an agent
section is absent. Strings, numbers, and `null` are invalid.

With `builder.required: false`, approval completes the workflow with an approved `spec` and no agent execution, regardless of the other flags. The approved `spec` can be
used for implementation in another workflow. With `builder` enabled, `verifier` and `simplifier` can each be disabled independently. Neither runs without `builder`.

| `builder.required` | `verifier.required` | `simplifier.required` | Selected phases after approval |
| ------------------ | ------------------- | --------------------- | ------------------------------ |
| `false`            | Any                 | Any                   | None; approved `spec` only     |
| `true`             | `false`             | `false`               | `Builder` only                 |
| `true`             | `true`              | `false`               | `Builder`, then `verifier`     |
| `true`             | `false`             | `true`                | `Builder`, then `simplifier`   |
| `true`             | `true`              | `true`                | All three, in order            |

Disabled phases do not require model availability and produce no `handoff`. The final summary identifies skipped work rather than claiming it was performed. Enabled
simplification can still be skipped if Git is unavailable.

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

During activation, `Maestro` checks the configured models for enabled agents against Pi's available model registry. Pi's registry is the source of truth for model
availability; `Maestro` does not maintain a separate model list or authentication check. A missing enabled model stops activation and identifies the full configured
identifier.

With `builder` disabled, activation checks only configuration, without a model lookup.

The `owner` can correct the identifier or authenticate the provider in Pi, then retry `/maestro`. Authentication or provider errors during execution still appear as `run`
failures. Agent context are described in [Subagent integration](subagent-integration.md#roles-and-context).
