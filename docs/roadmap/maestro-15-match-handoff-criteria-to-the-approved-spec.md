---
type: Roadmap
id: 'MAESTRO-15'
title: 'Match handoff criteria to the approved spec'
status: completed
---

## Objective

Require every approved `spec` criterion ID in each submitted `builder` and `verifier` `handoff`.

See the
[specification](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/.specs/20261013-211629-match-handoff-criteria-to-the-approved-spec/spec.md).

## Completed When

- Both submissions check for every approved `acceptance criterion` ID before saving a report or changing phase.
- Missing IDs reject the submission. Extra report IDs remain allowed.
- This check does not add duplicate-ID validation to the `spec`.
