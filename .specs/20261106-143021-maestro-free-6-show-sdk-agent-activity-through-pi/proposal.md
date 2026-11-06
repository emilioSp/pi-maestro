# MAESTRO-FREE-6: Show SDK agent activity through Pi

## Problem

1. The owner sees the workflow phase but not the child agent's live activity.
2. Long runs give little information for deciding whether to keep waiting or interrupt.

## Goal and scope

1. Add live activity to the existing builder, verifier, and simplifier run tools.
2. Follow [ADR-010, decisions 10 and 11](../../ADR.md#adr-010-use-the-pi-sdk-for-sequential-agent-delegation), using the existing shared SDK execution path.
3. Deliver [MAESTRO-FREE-6](../../ROADMAP.md#maestro-free-6-show-sdk-agent-activity-through-pi).

## Out of scope

1. Custom dashboards, renderers, transcript inspectors, or configurable display sizes.
2. Additional model requests or prompts to generate progress.
3. Execution-engine, workflow, recovery, or handoff redesign.

## Required behavior

See [spec.md](spec.md).
