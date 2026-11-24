# Configuration

`Maestro` reads `.pi/maestro.json` from the project root. When it is absent, `/maestro` opens initial setup in Pi's interactive terminal and creates the file.

## Project root

The project root is the current Pi working directory. `Builder`, `verifier`, and `simplifier` `runs` use this same directory.

For example, if Pi starts in `/work/app/src`, `Maestro` reads `/work/app/src/.pi/maestro.json`. A configuration file in `/work/app/.pi/maestro.json` does not apply.

## Initial setup

The `owner` runs `/maestro` in Pi's interactive terminal and follows the guided setup to select models and thinking levels for `builder`, `verifier`, and `simplifier`.
The `scorer` appears in the same menu and offers available Pi classifiers only. Selecting a classifier enables scoring; leaving it unselected keeps scoring disabled.
Confirmation saves the choices in `.pi/maestro.json`.

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
  },
  "scorer": {
    "required": true,
    "model": "openrouter/typesafe/jev-1.14"
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
| `simplifier.required` |                        No | `false`               | Boolean selecting the `simplifier` phase.                |
| `simplifier.model`    |     For enabled execution | None                  | Model string passed unchanged to Pi.                     |
| `simplifier.thinking` |                        No | `high`                | One supported thinking level.                            |
| `scorer`              |                        No | Disabled              | Overrides supported `scorer` fields.                     |
| `scorer.required`     |                        No | `false`               | Boolean selecting workflow scoring.                      |
| `scorer.model`        |   When scoring is enabled | None                  | Full Pi classifier identifier; no default or fallback.   |

Model values use the full `provider/model` identifier supplied by Pi's model registry, such as `openrouter/~openai/gpt-mini-latest`.

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

- `version` is always required and must be `1.0.0`.
- Each agent that will execute needs an explicit `model`. If its model is missing, `Maestro` reports an error and does not activate.
- An agent disabled with `required: false` needs no model. With `builder.required: false`, no agents execute, so no models are required.
- Other omitted fields use the defaults in the table. For example, omitting `specDirectory` uses `.specs`.

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

The `required` flags determine which phases run after the `owner` approves the `spec`.

| `builder.required` | `verifier.required` | `simplifier.required` | `scorer.required` | What runs after spec approval                    |
| ------------------ | ------------------- | --------------------- | ----------------- | ------------------------------------------------ |
| `false`            | Any                 | Any                   | Any               | None; approved `spec` only                       |
| `true`             | `false`             | `false`               | `false`           | `Builder` only                                   |
| `true`             | `false`             | `false`               | `true`            | `Builder` → `scorer`                             |
| `true`             | `false`             | `true`                | `false`           | `Builder` → `simplifier`                         |
| `true`             | `false`             | `true`                | `true`            | `Builder` → `simplifier` → `scorer`              |
| `true`             | `true`              | `false`               | `false`           | `Builder` → `verifier`                           |
| `true`             | `true`              | `false`               | `true`            | `Builder` → `verifier` → `scorer`                |
| `true`             | `true`              | `true`                | `false`           | `Builder` → `verifier` → `simplifier`            |
| `true`             | `true`              | `true`                | `true`            | `Builder` → `verifier` → `simplifier` → `scorer` |

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

Each enabled phase needs a model when the `builder` is enabled. The `owner` can change models under "Agent models" in `/maestro`.

- `Builder`, `verifier`, and `simplifier`: If an enabled model is unavailable, `Maestro` won’t start.
- `Scorer`: `Maestro` checks the Pi classifier when scoring runs. If it’s unavailable, `Maestro` records the failure and finishes without scores.

See [Subagent integration](subagent-integration.md#roles-and-context) for agent context.
