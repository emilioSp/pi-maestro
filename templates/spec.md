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

<Describe boundary conditions, failures, and required recovery behavior not already covered above. Cover each required case in the acceptance criteria.>

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

<Give each criterion a unique ID and one observable claim. A probe is the scenario used to check that claim. Describe it in plain language.>

### AC1: <short observable claim>

1. Probe: <starting conditions and action or observation, without prescribing test implementation>
2. Expected result: <observable and measurable outcome>
3. Example: <specific starting conditions, concrete input or action, and exact expected result for this probe, not a restatement of the claim>
4. Breakage: Not required. <Only when selected with the owner: describe the wrong behavior that a safe temporary change must cause and the probe must detect.>

<!--
Example:
Probe: Save a change to an item's title, then reopen the item.
Expected result: The saved title is still present.
Example: An item's title is "Draft". Change it to "Ready", save, and reopen the item. The title is "Ready".
Breakage (if selected): Discard the title change instead of saving it.

Breakage checks are not required by default. Select them with the owner only when proving error detection adds value.
The builder and verifier each run every probe. For selected breakages only, they also run the same probe during breakage and after restoration.
The builder chooses executable checks and safe temporary changes. The verifier checks their coverage independently.
Keep execution evidence in handoffs, not in this spec.
-->
