# Configuration

Maestro reads project configuration from:

```text
.pi/maestro.json
```

The file is optional. Maestro uses all default values when the file is absent.

## Default configuration

```json
{
  "version": "1.0.0",
  "specDirectory": ".specs",
  "builder": {
    "model": "openai-codex/gpt-6-luna",
    "thinking": "high",
    "timeoutMinutes": 60
  },
  "verifier": {
    "model": "openai-codex/gpt-6-sol",
    "thinking": "medium",
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
| `builder.model` | No | `openai-codex/gpt-6-luna` | Full `provider/model` identifier. |
| `builder.thinking` | No | `high` | One supported thinking level. |
| `builder.timeoutMinutes` | No | `60` | Integer from `1` to `1440`. Applies to each builder run. |
| `verifier` | No | Verifier defaults | May contain supported verifier overrides. |
| `verifier.model` | No | `openai-codex/gpt-6-sol` | Full `provider/model` identifier. |
| `verifier.thinking` | No | `medium` | One supported thinking level. |
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

Each object accepts only the documented fields. Unknown fields stop activation and produce an error.

When a run reaches its timeout, Maestro reports it and does not treat the run as complete.

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

`version` identifies the configuration schema. It is separate from the npm package version.

The current schema version is `1.0.0`. An unsupported major version stops Maestro activation. Minor and patch versions represent compatible schema changes supported by the installed Maestro release.

## Path rules

`specDirectory` must meet these rules:

- The path is relative to the Git repository root.
- The path points below the repository root.
- The resolved path stays inside the repository, including through symlinks.

An invalid path stops Maestro activation. Maestro validates the path while it loads configuration, but does not create the directory then. Workflow actions create a spec directory and its artifacts only when they need them.

## Model access

Maestro checks both configured models during activation. Each model must exist and have valid authentication.

A model error stops activation and identifies the affected model. Update the configuration or authenticate the provider, then run `/maestro` again.

## Fixed values

Agent names:

```text
maestro.builder
maestro.verifier
```

Maestro does not require a branch naming pattern. The owner selects the current branch before using the workflow.
