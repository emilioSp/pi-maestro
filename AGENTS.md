# AGENTS.md

## Project overview

Pi extension that implements a multiagent spec driven development workflow.

## At session start (clock in)

1. Read ROADMAP.md and CHANGELOG.md for current state 
2. Read DESIGN_DECISIONS.md for important decisions

## Before session end (clock out)

1. Update ROADMAP.md
2. Update DESIGN_DECISIONS.md

## Commands

- Always run `npm run check` when you finish a coding task

## Project structure and component scope

Keep the existing structure stable. Add a new structural file or directory only after an explicit design decision.

### File locations

1. `extensions/`: Pi integration.
2. `agents/`: Agent instructions.
3. `src/`: Application code.
4. `docs/`: User documentation.
5. `tests/`: Test support and fixture tests.

Keep configuration, Git operations, artifacts, workflow coordination, subagent integration, and tools in their existing domain directories.

### Modules, schemas, and tools

Before adding a module, read the nearby code to find the module responsible for that behavior.
If an existing module can handle the behavior, use it. Do not create a second implementation or an extra layer.

Import modules directly through the subpath aliases in `package.json`, such as `#workflow/...`.
Keep schemas with the domain code that uses them. Do not create a shared `src/schemas/` directory.

Each tool file defines its input schema, registers the Pi tool, calls domain code, and converts the result to Pi format.

### Tests

Keep each test file next to the source file it tests. Use these suffixes:

1. `.unit.test.ts` for unit tests.
2. `.integration.test.ts` for integration tests.

Keep support and fixture tests under `tests/`.
Use one test level when it gives meaningful coverage. A module does not need both unit and integration tests.

### Package format

The package contains TypeScript source, not compiled output. Pi loads the TypeScript files directly.
Publish `src/`. Do not add a `dist/` directory.

## Documentation

README.md, and all docs under /docs folder are intended for humans. Don't write them for agents. They are not.

When referring to humans, use "the owner", don't use "you".

In `README.md`, `docs/*.md`, `MISSION.md`, `TECH_STACK.md`, `ROADMAP.md`, `CHANGELOG.md`, and `DESIGN_DECISIONS.md`, format terms from `docs/glossary.md` with inline code. Do not apply this formatting to section titles, blockquotes (`>`), link labels, or text inside quotation marks. Do not format `spec` within `spec-driven` phrases. Leave possessive forms, such as `owner's`, unformatted. Include plurals and capitalization variants only when they have the glossary meaning. Do not change wording, code blocks, link targets, or file paths just to apply this formatting.