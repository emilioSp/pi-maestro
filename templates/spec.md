# <id>: <short, outcome-oriented title>

> After owner approval, this specification is the contract for the builder and verifier.

<!--
Write for the owner, not only for agents. Keep detail proportional to the change.
State each requirement once. Refer to it from acceptance criteria instead of repeating it.
Use the topics below as guidance, not a checklist to fill. Omit empty subsections and these instructions.
Leave local implementation choices, test code, fixtures, mocks, and commands to the builder.
-->

## 1. Context, goals, and scope

<Briefly describe the problem, who is affected, and the intended outcome.>

### Out of scope

<Name related changes that are explicitly excluded.>

## 2. Requirements and constraints

<Describe required behavior and measurable limits. Include performance, reliability, accessibility, or other quality requirements only when relevant.>

<Include non-negotiable boundaries and existing behavior that this change must preserve. Do not copy repository or agent instructions.>

### Edge cases and error handling

<Describe boundary conditions, failures, and required recovery behavior not already covered above. Keep these requirements even when existing tests cover their scenarios.>

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

<Inspect existing tests before writing criteria. Omit a criterion only if a test covers the same starting conditions, action, and expected result. Keep criteria when coverage is partial or uncertain. During review, remove criteria already covered by tests. Keep numbering continuous from AC1 and update affected references. Keep required behavior in section 2 even when its criterion is omitted.>

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
