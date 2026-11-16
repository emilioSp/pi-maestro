---
type: Roadmap
id: 'MAESTRO-7'
title: 'Route builder failures through owner escalations'
status: completed
---

## Objective

Route reportable `builder` problems through `owner` `escalations` instead of a terminal failure phase.

See the
[specification](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/.specs/20261013-101454-route-builder-failures-through-owner-escalations/spec.md).

## Completed When

- The `builder` reports either `done` or `escalation`.
- Reportable technical problems use the existing `escalation` process, leaving the next decision to the `owner`.
- Individual `probe` results can remain `failed`. Execution errors and missing or invalid `handoffs` stop the workflow.
