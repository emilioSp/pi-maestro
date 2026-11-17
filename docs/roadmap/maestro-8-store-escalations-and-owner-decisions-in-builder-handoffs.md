---
type: Roadmap
id: 'MAESTRO-8'
title: 'Store escalations and owner decisions in builder handoffs'
status: completed
---

## Objective

Keep `escalation` questions and `owner` answers together in numbered `builder` `handoffs`.

See the
[specification](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/.specs/20261008-132344-store-escalations-in-builder-handoffs/spec.md).

## Completed When

- A `builder` `handoff` can contain multiple questions and their resolutions.
- The `owner` resolves all current questions in one batch, updating the same `handoff`.
- Earlier numbered `handoffs` remain available as history.
