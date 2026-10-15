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

## Documentation

Write `README.md` and `docs/` for humans, not agents.
When referring to humans, use "the owner", not "you".
For documentation changes, follow the glossary formatting rules in `.agents/skills/docs-audit/SKILL.md`.
