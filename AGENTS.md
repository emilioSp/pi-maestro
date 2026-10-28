# AGENTS.md

## At session start (clock in)

Read `CHANGELOG.md` and `ADR.md`. The roadmap is maintained in [Linear](https://linear.app/emilio-spatola/team/MAESTRO/overview). Read relevant issues through MCP in team
`MAESTRO` and use Linear issue identifiers in references. If Linear is unavailable, report that limitation instead of treating Git history as the current roadmap.

## Before session end (clock out)

1. Update `ADR.md` only when the session includes a significant architectural decision.
2. Update the relevant Linear roadmap issue, but only when you worked on an item already present there. Record completion only when supported by owner acceptance. Do not
   maintain a local copy of the roadmap.
3. If spec exists, link it the issue in Linear.

## Commands

Run `npm run check` when finishing a coding task.

## Task constraints

Add a new structural file or directory only after an explicit design decision. Do not create a shared `src/schemas/` directory. Direct workflow phase assignment outside
`src/workflow/transitions.ts` is banned. Define every phase transition there and apply it through `transitionWorkflow`.

## Documentation

README.md, and all docs under /docs folder are intended for humans. Don't write them for agents. They are not.

When referring to humans, use "the owner", don't use "you".

In `README.md`, `docs/*.md`, `MISSION.md`, `TECH_STACK.md`, `CHANGELOG.md`, `ADR.md`, and in Linear roadmap issues, projects, and documents, format terms from
`docs/glossary.md` with inline code. Do not apply this formatting to section titles, blockquotes (`>`), link labels, or text inside quotation marks. Do not format `spec`
within `spec-driven` phrases. Leave possessive forms, such as `owner's`, unformatted. Include plurals and capitalization variants only when they have the glossary
meaning. Do not change wording, code blocks, link targets, or file paths just to apply this formatting.
