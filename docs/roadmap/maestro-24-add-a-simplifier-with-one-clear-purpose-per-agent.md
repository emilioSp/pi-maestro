---
type: Roadmap
id: 'MAESTRO-24'
title: 'Add a simplifier with one clear purpose per agent'
status: completed
---

## Objective

Give the `simplifier` one role: refactor accepted code for clarity after verification, with a separate report.

See the
[specification](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/.specs/20261016-090319-add-a-dedicated-simplifier-after-verification/spec.md).

## Completed When

- Successful verification or rejection of all `findings` leads to simplification without another approval or verification cycle.
- The tool checks Git readiness and skips delegation with a warning if Git is unavailable.
- The `simplifier` considers staged, unstaged, and untracked code changes, including pre-existing edits, while preserving behavior and the accepted check baseline.
- No refactoring is required when the code is already clear. Unrelated refactoring, index changes, and automatic commits are excluded.
- A completed `pass` saves the unnumbered `handoffs/simplifier/S.json` with refactored files, summary, and notes.
- The final summary separates simplification from independent verification. The extra code-quality review from
  [MAESTRO-12](maestro-12-verify-code-quality-against-agentsmd-instructions.md) is removed.
