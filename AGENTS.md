# AGENTS.md

## Project overview

Pi extension that implements a multiagent spec driven development workflow.

## Commands

- Always run `npm run check` when you finish a task

## Project structure and component scope

Keep the MVP package structure stable. Add a new structural file or directory only after an explicit design decision.

Put Pi integration in `extensions/`, agent instructions in `agents/`, and application code in `src/`. Keep configuration, Git operations, artifacts, workflow coordination, subagent integration, and tools in their existing domain directories. Put user documentation in `docs/` and test support in `test/`.

Before adding a module, check the nearby code for the right owner. Do not add a parallel implementation or a new layer when an existing module can own the behavior.

Import modules directly using subpath imports. Keep schemas next to their domain. Do not add a global `src/schemas/` directory. Tool files define the input schema, register the Pi tool, call domain code, and convert the result to Pi format.

A test file stays next to its main source file. Unit tests use the `.unit.test.ts` suffix and integration tests use the `.integration.test.ts` suffix, for example `src/workflow/state/store.ts` maps to `src/workflow/state/store.integration.test.ts`. Support and fixture tests remain under `test/`. A module does not need both unit and integration coverage when one meaningful test level is sufficient.

The package is source-only. Pi loads TypeScript directly, `src/` is published, and no `dist/` directory exists.