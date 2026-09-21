# <id>: <short, outcome-oriented title>

## 1. Context, goals, and scope

<Describe the current situation, who or what is affected, and the problem or opportunity without describing the implementation.>

### Measurable goals

- <Observable outcome that must become possible.>
- <Metric or verifiable condition that defines success.>

### Out of scope

- <Related behavior, integration, migration, or component that must not be implemented.>
- <Existing behavior that remains unchanged and is not being redesigned.>

Write `No additional out-of-scope items.` when none are known.

## 2. Requirements and constraints

### Functional requirements

- <Behavior the system must provide.>
- <Actor or system action and its required outcome.>

Write `No new functional behavior.` when the change is purely technical.

### Non-functional requirements

- <Measurable performance, reliability, security, accessibility, privacy, or compatibility requirement.>

Write `No additional non-functional requirements.` when none apply.

### Constraints

- <Non-negotiable technical, business, legal, security, operational, or compatibility boundary.>
- <Existing behavior or contract that must remain unchanged.>

Write `No additional constraints.` when none are known.

### Edge cases and error handling

| Case | Expected behavior | State and recovery |
|---|---|---|
| <Boundary or error condition> | <Observable system behavior> | <Preserved state, rollback, retry, or recovery behavior> |
| <Unavailable dependency> | <Error presented to the caller or user> | <Partial state handling and retry behavior> |
| <Repeated or concurrent operation> | <Idempotent, serialized, or conflict behavior> | <Resulting authoritative state> |

Every required edge case must be covered by an acceptance criterion.

Write `No additional edge cases.` only when none apply.

## 3. Technical design

<Describe the approved technical decisions that affect the repository architecture. Do not list every file or local implementation detail.>

Include only relevant optional subsections. Write `No architectural changes. Follow the existing repository patterns.` when none apply.

### Components and data flow

<Describe affected components, responsibilities, data models, state changes, and important boundaries.>

### API specification

Write `Not applicable.` when no API contract changes.

For each operation, define the protocol and operation, caller permissions, input, successful output, errors and side effects, and delivery or consistency rules.

### Prototype and user interaction

Write `Not applicable.` when there is no visual or interactive behavior.

- `prototypes/<surface-name>.<html|png|jpg|jpeg>`: <surface and states represented by the prototype>

<Describe user triggers, state transitions, validation, feedback, accessibility, and recovery behavior.>

### External integrations

<Describe affected services, SDKs, events, queues, webhooks, failure boundaries, and retry behavior.>

### Security and privacy

<Describe authentication, authorization, trust boundaries, sensitive-data handling, retention, encryption, and redaction.>

### Compatibility and migration

<Describe backward compatibility, migration, rollout, rollback, and coexistence with older versions.>

### Monitoring and observability

Write `Not applicable.` when no operational signal changes.

<Describe required signals, triggers, diagnostic information, alerts, thresholds, ownership, and sensitive data that must not be recorded.>

## 4. Acceptance criteria

### AC1: <short observable claim>

- **Probe**: <exact command, API call, or reproducible procedure>
- **Expected result**: <observable and measurable result>
- **Breakage**: <specific temporary implementation change that must make the probe fail>
