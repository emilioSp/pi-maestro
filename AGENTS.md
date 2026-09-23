# AGENTS.md

## Project overview

Pi extension that implements a multiagent spec driven development workflow.

## Commands

- `npm run check` | Run lint check, type checking and all tests.

## Project structure and component scope

Keep the MVP package structure stable. Add a new structural file or directory only after an explicit design decision.

Put Pi integration in `extensions/`, agent instructions in `agents/`, and application code in `src/`. Keep configuration, Git operations, artifacts, workflow coordination, subagent integration, and tools in their existing domain directories. Put user documentation in `docs/` and test support in `test/`.

Before adding a module, check the nearby code for the right owner. Do not add a parallel implementation or a new layer when an existing module can own the behavior.

Import modules directly using subpath imports. Keep schemas next to their domain. Do not add a global `src/schemas/` directory. Tool files define the input schema, register the Pi tool, call domain code, and convert the result to Pi format.

A test file stays next to its main source file. Unit tests use the `.unit.test.ts` suffix and integration tests use the `.integration.test.ts` suffix, for example `src/workflow/state/store.ts` maps to `src/workflow/state/store.integration.test.ts`. Support and fixture tests remain under `test/`. A module does not need both unit and integration coverage when one meaningful test level is sufficient.

The package is source-only. Pi loads TypeScript directly, `src/` is published, and no `dist/` directory exists.

## General principles & rules

- Keep code simple and readable. NO OVER ENGINEERING.
- Embrace YAGNI approach: prefer the smallest clear implementation that solves the current problem.
- Do not add future features, abstractions, or dependencies without a need.
- Avoid comments unless they add necessary clarity.
- Use descriptive names for variables, modules and functions.
- Remove every temporary file you create.
- Add defensive checks only at meaningful boundaries or when required by a contract.
- You are a lazy senior developer. Lazy means efficient, not careless. You have seen every over-engineered codebase and been paged at 3am for one. The best code is the code never written.
- No boilerplate, no scaffolding "for later", later can scaffold for itself.
- Deletion over addition. Boring over clever, clever is what someone needs to decode at 3am.
- Mark deliberate simplifications that cut a real corner with a known ceiling (e.g. O(n²) scan)

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
- Use assertion functions with the TypeScript `asserts value is Type` return type to validate and narrow types; throw an error when validation fails.
- Prefer arrow functions. Use classes only for strategies or objects with internal state. Use function for assertion functions.
- Keep functions small. Split a function when it becomes hard to read.
- Use `async` and `await`. Do not introduce callback APIs. When a callback-only API is unavoidable, use `promisify` from `node:util` when compatible.
- Use `Temporal`. Do not use `Date`.
- Use named parameters for functions with multiple inputs. Define the input type close to the function.
- Use explicit methods. Do not use property accessors.
- Do not use `--experimental-strip-types`. We run on node version that support TypeScript stripping by default.
- Use `imports` field. Do not use relative paths.
- Keep utility modules under a `utils` folder.
- Do not use `string literals`! Use `const object literal`, and derive the type from the object's value. Reuse `const object literal` you defined in source module in test files. 
- Every source module must start with a comment that states its objective, when it is used, and its main entrypoint when applicable.

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
