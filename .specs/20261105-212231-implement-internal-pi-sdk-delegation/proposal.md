# 20261105-212231-implement-internal-pi-sdk-delegation: Implement internal Pi SDK delegation

## Problem

`Maestro` currently delegates all three implementation roles through `pi-subagents`. Removing that dependency requires a verified SDK execution mechanism before changing
how the roles run. Combining both changes would make execution problems harder to distinguish from workflow problems.

## Goal and scope

Deliver one internal, role-independent SDK executor under `src/delegation/`, following [ADR-010](../../ADR.md#adr-010-use-the-pi-sdk-for-sequential-agent-delegation).
This is [MAESTRO-FREE-PRE-3](../../ROADMAP.md#maestro-free-pre-3-implement-internal-sdk-delegation), not the role migration.

Verify the executor manually in this item. Automated integration tests are deferred to the following migration tasks; useful unit tests remain in scope. Update existing
human documentation where the new internal capability needs explaining, without describing the existing workflow as SDK-based.

## Out of scope

1. Switching the `builder`, `verifier`, or `simplifier` from `pi-subagents`, or removing that dependency.
2. New automated integration tests for the standalone executor.
3. New public tools, execution-engine configuration, a general-purpose delegation framework, or shared in-memory workflow state.
4. Live progress presentation, transcript inspectors, automatic session resumption, retries in new child sessions, or rollback.
5. Compatibility adapters, integration health checks, or tool filters intended to prevent further delegation.

## Required behavior

See [spec.md](spec.md). Approved technical decisions are recorded in [design.md](design.md).
