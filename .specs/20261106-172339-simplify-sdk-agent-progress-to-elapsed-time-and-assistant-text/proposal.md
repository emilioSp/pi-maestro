# 20261106-172339-simplify-sdk-agent-progress-to-elapsed-time-and-assistant-text: Simplify SDK agent progress to elapsed time and assistant text

## Problem

Each builder, verifier, and simplifier run shows a progress line such as
`Builder | Elapsed: 2m 14s | Active tool: bash`. The role label adds little because the running tool is already visible in Pi, and the active tool list
duplicates information the owner does not need while watching the run. The tool tracking exists only to feed that list.

## Goal and scope

Progress shows elapsed time and the latest normal assistant text. Child tool execution is no longer tracked for progress. One reversible change across the
shared run progress module and its callers.

## Out of scope

Update cadence, Pi presentation and truncation, saved child sessions, role guidance, handoff formats, and workflow phases stay as they are.

## Required behavior

See [spec.md](spec.md).
