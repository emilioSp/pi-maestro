---
type: ADR
id: 'ADR-002'
title: 'Store escalation decisions in builder handoffs'
status: active
date: 2026-10-08
---

## Context

The previous approach stored `escalations` in standalone files and used singular resolution tools. The recorded reason for replacing it was to use the same storage, local
ID, and batch decision model as `verifier` `findings`. Other evaluated alternatives were not recorded.

## Decision

Numbered `builder` `handoffs` contain `escalation` questions and their `owner` resolutions. One call records all current answers. No parallel storage model is needed.

IDs restart at `E1` in each `handoff`. References include both IDs, such as `B1/E1`. Answers update only the active handoff's resolution fields.

## Consequences

Standalone `escalation` storage and singular resolution tools were removed. Questions and decisions remain together in each numbered `builder` `handoff`.

There are no migration procedures, fallback readers, or deprecated aliases. `Artifact` versions remain `1.0.0` despite the breaking change.
