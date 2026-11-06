# <id>: <short, outcome-oriented title>

<!--
Define required behavior, not motivation or implementation. See proposal.md for scope and design.md, when present, for approved technical decisions.
Write for the owner. Keep the style concise and straight to the point. Do not write prose.
State each requirement once and keep its acceptance criteria immediately below it.
Use the topics below as guidance. Omit empty subsections and these instructions.
Leave test code, fixtures, mocks, and commands to the builder. Keep execution evidence in handoffs.
-->

## Requirements

<Give each requirement its own ### REQ<number>: <Actor> MUST <short capability> heading and a unique, stable ID. Document only behavior or constraints this change adds, modifies, or removes, with relevant measurable limits, edge cases, and error handling. Existing behavior must continue working unless explicitly changed or removed; do not list unchanged behavior as requirements. Do not copy repository or agent instructions.>

<Give each requirement exactly one Delta value: added, modified, or removed. Keep requirements organized by topic, not by delta category. For modified or removed requirements, add a brief Before description only when useful. Verify the previous behavior from repository evidence; do not invent it or repeat the whole old requirement. State the complete required outcome, including the required absence and any agreed replacement or error behavior for removals. Keep the same pre-change baseline during revisions.>

<Each requirement must have Verified by with Markdown links to its acceptance criteria, using their actual heading anchors. When an existing test covers the exact starting conditions, action, and outcome, link its file relative to spec.md and give the exact scenario name instead of creating a duplicate criterion. Keep criteria for partial or uncertain coverage. A requirement can reference both criteria and tests; check their combined coverage.>

<Write each requirement-associated AC once, immediately below its primary requirement, with a #### AC<number>: <title> heading. Other requirements can link to it without duplication. A relevant regression AC without an associated changed requirement can instead use a ### AC<number>: <title> heading under an optional ## Regression checks section, with the same GIVEN, WHEN, THEN, and Example fields. Do not invent a REQ or Delta field for it. Include only regressions relevant to this change, not an inventory of existing behavior, and omit the section when unnecessary.>

<Number ACs continuously from AC1 across the whole document, including nested and standalone regression criteria. During review, remove criteria already covered exactly by existing tests and update numbering and affected links. Keep required behavior documented when a requirement-associated criterion is omitted; omitting a standalone regression criterion does not require creating a requirement.>

### REQ1: <Actor> MUST <short capability>

Delta: <added | modified | removed>

<Optional supporting details, such as boundary conditions and required failure or recovery behavior. Keep only the MUST statement in the heading and do not repeat it here.>

Verified by: [AC1](#ac1-short-observable-claim)

#### AC1: <short observable claim>

- GIVEN <starting conditions>
- WHEN <action or observation, without prescribing test implementation>
- THEN <observable and measurable outcome>
- Example: <specific starting conditions, concrete input or action, and exact outcome, not a restatement of the claim>

<!--
Each AC has exactly one GIVEN, one WHEN, and one THEN, plus a concrete Example.
THEN states the observable and measurable outcome that the WHEN must produce.
Describe relevant valid actions, invalid actions, and regressions directly through those fields, without a separate classification label.
The builder and verifier each run every scenario independently. The builder chooses executable checks; the verifier checks their coverage independently.
-->

## Assumptions

<!--
Record short defaults taken when the request did not specify a detail, or scope boundaries taken as given. Use a bullet list, not paragraphs. Omit the section when there are none.
-->

- <default chosen when the request did not specify a detail>
- <scope boundary taken as given>
