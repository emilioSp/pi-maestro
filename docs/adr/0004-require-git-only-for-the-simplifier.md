---
type: ADR
id: 'ADR-004'
title: 'Require Git only for the simplifier'
status: active
---

## Context

Supersedes [ADR-001](0001-keep-the-workflow-independent-of-git.md).

The `simplifier` needs a list of changed code files. Git can supply that list without adding file tracking to `builder` `handoffs`.

## Decision

Only the `simplifier` requires Git and a Git repository to discover changed files. It has no non-Git fallback.

The Git readiness decision belongs only inside `maestro_run_simplifier`, before delegation. The tool checks readiness with `git rev-parse --is-inside-work-tree` in the
project directory. Only a successful result of `true` enables simplification.

Activation, `spec` preparation, `builder` execution, `verifier` completion, and `finding` resolution do not check Git readiness. Both `simplifier` entry routes save
`simplifier-running` before `Maestro` calls `maestro_run_simplifier`.

`Maestro` does not create automatic commits or Git checkpoints. The `owner` retains control of commits, pull requests, and merging.

## Consequences

If Git readiness cannot be confirmed, `maestro_run_simplifier` reports a warning and skips delegation. The workflow moves from `simplifier-running` to `candidate-ready`
without an error. The skip transition is defined in `src/workflow/transitions.ts` and applied through `transitionWorkflow`.

Activation does not predict whether simplification will be skipped. The same readiness decision applies after successful verification and after the `owner` rejects all
current `findings`. Rejected `findings` retain their reasons and do not become passed verification.

The `simplifier` uses Git to select all staged, unstaged, and untracked code changes, including pre-existing changes. There is no spec-specific starting commit or
`builder` file list. Required caller updates can include initially unchanged files.
