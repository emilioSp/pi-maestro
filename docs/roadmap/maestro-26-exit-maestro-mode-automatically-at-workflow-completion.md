---
type: Roadmap
id: 'MAESTRO-26'
title: 'Exit Maestro mode automatically at workflow completion'
status: completed
---

## Objective

Turn off `Maestro` automatically after the final summary is successfully delivered.

See the [specification](../../.specs/20261030-145712-automatically-exit-maestro-mode-at-workflow-completion/spec.md).

## Completed When

- A completed workflow remains active while `Maestro` delivers its final summary, including when simplification was skipped.
- Successful delivery clears live tools, status, instructions, and active `spec` selection without changing saved workflow files or other extensions.
- Intermediate phases, interruptions, and failed summary delivery do not trigger automatic exit.
