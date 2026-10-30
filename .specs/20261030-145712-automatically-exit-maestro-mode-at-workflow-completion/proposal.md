# Automatically exit Maestro mode at workflow completion

## Problem

After a workflow reaches `candidate-ready`, Pi stays in `Maestro` mode. The `owner` must toggle `/maestro` manually before returning to normal Pi use.

## Goal and scope

Implement [MAESTRO-26](https://linear.app/emilio-spatola/issue/MAESTRO-26): automatically leave `Maestro` mode after delivering the final summary of a completed workflow, including when simplification is skipped because Git is unavailable. Preserve saved workflow files.

## Out of scope

Workflow recovery, new workflow phases, changes to agent responsibilities, and automatic review, commits, pull requests, or merging.

## Required behavior

See [spec.md](spec.md).
