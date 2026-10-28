# 20261015-140755-record-escalation-resolutions-when-the-spec-changes: Record escalation resolutions when the spec changes

Motivation and scope: [proposal.md](proposal.md). Required behavior and acceptance criteria: [spec.md](spec.md).

## Technical decisions

Reuse the existing resolution operation and handoff schema. The resolution's existing decision text can describe an agreed spec change.
Define both resolution routes explicitly in src/workflow/transitions.ts and apply each through transitionWorkflow.
Do not assign the next phase directly in the resolution operation.
Remove escalation-decision from the phases allowed for spec approval, without removing findings-decision.

Relevant boundaries: src/tools/main/resolve-escalations.ts exposes the tool input and result, src/workflow/builder/resolveEscalations.ts saves answers, and src/artifacts/builder-handoff/schema.ts defines the saved fields.
