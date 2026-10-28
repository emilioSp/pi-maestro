# <id>: <short, outcome-oriented title>

<!--
Write for the owner, not only for agents. Keep detail proportional to the change.
State each requirement once. Link its verification from Verified by instead of repeating the requirement in acceptance criteria.
Use the topics below as guidance, not a checklist to fill. Omit empty subsections and these instructions.
Leave local implementation choices, test code, fixtures, mocks, and commands to the builder.
-->

## 1. Context, goals, and scope

<Briefly describe the problem, who is affected, and the intended outcome.>

### Out of scope

<Name related changes that are explicitly excluded.>

## 2. Requirements and constraints

<Give each requirement its own ### REQ<number>: <title> heading and a unique, stable ID. Include required behavior, measurable limits, constraints, preserved behavior, edge cases, and error handling as relevant. Do not copy repository or agent instructions.>

<Each requirement must have Verified by with Markdown links to one or more acceptance criteria. Use each criterion's actual heading anchor and update links when headings change. If an existing test covers the exact scenario, link its file relative to spec.md and include the exact test scenario name instead of creating a duplicate criterion. A requirement can reference both criteria and existing tests. Check that their combined coverage verifies the whole requirement. Keep the mapping only here, not in the acceptance criteria.>

### REQ1: <short required behavior>

<Describe the requirement once, including relevant boundary conditions and expected failure or recovery behavior. Keep it documented even when existing tests cover it.>

Verified by: [AC1](#ac1-short-observable-claim)

## 3. Technical decisions and prototypes

<Record only approved architectural decisions or technical constraints that affect scope or behavior. Explain their reasons briefly. Leave routine implementation choices to the builder.>

<For each relevant topic below, add a short subsection. Omit topics that do not apply.>

1. Components and data flow: changed responsibilities, data contracts, and important boundaries. No file inventory or function-level design.
2. API specification: changed operations, permissions, inputs, outputs, errors, side effects, and delivery guarantees.
3. Prototype and user interaction: link prototypes and identify approved states and interactions. Distinguish illustrative content from requirements.
4. External integrations: affected services, failure behavior, and retries.
5. Security and privacy: access rules, sensitive data, retention, and trust boundaries.
6. Compatibility and migration: compatibility limits, migration, rollout, and rollback requirements.
7. Monitoring and observability: required signals, alerts, and ownership.

<Include only evidence and unresolved limits that affect an owner decision. Do not include investigation logs or general verification disclaimers.>

## 4. Acceptance criteria

<Inspect existing tests before writing criteria. Omit a criterion only if a test covers the same starting conditions, action, and expected result. Keep criteria when coverage is partial or uncertain. During review, remove criteria already covered by tests. Keep numbering continuous from AC1 and update affected references, including Verified by links. Keep required behavior in section 2 and link the covering tests from its Verified by field even when its criterion is omitted.>

<Give each criterion a unique ID, one observable claim, and one coverage label. A probe is the scenario used to check that claim. Describe it in plain language. Use success for a valid action that produces the required result. Use failure for an invalid action that is correctly rejected. Use unchanged when the criterion explicitly checks existing behavior that the change must preserve. The label describes the scenario, not the test outcome. A failure scenario passes when the invalid action is correctly rejected. Do not require all three categories.>

### AC1: <short observable claim>

1. Coverage: <success | failure | unchanged>
2. Probe: <starting conditions and action or observation, without prescribing test implementation>
3. Expected result: <observable and measurable outcome>
4. Example: <specific starting conditions, concrete input or action, and exact expected result for this probe, not a restatement of the claim>

<!--
Example:
Coverage: success
Probe: Save a change to an item's title, then reopen the item.
Expected result: The saved title is still present.
Example: An item's title is "Draft". Change it to "Ready", save, and reopen the item. The title is "Ready".

The builder and verifier each run every probe.
The builder chooses executable checks. The verifier checks their coverage independently.
Keep execution evidence in handoffs, not in this spec.
-->
