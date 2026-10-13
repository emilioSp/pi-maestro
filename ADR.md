# Architecture decision records

An Architecture Decision Record (ADR) explains an important architectural choice, its context, and its consequences. 
This file contains one numbered record per decision. 

Requirements and routine project rules belong in the [roadmap](ROADMAP.md) or other relevant documentation.

When a new decision replaces an accepted decision, add a new record, mark the earlier record as superseded, and link both records.

## ADR-001: Keep the workflow independent of Git

### Status

Accepted. Recorded date: 2026-10-07. Implemented in `0.6.0`.

### Context

The previous workflow required Git and used checkpoints and automatic commits. The recorded reason for removing that approach was to simplify the project. Other evaluated alternatives were not recorded.

### Decision

`Maestro` uses the Pi project directory and saved workflow phase. It does not require Git or create automatic commits.

The `verifier` checks live project files. The `owner` controls later Git use, pull requests, and merging.

### Consequences

Workflow execution no longer depends on Git. Revision and commit fields were removed without migration or compatibility readers. Interrupted and older workflows require manual `owner` handling.

### Evidence

[Commit deae41c](https://github.com/emilioSp/pi-maestro/commit/deae41ce66a3f2c76859209c44165e7ddd0f3a72), [Changelog 0.6.0](CHANGELOG.md#060), and [workflow completion](docs/workflow.md#workflow-completion).

## ADR-002: Store escalation decisions in builder handoffs

### Status

Accepted. Recorded date: 2026-10-08. Implemented in `0.7.0`.

### Context

The previous approach stored `escalations` in standalone files and used singular resolution tools. The recorded reason for replacing it was to use the same storage, local ID, and batch decision model as `verifier` `findings`. Other evaluated alternatives were not recorded.

### Decision

Numbered `builder` `handoffs` contain `escalation` questions and their `owner` resolutions. One call records all current answers. No parallel storage model is needed.

IDs restart at `E1` in each `handoff`. References include both IDs, such as `B1/E1`. Answers update only the active handoff's resolution fields.

### Consequences

Standalone `escalation` storage and singular resolution tools were removed. Questions and decisions remain together in each numbered `builder` `handoff`.

There are no migration procedures, fallback readers, or deprecated aliases. `Artifact` versions remain `1.0.0` despite the breaking change.

### Evidence

[Repository-only specification](.specs/20261008-132344-store-escalations-in-builder-handoffs/spec.md), [Commit dda6eb5](https://github.com/emilioSp/pi-maestro/commit/dda6eb5b3ab76ba175112c3c565c70be747d7344), and [escalation workflow](docs/workflow.md#escalations).

## ADR-003: Route builder failures through owner escalations

### Status

Accepted. Implemented.

### Context

The `owner` must decide how work continues after a reportable technical problem.
The workflow also needs a simpler model with two `builder` outcomes.

### Decision

The `builder` reports only `done` or `escalation`.
Reportable technical failures use the existing `escalation` process.
The `owner` decides how to proceed instead of reaching a terminal failure phase.

### Consequences

Reuse the existing tools, numbered `handoffs`, and batch decisions.
Individual `probe` results retain `failed` as a valid value.

Execution and protocol errors without a valid saved result still stop the workflow.
This decision adds no automatic recovery.

This breaking MVP change has no migrations, compatibility readers, deprecated aliases, or dedicated legacy-format tests.

### Evidence

[Specification](.specs/20261013-101454-route-builder-failures-through-owner-escalations/spec.md) and [R-03](ROADMAP.md#r-03-route-builder-failures-through-owner-escalations).