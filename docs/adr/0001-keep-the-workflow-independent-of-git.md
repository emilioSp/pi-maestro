---
type: ADR
id: 'ADR-001'
title: 'Keep the workflow independent of Git'
status: superseded
date: 2026-10-07
---

## Context

Superseded by [ADR-004](0004-require-git-only-for-the-simplifier.md).

The previous workflow required Git and used checkpoints and automatic commits. The recorded reason for removing that approach was to simplify the project. Other evaluated
alternatives were not recorded.

## Decision

`Maestro` uses the Pi project directory and saved workflow phase. It does not require Git or create automatic commits.

The `verifier` checks live project files. The `owner` controls later Git use, pull requests, and merging.

## Consequences

Workflow execution no longer depends on Git. Revision and commit fields were removed without migration or compatibility readers. Interrupted and older workflows require
manual `owner` handling.
