---
type: Roadmap
id: 'MAESTRO-12'
title: 'Verify code quality against AGENTS.md instructions'
status: completed
---

## Objective

Require independent review of affected code against applicable `AGENTS.md` code-quality rules.

This review was later removed by [MAESTRO-24](maestro-24-add-a-simplifier-with-one-clear-purpose-per-agent.md).

See the
[specification](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/.specs/20261013-185941-verify-code-quality-against-agents-md-instructions/spec.md).

## Completed When

- The `verifier` checks code affected by the approved change against applicable written rules.
- A rule-violation `finding` identifies the instruction file, quotes the rule, and explains the violation.
- Missing rules skip only this added review. Personal preferences are not requirements.
