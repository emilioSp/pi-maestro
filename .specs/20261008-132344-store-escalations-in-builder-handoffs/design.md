# 20261008-132344-store-escalations-in-builder-handoffs: Store escalations in builder handoffs

Motivation and scope: [proposal.md](proposal.md). Required behavior and acceptance criteria: [spec.md](spec.md).

## Technical decisions

### Tool contract and data flow

Use `maestro_record_builder_handoff` for `done` and `escalation`.
Its inputs are `specId` and the handoff content specified in [spec.md](spec.md). The tool supplies the handoff version and path.
Remove `maestro_open_escalation` from child tool registration.

Use `maestro_resolve_escalations` with `specId` and a nonempty `decisions` array.
Each array item contains `escalationId`, `selectedOptionId`, `decision`, and `reason`.
Remove the singular `maestro_resolve_escalation` tool. Do not keep an alias.
The tool selects the active builder handoff from `specId`, as finding resolution selects the active verifier handoff.

An escalation submission saves `escalation-decision`.
A complete valid decision batch saves `ready-for-builder`.
Keep the `done` transition to `ready-for-verifier`.
Do not introduce workflow phases or change the verifier finding contract.

Update builder, verifier, and Maestro runtime instructions to use embedded escalation questions and resolutions.
Maestro presents all current questions with handoff-qualified IDs and collects all decisions before batch submission.
The builder records one handoff outcome and stops. Later passes read owner resolutions from builder handoffs.

The model follows `src/artifacts/verifier-handoff/schema.ts`, `src/tools/child/record-verifier-handoff.ts`, and `src/workflow/findings/resolveFindings.ts`.
Keep embedded escalation validation with its owning handoff contract. No parallel storage model is required.
