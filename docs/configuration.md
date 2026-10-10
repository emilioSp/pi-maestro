# Configuration

`Maestro` reads `.pi/maestro.json` from the project root. The file is optional. `Maestro` uses all default values when it is absent.

## Project root

The project root is the current Pi working directory. `Builder` and `verifier` `runs` use this same directory.

For example, if Pi starts in `/work/app/src`, `Maestro` reads `/work/app/src/.pi/maestro.json`. A configuration file in `/work/app/.pi/maestro.json` does not apply.

## Default configuration

```json
{
  "version": "1.0.0",
  "specDirectory": ".specs",
  "builder": {
    "model": "openai-codex/gpt-5.6-luna",
    "thinking": "max",
    "timeoutMinutes": 60
  },
  "verifier": {
    "model": "openai-codex/gpt-6.1-sol",
    "thinking": "high",
    "timeoutMinutes": 60
  }
}
```

## Fields

| Field | Required | Default | Rules |
|---|---:|---|---|
| `version` | Yes, when the file exists | `1.0.0` | Configuration format version. Only `1.0.0` is supported. |
| `specDirectory` | No | `.specs` | Relative path below the project root. |
| `builder` | No | `Builder` defaults | Overrides supported `builder` fields. |
| `builder.model` | No | `openai-codex/gpt-5.6-luna` | Full `provider/model` identifier. |
| `builder.thinking` | No | `max` | One supported thinking level. |
| `builder.timeoutMinutes` | No | `60` | Integer from `1` to `1440`. Applies to each `builder` `run`. |
| `verifier` | No | `Verifier` defaults | Overrides supported `verifier` fields. |
| `verifier.model` | No | `openai-codex/gpt-6.1-sol` | Full `provider/model` identifier. |
| `verifier.thinking` | No | `high` | One supported thinking level. |
| `verifier.timeoutMinutes` | No | `60` | Integer from `1` to `1440`. Applies to each `verifier` `run`. |

Model identifiers use the full `provider/model` form shown in the defaults. `Maestro` accepts these thinking levels:

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
    "timeoutMinutes": 90
  }
}
```

This example keeps every default except the `builder` timeout.

## Schema version

`version` identifies the configuration format, not the npm package version. The supported value is `1.0.0`. Other values stop activation.

## Path rules

`specDirectory` must meet these rules:

1. The path is non-empty and relative to the project root.
2. The path stays below that root after `.` and `..` are resolved.
3. The path is not the project root itself.

For example, `specDirectory: "planning/specs"` places `specs` in `<project-root>/planning/specs/`. Absolute paths and paths outside the project root are rejected. The `owner` is responsible for directory permissions that allow `Maestro` to save `artifacts`.

## Model access

`Maestro` checks both configured models during activation. Each model must exist and have valid authentication.

A model error stops activation and identifies the affected model. The `owner` can correct the model identifier or authenticate the provider, then run `/maestro` again. Agent names and context are described in [Subagent integration](subagent-integration.md#roles-and-context).
