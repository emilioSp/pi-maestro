# AGENTS.md

## At session start (clock in)

1. Read `ROADMAP.md`, `CHANGELOG.md`, and `ADR.md`.

## Before session end (clock out)

1. Update `ROADMAP.md`.
2. Update `ADR.md` only when the session includes a significant architectural decision.

## Commands

Run `npm run check` when finishing a coding task.

## Task constraints

Add a new structural file or directory only after an explicit design decision.
Do not create a shared `src/schemas/` directory.
Direct workflow phase assignment outside `src/workflow/transitions.ts` is banned. Define every phase transition there and apply it through `transitionWorkflow`.

## Documentation

README.md, and all docs under /docs folder are intended for humans. Don't write them for agents. They are not.

When referring to humans, use "the owner", don't use "you".

In `README.md`, `docs/*.md`, `MISSION.md`, `TECH_STACK.md`, `ROADMAP.md`, `CHANGELOG.md`, and `ADR.md`, format terms from `docs/glossary.md` with inline code. Do not apply this formatting to section titles, blockquotes (`>`), link labels, or text inside quotation marks. Do not format `spec` within `spec-driven` phrases. Leave possessive forms, such as `owner's`, unformatted. Include plurals and capitalization variants only when they have the glossary meaning. Do not change wording, code blocks, link targets, or file paths just to apply this formatting.