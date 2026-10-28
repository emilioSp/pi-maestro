# <id>: <short, outcome-oriented title>

<!--
Define required behavior, not motivation or implementation. See proposal.md for scope and design.md, when present, for approved technical decisions.
Write for the owner. State each requirement once and keep its acceptance criteria immediately below it.
Use the topics below as guidance. Omit empty subsections and these instructions.
Leave test code, fixtures, mocks, and commands to the builder. Keep execution evidence in handoffs.
-->

## Requirements

<Give each requirement its own ### REQ<number>: <title> heading and a unique, stable ID. Document only behavior or constraints this change adds, modifies, or removes, with relevant measurable limits, edge cases, and error handling. Existing behavior must continue working unless explicitly changed or removed; do not list unchanged behavior as requirements. Do not copy repository or agent instructions.>

<Give each requirement exactly one Delta value: added, modified, or removed. Keep requirements organized by topic, not by delta category. For modified or removed requirements, add a brief Before description only when useful. Verify the previous behavior from repository evidence; do not invent it or repeat the whole old requirement. State the complete required outcome, including the required absence and any agreed replacement or error behavior for removals. Keep the same pre-change baseline during revisions.>

<Each requirement must have Verified by with Markdown links to its acceptance criteria, using their actual heading anchors. When an existing test covers the exact starting conditions, action, and expected result, link its file relative to spec.md and give the exact scenario name instead of creating a duplicate criterion. Keep criteria for partial or uncertain coverage. A requirement can reference both criteria and tests; check their combined coverage.>

<Write each requirement-associated AC once, immediately below its primary requirement, with a #### AC<number>: <title> heading. Other requirements can link to it without duplication. A relevant regression AC without an associated changed requirement can instead use a ### AC<number>: <title> heading under an optional ## Regression checks section, with the same probe, expected result, and example fields. Do not invent a REQ or Delta field for it. Include only regressions relevant to this change, not an inventory of existing behavior, and omit the section when unnecessary.>

<Number ACs continuously from AC1 across the whole document, including nested and standalone regression criteria. During review, remove criteria already covered exactly by existing tests and update numbering and affected links. Keep required behavior documented when a requirement-associated criterion is omitted; omitting a standalone regression criterion does not require creating a requirement.>

### REQ1: <short required behavior>

Delta: <added | modified | removed>

<Describe the requirement once, including relevant boundary conditions and required failure or recovery behavior.>

Verified by: [AC1](#ac1-short-observable-claim)

#### AC1: <short observable claim>

1. Probe: <starting conditions and action or observation, without prescribing test implementation>
2. Expected result: <observable and measurable outcome>
3. Example: <specific starting conditions, concrete input or action, and exact expected result, not a restatement of the claim>

<!--
Each AC has one observable claim, a probe, an expected result, and a concrete example.
Describe relevant valid actions, invalid actions, and regressions directly through those fields, without a separate classification label.
The builder and verifier each run every probe independently. The builder chooses executable checks; the verifier checks their coverage independently.
-->
