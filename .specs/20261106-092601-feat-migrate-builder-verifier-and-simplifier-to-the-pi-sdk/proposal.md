# Migrate builder, verifier, and simplifier to the Pi SDK

## Problem

1. The three workflow roles still execute through `pi-subagents`.
2. The accepted internal SDK executor is not connected to workflow execution.

## Goal and scope

1. Implement MAESTRO-FREE-3, MAESTRO-FREE-4, MAESTRO-FREE-5, and the code cleanup from MAESTRO-FREE-7 together. Package cleanup remains with the owner.
2. Connect all three role tools to the existing internal SDK executor.
3. Remove workflow reliance on `pi-subagents` activation checks and delegation deadlines.
4. Forward run-tool cancellation signals to the existing executor and expose saved native child session paths.
5. Adapt existing integration tests for the full workflow and supported optional-phase combinations to SDK execution; no separate clean-install suite.
6. Reuse the three bundled role instruction bodies and remove their frontmatter.
7. Remove `pi-subagents` imports, obsolete delegation and preflight code, and test coupling.
8. Update human documentation for owner workflows and link this spec from all four roadmap items. Update active Maestro guidance separately from human documentation.

## Out of scope

1. Live activity presentation: MAESTRO-FREE-6.
2. New execution engines, engine selectors, parallel runs, or automatic recovery.
3. Workflow, handoff format, or role responsibility redesign.
4. Uninstalling `pi-subagents` and removing its package declarations, lockfile entries, bundling, and `pi.subagents` metadata: handled manually by the owner.

## Required behavior

See [spec.md](spec.md).

## Existing architecture

See [ADR-010](../../ADR.md#adr-010-use-the-pi-sdk-for-sequential-agent-delegation).
