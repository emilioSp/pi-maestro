# 20261013-101454-route-builder-failures-through-owner-escalations: Route builder failures through owner escalations

Motivation and scope: [proposal.md](proposal.md). Required behavior and acceptance criteria: [spec.md](spec.md).

## Technical decisions

### Reuse the existing escalation path

`src/workflow/builder/completeBuilderPass.ts` saves the handoff and applies the workflow transition. `src/workflow/escalation/resolveEscalations.ts` already records owner decisions and permits another builder pass.

Keep these responsibilities and the existing escalation data contract. No new tool or workflow phase is needed.

`src/tools/main/run-builder.ts` checks execution errors through `src/tools/utils/pi-subagent-delegation.ts` before reading a saved outcome. Preserve this boundary instead of adding recovery behavior.

### Compatibility

This is a breaking MVP change. Treat the current model as if the removed outcome and phase never existed. Do not add migrations, compatibility readers, deprecated aliases, or dedicated legacy-format tests. Keep existing artifact version values unchanged.
