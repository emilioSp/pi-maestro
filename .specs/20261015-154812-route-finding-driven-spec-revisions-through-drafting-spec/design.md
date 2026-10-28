# 20261015-154812-route-finding-driven-spec-revisions-through-drafting-spec: Route finding-driven spec revisions through drafting-spec

Motivation and scope: [proposal.md](proposal.md). Required behavior and acceptance criteria: [spec.md](spec.md).

## Technical decisions

Define the new findings-decision to drafting-spec transition in src/workflow/transitions.ts and apply it through transitionWorkflow.
Remove findings-decision from the phases accepted for spec approval.

Reuse the existing resolution operation and the finding's decision object. Do not add a tool, a parallel decision store, or a batch-level revision flag.
A separate revise-spec decision records why the requirements must change without mislabeling it as a code fix or rejection.

Relevant boundaries: src/artifacts/verifier-handoff/schema.ts defines saved decisions, src/tools/main/resolve-findings.ts defines tool input and results, and src/workflow/verifier/resolveFindings.ts maps submitted decisions into the saved report.
The mapper and event selection must preserve the new decision rather than treating it as fix-code.
