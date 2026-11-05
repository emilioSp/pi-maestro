# 20261105-212231-implement-internal-pi-sdk-delegation: Implement internal Pi SDK delegation

## Decisions

1. Use Pi's in-process SDK through `createAgentSession()`, not RPC subprocesses. The owner reconfirmed this choice after comparing implementation complexity and
   cancellation. Follow [ADR-010](../../ADR.md#adr-010-use-the-pi-sdk-for-sequential-agent-delegation); do not introduce another execution engine.
2. Place the implementation under the new `src/delegation/` directory. Expose one primary execution operation, independent of the `builder`, `verifier`, and `simplifier`.
   Keep workflow interpretation and `handoff` validation with the existing callers. New implementation modules and useful colocated unit tests belong in this directory;
   do not introduce additional source directories. Module names and routine implementation details remain implementation choices.
3. Use Pi's native resource discovery, tool support, cancellation, and session persistence rather than reimplementing those systems. Exclude the main `Maestro` extension
   before loading it into a child. Retain the parent's active `Maestro` state.
4. Callers await each execution before starting the next. Do not add queues, locks, or concurrent-request management. This item does not change the workflow tools;
   their SDK integration belongs to the following migration tasks.

## Risks and limits

Child conversations are separate, but the SDK shares the main Pi process. Cancellation is cooperative: the executor forwards it to `session.abort()` and waits before
cleanup. There is no forced termination of a single SDK child. Terminating Pi ends its in-process sessions, but is not a guarantee that external processes launched by
tools also terminate, and does not undo completed file writes.

Cleanup must include extension shutdown, not only removing session event listeners. In Pi 1.5.0, `AgentSession.dispose()` alone does not emit `session_shutdown`; native
runtime shutdown handles that event. The executor must complete the appropriate native lifecycle for the resources it owns.

Enabled external integrations retain the compatibility limits in ADR-010. This item introduces no custom parity checks, adapters, or fallback framework.
