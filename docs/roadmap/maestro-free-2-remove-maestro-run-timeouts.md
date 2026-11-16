---
type: Roadmap
id: 'MAESTRO-FREE-2'
title: 'Remove Maestro run timeouts'
status: completed
---

## Objective

Remove configured agent timeouts and their defaults from `Maestro`.

## Completed When

- Configuration no longer supports the three `timeoutMinutes` fields.
- Existing configurations containing those fields fail validation until the `owner` removes them; no migration or compatibility handling is added.
- Configuration documentation no longer offers agent timeout settings.

The fixed deadline used by the former `pi-subagents` integration was removed separately by the SDK migration.
