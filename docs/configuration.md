# Configuration

Maestro reads project configuration from:

```text
.pi/maestro.json
```

The file is optional, and Maestro uses all default values when it is absent.

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

Maestro does not configure a branch, a target branch, or a worktree directory. It uses the current Git checkout and branch.

## Fields

| Field | Required | Default | Rules |
|---|---:|---|---|
| `version` | Yes, when the file exists | `1.0.0` | Semantic version of the configuration schema. Must be supported by the installed Maestro release. |
| `specDirectory` | No | `.specs` | Relative path inside the Git repository. |
| `builder` | No | Builder defaults | May contain supported builder overrides. |
| `builder.model` | No | `openai-codex/gpt-5.6-luna` | Full `provider/model` identifier. |
| `builder.thinking` | No | `max` | One supported thinking level. |
| `builder.timeoutMinutes` | No | `60` | Integer from `1` to `1440`. Applies to each builder run. |
| `verifier` | No | Verifier defaults | May contain supported verifier overrides. |
| `verifier.model` | No | `openai-codex/gpt-6.1-sol` | Full `provider/model` identifier. |
| `verifier.thinking` | No | `high` | One supported thinking level. |
| `verifier.timeoutMinutes` | No | `60` | Integer from `1` to `1440`. Applies to each verifier run. |

Supported thinking levels:

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

This example keeps every default except the builder timeout.

## Schema version

`version` identifies the configuration schema. It is separate from the npm package version, and it's a mechanism for future-proof additions.

## Path rules

`specDirectory` must meet these rules:

1. The path is relative to the Git repository root.
2. The path points below the repository root after `.` and `..` are resolved.

It's owner responsibility to arrange the filesystem in order to support artifact writes and Git checkpoints.

## Model access

Maestro checks both configured models during activation. Each model must exist and have valid authentication.

A model error stops activation and identifies the affected model. Update the configuration or authenticate the provider, then run `/maestro` again.

Agent names have fixed value:

```text
maestro.builder
maestro.verifier
```