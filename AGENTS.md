# AGENTS.md

## Project overview

Pi extension that implements a multiagent spec driven development workflow.

## Project structure and component scope

The MVP package structure is frozen. Add a new structural file or directory only after an explicit design decision.

### Package entry points and assets

| Path | Scope                                                                                                                                                        |
|---|--------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `extensions/maestro.ts` | Main-session composition root. Registers `/maestro`, session events, status, instructions, and main tools. Contains Pi wiring only, not workflow logic.      |
| `extensions/maestro-child.ts` | Child-session composition root. Registers child-only tools. It does not register orchestration commands, events, or status.                                  |
| `agents/builder.md` | Builder role and operating contract distributed with the package.                                                                                            |
| `agents/verifier.md` | Verifier role and operating contract distributed with the package.                                                                                           |
| `templates/spec.md` | The spec template.                                                                                                                                           |
| `docs/` | Stable user and operator documentation. `workflow.md` explains the workflow, `configuration.md` explains configuration, and `recovery.md` explains recovery. |
| `.github/workflows/ci.yml` | macOS and Node.js 26 CI for install, typecheck, tests, and package dry run. It does not publish.                                                             |

### Source components

| Path | Scope |
|---|---|
| `src/config/` | Defaults, TypeBox schema, and loading for `.pi/maestro.json`. It does not handle path security, model availability, or Pi UI concerns. |
| `src/paths.ts` | Maestro path construction and path-safety validation. |
| `src/ids.ts` | UTC timestamps, slug normalization, spec ID composition, and ID format validation. |
| `src/git/` | Pi-independent Git operations. `command.ts` runs Git with argv, cwd, and timeout without a shell. The other modules own repository discovery, branches, worktrees, commits, ancestry, and final-review Git operations. |
| `src/atomic-write.ts` | Shared atomic file writing for state and artifacts. |
| `src/state/` | Schema, persistence, discovery, and reconciliation for `workflow.json`. It selects the highest revision, detects conflicts, and compares declared state with Git, worktrees, and handoffs. |
| `src/specs/` | Spec template loading, creation, parsing, and deterministic validation. IDs, paths, and workflow state remain in their own modules. |
| `src/artifacts/` | Pi-independent schemas, reading, validation, and writing for builder handoffs, verifier handoffs, escalations, and observations. |
| `src/workflow/` | Pi-independent domain coordination. Separate modules own transitions, spec flow, builder flow, verifier flow, escalations, findings, final review, and recovery. |
| `src/subagents/` | Integration with the public `pi-subagents/delegation` and `pi-subagents/preflight` APIs. Owns foreground launch contracts, request correlation, cancellation, and listener cleanup. It must not import internal `pi-subagents` modules. |
| `src/maestro/` | Main mode behavior: activation, environment checks, Pi session persistence, instructions, and status. Its `index.ts` is only an export barrel. Pi registration stays in `extensions/maestro.ts`. |
| `src/tools/main/` | One Pi adapter per owner-facing tool: create and ready a spec, inspect state, launch builder or verifier, resolve escalations or findings, and prepare final review. |
| `src/tools/child/` | One Pi adapter per child-only tool: record builder observations or handoff, open an escalation, and record a verifier handoff. |

Every `src/**/index.ts` is an export barrel. Keep schemas next to their domain. Do not add a global `src/schemas/` directory. Tool files define the input schema, register the Pi tool, call domain code, and convert the result to Pi format. They do not duplicate Git, state, artifact, or workflow logic.

### Tests

| Path | Scope |
|---|---|
| `test/unit/` | Unit tests for complex pure logic, arranged to mirror `src/`. |
| `test/integration/` | Feature and boundary tests, arranged to mirror `src/`. |
| `test/support/` | Explicit test infrastructure: temporary repositories, fake subagents, and test file helpers. |
| `test/fixtures/config/` | Configuration scenarios. |
| `test/fixtures/specs/` | Spec scenarios. |
| `test/fixtures/artifacts/` | Artifact scenarios. |

A test file identifies its main source file, for example `src/state/store.ts` maps to `test/integration/state/store.test.ts`. A module does not need both unit and integration coverage when one meaningful test level is sufficient. Do not create generic aggregate tests such as `state.test.ts`.

The package is source-only. Pi loads TypeScript directly, `src/` is published, and no `dist/` directory exists.

## General principles

- Keep code simple and readable.
- Solve only the current problem.
- Do not add future features, abstractions, or dependencies without a need.
- Avoid comments unless they add necessary clarity.
- Use descriptive names.
- Remove every temporary file you create.

## Communication

- Ask for confirmation on design decisions.
- Ask for clarification when requirements are unclear.
- Do not add or update dependencies without confirmation.

## Code conventions

- Use ESM only. Do not use CommonJS.
- Prefer `type` over `interface`.
- Prefer named exports. Use a default export only when a tool requires it or for a single application entrypoint or singleton.
- Prefer pure functions.
- Use early returns.
- Prefer arrow functions. Use classes only for strategies or objects with internal state.
- Keep functions small. Split a function when it becomes hard to read.
- Use `async` and `await`. Do not introduce callback APIs.
- Use named parameters for functions with multiple inputs. Define the input type close to the function.
- Use explicit methods. Do not use property accessors.
- Do not use `--experimental-strip-types`. We run on node version that support TypeScript stripping by default.
- Use named domain constants instead of repeated string literals.
- Use `imports` field. Do not use relative paths.
- Keep utility modules under a `utils` folder.

## Testing and checks

- Test complex pure logic with unit tests.
- Prefer integration tests for feature flows.
- Use one clear fixture for one scenario. Make the scenario clear from the file name.
- Do not write clever test helpers.
- Make test setup explicit. Load a fixture inside a test when possible. Do not hide default fixtures in `beforeEach`.
- Use test names that state the given condition and result.
- Keep each assertion meaningful. Remove redundant assertions, except explicit exclusion checks.
- Do not add tests without behavior value. Check coverage before removing tests and fixtures.

## Documentation

The root `README.md` must include at least

1. What the software does.
2. Prerequisites.
3. How to use it

Bear in mind: the root `README.md` is not a changelog. Document stable user and operator workflows, not every feature.
