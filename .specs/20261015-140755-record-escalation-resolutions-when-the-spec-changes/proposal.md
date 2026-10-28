# 20261015-140755-record-escalation-resolutions-when-the-spec-changes: Record escalation resolutions when the spec changes

> After owner approval, this specification is the contract for the builder and verifier.

## Context, goals, and scope

R-17 requires a saved answer for every current builder escalation, including answers that require a spec revision.
Currently, the revision route bypasses resolution recording and permits direct approval from escalation-decision.

Save all answers in their original builder handoff before leaving escalation-decision. Reuse the same spec for revision and renewed approval.

Out of scope: changes to verifier finding decisions, automatic recovery, parallel decision storage, new tools, new workflow phases, and the general R-18/R-19 guidance changes.
Exclusion of scenarios already covered by tests applies to this spec only.

## Documents

Required behavior and acceptance criteria: [spec.md](spec.md).

Technical decisions: [design.md](design.md).
