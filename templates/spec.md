# <id>: <short, outcome-oriented title>

## 1. Context and problem

<Briefly describe the current situation, who or what is affected, and the problem or opportunity that motivates this change. Explain the user, business, or technical value without describing the implementation.>

### Measurable goals

- <Observable outcome that must become possible.>
- <Metric or verifiable condition that defines success.>

## 2. Constraints

- <Non-negotiable technical, business, legal, security, operational, or compatibility boundary.>
- <Existing behavior or contract that must remain unchanged.>

Write `No additional constraints.` when none are known.

## 3. Requirements

### Functional requirements

- <Behavior the system must provide.>
- <Actor or system action and its required outcome.>

Write `No new functional behavior.` when the change is purely technical.

### Non-functional requirements

- <Measurable performance, reliability, security, accessibility, privacy, or compatibility requirement.>

Write `No additional non-functional requirements.` when none apply.

## 4. Technical design

<Describe the approved technical design and the decisions that affect the repository architecture. Do not attempt to list every file or local implementation detail.>

Include only the relevant subsections.

Write `No architectural changes. Follow the existing repository patterns.` when the change requires no architectural decision.

### Components and code structure

<Describe affected components, new responsibilities, boundaries, ownership, and important relationships between modules.>

### Data model

<Describe entities, fields, relationships, persistence rules, validation, migrations, and data lifecycle.>

### Data flow

<Describe how data enters the system, moves between components, changes state, and leaves the system.>

### External integrations

<Describe external services, SDKs, events, queues, webhooks, failure boundaries, and retry behavior.>

### Security and privacy

<Describe authentication, authorization, trust boundaries, sensitive-data handling, retention, encryption, and redaction.>

### Compatibility and migration

<Describe backward compatibility, data migration, rollout, rollback, and coexistence with older versions.>

## 5. Prototype and user interaction

Write `Not applicable.` when the change has no visual or interactive behavior.

### Prototype

- `prototypes/<surface-name>.<html|png|jpg|jpeg>`: <surface and states represented by the prototype>

### User interaction

<Describe the user flow, triggers, state transitions, validation, feedback, and recovery behavior.>

Cover the relevant states: default, loading, empty, success, validation error, system error, disabled, and permission denied.

## 6. API specification

Write `Not applicable.` when the change does not introduce or modify an API contract.

Supported contracts include REST, GraphQL, JSON-RPC, events, webhooks, and repository-specific protocols.

Repeat the following subsection for every operation.

### <operation name>

**Protocol and operation**

```text
<method, path, operation, event, topic, or procedure name>
```

**Authentication and authorization**

<Describe the caller identity, required permissions, and ownership rules.>

**Request or input**

<Describe headers, path parameters, query parameters, arguments, or payload fields.>

```json
{
  "example": "input"
}
```

**Successful response or output**

<Describe the success status, output fields, and side effects.>

```json
{
  "example": "output"
}
```

**Errors**

| Condition | Result | Observable effect |
|---|---|---|
| <Invalid input> | `<status or error code>` | <No state change> |
| <Missing permission> | `<status or error code>` | <No state change> |
| <Conflict> | `<status or error code>` | <Existing state is preserved> |

**Delivery and consistency**

<Describe idempotency, retries, ordering, pagination, rate limits, transactional boundaries, or eventual consistency when applicable.>

## 7. Edge cases and error handling

| Case | Expected behavior | State and recovery |
|---|---|---|
| <Boundary or error condition> | <Observable system behavior> | <Preserved state, rollback, retry, or recovery behavior> |
| <Unavailable dependency> | <Error presented to the caller or user> | <Partial state handling and retry behavior> |
| <Repeated or concurrent operation> | <Idempotent, serialized, or conflict behavior> | <Resulting authoritative state> |

Every edge case required by the spec must be covered by an acceptance criterion.

Write `No additional edge cases.` only when none apply.

## 8. Acceptance criteria

### AC1: <short observable claim>

- **Probe**: <exact command, API call, or reproducible procedure>
- **Expected result**: <observable and measurable result>
- **Breakage**: <specific temporary implementation change that must make the probe fail>

## 9. Monitoring and observability

Write `Not applicable.` when the change requires no new or modified operational signal.

### Signals

| Signal | Trigger | Required information |
|---|---|---|
| <Metric, structured log, trace, audit event, or health signal> | <When it is emitted> | <Fields, dimensions, or correlation data> |

### Failure visibility

<Describe how an operator detects, correlates, and diagnoses the failures introduced or affected by this change.>

### Alerts and thresholds

<Describe required alerts, thresholds, windows, and ownership. Remove this subsection when no new alert is required.>

### Sensitive data

- <Data that must not appear in logs, traces, metrics, events, or alerts.>

## 10. Out of scope

- <Related behavior, user flow, integration, migration, or component that must not be implemented by this spec.>
- <Existing behavior that must remain unchanged and is not being redesigned.>

Write `No additional out-of-scope items.` when none are known.
