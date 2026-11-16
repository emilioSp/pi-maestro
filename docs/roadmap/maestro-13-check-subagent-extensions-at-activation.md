---
type: Roadmap
id: 'MAESTRO-13'
title: 'Check subagent extensions at activation'
status: completed
---

## Objective

Check parent `pi-subagents` availability before activation, without launching an agent.

This check was later removed by the SDK migration.

See the
[specification](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/.specs/20261013-194407-check-pi-subagents-availability-with-ping-at-activation/spec.md).

## Completed When

- Activation requires a matching successful version 1 `ping` reply within 2000 ms.
- Failed or invalid replies, emission errors, and timeouts prevent activation and explain the installation requirement.
- The check starts no agent or model request and makes no claim about child execution readiness.
