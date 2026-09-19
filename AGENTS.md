# AGENTS.md

## Project overview

Pi extension that implements a multiagent spec driven development workflow.

## Project structure and component scope

The MVP package structure is frozen. Add a new structural file or directory only after an explicit design decision.

### Root

| File | Responsibility |
|---|---|
| `.github/workflows/ci.yml` | Run CI checks on macOS. |
| `.gitignore` | Exclude local and generated files from Git. |
| `LICENSE` | Contain the MIT license. |
| `README.md` | Explain Maestro and how to use it. |
| `package.json` | Define package metadata, dependencies, scripts, and Pi integration. |
| `package-lock.json` | Lock dependency versions. |
| `tsconfig.json` | Configure TypeScript type checking. |

### Pi extensions

| File | Responsibility |
|---|---|
| `extensions/maestro.ts` | Connect Maestro to the main Pi session. |
| `extensions/maestro-child.ts` | Connect child-only tools for builders and verifiers. |

### Agents and template

| File | Responsibility |
|---|---|
| `agents/builder.md` | Define builder instructions. |
| `agents/verifier.md` | Define verifier instructions. |
| `templates/spec.md` | Provide the spec template. |

### Configuration, paths, and IDs

| File | Responsibility |
|---|---|
| `src/config/defaults.ts` | Define default configuration values. |
| `src/config/schema.ts` | Validate `.pi/maestro.json`. |
| `src/config/load.ts` | Load and validate configuration. |
| `src/config/index.ts` | Export configuration modules. |
| `src/paths.ts` | Build and validate Maestro paths. |
| `src/ids.ts` | Generate and validate spec IDs. |
| `src/atomic-write.ts` | Write files atomically and safely. |

### Git

| File | Responsibility |
|---|---|
| `src/git/command.ts` | Run Git commands without a shell. |
| `src/git/repository.ts` | Find and validate the Git repository. |
| `src/git/branches.ts` | Create and inspect workflow branches. |
| `src/git/worktrees.ts` | Create and remove worktrees. |
| `src/git/commits.ts` | Create and find checkpoint commits. |
| `src/git/verify-commit-history.ts` | Verify that commit history is valid. |
| `src/git/final-review.ts` | Prepare the squash merge for final review. |
| `src/git/index.ts` | Export Git modules. |

### Specs

| File | Responsibility |
|---|---|
| `src/specs/template.ts` | Load the spec template. |
| `src/specs/create.ts` | Create specs and initial artifacts. |
| `src/specs/parse.ts` | Parse spec sections. |
| `src/specs/validate.ts` | Validate the spec structure. |
| `src/specs/index.ts` | Export spec modules. |

### Artifacts

| File | Responsibility |
|---|---|
| `src/artifacts/builder-handoff.ts` | Handle builder handoff artifacts. |
| `src/artifacts/verifier-handoff.ts` | Handle verifier handoff artifacts. |
| `src/artifacts/escalation.ts` | Handle builder escalation artifacts. |
| `src/artifacts/observations.ts` | Handle the builder evidence history. |
| `src/artifacts/index.ts` | Export artifact modules. |

### Workflow state

| File | Responsibility |
|---|---|
| `src/workflow/state/schema.ts` | Define the `workflow.json` structure. |
| `src/workflow/state/store.ts` | Read and write `workflow.json`. |
| `src/workflow/state/discover.ts` | Find existing workflows in the repository. |
| `src/workflow/state/reconcile.ts` | Compare state with Git, worktrees, and handoffs. |
| `src/workflow/state/index.ts` | Export workflow-state modules. |


### Workflow coordination

| File | Responsibility |
|---|---|
| `src/workflow/transitions.ts` | Define valid workflow phase transitions. |
| `src/workflow/spec.ts` | Coordinate spec creation and approval. |
| `src/workflow/builder.ts` | Coordinate the builder cycle. |
| `src/workflow/verifier.ts` | Coordinate the verifier cycle. |
| `src/workflow/escalation.ts` | Coordinate escalation resolution. |
| `src/workflow/findings.ts` | Coordinate finding resolution. |
| `src/workflow/final-review.ts` | Coordinate final-review preparation. |
| `src/workflow/recovery.ts` | Coordinate recovery after interruptions. |
| `src/workflow/index.ts` | Export workflow modules. |

### Subagent integration

| File | Responsibility |
|---|---|
| `src/subagents/delegation.ts` | Start, monitor, and stop builders and verifiers. |
| `src/subagents/preflight.ts` | Check that required subagents are available. |
| `src/subagents/index.ts` | Export subagent modules. |

### Maestro mode

| File | Responsibility |
|---|---|
| `src/maestro/activation.ts` | Enable and disable Maestro mode. |
| `src/maestro/checks.ts` | Check the environment and repository. |
| `src/maestro/session.ts` | Persist Maestro state in the Pi session. |
| `src/maestro/instructions.ts` | Provide instructions to Maestro in the session. |
| `src/maestro/status.ts` | Show current status in the Pi UI. |
| `src/maestro/index.ts` | Export Maestro modules. |

### Owner tools

| File | Responsibility |
|---|---|
| `src/tools/main/create-spec.ts` | Create a spec. |
| `src/tools/main/mark-spec-ready.ts` | Validate and approve a ready spec. |
| `src/tools/main/inspect-workflow.ts` | Show workflow status. |
| `src/tools/main/launch-builder.ts` | Start a builder. |
| `src/tools/main/resolve-escalation.ts` | Record the owner decision for an escalation. |
| `src/tools/main/launch-verifier.ts` | Start a verifier. |
| `src/tools/main/resolve-findings.ts` | Record owner decisions for findings. |
| `src/tools/main/prepare-final-review.ts` | Prepare the candidate for final review. |
| `src/tools/main/index.ts` | Export owner-facing tools. |

### Builder and verifier tools

| File | Responsibility |
|---|---|
| `src/tools/child/record-builder-observation.ts` | Record builder evidence. |
| `src/tools/child/record-builder-handoff.ts` | Record a builder handoff. |
| `src/tools/child/open-escalation.ts` | Open a builder escalation. |
| `src/tools/child/record-verifier-handoff.ts` | Record a verifier handoff. |
| `src/tools/child/index.ts` | Export child-only tools. |

### Documentation and tests

| File | Responsibility |
|---|---|
| `docs/workflow.md` | Explain the owner, Maestro, builder, and verifier flow. |
| `docs/configuration.md` | Explain `.pi/maestro.json`. |
| `docs/recovery.md` | Explain recovery of interrupted workflows. |
| `test/support/temp-repository.ts` | Create temporary Git repositories for tests. |
| `test/support/fake-subagents.ts` | Simulate builders and verifiers in tests. |
| `test/support/test-files.ts` | Provide test file helpers. |

Every `src/**/index.ts` is an export barrel. Keep schemas next to their domain. Do not add a global `src/schemas/` directory. Tool files define the input schema, register the Pi tool, call domain code, and convert the result to Pi format. They do not duplicate Git, state, artifact, or workflow logic.

`test/unit/` and `test/integration/` mirror `src/`. `test/fixtures/config/`, `test/fixtures/specs/`, and `test/fixtures/artifacts/` contain their matching scenarios. A test file identifies its main source file, for example `src/workflow/state/store.ts` maps to `test/integration/workflow/state/store.test.ts`. A module does not need both unit and integration coverage when one meaningful test level is sufficient. Do not create generic aggregate tests such as `state.test.ts`.

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
