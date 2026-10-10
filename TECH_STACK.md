# Tech stack

`Maestro` is a source-only TypeScript package that uses ECMAScript modules (ESM). Pi loads the TypeScript source directly. The package has no build step or compiled `dist/` directory.

| Technology | Use |
|---|---|
| TypeScript | Application code and static type checks with `tsc --noEmit`. |
| Node.js | Runtime. |
| Pi | Extension host, agent APIs, and terminal interface. |
| `pi-subagents` | `Builder` and `verifier` execution and activity tracking. |
| TypeBox | Schemas and runtime validation for configuration, workflow state, tool inputs, and agent reports. |
| Vitest with coverage | Unit tests, integration tests, and code coverage. |
| Biome | Formatting and lint checks. |
| Oxlint with `oxlint-anti-slop` | Additional lint and anti-slop checks. |
