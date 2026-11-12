# <id>: <short, outcome-oriented title>

<!--
Define required behavior, not motivation or implementation. See proposal.md for scope and design.md, when present, for approved technical decisions.
Write for the owner. Keep the style concise and straight to the point. Avoid narrative prose; written examples may use prose and code blocks when a table does not fit.
State each requirement once and keep its acceptance criteria immediately below it.
Use the topics below as guidance. Omit empty subsections and these instructions.
Leave verification methods, test code, fixtures, mocks, and commands to the builder. Keep execution evidence in handoffs.
-->

## Requirements

<Give each requirement its own ### REQ<number>: <Actor> MUST <short capability> heading and a unique, stable ID. Document only behavior or constraints this change adds, modifies, or removes, with relevant measurable limits, edge cases, and error handling. Existing behavior must continue working unless explicitly changed or removed; do not list unchanged behavior as requirements. Do not copy repository or agent instructions.>

<Give each requirement exactly one Delta value: added, modified, or removed. Keep requirements organized by topic, not by delta category. For modified or removed requirements, add a brief Before description only when useful. Verify the previous behavior from repository evidence; do not invent it or repeat the whole old requirement. State the complete required outcome, including the required absence and any agreed replacement or error behavior for removals. Keep the same pre-change baseline during revisions.>

<Each requirement must have Verified by with Markdown links to its acceptance criteria, using their actual heading anchors. When an existing test covers the exact starting conditions, action, and outcome, link its file relative to spec.md and give the exact scenario name instead of creating a duplicate criterion. Keep criteria for partial or uncertain coverage. A requirement can reference both criteria and tests; check their combined coverage.>

<Write each requirement-associated AC once, immediately below its primary requirement, with a #### AC<number>: <title> heading. Other requirements can link to it without duplication. A relevant regression AC without an associated changed requirement can instead use a ### AC<number>: <title> heading under an optional ## Regression checks section, with the same GIVEN, WHEN, THEN, and concrete example format. Do not invent a REQ or Delta field for it. Include only regressions relevant to this change, not an inventory of existing behavior, and omit the section when unnecessary.>

<Number ACs continuously from AC1 across the whole document, including nested and standalone regression criteria. During review, remove criteria already covered exactly by existing tests and update numbering and affected links. Keep required behavior documented when a requirement-associated criterion is omitted; omitting a standalone regression criterion does not require creating a requirement.>

### REQ1: <Actor> MUST <short capability>

Delta: <added | modified | removed>

<Optional supporting details, such as boundary conditions and required failure or recovery behavior. Keep only the MUST statement in the heading and do not repeat it here.>

Verified by: [AC1](#ac1-short-observable-claim)

#### AC1: <short observable claim>

- GIVEN <starting conditions>
- WHEN <action or observation, without prescribing test implementation>
- THEN <observable and measurable outcome>

| <specific starting condition> | <specific input or action> | <specific expected outcome> |
| ----------------------------- | -------------------------- | --------------------------- |
| <concrete value or state>     | <concrete input or action> | <exact result>              |

<!--
Each AC has exactly one GIVEN, one WHEN, and one THEN, followed by either a behavioral example table or a written Example. Do not repeat table cases in prose.
Write the AC first; use as many example rows as needed to explain its one observable claim. Do not combine unrelated behavior or split an AC just because it has several rows.
Prefer a table even for one case. Choose domain-specific headers; the placeholder columns above are not mandatory.
Each column names a specific starting condition, input, action, or observable outcome. Each row is independent and self-contained: repeat shared conditions and actions rather than leaving them only in GIVEN, WHEN, or THEN.
Rows are complete cases, not sequential steps. A complete sequence can be one row if meaningful columns describe it.
Use a written Example instead when the only useful headers are generic containers such as "Setup / Action / Expected result" filled with prose, or multiline content, nested data, or long explanations make cells hard to read.
For that fallback, replace the table with "- Example: <concrete starting conditions, input or action, and exact outcome>". Code blocks may accompany the written example. Never omit important details to force a table.
THEN states the observable and measurable outcome that the WHEN must produce.
Describe relevant valid actions, invalid actions, and regressions directly through those fields, without a separate classification label.
Every example row is required behavior. The builder accounts for every row; the verifier independently checks each one. Automated tests are not mandatory for every row: appropriate code inspection can be sufficient, for example to confirm feature removal. Record actual verification evidence in handoffs.
-->

## Assumptions

<!--
Record short defaults taken when the request did not specify a detail, or scope boundaries taken as given. Use a bullet list, not paragraphs. Omit the section when there are none.
-->

- <default chosen when the request did not specify a detail>
- <scope boundary taken as given>
