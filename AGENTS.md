# AGENTS.md

## At session start (clock in)

Read `CHANGELOG.md`, `docs/adr/README.md`, and `docs/roadmap/README.md`. Read individual ADRs and roadmap items when relevant. Maintain roadmap items under
`docs/roadmap/` and keep existing `MAESTRO` identifiers stable. Linear is historical reference only; do not read or update it unless the owner explicitly requests it.

## Before session end (clock out)

1. Add or update a record under `docs/adr/` only when the session includes a significant architectural decision. Keep `docs/adr/README.md` in sync.
2. Update the relevant item under `docs/roadmap/`, but only when work covered an item already present there. Keep `docs/roadmap/README.md` in sync. Record completion only
   when supported by owner acceptance.
3. If a spec exists, link it from the relevant roadmap item.

## Commands

Run `npm run check` when finishing a coding task.

## Task constraints

Add a new structural file or directory only after an explicit design decision. Do not create a shared `src/schemas/` directory. Direct workflow phase assignment outside
`src/workflow/transitions.ts` is banned. Define every phase transition there and apply it through `transitionWorkflow`.

## Documentation

README.md, and all docs under /docs folder are intended for humans. Don't write them for agents. They are not.

When referring to humans, use "the owner", don't use "you".

ADR files under `docs/adr/` use only these sections, in order: `Context`, `Decision`, optional `Alternatives considered`, and `Consequences`. Keep status and known dates
in front matter.

Roadmap items under `docs/roadmap/` use only `Objective` and `Completed When` sections. Keep status in front matter. Do not add evidence or completion reports. If another
section is needed, ask the owner first.

In `README.md`, `docs/**/*.md`, `MISSION.md`, `TECH_STACK.md`, and `CHANGELOG.md`, format terms from `docs/glossary.md` with inline code. Do not apply this formatting to
section titles, blockquotes (`>`), link labels, or text inside quotation marks. Do not format `spec` within `spec-driven` phrases. Leave possessive forms, such as
`owner's`, unformatted. Include plurals and capitalization variants only when they have the glossary meaning. Do not change wording, code blocks, link targets, or file
paths just to apply this formatting.

## Remove and unchanged behavior

Do not explicit document behavior that are unchanged.

Bad: Replaced the `acceptance criterion` `probe` and `expected result` fields with `GIVEN`, `WHEN`, and `THEN`, keeping the concrete example. Requirement bodies now use a
named actor followed by `MUST` in the requirement heading. Added an optional bullet-list `## Assumptions` section to `spec.md`. Saved `handoff` formats are unchanged.

Good: Replaced the `acceptance criterion` `probe` and `expected result` fields with `GIVEN`, `WHEN`, and `THEN`, keeping the concrete example. Requirement bodies now use
a named actor followed by `MUST` in the requirement heading. Added an optional bullet-list `## Assumptions` section to `spec.md`.

### Changelog

The changelog is to state the system behavior. Do not write technical changes in it.

Bad: The extension now uses TypeBox `Type.Enum` with an explicit string type instead of the `StringEnum` helper, calls `before_agent_start` with Pi's message object, and
expects the `truncated` field on `exec` results.

Good: The extension now properly validates option inputs, ensures the agent receives complete message context when starting, and correctly detects when command execution
outputs have been truncated.
